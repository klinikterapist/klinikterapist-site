/**
 * The HTML part of an e-mail that carries the e-mail check link (owner's request 2026-10-22: "a
 * button, click to confirm your address"). The plain text stays as written; in the HTML part the
 * link's own line becomes a button in the site's navy, with the plain address under it for mail
 * apps that block buttons. E-mails without the link stay plain text only.
 */
import { SITE } from './text';
import { VERIFY_PARAM } from './verify';

const LABEL = { tr: 'E-posta adresimi doğrula', en: 'Confirm my e-mail address' };
const FALLBACK = { tr: 'Düğme açılmazsa bu adresi tarayıcınıza yapıştırın:', en: 'If the button does not open, paste this address into your browser:' };
const URL_RE = /https:\/\/[^\s<>"]+/g;

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
  if (!body.split('\n').some((l) => isCheckLink(l.trim()))) return undefined;
  const blocks = body.replace(/\r\n/g, '\n').split(/\n{2,}/);
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
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2A2420;max-width:560px">${html.join('')}</div>`;
}
