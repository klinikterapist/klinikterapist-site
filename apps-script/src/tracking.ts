/**
 * The client's own page (src/lib/tracking.ts): a secret link per client, made here.
 *
 * The code is `<client id>.<signature>`: the signature is an HMAC of the id and the link version
 * (`linkGen`) with a key derived from SEAL_KEY, so nothing about the link is stored and a copy of
 * the Drive files cannot make one. "Bağlantıyı yenile" counts the version up (the old link stops
 * working); ending therapy deletes the client, and with it every link.
 *
 * Public: `track.view` (the next sessions, no name, no e-mail, no notes) and `track.ask` (cancel a
 * session at once, ask for another time, or say they want to end therapy). Every ask e-mails the
 * owner, with Reply-To the client so the owner can answer from Gmail. Wrong codes are counted for
 * the whole site (Apps Script sees no IP): after 30 in a clock hour the page waits for the next hour.
 */
import type { Gas } from './gas';
import { ApiError, badRequest } from './respond';
import { derive } from './seal';
import { allowSend } from './contact';
import { readItems, writeItems } from './store';
import { CLIENTS, sendMail, type StoredClient } from './requests';
import { INTRO_MINUTES, formatDay } from '../../src/lib/booking-form';
import { SessionError, applyChange, askReschedule } from '../../src/lib/sessions';
import { TRACK_CODE_RE, TRACK_NOTE_MAX, TRACK_PARAM, TRACK_PATH, trackView, type TrackAsk, type TrackFailure, type TrackView } from '../../src/lib/tracking';

const SITE = 'https://klinikterapist.com';
const PANEL_URL = 'https://klinikterapist.com/admin/';
export const TRACK_BAD_MAX = 30;
const HOUR_MS = 3600 * 1000;

const MESSAGES: Record<TrackFailure, string> = {
  link: 'Bu bağlantı geçersiz ya da artık kullanılmıyor.',
  late: 'Seansa 24 saatten az kaldı; bu sayfadan değiştirilemez. Lütfen doğrudan e-posta gönderin.',
  gone: 'Bu seans artık değiştirilemez. Sayfayı yenileyin.',
  busy: 'Şu anda çok fazla istek var. Lütfen biraz sonra tekrar deneyin.',
  invalid: 'İstek anlaşılamadı. Sayfayı yenileyip tekrar deneyin.',
};
const failure = (reason: TrackFailure) => new ApiError('bad_request', MESSAGES[reason], { reason });

const signature = (gas: Gas, c: StoredClient) => gas.hmac(derive(gas, 'track'), `${c.id}:${c.linkGen ?? 0}`).slice(0, 32);
const codeOf = (gas: Gas, c: StoredClient) => `${c.id}.${signature(gas, c)}`;

export const trackLink = (gas: Gas, c: StoredClient) => `${SITE}${TRACK_PATH[c.contact.lang]}#${TRACK_PARAM}=${codeOf(gas, c)}`;

