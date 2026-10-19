/**
 * Step-by-step form for the booking and intro call designs (owner's review 2026-10-19): one step on
 * screen at a time, "Geri" / "Devam" at the bottom (sticky on phones), the stepper on top. A step's
 * required fields are checked before moving on. Sending is booking-submit.ts's job; this file only
 * moves between steps and keeps the chosen day and time (`selection()`).
 *
 * Markup contract (inside `root`):
 *   [data-step-dot="n"]      stepper items
 *   [data-step="n"]          the step panels (1-based); each has an h2 that gets focus
 *   [data-need="slot"]       on a panel: a time must be chosen before going on
 *   [data-need="group:x"]    on a panel: at least one checkbox named x must be ticked
 *   [data-step-error]        inside a panel: the message shown when something is missing
 *   [data-back] [data-next]  the navigation buttons
 *   [data-sum="key"]         summary texts, filled from [data-sum-src="key"] inputs or the calendar
 *   [data-cal-*]             the calendar (see mountCalendar)
 */

type Lang = 'tr' | 'en';

const TEXT = {
  tr: {
    next: 'Devam',
    last: 'Özeti gör',
    missing: 'Devam etmek için işaretli alanları doldurun.',
    pickSlot: 'Devam etmek için bir gün ve saat seçin.',
    pickGroup: 'Devam etmek için en az bir seçenek işaretleyin.',
    pickDay: 'Takvimden bir gün seçin.',
    none: 'Bu gün için boş saat yok.',
    notChosen: 'Seçilmedi',
  },
  en: {
    next: 'Continue',
    last: 'See summary',
    missing: 'Please fill in the marked fields to continue.',
    pickSlot: 'Please choose a day and time to continue.',
    pickGroup: 'Please tick at least one option to continue.',
    pickDay: 'Pick a day in the calendar.',
    none: 'No free times on this day.',
    notChosen: 'Not chosen',
  },
} as const;

export interface CalendarOptions {
  /** Free times for a day (empty: the day is not bookable). */
  timesFor: (day: Date, today: Date) => string[];
}

