import { describe, it, expect } from 'vitest';
import { applyChange, clientsBusy, pastAndNext, sessionsOf, tally, SessionError, type TrackedClient } from '../../src/lib/sessions';
import { suggestEmail, sameEmail } from '../../src/lib/email-check';
import { validateWaitlist } from '../../src/lib/waitlist-form';

const at = (s: string) => Date.parse(`${s}+03:00`);
// Tuesdays at 18:00 from 6 October 2026.
const c: TrackedClient = { weekday: 2, time: '18:00', minutes: 50, since: '2026-10-06' };

describe('a client’s sessions', () => {
  it('the weekly ones repeat from the start; the last four and the next four around now', () => {
    expect(sessionsOf(c, '2026-10-01', '2026-10-21').map((s) => s.day)).toEqual(['2026-10-06', '2026-10-13', '2026-10-20']);
    const withIntro: TrackedClient = { ...c, sessions: [{ day: '2026-10-02', time: '11:00', kind: 'intro', minutes: 30, status: 'attended' }] };
    const { past, next } = pastAndNext(withIntro, at('2026-10-21T10:00:00'));
    expect(past.map((s) => `${s.kind} ${s.day}`)).toEqual(['intro 2026-10-02', 'weekly 2026-10-06', 'weekly 2026-10-13', 'weekly 2026-10-20']);
    expect(next.map((s) => s.day)).toEqual(['2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17']);
  });

  it('marks: attended, cancelled by the client (frees the time), back to planned', () => {
    let s = applyChange(c, { op: 'mark', day: '2026-10-13', time: '18:00', status: 'attended' }, 30).sessions;
    s = applyChange({ ...c, sessions: s }, { op: 'mark', day: '2026-10-27', time: '18:00', status: 'cancelled', by: 'client', note: 'Seyahat' }, 30).sessions;
    expect(s).toEqual([
      { day: '2026-10-13', time: '18:00', kind: 'weekly', minutes: 50, status: 'attended' },
      { day: '2026-10-27', time: '18:00', kind: 'weekly', minutes: 50, status: 'cancelled', by: 'client', note: 'Seyahat' },
    ]);
    const busy = clientsBusy([{ ...c, sessions: s }], 30, at('2026-10-26T00:00:00'), at('2026-11-04T00:00:00'));
    expect(busy.map((b) => b.start)).toEqual([at('2026-11-03T18:00:00')]);
    expect(tally({ ...c, sessions: s })).toEqual({ attended: 1, noshow: 0, cancelled: 1, postponed: 0 });
    expect(applyChange({ ...c, sessions: s }, { op: 'mark', day: '2026-10-27', time: '18:00', status: 'planned' }, 30).sessions).toHaveLength(1);
  });

  it('a postponed session moves to its new date as an extra one; changing the mark takes the extra away', () => {
    const r = applyChange(c, { op: 'mark', day: '2026-10-27', time: '18:00', status: 'postponed', by: 'owner', newDay: '2026-10-29', newTime: '19:00' }, 30);
    expect(r.added).toEqual({ day: '2026-10-29', time: '19:00', kind: 'extra', minutes: 50, status: 'planned', from: '2026-10-27T18:00' });
    expect(r.sessions.find((s) => s.day === '2026-10-27')).toMatchObject({ status: 'postponed', movedTo: { day: '2026-10-29', time: '19:00' } });
    const back = applyChange({ ...c, sessions: r.sessions }, { op: 'mark', day: '2026-10-27', time: '18:00', status: 'planned' }, 30).sessions;
    expect(back).toEqual([]);
  });

  it('adds the free closing session; refuses a clash with a weekly one; removes an added one', () => {
    const r = applyChange(c, { op: 'add', kind: 'closing', day: '2026-11-05', time: '19:00' }, 30);
    expect(r.added).toMatchObject({ kind: 'closing', minutes: 30 });
    expect(() => applyChange(c, { op: 'add', kind: 'extra', day: '2026-10-27', time: '18:00' }, 30)).toThrow(SessionError);
    expect(() => applyChange(c, { op: 'mark', day: '2026-10-28', time: '18:00', status: 'attended' }, 30)).toThrow('Bu tarihte bir seans yok.');
    expect(applyChange({ ...c, sessions: r.sessions }, { op: 'remove', day: '2026-11-05', time: '19:00' }, 30).sessions).toEqual([]);
  });
});

describe('e-mail check', () => {
  it('suggests the common domain for a near miss, leaves right and unknown ones alone', () => {
    expect(suggestEmail('ayse@gmial.com')).toBe('ayse@gmail.com');
    expect(suggestEmail('ayse@hotmial.com')).toBe('ayse@hotmail.com');
    expect(suggestEmail('ayse@gmail.con')).toBe('ayse@gmail.com');
    expect(suggestEmail('ayse@outlok.com.tr')).toBe('ayse@outlook.com.tr');
    expect(suggestEmail('ayse@gmail.com')).toBeNull();
    expect(suggestEmail('ayse@klinikterapist.com')).toBeNull();
    expect(suggestEmail('ayse@ku.edu.tr')).toBeNull();
    expect(sameEmail(' Ayse@Example.com', 'ayse@example.com ')).toBe(true);
  });
});

describe('"Haber et" form', () => {
  const ok = { name: 'Elif Bekler', email: 'elif@example.com', phone: '0534 000 00 00', kinds: ['individual'], times: ['weekend'], reason: '', consent: true, healthConsent: false };
  it('needs a name, an e-mail, a phone, what they look for and the notice; explicit consent only with a reason', () => {
    expect(validateWaitlist(ok)).toEqual({});
    expect(validateWaitlist({ ...ok, kinds: [] })).toEqual({ kinds: 'required' });
    expect(validateWaitlist({ ...ok, kinds: ['group'] })).toEqual({ kinds: 'invalid' });
    expect(validateWaitlist({ ...ok, reason: 'Kaygı' })).toEqual({ healthConsent: 'required' });
    expect(validateWaitlist({ ...ok, reason: 'Kaygı', healthConsent: true })).toEqual({});
    expect(validateWaitlist({ ...ok, email: 'elif@', consent: false })).toEqual({ email: 'invalid', consent: 'required' });
  });
});
