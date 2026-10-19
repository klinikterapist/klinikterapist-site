/**
 * The panel's publish flow (`publishDraft`) needs an `Api`. Inside the backend that is this thin
 * adapter over the same functions the web actions call, so the hourly scheduled publish takes the
 * exact path the Yayınla button takes.
 */
import { ApiFailure } from '../../src/admin/api/types';
import type { PublishApi } from '../../src/admin/lib/publish-flow';
import type { Gas } from './gas';
import { commit, read, snapshot } from './github';
import { deleteDraft, getImage, putImage } from './drive';
import { ApiError } from './respond';

/** Runs a backend call as the panel would see it: a promise, with `ApiError` turned into `ApiFailure`. */
function call<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e instanceof ApiError ? new ApiFailure(e.code, e.message, e.data) : e);
  }
}

export function serverApi(gas: Gas): PublishApi {
  return {
    snapshot: () => call(() => snapshot(gas)),
    read: (paths) => call(() => read(gas, { paths })),
    commit: (input) => call(() => commit(gas, input)),
    getImage: (key, name) => call(() => getImage(gas, { key, name })),
    putImage: (key, name, base64) => call(() => void putImage(gas, { key, name, base64 })),
    deleteDraft: (key, opts) => call(() => void deleteDraft(gas, { key, trash: opts?.trash })),
  };
}
