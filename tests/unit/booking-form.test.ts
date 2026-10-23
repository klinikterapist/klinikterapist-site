import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatDay, holdOf, introVias, minutesOf, slotInstant, slotsFor, timesFor, validateBooking, type BookingConfig, type BookingInput } from '../../src/lib/booking-form';
import { parseBooking } from '../../src/lib/schemas';

const cfg: BookingConfig = parseBooking(JSON.parse(readFileSync('src/data/booking.json', 'utf8')));
// Tuesday 20 October 2026, 10:00 Istanbul.
const NOW = Date.parse('2026-10-20T10:00:00+03:00');

const session = (over: Partial<BookingInput> = {}): BookingInput => ({
  kind: 'session',
  type: 'individual',
  day: '2026-10-22',
  time: '10:00',
  name: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  phone: '0532 123 45 67',
  note: '',
  consent: true,
  ...over,
});
const intro = (over: Partial<BookingInput> = {}): BookingInput => ({
  ...session({ kind: 'intro', type: undefined, day: '2026-10-24', time: '11:00' }),
  forWhom: 'individual',
  topics: [0, 3],
  before: 'no',
  age: 2,
  healthConsent: true,
  ...over,
});

describe('booking.json', () => {
  it('passes the schema; sessions on weekdays, intro calls at weekends', () => {
    expect(Object.keys(cfg.session.weekdays).sort()).toEqual(['1', '2', '3', '4', '5']);
    expect(Object.keys(cfg.intro.weekdays).sort()).toEqual(['0', '6']);
    expect(() => parseBooking({ ...cfg, session: { ...cfg.session, weekdays: { 7: ['10:00'] } } })).toThrow();
    expect(() => parseBooking({ ...cfg, intro: { ...cfg.intro, weekdays: { 6: ['9:5'] } } })).toThrow();
    expect(() => parseBooking({ ...cfg, closed: [{ date: '29.10.2026', name: 'x' }] })).toThrow();
    expect(cfg.restMinutes).toBe(30);
  });
  it('keeps the old times plus the evening ones until 22:00', () => {
    expect(cfg.session.weekdays['1']).toEqual(['10:00', '11:00', '13:30', '15:00', '16:30', '18:00', '19:00', '19:20', '19:50', '20:20', '20:50', '21:10']);
    expect(cfg.intro.weekdays['6']).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00', '13:30', '14:00', '14:30', '15:00', '15:30']);
  });
});

describe('timesFor', () => {
  it('uses the weekday template in Istanbul time', () => {
    expect(timesFor(cfg, 'session', '2026-10-22', NOW)).toEqual(cfg.session.weekdays['4']);
    expect(timesFor(cfg, 'session', '2026-10-24', NOW)).toEqual([]);
    expect(timesFor(cfg, 'intro', '2026-10-24', NOW)).toEqual(cfg.intro.weekdays['6']);
  });
  it('drops times inside the notice period and beyond the window', () => {
    // Tomorrow: only times at least 24 hours away.
    expect(timesFor(cfg, 'session', '2026-10-21', NOW)).toEqual(cfg.session.weekdays['3']);
    expect(timesFor(cfg, 'session', '2026-10-21', NOW + 3600e3 * 2)).toEqual(cfg.session.weekdays['3']!.filter((t) => t >= '12:00'));
    expect(timesFor(cfg, 'session', '2026-10-20', NOW)).toEqual([]);
    expect(timesFor(cfg, 'session', '2026-12-08', NOW)).toEqual([]);
    expect(timesFor(cfg, 'session', 'yarın', NOW)).toEqual([]);
  });
  it('closes public holidays, and a bayram eve from 13:00', () => {
    expect(timesFor(cfg, 'session', '2026-10-29', NOW)).toEqual([]);
    expect(timesFor(cfg, 'session', '2026-10-28', NOW)).toEqual(['10:00', '11:00']);
  });
  it('slotInstant is +03:00', () => {
    expect(new Date(slotInstant('2026-10-31', '23:30')).toISOString()).toBe('2026-10-31T20:30:00.000Z');
  });
});

