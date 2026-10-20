/**
 * Browser side of the client's own page (TrackingView.astro, src/lib/tracking.ts). Reads the code
 * after `#k=`, asks the backend for the therapy (`track.view`) and draws it: the next sessions with
 * "İptal et" and "Ertele" (a free time of the booking calendar: a day, then its free times), the
 * session details and the chart the owner sees, and at the bottom "I want to end therapy". Less than
 * 24 hours before a session, a button first shows the full-fee warning, and goes on only when the
 * client accepts it. Each change sends `track.ask` and draws the answer. Text/plain JSON POSTs, no
 * cookies. Everything is put in with textContent: nothing from the answer is read as HTML.
 *
 * On the dev server the page also opens with `#k=demo`, on sample sessions held in the page, so the
 * owner can look at it before the backend is live.
 */
import { formatDay, slotInstant, type BookingConfig } from '../../lib/booking-form';
import { sessionKey } from '../../lib/sessions';
import { codeFromHash, freeTimes, isLate, type TrackAsk, type TrackFailure, type TrackSession, type TrackView } from '../../lib/tracking';

export type TrackMessages = {
  loading: string;
  noLink: string;
  failures: Record<TrackFailure | 'network', string>;
  nextTitle: string;
  infoTitle: string;
  chartTitle: string;
  info: { weekly: string; type: string; since: string; every: string };
  types: Record<string, string>;
  kinds: { weekly: string; intro: string; closing: string; extra: string };
  status: { cancelled: string; postponed: string };
  byClient: string;
  late: string;
  none: string;
  cancel: string;
  postpone: string;
  lateTitle: string;
  lateText: string;
  lateOk: string;
  cancelNote: string;
  confirmCancel: string;
  pickDay: string;
  pickTime: string;
  noDays: string;
  postponeNote: string;
  confirmPostpone: string;
  back: string;
  sending: string;
  cancelled: string;
  postponed: string;
  chart: { count: string; since: string; free: string; empty: string; note: string; parts: Record<'attended' | 'noshow' | 'cancelled' | 'postponed' | 'unmarked', string> };
  endTitle: string;
  endText: string;
  endButton: string;
  endNote: string;
  endSend: string;
  endDone: string;
  closing: string;
  weekdays: string[];
};

type Deps = { fetch: typeof fetch; now: () => number; timeoutMs?: number };

class Failure extends Error {
  constructor(readonly reason: TrackFailure | 'network') {
    super(reason);
  }
}

const PARTS = ['attended', 'noshow', 'cancelled', 'postponed', 'unmarked'] as const;
const DAY_MS = 864e5;
const istanbulDay = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);

/** Sample sessions for `#k=demo` on the dev server: Tuesdays at 18:00, the first within 24 hours. */
function demoView(now: number): TrackView {
  const iso = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
  // Tomorrow at this hour: a little under 24 hours ahead.
  const soon = new Date(now + 3 * 3600e3 + DAY_MS);
  const soonDay = soon.toISOString().slice(0, 10);
  const soonTime = `${String(soon.getUTCHours()).padStart(2, '0')}:00`;
  let d = now + 2 * DAY_MS;
  while (new Date(d + 3 * 3600e3).getUTCDay() !== 2) d += DAY_MS;
  const tue = (n: number) => iso(d + n * 7 * DAY_MS);
  return {
    lang: 'tr',
    type: 'individual',
    weekday: 2,
    time: '18:00',
    minutes: 50,
    since: iso(now - 40 * DAY_MS),
    closing: false,
    endAsked: false,
    stats: { held: 5, attended: 4, noshow: 0, cancelled: 1, postponed: 1, unmarked: 0, total: 6, free: 1 },
    next: [
      { day: soonDay, time: soonTime, kind: 'extra', minutes: 50, status: 'planned', late: true },
      { day: tue(0), time: '18:00', kind: 'weekly', minutes: 50, status: 'planned', late: false },
      { day: tue(1), time: '18:00', kind: 'weekly', minutes: 50, status: 'cancelled', by: 'client', late: false },
      { day: tue(2), time: '18:00', kind: 'weekly', minutes: 50, status: 'planned', late: false },
    ],
    busy: [],
  };
}

