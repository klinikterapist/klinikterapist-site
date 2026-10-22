import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mailHtml, plainBody } from '../../../apps-script/src/mail-html';
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

  it('"→ Label: site address" lines become link buttons; neighbouring ones share a row; other sites stay plain links', () => {
    const html = mailHtml(['Merhaba,', '', 'Yanıt.', '→ Aydınlatma metnini okuyun: https://klinikterapist.com/aydinlatma-metni/', '', '→ Ön görüşme <planlayın>: https://klinikterapist.com/on-gorusme/', '→ Randevu alın: https://klinikterapist.com/randevu/', '→ Başka: https://example.com/', '', 'Osman Güneş Özkurt', 'klinikterapist.com'].join('\n'))!;
    expect(html).toContain('<p style="margin:0 0 14px">Yanıt.</p><p style="margin:4px 0 14px"><a href="https://klinikterapist.com/aydinlatma-metni/"');
    expect(html).toContain('>Aydınlatma metnini okuyun</a>');
    expect(html).toContain('>Ön görüşme &lt;planlayın&gt;</a><a href="https://klinikterapist.com/randevu/"');
    expect(html).toContain('→ Başka: <a href="https://example.com/"');
  });

  it('"– Label: value" lines become a list with bold labels; the QR line becomes the inline image, or nothing', () => {
    const body = ['Sayın Ayşe,', '', '■ Ödeme bilgileri', '– IBAN: TR00 1', '– Hesap sahibi: <Ad>', '– düz madde', '[karekod]', '', 'Osman Güneş Özkurt', 'klinikterapist.com'].join('\n');
    const html = mailHtml(body, { qr: true })!;
    expect(html).toContain('>Ödeme bilgileri</p><ul style="margin:0 0 14px;padding-left:20px"><li style="margin:0 0 4px"><strong>IBAN:</strong> TR00 1</li>');
    expect(html).toContain('<strong>Hesap sahibi:</strong> &lt;Ad&gt;</li><li style="margin:0 0 4px">düz madde</li></ul>');
    expect(html).toContain('<img src="cid:karekod"');
    expect(mailHtml(body)).not.toContain('karekod');
    expect(plainBody(body)).not.toContain('[karekod]');
    expect(plainBody(body)).toContain('– düz madde');
  });

  it("the owner's notifications get an HTML part once they use headings or buttons", () => {
    expect(mailHtml('■ Yeni talep\n– Ad: Ayşe\n\n→ Randevu Talepleri: https://klinikterapist.com/admin/#/randevular')).toContain('>Randevu Talepleri</a>');
  });

  it("e-mails without the check link or the signature stay plain text (the owner's notifications)", () => {
    expect(mailHtml('Merhaba,\n\nhttps://klinikterapist.com/admin/#/randevular')).toBeUndefined();
  });

  it('the signature at the end becomes the logo signature: sun, name, title, online therapy, site, Instagram, wordmark', () => {
    const html = mailHtml(['Sayın Ayşe,', '', 'Seansınız onaylandı.', '', 'Görüşmek üzere,', 'Osman Güneş Özkurt', 'Klinik Psikolog', 'klinikterapist.com'].join('\n'))!;
    expect(html).toContain('Görüşmek üzere,');
    expect(html).toContain('src="https://klinikterapist.com/icons/icon-192.png"');
    expect(html).toContain('src="https://klinikterapist.com/admin/logo-black.png"');
    expect(html).toContain('>Osman Güneş Özkurt</');
    expect(html).toContain('Online terapi');
    expect(html).toContain('href="https://klinikterapist.com"');
    expect(html).toContain('href="https://instagram.com/klinikterapist"');
    // The plain lines are replaced, not repeated.
    expect(html.split('Klinik Psikolog').length - 1).toBe(1);
    const en = mailHtml(['Kind regards,', 'Osman Güneş Özkurt', 'Clinical Psychologist', 'klinikterapist.com'].join('\n'))!;
    expect(en).toContain('Clinical Psychologist');
    expect(en).toContain('Online therapy');
  });

  it("the short fixed signature (name and site) gets the same block; English is told by the e-mail's words", () => {
    const tr = mailHtml(['Merhaba,', '', 'Talebiniz alındı.', '', 'Osman Güneş Özkurt', 'klinikterapist.com'].join('\n'))!;
    expect(tr).toContain('Klinik Psikolog');
    const en = mailHtml(['Hello,', '', 'Your request has been received.', '', 'Osman Güneş Özkurt', 'klinikterapist.com'].join('\n'))!;
    expect(en).toContain('Clinical Psychologist');
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
