/** Posts: live, draft and planned, with search, category filter and status. */
import { useEffect, useMemo, useState } from 'react';
import { ApiFailure, type DraftSummary } from '../api/types';
import type { Category } from '../../lib/schemas';
import { startNewPost } from '../lib/new-post';
import { STATUS_LABEL, cachedDrafts, loadDrafts, loadSiteState, mergeList, type PostRow, type SiteState } from '../lib/posts-repo';
import { formatSchedule } from '../lib/draft';
import { go, usePanel, type PostsTab } from './context';
import { CalendarCheck, CalendarClock, Clock3, Eye, FileText, Icon, PencilLine, Rocket, Search, Sparkles, Trash2, Undo2, type LucideIcon } from './icons';
import { readsByPost } from '../lib/stats';
import type { Tone } from './Shell';
import { Banner, Button, EmptyState, Field, Select, Spinner } from './kit';


/** How each status looks in the list: a tone and an icon beside the title. */
const STATUS_LOOK: Record<PostRow['status'], { tone: Tone; icon: LucideIcon }> = {
  yayında: { tone: 'adacayi', icon: Sparkles },
  'yayında-değişiklik-var': { tone: 'kiremit', icon: PencilLine },
  taslak: { tone: 'gunes', icon: FileText },
  planlandı: { tone: 'lavanta', icon: CalendarClock },
};

/** Covers of the live posts, read once from the repo in one call and kept for this visit. */
const coverCache = new Map<string, string>();