export type Wizard = {
  /** The chosen calendar day (`YYYY-MM-DD`) and time, or null. */
  selection(): { day: string | null; time: string | null };
  /** Opens a step (1-based), e.g. the calendar again when the time was taken. */
  show(step: number): void;
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function mountWizard(root: HTMLElement, cal: CalendarOptions): Wizard {
  const lang: Lang = root.dataset.lang === 'en' ? 'en' : 'tr';
  const T = TEXT[lang];
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  const panels = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const dots = [...root.querySelectorAll<HTMLElement>('[data-step-dot]')];
  const back = root.querySelector<HTMLButtonElement>('[data-back]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-next]')!;
  const nextLabel = next.querySelector<HTMLElement>('[data-next-label]') ?? next;
  const nav = root.querySelector<HTMLElement>('[data-nav]')!;
  let step = 1;
  let slot: string | null = null;
  let chosen: Date | null = null;

  const setSum = (key: string, value: string | null, sub?: string) =>
    root.querySelectorAll<HTMLElement>(`[data-sum="${key}"]`).forEach((el) => {
      el.classList.toggle('muted', !value);
      el.replaceChildren(value ?? T.notChosen);
      if (value && sub) el.append(Object.assign(document.createElement('small'), { textContent: sub }));
    });

  const show = (n: number, focus = true) => {
    step = n;
    panels.forEach((p) => (p.hidden = Number(p.dataset.step) !== n));
    dots.forEach((d) => {
      const i = Number(d.dataset.stepDot);
      d.classList.toggle('is-done', i < n);
      d.classList.toggle('is-current', i === n);
      if (i === n) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    });
    back.hidden = n === 1;
    const last = n === panels.length;
    nav.hidden = last;
    nextLabel.textContent = n === panels.length - 1 ? T.last : T.next;
    root.classList.toggle('is-last', last);
    if (!focus) return;
    const h = panels[n - 1].querySelector<HTMLElement>('h2');
    h?.setAttribute('tabindex', '-1');
    h?.focus({ preventScroll: true });
    // Bring the stepper to the top of the screen, so the new step is what the visitor sees.
    const anchor = root.querySelector('.stepper') ?? root;
    const top = anchor.getBoundingClientRect().top + window.scrollY - 12;
    if (Math.abs(window.scrollY - top) > 8) window.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  /** Checks the current step; shows the message and marks the fields when something is missing. */
  const valid = (): boolean => {
    const panel = panels[step - 1];
    const error = panel.querySelector<HTMLElement>('[data-step-error]');
    const need = panel.dataset.need ?? '';
    let message = '';
    const fields = [...panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')];
    const bad = fields.filter((f) => !f.disabled && !f.checkValidity());
    fields.forEach((f) => f.toggleAttribute('aria-invalid', bad.includes(f)));
    if (bad.length) message = T.missing;
    if (need === 'slot' && !slot) message = T.pickSlot;
    if (need.startsWith('group:') && !panel.querySelector(`input[name="${need.slice(6)}"]:checked`)) message = T.pickGroup;
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
    if (message) (bad[0] ?? error)?.focus?.();
    return !message;
  };

  back.addEventListener('click', () => show(Math.max(1, step - 1)));
  next.addEventListener('click', () => {
    if (valid()) show(Math.min(panels.length, step + 1));
  });
  root.querySelectorAll<HTMLElement>('[data-goto]').forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.goto))));
  dots.forEach((d) =>
    d.querySelector('button')?.addEventListener('click', () => {
      const i = Number(d.dataset.stepDot);
      if (i < step) show(i);
    }),
  );
  // Hide a step's message again as soon as the visitor changes something there.
  root.addEventListener('input', (e) => {
    const f = e.target as HTMLElement;
    f.removeAttribute('aria-invalid');
    const error = f.closest('[data-step]')?.querySelector<HTMLElement>('[data-step-error]');
    if (error) error.hidden = true;
  });

  // Summary texts follow their source inputs (radios, checkboxes, selects, text fields).
  const syncSources = () => {
    const keys = new Set([...root.querySelectorAll<HTMLElement>('[data-sum-src]')].map((el) => el.dataset.sumSrc!));
    for (const key of keys) {
      const els = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-sum-src="${key}"]`)];
      const picked = els.filter((el) => (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox') ? el.checked : el.value.trim()));
      const values = picked.map((el) => el.dataset.label ?? (el instanceof HTMLSelectElement ? el.selectedOptions[0]?.textContent ?? '' : el.value.trim()));
      setSum(key, values.length ? values.join(', ') : null, picked[0]?.dataset.meta);
    }
  };
  root.addEventListener('change', syncSources);
  root.addEventListener('input', syncSources);

  // Calendar with the day's free times.
  const days = root.querySelector<HTMLElement>('[data-cal-days]');
  if (days) {
    const title = root.querySelector<HTMLElement>('[data-cal-title]')!;
    const slots = root.querySelector<HTMLElement>('[data-slots]')!;
    const slotsTitle = root.querySelector<HTMLElement>('[data-slots-title]')!;
    const prev = root.querySelector<HTMLButtonElement>('[data-cal-prev]')!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Open on the first month that has a free day (a weekend-only calendar late in a month).
    let month = new Date(today.getFullYear(), today.getMonth(), 1);

    const drawSlots = () => {
      slots.replaceChildren();
      if (!chosen) {
        slotsTitle.textContent = T.pickDay;
        return;
      }
      const list = cal.timesFor(chosen, today);
      slotsTitle.textContent = list.length ? cap(chosen.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })) : T.none;
      for (const time of list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot';
        b.textContent = time;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(time === slot));
        b.addEventListener('click', () => {
          slots.querySelectorAll('.slot').forEach((s) => s.setAttribute('aria-checked', 'false'));
          b.setAttribute('aria-checked', 'true');
          slot = time;
          setSum('time', time);
          const error = b.closest('[data-step]')?.querySelector<HTMLElement>('[data-step-error]');
          if (error) error.hidden = true;
        });
        slots.append(b);
      }
    };

    const drawMonth = () => {
      title.textContent = cap(month.toLocaleDateString(locale, { month: 'long', year: 'numeric' }));
      days.replaceChildren();
      const lead = (month.getDay() + 6) % 7;
      for (let i = 0; i < lead; i++) days.append(document.createElement('span'));
      const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      for (let n = 1; n <= last; n++) {
        const d = new Date(month.getFullYear(), month.getMonth(), n);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'day';
        b.textContent = String(n);
        const free = cal.timesFor(d, today).length > 0;
        b.disabled = !free;
        if (free) b.classList.add('has-slots');
        if (d.getTime() === today.getTime()) b.classList.add('is-today');
        if (chosen && d.getTime() === chosen.getTime()) b.setAttribute('aria-pressed', 'true');
        b.setAttribute('aria-label', d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }));
        b.addEventListener('click', () => {
          chosen = d;
          slot = null;
          days.querySelectorAll('.day').forEach((x) => x.removeAttribute('aria-pressed'));
          b.setAttribute('aria-pressed', 'true');
          setSum('day', d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }));
          setSum('time', null);
          drawSlots();
        });
        days.append(b);
      }
      prev.disabled = month <= new Date(today.getFullYear(), today.getMonth(), 1);
    };

    const monthHasFree = (m: Date) => {
      const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (let n = 1; n <= last; n++) if (cal.timesFor(new Date(m.getFullYear(), m.getMonth(), n), today).length) return true;
      return false;
    };
    if (!monthHasFree(month)) month = new Date(month.getFullYear(), month.getMonth() + 1, 1);

    prev.addEventListener('click', () => {
      month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      drawMonth();
    });
    root.querySelector('[data-cal-next]')!.addEventListener('click', () => {
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      drawMonth();
    });
    drawMonth();
    drawSlots();
    setSum('day', null);
    setSum('time', null);
  }

  syncSources();
  show(1, false);
  return { selection: () => ({ day: chosen ? ymd(chosen) : null, time: slot }), show: (n) => show(n) };
}
