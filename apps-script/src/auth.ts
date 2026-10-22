/**
 * Owner-only sign-in, two locks (owner's decision 2026-10-22): first the panel's own user name and
 * password (`auth.password`, answered with a 10-minute step token), then a Google ID token
 * (`auth.login`), which we verify with Google and answer with our own signed session (12 h) that
 * every later request carries. Until a password is set (`auth.start` says so) Google alone signs
 * in and the panel asks for one at once. No message names the owner's account.
 */
import type { Gas } from './gas';
import { notifyTo, noticeFrom } from './mailboxes';
import { ApiError, badRequest } from './respond';
import { PANEL_URL, sameString, str } from './text';

export const SESSION_TTL_MS = 12 * 3600 * 1000;
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const NOT_OWNER = 'Bu panel yalnızca site sahibine açıktır. Site sahibinin Google hesabıyla giriş yapın.';
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

/* ---- The password lock ---- */

/** Script property with `{ user, salt, hash }`; delete it in the Apps Script editor to set a new password from the panel. */
const LOGIN_KEY = 'PANEL_LOGIN';
/** Script property with `{ count, until }`: wrong tries in a row and the end of a lock. */
const FAILS_KEY = 'PANEL_LOGIN_FAILS';
export const MAX_FAILS = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const STEP_TTL_MS = 10 * 60 * 1000;
const ROUNDS = 1000;
export const MIN_PASSWORD = 10;

const WRONG = 'Kullanıcı adı ya da şifre yanlış.';
const LOCKED = 'Çok fazla yanlış deneme yapıldı. Güvenliğiniz için giriş 15 dakika kapalı; sonra tekrar deneyin.';
const NO_STEP = 'Önce kullanıcı adınızı ve şifrenizi girin.';

type Stored = { user: string; salt: string; hash: string };

function stored(gas: Gas): Stored | null {
  try {
    const v = JSON.parse(gas.props.get(LOGIN_KEY) ?? 'null') as Stored | null;
    return v && typeof v.user === 'string' && typeof v.salt === 'string' && typeof v.hash === 'string' ? v : null;
  } catch {
    return null;
  }
}

export const passwordSet = (gas: Gas) => stored(gas) !== null;

/** Salted and stretched, so the stored value never gives the password back. */
function hashOf(gas: Gas, salt: string, password: string): string {
  let h = gas.hmac(salt, password);
  for (let i = 1; i < ROUNDS; i++) h = gas.hmac(salt, h + password);
  return h;
}

const normUser = (u: string) => u.trim().toLowerCase();

/** Throws while locked; counts a wrong answer, and the fifth in a row locks sign-in and e-mails the owner. */
function guarded(gas: Gas, user: string, password: string): void {
  gas.withLock(() => {
    const now = gas.now();
    let fails: { count: number; until: number };
    try {
      fails = { count: 0, until: 0, ...JSON.parse(gas.props.get(FAILS_KEY) ?? '{}') };
    } catch {
      fails = { count: 0, until: 0 };
    }
    if (fails.until > now) throw unauthorized(LOCKED);
    const s = stored(gas);
    const right = !!s && sameString(normUser(user), s.user) && sameString(hashOf(gas, s.salt, password), s.hash);
    if (right) {
      if (fails.count || fails.until) gas.props.del(FAILS_KEY);
      return;
    }
    fails.count++;
    if (fails.count >= MAX_FAILS) {
      gas.props.set(FAILS_KEY, JSON.stringify({ count: 0, until: now + LOCK_MS }));
      warnOwner(gas);
      throw unauthorized(LOCKED);
    }
    gas.props.set(FAILS_KEY, JSON.stringify(fails));
    throw unauthorized(WRONG);
  });
}

function warnOwner(gas: Gas): void {
  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) return;
  try {
    gas.mail.send({
      ...noticeFrom(gas), to: notifyTo(gas, owner),
      replyTo: owner,
      name: 'Panel Güvenliği',
      subject: 'Panel girişinde art arda yanlış şifre',
      body: [
        `Yönetim paneline (${PANEL_URL}) art arda ${MAX_FAILS} kez yanlış kullanıcı adı ya da şifreyle girilmeye çalışıldı.`,
        'Giriş 15 dakika kapatıldı. Şifre doğru girilse bile panele girmek için ayrıca Google hesabınız gerekir.',
        '',
        'Bu denemeleri siz yapmadıysanız panelde Ayarlar > Giriş bilgileri bölümünden şifrenizi değiştirin.',
      ].join('\n'),
    });
  } catch (e) {
    gas.log(`auth/warn: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const stepSig = (gas: Gas, payload: string) => gas.hmac(secret(gas), `step:${payload}`);

/** `auth.start` (public): whether the first lock is on. */
export const loginStart = (gas: Gas) => ({ password: passwordSet(gas) });

/** `auth.password` (public): the first lock. Answers with a short-lived step token for `auth.login`. */
export function checkPassword(gas: Gas, p: Record<string, unknown>): { step: string } {
  if (!passwordSet(gas)) throw badRequest('Panel şifresi henüz belirlenmedi. Sayfayı yenileyin.');
  guarded(gas, str(p.username), str(p.password));
  const payload = gas.b64url.encode(JSON.stringify({ step: 'pw', exp: gas.now() + STEP_TTL_MS }));
  return { step: `${payload}.${stepSig(gas, payload)}` };
}

/** Before the Google check of `auth.login`: once a password is set, a fresh step token is required. */
export function checkStep(gas: Gas, step: unknown): void {
  if (!passwordSet(gas)) return;
  const [payload, sig, extra] = typeof step === 'string' ? step.split('.') : [];
  if (!payload || !sig || extra !== undefined || !sameString(sig, stepSig(gas, payload))) throw unauthorized(NO_STEP);
  let data: { step?: unknown; exp?: unknown };
  try {
    data = JSON.parse(gas.b64url.decode(payload));
  } catch {
    throw unauthorized(NO_STEP);
  }
  if (data.step !== 'pw' || typeof data.exp !== 'number' || data.exp <= gas.now()) throw unauthorized(NO_STEP);
}

/** `auth.setPassword` (session): sets the user name and password; changing them asks for the current password. */
export function setPassword(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  const user = normUser(str(p.username));
  const password = str(p.password);
  if (user.length < 3) throw badRequest('Kullanıcı adı en az 3 karakter olmalı.');
  if (password.length < MIN_PASSWORD) throw badRequest(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`);
  if (normUser(password) === user) throw badRequest('Şifre kullanıcı adıyla aynı olamaz.');
  const old = stored(gas);
  if (old) guarded(gas, old.user, str(p.current));
  const salt = gas.uuid().replace(/-/g, '');
  gas.props.set(LOGIN_KEY, JSON.stringify({ user, salt, hash: hashOf(gas, salt, password) }));
  return {};
}
