import { describe, it, expect } from 'vitest';
import { handle } from '../../../apps-script/src/main';
import { issueSession } from '../../../apps-script/src/auth';
import { fakeGas, json } from './fake-gas';

const CLIENT = 'client-123.apps.googleusercontent.com';
const props = { GOOGLE_CLIENT_ID: CLIENT, OWNER_EMAIL: 'merhaba@klinikterapist.com' };
const now = Date.UTC(2026, 9, 17, 12);
const okToken = (url: string) =>
  url.includes('tokeninfo')
    ? json(200, { aud: CLIENT, iss: 'accounts.google.com', email: 'merhaba@klinikterapist.com', email_verified: true, exp: String(now / 1000 + 600) })
    : undefined;

describe('handle', () => {
  it('auth.login returns a session for the owner', () => {
    const gas = fakeGas({ props, now, routes: [okToken] });
    const res = handle(gas, JSON.stringify({ action: 'auth.login', idToken: 'tok' }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toMatchObject({ email: 'merhaba@klinikterapist.com', expiresAt: now + 12 * 3600e3 });
  });
  it('every other action needs a session', () => {
    const gas = fakeGas({ props, now });
    for (const action of ['site.tree', 'drafts.list', 'auth.logout']) {
      const res = handle(gas, JSON.stringify({ action }));
      expect(res.ok, action).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('unauthorized');
    }
  });
  it('an unknown action is a bad request', () => {
    const gas = fakeGas({ props, now });
    const { session } = issueSession(gas, 'merhaba@klinikterapist.com');
    const res = handle(gas, JSON.stringify({ action: 'site.format', session }));
    expect(res).toMatchObject({ ok: false, error: { code: 'bad_request' } });
  });
  it('a malformed body is a bad request', () => {
    const gas = fakeGas({ props, now });
    expect(handle(gas, '{not json')).toMatchObject({ ok: false, error: { code: 'bad_request' } });
    expect(handle(gas, '"a string"')).toMatchObject({ ok: false, error: { code: 'bad_request' } });
  });
  it('an unexpected error becomes a Turkish internal error and the body is never logged', () => {
    const gas = fakeGas({ props, now });
    gas.fetch = () => {
      throw new Error('boom');
    };
    const body = JSON.stringify({ action: 'auth.login', idToken: 'SECRET-TOKEN-VALUE' });
    const res = handle(gas, body);
    expect(res).toMatchObject({ ok: false, error: { code: 'internal', message: 'Beklenmeyen bir hata oldu. Biraz sonra tekrar deneyin.' } });
    expect(gas.logs.join('\n')).toContain('boom');
    expect(gas.logs.join('\n')).not.toContain('SECRET-TOKEN-VALUE');
  });
});
