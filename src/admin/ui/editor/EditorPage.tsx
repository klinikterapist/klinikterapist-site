/**
 * One post: loads the Drive draft (or the live post, or this device's copy of a new draft), edits
 * it with autosave, and publishes / unpublishes / deletes it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiFailure, type Draft, type LangFields } from '../../api/types';
import type { Category, Lang } from '../../../lib/schemas';
import { postPath } from '../../../i18n/routes';
import { canPublish, describeMissing, isoDay, LANG_LABEL, missingFields } from '../../lib/draft';
import { liveToDraft, loadSiteState, type LoadedPost } from '../../lib/posts-repo';
import { PublishError, buildPublishChangeset, buildUnpublishChangeset } from '../../lib/publish';
import { go, usePanel } from '../context';
import { useDeploy } from '../DeployStatus';
import { Banner, Button, Dialog, Spinner } from '../kit';
import { ImageStore } from './images';
import { PostEditor } from './PostEditor';
import { PostSettings } from './PostSettings';
import { clearBackup, readBackup, useAutosave, type AutosaveStatus } from './useAutosave';
import { SeoPanel } from './SeoPanel';

type Loaded = { draft: Draft; live: LoadedPost | null; categories: Category[]; others: LoadedPost[]; restore: Draft | null; inDrive: boolean };

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  kaydedildi: 'Taslak kaydedildi',
  kaydediliyor: 'Kaydediliyor…',
  cihazda: 'Bağlantı yok — bu cihazda saklandı, tekrar denenecek',
  çakışma: 'Başka bir cihazda daha yeni bir kopya var',
};

function figureNames(d: Draft): Set<string> {
  const out = new Set<string>();
  const walk = (n: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (n.type === 'figure' && typeof n.attrs?.src === 'string') out.add(n.attrs.src.replace(/^\.\//, ''));
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
        draft = (await api.getDraft(postKey)).draft;
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
      if (alive) setLoaded({ draft, live, categories: site.categories.list, others: site.posts.filter((p) => p.key !== postKey), restore, inDrive });
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
          <a href="#/">← Yazılara dön</a>
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

  const check = canPublish(draft);
  const missing = describeMissing(check);
  const onLang = useCallback((patch: Partial<LangFields>) => update((d) => ({ ...d, [lang]: { ...d[lang], ...patch } })), [lang, update]);
  const otherKeywords = loaded.others.map((p) => p[lang].fm.focusKeyword).filter(Boolean);

  const replaceDraft = (d: Draft) => {
    auto.replace(d);
    setVersion((v) => v + 1);
  };

  const publish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!(await auto.saveNow())) throw new PublishError('Taslak kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      const site = await loadSiteState(api);
      const live = site.posts.find((p) => p.key === draft.key) ?? null;
      const imgs = await images.forPublish(figureNames(draft));
      const cs = buildPublishChangeset({
        draft,
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
      setMessage(e instanceof PublishError || e instanceof ApiFailure ? e.message : 'Yayınlanamadı. Değişiklikleriniz taslakta duruyor; tekrar deneyin.');
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
        <Button variant="primary" onClick={() => go('#/')}>
          Yazılara dön
        </Button>
      </section>
    );
  }

  return (
    <div className="editor-page">
      <h2 className="k-visually-hidden">Yazıyı düzenle</h2>
      <div className="editor-top">
        <a href="#/">← Yazılar</a>
        <span className={`save-status save-${auto.status}`} role="status">
          {STATUS_TEXT[auto.status]}
        </span>
      </div>

      {restore && (
        <Banner
          tone="warning"
          action={
            <span className="row">
              <Button
                onClick={() => {
                  replaceDraft({ ...restore, rev: draft.rev });
                  setRestore(null);
                }}
              >
                Geri yükle
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
          Bu cihazda kaydedilmemiş değişiklikler var. Geri yükleyelim mi?
        </Banner>
      )}
      {message && <Banner tone="error">{message}</Banner>}

      <div className="editor-grid">
        <div className="editor-main">
          <div className="lang-tabs" role="tablist" aria-label="Dil">
            {(['tr', 'en'] as Lang[]).map((l) => {
              const ok = missingFields(draft[l], l, !!draft.cover).length === 0;
              return (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={lang === l}
                  className={`lang-tab ${lang === l ? 'is-active' : ''}`}
                  onClick={() => setLang(l)}
                >
                  {LANG_LABEL[l]} <span className={`dot ${ok ? 'dot-ok' : 'dot-missing'}`}>{ok ? '✓' : '(eksik)'}</span>
                </button>
              );
            })}
          </div>
          <div role="tabpanel" aria-label={LANG_LABEL[lang]}>
            <PostEditor key={`${lang}-${version}`} lang={lang} fields={draft[lang]} onChange={onLang} images={images} onError={setMessage} />
          </div>
        </div>

        <aside className="editor-side">
          <section className="side-card publish-card" aria-label="Yayın">
            {draft.published ? <p className="badge badge-live">Yayında</p> : <p className="badge">Taslak</p>}
            <Button variant="primary" disabled={!check.ok} busy={busy && confirm === 'publish'} onClick={() => setConfirm('publish')}>
              {draft.published ? 'Değişiklikleri yayınla' : 'Yayınla'}
            </Button>
            {!check.ok && (
              <>
                <p className="k-hint">Yayınlamak için iki dil de tamamlanmalı:</p>
                <ul className="missing" aria-label="Eksikler">
                  {missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="row">
              {draft.published && loaded.live && (
                <Button variant="ghost" onClick={() => setConfirm('unpublish')}>
                  Yayından kaldır
                </Button>
              )}
              {inDrive && (
                <Button variant="ghost" onClick={() => setConfirm('delete')}>
                  {loaded.live ? 'Değişiklikleri at' : 'Taslağı sil'}
                </Button>
              )}
            </div>
          </section>
          <PostSettings
            draft={draft}
            lang={lang}
            categories={loaded.categories}
            images={images}
            coverVersion={coverVersion}
            onShared={(patch) => update((d) => ({ ...d, ...patch }))}
            onLang={onLang}
            onCoverUploaded={() => setCoverVersion((v) => v + 1)}
            onError={setMessage}
          />
          <SeoPanel lang={lang} draft={draft} otherKeywords={otherKeywords} images={images} />
        </aside>
      </div>

      {confirm === 'publish' && (
        <Dialog
          title="Yayınlansın mı?"
          onClose={() => !busy && setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="primary" busy={busy} onClick={publish}>
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
