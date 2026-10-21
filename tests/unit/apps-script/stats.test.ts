import { describe, expect, it } from 'vitest';
import { fakeGas } from './fake-gas';
import { MAX_BUCKET_KEYS, MAX_HITS_PER_HOUR, SHARDS, flushStats, recordHit, statsReads, statsSummary } from '../../../apps-script/src/stats';
import { handle, runHourly } from '../../../apps-script/src/main';

const at = (iso: string) => Date.parse(iso);

/** One hour's counts, its shards added up. */
function hourCounts(gas: ReturnType<typeof fakeGas>, hour: string): Record<string, number> | null {
  const out: Record<string, number> = {};
  let any = false;
  for (const [k, v] of Object.entries(gas.props.all())) {
    if (k !== `st:h:${hour}` && !k.startsWith(`st:h:${hour}:`)) continue;
    any = true;
    for (const [c, n] of Object.entries(JSON.parse(v) as Record<string, number>)) out[c] = (out[c] ?? 0) + n;
  }
  return any ? out : null;
}

describe('page counter backend', () => {
  it('hits add up in the Istanbul hour bucket and set since', () => {
    const gas = fakeGas({ now: at('2026-10-19T10:15:00+03:00') });
    recordHit(gas, { t: 'view', p: '/' });
    recordHit(gas, { t: 'view', p: '/' });
    recordHit(gas, { t: 'read', k: 'yazi' });
    expect(hourCounts(gas, '2026101910')).toEqual({ 'v|/': 2, 'ref|direct': 2, 'rd|yazi': 1 });
    expect(gas.props.get('st:since')).toBe('2026-10-19');
  });

  it('drops hits past the hourly flood limit', () => {
    const gas = fakeGas({ now: at('2026-10-19T10:00:00+03:00') });
    gas.cache.put('st:rate:2026101910', String(MAX_HITS_PER_HOUR), 3700);
    recordHit(gas, { t: 'view', p: '/' });
    expect(hourCounts(gas, '2026101910')).toBeNull();
  });

  it('ignores invalid hits', () => {
    const gas = fakeGas();
    expect(recordHit(gas, { t: 'view', p: 'javascript:alert(1)' })).toEqual({});
    expect(Object.keys(gas.props.all()).filter((k) => k.startsWith('st:'))).toEqual([]);
  });

  it(`a shard takes no new keys past ${MAX_BUCKET_KEYS} in one hour, but keeps counting known ones`, () => {
    const gas = fakeGas({ now: at('2026-10-19T10:00:00+03:00') });
    gas.uuid = () => '00000000-0000-0000-0000-000000000000';
    for (let i = 0; i < MAX_BUCKET_KEYS + 20; i++) recordHit(gas, { t: 'click', k: `l${i}` });
    recordHit(gas, { t: 'click', k: 'l0' });
    const bucket = JSON.parse(gas.props.get('st:h:2026101910:0')!);
    expect(Object.keys(bucket)).toHaveLength(MAX_BUCKET_KEYS);
    expect(bucket['c|l0']).toBe(2);
  });

  it('a hit takes no lock: the panel and the booking files never wait for the counter', () => {
    const gas = fakeGas({ now: at('2026-10-19T10:00:00+03:00') });
    gas.withLock = () => {
      throw new Error('the counter took the lock');
    };
    for (let i = 0; i < 40; i++) recordHit(gas, { t: 'view', p: '/' });
    expect(hourCounts(gas, '2026101910')!['v|/']).toBe(40);
    const shards = Object.keys(gas.props.all()).filter((k) => k.startsWith('st:h:'));
    expect(shards.length).toBeGreaterThan(1);
    expect(shards.length).toBeLessThanOrEqual(SHARDS);
  });

  it('the hourly run rolls up buckets an hour old; 23:30 on 31 October lands in October', async () => {
    const gas = fakeGas({ now: at('2026-10-31T23:30:00+03:00') });
    recordHit(gas, { t: 'read', k: 'yazi' });
    gas.clock.now = at('2026-11-01T00:10:00+03:00');
    recordHit(gas, { t: 'read', k: 'yazi' });
    // Within the hour of margin nothing moves yet.
    flushStats(gas);
    expect(gas.root.findFolder('istatistik')).toBeFalsy();
    gas.clock.now = at('2026-11-01T01:05:00+03:00');
    await runHourly(gas);
    const oct = JSON.parse(gas.root.findFolder('istatistik')!.findFile('2026-10.json')!.read());
    expect(oct.days['2026-10-31']).toEqual({ 'rd|yazi': 1 });
    expect(hourCounts(gas, '2026103123')).toBeNull();
    expect(hourCounts(gas, '2026110100')).toEqual({ 'rd|yazi': 1 });
  });

  it('buckets of the earlier, locked version are rolled up too', () => {
    const gas = fakeGas({ now: at('2026-10-20T12:00:00+03:00'), props: { 'st:h:2026101909': JSON.stringify({ 'v|/': 3 }), 'st:idx': JSON.stringify(['2026101909']) } });
    flushStats(gas);
    expect(JSON.parse(gas.root.findFolder('istatistik')!.findFile('2026-10.json')!.read()).days['2026-10-19']).toEqual({ 'v|/': 3 });
    expect(gas.props.get('st:h:2026101909')).toBeNull();
    expect(gas.props.get('st:idx')).toBeNull();
  });

  it('summary merges month files and the hours not rolled up yet for the range', () => {
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
    flushStats(gas);
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
