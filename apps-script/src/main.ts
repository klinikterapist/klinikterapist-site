/// <reference types="google-apps-script" />
/**
 * Web app entry point. The panel POSTs `{ action, session?, ...params }` as text/plain JSON
 * (a CORS simple request); every answer is JSON with HTTP 200. The site's contact form posts
 * `contact.send` and the page counter `stats.hit` the same way, without a session. The site build
 * reads the post read counts with a GET `?action=stats.reads`.
 */
import type { ApiResponse } from '../../src/admin/api/types';
import { realGas, type Gas } from './gas';
import { checkSession, issueSession, logout, verifyIdToken } from './auth';
import { ApiError, INTERNAL_MESSAGE, badRequest, fail, ok } from './respond';
import { commit, read, status, tree } from './github';
import { deleteDraft, getDraft, getImage, getVersion, listDrafts, listVersions, putImage, saveDraft } from './drive';
import { sendContact } from './contact';
import { recordHit, statsReads, statsSummary } from './stats';

type Params = Record<string, unknown>;
type Handler = (gas: Gas, p: Params) => unknown;

/** Actions anyone may call without a session: the contact form, the page counter and read counts. */
export const PUBLIC_ACTIONS: Record<string, Handler> = {
  'contact.send': (gas, p) => sendContact(gas, p),
  'stats.hit': (gas, p) => recordHit(gas, p),
  'stats.reads': (gas) => statsReads(gas),
};

/** Actions that need a valid session. */
export const ACTIONS: Record<string, Handler> = {
  'auth.logout': (gas) => {
    logout(gas);
    return {};
  },
  'site.tree': (gas) => tree(gas),
  'site.read': (gas, p) => read(gas, p),
  'site.commit': (gas, p) => commit(gas, p),
  'site.status': (gas) => status(gas),
  'drafts.list': (gas) => listDrafts(gas),
  'drafts.get': (gas, p) => getDraft(gas, p),
  'drafts.save': (gas, p) => saveDraft(gas, p),
  'drafts.versions': (gas, p) => listVersions(gas, p),
  'drafts.version': (gas, p) => getVersion(gas, p),
  'drafts.delete': (gas, p) => deleteDraft(gas, p),
  'images.put': (gas, p) => putImage(gas, p),
  'images.get': (gas, p) => getImage(gas, p),
  'stats.summary': (gas, p) => statsSummary(gas, p),
};

export function handle(gas: Gas, body: string): ApiResponse {
  let req: Params;
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail(badRequest());
    req = parsed as Params;
  } catch {
    return fail(badRequest());
  }
  const action = String(req.action ?? '');
  try {
    if (action === 'auth.login') {
      const { email } = verifyIdToken(gas, typeof req.idToken === 'string' ? req.idToken : '');
      return ok(issueSession(gas, email));
    }
    if (Object.prototype.hasOwnProperty.call(PUBLIC_ACTIONS, action)) return ok(PUBLIC_ACTIONS[action](gas, req));
    checkSession(gas, req.session);
    const handler = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : undefined;
    if (!handler) return fail(badRequest(`Bilinmeyen işlem: ${action}`));
    return ok(handler(gas, req));
  } catch (e) {
    if (e instanceof ApiError) return fail(e);
    // Log the error only: the request body may hold post text or tokens.
    gas.log(`${action}: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
    return fail(new ApiError('internal', INTERNAL_MESSAGE));
  }
}

export function doPost(e: { postData?: { contents?: string } }) {
  const out = handle(realGas(), e?.postData?.contents ?? '');
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

export function doGet(e?: { parameter?: Record<string, string> }) {
  if (e?.parameter?.action === 'stats.reads') {
    let out: ApiResponse;
    try {
      out = ok(statsReads(realGas()));
    } catch {
      out = fail(new ApiError('internal', INTERNAL_MESSAGE));
    }
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: { service: 'klinikterapist-panel', status: 'çalışıyor' } })).setMimeType(
    ContentService.MimeType.JSON,
  );
}
