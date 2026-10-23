/**
 * Ayarlar › Randevu Ayarları (owner's requests 2026-10-23): everything about appointments in one place,
 * written to booking.json, laid out as a short summary and four tabs, each with its own Kaydet that
 * saves only that part (the other tabs' unsaved changes stay on the screen; a dot on a tab marks them).
 * - Görüşme Türleri: a card per session type, on or off together with its intro-call choice (the two are
 *   one setting); supervision has no intro call. A closed type shows on the forms as "Kontenjan Doldu",
 *   "Şu an uygun değil" or not at all, as chosen on its card; types with places say "Kontenjanlı".
 * - Çalışma Saatleri: the weekly start times of sessions and of intro calls, a day per row; a day's times
 *   can be copied to the other weekdays.
 * - Kurallar: notice before booking, how far ahead, the rest between appointments.
 * - Kapalı Günler: public holidays and leave, and "Takvim kapatma" for a day or hours at once, without
 *   publishing.
 * Saved like the other settings: the site is published again, and the request forms follow within about
 * ten minutes (the backend reads booking.json from the repository). Opening or closing booking itself
 * stays in Önemli Ayarlar.
 */
import { useState, type ReactNode } from 'react';
import { INTRO_FOR, SESSION_TYPES, closedAs, typeOn, type Availability, type BookingConfig, type ClosedAs, type ClosedDay } from '../../../../lib/booking-form';
import { parseBooking } from '../../../../lib/schemas';
import { CalendarClock, CalendarX, Icon, ListChecks, Tags, type LucideIcon } from '../../icons';
import { Banner, Button, Field, Spinner, Toggle } from '../../kit';
import { ListEditor } from '../fields';
import { SiteIcon } from '../rows';
import { SETTINGS_SCREENS } from '../screens';
import { useSettingsFile, type SettingsFile } from '../useSettingsFile';
import { CloseHoursDialog } from '../../appointments/CloseHoursDialog';

type Tab = 'types' | 'hours' | 'rules' | 'closed';
type Kind = 'session' | 'intro';

/** Each tab, what its Kaydet writes (booking.json paths) and how the button reads. */
const TABS: { id: Tab; label: string; icon: LucideIcon; paths: string[]; save: string }[] = [
  { id: 'types', label: 'Görüşme Türleri', icon: Tags, paths: ['types', 'closedAs'], save: 'Görüşme türlerini kaydet' },
  { id: 'hours', label: 'Çalışma Saatleri', icon: CalendarClock, paths: ['session.weekdays', 'intro.weekdays'], save: 'Çalışma saatlerini kaydet' },
  {
    id: 'rules',
    label: 'Kurallar',
    icon: ListChecks,
    paths: ['session.minNoticeHours', 'session.weeksAhead', 'intro.minNoticeHours', 'intro.weeksAhead', 'restMinutes'],
    save: 'Kuralları kaydet',
  },
  { id: 'closed', label: 'Kapalı Günler', icon: CalendarX, paths: ['closed'], save: 'Kapalı günleri kaydet' },
];

/** The look of each session type's card. */
const TYPE_LOOK: Record<string, { icon: string; tone: string }> = {
  individual: { icon: 'user', tone: 'lavanta' },
  couple: { icon: 'heart', tone: 'kiremit' },
  accessible: { icon: 'leaf', tone: 'adacayi' },
  group: { icon: 'users', tone: 'deniz' },
  face: { icon: 'home', tone: 'gunes' },
  supervision: { icon: 'grad', tone: 'lacivert' },
};

/** How a closed type can show on the forms. */
const CLOSED_CHOICES: { value: ClosedAs; label: string }[] = [
  { value: 'full', label: 'Kontenjan Doldu' },
  { value: 'off', label: 'Şu an uygun değil' },
  { value: 'hidden', label: 'Gösterme' },
];

