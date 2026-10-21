/**
 * The client's own page (src/lib/tracking.ts): a secret link per client, made here.
 *
 * The code is `<client id>.<signature>`: the signature is an HMAC of the id and the link version
 * (`linkGen`) with a key derived from SEAL_KEY, so nothing about the link is stored and a copy of
 * the Drive files cannot make one. "Bağlantıyı yenile" counts the version up (the old link stops
 * working); ending therapy deletes the client, and with it every link.
 *
 * Public: `track.view` (the therapy as the owner sees it, the next sessions and the times others
 * take; no name, no e-mail, no notes) and `track.ask`: cancel a session, move it to a free time of
 * the booking calendar (checked again here), or say they want to end therapy. Less than 24 hours
 * before a session the page warns that the full fee is due; the change is taken only with that
 * warning accepted (`lateOk`), and the session is marked `late`. Every ask e-mails the owner, with
 * Reply-To the client so the owner can answer from Gmail. Wrong codes are counted for the whole site
 * (Apps Script sees no IP): after 30 in a clock hour the page waits for the next hour.
 */
import type { Gas } from './gas';
import { ApiError } from './respond';
import { derive } from './seal';
import { allowSend } from './contact';
import { readItems, writeItems } from './store';
import { config } from './booking';
import { CLIENTS, allBusy, sendMail, type StoredClient } from './requests';
import { INTRO_MINUTES, formatDay, holdOf, overlaps, timesFor } from '../../src/lib/booking-form';
import { SessionError, applyChange, sessionKey } from '../../src/lib/sessions';
import { TRACK_CODE_RE, TRACK_NOTE_MAX, TRACK_PARAM, TRACK_PATH, trackView, type TrackAsk, type TrackFailure, type TrackView } from '../../src/lib/tracking';
import { DAY_RE, TIME_RE } from '../../src/lib/field-rules';
import { PANEL_URL, SENDER_NAME, SITE, sameString } from './text';
import { logEvent, shortWhen } from './events';
import { asSender, notifyTo } from './mailboxes';

export const TRACK_BAD_MAX = 30;
const HOUR_MS = 3600 * 1000;

const MESSAGES: Record<TrackFailure, string> = {
  link: 'Bu bağlantı geçersiz ya da artık kullanılmıyor.',
  late: 'Seansa 24 saatten az kaldı; önce uyarının onaylanması gerekir.',
  gone: 'Bu seans artık değiştirilemez. Sayfayı yenileyin.',
  taken: 'Seçilen saat artık uygun değil. Başka bir saat seçin.',
  busy: 'Şu anda çok fazla istek var. Lütfen biraz sonra tekrar deneyin.',
  invalid: 'İstek anlaşılamadı. Sayfayı yenileyip tekrar deneyin.',
};
const failure = (reason: TrackFailure) => new ApiError('bad_request', MESSAGES[reason], { reason });

const signature = (gas: Gas, c: StoredClient) => gas.hmac(derive(gas, 'track'), `${c.id}:${c.linkGen ?? 0}`).slice(0, 32);
const codeOf = (gas: Gas, c: StoredClient) => `${c.id}.${signature(gas, c)}`;

export const trackLink = (gas: Gas, c: StoredClient) => `${SITE}${TRACK_PATH[c.contact.lang]}#${TRACK_PARAM}=${codeOf(gas, c)}`;

/** The client a code names. A wrong code counts against the site-wide hourly limit. */
function clientOf(gas: Gas, code: unknown): { clients: StoredClient[]; c: StoredClient } {
  const key = `track:bad:${Math.floor(gas.now() / HOUR_MS)}`;
  const bad = Number(gas.cache.get(key) ?? '0') || 0;
  if (bad >= TRACK_BAD_MAX) throw failure('busy');
  const clients = readItems<StoredClient>(gas, CLIENTS);
  const c = typeof code === 'string' && TRACK_CODE_RE.test(code) ? clients.find((x) => x.id === code.slice(0, code.lastIndexOf('.'))) : undefined;
  if (!c || !sameString(codeOf(gas, c), code as string)) {
    gas.cache.put(key, String(bad + 1), 2 * 3600);
    throw failure('link');
  }
  return { clients, c };
}

/** The page's view: the times the others take, this client's own left out (the page adds them). */
const viewOf = (gas: Gas, clients: StoredClient[], c: StoredClient, now: number) => trackView(c, now, allBusy(gas, config(gas), now, clients.filter((x) => x.id !== c.id)));

