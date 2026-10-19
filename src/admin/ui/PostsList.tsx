/** Posts: live, draft and planned, with search, category filter and status. */
import { useEffect, useMemo, useState } from 'react';
import { ApiFailure, type DraftSummary } from '../api/types';
import type { Category } from '../../lib/schemas';
import { startNewPost } from '../lib/new-post';
import { STATUS_LABEL, cachedDrafts, loadDrafts, loadSiteState, mergeList, type PostRow, type SiteState } from '../lib/posts-repo';
import { formatSchedule } from '../lib/draft';
import { go, usePanel, type PostsTab } from './context';
import { FileText, Search } from './icons';
import { Banner, Button, EmptyState, Field, Select, Spinner } from './kit';


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
        <h2 id="posts-title">Yazılar</h2>
        <Button variant="primary" onClick={create}>
          Yeni yazı
        </Button>
      </div>
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
              <a className="post-row" href={`#/yazi/${r.key}`}>
                <span className="post-row-title">{r.title}</span>
                <span className="post-row-meta">
                  <span className={`badge ${r.status === 'taslak' ? '' : r.status === 'planlandı' ? 'badge-planned' : 'badge-live'}`}>
                    {r.scheduledAt ? `${STATUS_LABEL[r.status]} · ${formatSchedule(r.scheduledAt)}` : STATUS_LABEL[r.status]}
                  </span>
                  <span>{label(r.category)}</span>
                  {r.updatedAt && <span>{new Date(r.updatedAt).toLocaleDateString('tr-TR')}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
