/**
 * Browser side of the client's own page (TrackingView.astro, src/lib/tracking.ts). Reads the code
 * after `#k=`, asks the backend for the next sessions (`track.view`) and draws them with their
 * buttons: cancel or ask for another time (24 hours or more ahead), and at the bottom "I want to end
 * therapy". Each sends `track.ask` and draws the answer. Text/plain JSON POSTs, no cookies.
 * Everything is put in with textContent: nothing from the answer is read as HTML.
 *
 * On the dev server the page also opens with `#k=demo`, on sample sessions held in the page, so the
 * owner can look at it before the backend is live.
 */
import { formatDay } from '../../lib/booking-form';
import { codeFromHash, type TrackAsk, type TrackFailure, type TrackSession, type TrackView } from '../../lib/tracking';

export type TrackMessages = {
  loading: string;
  noLink: string;
  failures: Record<TrackFailure | 'network', string>;
  weekly: string;
  types: Record<string, string>;
  kinds: { weekly: string; intro: string; closing: string; extra: string };
  status: { cancelled: string; postponed: string };
  byClient: string;
  asked: string;
  late: string;
  none: string;
  cancel: string;
  reschedule: string;
  cancelNote: string;
  rescheduleNote: string;
  confirmCancel: string;
  sendReschedule: string;
  back: string;
  sending: string;
  cancelled: string;
  rescheduled: string;
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

/** Sample sessions for `#k=demo` on the dev server: next Tuesdays at 18:00, one within 24 hours. */
function demoView(now: number): TrackView {
  const iso = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
  let d = now + 2 * 864e5;
  while (new Date(d + 3 * 3600e3).getUTCDay() !== 2) d += 864e5;
  const tue = (n: number) => iso(d + n * 7 * 864e5);
  // Tomorrow at this hour: a little under 24 hours ahead.
  const soon = new Date(now + 3 * 3600e3 + 864e5);
  return {
    lang: 'tr',
    type: 'individual',
    weekday: 2,
    time: '18:00',
    closing: false,
    endAsked: false,
    next: [
      { day: soon.toISOString().slice(0, 10), time: `${String(soon.getUTCHours()).padStart(2, '0')}:00`, kind: 'extra', minutes: 50, status: 'planned', late: true },
      { day: tue(0), time: '18:00', kind: 'weekly', minutes: 50, status: 'planned', late: false },
      { day: tue(1), time: '18:00', kind: 'weekly', minutes: 50, status: 'cancelled', by: 'client', late: false },
      { day: tue(2), time: '18:00', kind: 'weekly', minutes: 50, status: 'planned', late: false },
    ],
  };
}

export function mountTrackingPage(root: HTMLElement, deps: Deps = { fetch: window.fetch.bind(window), now: () => Date.now() }) {
  const m = JSON.parse(root.dataset.messages ?? '{}') as TrackMessages;
  const endpoint = root.dataset.endpoint ?? '';
  const lang = root.dataset.lang === 'en' ? 'en' : 'tr';
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const live = root.querySelector<HTMLElement>('[data-live]')!;
  const body = root.querySelector<HTMLElement>('[data-body]')!;
  const demo = root.dataset.demo === '1' && /^#k=demo$/.test(location.hash);
  const code = demo ? 'demo' : codeFromHash(location.hash);
  let demoState: TrackView | null = demo ? demoView(deps.now()) : null;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
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
      if (s.late) throw new Failure('late');
      demoState = { ...v, next: v.next.map((x) => (x === s ? (p.ask === 'cancel' ? { ...x, status: 'cancelled' as const, by: 'client' as const } : { ...x, asked: true }) : x)) };
    }
    return { view: demoState };
  }

  const when = (s: { day: string; time: string }) => `${formatDay(s.day, lang)} · ${s.time.replace(':', '.')}`;
  const kindLabel = (v: TrackView, s: TrackSession) => (s.kind === 'weekly' ? (m.types[v.type] ?? m.kinds.weekly) : m.kinds[s.kind]);

  /** The note box and the send button that open under a session or the end section. */
  function askForm(label: string, send: string, onSend: (note: string) => Promise<void>, onBack: () => void): HTMLElement {
    const box = el('div', 'tp-ask');
    const id = `tp-note-${Math.random().toString(36).slice(2, 8)}`;
    const lab = el('label', undefined, label);
    lab.htmlFor = id;
    const note = el('textarea');
    note.id = id;
    note.rows = 3;
    note.maxLength = 300;
    const row = el('div', 'tp-row');
    const go = el('button', 'btn', send);
    go.type = 'button';
    const back = el('button', 'tp-link', m.back);
    back.type = 'button';
    back.addEventListener('click', onBack);
    go.addEventListener('click', async () => {
      go.disabled = true;
      back.disabled = true;
      go.textContent = m.sending;
      try {
        await onSend(note.value.trim());
      } catch (e) {
        say(m.failures[e instanceof Failure ? e.reason : 'network'], true);
        go.disabled = false;
        back.disabled = false;
        go.textContent = send;
      }
    });
    row.append(go, back);
    box.append(lab, note, row);
    queueMicrotask(() => note.focus());
    return box;
  }

  async function ask(ask: TrackAsk, note: string, s?: TrackSession) {
    const out = await call<{ view: TrackView }>('track.ask', { ask, note, ...(s ? { day: s.day, time: s.time } : {}) });
    const done = ask === 'cancel' ? m.cancelled : ask === 'reschedule' ? m.rescheduled : m.endDone;
    say('');
    draw(out.view);
    live.textContent = s ? `${when(s)}: ${done}` : done;
  }

  function sessionRow(v: TrackView, s: TrackSession): HTMLLIElement {
    const li = el('li', `tp-session is-${s.status}`);
    const head = el('div', 'tp-when');
    head.append(el('b', undefined, when(s)), el('span', undefined, kindLabel(v, s)));
    li.append(head);
    const state = el('p', 'tp-state');
    if (s.status === 'cancelled' || s.status === 'postponed') state.textContent = `${m.status[s.status]}${s.by === 'client' ? ` · ${m.byClient}` : ''}`;
    else if (s.asked) state.textContent = m.asked;
    else if (s.late) state.textContent = m.late;
    if (state.textContent) li.append(state);
    if (s.status === 'planned' && !s.late && !s.asked) {
      const row = el('div', 'tp-row');
      const cancel = el('button', 'tp-btn', m.cancel);
      const move = el('button', 'tp-btn', m.reschedule);
      cancel.type = move.type = 'button';
      const open = (which: 'cancel' | 'reschedule') => {
        row.hidden = true;
        const form = askForm(
          which === 'cancel' ? m.cancelNote : m.rescheduleNote,
          which === 'cancel' ? m.confirmCancel : m.sendReschedule,
          (note) => ask(which, note, s),
          () => {
            form.remove();
            row.hidden = false;
            (which === 'cancel' ? cancel : move).focus();
          },
        );
        li.append(form);
      };
      cancel.addEventListener('click', () => open('cancel'));
      move.addEventListener('click', () => open('reschedule'));
      row.append(cancel, move);
      li.append(row);
    }
    return li;
  }

  function draw(v: TrackView) {
    body.replaceChildren();
    const weekly = el('p', 'tp-weekly', m.weekly.replace('{day}', m.weekdays[v.weekday]).replace('{time}', v.time.replace(':', '.')).replace('{type}', m.types[v.type] ?? ''));
    body.append(weekly);
    if (v.closing) body.append(el('p', 'tp-note', m.closing));
    const list = el('ul', 'tp-list');
    for (const s of v.next) list.append(sessionRow(v, s));
    body.append(v.next.length ? list : el('p', 'tp-note', m.none));

    const end = el('section', 'tp-end');
    end.setAttribute('aria-labelledby', 'tp-end-title');
    const title = el('h2', undefined, m.endTitle);
    title.id = 'tp-end-title';
    end.append(title);
    if (v.endAsked) end.append(el('p', 'tp-done', m.endDone));
    else {
      end.append(el('p', undefined, m.endText));
      const open = el('button', 'tp-btn', m.endButton);
      open.type = 'button';
      open.addEventListener('click', () => {
        open.hidden = true;
        const form = askForm(m.endNote, m.endSend, (note) => ask('end', note), () => {
          form.remove();
          open.hidden = false;
          open.focus();
        });
        end.append(form);
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
