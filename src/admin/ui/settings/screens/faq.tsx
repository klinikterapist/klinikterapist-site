/**
 * Sık Sorulan Sorular (owner's review 2026-10-21): every question and answer of the site in one place,
 * with the pages that show them — Ana sayfa, the Sık Sorulan Sorular page and the Randevu page. A row
 * per question (its pages as marks, the first line of the answer, a warning when a language is
 * missing); a press opens it in a window. The tabs show one page's questions, and a question added
 * there starts on that page. The order is the order on the site.
 */
import { useState } from 'react';
import { DEFAULT_FAQ_PAGES, FAQ_PAGES, parseFaq, type Faq, type FaqItem, type FaqPage } from '../../../../lib/schemas';
import { Toggle } from '../../kit';
import { LocalizedField, SettingsForm } from '../fields';
import { RowList } from '../rows';
import { IconSelect } from './lists';
import { useSettingsFile } from '../useSettingsFile';

const newId = () => `soru-${Date.now().toString(36)}`;

export const PAGE_NAME: Record<FaqPage, string> = { home: 'Ana sayfa', faq: 'SSS sayfası', booking: 'Randevu sayfası' };
const PAGE_TONE: Record<FaqPage, string> = { home: 'gunes', faq: 'deniz', booking: 'adacayi' };
const ICON_CHOICES = ['help', 'calendar', 'clock', 'tag', 'laptop', 'shield', 'chat', 'leaf', 'user', 'heart', 'brain', 'talk'];

const pagesOf = (f: FaqItem) => f.pages ?? DEFAULT_FAQ_PAGES;

export function SssScreen() {
  const file = useSettingsFile<Faq>('src/data/faq.json', parseFaq, 'Sık Sorulan Sorular');
  const [page, setPage] = useState<FaqPage | 'all'>('all');
  return (
    <SettingsForm title="Sık Sorulan Sorular" screen="sss" file={file} intro="Sitedeki bütün sorular ve cevaplar. Her sorunun hangi sayfalarda görüneceğini kendiniz seçersiniz: ana sayfa, Sık Sorulan Sorular sayfası ya da randevu sayfası.">
      {(faq) => (
        <>
          <h3>Sorular</h3>
          <div className="faq-tabs segmented" role="group" aria-label="Sayfa">
            <button type="button" aria-pressed={page === 'all'} onClick={() => setPage('all')}>
              {`Tümü (${faq.length})`}
            </button>
            {FAQ_PAGES.map((p) => (
              <button key={p} type="button" aria-pressed={page === p} onClick={() => setPage(p)}>
                {`${PAGE_NAME[p]} (${faq.filter((f) => pagesOf(f).includes(p)).length})`}
              </button>
            ))}
          </div>
          <RowList<FaqItem>
            items={faq}
            onChange={(next) => file.setValue(() => next)}
            visible={(f) => page === 'all' || pagesOf(f).includes(page)}
            numbered
            noun="soru"
            title={(f) => f.q.tr || 'Yeni soru'}
            subtitle={(f) => (f.a.tr.trim() ? f.a.tr.trim().split('\n')[0] : 'Cevap henüz yazılmadı; soru sitede görünmez.')}
            marks={(f) => (
              <>
                {pagesOf(f).map((p) => (
                  <span key={p} className={`tone-chip tone-${PAGE_TONE[p]}`}>
                    {PAGE_NAME[p]}
                  </span>
                ))}
                {(!f.q.en.trim() || !f.a.en.trim()) && f.a.tr.trim() && <span className="tone-chip tone-kiremit">EN eksik</span>}
                {pagesOf(f).length === 0 && <span className="tone-chip tone-kiremit">Hiçbir sayfada değil</span>}
              </>
            )}
            newItem={() => ({ id: newId(), q: { tr: '', en: '' }, a: { tr: '', en: '' }, pages: page === 'all' ? [...DEFAULT_FAQ_PAGES] : [page] })}
            addLabel="Soru ekle"
            render={(f, update, i) => (
              <>
                <LocalizedField label="Soru" value={f.q} onChange={(q) => update({ q })} issues={file.issues} path={`${i}.q`} />
                <LocalizedField label="Cevap" value={f.a} onChange={(a) => update({ a })} multiline inline rows={5} issues={file.issues} path={`${i}.a`} hint="Paragrafları boş bir satırla ayırın. Madde listesi için satırın başına “- ” yazın." />
                <fieldset className="faq-pages">
                  <legend className="k-label">Hangi sayfalarda görünsün?</legend>
                  {FAQ_PAGES.map((p) => (
                    <Toggle
                      key={p}
                      label={PAGE_NAME[p]}
                      checked={pagesOf(f).includes(p)}
                      onChange={(on) => update({ pages: FAQ_PAGES.filter((x) => (x === p ? on : pagesOf(f).includes(x))) })}
                    />
                  ))}
                </fieldset>
                {pagesOf(f).includes('booking') && (
                  <div className="faq-icon">
                    <IconSelect value={f.icon ?? 'help'} options={ICON_CHOICES.map((v) => ({ value: v, label: v }))} onChange={(icon) => update({ icon })} />
                    <span className="k-hint">Randevu sayfasında sorunun yanında görünen simge.</span>
                  </div>
                )}
              </>
            )}
          />
        </>
      )}
    </SettingsForm>
  );
}

