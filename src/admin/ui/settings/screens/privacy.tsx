/**
 * Gizlilik ve Analitik (owner's review 2026-10-21): every setting about who sees and counts what.
 * - Google: the Analytics measurement ID (it loads only after a visitor accepts the cookie notice) and
 *   the Search Console verification code.
 * - Arama motorları: the whole site, or single pages, kept out of search results (a `noindex` tag).
 * - Çerez bildirimi: its text, shown only while Analytics is set.
 * - Sitenin sayacı: the site's own cookieless counter on or off, and "Kendi ziyaretlerimi sayma"
 *   for this browser (kept here, not in seo.json).
 * - Kod ekleme: code to add to the pages' head or the end of the page, on all pages or some.
 * All but the browser switch are saved to seo.json with Kaydet.
 */
import { PAGE_KEYS, parseSeo, type CodeInjection, type Seo } from '../../../../lib/schemas';
import { Field, Select, Toggle } from '../../kit';
import { useNoTrack } from '../../no-track';
import { LocalizedField, SettingsForm } from '../fields';
import { RowList } from '../rows';
import { useSettingsFile } from '../useSettingsFile';
import { PAGE_LABEL } from './lists';

const WHERE: Record<CodeInjection['where'], string> = { head: 'Sayfa başı (head)', body: 'Sayfa sonu (body)' };
const PAGES: Record<CodeInjection['pages'], string> = {
  all: 'Bütün sayfalar',
  home: 'Yalnızca ana sayfa',
  blog: 'Blog (liste ve yazılar)',
  posts: 'Yalnızca yazı sayfaları',
  other: 'Blog ve ana sayfa dışındakiler',
};

export function GizlilikScreen() {
  const file = useSettingsFile<Seo>('src/data/seo.json', parseSeo, 'Gizlilik ve Analitik');
  const [noTrack, setNoTrack] = useNoTrack();
  const set = <K extends keyof Seo>(k: K) => (v: Seo[K]) => file.setValue((s) => ({ ...s, [k]: v }));
  return (
    <SettingsForm title="Gizlilik ve Analitik" screen="gizlilik" file={file} intro="Ziyaretçilerin nasıl sayıldığı, Google'a ne gösterildiği, çerez bildirimi ve sayfalara eklenen kodlar. Bu cihazdaki tek ayar dışında hepsi Kaydet ile siteye yansır.">
      {(s) => (
        <>
          <h3>Google</h3>
          <Field
            label="Google Analytics ölçüm kimliği"
            value={s.gaId ?? ''}
            onChange={(v) => set('gaId')(v.trim() || undefined)}
            placeholder="G-XXXXXXXXXX"
            error={file.issues.gaId}
            hint="Ziyaretçi çerez bildiriminde “Kabul ediyorum”a basmadan Google'ın kodu yüklenmez. Boş bırakırsanız Analytics ve çerez bildirimi kapanır."
          />
          <Field
            label="Google Search Console doğrulama kodu"
            value={s.gscVerification ?? ''}
            onChange={(v) => set('gscVerification')(v.trim() || undefined)}
            hint='Search Console › "HTML etiketi" yöntemindeki content="…" değeri.'
          />

          <h3>Arama motorları</h3>
          <Toggle label="Site Google aramalarında görünsün" checked={!s.noindex} onChange={(on) => set('noindex')(on ? undefined : true)} />
          <p className="k-hint">{s.noindex ? 'Kapalı: bütün sayfalara “arama sonuçlarında gösterme” etiketi eklenir. Site açık kalır, yalnızca aramada çıkmaz.' : 'Açık: aşağıda seçtikleriniz dışındaki sayfalar aramada görünebilir.'}</p>
          {!s.noindex && (
            <fieldset className="check-grid">
              <legend className="k-label">Aramada gizlenecek sayfalar</legend>
              {PAGE_KEYS.map((k) => (
                <Toggle
                  key={k}
                  label={PAGE_LABEL[k]}
                  checked={(s.noindexPages ?? []).includes(k)}
                  onChange={(on) => {
                    const next = PAGE_KEYS.filter((x) => (x === k ? on : (s.noindexPages ?? []).includes(x)));
                    set('noindexPages')(next.length ? next : undefined);
                  }}
                />
              ))}
            </fieldset>
          )}

          <h3>Çerez bildirimi</h3>
          <LocalizedField
            label="Bildirim metni"
            value={s.cookieText ?? { tr: '', en: '' }}
            onChange={(v) => set('cookieText')(v.tr.trim() || v.en.trim() ? v : undefined)}
            multiline
            hint={s.gaId ? 'Boş bırakırsanız hazır metin görünür. Metni değiştirirseniz gizlilik politikasıyla uyumlu olmasına dikkat edin.' : 'Bildirim yalnızca Google Analytics kimliği girildiğinde görünür.'}
          />

          <h3>Sitenin kendi sayacı</h3>
          <Toggle label="Sayaç açık" checked={s.counter !== false} onChange={(on) => set('counter')(on ? undefined : false)} />
          <p className="k-hint">Çerezsiz ve kimliksiz sayım: sayfa görüntüleme, yazıyı sonuna kadar okuma ve “Randevu Al” tıklamaları. Genel Bakış'taki istatistikler buradan gelir.</p>
          <Toggle label="Kendi ziyaretlerimi sayma (bu tarayıcı)" checked={noTrack} onChange={setNoTrack} />
          <p className="k-hint">Bu ayar siteye kaydedilmez; yalnızca bu cihazda ve bu tarayıcıda geçerlidir. Başka bir cihazdan girerseniz orada da açın.</p>

          <h3>Kod ekleme</h3>
          <p className="k-hint">Bir hizmetin size verdiği kodu (doğrulama etiketi, sohbet penceresi, piksel …) sayfalara ekler. Yalnızca güvendiğiniz hizmetlerin kodunu ekleyin; çerez kullanan kodlar için gizlilik metnini de güncellemeniz gerekir.</p>
          <RowList<CodeInjection>
            items={s.inject ?? []}
            onChange={(next) => set('inject')(next.length ? next : undefined)}
            noun="eklenmiş kod"
            title={(c) => c.label || 'Adsız kod'}
            subtitle={(c) => `${WHERE[c.where]} · ${PAGES[c.pages]}`}
            marks={(c) => <span className={`tone-chip ${c.enabled ? 'tone-adacayi' : 'tone-kiremit'}`}>{c.enabled ? 'Açık' : 'Kapalı'}</span>}
            newItem={() => ({ id: `kod-${Date.now().toString(36)}`, label: '', where: 'head', pages: 'all', code: '', enabled: false })}
            addLabel="Kod ekle"
            render={(c, update) => (
              <>
                <Field label="Ad" value={c.label} onChange={(label) => update({ label })} placeholder="Örneğin: Pinterest doğrulama" />
                <div className="form-2">
                  <Select label="Nereye" value={c.where} options={Object.entries(WHERE).map(([value, label]) => ({ value: value as CodeInjection['where'], label }))} onChange={(where) => update({ where })} />
                  <Select label="Hangi sayfalara" value={c.pages} options={Object.entries(PAGES).map(([value, label]) => ({ value: value as CodeInjection['pages'], label }))} onChange={(pages) => update({ pages })} />
                </div>
                <Field label="Kod" value={c.code} onChange={(code) => update({ code })} multiline rows={8} hint="Hizmetin verdiği kodu olduğu gibi yapıştırın." />
                <Toggle label="Açık" checked={c.enabled} onChange={(enabled) => update({ enabled })} />
              </>
            )}
          />
        </>
      )}
    </SettingsForm>
  );
}
