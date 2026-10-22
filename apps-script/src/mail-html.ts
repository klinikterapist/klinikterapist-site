/**
 * The HTML part of an e-mail to a person (owner's requests 2026-10-22). The plain text stays as
 * written; in the HTML part
 * - the e-mail check link's own line becomes a button in the site's navy, with the plain address
 *   under it for mail apps that block buttons;
 * - a "→ Label: https://klinikterapist.com/…" line becomes a link button with that label, and a
 *   "■ " line a heading (the information e-mail's questions);
 * - the signature at the end (the name, then "Klinik Psikolog" / "klinikterapist.com" lines) becomes
 *   the logo signature: the sun, name, title, online therapy, site and Instagram, then the wordmark.
 * E-mails with neither (the owner's own notifications) stay plain text only. The images are the
 * site's own files, so a mail app shows them once the visitor allows images.
 */
import { SITE } from './text';
import { VERIFY_PARAM } from './verify';
import { QR_LINE } from '../../src/lib/payment';

const LABEL = { tr: 'E-posta adresimi doğrula', en: 'Confirm my e-mail address' };
const FALLBACK = { tr: 'Düğme çalışmazsa bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:', en: 'If the button does not open, paste this address into your browser:' };
const URL_RE = /https:\/\/[^\s<>"]+/g;

const NAME = 'Osman Güneş Özkurt';
const SIGNATURE_LINES = new Set(['Klinik Psikolog', 'Clinical Psychologist', 'klinikterapist.com', '']);
const INSTAGRAM = 'https://instagram.com/klinikterapist';
const SIGNATURE_TEXT = {
  tr: { title: 'Klinik Psikolog', online: 'Online terapi' },
  en: { title: 'Clinical Psychologist', online: 'Online therapy' },
};

/** Where the signature starts (the last line with the name, followed only by signature lines). */
function signatureAt(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() !== NAME) continue;
    return lines.slice(i + 1).every((l) => SIGNATURE_LINES.has(l.trim())) ? i : -1;
  }
  return -1;
}

/** Turkish letters in the text before the signature (the name has some too) tell a Turkish e-mail. */
const langOf = (text: string, signature: string[]): 'tr' | 'en' =>
  signature.some((l) => l.trim() === 'Clinical Psychologist') ? 'en' : signature.some((l) => l.trim() === 'Klinik Psikolog') ? 'tr' : /[çğıöşüÇĞİÖŞÜ]/.test(text) ? 'tr' : 'en';

function signature(lang: 'tr' | 'en'): string {
  const t = SIGNATURE_TEXT[lang];
  const muted = 'color:#5C5348';
  const link = 'color:#1F2E4A;text-decoration:none';
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 0;border-collapse:collapse"><tr>',
    `<td style="vertical-align:top;padding:2px 12px 0 0"><img src="${SITE}/icons/icon-192.png" width="44" height="44" alt="" style="display:block;border:0"></td>`,
    '<td style="vertical-align:top;padding:0 0 0 12px;border-left:2px solid #F6B92B;font-size:14px;line-height:1.55">',
    `<strong style="font-size:15px;color:#2A2420">${NAME}</strong><br>`,
    `<span style="${muted}">${t.title}</span><br>`,
    `<span style="${muted}">${t.online} · <a href="${SITE}" style="${link}">klinikterapist.com</a></span><br>`,
    `<a href="${INSTAGRAM}" style="${link}">Instagram: @klinikterapist</a>`,
    '</td></tr></table>',
    `<p style="margin:16px 0 0"><img src="${SITE}/admin/logo-black.png" width="150" height="26" alt="klinikterapist" style="display:block;border:0"></p>`,
  ].join('');
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isCheckLink = (line: string) => line.startsWith(`${SITE}/`) && line.includes(`?${VERIFY_PARAM}=`) && !/\s/.test(line);

function button(link: string): string {
  const lang = link.startsWith(`${SITE}/en/`) ? 'en' : 'tr';
  const href = escape(link);
  return [
    '<p style="margin:18px 0 6px">',
    `<a href="${href}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#1F2E4A;color:#FBF3E4;font-weight:bold;text-decoration:none">${LABEL[lang]}</a>`,
    '</p>',
    `<p style="margin:0 0 16px;font-size:12px;color:#5C5348">${FALLBACK[lang]}<br><a href="${href}" style="color:#5C5348;word-break:break-all">${href}</a></p>`,
  ].join('');
}

