/** Posts: live, draft and planned, with search, category filter and status. */
import { useEffect, useMemo, useState } from 'react';
import { ApiFailure, type DraftSummary } from '../api/types';
import type { Category } from '../../lib/schemas';
import { startNewPost } from '../lib/new-post';
import { STATUS_LABEL, cachedDrafts, loadDrafts, loadSiteState, mergeList, type PostRow, type SiteState } from '../lib/posts-repo';
import { formatSchedule } from '../lib/draft';
import { go, usePanel, type PostsTab } from './context';
import { CalendarClock, ChevronRight, FileText, Icon, PencilLine, Search, Sparkles, type LucideIcon } from './icons';
import type { Tone } from './Shell';
import { Banner, Button, EmptyState, Field, Select, Spinner } from './kit';


/** How each status looks in the list: a tone and an icon beside the title. */
const STATUS_LOOK: Record<PostRow['status'], { tone: Tone; icon: LucideIcon }> = {
  yayında: { tone: 'adacayi', icon: Sparkles },
  'yayında-değişiklik-var': { tone: 'kiremit', icon: PencilLine },
  taslak: { tone: 'gunes', icon: FileText },
  planlandı: { tone: 'lavanta', icon: CalendarClock },
};

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
          Yeni yazı
        </Button>
      </div>
      {rows && rows.length > 0 && <PostsOverview rows={rows} label={label} counts={counts} />}
      <nav className="tabs" aria-label="Yazı grupları">
        <a className={`tab ${tab === 'live' ? 'is-active' : ''}`} href="#/yazilar" aria-current={tab === 'live' ? 'page' : undefined}>
          {`Yayında ${counts.live}`}
        </a>
        <a className={`tab ${tab === 'drafts' ? 'is-active' : ''}`} href="#/yazilar/taslaklar" aria-current={tab === 'drafts' ? 'page' : undefined}>
          {`Taslaklar ${counts.drafts}`}
        </a>
        <a className={`tab ${tab === 'planned' ? 'is-active' : ''}`} href="#/yazilar/planlanan" aria-current={tab === 'planned' ? 'page' : undefined}>
          {`Planlanan ${counts.planned}`}
        </a>
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
              <a className="post-row post-row-v2" href={`#/yazi/${r.key}`}>
                <span className={`tone-tile tone-tile-lg tone-${STATUS_LOOK[r.status].tone}`} aria-hidden="true">
                  <Icon as={STATUS_LOOK[r.status].icon} size={20} />
                </span>
                <span className="post-row-main">
                  <span className="post-row-title">{r.title}</span>
                  <span className="post-row-meta">
                    <span className={`badge ${r.status === 'taslak' ? '' : r.status === 'planlandı' ? 'badge-planned' : 'badge-live'}`}>
                      {r.scheduledAt ? `${STATUS_LABEL[r.status]} · ${formatSchedule(r.scheduledAt)}` : STATUS_LABEL[r.status]}
                    </span>
                    <span className="tone-chip tone-lavanta">{label(r.category)}</span>
                    <span className="post-langs" title={r.titleEn.trim() ? 'Türkçe ve İngilizce' : 'Yalnızca Türkçe'}>
                      TR{r.titleEn.trim() ? ' · EN' : ''}
                    </span>
                    {r.updatedAt && <span>{new Date(r.updatedAt).toLocaleDateString('tr-TR')}</span>}
                  </span>
                </span>
                <Icon as={ChevronRight} size={18} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
