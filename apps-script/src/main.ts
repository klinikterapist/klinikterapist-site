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
import { commit, read, snapshot, status, tree } from './github';
import { deleteDraft, getDraft, getImage, getVersion, listDrafts, listTrash, listVersions, purgeTrash, putImage, restoreTrash, saveDraft } from './drive';
import { sendContact } from './contact';
import { bookingBusy, config as bookingConfig, sendBooking, verifyEmail } from './booking';
import { addConfirmed, listEntries, removeEntry } from './calendar';
import { addManual, assertFree, changeSession, decideRequest, endClient, holdFor, listClients, listRequests, requestToClient, revertClient, revertRequest, warnExpiringHolds } from './requests';
import { bookingState, joinWaitlist, listWaitlist, mailWaitlist, removeWaitlist, setOpen } from './waitlist';
import { askTracking, clientLink, mailClientLink, viewTracking } from './tracking';
import { recordHit, statsReads, statsSummary } from './stats';
import { runScheduled } from './schedule';

type Params = Record<string, unknown>;
type Handler = (gas: Gas, p: Params) => unknown;

/** Actions anyone may call without a session: the forms, the client's page, the page counter and read counts. */
export const PUBLIC_ACTIONS: Record<string, Handler> = {
  'contact.send': (gas, p) => sendContact(gas, p),
  'booking.request': (gas, p) => sendBooking(gas, p),
  'booking.waitlist': (gas, p) => joinWaitlist(gas, p),
  'booking.verify': (gas, p) => verifyEmail(gas, p),
  'track.view': (gas, p) => viewTracking(gas, p),
  'track.ask': (gas, p) => {
    const out = askTracking(gas, p);
    gas.cache.put('booking.busy', '', 1);
    return out;
  },
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
  'site.snapshot': (gas) => snapshot(gas),
  'site.commit': (gas, p) => commit(gas, p),
  'site.status': (gas) => status(gas),
  'drafts.list': (gas) => listDrafts(gas),
  'drafts.get': (gas, p) => getDraft(gas, p),
  'drafts.save': (gas, p) => saveDraft(gas, p),
  'drafts.versions': (gas, p) => listVersions(gas, p),
  'drafts.version': (gas, p) => getVersion(gas, p),
  'drafts.delete': (gas, p) => deleteDraft(gas, p),
  'trash.list': (gas) => listTrash(gas),
  'trash.restore': (gas, p) => restoreTrash(gas, p),
  'trash.purge': (gas, p) => purgeTrash(gas, p),
  'images.put': (gas, p) => putImage(gas, p),
  'images.get': (gas, p) => getImage(gas, p),
  'stats.summary': (gas, p) => statsSummary(gas, p),
  'calendar.list': (gas) => listEntries(gas),
  'calendar.add': (gas, p) => {
    const cfg = bookingConfig(gas);
    // One lock for the check and the write (the lock is re-entrant).
    const out = gas.withLock(() => {
      assertFree(gas, cfg, holdFor(cfg, p.day, p.time, p.kind === 'intro' ? 'intro' : 'session', typeof p.type === 'string' ? p.type : undefined));
      return addConfirmed(gas, cfg, p);
    });
    gas.cache.put('booking.busy', '', 1);
    return out;
  },
  'calendar.remove': (gas, p) => {
    removeEntry(gas, p);
    gas.cache.put('booking.busy', '', 1);
    return {};
  },
  'requests.list': (gas) => listRequests(gas),
  'requests.decide': (gas, p) => {
    const out = decideRequest(gas, bookingConfig(gas), p);
    gas.cache.put('booking.busy', '', 1);
    return out;
  },
  'requests.toClient': (gas, p) => {
    const out = requestToClient(gas, bookingConfig(gas), p);
    gas.cache.put('booking.busy', '', 1);
    return out;
  },
  'requests.revert': (gas, p) => {
    const out = revertRequest(gas, bookingConfig(gas), p);
    gas.cache.put('booking.busy', '', 1);
    return out;
  },
  'clients.list': (gas) => listClients(gas),
  'clients.end': (gas, p) => {
    const out = endClient(gas, p);
    gas.cache.put('booking.busy', '', 1);
    return out;
  },
  'clients.revert': (gas, p) => {
    const out = revertClient(gas, bookingConfig(gas), p);
    gas.cache.put('booking.busy', '', 1);
    return out;
  },
  'clients.session': (gas, p) => {
    const out = changeSession(gas, bookingConfig(gas), p);
    gas.cache.put('booking.busy', '', 1);
    return out;
  },
  'clients.link': (gas, p) => clientLink(gas, p),
  'clients.linkMail': (gas, p) => mailClientLink(gas, p),
  'requests.add': (gas, p) => {
    const out = addManual(gas, bookingConfig(gas), p);
    gas.cache.put('booking.busy', '', 1);
    return out;
  },
  'booking.state': (gas) => bookingState(gas),
  'booking.setOpen': (gas, p) => setOpen(gas, p),
  'waitlist.list': (gas) => listWaitlist(gas),
  'waitlist.mail': (gas, p) => mailWaitlist(gas, p),
  'waitlist.remove': (gas, p) => removeWaitlist(gas, p),
  'admin.triggers': (gas) => {
    gas.triggers.ensureHourly('hourly');
    return {};
  },
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

/**
 * The hourly time-driven trigger: publishes the planned drafts that are due. Errors are logged
 * without any draft text; the draft keeps its plan and the next hour tries again.
 */
export async function runHourly(gas: Gas): Promise<void> {
  try {
    await runScheduled(gas, new Date(gas.now()));
  } catch (e) {
    gas.log(`hourly/schedule: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    warnExpiringHolds(gas);
  } catch (e) {
    gas.log(`hourly/holds: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function hourly() {
  return runHourly(realGas());
}

export function doGet(e?: { parameter?: Record<string, string> }) {
  if (e?.parameter?.action === 'booking.busy') {
    let out: ApiResponse;
    try {
      out = ok(bookingBusy(realGas()));
    } catch {
      out = fail(new ApiError('internal', INTERNAL_MESSAGE));
    }
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  }
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
