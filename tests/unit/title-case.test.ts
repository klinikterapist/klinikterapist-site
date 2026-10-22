import { describe, expect, it } from 'vitest';
import { titleCase, titleCaseHeadings } from '../../src/lib/title-case';

describe('titleCase', () => {
  it('capitalises every word in Turkish, with İ for i, and keeps joining words small', () => {
    expect(titleCase('bu işi neden yapıyorum?', 'tr')).toBe('Bu İşi Neden Yapıyorum?');
    expect(titleCase('eğitimler ve sertifikalar', 'tr')).toBe('Eğitimler ve Sertifikalar');
    expect(titleCase('ve sonra', 'tr')).toBe('Ve Sonra');
    expect(titleCase("Instagram'da paylaş", 'tr')).toBe("Instagram'da Paylaş");
    expect(titleCase('ilk görüşme', 'tr')).toBe('İlk Görüşme');
  });

  it('leaves the rest of a word and the brand name as written', () => {
    expect(titleCase('klinikterapist nedir?', 'tr')).toBe('klinikterapist Nedir?');
    expect(titleCase('bilişsel davranışçı terapi (BDT)', 'tr')).toBe('Bilişsel Davranışçı Terapi (BDT)');
    expect(titleCase('“yapay zeka” üzerine', 'tr')).toBe('“Yapay Zeka” Üzerine');
  });

  it('uses English joining words on English pages', () => {
    expect(titleCase('education and career', 'en')).toBe('Education and Career');
    expect(titleCase('what is klinikterapist?', 'en')).toBe('What Is klinikterapist?');
  });
});

describe('titleCaseHeadings', () => {
  it('changes only the text of h1–h4, not tags, attributes or entities', () => {
    const html = '<h2 id="x" class="a b">çalışma alanlarım</h2><p>düz metin</p><h1>merhaba, ben <em>güneş.</em></h1><h3>soru &amp; cevap</h3>';
    expect(titleCaseHeadings(html, 'tr')).toBe(
      '<h2 id="x" class="a b">Çalışma Alanlarım</h2><p>düz metin</p><h1>Merhaba, Ben <em>Güneş.</em></h1><h3>Soru &amp; Cevap</h3>',
    );
    expect(titleCaseHeadings('<h1>I&#39;m a psychologist</h1>', 'en')).toBe('<h1>I&#39;m a Psychologist</h1>');
  });

  it("leaves the headings inside a blog post's body as the author wrote them", () => {
    const html = '<h1>yazının başlığı</h1><article><div class="prose"><h2>bir ara başlık</h2></div></article><h2>benzer yazılar</h2>';
    expect(titleCaseHeadings(html, 'tr')).toBe(
      '<h1>Yazının Başlığı</h1><article><div class="prose"><h2>bir ara başlık</h2></div></article><h2>Benzer Yazılar</h2>',
    );
  });
});