export function mountTrackingPage(root: HTMLElement, deps: Deps = { fetch: window.fetch.bind(window), now: () => Date.now() }) {
  const m = JSON.parse(root.dataset.messages ?? '{}') as TrackMessages;
  const cfg = JSON.parse(root.dataset.config ?? 'null') as BookingConfig | null;
  const endpoint = root.dataset.endpoint ?? '';
  const lang = root.dataset.lang === 'en' ? 'en' : 'tr';
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const live = root.querySelector<HTMLElement>('[data-live]')!;
  const body = root.querySelector<HTMLElement>('[data-body]')!;
  const demo = root.dataset.demo === '1' && /^#k=demo$/.test(location.hash);
  const code = demo ? 'demo' : codeFromHash(location.hash);
  let demoState: TrackView | null = demo ? demoView(deps.now()) : null;
  let uid = 0;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const button = (cls: string, text: string) => {
    const b = el('button', cls, text);
    b.type = 'button';
    return b;
  };

  const say = (text: string, error = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', error);
    status.hidden = !text;
  };

  async function call<T>(action: 'track.view' | 'track.ask', p: Record<string, unknown>): Promise<T> {
    if (demoState) return demoCall(action, p) as T;
    if (!endpoint) throw new Failure('network');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 20000);
    let out: { ok?: boolean; data?: unknown };
    try {
      const res = await deps.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, code, ...p }),
        credentials: 'omit',
        signal: ctrl.signal,
      });
      out = (await res.json()) as typeof out;
    } catch {
      throw new Failure('network');
    } finally {
      clearTimeout(timer);
    }
    if (out?.ok) return out.data as T;
    const reason = (out?.data as { reason?: string } | undefined)?.reason;
    throw new Failure(reason && reason in m.failures ? (reason as TrackFailure) : 'network');
  }

  /** The demo answers in the page, as the backend would. */
  function demoCall(action: string, p: Record<string, unknown>): unknown {
    const v = demoState!;
    if (action === 'track.view') return v;
    if (p.ask === 'end') demoState = { ...v, endAsked: true };
    else {
      const s = v.next.find((x) => x.day === p.day && x.time === p.time);
      if (!s || s.status !== 'planned') throw new Failure('gone');
      if (s.late && p.lateOk !== true) throw new Failure('late');
      const moved: TrackSession[] =
        p.ask === 'postpone' ? [{ day: String(p.newDay), time: String(p.newTime), kind: s.kind === 'weekly' ? 'extra' : s.kind, minutes: s.minutes, status: 'planned', late: isLate({ day: String(p.newDay), time: String(p.newTime) }, deps.now()) }] : [];
      const next = [...v.next.map((x) => (x === s ? { ...x, status: (p.ask === 'cancel' ? 'cancelled' : 'postponed') as TrackSession['status'], by: 'client' as const, ...(p.ask === 'postpone' ? { movedTo: { day: String(p.newDay), time: String(p.newTime) } } : {}) } : x)), ...moved];
      demoState = { ...v, next: next.sort((a, b) => sessionKey(a).localeCompare(sessionKey(b))).slice(0, 5) };
    }
    return { view: demoState };
  }

  const when = (s: { day: string; time: string }) => `${formatDay(s.day, lang)} · ${s.time.replace(':', '.')}`;
  const kindLabel = (v: TrackView, s: TrackSession) => (s.kind === 'weekly' ? (m.types[v.type] ?? m.kinds.weekly) : m.kinds[s.kind]);

  /** A note box, a send button and "back", under a session or in the end section. */
  function sendRow(note: { label: string } | null, send: string, onSend: (note: string) => Promise<void>, onBack: () => void, extra?: () => boolean): HTMLElement {
    const box = el('div', 'tp-ask');
    let area: HTMLTextAreaElement | null = null;
    if (note) {
      const id = `tp-note-${++uid}`;
      const lab = el('label', undefined, note.label);
      lab.htmlFor = id;
      area = el('textarea');
      area.id = id;
      area.rows = 3;
      area.maxLength = 300;
      box.append(lab, area);
    }
    const row = el('div', 'tp-row');
    const go = button('btn', send);
    const back = button('tp-link', m.back);
    back.addEventListener('click', onBack);
    go.addEventListener('click', async () => {
      if (extra && !extra()) return;
      go.disabled = true;
      back.disabled = true;
      go.textContent = m.sending;
      try {
        await onSend(area?.value.trim() ?? '');
      } catch (e) {
        say(m.failures[e instanceof Failure ? e.reason : 'network'], true);
        go.disabled = false;
        back.disabled = false;
        go.textContent = send;
      }
    });
    row.append(go, back);
    box.append(row);
    return box;
  }

  async function ask(ask: TrackAsk, note: string, s?: TrackSession, more: Record<string, unknown> = {}) {
    const out = await call<{ view: TrackView }>('track.ask', { ask, note, ...(s ? { day: s.day, time: s.time } : {}), ...more });
    const done = ask === 'cancel' ? m.cancelled : ask === 'postpone' ? `${m.postponed} ${when({ day: String(more.newDay), time: String(more.newTime) })}` : m.endDone;
    say('');
    draw(out.view);
    live.textContent = s ? `${when(s)}: ${done}` : done;
  }

  /** The postponement: a day with free times, then one of its times, then a note. */
  function postponeForm(v: TrackView, s: TrackSession, late: boolean, onBack: () => void): HTMLElement {
    const box = el('div', 'tp-move');
    const now = deps.now();
    const days: string[] = [];
    if (cfg) for (let t = now; t <= now + (cfg.session.weeksAhead * 7 + 1) * DAY_MS; t += DAY_MS) {
      const day = istanbulDay(t);
      if (!days.includes(day) && freeTimes(cfg, v, s, day, now).length) days.push(day);
    }
    if (!days.length) {
      box.append(el('p', 'tp-note', m.noDays), sendRow(null, m.back, async () => onBack(), onBack));
      return box;
    }
    const dayId = `tp-day-${++uid}`;
    const dayLabel = el('label', undefined, m.pickDay);
    dayLabel.htmlFor = dayId;
    const select = el('select');
    select.id = dayId;
    for (const day of days) {
      const o = el('option', undefined, formatDay(day, lang));
      o.value = day;
      select.append(o);
    }
    const times = el('fieldset', 'tp-times');
    times.append(el('legend', undefined, m.pickTime));
    let picked = '';
    const fill = () => {
      picked = '';
      times.querySelectorAll('label').forEach((l) => l.remove());
      for (const t of freeTimes(cfg!, v, s, select.value, deps.now())) {
        const lab = el('label', 'tp-time');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = `tp-time-${uid}`;
        radio.value = t;
        radio.addEventListener('change', () => (picked = t));
        lab.append(radio, el('span', undefined, t.replace(':', '.')));
        times.append(lab);
      }
    };
    select.addEventListener('change', fill);
    fill();
    box.append(dayLabel, select, times);
    box.append(
      sendRow(
        { label: m.postponeNote },
        m.confirmPostpone,
        (note) => ask('postpone', note, s, { newDay: select.value, newTime: picked, ...(late ? { lateOk: true } : {}) }),
        onBack,
        () => {
          if (picked) return true;
          say(m.pickTime, true);
          times.querySelector('input')?.focus();
          return false;
        },
      ),
    );
    queueMicrotask(() => select.focus());
    return box;
  }

  function sessionRow(v: TrackView, s: TrackSession): HTMLLIElement {
    const li = el('li', `tp-session is-${s.status}`);
    const head = el('div', 'tp-when');
    head.append(el('b', undefined, when(s)), el('span', undefined, kindLabel(v, s)));
    li.append(head);
    const state = el('p', 'tp-state');
    if (s.status === 'cancelled' || s.status === 'postponed') {
      state.textContent = `${m.status[s.status]}${s.movedTo ? ` → ${when(s.movedTo)}` : ''}${s.by === 'client' ? ` · ${m.byClient}` : ''}`;
    } else if (s.late) state.textContent = m.late;
    if (state.textContent) li.append(state);
    if (s.status !== 'planned' || s.kind === 'intro' || slotInstant(s.day, s.time) <= deps.now()) return li;

    const row = el('div', 'tp-row');
    const cancel = button('tp-btn', m.cancel);
    const move = button('tp-btn', m.postpone);
    const open = (which: 'cancel' | 'postpone') => {
      row.hidden = true;
      const back = () => {
        panel.remove();
        row.hidden = false;
        (which === 'cancel' ? cancel : move).focus();
      };
      const form = () =>
        which === 'cancel'
          ? sendRow({ label: m.cancelNote }, m.confirmCancel, (note) => ask('cancel', note, s, s.late ? { lateOk: true } : {}), back)
          : postponeForm(v, s, s.late, back);
      const panel = el('div', 'tp-panel');
      if (s.late) {
        // Less than 24 hours: the full-fee warning first, and the client's yes.
        const warn = el('div', 'tp-warn');
        warn.setAttribute('role', 'alert');
        warn.append(el('b', undefined, m.lateTitle), el('p', undefined, m.lateText));
        const yes = button('btn', m.lateOk);
        const no = button('tp-link', m.back);
        no.addEventListener('click', back);
        yes.addEventListener('click', () => {
          warn.remove();
          const f = form();
          panel.append(f);
          f.querySelector<HTMLElement>('textarea, select')?.focus();
        });
        const r = el('div', 'tp-row');
        r.append(yes, no);
        warn.append(r);
        panel.append(warn);
        queueMicrotask(() => yes.focus());
      } else {
        const f = form();
        panel.append(f);
        queueMicrotask(() => f.querySelector<HTMLElement>('textarea, select')?.focus());
      }
      li.append(panel);
    };
    cancel.addEventListener('click', () => open('cancel'));
    move.addEventListener('click', () => open('postpone'));
    row.append(cancel, move);
    li.append(row);
    return li;
  }

  function infoCard(v: TrackView): HTMLElement {
    const sec = el('section', 'tp-card');
    sec.append(el('h2', undefined, m.infoTitle));
    const dl = el('dl', 'tp-info');
    const rows: [string, string][] = [
      [m.info.weekly, m.info.every.replace('{day}', m.weekdays[v.weekday]).replace('{time}', v.time.replace(':', '.'))],
      [m.info.type, m.types[v.type] ?? m.kinds.weekly],
      [m.info.since, formatDay(v.since, lang)],
    ];
    for (const [k, val] of rows) {
      const d = el('div');
      d.append(el('dt', undefined, k), el('dd', undefined, val));
      dl.append(d);
    }
    sec.append(dl);
    if (v.closing) sec.append(el('p', 'tp-note', m.closing));
    return sec;
  }

  function chartCard(v: TrackView): HTMLElement {
    const st = v.stats;
    const pct = (n: number) => (st.total ? Math.round((n / st.total) * 100) : 0);
    const sec = el('section', 'tp-card');
    sec.append(el('h2', undefined, m.chartTitle));
    const count = el('p', 'tp-count');
    count.append(el('b', undefined, String(st.held)), document.createTextNode(` ${m.chart.count}`));
    sec.append(count, el('p', 'tp-note', `${m.chart.since}${st.free ? ` · ${m.chart.free.replace('{n}', String(st.free))}` : ''}`));
    if (!st.total) {
      sec.append(el('p', 'tp-note', m.chart.empty));
      return sec;
    }
    const bar = el('div', 'tp-bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', PARTS.filter((p) => st[p]).map((p) => `${m.chart.parts[p]} %${pct(st[p])}`).join(', '));
    for (const p of PARTS.filter((x) => st[x])) {
      const seg = el('span', `tp-seg seg-${p}`);
      seg.style.flexGrow = String(st[p]);
      bar.append(seg);
    }
    const key = el('ul', 'tp-key');
    for (const p of PARTS) {
      const li = el('li');
      li.append(el('i', `seg-${p}`), el('span', undefined, m.chart.parts[p]), el('b', undefined, `%${pct(st[p])}`), el('small', undefined, String(st[p])));
      key.append(li);
    }
    sec.append(bar, key, el('p', 'tp-note', m.chart.note.replace('{n}', String(st.total))));
    return sec;
  }

  function draw(v: TrackView) {
    body.replaceChildren();
    const next = el('section', 'tp-next');
    next.append(el('h2', undefined, m.nextTitle));
    const list = el('ul', 'tp-list');
    for (const s of v.next) list.append(sessionRow(v, s));
    next.append(v.next.length ? list : el('p', 'tp-note', m.none));
    body.append(next, infoCard(v), chartCard(v));

    const end = el('section', 'tp-end');
    const title = el('h2', undefined, m.endTitle);
    end.append(title);
    if (v.endAsked) end.append(el('p', 'tp-done', m.endDone));
    else {
      end.append(el('p', undefined, m.endText));
      const open = button('tp-btn', m.endButton);
      open.addEventListener('click', () => {
        open.hidden = true;
        const form = sendRow({ label: m.endNote }, m.endSend, (note) => ask('end', note), () => {
          form.remove();
          open.hidden = false;
          open.focus();
        });
        end.append(form);
        form.querySelector('textarea')?.focus();
      });
      end.append(open);
    }
    body.append(end);
    body.hidden = false;
  }

  async function load() {
    // The language switch keeps the code, so the page opens in the other language too.
    if (code) document.querySelectorAll<HTMLAnchorElement>('a.lang-switch').forEach((a) => a.setAttribute('href', `${(a.getAttribute('href') ?? '').split('#')[0]}${location.hash}`));
    if (!code) {
      say(m.noLink, true);
      return;
    }
    say(m.loading);
    try {
      draw(await call<TrackView>('track.view', {}));
      say('');
    } catch (e) {
      say(m.failures[e instanceof Failure ? e.reason : 'network'], true);
    }
  }

  void load();
}