const equal = (a: string, b: string) => {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

/** The client a code names. A wrong code counts against the site-wide hourly limit. */
function clientOf(gas: Gas, code: unknown): { clients: StoredClient[]; c: StoredClient } {
  const key = `track:bad:${Math.floor(gas.now() / HOUR_MS)}`;
  const bad = Number(gas.cache.get(key) ?? '0') || 0;
  if (bad >= TRACK_BAD_MAX) throw failure('busy');
  const clients = readItems<StoredClient>(gas, CLIENTS);
  const c = typeof code === 'string' && TRACK_CODE_RE.test(code) ? clients.find((x) => x.id === code.slice(0, code.lastIndexOf('.'))) : undefined;
  if (!c || !equal(codeOf(gas, c), code as string)) {
    gas.cache.put(key, String(bad + 1), 2 * 3600);
    throw failure('link');
  }
  return { clients, c };
}

/** `track.view` (public). */
export function viewTracking(gas: Gas, p: Record<string, unknown>): TrackView {
  return trackView(clientOf(gas, p.code).c, gas.now());
}

const when = (s: { day: string; time: string }) => `${formatDay(s.day, 'tr')}, ${s.time.replace(':', '.')}`;

function ownerMail(c: StoredClient, ask: TrackAsk, s: { day: string; time: string } | null, note: string): { subject: string; body: string } {
  const page = `${PANEL_URL}#/seans-takip/${c.id}`;
  const lines =
    ask === 'cancel'
      ? [`${c.number}, kendi randevu sayfasından ${when(s!)} seansını iptal etti.`, 'Seans Seans takip\'te "İptal edildi · danışan istedi" olarak işaretlendi; saat takvimde ve sitede açıldı.']
      : ask === 'reschedule'
        ? [`${c.number}, ${when(s!)} seansı için başka bir saat istiyor.`, 'Seans şimdilik planlı duruyor. Yeni saati danışanla konuşup Seans takip\'te "Ertele" ile işleyin.']
        : [`${c.number}, kendi randevu sayfasından terapiyi sonlandırmak istediğini bildirdi.`, 'Danışanla konuştuktan sonra Seans takip\'te "Terapiyi sonlandır"ı kullanabilirsiniz.'];
  const subject = { cancel: `seansını iptal etti — ${s ? when(s) : ''}`, reschedule: `başka bir saat istiyor — ${s ? when(s) : ''}`, end: 'terapiyi sonlandırmak istiyor' }[ask];
  return {
    subject: `[klinikterapist] ${c.number} ${subject}`,
    body: [
      ...lines,
      '',
      ...(note ? ['Danışanın notu:', note, ''] : []),
      `Danışanın sayfası (panel): ${page}`,
      '',
      '—',
      'Yanıtla dediğinizde e-posta danışanın adresine gider.',
    ].join('\n'),
  };
}

/** `track.ask` (public): what the client asked for on their page. */
export function askTracking(gas: Gas, p: Record<string, unknown>): { view: TrackView } {
  const ask = (['cancel', 'reschedule', 'end'] as const).find((a) => a === p.ask);
  if (!ask) throw failure('invalid');
  const note = typeof p.note === 'string' ? p.note.trim().slice(0, TRACK_NOTE_MAX) : '';
  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) throw failure('busy');
  const { c, s } = gas.withLock(() => {
    const { clients, c } = clientOf(gas, p.code);
    const now = gas.now();
    let updated: StoredClient;
    let s: { day: string; time: string } | null = null;
    if (ask === 'end') {
      updated = { ...c, endAsked: { at: now, ...(note ? { note } : {}) } };
    } else {
      const shown = trackView(c, now).next.find((x) => x.day === p.day && x.time === p.time);
      if (!shown || shown.status !== 'planned') throw failure('gone');
      if (shown.late) throw failure('late');
      s = { day: shown.day, time: shown.time };
      try {
        const sessions =
          ask === 'cancel'
            ? applyChange(c, { op: 'mark', day: shown.day, time: shown.time, status: 'cancelled', by: 'client', note }, INTRO_MINUTES).sessions
            : askReschedule(c, shown.day, shown.time, note);
        updated = { ...c, sessions };
      } catch (e) {
        if (e instanceof SessionError) throw failure('gone');
        throw e;
      }
    }
    if (!allowSend(gas, c.contact.email)) throw failure('busy');
    writeItems(gas, CLIENTS, clients.map((x) => (x.id === c.id ? updated : x)));
    return { c: updated, s };
  });
  const m = ownerMail(c, ask, s, note);
  gas.mail.send({ to: owner, replyTo: c.contact.email, subject: m.subject, body: m.body, name: 'klinikterapist.com randevu sayfası' });
  return { view: trackView(c, gas.now()) };
}

const NO_CLIENT = 'Bu danışan bulunamadı. Başka bir yerde takipten çıkarılmış olabilir.';

/** `clients.link` (panel): the client's link; `renew` makes a new one and the old one stops working. */
export function clientLink(gas: Gas, p: Record<string, unknown>): { link: string } {
  return gas.withLock(() => {
    const clients = readItems<StoredClient>(gas, CLIENTS);
    const c = clients.find((x) => x.id === p.id);
    if (!c) throw new ApiError('not_found', NO_CLIENT);
    if (p.renew !== true) return { link: trackLink(gas, c) };
    const renewed: StoredClient = { ...c, linkGen: (c.linkGen ?? 0) + 1 };
    writeItems(gas, CLIENTS, clients.map((x) => (x.id === c.id ? renewed : x)));
    return { link: trackLink(gas, renewed) };
  });
}

/** `clients.linkMail` (panel): the owner's (edited) e-mail with the link, to the client's address. */
export function mailClientLink(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  const c = readItems<StoredClient>(gas, CLIENTS).find((x) => x.id === p.id);
  if (!c) throw new ApiError('not_found', NO_CLIENT);
  sendMail(gas, c.contact.email, p);
  return {};
}
