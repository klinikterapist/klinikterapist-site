/**
 * Ana sayfa statistics (Panel v3 Plan C, Task C7): the period switch, four stat cards with the change
 * against the previous period, the daily chart, top posts and pages, where visitors came from, their
 * devices and languages, and link clicks. Counts come from the site's anonymous counter.
 */
import { useEffect, useMemo, useState } from 'react';
import { ApiFailure } from '../../api/types';
import type { StatsSummary } from '../../../lib/stats-wire';
import { aggregate, change, rangeFor, type Period } from '../../lib/stats';
import type { LivePost } from '../../lib/publish';
import { usePanel } from '../context';
import { Banner, Button, Spinner } from '../kit';
import { BarList, LineChart, ShareBar, Sparkline } from './StatsCharts';

const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7 gün' },
  { value: 30, label: '30 gün' },
  { value: 90, label: '90 gün' },
  { value: 'all', label: 'Tümü' },
];

const fmt = (n: number) => n.toLocaleString('tr-TR');
const longDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const c = change(cur, prev);
  if (c === null) return <span className="delta delta-none">önceki dönem verisi yok</span>;
  const dir = c > 0 ? 'up' : c < 0 ? 'down' : 'flat';
  return (
    <span className={`delta delta-${dir}`}>
      <span aria-hidden="true">{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'}</span> %{Math.abs(c)}
      <span className="k-visually-hidden">{dir === 'up' ? ' artış' : dir === 'down' ? ' azalış' : ' değişim yok'}</span>
      <span className="delta-hint"> önceki döneme göre</span>
    </span>
  );
}