describe('slotsFor: a booking holds its length plus 30 minutes', () => {
  // An individual session on Thursday 22 October at 19:20 holds 19:20–20:40.
  const busy = [holdOf('2026-10-22', '19:20', minutesOf('session', 'individual'), 30)];
  const taken = (minutes: number) =>
    slotsFor(cfg, 'session', '2026-10-22', NOW, busy, minutes)
      .filter((s) => s.taken)
      .map((s) => s.time);

  it('marks every time that would overlap it as taken, and keeps them in the list', () => {
    expect(taken(50)).toEqual(['19:00', '19:20', '19:50', '20:20']);
    expect(slotsFor(cfg, 'session', '2026-10-22', NOW, busy).find((s) => s.time === '20:50')?.taken).toBe(false);
    expect(slotsFor(cfg, 'session', '2026-10-22', NOW, busy)).toHaveLength(cfg.session.weekdays['4']!.length);
  });
  it('a longer couple session (60 min) also cannot start at 18:00', () => {
    expect(taken(60)).toEqual(['18:00', '19:00', '19:20', '19:50', '20:20']);
  });
  it('another day is not affected', () => {
    expect(slotsFor(cfg, 'session', '2026-10-23', NOW, busy).some((s) => s.taken)).toBe(false);
  });
});

describe('intro call by phone or video (owner, 2026-10-23)', () => {
  it('takes a way that is offered, and forms without it', () => {
    expect(validateBooking(intro({ via: 'phone' }), cfg, NOW)).toEqual({});
    expect(validateBooking(intro({ via: 'video' }), cfg, NOW)).toEqual({});
    expect(validateBooking(intro(), cfg, NOW)).toEqual({});
  });

  it('refuses a way switched off in the panel', () => {
    expect(validateBooking(intro({ via: 'phone' }), { ...cfg, introVia: { phone: false, video: true } }, NOW).via).toBe('required');
  });

  it('offers both when none is on', () => {
    expect(introVias({ introVia: { phone: false, video: false } })).toEqual(['phone', 'video']);
    expect(introVias({})).toEqual(['phone', 'video']);
    expect(introVias({ introVia: { phone: true, video: false } })).toEqual(['phone']);
  });
});

