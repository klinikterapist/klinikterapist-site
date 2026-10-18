/** Home: four cards - last published post, drafts, this month, and what is missing. */
import { useEffect, useMemo, useState } from 'react';
import { ApiFailure, type DraftSummary } from '../api/types';
import { dashboard } from '../lib/dashboard';
import { loadSiteState, type SiteState } from '../lib/posts-repo';
import { usePanel } from './context';
import { useDeploy } from './DeployStatus';
import { Banner, Button, Spinner } from './kit';

const SITE_LABEL = { ok: 'Sitede yayında', updating: 'Site güncelleniyor…', failed: 'Yayın başarısız oldu' } as const;

export function Home() {
  const { api } = usePanel();
  const { phase } = useDeploy();
  const [data, setData] = useState<{ site: SiteState; drafts: DraftSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    Promise.all([loadSiteState(api), api.listDrafts()])
      .then(([site, { drafts }]) => alive && setData({ site, drafts }))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Özet yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const d = useMemo(() => (data ? dashboard(data.site.posts, data.drafts, new Date()) : null), [data]);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR');

  return (
    <section aria-labelledby="home-title">
      <div className="screen-head">
        <h2 id="home-title">Ana sayfa</h2>
      </div>
      {error && (
        <Banner tone="error" action={<Button onClick={() => setAttempt(attempt + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!d && !error && <Spinner label="Özet yükleniyor…" />}
      {d && (
        <div className="home-grid">
          <article className="home-card" aria-labelledby="hc-last">
            <h3 id="hc-last">Son yayınlanan</h3>
            {d.lastLive ? (
              <>
                <a className="home-card-title" href={`#/yazi/${d.lastLive.key}`}>
                  {d.lastLive.tr.fm.title}
                </a>
                <p className="home-card-meta">{fmt(d.lastLive.tr.fm.publishedAt)}</p>
                <p className={`home-site home-site-${phase}`}>{SITE_LABEL[phase]}</p>
              </>
            ) : (
              <p className="empty">Henüz yayınlanmış yazı yok.</p>
            )}
          </article>
          <article className="home-card" aria-labelledby="hc-drafts">
            <div className="home-card-head">
              <h3 id="hc-drafts">Taslaklar</h3>
              <a href="#/yazilar/taslaklar">Tümü</a>
            </div>
            {d.recentDrafts.length === 0 ? (
              <p className="empty">Taslak yok.</p>
            ) : (
              <ul className="home-list">
                {d.recentDrafts.map((x) => (
                  <li key={x.key}>
                    <a href={`#/yazi/${x.key}`}>{x.title.tr.trim() || x.title.en.trim() || 'Başlıksız taslak'}</a>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="home-card" aria-labelledby="hc-month">
            <h3 id="hc-month">Bu ay</h3>
            <p className="home-big">{d.publishedThisMonth} yazı yayınlandı</p>
          </article>
          <article className="home-card" aria-labelledby="hc-missing">
            <h3 id="hc-missing">Eksikler</h3>
            {d.incomplete.length === 0 ? (
              <p className="empty">Eksik yok.</p>
            ) : (
              <ul className="home-list">
                {d.incomplete.map((x) => (
                  <li key={x.key}>
                    <a href={`#/yazi/${x.key}`}>
                      “{x.title}” {x.missing === 'en' ? 'İngilizcesi' : 'Türkçesi'} yok
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
