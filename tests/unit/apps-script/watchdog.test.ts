import { describe, expect, it } from 'vitest';
import { fakeGas } from './fake-gas';
import { handle, runHourly } from '../../../apps-script/src/main';
import { LAST_RUN } from '../../../apps-script/src/watchdog';

const NOW = Date.parse('2026-10-21T14:00:00+03:00');
const hit = (gas: ReturnType<typeof fakeGas>) => handle(gas, JSON.stringify({ action: 'stats.hit', t: 'view', p: '/' }));

function setup(lastRun?: number) {
  const gas = fakeGas({ props: { OWNER_EMAIL: 'merhaba@klinikterapist.com', ...(lastRun ? { [LAST_RUN]: String(lastRun) } : {}) }, now: NOW });
  return gas;
}

describe('"Saatlik görev durdu" warning', () => {
  it('says nothing before the first hourly run, or while it runs on time', async () => {
    const gas = setup();
    hit(gas);
    expect(gas.mails).toEqual([]);
    await runHourly(gas);
    gas.clock.now += 2 * 3600e3;
    gas.cache.put('hourly.checked', '', 1);
    hit(gas);
    expect(gas.mails).toEqual([]);
  });

  it('a run more than 3 hours late: one e-mail with what to do, again at most once a day', () => {
    const gas = setup(NOW - 5 * 3600e3);
    hit(gas);
    expect(gas.mails).toHaveLength(1);
    expect(gas.mails[0]).toMatchObject({ to: 'merhaba@klinikterapist.com', subject: '[klinikterapist] Saatlik görev durmuş görünüyor' });
    expect(gas.mails[0].body).toContain('en son 21.10.2026 09:00 saatinde çalıştı (5 saat önce)');
    expect(gas.mails[0].body).toContain('"hourly" işlevini seçip bir kez "Çalıştır"a basın');
    // Checked at most every 10 minutes, and warned at most once a day.
    hit(gas);
    gas.clock.now += 11 * 60e3;
    hit(gas);
    expect(gas.mails).toHaveLength(1);
    gas.clock.now += 24 * 3600e3;
    hit(gas);
    expect(gas.mails).toHaveLength(2);
  });

  it('the next hourly run clears it; a failing check never fails the request', async () => {
    const gas = setup(NOW - 5 * 3600e3);
    await runHourly(gas);
    hit(gas);
    expect(gas.mails).toEqual([]);
    const broken = setup(NOW - 5 * 3600e3);
    broken.mail.send = () => {
      throw new Error('Service invoked too many times for one day: email.');
    };
    expect(hit(broken)).toEqual({ ok: true, data: {} });
    expect(broken.logs.some((l) => l.startsWith('watchdog:'))).toBe(true);
  });
});