describe('validateBooking', () => {
  it('a complete session request passes', () => {
    expect(validateBooking(session(), cfg, NOW)).toEqual({});
  });
  it('a time that overlaps a booking is taken', () => {
    const busy = [holdOf('2026-10-22', '10:00', 50, 30)];
    expect(validateBooking(session({ time: '11:00' }), cfg, NOW, busy).slot).toBe('taken');
    expect(validateBooking(session({ time: '13:30' }), cfg, NOW, busy)).toEqual({});
  });
  it('refuses a missing type, a slot outside the template, a bad e-mail or phone, a long note and no consent', () => {
    expect(validateBooking(session({ type: 'group' }), cfg, NOW).type).toBe('required');
    expect(validateBooking(session({ time: '09:00' }), cfg, NOW).slot).toBe('invalid');
    expect(validateBooking(session({ day: '2026-10-24' }), cfg, NOW).slot).toBe('invalid');
    expect(validateBooking(session({ email: 'ayse@' }), cfg, NOW).email).toBe('invalid');
    expect(validateBooking(session({ phone: '123' }), cfg, NOW).phone).toBe('invalid');
    expect(validateBooking(session({ phone: 'ara beni 0532' }), cfg, NOW).phone).toBe('invalid');
    expect(validateBooking(session({ phone: `0532 ${' '.repeat(5000)}123 45 67` }), cfg, NOW).phone).toBe('invalid');
    expect(validateBooking(session({ phone: '+90 (532) 123-45-67' }), cfg, NOW).phone).toBeUndefined();
    expect(validateBooking(session({ note: 'x'.repeat(501) }), cfg, NOW).note).toBe('tooLong');
    expect(validateBooking(session({ consent: false }), cfg, NOW).consent).toBe('required');
    expect(validateBooking(session({ name: '   ' }), cfg, NOW).name).toBe('required');
  });
  it('only the session types switched on in Randevu Ayarları can be booked, with their intro-call choice (owner, 2026-10-23)', () => {
    // Defaults: individual, couple and accessible on; group, face to face and supervision off.
    expect(validateBooking(session({ type: 'supervision' }), cfg, NOW).type).toBe('required');
    expect(validateBooking(intro({ forWhom: 'group' }), cfg, NOW).forWhom).toBe('required');
    const on = { ...cfg, types: { group: true, supervision: true, couple: false } };
    expect(validateBooking(session({ type: 'supervision' }), on, NOW).type).toBeUndefined();
    expect(validateBooking(intro({ forWhom: 'group' }), on, NOW).forWhom).toBeUndefined();
    expect(validateBooking(session({ type: 'couple' }), on, NOW).type).toBe('required');
    expect(validateBooking(intro({ forWhom: 'couple' }), on, NOW).forWhom).toBe('required');
    expect(parseBooking({ ...cfg, types: { group: true } }).types).toEqual({ group: true });
  });
  it('an intro request needs who it is for, topics, an age range and explicit consent for the topics', () => {
    expect(validateBooking(intro(), cfg, NOW)).toEqual({});
    expect(validateBooking(intro({ forWhom: 'family' }), cfg, NOW).forWhom).toBe('required');
    expect(validateBooking(intro({ topics: [] }), cfg, NOW).topics).toBe('required');
    expect(validateBooking(intro({ topics: [0, 0] }), cfg, NOW).topics).toBe('invalid');
    expect(validateBooking(intro({ topics: [99] }), cfg, NOW).topics).toBe('invalid');
    expect(validateBooking(intro({ age: 9 }), cfg, NOW).age).toBe('required');
    // 12–17 is no longer offered: no online work with children and teenagers (owner, 2026-10-23).
    expect(validateBooking(intro({ age: 0 }), cfg, NOW).age).toBe('required');
    expect(validateBooking(intro({ age: 1 }), cfg, NOW).age).toBeUndefined();
    expect(validateBooking(intro({ healthConsent: false }), cfg, NOW).healthConsent).toBe('required');
    expect(validateBooking(intro({ day: '2026-10-22' }), cfg, NOW).slot).toBe('invalid');
  });

  it('a session note needs explicit consent once the form asks for it (owner’s note 2026-10-22)', () => {
    const s = (o: Partial<BookingInput>) => validateBooking({ ...session(), note: 'Uykusuzluk', ...o } as BookingInput, cfg, NOW);
    expect(s({ healthConsent: false }).healthConsent).toBe('required');
    expect(s({ healthConsent: true })).toEqual({});
    expect(s({ healthConsent: false, note: '  ' })).toEqual({});
    // A form from before the question was asked leaves it out.
    expect(s({ healthConsent: undefined })).toEqual({});
  });

  it('the intro call’s country is one of the listed ones; a form sent before it was asked still passes', () => {
    expect(validateBooking(intro({ country: 'DE' }), cfg, NOW)).toEqual({});
    expect(validateBooking(intro({ country: 'other' }), cfg, NOW)).toEqual({});
    expect(validateBooking(intro({ country: 'XX' }), cfg, NOW).country).toBe('invalid');
    expect(validateBooking(intro({ country: undefined }), cfg, NOW)).toEqual({});
  });
});

describe('formatDay', () => {
  it('writes the day in both languages', () => {
    expect(formatDay('2026-10-24', 'tr')).toBe('24 Ekim 2026, Cumartesi');
    expect(formatDay('2026-10-24', 'en')).toBe('Saturday 24 October 2026');
  });
});