export function StatsPanel({ posts }: { posts: LivePost[] }) {
  const { api } = usePanel();
  const [period, setPeriod] = useState<Period>(30);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => rangeFor(period, now, since), [period, now, since]);

  useEffect(() => {
    let alive = true;
    setError(null);
    api
      .statsSummary({ from: range.prevFrom, to: range.to })
      .then((s) => {
        if (!alive) return;
        setSummary(s);
        if (s.since !== since) setSince(s.since);
      })
      .catch((e) => alive && setError(e instanceof ApiFailure && e.code !== 'internal' && e.code !== 'bad_request' ? e.message : 'İstatistikler şu an alınamadı.'));
    return () => {
      alive = false;
    };
    // `since` only widens "Tümü"; refetching on it once is intended.
  }, [api, range.prevFrom, range.to, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => (summary ? aggregate(summary, range, posts) : null), [summary, range, posts]);
  const empty = stats && stats.totals.views === 0 && stats.totals.reads === 0;
  const rate = (reads: number, views: number) => (views ? Math.min(100, Math.round((reads / views) * 100)) : null);
  const readRate = stats ? rate(stats.totals.reads, stats.totals.postViews) : null;
  const prevRate = stats ? rate(stats.totals.prevReads, stats.totals.prevPostViews) : null;

  return (
    <section className="stats" aria-labelledby="stats-title">
      <div className="stats-head">
        <div>
          <h3 id="stats-title">Site istatistikleri</h3>
          <p className="stats-sub">
            {longDay(range.from)} – {longDay(range.to)} · çerezsiz, anonim sayım
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Dönem">
          {PERIODS.map((p) => (
            <button key={p.label} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Banner tone="warning" action={<Button onClick={() => setAttempt(attempt + 1)}>Tekrar dene</Button>}>
          {error} Yayın ve taslak bilgileri aşağıda.
        </Banner>
      )}
      {!stats && !error && <Spinner label="İstatistikler yükleniyor…" />}

      {stats && empty && (
        <div className="stats-empty">
          <b>{since ? `İstatistikler ${longDay(since)} itibarıyla toplanıyor.` : 'İstatistikler henüz toplanmıyor.'}</b>
          <p>Ziyaretçiler siteye geldikçe sayılar burada görünür. Çerez kullanılmaz; kimin geldiği değil, kaç kez gelindiği sayılır.</p>
        </div>
      )}

      {stats && !empty && (
        <>
          <div className="stat-cards">
            <article className="stat-card">
              <h4>Görüntüleme</h4>
              <p className="stat-big">{fmt(stats.totals.views)}</p>
              <Delta cur={stats.totals.views} prev={stats.totals.prevViews} />
              <Sparkline values={stats.daily.map((d) => d.views)} label="Günlük görüntüleme eğilimi" />
            </article>
            <article className="stat-card">
              <h4>Okuma</h4>
              <p className="stat-big">{fmt(stats.totals.reads)}</p>
              <Delta cur={stats.totals.reads} prev={stats.totals.prevReads} />
              <Sparkline values={stats.daily.map((d) => d.reads)} label="Günlük okuma eğilimi" />
            </article>
            <article className="stat-card">
              <h4>Okuma oranı</h4>
              <p className="stat-big">{readRate === null ? '–' : `%${readRate}`}</p>
              {readRate !== null && prevRate !== null ? (
                <span className={`delta delta-${readRate > prevRate ? 'up' : readRate < prevRate ? 'down' : 'flat'}`}>
                  {readRate === prevRate ? 'değişmedi' : `${readRate > prevRate ? '+' : '−'}${Math.abs(readRate - prevRate)} puan`}
                  <span className="delta-hint"> önceki döneme göre</span>
                </span>
              ) : (
                <span className="delta delta-none">yazıyı sonuna kadar okuyanlar</span>
              )}
              <p className="stat-note">Yazı sayfasını açanların ne kadarı sonuna kadar okudu</p>
            </article>
            <article className="stat-card stat-card-accent">
              <h4>Randevu tıklaması</h4>
              <p className="stat-big">{fmt(stats.totals.clicks)}</p>
              <Delta cur={stats.totals.clicks} prev={stats.totals.prevClicks} />
              <p className="stat-note">“Randevu Al” düğmelerine basılma sayısı</p>
            </article>
          </div>

          <article className="stats-card">
            <div className="stats-card-head">
              <h4>Günlük ziyaret</h4>
              <span className="chart-keys">
                <span>
                  <i className="key key-views" /> Görüntüleme
                </span>
                <span>
                  <i className="key key-reads" /> Okuma
                </span>
              </span>
            </div>
            <LineChart data={stats.daily} />
          </article>

          <div className="stats-grid">
            <article className="stats-card">
              <h4>En çok okunan yazılar</h4>
              <BarList
                unit="okuma"
                empty="Bu dönemde okunan yazı yok."
                rows={stats.topPosts.map((p) => ({
                  label: p.title,
                  value: p.reads,
                  href: `#/yazi/${p.key}`,
                  note: `${fmt(p.views)} görüntüleme${p.readRate === null ? '' : ` · %${p.readRate} okuma oranı`}`,
                }))}
              />
            </article>
            <article className="stats-card">
              <h4>En çok ziyaret edilen sayfalar</h4>
              <BarList unit="görüntüleme" empty="Bu dönemde ziyaret yok." rows={stats.topPages.map((p) => ({ label: p.label, value: p.views, note: p.path }))} />
            </article>
            <article className="stats-card">
              <h4>Nereden geldiler?</h4>
              <BarList unit="ziyaret" empty="Kaynak bilgisi yok." rows={stats.referrers.slice(0, 6).map((r) => ({ label: r.label, value: r.views }))} />
            </article>
            <article className="stats-card">
              <h4>Cihaz ve dil</h4>
              <p className="share-title">Cihaz</p>
              <ShareBar parts={stats.devices.map((d) => ({ label: d.label, value: d.views }))} empty="Cihaz bilgisi yok." />
              <p className="share-title">Dil</p>
              <ShareBar parts={stats.langs.map((d) => ({ label: d.label, value: d.views }))} empty="Dil bilgisi yok." />
            </article>
            <article className="stats-card stats-card-wide">
              <h4>Bağlantı tıklamaları</h4>
              <BarList unit="tıklama" empty="Bu dönemde bağlantı tıklaması yok." rows={stats.clicks.map((c) => ({ label: c.label, value: c.count }))} />
            </article>
          </div>
        </>
      )}
    </section>
  );
}
