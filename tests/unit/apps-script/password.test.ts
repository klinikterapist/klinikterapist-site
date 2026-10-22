import { describe, it, expect } from 'vitest';
import { handle } from '../../../apps-script/src/main';
import { issueSession, LOCK_MS, MAX_FAILS, STEP_TTL_MS } from '../../../apps-script/src/auth';
import { fakeGas, json } from './fake-gas';

const CLIENT = 'client-123.apps.googleusercontent.com';
const props = { GOOGLE_CLIENT_ID: CLIENT, OWNER_EMAIL: 'merhaba@klinikterapist.com' };
const now = Date.UTC(2026, 9, 22, 12);
const okToken = (url: string) =>
  url.includes('tokeninfo')
    ? json(200, { aud: CLIENT, iss: 'accounts.google.com', email: 'merhaba@klinikterapist.com', email_verified: true, exp: String(now / 1000 + 3600) })
    : undefined;

type G = ReturnType<typeof fakeGas>;
const call = (gas: G, body: Record<string, unknown>) => handle(gas, JSON.stringify(body));
const session = (gas: G) => issueSession(gas, 'merhaba@klinikterapist.com').session;

function withPassword() {
  const gas = fakeGas({ props, now, routes: [okToken] });
  expect(call(gas, { action: 'auth.setPassword', session: session(gas), username: 'Gunes', password: 'uzun-bir-sifre' })).toEqual({ ok: true, data: {} });
  return gas;
}
const password = (gas: G, username = 'gunes', pw = 'uzun-bir-sifre') => call(gas, { action: 'auth.password', username, password: pw });

describe('panel password', () => {
  it('without a password Google alone signs in, and the panel is told to ask for one', () => {
    const gas = fakeGas({ props, now, routes: [okToken] });
    expect(call(gas, { action: 'auth.start' })).toEqual({ ok: true, data: { password: false } });
    expect(call(gas, { action: 'auth.login', idToken: 'tok' })).toMatchObject({ ok: true, data: { needsPassword: true } });
  });

  it('once set, sign-in needs the password first, then Google', () => {
    const gas = withPassword();
    expect(call(gas, { action: 'auth.start' })).toEqual({ ok: true, data: { password: true } });
    expect(JSON.stringify(gas.props.all())).not.toContain('uzun-bir-sifre');
    expect(call(gas, { action: 'auth.login', idToken: 'tok' })).toMatchObject({ ok: false, error: { code: 'unauthorized' } });
    const res = password(gas, ' GUNES ');
    expect(res.ok).toBe(true);
    const step = res.ok ? (res.data as { step: string }).step : '';
    expect(call(gas, { action: 'auth.login', idToken: 'tok', step })).toMatchObject({ ok: true, data: { needsPassword: false } });
  });

  it('a step token is short-lived and is not a session', () => {
    const gas = withPassword();
    const res = password(gas);
    const step = res.ok ? (res.data as { step: string }).step : '';
    expect(call(gas, { action: 'site.tree', session: step })).toMatchObject({ ok: false, error: { code: 'unauthorized' } });
    gas.clock.now += STEP_TTL_MS + 1;
    expect(call(gas, { action: 'auth.login', idToken: 'tok', step })).toMatchObject({ ok: false, error: { code: 'unauthorized' } });
  });

  it('a wrong user name or password gets one message that does not say which', () => {
    const gas = withPassword();
    const a = password(gas, 'gunes', 'yanlis-sifre-1');
    const b = password(gas, 'baskasi', 'uzun-bir-sifre');
    expect(a).toMatchObject({ ok: false, error: { code: 'unauthorized', message: 'Kullanıcı adı ya da şifre yanlış.' } });
    expect(b).toEqual(a);
  });

  it(`${MAX_FAILS} wrong tries lock sign-in for 15 minutes and e-mail the owner once`, () => {
    const gas = withPassword();
    for (let i = 0; i < MAX_FAILS; i++) password(gas, 'gunes', `yanlis-${i}`);
    expect(gas.mails).toHaveLength(1);
    expect(gas.mails[0]).toMatchObject({ to: 'merhaba@klinikterapist.com', subject: 'Panel girişinde art arda yanlış şifre' });
    expect(password(gas)).toMatchObject({ ok: false, error: { message: expect.stringContaining('15 dakika') } });
    gas.clock.now += LOCK_MS + 1;
    expect(password(gas).ok).toBe(true);
    expect(gas.mails).toHaveLength(1);
  });

  it('a right answer clears the count of wrong ones', () => {
    const gas = withPassword();
    for (let i = 0; i < MAX_FAILS - 1; i++) password(gas, 'gunes', `yanlis-${i}`);
    expect(password(gas).ok).toBe(true);
    for (let i = 0; i < MAX_FAILS - 1; i++) password(gas, 'gunes', `yanlis-${i}`);
    expect(password(gas).ok).toBe(true);
    expect(gas.mails).toHaveLength(0);
  });

  it('changing the password needs a session and the current password', () => {
    const gas = withPassword();
    const change = { action: 'auth.setPassword', username: 'gunes', password: 'yepyeni-sifre-2' };
    expect(call(gas, change)).toMatchObject({ ok: false, error: { code: 'unauthorized' } });
    expect(call(gas, { ...change, session: session(gas), current: 'yanlis' })).toMatchObject({ ok: false, error: { code: 'unauthorized' } });
    expect(call(gas, { ...change, session: session(gas), current: 'uzun-bir-sifre' }).ok).toBe(true);
    expect(password(gas).ok).toBe(false);
    expect(password(gas, 'gunes', 'yepyeni-sifre-2').ok).toBe(true);
  });

  it.each([
    ['a short user name', { username: 'ab', password: 'uzun-bir-sifre' }],
    ['a short password', { username: 'gunes', password: 'kisa' }],
    ['the user name as password', { username: 'gunesozkurt', password: 'GunesOzkurt' }],
  ])('refuses %s', (_name, input) => {
    const gas = fakeGas({ props, now });
    expect(call(gas, { action: 'auth.setPassword', session: session(gas), ...input })).toMatchObject({ ok: false, error: { code: 'bad_request' } });
  });

  it('no sign-in message names the owner account', () => {
    const gas = fakeGas({ props, now, routes: [(url) => (url.includes('tokeninfo') ? json(200, { aud: CLIENT, iss: 'accounts.google.com', email: 'x@gmail.com', email_verified: true, exp: String(now / 1000 + 600) }) : undefined)] });
    const res = call(gas, { action: 'auth.login', idToken: 'tok' });
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).not.toContain('klinikterapist.com');
  });
});
