/**
 * Web app entry point. The panel POSTs `{ action, session?, ...params }` as text/plain JSON
 * (a CORS simple request); every answer is JSON with HTTP 200.
 */
import type { ApiResponse } from '../../src/admin/api/types';
import { realGas, type Gas } from './gas';
import { checkSession, issueSession, logout, verifyIdToken } from './auth';
import { ApiError, INTERNAL_MESSAGE, badRequest, fail, ok } from './respond';
import { commit, read, status, tree } from './github';
import { deleteDraft, getDraft, getImage, listDrafts, putImage, saveDraft } from './drive';

type Params = Record<string, unknown>;
type Handler = (gas: Gas, p: Params) => unknown;

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
  'drafts.delete': (gas, p) => deleteDraft(gas, p),
  'images.put': (gas, p) => putImage(gas, p),
  'images.get': (gas, p) => getImage(gas, p),
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

export function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: { service: 'klinikterapist-panel', status: 'çalışıyor' } })).setMimeType(
    ContentService.MimeType.JSON,
  );
}