/** `track.view` (public). */
export function viewTracking(gas: Gas, p: Record<string, unknown>): TrackView {
  const { clients, c } = clientOf(gas, p.code);
  return viewOf(gas, clients, c, gas.now());
}

const when = (s: { day: string; time: string }) => `${formatDay(s.day, 'tr')}, ${s.time.replace(':', '.')}`;

type Change = { s: { day: string; time: string }; to?: { day: string; time: string }; late: boolean };

function ownerMail(c: StoredClient, ask: TrackAsk, ch: Change | null, note: string): { subject: string; body: string } {
  const page = `${PANEL_URL}#/seans-takip/${c.id}`;
  const fee = ch?.late ? ['', 'Seansa 24 saatten az kala yapıldı. Danışan, seans ücretinin tamamının ödeneceğini ve bunun kendi sorumluluğunda olduğunu belirten uyarıyı onayladı.'] : [];
  const lines =
    ask === 'cancel'
      ? [`${c.number}, kendi randevu sayfasından ${when(ch!.s)} seansını iptal etti.`, 'Seans Seans takip\'te "İptal edildi · danışan istedi" olarak işaretlendi; saat takvimde ve sitede açıldı.', ...fee]
      : ask === 'postpone'
        ? [`${c.number}, kendi randevu sayfasından ${when(ch!.s)} seansını ${when(ch!.to!)} tarihine erteledi.`, 'Seans takip\'te "Ertelendi · danışan istedi" olarak işaretlendi; yeni saat takvime işlendi, eski saat açıldı.', ...fee]
        : [`${c.number}, kendi randevu sayfasından terapiyi sonlandırmak istediğini bildirdi.`, 'Danışanla konuştuktan sonra danışanın sayfasında "Terapiyi sonlandır"ı kullanabilirsiniz.'];
  const late = ch?.late ? ' (24 saatten az kala)' : '';
  const subject = { cancel: `seansını iptal etti${late} — ${ch ? when(ch.s) : ''}`, postpone: `seansını erteledi${late} — ${ch ? `${when(ch.s)} → ${ch.to ? when(ch.to) : ''}` : ''}`, end: 'terapiyi sonlandırmak istiyor' }[ask];
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

/**
 * Review E1: the client's own copy of what they did on their page. Fixed text: the client's note
 * does not go into it (the link is made here); a late change says the full fee is due, as the page
 * did. "If it was not you" covers a link that reached someone else.
 */
function clientMail(gas: Gas, c: StoredClient, ask: TrackAsk, ch: Change | null): { subject: string; body: string } {
  const lang = c.contact.lang;
  const at = (s: { day: string; time: string }) => `${formatDay(s.day, lang)}, ${s.time.replace(':', '.')}`;
  const link = trackLink(gas, c);
  if (lang === 'en') {
    const lines =
      ask === 'cancel'
        ? [`Your session on ${at(ch!.s)} (Turkey time) has been cancelled from your appointment page.`]
        : ask === 'postpone'
          ? [`Your session on ${at(ch!.s)} has been moved to ${at(ch!.to!)} (Turkey time).`]
          : ['Your wish to end therapy has reached me. I will write to you soon.'];
    return {
      subject: { cancel: 'Your session has been cancelled', postpone: 'Your session has been moved', end: 'Your message has reached me' }[ask] + ' – klinikterapist.com',
      body: [
        'Hello,',
        '',
        ...lines,
        ...(ch?.late ? ['As you accepted on the page, the full session fee is due because this was done less than 24 hours before the session.'] : []),
        '',
        `Your appointment page: ${link}`,
        'If you did not do this, please reply to this e-mail straight away.',
        '',
        'Osman Güneş Özkurt',
        'klinikterapist.com',
      ].join('\n'),
    };
  }
  const lines =
    ask === 'cancel'
      ? [`${at(ch!.s)} seansınız, randevu sayfanızdan yaptığınız işlemle iptal edildi.`]
      : ask === 'postpone'
        ? [`${at(ch!.s)} seansınız ${at(ch!.to!)} tarihine ertelendi.`]
        : ['Terapiyi sonlandırma isteğiniz bana ulaştı. En kısa sürede size yazacağım.'];
  return {
    subject: { cancel: 'Seansınız iptal edildi', postpone: 'Seansınız ertelendi', end: 'İsteğiniz bana ulaştı' }[ask] + ' – klinikterapist.com',
    body: [
      'Merhaba,',
      '',
      ...lines,
      ...(ch?.late ? ['Seansa 24 saatten az kala yapıldığı için, sayfada onayladığınız gibi seans ücretinin tamamı ödenir.'] : []),
      '',
      `Randevu sayfanız: ${link}`,
      'Bu işlemi siz yapmadıysanız lütfen bu e-postayı yanıtlayarak hemen bana yazın.',
      '',
      'Osman Güneş Özkurt',
      'klinikterapist.com',
    ].join('\n'),
  };
}

/** `track.ask` (public): what the client did on their page. */
export function askTracking(gas: Gas, p: Record<string, unknown>): { view: TrackView } {
  const ask = (['cancel', 'postpone', 'end'] as const).find((a) => a === p.ask);
  if (!ask) throw failure('invalid');
  const note = typeof p.note === 'string' ? p.note.trim().slice(0, TRACK_NOTE_MAX) : '';
  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) throw failure('busy');
  const cfg = ask === 'postpone' ? config(gas) : null;
  const { c, clients, change } = gas.withLock(() => {
    const { clients, c } = clientOf(gas, p.code);
    const now = gas.now();
    let updated: StoredClient;
    let change: Change | null = null;
    if (ask === 'end') {
      updated = { ...c, endAsked: { at: now, ...(note ? { note } : {}) } };
    } else {
      const shown = trackView(c, now).next.find((x) => x.day === p.day && x.time === p.time);
      if (!shown || shown.status !== 'planned' || shown.kind === 'intro') throw failure('gone');
      if (shown.late && p.lateOk !== true) throw failure('late');
      change = { s: { day: shown.day, time: shown.time }, late: shown.late };
      let to: { day: string; time: string } | undefined;
      if (ask === 'postpone') {
        if (typeof p.newDay !== 'string' || !DAY_RE.test(p.newDay) || typeof p.newTime !== 'string' || !TIME_RE.test(p.newTime)) throw failure('invalid');
        if (!timesFor(cfg!, 'session', p.newDay, now).includes(p.newTime)) throw failure('taken');
        to = { day: p.newDay, time: p.newTime };
        change.to = to;
      }
      let result: ReturnType<typeof applyChange>;
      try {
        result = applyChange(c, { op: 'mark', day: shown.day, time: shown.time, status: ask === 'cancel' ? 'cancelled' : 'postponed', by: 'client', note, ...(to ? { newDay: to.day, newTime: to.time } : {}) }, INTRO_MINUTES);
      } catch (e) {
        if (e instanceof SessionError) throw failure(ask === 'postpone' ? 'taken' : 'gone');
        throw e;
      }
      const key = sessionKey(shown);
      const sessions = shown.late ? result.sessions.map((x) => (sessionKey(x) === key ? { ...x, late: true as const } : x)) : result.sessions;
      updated = { ...c, sessions };
      if (result.added) {
        const mine = holdOf(result.added.day, result.added.time, result.added.minutes, cfg!.restMinutes);
        const others = clients.map((x) => (x.id === c.id ? { ...updated, sessions: sessions.filter((s) => sessionKey(s) !== sessionKey(result.added!)) } : x));
        if (allBusy(gas, cfg!, now, others).some((b) => overlaps(mine, b))) throw failure('taken');
      }
    }
    // Two e-mails: the owner's and the client's own copy (E1).
    if (!allowSend(gas, c.contact.email, 2)) throw failure('busy');
    const all = clients.map((x) => (x.id === c.id ? updated : x));
    writeItems(gas, CLIENTS, all);
    return { c: updated, clients: all, change };
  });
  const m = ownerMail(c, ask, change, note);
  gas.mail.send({ to: notifyTo(gas, owner), replyTo: c.contact.email, subject: m.subject, body: m.body, name: 'klinikterapist.com randevu sayfası' });
  const mine = clientMail(gas, c, ask, change);
  gas.mail.send({ to: c.contact.email, ...asSender(gas, 'booking', owner), subject: mine.subject, body: mine.body, name: SENDER_NAME });
  const did = ask === 'cancel' ? 'seansını iptal etti' : ask === 'postpone' ? 'seansını erteledi' : 'terapiyi sonlandırmak istiyor';
  logEvent(gas, 'client', `${c.number} ${did}${change ? ` · ${shortWhen(change.s)}${change.to ? ` → ${shortWhen(change.to)}` : ''}${change.late ? ' · 24 saatten az kala (tam ücret)' : ''}` : ''}`, `#/seans-takip/${c.id}`);
  return { view: viewOf(gas, clients, c, gas.now()) };
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
