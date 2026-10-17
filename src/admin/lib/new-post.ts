/** Starts a new post: creates the empty draft, backs it up locally and returns the editor hash. */
import { writeBackup } from '../ui/editor/useAutosave';
import { newDraft } from './draft';

export function startNewPost(storage: Storage, now: Date): string {
  const d = newDraft(now);
  writeBackup(d, storage);
  return `#/yazi/${d.key}`;
}