/** "→ Ön görüşme planlayın: https://klinikterapist.com/…": a link button with that label (the information e-mail). */
const ACTION_RE = /^→ (.{2,60}?): (https:\/\/klinikterapist\.com\/[^\s<>"]*)$/;

function action(label: string, link: string): string {
  const href = escape(link);
  return `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 20px;border-radius:999px;background:#1F2E4A;color:#FBF3E4;font-weight:bold;text-decoration:none">${escape(label)}</a>`;
}

const line = (s: string) => escape(s).replace(URL_RE, (u) => `<a href="${u}" style="color:#1F2E4A">${u}</a>`);

/** "– Label: value" list items: the label in bold. */
const ITEM_RE = /^– (?:([^:]{1,40}?): )?(.+)$/;
const isMarked = (l: string) => l.startsWith('■ ') || ACTION_RE.test(l);

function item(l: string): string {
  const m = ITEM_RE.exec(l)!;
  const label = m[1] && !m[1].includes('http') ? `<strong>${escape(m[1])}:</strong> ` : m[1] ? `${line(m[1])}: ` : '';
  return `<li style="margin:0 0 4px">${label}${line(m[2])}</li>`;
}

const splitLines = (body: string) => body.replace(/\r\n/g, '\n').split('\n');

/** The plain-text part: the QR code line is for the HTML part only. */
export const plainBody = (body: string) => splitLines(body).filter((l) => l.trim() !== QR_LINE).join('\n');

/**
 * `qr`: the payment QR code goes inline as `cid:karekod`. The owner's notifications get an HTML part
 * too once they use headings or buttons.
 */
export function mailHtml(body: string, opts: { qr?: boolean } = {}): string | undefined {
  const lines = splitLines(body);
  const at = signatureAt(lines);
  if (at < 0 && !lines.some((l) => isCheckLink(l.trim()) || isMarked(l.trim()))) return undefined;
  const content = at < 0 ? lines : lines.slice(0, at);
  const blocks = content.join('\n').replace(/\n+$/, '').split(/\n{2,}/);
  const html = blocks.map((block) => {
    const out: string[] = [];
    let kind: 'text' | 'actions' | 'list' | null = null;
    let parts: string[] = [];
    const flush = () => {
      if (kind === 'text') out.push(`<p style="margin:0 0 14px">${parts.join('<br>')}</p>`);
      if (kind === 'actions') out.push(`<p style="margin:4px 0 14px">${parts.join('')}</p>`);
      if (kind === 'list') out.push(`<ul style="margin:0 0 14px;padding-left:20px">${parts.join('')}</ul>`);
      kind = null;
      parts = [];
    };
    const add = (k: 'text' | 'actions' | 'list', part: string) => {
      if (kind !== k) flush();
      kind = k;
      parts.push(part);
    };
    for (const raw of block.split('\n')) {
      const l = raw.trim();
      const a = ACTION_RE.exec(l);
      if (isCheckLink(l)) {
        flush();
        out.push(button(l));
      } else if (l === QR_LINE) {
        flush();
        if (opts.qr) out.push('<p style="margin:4px 0 14px"><img src="cid:karekod" width="180" alt="Ödeme karekodu" style="display:block;border:0;max-width:180px;height:auto"></p>');
      } else if (l.startsWith('■ ')) {
        flush();
        out.push(`<p style="margin:26px 0 8px;font-size:16px;font-weight:bold;color:#1F2E4A">${escape(l.slice(2))}</p>`);
      } else if (a) add('actions', action(a[1], a[2]));
      else if (l.startsWith('– ')) add('list', item(l));
      else add('text', line(raw));
    }
    flush();
    return out.join('');
  });
  const sig = at < 0 ? '' : signature(langOf(content.join('\n'), lines.slice(at)));
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2A2420;max-width:560px">${html.join('')}${sig}</div>`;
}
