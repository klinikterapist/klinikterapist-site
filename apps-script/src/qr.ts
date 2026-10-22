/**
 * The payment QR code (owner's request 2026-10-22): one image in the panel's Drive folder, set in
 * Ücret ve ödeme. E-mails with the payment details carry it inline in their HTML part.
 */
import type { Gas } from './gas';
import { badRequest } from './respond';

const NAMES = { png: 'odeme-karekod.png', jpg: 'odeme-karekod.jpg' } as const;
const DATA_RE = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+=*)$/;
/** About 150 KB of image. */
const MAX_BASE64 = 200_000;

/** The stored image as a data URL, '' when there is none. */
export function readQr(gas: Gas): string {
  const root = gas.drive.rootFolder();
  for (const [ext, name] of Object.entries(NAMES)) {
    const f = root.findFile(name);
    if (f) return `data:image/${ext === 'jpg' ? 'jpeg' : 'png'};base64,${f.read()}`;
  }
  return '';
}

/** A data URL replaces the image, '' removes it. */
export function saveQr(gas: Gas, dataUrl: string): void {
  const m = dataUrl ? DATA_RE.exec(dataUrl) : null;
  if (dataUrl && (!m || m[2].length > MAX_BASE64)) throw badRequest('Karekod görseli PNG ya da JPG olmalı ve 150 KB\'ı geçmemeli.');
  gas.withLock(() => {
    const root = gas.drive.rootFolder();
    for (const name of Object.values(NAMES)) root.findFile(name)?.trash();
    if (m) root.createFile(m[1] === 'png' ? NAMES.png : NAMES.jpg, m[2], 'image');
  });
}