function useCovers(api: ReturnType<typeof usePanel>['api'], rows: PostRow[] | null): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(() => new Map(coverCache));
  useEffect(() => {
    const want = (rows ?? []).filter((r) => r.coverPath && !coverCache.has(r.key));
    if (!want.length) return;
    let alive = true;
    api
      .read(want.map((r) => r.coverPath!))
      .then(({ files }) => {
        for (const r of want) {
          const f = files.find((x) => x.path === r.coverPath);
          if (f) coverCache.set(r.key, `data:${r.coverPath!.endsWith('.jpg') ? 'image/jpeg' : 'image/webp'};base64,${f.content}`);
        }
        if (alive) setMap(new Map(coverCache));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, rows]);
  return map;
}

/** The cover on the left; without one, the status icon in a soft square. */
function PostThumb({ row, url }: { row: PostRow; url?: string }) {
  const look = STATUS_LOOK[row.status];
  if (url) return <img className="post-thumb" src={url} alt="" loading="lazy" />;
  return (
    <span className={`post-thumb post-thumb-empty tone-${look.tone}`} aria-hidden="true">
      <Icon as={look.icon} size={22} />
    </span>
  );
}

/**
 * The buttons on the right (owner's review 2026-10-21). Live: Düzenle, Taslağa al (takes it off the
 * site; it stays as a draft). Drafts: Yayınla, Planla, Düzenle, Sil. Each opens the post and starts
 * that step there, with the editor's own checks and confirmation.
 */
function PostActions({ row }: { row: PostRow }) {
  const to = (intent?: string) => `#/yazi/${row.key}${intent ? `?islem=${intent}` : ''}`;
  const act = (href: string, label: string, icon: LucideIcon, kind = '') => (
    <a className={`post-act ${kind}`} href={href} title={label}>
      <Icon as={icon} size={15} />
      <span>{label}</span>
    </a>
  );
  return (
    <div className="post-acts" aria-label={`${row.title}: işlemler`} role="group">
      {row.live ? (
        <>
          {act(to(), 'Düzenle', PencilLine, 'is-main')}
          {act(to('kaldir'), 'Taslağa al', Undo2)}
        </>
      ) : (
        <>
          {act(to('yayinla'), 'Yayınla', Rocket, 'is-main')}
          {act(to('planla'), row.status === 'planlandı' ? 'Planı değiştir' : 'Planla', CalendarClock)}
          {act(to(), 'Düzenle', PencilLine)}
          {act(to('sil'), 'Sil', Trash2, 'is-danger')}
        </>
      )}
    </div>
  );
}

/**
 * Above the tabs (owner's brief 2026-10-21: visualise): the three counts and how the live posts share
 * out over the categories, as one bar with a key.
 */
function PostsOverview({ rows, label, counts }: { rows: PostRow[]; label: (id: string) => string; counts: { live: number; drafts: number; planned: number } }) {
  const live = rows.filter((r) => r.live);
  const byCat = [...new Set(live.map((r) => r.category))]
    .map((id) => ({ id, name: label(id), n: live.filter((r) => r.category === id).length }))
    .sort((a, b) => b.n - a.n);
  return (
    <section className="posts-overview" aria-label="Yazıların özeti">
      <dl className="posts-counts">
        <div className="tone-adacayi">
          <dt>Yayında</dt>
          <dd>{counts.live}</dd>
        </div>
        <div className="tone-gunes">
          <dt>Taslak</dt>
          <dd>{counts.drafts}</dd>
        </div>
        <div className="tone-lavanta">
          <dt>Planlanan</dt>
          <dd>{counts.planned}</dd>
        </div>
      </dl>
      {live.length > 0 && (
        <div className="posts-cats">
          <span className="v2-tile-label">Yayındaki yazıların kategorileri</span>
          <span className="cat-bar" role="img" aria-label={byCat.map((c) => `${c.name}: ${c.n}`).join(', ')}>
            {byCat.map((c, i) => (
              <i key={c.id} style={{ flexGrow: c.n, background: `var(--p-chart-cat-${(i % 6) + 1})` }} />
            ))}
          </span>
          <ul className="cat-key">
            {byCat.map((c, i) => (
              <li key={c.id}>
                <i style={{ background: `var(--p-chart-cat-${(i % 6) + 1})` }} aria-hidden="true" />
                {c.name} <b>{c.n}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Drafts tab: new drafts and unsaved edits of live posts; planned ones have their own tab. */
const inDrafts = (r: PostRow) => r.status === 'taslak' || r.status === 'yayında-değişiklik-var';

const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/i̇/g, 'i');

export function PostsList({ tab }: { tab: PostsTab }) {
  const { api } = usePanel();
  const [rows, setRows] = useState<PostRow[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    const show = (site: SiteState, drafts: DraftSummary[]) => {
      setCategories(site.categories.list);
      setRows(mergeList(site.posts, drafts));
    };
    const draftsBefore = cachedDrafts(api);
    Promise.all([loadSiteState(api, { onCached: (site) => draftsBefore && alive && show(site, draftsBefore) }), loadDrafts(api)])
      .then(([site, drafts]) => {
        if (alive) show(site, drafts);
      })
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Yazılar yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const covers = useCovers(api, rows);
  const [reads, setReads] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    let alive = true;
    const today = new Date().toISOString().slice(0, 10);
    api
      .statsSummary({ from: '2024-01-01', to: today })
      .then((s) => alive && setReads(readsByPost(s)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api]);

  const counts = useMemo(
    () => ({
      live: (rows ?? []).filter((r) => r.live).length,
      drafts: (rows ?? []).filter(inDrafts).length,
      planned: (rows ?? []).filter((r) => r.status === 'planlandı').length,
    }),
    [rows],
  );

  const shown = useMemo(() => {
    const q = fold(query.trim());
    const inTab = (r: PostRow) => (tab === 'live' ? r.live : tab === 'planned' ? r.status === 'planlandı' : inDrafts(r));
    const list = (rows ?? []).filter(
      (r) => inTab(r) && (!category || r.category === category) && (!q || fold(`${r.title} ${r.titleEn}`).includes(q)),
    );
    const dir = sort === 'newest' ? -1 : 1;
    // Planned posts in the order they go live.
    if (tab === 'planned') return list.sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
    return list.sort((a, b) => dir * a.updatedAt.localeCompare(b.updatedAt));
  }, [rows, tab, query, category, sort]);

  const create = () => {
    go(startNewPost(window.localStorage, new Date()));
  };

  const label = (id: string) => categories.find((c) => c.id === id)?.label.tr ?? '—';

  return (
    <section aria-labelledby="posts-title">
      <div className="screen-head">
        <h2 id="posts-title">
          <Icon as={FileText} size={22} />
          Yazılar
        </h2>
        <Button variant="primary" onClick={create}>
          <Icon as={PencilLine} size={17} />
          Yeni yazı
        </Button>
      </div>
      {rows && rows.length > 0 && <PostsOverview rows={rows} label={label} counts={counts} />}
      <nav className="tabs" aria-label="Yazı grupları">
        {(
          [
            { id: 'live', href: '#/yazilar', label: 'Yayında', n: counts.live, icon: Sparkles, tone: 'adacayi' },
            { id: 'drafts', href: '#/yazilar/taslaklar', label: 'Taslaklar', n: counts.drafts, icon: FileText, tone: 'gunes' },
            { id: 'planned', href: '#/yazilar/planlanan', label: 'Planlanan', n: counts.planned, icon: CalendarClock, tone: 'lavanta' },
          ] as const
        ).map((t) => (
          <a key={t.id} className={`tab tab-v2 tone-${t.tone} ${tab === t.id ? 'is-active' : ''}`} href={t.href} aria-current={tab === t.id ? 'page' : undefined} aria-label={`${t.label} ${t.n}`}>
            <span className="tone-tile tone-tile-sm" aria-hidden="true">
              <Icon as={t.icon} size={15} />
            </span>
            {t.label}
            <span className="tab-count" aria-hidden="true">
              {t.n}
            </span>
          </a>
        ))}
      </nav>
      <div className="filters">
        <Field label="Ara" value={query} onChange={setQuery} placeholder="Başlıkta ara (Türkçe ya da İngilizce)" />
        <Select
          label="Kategori"
          value={category}
          options={[{ value: '', label: 'Tüm kategoriler' }, ...categories.map((c) => ({ value: c.id, label: c.label.tr }))]}
          onChange={setCategory}
        />
        <Select
          label="Sırala"
          value={sort}
          options={[
            { value: 'newest', label: 'En yeni önce' },
            { value: 'oldest', label: 'En eski önce' },
          ]}
          onChange={(v) => setSort(v === 'oldest' ? 'oldest' : 'newest')}
        />
      </div>
      {error && (
        <Banner tone="error" action={<Button onClick={() => setAttempt(attempt + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!rows && !error && <Spinner label="Yazılar yükleniyor…" />}
      {rows && rows.length === 0 && (
        <EmptyState
          icon={FileText}
          action={
            <Button variant="primary" onClick={create}>
              Yeni yazı
            </Button>
          }
        >
          Henüz yazı yok. İlk yazınızı “Yeni yazı” ile başlatın.
        </EmptyState>
      )}
      {rows && rows.length > 0 && shown.length === 0 && (
        <EmptyState icon={query || category ? Search : FileText}>
          {query || category ? 'Aramanıza uyan yazı yok.' : tab === 'drafts' ? 'Taslak yok.' : tab === 'planned' ? 'Planlanmış yazı yok.' : 'Yayında yazı yok.'}
        </EmptyState>
      )}
      {shown.length > 0 && (
        <ul className="post-rows">
          {shown.map((r) => (
            <li key={r.key}>
              <div className={`post-row post-row-v2${r.coverPath ? '' : ' no-cover'}`}>
                <PostThumb row={r} url={covers.get(r.key)} />
                <a className="post-row-main" href={`#/yazi/${r.key}`}>
                  <span className="post-row-title">{r.title}</span>
                  <span className="post-row-meta">
                    <span className={`badge ${r.status === 'taslak' ? '' : r.status === 'planlandı' ? 'badge-planned' : 'badge-live'}`}>
                      {r.scheduledAt ? `${STATUS_LABEL[r.status]} · ${formatSchedule(r.scheduledAt)}` : STATUS_LABEL[r.status]}
                    </span>
                    <span className="tone-chip tone-lavanta">{label(r.category)}</span>
                    <span className="post-langs" title={r.titleEn.trim() ? 'Türkçe ve İngilizce' : 'Yalnızca Türkçe'}>
                      TR{r.titleEn.trim() ? ' · EN' : ''}
                    </span>
                  </span>
                  <span className="post-row-facts">
                    {r.publishedAt ? (
                      <span>
                        <Icon as={CalendarCheck} size={14} />
                        Yayınlanma tarihi: {new Date(`${r.publishedAt.slice(0, 10)}T12:00:00Z`).toLocaleDateString('tr-TR')}
                      </span>
                    ) : (
                      r.updatedAt && (
                        <span>
                          <Icon as={PencilLine} size={14} />
                          Son düzenleme: {new Date(r.updatedAt).toLocaleDateString('tr-TR')}
                        </span>
                      )
                    )}
                    {r.minutes != null && (
                      <span>
                        <Icon as={Clock3} size={14} />
                        {r.minutes} dk okuma
                      </span>
                    )}
                    {r.live && reads && (
                      <span>
                        <Icon as={Eye} size={14} />
                        {(reads.get(r.key) ?? 0).toLocaleString('tr-TR')} okunma
                      </span>
                    )}
                  </span>
                </a>
                <PostActions row={r} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
