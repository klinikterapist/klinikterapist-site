import { describe, it, expect } from 'vitest';
import { checkSession, issueSession, logout, verifyIdToken } from '../../../apps-script/src/auth';
import { ApiError } from '../../../apps-script/src/respond';
import { fakeGas, json } from './fake-gas';

const CLIENT = 'client-123.apps.googleusercontent.com';
const props = { GOOGLE_CLIENT_ID: CLIENT, OWNER_EMAIL: 'merhaba@klinikterapist.com' };
const now = Date.UTC(2026, 9, 17, 12);

function tokeninfo(claims: Record<string, unknown>, code = 200) {
  return (url: string) =>
    url.startsWith('https://oauth2.googleapis.com/tokeninfo?id_token=')
      ? json(code, {
          aud: CLIENT,
          iss: 'https://accounts.google.com',
          email: 'merhaba@klinikterapist.com',
          email_verified: 'true',
          exp: String(Math.floor(now / 1000) + 600),
          ...claims,
        })
      : undefined;
}

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ApiError ? e.code : `not ApiError: ${e}`;
  }
  return 'no error';
};

describe('verifyIdToken', () => {
  it('accepts the owner, ignoring e-mail case', () => {
    const gas = fakeGas({ props, now, routes: [tokeninfo({ email: 'MERHABA@klinikterapist.com' })] });
    expect(verifyIdToken(gas, 'tok')).toEqual({ email: 'merhaba@klinikterapist.com' });
    expect(gas.calls[0].url).toContain('id_token=tok');
  });
  it.each([
    ['a token for another client', { aud: 'other' }],
    ['an expired token', { exp: String(Math.floor(now / 1000) - 1) }],
    ['an unverified e-mail', { email_verified: 'false' }],
    ['another account', { email: 'someone@gmail.com' }],
    ['a foreign issuer', { iss: 'https://evil.example' }],
  ])('rejects %s', (_name, claims) => {
    const gas = fakeGas({ props, now, routes: [tokeninfo(claims)] });
    expect(code(() => verifyIdToken(gas, 'tok'))).toBe('unauthorized');
  });
  it('rejects when Google says the token is invalid', () => {
    const gas = fakeGas({ props, now, routes: [tokeninfo({}, 400)] });
    expect(code(() => verifyIdToken(gas, 'tok'))).toBe('unauthorized');
  });
  it('rejects an empty token without calling Google', () => {
    const gas = fakeGas({ props, now, routes: [tokeninfo({})] });
    expect(code(() => verifyIdToken(gas, ''))).toBe('unauthorized');
    expect(gas.calls).toHaveLength(0);
  });
  it('refuses to run unconfigured', () => {
    const gas = fakeGas({ props: {}, now, routes: [tokeninfo({})] });
    expect(code(() => verifyIdToken(gas, 'tok'))).toBe('unauthorized');
  });
});

describe('sessions', () => {
  it('a fresh session is valid for 12 hours', () => {
    const gas = fakeGas({ props, now });
    const s = issueSession(gas, 'merhaba@klinikterapist.com');
    expect(s.expiresAt).toBe(now + 12 * 3600 * 1000);
    expect(() => checkSession(gas, s.session)).not.toThrow();
    gas.clock.now = s.expiresAt + 1;
    expect(code(() => checkSession(gas, s.session))).toBe('unauthorized');
  });
  it('a tampered session is rejected', () => {
    const gas = fakeGas({ props, now });
    const { session } = issueSession(gas, 'merhaba@klinikterapist.com');
    const [payload, sig] = session.split('.');
    const forged = Buffer.from(JSON.stringify({ email: 'merhaba@klinikterapist.com', exp: now + 1e12, ver: 0 })).toString('base64url');
    expect(code(() => checkSession(gas, `${forged}.${sig}`))).toBe('unauthorized');
    expect(code(() => checkSession(gas, `${payload}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`))).toBe('unauthorized');
    expect(code(() => checkSession(gas, 'garbage'))).toBe('unauthorized');
    expect(code(() => checkSession(gas, ''))).toBe('unauthorized');
  });
  it('logout invalidates every session', () => {
    const gas = fakeGas({ props, now });
    const a = issueSession(gas, 'merhaba@klinikterapist.com');
    logout(gas);
    expect(code(() => checkSession(gas, a.session))).toBe('unauthorized');
    const b = issueSession(gas, 'merhaba@klinikterapist.com');
    expect(() => checkSession(gas, b.session)).not.toThrow();
  });
  it('the signing secret is created once and kept', () => {
    const gas = fakeGas({ props, now });
    issueSession(gas, 'merhaba@klinikterapist.com');
    const secret = gas.props.get('SESSION_SECRET');
    expect(secret?.length).toBeGreaterThanOrEqual(64);
    issueSession(gas, 'merhaba@klinikterapist.com');
    expect(gas.props.get('SESSION_SECRET')).toBe(secret);
  });
});
