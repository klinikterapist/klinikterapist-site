/** Kategoriler: add, rename, change slugs (old pages redirect), delete when unused. */
import { useEffect, useState } from 'react';
import { parseCategories, type Category } from '../../../../lib/schemas';
import { slugify } from '../../../../lib/slug';
import { buildCategoryChangeset } from '../../../lib/publish';
import { loadSiteState } from '../../../lib/posts-repo';
import { usePanel } from '../../context';
import { Field } from '../../kit';
import { typingSlug } from '../../editor/MetaPanel';
import { ListEditor, LocalizedField, SettingsForm } from '../fields';
import { useSettingsFile } from '../useSettingsFile';

/** In-panel extras, stripped by the schema on save. */
type Row = Category & { _new?: boolean; _touched?: boolean };

export function KategorilerScreen() {
  const { api } = usePanel();
  const file = useSettingsFile<Row[]>('src/data/categories.json', parseCategories, 'Kategoriler');
  const [used, setUsed] = useState<Set<string> | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);

  const usedCategories = async () => {
    const [site, { drafts }] = await Promise.all([loadSiteState(api), api.listDrafts()]);
    return new Set([...site.posts.map((p) => p.tr.fm.category), ...drafts.map((d) => d.category)].filter(Boolean));
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
        usedIds: await usedCategories(),
        redirects: site.redirects,
      });
    });

  return (
    <SettingsForm
      title="Kategoriler"
      screen="kategoriler"
      intro="Blog kategorileri. Bir kategorinin adresini değiştirirseniz eski adres yenisine yönlendirilir. İçinde yazı ya da taslak olan kategori silinemez."
      file={file}
      onSave={save}
    >
      {(cats) => (
        <ListEditor<Row>
          items={cats}
          onChange={(next) => file.setValue(() => next)}
          itemLabel={(c) => c.label.tr || 'Yeni kategori'}
          newItem={() => ({ id: '', slug: { tr: '', en: '' }, label: { tr: '', en: '' }, _new: true })}
          addLabel="Kategori ekle"
          canDelete={(c) =>
            c._new ? true : checkFailed ? 'Kontrol edilemedi; sayfayı yenileyin' : used === null ? 'Kontrol ediliyor…' : used.has(c.id) ? 'Kullanımda' : true
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
            </>
          )}
        />
      )}
    </SettingsForm>
  );
}
