/**
 * Home (owner's design 2026-10-21, SITE-GUNCELLEMESI.md): a greeting with today's date and a one-line
 * summary, four tiles (today's sessions, waiting requests, active clients, this month's posts), then two
 * columns: the workspace (last published post, drafts, planned, what is missing) and "Bugün" (today's
 * sessions by time and the oldest waiting requests). The site statistics follow, full width.
 * The appointment data loads on its own: if it fails, the rest of the screen still works.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiFailure, type BookingRequest, type Client, type DraftSummary } from '../api/types';
import { dashboard, greeting, istanbulHour, todayAgenda, waitingRequests } from '../lib/dashboard';
import { formatSchedule } from '../lib/draft';
import { formatDay } from '../../lib/booking-form';
import { cachedDrafts, ensureTriggersOnce, loadDrafts, loadSiteState, type SiteState } from '../lib/posts-repo';
import { usePanel } from './context';
import { useDeploy } from './DeployStatus';
import { CalendarCheck, CheckCircle2, ChevronRight, FileText, Icon, Inbox, UserRound, type LucideIcon } from './icons';
import { Banner, Button, EmptyState, Spinner } from './kit';
import { StatsPanel } from './home/StatsPanel';
import { SESSION_KIND_LABEL, labelOf } from './appointments/AppointmentCalendar';

const NO_POSTS: SiteState['posts'] = [];

const SITE_LABEL = { ok: 'Sitede yayında', updating: 'Site güncelleniyor…', failed: 'Yayın başarısız oldu' } as const;

type Appointments = { clients: Client[]; requests: BookingRequest[] };

function Tile({ href, icon, label, value, note, tone }: { href: string; icon: LucideIcon; label: string; value: ReactNode; note: string; tone?: 'warn' }) {
  return (
    <a className={`home-tile${tone ? ` home-tile-${tone}` : ''}`} href={href}>
      <span className="home-tile-icon" aria-hidden="true">
        <Icon as={icon} size={18} />
      </span>
      <span className="home-tile-label">{label}</span>
      <span className="home-tile-value">{value}</span>
      <span className="home-tile-note">{note}</span>
    </a>
  );
}

/** "Bugün 2 seans var, 1 talep yanıt bekliyor." */
function summaryLine(sessions: number, waiting: number): string {
  const s = sessions ? `Bugün ${sessions} seans var` : 'Bugün seans yok';
  const w = waiting ? `${waiting} talep yanıt bekliyor` : 'yanıt bekleyen talep yok';
  return `${s}, ${w}.`;
}

