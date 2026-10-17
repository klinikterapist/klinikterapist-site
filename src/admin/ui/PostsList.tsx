/** Posts: live and draft, with search, category filter and status. */
import { useEffect, useMemo, useState } from 'react';
import { ApiFailure } from '../api/types';
import type { Category } from '../../lib/schemas';
import { startNewPost } from '../lib/new-post';
import { STATUS_LABEL, loadSiteState, mergeList, type PostRow } from '../lib/posts-repo';
import { go, usePanel } from './context';
import { Banner, Button, Field, Select, Spinner } from './kit';

const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/i̇/g, 'i');

export function PostsList() {
  const { api } = usePanel();
  const [rows, setRows] = useState<PostRow[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    Promise.all([loadSiteState(api), api.listDrafts()])
      .then(([site, { drafts }]) => {
        if (!alive) return;
        setCategories(site.categories.list);
        setRows(mergeList(site.posts, drafts));
      })
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Yazılar yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    return (rows ?? []).filter((r) => (!category || r.category === category) && (!q || fold(`${r.title} ${r.titleEn}`).includes(q)));
  }, [rows, query, category]);

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
      <div className="filters">
        <Field label="Ara" value={query} onChange={setQuery} placeholder="Başlıkta ara (Türkçe ya da İngilizce)" />
        <Select
          label="Kategori"
          value={category}
          options={[{ value: '', label: 'Tüm kategoriler' }, ...categories.map((c) => ({ value: c.id, label: c.label.tr }))]}
          onChange={setCategory}
        />
      </div>
      {error && (
        <Banner tone="error" action={<Button onClick={() => setAttempt(attempt + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!rows && !error && <Spinner label="Yazılar yükleniyor…" />}
      {rows && rows.length === 0 && <p className="empty">Henüz yazı yok. İlk yazınızı “Yeni yazı” ile başlatın.</p>}
      {rows && rows.length > 0 && shown.length === 0 && <p className="empty">Aramanıza uyan yazı yok.</p>}
      {shown.length > 0 && (
        <ul className="post-rows">
          {shown.map((r) => (
            <li key={r.key}>
              <a className="post-row" href={`#/yazi/${r.key}`}>
                <span className="post-row-title">{r.title}</span>
                <span className="post-row-meta">
                  <span className={`badge ${r.status === 'taslak' ? '' : 'badge-live'}`}>{STATUS_LABEL[r.status]}</span>
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
