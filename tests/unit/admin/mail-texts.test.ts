import { afterEach, describe, it, expect } from 'vitest';
import { setMailTexts } from '../../../src/lib/mail-texts';
import { MAIL_CATALOG, defaultTemplate } from '../../../src/admin/lib/mail-catalog';
import { revertMail } from '../../../src/admin/lib/booking-mail';
import { thanksMail } from '../../../src/lib/payment';

afterEach(() => setMailTexts({}));

describe('the owner’s e-mail wording (E-posta Ayarları)', () => {
  it('a built-in e-mail becomes a template with placeholders', () => {
    const t = defaultTemplate(MAIL_CATALOG.find((e) => e.id === 'talep.onay.seans')!, 'tr');
    expect(t.body).toContain('Sayın {ad},');
    expect(t.body).toContain('{zaman}');
    expect(t.body).toContain('{kural}');
    expect(t.body).toContain('{imza}');
    expect(t.body).not.toContain('Ayşe Örnek');
  });

  it('a saved template fills in the facts; the other e-mails keep the built-in text', () => {
    setMailTexts({ templates: { 'danisan.geri-al': { tr: { subject: 'Düzeltme', body: 'Merhaba {ad},\n\nKüçük bir hata oldu.\n\n{imza}' } } } });
    expect(revertMail({ name: 'Ece', lang: 'tr' })).toEqual({ subject: 'Düzeltme', body: 'Merhaba Ece,\n\nKüçük bir hata oldu.\n\nOsman Güneş Özkurt\nKlinik Psikolog\nklinikterapist.com' });
    expect(revertMail({ name: 'Ece', lang: 'en' }).subject).toBe('Correction to my previous e-mail – klinikterapist.com');
  });

  it('a new signature and thank-you sentences reach the built-in e-mails', () => {
    setMailTexts({ signature: { tr: 'Güneş\nklinikterapist.com', en: '' }, motivation: { tr: ['Tek cümle.'], en: [] } });
    const m = thanksMail({ name: 'Ece', lang: 'tr' }, { day: '2026-11-12', time: '18:00' });
    expect(m.body).toContain('Tek cümle.');
    expect(m.body).toContain('Saygılarımla,\nGüneş\nklinikterapist.com');
    expect(m.body).not.toContain('Klinik Psikolog');
  });

  it('every entry of the catalogue has a sample in both languages', () => {
    for (const e of MAIL_CATALOG) for (const lang of ['tr', 'en'] as const) expect(e.sample(lang).body.length).toBeGreaterThan(20);
  });
});
