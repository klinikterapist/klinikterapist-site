/**
 * One post: loads the Drive draft (or the live post, or this device's copy of a new draft), edits
 * it with autosave, and publishes / unpublishes / deletes it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiFailure, type Draft, type LangFields } from '../../api/types';
import type { Category, Lang } from '../../../lib/schemas';
import { postPath } from '../../../i18n/routes';
import { LANG_LABEL, PLAN_HINT, formatSchedule, isFuture, istanbulIso, istanbulParts, normalizeDraft } from '../../lib/draft';
import { EDITOR_FIELDS, publishChecklist, type ChecklistItem } from '../../lib/checklist';
import { runSeoChecks } from '../../lib/seo-check';
import { docToMarkdown } from '../../lib/markdown';
import { UnknownReferenceError, citedIds, renderReferencesSection } from '../../../lib/citations';
import { countWords, readingTime } from '../../../lib/readingTime';
import { ensureTriggersOnce, liveToDraft, loadSiteState, type LoadedPost } from '../../lib/posts-repo';
import { PublishError, buildUnpublishChangeset } from '../../lib/publish';
import { go, usePanel, type PostIntent } from '../context';
import { useDeploy } from '../DeployStatus';
import { Banner, Button, Dialog, Spinner } from '../kit';
import { ImageStore } from './images';
import { PostEditor } from './PostEditor';
import { EditorTopBar, type MoreAction } from './EditorTopBar';
import { MetaPanel } from './MetaPanel';
import { SettingsPanel } from './SettingsPanel';
import type { CoverPatch } from './CoverBlock';
import { ChecklistPanel } from './ChecklistPanel';
import { RailPanelFrame, SHEET_BELOW, SideRail, useNarrow, useRailPanel } from './SideRail';
import { PreviewDialog } from './PreviewDialog';
import { clearBackup, readBackup, useAutosave, type AutosaveStatus } from './useAutosave';
import { scoreTone, SeoPanel, useDebounced } from './SeoPanel';
import { VersionsDialog } from './VersionsDialog';
import { adoptCitedReferences } from './Citation';
import { restoreLang } from '../../lib/versions';
import { publishDraft, repoImagesOf } from '../../lib/publish-flow';

type Loaded = { draft: Draft; live: LoadedPost | null; categories: Category[]; siteName: Record<Lang, string> | null; others: LoadedPost[]; restore: Draft | null; inDrive: boolean };

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  kaydedildi: 'Taslak kaydedildi',
  kaydediliyor: 'Kaydediliyor…',
  cihazda: 'Bağlantı yok — bu cihazda saklandı, tekrar denenecek',
  çakışma: 'Başka bir cihazda daha yeni bir kopya var',
  silinmiş: 'Bu taslak başka bir cihazda yayınlanmış ya da silinmiş',
};

export function EditorPage({ postKey, intent }: { postKey: string; intent?: PostIntent }) {
  const { api } = usePanel();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    (async () => {
      const site = await loadSiteState(api);
      const live = site.posts.find((p) => p.key === postKey) ?? null;
      let draft: Draft | null = null;
      try {
        draft = normalizeDraft((await api.getDraft(postKey)).draft);
      } catch (e) {
        if (!(e instanceof ApiFailure && e.code === 'not_found')) throw e;
      }
      const inDrive = !!draft;
      const backup = readBackup(postKey, window.localStorage);
      if (!draft && live) draft = liveToDraft(live);
      let restore: Draft | null = null;
      if (!draft && backup) draft = backup;
      else if (draft && backup && JSON.stringify({ ...backup, updatedAt: '' }) !== JSON.stringify({ ...draft, updatedAt: '' })) restore = backup;
      if (!draft) throw new ApiFailure('not_found', 'Bu yazı bulunamadı. Silinmiş ya da başka bir cihazda yayınlanmış olabilir.');
      if (alive) setLoaded({ draft, live, categories: site.categories.list, siteName: site.siteName, others: site.posts.filter((p) => p.key !== postKey), restore, inDrive });
    })().catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Yazı yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, postKey, attempt]);

  if (error) {
    return (
      <section>
        <h2>Yazı</h2>
        <Banner tone="error" action={<Button onClick={() => setAttempt(attempt + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
        <p>
          <a href="#/yazilar">← Yazılara dön</a>
        </p>
      </section>
    );
  }
  if (!loaded) return <Spinner label="Yazı yükleniyor…" />;
  return <Editing loaded={loaded} intent={intent} />;
}

type Done = { kind: 'published' | 'unpublished' | 'deleted'; urls?: { tr: string; en: string }; notices?: string[] };

function Editing({ loaded, intent }: { loaded: Loaded; intent?: PostIntent }) {
  const { api } = usePanel();
  const deploy = useDeploy();
  const auto = useAutosave(loaded.draft, api);
  const { draft, update } = auto;
  // The time of day for a planned publish (Istanbul, `HH:MM`); empty = publish at once.
  const [planTime, setPlanTime] = useState(() => (loaded.draft.scheduledAt ? istanbulParts(loaded.draft.scheduledAt).time : ''));
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const planAt = planTime ? istanbulIso(draft.publishedAt, planTime) : null;
  const planning = !!planAt && isFuture(planAt, new Date());
  const [lang, setLang] = useState<Lang>('tr');
  const [version, setVersion] = useState(0);
  const [coverVersion, setCoverVersion] = useState(0);
  const bumpCover = useCallback(() => setCoverVersion((v) => v + 1), []);
  const onCover = useCallback((patch: CoverPatch) => update((d) => ({ ...d, ...patch })), [update]);
  const [restore, setRestore] = useState(loaded.restore);
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'publish' | 'unpublish' | 'delete'>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [inDrive, setInDrive] = useState(loaded.inDrive);
  const [stale, setStale] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const closePreview = useCallback(() => setPreviewing(false), []);
  const [versioning, setVersioning] = useState(false);
  const closeVersions = useCallback(() => setVersioning(false), []);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  const narrow = useNarrow(SHEET_BELOW);
  const [rail, setRail] = useRailPanel(narrow);
  const closeRail = useCallback(() => setRail(null), [setRail]);
  /** Yayınla was pressed with something missing: the checklist marks the missing required items. */
  const [flagMissing, setFlagMissing] = useState(false);
  /** A `data-field` to scroll to and focus once the panel or language it lives in has rendered. */
  const [focusField, setFocusField] = useState<string | null>(null);

  const repoImages = useMemo(() => repoImagesOf(loaded.live), [loaded.live]);
  const images = useMemo(() => new ImageStore(api, loaded.draft.key, repoImages), [api, loaded.draft.key, repoImages]);

  useEffect(() => {
    if (auto.status === 'kaydedildi' && draft.rev > 0) setInDrive(true);
  }, [auto.status, draft.rev]);

  const markdown = useMemo(() => {
    try {
      return docToMarkdown(draft[lang].doc, lang, draft[lang].references);
    } catch (e) {
      if (e instanceof UnknownReferenceError) return ''; // publishing reports it
      throw e;
    }
  }, [draft, lang]);
  // Kaynakça under the text, as on the site: only cited references, for this language.
  const referencesHtml = useMemo(() => renderReferencesSection(draft[lang].references, citedIds(markdown), lang, 'editor-references-title'), [draft, lang, markdown]);
  const words = useMemo(() => countWords(markdown), [markdown]);
  const minutes = useMemo(() => readingTime(markdown), [markdown]);

  const onLang = useCallback(
    (patch: Partial<LangFields>) =>
      update((d) => {
        const next = { ...d[lang], ...patch };
        // A citation pasted from the other language brings its reference along.
        const adopted = patch.doc ? adoptCitedReferences(next.doc, next.references, d[lang === 'tr' ? 'en' : 'tr'].references) : null;
        return { ...d, [lang]: adopted ? { ...next, references: adopted } : next };
      }),
    [lang, update],
  );
  const keywordsOf = useCallback((l: Lang) => loaded.others.map((p) => p[l].fm.focusKeyword).filter(Boolean), [loaded.others]);
  const otherKeywords = useMemo(() => keywordsOf(lang), [keywordsOf, lang]);
  // Scores for the rail dot and the checklist; debounced like the SEO panel.
  const seoDraft = useDebounced(draft, 300);
  const seoScore = useMemo(() => {
    const score = (l: Lang) => runSeoChecks({ lang: l, fields: seoDraft[l], hasCover: !!seoDraft.cover, otherKeywords: keywordsOf(l) }).score;
    return { tr: score('tr'), en: score('en') };
  }, [seoDraft, keywordsOf]);
  const checklist = useMemo(() => publishChecklist(draft, seoScore), [draft, seoScore]);
  const blocked = checklist.some((i) => i.required && !i.done);

  useEffect(() => {
    if (!focusField) return;
    setFocusField(null);
    const selector = focusField === 'checklist' ? '[data-field="checklist"] .is-flagged button' : `[data-field="${focusField}"]`;
    // The writing area's body appears a moment after a language switch: try for a few frames.
    const attempt = (left: number) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return left > 0 && requestAnimationFrame(() => attempt(left - 1));
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
    };
    attempt(10);
  }, [focusField]);

  /** A checklist item: switch to its language, open the panel that holds its field, focus the field. */
  const goTo = (item: ChecklistItem) => {
    if (item.lang && item.lang !== lang) setLang(item.lang);
    if (EDITOR_FIELDS.has(item.field)) {
      if (narrow) setRail(null); // the field is in the text, behind the sheet
      if (item.field === 'references') return; // the citation lives in the text; switching language is all
    } else {
      setRail(item.panel);
    }
    setFocusField(item.field);
  };

  // A planned draft whose publish failed: the backend keeps the reason in the drafts list.
  useEffect(() => {
    if (!loaded.draft.scheduledAt) return;
    let alive = true;
    api
      .listDrafts()
      .then(({ drafts }) => alive && setScheduleError(drafts.find((d) => d.key === loaded.draft.key)?.scheduleError ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [api, loaded.draft.key, loaded.draft.scheduledAt]);

  /** Planla: saves the plan; the backend's hourly run publishes the last saved copy. Nothing is committed here. */
  const plan = async () => {
    if (!planAt) return;
    setBusy(true);
    setMessage(null);
    ensureTriggersOnce(api);
    update((d) => ({ ...d, scheduledAt: planAt }));
    const ok = await auto.saveNow();
    setBusy(false);
    setConfirm(null);
    if (!ok) setMessage('Plan kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
    else setScheduleError(null);
  };

  const cancelPlan = async () => {
    update((d) => ({ ...d, scheduledAt: null }));
    setPlanTime('');
    setScheduleError(null);
    if (!(await auto.saveNow())) setMessage('Değişiklik kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
  };

  const onPublish = () => {
    if (!blocked) return setConfirm('publish');
    setFlagMissing(true);
    setRail('checklist');
    setFocusField('checklist');
  };

  // A button on the posts list (Yayınla, Planla, Taslağa al, Sil) opens the post and starts that step
  // here, with its usual checks and confirmation; the address then drops the request.
  const intentDone = useRef(false);
  useEffect(() => {
    if (!intent || intentDone.current) return;
    intentDone.current = true;
    window.history.replaceState(null, '', `#/yazi/${loaded.draft.key}`);
    if (intent === 'yayinla') onPublish();
    else if (intent === 'planla') {
      setRail('settings');
      setFocusField('planTime');
    } else if (intent === 'kaldir' && loaded.live && draft.published) setConfirm('unpublish');
    else if (intent === 'sil' && !draft.published) setConfirm('delete');
    // Once, on opening.
  }, [intent]); // eslint-disable-line react-hooks/exhaustive-deps

  const replaceDraft = (d: Draft) => {
    auto.replace(d);
    setVersion((v) => v + 1);
  };

  /** Restoring is a normal save (rev check, conflict dialog) that also keeps the replaced text as a version. */
  const restoreVersion = async (v: Draft) => {
    setMessage(null);
    const restoreIn = lang;
    // Pending text is saved first (so it is kept as a version); the restore builds on the newest copy.
    const ok = await auto.restoreWith((d) => restoreLang(d, v, restoreIn));
    setVersioning(false);
    if (!ok) {
      setMessage('Önce mevcut değişiklikler kaydedilmeli. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      return;
    }
    setVersion((n) => n + 1);
  };

  const publish = async (force = false) => {
    setBusy(true);
    setMessage(null);
    setStale(false);
    try {
      if (!(await auto.saveNow())) throw new PublishError('Taslak kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      const { commitSha, notices } = await publishDraft(api, draft, { now: new Date(), force, images, onCommitted: () => auto.stop() });
      clearBackup(draft.key, window.localStorage);
      deploy.track(commitSha);
      setDone({ kind: 'published', urls: { tr: postPath(draft.tr.slug, 'tr'), en: postPath(draft.en.slug, 'en') }, notices });
    } catch (e) {
      if (e instanceof PublishError && e.code === 'stale') setStale(true);
      else setMessage(e instanceof PublishError || e instanceof ApiFailure ? e.message : 'Yayınlanamadı. Değişiklikleriniz taslakta duruyor; tekrar deneyin.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const unpublish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await images.copyRepoImagesToDrive();
      update((d) => ({ ...d, published: false }));
      if (!(await auto.saveNow())) throw new PublishError('Taslak kaydedilemedi; yazı yayında kaldı. Tekrar deneyin.');
      const site = await loadSiteState(api);
      const live = site.posts.find((p) => p.key === draft.key);
      if (!live) throw new PublishError('Bu yazı zaten yayında değil.');
      const cs = buildUnpublishChangeset(live, site.redirects);
      const { commitSha } = await api.commit({ message: `Yazı yayından kaldırıldı: ${live.tr.fm.title}`, writes: cs.writes, deletes: cs.deletes });
      deploy.track(commitSha);
      setDone({ kind: 'unpublished' });
    } catch (e) {
      setMessage(e instanceof PublishError || e instanceof ApiFailure ? e.message : 'Yayından kaldırılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      auto.stop();
      await api.deleteDraft(draft.key, { trash: true });
      clearBackup(draft.key, window.localStorage);
      setDone({ kind: 'deleted' });
    } catch (e) {
      setMessage(e instanceof ApiFailure ? e.message : 'Taslak silinemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const more: MoreAction[] = [
    ...(draft.published && loaded.live ? [{ label: 'Yayından kaldır', onSelect: () => setConfirm('unpublish') }] : []),
    ...(inDrive ? [{ label: loaded.live ? 'Değişiklikleri at' : 'Taslağı sil', onSelect: () => setConfirm('delete') }] : []),
  ];

  if (done) {
    return (
      <section className="card-panel done" aria-labelledby="done-title">
        <h2 id="done-title">
          {done.kind === 'published' ? 'Yazı yayınlandı' : done.kind === 'unpublished' ? 'Yazı yayından kaldırıldı' : 'Taslak silindi'}
        </h2>
        {done.kind === 'published' && done.urls && (
          <>
            <p>Site 1–3 dakika içinde güncellenecek. Adresler:</p>
            <ul>
              <li>
                Türkçe: <a href={done.urls.tr} target="_blank" rel="noreferrer">klinikterapist.com{done.urls.tr}</a>
              </li>
              <li>
                İngilizce: <a href={done.urls.en} target="_blank" rel="noreferrer">klinikterapist.com{done.urls.en}</a>
              </li>
            </ul>
            {done.notices?.map((n) => (
              <Banner key={n}>{n}</Banner>
            ))}
            <p className="k-hint">
              Medium'a aktarmak için: Medium › Import a story › bu yazının adresi (canonical otomatik eklenir). Substack'e özet ya da farklı bir versiyon koyun.
            </p>
          </>
        )}
        {done.kind === 'unpublished' && <p>Yazı sitede görünmeyecek; içeriği taslaklarda duruyor. Eski adresler blog sayfasına yönlendirilir.</p>}
        {done.kind === 'deleted' && (
          <p>
            Çöp kutusuna taşındı. 30 gün içinde <a href="#/cop-kutusu">Çöp kutusu</a> ekranından geri alabilirsiniz.
          </p>
        )}
        <Button variant="primary" onClick={() => go('#/yazilar')}>
          Yazılara dön
        </Button>
      </section>
    );
  }

  return (
    <div className="editor-page">
      <h2 className="k-visually-hidden">Yazıyı düzenle</h2>
      <EditorTopBar
        status={
          <span className={`save-status save-${auto.status}`} role="status">
            {STATUS_TEXT[auto.status]}
          </span>
        }
        draft={draft}
        checklist={checklist}
        lang={lang}
        onLang={setLang}
        onPreview={() => setPreviewing(true)}
        onPublish={onPublish}
        publishing={busy && confirm === 'publish'}
        planning={planning}
        more={more}
        onVersions={() => setVersioning(true)}
        stats={`${words} kelime · ${minutes} dk okuma`}
      />

      {restore && (
        <Banner
          tone="warning"
          action={
            <span className="row">
              <Button
                variant={restore.rev < draft.rev ? 'danger' : 'secondary'}
                onClick={() => {
                  replaceDraft({ ...restore, rev: draft.rev });
                  setRestore(null);
                }}
              >
                {restore.rev < draft.rev ? 'Bu cihazdakini kaydet (diğerinin üzerine yaz)' : 'Geri yükle'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  clearBackup(draft.key, window.localStorage);
                  setRestore(null);
                }}
              >
                Yok say
              </Button>
            </span>
          }
        >
          {restore.rev < draft.rev
            ? `Bu cihazda kaydedilmemiş eski bir kopya var, ama bu taslağın diğer cihazda daha yeni bir sürümü kaydedilmiş (${new Date(draft.updatedAt).toLocaleString('tr-TR')}). Bu cihazdakini kaydederseniz diğer cihazdaki değişiklikler kaybolur.`
            : 'Bu cihazda kaydedilmemiş değişiklikler var. Geri yükleyelim mi?'}
        </Banner>
      )}
      {message && <Banner tone="error">{message}</Banner>}
      {flagMissing && blocked && (
        <Banner tone="warning">
          {planning ? 'Planlamadan' : 'Yayınlamadan'} önce Kontrol listesinde sarı işaretli eksikleri tamamlayın. Bir maddeye dokunursanız ilgili alana gidersiniz.
        </Banner>
      )}
      {scheduleError && draft.scheduledAt && <Banner tone="warning">{`Planlanan yayın yapılamadı, tekrar denenecek. ${scheduleError}`}</Banner>}

      <div className="editor-toolbar-slot" ref={setToolbarHost} />

      <div className={`editor-grid ${rail && !narrow ? 'has-panel' : ''}`}>
        <div className="editor-main">
          <div aria-label={LANG_LABEL[lang]}>
            <PostEditor
              key={`${lang}-${version}`}
              lang={lang}
              fields={draft[lang]}
              onChange={onLang}
              images={images}
              onError={setMessage}
              toolbarHost={toolbarHost}
              cover={{ draft, coverVersion, onShared: onCover, onCoverUploaded: bumpCover }}
            />
          </div>
          {referencesHtml && <div className="editor-references" dangerouslySetInnerHTML={{ __html: referencesHtml }} />}
        </div>

        {rail && (
          <RailPanelFrame panel={rail} sheet={narrow} onClose={closeRail}>
            {rail === 'settings' && (
              <SettingsPanel
                draft={draft}
                categories={loaded.categories}
                images={images}
                coverVersion={coverVersion}
                onShared={(patch) => update((d) => ({ ...d, ...patch }))}
                onCoverUploaded={bumpCover}
                planTime={planTime}
                onPlanTime={setPlanTime}
                planning={planning}
                onCancelPlan={cancelPlan}
                onError={setMessage}
                lang={lang}
                onLang={onLang}
              />
            )}
            {rail === 'checklist' && <ChecklistPanel items={checklist} flagMissing={flagMissing} onGo={goTo} />}
            {rail === 'seo' && <SeoPanel lang={lang} draft={draft} otherKeywords={otherKeywords} onLang={onLang} />}
            {rail === 'meta' && <MetaPanel draft={draft} lang={lang} images={images} siteName={loaded.siteName?.[lang]} onLang={onLang} />}
          </RailPanelFrame>
        )}
        <SideRail
          open={rail}
          onToggle={(p) => setRail(rail === p ? null : p)}
          dots={{ seo: scoreTone(seoScore[lang]), seoScore: seoScore[lang], checklistMissing: blocked }}
        />
      </div>

      {versioning && <VersionsDialog api={api} draftKey={draft.key} lang={lang} onRestore={restoreVersion} onClose={closeVersions} />}
      {previewing && <PreviewDialog draft={draft} lang={lang} images={images} onClose={closePreview} />}
      {confirm === 'publish' && planning && planAt && (
        <Dialog
          title="Planlansın mı?"
          history
          onClose={() => !busy && setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="primary" busy={busy} onClick={plan}>
                Evet, planla
              </Button>
            </>
          }
        >
          <p>{`Yazı ${formatSchedule(planAt)}'da yayına girecek.`}</p>
          <p className="k-hint">{PLAN_HINT} O ana kadar metin yalnızca taslakta durur; düzenlemeye devam edebilirsiniz, son kaydedilen hali yayınlanır.</p>
        </Dialog>
      )}
      {confirm === 'publish' && !planning && (
        <Dialog
          title="Yayınlansın mı?"
          history
          onClose={() => !busy && setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="primary" busy={busy} onClick={() => publish()}>
                Evet, yayınla
              </Button>
            </>
          }
        >
          <p>Yazı iki dilde şu adreslerde yayınlanacak:</p>
          <ul>
            <li>klinikterapist.com{postPath(draft.tr.slug, 'tr')}</li>
            <li>klinikterapist.com{postPath(draft.en.slug, 'en')}</li>
          </ul>
        </Dialog>
      )}
      {confirm === 'unpublish' && (
        <Dialog
          title="Yayından kaldırılsın mı?"
          history
          onClose={() => !busy && setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy} onClick={unpublish}>
                Evet, yayından kaldır
              </Button>
            </>
          }
        >
          <p>Yazı sitede görünmeyecek ve taslaklara dönecek. Eski adresleri açanlar blog sayfasına yönlendirilir. İsterseniz sonra yeniden yayınlarsınız.</p>
        </Dialog>
      )}
      {confirm === 'delete' && (
        <Dialog
          title={loaded.live ? 'Değişiklikler atılsın mı?' : 'Taslak silinsin mi?'}
          history
          onClose={() => !busy && setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy} onClick={remove}>
                {loaded.live ? 'Evet, değişiklikleri at' : 'Evet, sil'}
              </Button>
            </>
          }
        >
          <p>
            {loaded.live
              ? 'Yayındaki yazı olduğu gibi kalır. Atılan değişiklikler çöp kutusuna taşınır; 30 gün içinde oradan geri alabilirsiniz.'
              : 'Taslak çöp kutusuna taşınır. 30 gün içinde oradan geri alabilirsiniz; sonra kalıcı olarak silinir.'}
          </p>
        </Dialog>
      )}
      {stale && (
        <Dialog
          title="Yayındaki sürüm değişmiş"
          history
          onClose={() => !busy && setStale(false)}
          actions={
            <>
              <Button
                disabled={busy}
                onClick={async () => {
                  auto.stop();
                  await api.deleteDraft(draft.key).catch(() => {});
                  clearBackup(draft.key, window.localStorage);
                  window.location.reload();
                }}
              >
                Yayındaki sürümü aç (buradaki değişiklikleri at)
              </Button>
              <Button variant="danger" busy={busy} onClick={() => publish(true)}>
                Yine de yayınla (onun üzerine yaz)
              </Button>
            </>
          }
        >
          <p>Bu yazının yayındaki sürümü siz düzenlerken başka bir cihazda güncellenmiş. Burada yayınlarsanız oradaki değişiklikler kaybolur.</p>
        </Dialog>
      )}
      {auto.status === 'silinmiş' && (
        <Dialog
          title="Bu taslak başka bir cihazda yayınlanmış ya da silinmiş."
          onClose={() => {}}
          actions={
            <>
              <Button onClick={() => go('#/yazilar')}>Yazılara dön</Button>
              <Button variant="primary" onClick={async () => go(`#/yazi/${await auto.keepAsNew()}`)}>
                Bu cihazdakini yeni taslak olarak sakla
              </Button>
            </>
          }
        >
          <p>
            Burada yazdıklarınız kaydedilemedi, çünkü taslak artık yok. Bu cihazdaki metni yeni bir taslak olarak saklayabilir ya da yazılara dönüp yayındaki
            sürüme bakabilirsiniz.
          </p>
        </Dialog>
      )}
      {auto.conflict && (
        <Dialog
          title="Bu taslak başka bir cihazda daha yeni kaydedilmiş."
          onClose={() => {}}
          actions={
            <>
              <Button
                onClick={() => {
                  auto.keepTheirs();
                  setVersion((v) => v + 1);
                }}
              >
                Diğer cihazdakini aç
              </Button>
              <Button variant="danger" onClick={() => void auto.keepMine()}>
                Bu cihazdakini kaydet (diğerinin üzerine yaz)
              </Button>
            </>
          }
        >
          <p>
            Diğer cihazdaki kopya: “{auto.conflict.tr.title || 'Başlıksız'}”, {new Date(auto.conflict.updatedAt).toLocaleString('tr-TR')}. Hangisini
            tutalım?
          </p>
        </Dialog>
      )}
    </div>
  );
}
