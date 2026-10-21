/**
 * The HTML part of an e-mail to a person (owner's requests 2026-10-22). The plain text stays as
 * written; in the HTML part
 * - the e-mail check link's own line becomes a button in the site's navy, with the plain address
 *   under it for mail apps that block buttons;
 * - the signature at the end (the name, then "Klinik Psikolog" / "klinikterapist.com" lines) becomes
 *   the logo signature: the sun, name, title, online therapy, site and Instagram, then the wordmark.
 * E-mails with neither (the owner's own notifications) stay plain text only. The images are the
 * site's own files, so a mail app shows them once the visitor allows images.
 */
import { SITE } from './text';
import { VERIFY_PARAM } from './verify';

const LABEL = { tr: 'E-posta adresimi doğrula', en: 'Confirm my e-mail address' };
const FALLBACK = { tr: 'Düğme açılmazsa bu adresi tarayıcınıza yapıştırın:', en: 'If the button does not open, paste this address into your browser:' };
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

const line = (s: string) => escape(s).replace(URL_RE, (u) => `<a href="${u}" style="color:#1F2E4A">${u}</a>`);

export function mailHtml(body: string): string | undefined {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const at = signatureAt(lines);
  if (at < 0 && !lines.some((l) => isCheckLink(l.trim()))) return undefined;
  const content = at < 0 ? lines : lines.slice(0, at);
  const blocks = content.join('\n').replace(/\n+$/, '').split(/\n{2,}/);
  const html = blocks.map((block) => {
    const out: string[] = [];
    let text: string[] = [];
    const flush = () => {
      if (text.length) out.push(`<p style="margin:0 0 14px">${text.join('<br>')}</p>`);
      text = [];
    };
    for (const raw of block.split('\n')) {
      const l = raw.trim();
      if (isCheckLink(l)) {
        flush();
        out.push(button(l));
      } else text.push(line(raw));
    }
    flush();
    return out.join('');
  });
  const sig = at < 0 ? '' : signature(langOf(content.join('\n'), lines.slice(at)));
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2A2420;max-width:560px">${html.join('')}${sig}</div>`;
}