/** Monday first, as the owner's week runs. */
const DAYS: { key: keyof Availability['weekdays']; name: string }[] = [
  { key: '1', name: 'Pazartesi' },
  { key: '2', name: 'Salı' },
  { key: '3', name: 'Çarşamba' },
  { key: '4', name: 'Perşembe' },
  { key: '5', name: 'Cuma' },
  { key: '6', name: 'Cumartesi' },
  { key: '0', name: 'Pazar' },
];
const WEEKDAYS = ['1', '2', '3', '4', '5'] as const;
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const dotted = (day: string) => day.split('-').reverse().join('.');
const short = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const countTimes = (w: Availability['weekdays']) => Object.values(w).reduce((n, t) => n + (t?.length ?? 0), 0);

/** One kind's weekly start times: a row per day, each time a chip with ×, a time field to add one. */
function WeekTimes({ value, onChange, label }: { value: Availability['weekdays']; onChange: (v: Availability['weekdays']) => void; label: string }) {
  const [adding, setAdding] = useState<Record<string, string>>({});
  const setDay = (key: string, times: string[], base = value) => {
    const next = { ...base };
    if (times.length) next[key as keyof typeof next] = [...new Set(times)].sort();
    else delete next[key as keyof typeof next];
    return next;
  };
  return (
    <div className="week-times" aria-label={label}>
      {DAYS.map((d) => {
        const times = value[d.key] ?? [];
        const draft = adding[d.key] ?? '';
        const weekday = (WEEKDAYS as readonly string[]).includes(d.key);
        return (
          <div key={d.key} className={`wt-row${times.length ? '' : ' is-off'}`}>
            <span className="wt-day">
              {d.name}
              <small>{times.length ? `${times.length} saat` : 'Kapalı'}</small>
            </span>
            <ul className="wt-chips">
              {times.map((t) => (
                <li key={t}>
                  <span>{t.replace(':', '.')}</span>
                  <button
                    type="button"
                    aria-label={`${d.name} ${t} saatini kaldır`}
                    onClick={() =>
                      onChange(
                        setDay(
                          d.key,
                          times.filter((x) => x !== t),
                        ),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <span className="wt-add">
              <input className="k-input" type="time" aria-label={`${d.name} için saat`} value={draft} onChange={(e) => setAdding({ ...adding, [d.key]: e.target.value })} />
              <Button
                disabled={!TIME_RE.test(draft)}
                onClick={() => {
                  onChange(setDay(d.key, [...times, draft]));
                  setAdding({ ...adding, [d.key]: '' });
                }}
              >
                Ekle
              </Button>
              {weekday && times.length > 0 && (
                <Button
                  variant="ghost"
                  title="Bu günün saatlerini diğer hafta içi günlerine de uygula"
                  onClick={() => onChange(WEEKDAYS.reduce((acc, k) => (k === d.key ? acc : setDay(k, times, acc)), value))}
                >
                  Hafta içine uygula
                </Button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A rule as a small card: the number, its unit and what it means. */
function RuleCard({ label, unit, hint, value, onChange, error }: { label: string; unit: string; hint: string; value: number; onChange: (n: number) => void; error?: string }) {
  return (
    <div className="rule-card">
      <span className="rule-label">{label}</span>
      <span className="rule-value">
        <input
          className="k-input"
          type="number"
          min={0}
          aria-label={`${label} (${unit})`}
          value={String(value)}
          onChange={(e) => onChange(Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : value)}
        />
        <span>{unit}</span>
      </span>
      <span className="k-hint">{hint}</span>
      {error && <span className="k-error">{error}</span>}
    </div>
  );
}

/** A tab's panel: its title and what it is for, the content, and its own Kaydet at the foot. */
function Part({ tab, hint, file, extra, children }: { tab: (typeof TABS)[number]; hint: ReactNode; file: SettingsFile<BookingConfig>; extra?: ReactNode; children: ReactNode }) {
  const dirty = file.partDirty(tab.paths);
  return (
    <form
      className="bs-panel"
      role="tabpanel"
      aria-labelledby={`bs-tab-${tab.id}`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        file.savePart(tab.id, tab.paths);
      }}
    >
      <header className="bs-head">
        <div>
          <h3>{tab.label}</h3>
          <p className="k-hint">{hint}</p>
        </div>
        {extra}
      </header>
      {children}
      <footer className="bs-foot">
        {file.message && file.messageFor === tab.id && <Banner tone={file.message.tone}>{file.message.text}</Banner>}
        <span className="k-hint">{dirty ? 'Bu bölümde kaydedilmemiş değişiklikler var.' : 'Bu bölümdeki her şey kayıtlı.'}</span>
        <Button type="submit" variant="primary" busy={file.saving && file.messageFor === tab.id} disabled={!dirty || file.saving}>
          {tab.save}
        </Button>
      </footer>
    </form>
  );
}

export function RandevuScreen() {
  const meta = SETTINGS_SCREENS.find((s) => s.id === 'randevu')!;
  const file = useSettingsFile<BookingConfig>('src/data/booking.json', parseBooking, 'Randevu Ayarları');
  const [tab, setTab] = useState<Tab>('types');
  const [kind, setKind] = useState<Kind>('session');
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const b = file.value;
  const set = (patch: Partial<BookingConfig>) => file.setValue((x) => ({ ...x, ...patch }));
  const setKindOf = (k: Kind, patch: Partial<Availability>) => b && set({ [k]: { ...b[k], ...patch } });
  const upcoming = b ? b.closed.filter((c) => c.date >= today()).sort((x, y) => x.date.localeCompare(y.date)) : [];
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <section className="settings booking-settings" aria-labelledby="settings-screen-title">
      <div className="screen-head">
        <h2 id="settings-screen-title">
          <Icon as={meta.icon} size={22} />
          {meta.label}
        </h2>
      </div>
      <p className="settings-intro">
        {meta.intro} Randevu alımını tamamen açıp kapatmak <a href="#/ayarlar/onemli">Önemli Ayarlar</a> ekranındadır.
      </p>
      {file.loadError && (
        <Banner tone="error" action={<Button onClick={file.retry}>Tekrar dene</Button>}>
          {file.loadError}
        </Banner>
      )}
      {!b && !file.loadError && <Spinner />}
      {b && (
        <>
          <ul className="v2-tiles bs-tiles" aria-label="Özet">
            <li className="v2-tile tone-lavanta">
              <span className="tone-tile" aria-hidden="true">
                <Icon as={Tags} size={18} />
              </span>
              <b>{`${SESSION_TYPES.filter((t) => typeOn(b, t.id)).length}/${SESSION_TYPES.length}`}</b>
              <span>Açık görüşme türü</span>
            </li>
            <li className="v2-tile tone-adacayi">
              <span className="tone-tile" aria-hidden="true">
                <Icon as={CalendarClock} size={18} />
              </span>
              <b>{countTimes(b.session.weekdays)}</b>
              <span>Haftalık seans saati</span>
            </li>
            <li className="v2-tile tone-kiremit">
              <span className="tone-tile" aria-hidden="true">
                <Icon as={CalendarClock} size={18} />
              </span>
              <b>{countTimes(b.intro.weekdays)}</b>
              <span>Haftalık ön görüşme saati</span>
            </li>
            <li className="v2-tile tone-gunes">
              <span className="tone-tile" aria-hidden="true">
                <Icon as={CalendarX} size={18} />
              </span>
              <b>{upcoming[0] ? short(upcoming[0].date) : '–'}</b>
              <span>{upcoming[0] ? `Sıradaki kapalı gün · ${upcoming[0].name}` : 'Yaklaşan kapalı gün yok'}</span>
            </li>
          </ul>

          <div className="bs-tabs" role="tablist" aria-label="Randevu ayarlarının bölümleri">
            {TABS.map((t) => (
              <button key={t.id} id={`bs-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                <Icon as={t.icon} size={16} />
                <span>{t.label}</span>
                {file.partDirty(t.paths) && <i className="bs-dot" title="Kaydedilmemiş değişiklik var" aria-label="kaydedilmemiş değişiklik var" />}
              </button>
            ))}
          </div>

          {tab === 'types' && (
            <Part
              tab={current}
              file={file}
              hint="Açık türler seans formunda seçilebilir; ön görüşme formundaki eşi de türle birlikte açılır ve kapanır. Kapalı bir türün formlarda nasıl görüneceğini kartından seçin."
            >
              <ul className="type-cards">
                {SESSION_TYPES.map((t) => {
                  const on = typeOn(b, t.id);
                  const shown = closedAs(b, t.id);
                  const intro = INTRO_FOR.find((f) => f.id === t.id);
                  const look = TYPE_LOOK[t.id];
                  const status = on ? (t.quota ? 'Kontenjanlı' : 'Seçilebilir') : shown === 'hidden' ? 'Görünmüyor' : CLOSED_CHOICES.find((c) => c.value === shown)!.label;
                  return (
                    <li key={t.id} className={`type-card tone-${look.tone}${on ? '' : ' is-off'}`}>
                      <div className="tc-top">
                        <span className="tone-tile" aria-hidden="true">
                          <SiteIcon name={look.icon} size={18} />
                        </span>
                        <span className="tc-name">
                          <b>{t.tr}</b>
                          <span className="tc-meta">{`${t.minutes} dakika`}</span>
                        </span>
                        <Toggle label={on ? 'Açık' : 'Kapalı'} checked={on} onChange={(v) => set({ types: { ...b.types, [t.id]: v } })} />
                      </div>
                      <div className="tc-body">
                        <span className={`tc-status is-${on ? (t.quota ? 'quota' : 'on') : shown}`}>{`Sitede: ${status}`}</span>
                        <span className="k-hint">{intro ? `Ön görüşmede: “${intro.tr.replace(/\s*\(.*\)$/, '')}”` : 'Ön görüşmede yok; siz yönlendirirsiniz.'}</span>
                        {t.id === 'supervision' && (
                          <span className="k-hint">Sembolik ücretli; görüşmeler süpervizörünüzle paylaşılabileceği için danışandan ayrı bir bilgilendirilmiş onam alınır.</span>
                        )}
                      </div>
                      {!on && (
                        <div className="tc-closed">
                          <span className="k-hint">Kapalıyken formlarda:</span>
                          <div className="segmented tc-choice" role="group" aria-label={`${t.tr} kapalıyken formlarda`}>
                            {CLOSED_CHOICES.map((c) => (
                              <button key={c.value} type="button" aria-pressed={shown === c.value} onClick={() => set({ closedAs: { ...b.closedAs, [t.id]: c.value } })}>
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Part>
          )}

          {tab === 'hours' && (
            <Part
              tab={current}
              file={file}
              hint={
                kind === 'session'
                  ? 'Seansların başlayabileceği saatler. Saati olmayan gün kapalıdır.'
                  : 'Ücretsiz ön görüşmelerin başlayabileceği saatler. Saati olmayan gün kapalıdır.'
              }
              extra={
                <div className="segmented end-choice" role="group" aria-label="Hangi saatler">
                  <button type="button" aria-pressed={kind === 'session'} onClick={() => setKind('session')}>
                    Seans saatleri
                  </button>
                  <button type="button" aria-pressed={kind === 'intro'} onClick={() => setKind('intro')}>
                    Ön görüşme saatleri
                  </button>
                </div>
              }
            >
              <WeekTimes
                key={kind}
                label={kind === 'session' ? 'Seans saatleri' : 'Ön görüşme saatleri'}
                value={b[kind].weekdays}
                onChange={(weekdays) => setKindOf(kind, { weekdays })}
              />
            </Part>
          )}

          {tab === 'rules' && (
            <Part tab={current} file={file} hint="Formların hangi saatleri göstereceğini belirleyen süreler.">
              <div className="rule-grid">
                <RuleCard
                  label="Seans: en az"
                  unit="saat önceden"
                  hint="Bu süreden yakın saatler formda görünmez."
                  value={b.session.minNoticeHours}
                  onChange={(minNoticeHours) => setKindOf('session', { minNoticeHours })}
                  error={file.issues['session.minNoticeHours']}
                />
                <RuleCard
                  label="Seans: en çok"
                  unit="hafta ileriye"
                  hint="Takvim bu kadar hafta ileriyi gösterir."
                  value={b.session.weeksAhead}
                  onChange={(weeksAhead) => setKindOf('session', { weeksAhead })}
                  error={file.issues['session.weeksAhead']}
                />
                <RuleCard
                  label="Ön görüşme: en az"
                  unit="saat önceden"
                  hint="Bu süreden yakın saatler formda görünmez."
                  value={b.intro.minNoticeHours}
                  onChange={(minNoticeHours) => setKindOf('intro', { minNoticeHours })}
                  error={file.issues['intro.minNoticeHours']}
                />
                <RuleCard
                  label="Ön görüşme: en çok"
                  unit="hafta ileriye"
                  hint="Takvim bu kadar hafta ileriyi gösterir."
                  value={b.intro.weeksAhead}
                  onChange={(weeksAhead) => setKindOf('intro', { weeksAhead })}
                  error={file.issues['intro.weeksAhead']}
                />
                <RuleCard
                  label="Görüşmeler arası"
                  unit="dakika dinlenme"
                  hint="Bir randevu kendi süresi ve bu süre kadar takvimi doldurur."
                  value={b.restMinutes}
                  onChange={(restMinutes) => set({ restMinutes })}
                  error={file.issues.restMinutes}
                />
              </div>
            </Part>
          )}

          {tab === 'closed' && (
            <Part
              tab={current}
              file={file}
              hint={
                'Resmi tatiller ve izin günleri; bu günlerde formlarda saat görünmez. "Şu saatten itibaren" doluysa gün o saatten sonra kapanır (örneğin bayram arifesi 13.00).'
              }
              extra={
                <Button onClick={() => setClosing(true)}>
                  <Icon as={CalendarX} size={16} />
                  Takvim kapatma
                </Button>
              }
            >
              <p className="k-hint">“Takvim kapatma” bir günü ya da saat aralığını hemen kapatır; kaydetmeye ve site yayınına gerek yoktur.</p>
              {notice && <Banner tone="success">{notice}</Banner>}
              <ListEditor<ClosedDay>
                items={b.closed}
                onChange={(closed) => set({ closed })}
                itemLabel={(c) =>
                  c.date
                    ? `${dotted(c.date)} · ${c.name || 'Adsız'}${c.from ? ` (${c.from.replace(':', '.')}'den sonra)` : ''}${c.date < today() ? ' · geçti' : ''}`
                    : 'Yeni kapalı gün'
                }
                newItem={() => ({ date: '', name: '' })}
                addLabel="Kapalı gün ekle"
                render={(c, update, i) => (
                  <div className="add-grid closed-fields">
                    <Field label="Tarih" type="date" value={c.date} onChange={(date) => update({ date })} error={file.issues[`closed.${i}.date`]} />
                    <Field label="Açıklama" value={c.name} placeholder="Örneğin: İzin" onChange={(name) => update({ name })} error={file.issues[`closed.${i}.name`]} />
                    <Field label="Şu saatten itibaren (isteğe bağlı)" type="time" value={c.from ?? ''} onChange={(from) => update({ from: from || undefined })} />
                  </div>
                )}
              />
            </Part>
          )}
        </>
      )}
      {closing && (
        <CloseHoursDialog
          onClose={() => setClosing(false)}
          onDone={(m) => {
            setClosing(false);
            setNotice(m);
          }}
        />
      )}
    </section>
  );
}
