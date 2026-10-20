/**
 * Owner-only sign-in. The panel sends a Google ID token once; we verify it with Google and
 * answer with our own signed session (12 h), which every later request carries.
 */
import type { Gas } from './gas';
import { ApiError } from './respond';
import { sameString } from './text';

export const SESSION_TTL_MS = 12 * 3600 * 1000;
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const NOT_OWNER = 'Bu panel yalnızca site sahibine açıktır. merhaba@klinikterapist.com hesabıyla giriş yapın.';
const EXPIRED = 'Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.';

const unauthorized = (message: string) => new ApiError('unauthorized', message);

export function verifyIdToken(gas: Gas, idToken: string): { email: string } {
  const clientId = gas.props.get('GOOGLE_CLIENT_ID');
  const owner = gas.props.get('OWNER_EMAIL')?.trim().toLowerCase();
  if (!clientId || !owner) throw unauthorized('Panel henüz kurulmadı (GOOGLE_CLIENT_ID / OWNER_EMAIL eksik).');
  if (!idToken) throw unauthorized(NOT_OWNER);

  const res = gas.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (res.code !== 200) throw unauthorized('Google girişi doğrulanamadı. Lütfen yeniden giriş yapın.');
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(res.text);
  } catch {
    throw unauthorized('Google girişi doğrulanamadı. Lütfen yeniden giriş yapın.');
  }
  const email = String(claims.email ?? '').toLowerCase();
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  const exp = Number(claims.exp) * 1000;
  if (
    claims.aud !== clientId ||
    !ISSUERS.has(String(claims.iss)) ||
    !verified ||
    !(exp > gas.now()) ||
    email !== owner
  ) {
    throw unauthorized(NOT_OWNER);
  }
  return { email };
}

function secret(gas: Gas): string {
  let s = gas.props.get('SESSION_SECRET');
  if (!s) {
    s = (gas.uuid() + gas.uuid()).replace(/-/g, '');
    gas.props.set('SESSION_SECRET', s);
  }
  return s;
}

const version = (gas: Gas) => Number(gas.props.get('SESSION_VERSION') ?? '0');

export function issueSession(gas: Gas, email: string): { session: string; email: string; expiresAt: number } {
  const expiresAt = gas.now() + SESSION_TTL_MS;
  const payload = gas.b64url.encode(JSON.stringify({ email, exp: expiresAt, ver: version(gas) }));
  return { session: `${payload}.${gas.hmac(secret(gas), payload)}`, email, expiresAt };
}

export function checkSession(gas: Gas, session: unknown): void {
  if (typeof session !== 'string') throw unauthorized(EXPIRED);
  const [payload, sig, extra] = session.split('.');
  if (!payload || !sig || extra !== undefined || !sameString(sig, gas.hmac(secret(gas), payload))) throw unauthorized(EXPIRED);
  let data: { email?: unknown; exp?: unknown; ver?: unknown };
  try {
    data = JSON.parse(gas.b64url.decode(payload));
  } catch {
    throw unauthorized(EXPIRED);
  }
  const owner = gas.props.get('OWNER_EMAIL')?.trim().toLowerCase();
  if (data.email !== owner || typeof data.exp !== 'number' || data.exp <= gas.now() || data.ver !== version(gas)) {
    throw unauthorized(EXPIRED);
  }
}

/** Signs out everywhere: every session issued so far stops working. */
export function logout(gas: Gas): void {
  gas.props.set('SESSION_VERSION', String(version(gas) + 1));
}
