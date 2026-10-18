import { describe, expect, it } from 'vitest';
import { fakeGas } from './fake-gas';
import { MAX_BUCKET_KEYS, MAX_HITS_PER_HOUR, recordHit, statsReads, statsSummary } from '../../../apps-script/src/stats';
import { handle } from '../../../apps-script/src/main';

const at = (iso: string) => Date.parse(iso);

describe('page counter backend', () => {
  it('hits add up in the Istanbul hour bucket and set since', () => {
    const gas = fakeGas({ now: at('2026-10-19T10:15:00+03:00') });
    recordHit(gas, { t: 'view', p: '/' });
    recordHit(gas, { t: 'view', p: '/' });
    recordHit(gas, { t: 'read', k: 'yazi' });
    expect(JSON.parse(gas.props.get('st:h:2026101910')!)).toEqual({ 'v|/': 2, 'ref|direct': 2, 'rd|yazi': 1 });
    expect(gas.props.get('st:since')).toBe('2026-10-19');
  });

  it('drops hits past the hourly flood limit', () => {
    const gas = fakeGas({ now: at('2026-10-19T10:00:00+03:00') });
    gas.cache.put('st:rate:2026101910', String(MAX_HITS_PER_HOUR), 3700);
    recordHit(gas, { t: 'view', p: '/' });
    expect(gas.props.get('st:h:2026101910')).toBeNull();
  });

  it('ignores invalid hits', () => {
    const gas = fakeGas();
    expect(recordHit(gas, { t: 'view', p: 'javascript:alert(1)' })).toEqual({});
    expect(gas.props.get('st:idx')).toBeNull();
  });

  it(`takes no new keys past ${MAX_BUCKET_KEYS} in one hour, but keeps counting known ones`, () => {
    const gas = fakeGas({ now: at('2026-10-19T10:00:00+03:00') });
    for (let i = 0; i < MAX_BUCKET_KEYS + 20; i++) recordHit(gas, { t: 'click', k: `l${i}` });
    recordHit(gas, { t: 'click', k: 'l0' });
    const bucket = JSON.parse(gas.props.get('st:h:2026101910')!);
    expect(Object.keys(bucket)).toHaveLength(MAX_BUCKET_KEYS);
    expect(bucket['c|l0']).toBe(2);
  });

  it('a new hour rolls old buckets into the month file; 23:30 on 31 October lands in October', () => {
    const gas = fakeGas({ now: at('2026-10-31T23:30:00+03:00') });
    recordHit(gas, { t: 'read', k: 'yazi' });
    gas.clock.now = at('2026-11-01T00:10:00+03:00');
    recordHit(gas, { t: 'read', k: 'yazi' });
    const oct = JSON.parse(gas.root.findFolder('istatistik')!.findFile('2026-10.json')!.read());
    expect(oct.days['2026-10-31']).toEqual({ 'rd|yazi': 1 });
    expect(gas.props.get('st:h:2026103123')).toBeNull();
    expect(JSON.parse(gas.props.get('st:idx')!)).toEqual(['2026110100']);
  });

  it('summary merges month files and the current hour for the range', () => {
    const gas = fakeGas({ now: at('2026-10-30T09:00:00+03:00') });
    recordHit(gas, { t: 'view', p: '/' });
    gas.clock.now = at('2026-10-31T12:00:00+03:00');
    recordHit(gas, { t: 'view', p: '/' });
    const s = statsSummary(gas, { from: '2026-10-01', to: '2026-10-31' });
    expect(s.days['2026-10-30']['v|/']).toBe(1);
    expect(s.days['2026-10-31']['v|/']).toBe(1);
    expect(s.since).toBe('2026-10-30');
    expect(statsSummary(gas, { from: '2026-10-31', to: '2026-10-31' }).days['2026-10-30']).toBeUndefined();
  });

  it('reads are public and only give counts per post', () => {
    const gas = fakeGas({ now: at('2026-10-30T09:00:00+03:00') });
    recordHit(gas, { t: 'read', k: 'yazi' });
    recordHit(gas, { t: 'view', p: '/' });
    gas.clock.now = at('2026-10-30T11:00:00+03:00');
    recordHit(gas, { t: 'view', p: '/' });
    expect(statsReads(gas)).toEqual({ counts: { yazi: 1 } });
  });

  it('stats.hit needs no session; stats.summary does', () => {
    const gas = fakeGas();
    expect(handle(gas, JSON.stringify({ action: 'stats.hit', t: 'view', p: '/' }))).toEqual({ ok: true, data: {} });
    const res = handle(gas, JSON.stringify({ action: 'stats.summary', from: '2026-10-01', to: '2026-10-02' }));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error.code).toBe('unauthorized');
  });
});
