import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mailHtml } from '../../../apps-script/src/mail-html';
import { handle } from '../../../apps-script/src/main';
import { fakeGas } from './fake-gas';
import { FakeGitHub } from './fake-github';
import { ghProps } from './publish-fixtures';

const TR_LINK = 'https://klinikterapist.com/on-gorusme/?dogrula=r%3Aabc.def';
const EN_LINK = 'https://klinikterapist.com/en/intro-call/?dogrula=r%3Aabc.def';

describe('e-mails with the e-mail check link get an HTML part with a button (owner, 2026-10-22)', () => {
  it('the link line becomes a button in the page language; the rest stays as written, escaped', () => {
    const html = mailHtml(['Merhaba,', '', 'Talebiniz alındı: <Ön görüşme> & saat.', '', 'Onaylamak için tıklayın:', TR_LINK, '', 'Osman'].join('\n'))!;
    expect(html).toContain(`<a href="${TR_LINK}"`);
    expect(html).toContain('>E-posta adresimi doğrula</a>');
    expect(html).toContain('&lt;Ön görüşme&gt; &amp; saat.');
    expect(html).toContain('<p style=');
    expect(mailHtml(`Hello,\n\n${EN_LINK}`)).toContain('>Confirm my e-mail address</a>');
  });

  it('keeps the plain address under the button for mail apps that block buttons, and links other addresses', () => {
    const html = mailHtml(`Onaylayın:\n${TR_LINK}\n\nSayfanız: https://klinikterapist.com/randevum/#k=x`)!;
    expect(html.split(TR_LINK).length - 1).toBe(3);
    expect(html).toContain('<a href="https://klinikterapist.com/randevum/#k=x"');
  });

  it('e-mails without the check link stay plain text', () => {
    expect(mailHtml('Merhaba,\n\nhttps://klinikterapist.com/admin/#/randevular')).toBeUndefined();
  });

  it("the visitor's acknowledgement from the site carries the button", () => {
    const gh = new FakeGitHub({ 'src/data/booking.json': readFileSync('src/data/booking.json', 'utf8') });
    const gas = fakeGas({ props: { ...ghProps, OWNER_EMAIL: 'merhaba@klinikterapist.com' }, routes: [gh.route], now: Date.parse('2026-10-20T10:00:00+03:00') });
    handle(gas, JSON.stringify({ action: 'booking.request', kind: 'session', type: 'couple', day: '2026-10-22', time: '15:00', name: 'Ayşe Yılmaz', email: 'ayse@example.com', phone: '0532 123 45 67', note: '', consent: true, lang: 'tr' }));
    const visitor = gas.mails[1];
    expect(visitor.body).toContain('aşağıdaki düğmeye tıklayın');
    expect(mailHtml(visitor.body)).toContain('>E-posta adresimi doğrula</a>');
    expect(mailHtml(gas.mails[0].body)).toBeUndefined();
  });
});
