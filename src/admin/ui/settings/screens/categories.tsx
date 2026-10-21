/**
 * Kategoriler: add, rename, change slugs (old pages redirect), pick the Konular page icon, delete when
 * unused. Owner's review 2026-10-21: a card per category with its icon, its posts (live and drafts) as a
 * bar, and its addresses; the share of all posts on top; a card opens its fields in a window.
 */
import { useEffect, useState } from 'react';
import { parseCategories, type Category } from '../../../../lib/schemas';
import { slugify } from '../../../../lib/slug';
import { buildCategoryChangeset } from '../../../lib/publish';
import { loadSiteState } from '../../../lib/posts-repo';
import { usePanel } from '../../context';
import { Field } from '../../kit';
import { typingSlug } from '../../editor/MetaPanel';
import { LocalizedField, SettingsForm } from '../fields';
import { RowList, SiteIcon } from '../rows';
import { useSettingsFile } from '../useSettingsFile';
import { ICON_OPTIONS, IconSelect } from './lists';

/** In-panel extras, stripped by the schema on save. */
type Row = Category & { _new?: boolean; _touched?: boolean };

export function KategorilerScreen() {
  const { api } = usePanel();
  const file = useSettingsFile<Row[]>('src/data/categories.json', parseCategories, 'Kategoriler');
  const [used, setUsed] = useState<Map<string, number> | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);

  /** How many posts (live ones and drafts, each key once) are in each category. */
  const usedCategories = async () => {
    const [site, { drafts }] = await Promise.all([loadSiteState(api), api.listDrafts()]);
    const byKey = new Map<string, string>();
    for (const p of site.posts) if (p.tr.fm.category) byKey.set(p.key, p.tr.fm.category);
    for (const d of drafts) if (d.category) byKey.set(d.key, d.category);
    const counts = new Map<string, number>();
    for (const c of byKey.values()) counts.set(c, (counts.get(c) ?? 0) + 1);
    return counts;
  };

  useEffect(() => {
    let alive = true;
    usedCategories()
      .then((ids) => alive && setUsed(ids))
      // Unknown usage must never look like "unused": deleting a used category breaks the build.
      .catch(() => alive && setCheckFailed(true));
    return () => {
      alive = false;
    };
  }, [api]);

  const save = () =>
    file.save(async (after) => {
      const site = await loadSiteState(api);
      return buildCategoryChangeset({
        before: site.categories.list,
        after,
        sha: site.categories.sha,
        // Always checked again at save time, against the live posts and every draft.
        usedIds: new Set((await usedCategories()).keys()),
        redirects: site.redirects,
      });
    });

  return (
    <SettingsForm
      title="Kategoriler"
      screen="kategoriler"
      intro="Blog kategorileri. Simge, Konular sayfasında kategorinin yanında görünür. Bir kategorinin adresini değiştirirseniz eski adres yenisine yönlendirilir. İçinde yazı ya da taslak olan kategori silinemez."
      file={file}
      onSave={save}
    >
      {(cats) => {
        const total = used ? [...used.values()].reduce((a, n) => a + n, 0) : 0;
        const most = used ? Math.max(1, ...used.values()) : 1;
        const tone = (i: number) => `var(--p-chart-cat-${(i % 6) + 1})`;
        return (
          <>
            <h3>Dağılım</h3>
            <div className="cat-overview">
              <span className="cat-total">
                <b>{cats.length}</b> kategori
                <span aria-hidden="true"> · </span>
                <b>{used ? total : '…'}</b> yazı ve taslak
              </span>
              {used && total > 0 && (
                <span className="cat-bar cat-bar-lg" role="img" aria-label={cats.map((c) => `${c.label.tr}: ${used.get(c.id) ?? 0}`).join(', ')}>
                  {cats.map((c, i) => (used.get(c.id) ? <i key={c.id || i} style={{ flexGrow: used.get(c.id), background: tone(i) }} /> : null))}
                </span>
              )}
            </div>
            <h3>Kategoriler</h3>
            <RowList<Row>
              cards
              items={cats}
              onChange={(next) => file.setValue(() => next)}
              noun="kategori"
              title={(c) => c.label.tr || 'Yeni kategori'}
              subtitle={(c) => (
                <>
                  <span>{c.label.en || 'İngilizce adı yok'}</span>
                  <span className="cat-addr">{`/blog/kategori/${c.slug.tr || '…'}/`}</span>
                  {used && !c._new && (
                    <span className="cat-meter" aria-hidden="true">
                      <i style={{ width: `${((used.get(c.id) ?? 0) / most) * 100}%`, background: tone(cats.indexOf(c)) }} />
                    </span>
                  )}
                </>
              )}
              icon={(c) => (
                <span className="tone-tile tone-tile-lg cat-icon" style={{ color: tone(cats.indexOf(c)) }} aria-hidden="true">
                  <SiteIcon name={c.icon ?? 'tag'} size={22} />
                </span>
              )}
              marks={(c) =>
                c._new ? (
                  <span className="tone-chip tone-gunes">Yeni</span>
                ) : checkFailed ? (
                  <span className="tone-chip tone-kiremit">Kontrol edilemedi</span>
                ) : used === null ? (
                  <span className="tone-chip tone-lacivert">Sayılıyor…</span>
                ) : used.get(c.id) ? (
                  <span className="tone-chip tone-adacayi">{`${used.get(c.id)} yazı · kullanımda`}</span>
                ) : (
                  <span className="tone-chip tone-lacivert">Boş · silinebilir</span>
                )
              }
              newItem={() => ({ id: '', slug: { tr: '', en: '' }, label: { tr: '', en: '' }, icon: 'tag', _new: true })}
              addLabel="Kategori ekle"
              canDelete={(c) =>
                c._new ? true : checkFailed ? 'Kontrol edilemedi; sayfayı yenileyin' : used === null ? 'Kontrol ediliyor…' : used.get(c.id) ? 'Kullanımda' : true
              }
              render={(c, update, i) => (
                <>
                  <LocalizedField
                    label="Ad"
                    value={c.label}
                    onChange={(label) =>
                      update(
                        c._new && !c._touched
                          ? { label, id: slugify(label.tr, 'tr'), slug: { tr: slugify(label.tr, 'tr'), en: slugify(label.en, 'en') } }
                          : { label },
                      )
                    }
                    issues={file.issues}
                    path={`${i}.label`}
                  />
                  <div className="loc-field">
                    <Field
                      label="Türkçe adres"
                      value={c.slug.tr}
                      onChange={(tr) => update({ slug: { ...c.slug, tr: typingSlug(tr, 'tr') }, _touched: true })}
                      hint={`klinikterapist.com/blog/kategori/${c.slug.tr || '…'}/`}
                      error={file.issues[`${i}.slug.tr`]}
                    />
                    <Field
                      label="İngilizce adres"
                      value={c.slug.en}
                      onChange={(en) => update({ slug: { ...c.slug, en: typingSlug(en, 'en') }, _touched: true })}
                      hint={`klinikterapist.com/en/blog/category/${c.slug.en || '…'}/`}
                      error={file.issues[`${i}.slug.en`]}
                    />
                  </div>
                  <IconSelect value={c.icon ?? 'tag'} options={ICON_OPTIONS} onChange={(icon) => update({ icon })} />
                  {!c._new && used?.get(c.id) ? <p className="k-hint">{`Bu kategoride ${used.get(c.id)} yazı ya da taslak var; silmeden önce onları başka bir kategoriye alın.`}</p> : null}
                </>
              )}
            />
          </>
        );
      }}
    </SettingsForm>
  );
}