export function Home() {
  const { api } = usePanel();
  const { phase } = useDeploy();
  const [data, setData] = useState<{ site: SiteState; drafts: DraftSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [appts, setAppts] = useState<Appointments | null>(null);
  const [apptsError, setApptsError] = useState(false);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let alive = true;
    setError(null);
    const draftsBefore = cachedDrafts(api);
    Promise.all([loadSiteState(api, { onCached: (site) => draftsBefore && alive && setData({ site, drafts: draftsBefore }) }), loadDrafts(api)])
      .then(([site, drafts]) => {
        if (alive) setData({ site, drafts });
        if (drafts.some((x) => x.scheduledAt)) ensureTriggersOnce(api);
      })
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Özet yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  useEffect(() => {
    let alive = true;
    setApptsError(false);
    Promise.all([api.clientsList(), api.requestsList()])
      .then(([c, r]) => alive && setAppts({ clients: c.clients, requests: r.requests }))
      .catch(() => alive && setApptsError(true));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const d = useMemo(() => (data ? dashboard(data.site.posts, data.drafts, now) : null), [data, now]);
  const agenda = useMemo(() => (appts ? todayAgenda(appts.clients, now) : []), [appts, now]);
  const waiting = useMemo(() => (appts ? waitingRequests(appts.requests, now) : { pending: [], late: 0 }), [appts, now]);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR');
  const today = new Date(now.getTime() + 3 * 3600e3).toISOString().slice(0, 10);
  const dash = '–';

  return (
    <section className="home" aria-labelledby="home-title">
      <header className="home-hero">
        <h2 id="home-title" className="home-eyebrow">
          Ana sayfa
        </h2>
        <p className="home-greet">{greeting(istanbulHour(now))}</p>
        <p className="home-summary">
          <span>{formatDay(today, 'tr')}</span>
          {appts && <span> · {summaryLine(agenda.length, waiting.pending.length)}</span>}
        </p>
      </header>

      {error && (
        <Banner tone="error" action={<Button onClick={() => setAttempt(attempt + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}

      <nav className="home-tiles" aria-label="Özet">
        <Tile href="#/seans-takip" icon={CalendarCheck} label="Bugünkü seanslar" value={appts ? agenda.length : dash} note="Seans takibe git" />
        <Tile
          href="#/randevular"
          icon={Inbox}
          label="Bekleyen talepler"
          value={appts ? waiting.pending.length : dash}
          note={waiting.late ? `${waiting.late} talep 20 saati geçti` : 'Randevu taleplerine git'}
          tone={waiting.late ? 'warn' : undefined}
        />
        <Tile href="#/seans-takip" icon={UserRound} label="Aktif danışanlar" value={appts ? appts.clients.length : dash} note="Seans takipteki danışanlar" />
        <Tile href="#/yazilar" icon={FileText} label="Bu ay" value={d ? d.publishedThisMonth : dash} note="yayınlanan yazı" />
      </nav>

      {d && d.scheduleErrors.length > 0 && (
        <Banner tone="warning">
          {d.scheduleErrors.map((x) => (
            <p key={x.key}>
              <a href={`#/yazi/${x.key}`}>{x.title.tr.trim() || x.title.en.trim() || 'Başlıksız taslak'}</a>: planlanan yayın yapılamadı, tekrar denenecek. {x.scheduleError}
            </p>
          ))}
        </Banner>
      )}

      <div className="home-layout">
        <aside className="home-aside" aria-labelledby="agenda-title">
          <article className="agenda">
            <div className="agenda-head">
              <h3 id="agenda-title">Bugün</h3>
              <a href="#/seans-takip">Takvimi aç</a>
            </div>
            {apptsError ? (
              <p className="k-hint">Randevu bilgileri şu an alınamadı.</p>
            ) : !appts ? (
              <Spinner label="Randevular yükleniyor…" />
            ) : agenda.length === 0 ? (
              <EmptyState icon={CalendarCheck}>Bugün seans yok.</EmptyState>
            ) : (
              <ol className="agenda-list">
                {agenda.map((x) => (
                  <li key={`${x.clientId}-${x.time}`} className={`agenda-item agenda-${x.status}`}>
                    <span className="agenda-time">{x.time.replace(':', '.')}</span>
                    <a className="agenda-what" href={`#/seans-takip/${x.clientId}`}>
                      <b>{x.number}</b>
                      <span>
                        {x.kind === 'weekly' ? labelOf({ kind: 'session', type: x.type }) : SESSION_KIND_LABEL[x.kind]}
                        {x.status === 'attended' ? ' · geldi' : x.status === 'noshow' ? ' · gelmedi' : ''}
                      </span>
                    </a>
                    <Icon as={ChevronRight} size={16} />
                  </li>
                ))}
              </ol>
            )}

            {appts && waiting.pending.length > 0 && (
              <>
                <div className="agenda-head agenda-sub">
                  <h4>Yanıt bekleyen talepler</h4>
                  <a href="#/randevular">Taleplere git</a>
                </div>
                <ul className="agenda-requests">
                  {waiting.pending.slice(0, 3).map((r) => (
                    <li key={r.id}>
                      <i className={`agenda-dot agenda-dot-${r.kind}`} aria-hidden="true" />
                      <span>
                        <b>{r.kind === 'intro' ? 'Ön görüşme' : 'Seans talebi'}</b>
                        <span className="home-card-meta">
                          {formatDay(r.day, 'tr')} · {r.time.replace(':', '.')}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>
        </aside>

        <div className="home-main">
          {!d && !error && <Spinner label="Özet yükleniyor…" />}
          {d && <h3 className="home-section-title">Çalışma alanı</h3>}
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
                  <EmptyState icon={Inbox}>Henüz yayınlanmış yazı yok.</EmptyState>
                )}
              </article>
              <article className="home-card" aria-labelledby="hc-drafts">
                <div className="home-card-head">
                  <h3 id="hc-drafts">Taslaklar</h3>
                  <a href="#/yazilar/taslaklar">Tümü</a>
                </div>
                {d.recentDrafts.length === 0 ? (
                  <EmptyState icon={FileText}>Taslak yok.</EmptyState>
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
              {d.scheduled.length > 0 && (
                <article className="home-card" aria-labelledby="hc-planned">
                  <div className="home-card-head">
                    <h3 id="hc-planned">Planlanan</h3>
                    <a href="#/yazilar/planlanan">Tümü</a>
                  </div>
                  <ul className="home-list">
                    {d.scheduled.slice(0, 5).map((x) => (
                      <li key={x.key}>
                        <a href={`#/yazi/${x.key}`}>{x.title.tr.trim() || x.title.en.trim() || 'Başlıksız taslak'}</a>
                        <span className="home-card-meta"> · {formatSchedule(x.scheduledAt!)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )}
              <article className="home-card" aria-labelledby="hc-missing">
                <h3 id="hc-missing">Eksikler</h3>
                {d.incomplete.length === 0 ? (
                  <EmptyState icon={CheckCircle2}>Eksik yok.</EmptyState>
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
        </div>
      </div>

      {/* Statistics load at the same time as the posts; post titles fill in when they arrive. */}
      <StatsPanel posts={data?.site.posts ?? NO_POSTS} />
    </section>
  );
}
