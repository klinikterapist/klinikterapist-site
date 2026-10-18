/**
 * One post: loads the Drive draft (or the live post, or this device's copy of a new draft), edits
 * it with autosave, and publishes / unpublishes / deletes it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiFailure, type Draft, type LangFields } from '../../api/types';
import type { Category, Lang } from '../../../lib/schemas';
import { postPath } from '../../../i18n/routes';
import { isoDay, LANG_LABEL, normalizeDraft } from '../../lib/draft';
import { EDITOR_FIELDS, publishChecklist, type ChecklistItem } from '../../lib/checklist';
import { runSeoChecks } from '../../lib/seo-check';
import { docToMarkdown } from '../../lib/markdown';
import { UnknownReferenceError, citedIds, renderReferencesSection } from '../../../lib/citations';
import { countWords, readingTime } from '../../../lib/readingTime';
import { liveToDraft, loadSiteState, type LoadedPost } from '../../lib/posts-repo';
import { PublishError, buildPublishChangeset, buildUnpublishChangeset } from '../../lib/publish';
import { go, usePanel } from '../context';
import { useDeploy } from '../DeployStatus';
import { Banner, Button, Dialog, Spinner } from '../kit';
import { ImageStore } from './images';
import { PostEditor } from './PostEditor';
import { EditorTopBar, type MoreAction } from './EditorTopBar';
import { MetaPanel } from './MetaPanel';
import { SettingsPanel } from './SettingsPanel';
import { ChecklistPanel } from './ChecklistPanel';
import { RailPanelFrame, SHEET_BELOW, SideRail, useNarrow, useRailPanel } from './SideRail';
import { PreviewDialog } from './PreviewDialog';
import { clearBackup, readBackup, useAutosave, type AutosaveStatus } from './useAutosave';
import { scoreTone, SeoPanel, useDebounced } from './SeoPanel';
import { VersionsDialog } from './VersionsDialog';
import { restoreLang } from '../../lib/versions';

type Loaded = { draft: Draft; live: LoadedPost | null; categories: Category[]; siteName: Record<Lang, string> | null; others: LoadedPost[]; restore: Draft | null; inDrive: boolean };

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  kaydedildi: 'Taslak kaydedildi',
  kaydediliyor: 'Kaydediliyor…',
  cihazda: 'Bağlantı yok — bu cihazda saklandı, tekrar denenecek',
  çakışma: 'Başka bir cihazda daha yeni bir kopya var',
  silinmiş: 'Bu taslak başka bir cihazda yayınlanmış ya da silinmiş',
};

function figureNames(d: Draft): Set<string> {
  const out = new Set<string>();
  const walk = (n: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (n.type === 'figure' && typeof n.attrs?.src === 'string' && n.attrs.src.replace(/^\.\//, '')) out.add(n.attrs.src.replace(/^\.\//, ''));
    (n.content as (typeof n)[] | undefined)?.forEach(walk);
  };
  walk(d.tr.doc);
  walk(d.en.doc);
  if (d.cover) out.add(d.cover);
  return out;
}

export function EditorPage({ postKey }: { postKey: string }) {
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
  return <Editing loaded={loaded} />;
}

type Done = { kind: 'published' | 'unpublished' | 'deleted'; urls?: { tr: string; en: string }; notices?: string[] };

function Editing({ loaded }: { loaded: Loaded }) {
  const { api } = usePanel();
  const deploy = useDeploy();
  const auto = useAutosave(loaded.draft, api);
  const { draft, update } = auto;
  const [lang, setLang] = useState<Lang>('tr');
  const [version, setVersion] = useState(0);
  const [coverVersion, setCoverVersion] = useState(0);
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

  const repoImages = useMemo(
    () =>
      new Map(
        (loaded.live?.files ?? [])
          .filter((f) => !f.path.endsWith('.md'))
          .map((f) => [f.path.slice(`src/content/posts/${loaded.live!.key}/`.length), f.path]),
      ),
    [loaded.live],
  );
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

  const onLang = useCallback((patch: Partial<LangFields>) => update((d) => ({ ...d, [lang]: { ...d[lang], ...patch } })), [lang, update]);
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

  const onPublish = () => {
    if (!blocked) return setConfirm('publish');
    setFlagMissing(true);
    setRail('checklist');
    setFocusField('checklist');
  };

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
      const site = await loadSiteState(api);
      const live = site.posts.find((p) => p.key === draft.key) ?? null;
      const imgs = await images.forPublish(figureNames(draft));
      // "Yine de yayınla": the owner chose to replace the version published elsewhere.
      const toPublish = force && live ? { ...draft, base: { tr: live.tr.sha, en: live.en.sha } } : draft;
      const cs = buildPublishChangeset({
        draft: toPublish,
        live,
        allLive: site.posts,
        redirects: site.redirects,
        categories: site.categories.list,
        images: imgs,
        today: isoDay(new Date()),
      });
      const { commitSha } = await api.commit({
        message: `${live ? 'Yazı güncellendi' : 'Yazı yayınlandı'}: ${draft.tr.title}`,
        writes: cs.writes,
        deletes: cs.deletes,
      });
      auto.stop();
      await api.deleteDraft(draft.key).catch(() => {});
      clearBackup(draft.key, window.localStorage);
      deploy.track(commitSha);
      setDone({ kind: 'published', urls: { tr: postPath(draft.tr.slug, 'tr'), en: postPath(draft.en.slug, 'en') }, notices: cs.notices });
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
      await api.deleteDraft(draft.key);
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
        more={more}
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

      <div className="editor-toolbar-slot" ref={setToolbarHost} />

      <div className={`editor-grid ${rail && !narrow ? 'has-panel' : ''}`}>
        <div className="editor-main">
          <div aria-label={LANG_LABEL[lang]}>
            <PostEditor key={`${lang}-${version}`} lang={lang} fields={draft[lang]} onChange={onLang} images={images} onError={setMessage} toolbarHost={toolbarHost} />
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
                onCoverUploaded={() => setCoverVersion((v) => v + 1)}
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

      <footer className="editor-footer">
        <span className="editor-footer-left"><Button variant="ghost" onClick={() => setVersioning(true)}>
            Sürüm geçmişi
          </Button></span>
        <span>{`${words} kelime · ${minutes} dk okuma`}</span>
      </footer>

      {versioning && <VersionsDialog api={api} draftKey={draft.key} lang={lang} onRestore={restoreVersion} onClose={closeVersions} />}
      {previewing && <PreviewDialog draft={draft} lang={lang} images={images} onClose={closePreview} />}
      {confirm === 'publish' && (
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
              ? 'Yayındaki yazı olduğu gibi kalır; kaydedilmemiş değişiklikler silinir.'
              : "Taslak Drive'daki çöp kutusuna taşınır (30 gün içinde oradan geri alınabilir)."}
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
