/**
 * Files attached to an e-mail the owner writes to a client (owner's review 2026-10-23: homework sheets,
 * readings). The panel reads them as base64; Apps Script checks them again with `parseAttachments` and
 * sends them with the e-mail. Kept small: Gmail's own limit is 25 MB, and the request carries base64.
 * Shared by the panel and Apps Script, so no imports.
 */
export type Attachment = { name: string; type: string; data: string };

export const ATTACH_LIMITS = {
  count: 5,
  /** Total size of the files (not of their base64). */
  bytes: 10_000_000,
  types: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
};

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/** The attachments as sent, or null when there are none; throws a message for the owner when one is not allowed. */
export function parseAttachments(v: unknown): Attachment[] | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) throw new Error('Ekler okunamadı.');
  if (!v.length) return null;
  if (v.length > ATTACH_LIMITS.count) throw new Error(`En çok ${ATTACH_LIMITS.count} dosya eklenebilir.`);
  let bytes = 0;
  const out: Attachment[] = [];
  for (const a of v) {
    const o = a && typeof a === 'object' ? (a as Record<string, unknown>) : {};
    const name = typeof o.name === 'string' ? o.name.replace(/[\r\n\\/]+/g, ' ').trim().slice(0, 150) : '';
    const type = typeof o.type === 'string' ? o.type : '';
    const data = typeof o.data === 'string' ? o.data : '';
    if (!name || !ATTACH_LIMITS.types.includes(type) || !data || !BASE64_RE.test(data)) throw new Error('Eklerden biri bu türde gönderilemiyor.');
    bytes += Math.floor((data.length * 3) / 4);
    out.push({ name, type, data });
  }
  if (bytes > ATTACH_LIMITS.bytes) throw new Error('Eklerin toplamı çok büyük (en çok 10 MB).');
  return out;
}
