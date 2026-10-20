/**
 * The appointment files in the owner's Drive (`Klinikterapist Panel/randevular/`) that hold people's
 * details: requests, clients and the "Haber et" list. Each is `{ sealed }` (seal.ts) around
 * `{ items }`; an older plain `{ items }` file is still read.
 */
import type { FolderLike, Gas } from './gas';
import { ApiError } from './respond';
import { seal, unseal } from './seal';

const FOLDER = 'randevular';

function folder(gas: Gas): FolderLike {
  const root = gas.drive.rootFolder();
  return root.findFolder(FOLDER) ?? root.createFolder(FOLDER);
}

export function readItems<T>(gas: Gas, name: string): T[] {
  const file = gas.drive.rootFolder().findFolder(FOLDER)?.findFile(name);
  if (!file) return [];
  let v: { items?: T[]; sealed?: string };
  try {
    v = JSON.parse(file.read()) as typeof v;
  } catch {
    return [];
  }
  if (typeof v.sealed === 'string') {
    const text = unseal(gas, v.sealed);
    // Never treat an unreadable file as empty: the next write would wipe it.
    if (text === null) throw new ApiError('internal', 'Randevu dosyası açılamadı (şifre anahtarı uyuşmuyor). Dosyaya dokunmadan destek isteyin.');
    v = JSON.parse(text) as typeof v;
  }
  return Array.isArray(v.items) ? v.items : [];
}

export function writeItems<T>(gas: Gas, name: string, items: T[]): void {
  const f = folder(gas);
  const text = JSON.stringify({ sealed: seal(gas, JSON.stringify({ items })) });
  const file = f.findFile(name);
  if (file) file.write(text);
  else f.createFile(name, text, 'json');
}
