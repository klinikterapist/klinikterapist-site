/** Form pieces shared by the settings screens. */
import { Children, Fragment, isValidElement, useRef, useState, type ReactElement, type ReactNode } from 'react';
import type { Localized } from '../../../lib/schemas';
import { renderMarkdown } from '../../../lib/markdown';
import { IMAGE_PRESETS, ImageError, resizeImage } from '../../lib/image';
import { shortHash } from '../../lib/hash';
import { Banner, Button, Dialog, Field, MoveButtons, Spinner, move } from '../kit';
import { Icon } from '../icons';
import { SETTINGS_SCREENS } from './screens';
import type { Issues, SettingsFile, Staging } from './useSettingsFile';

export function LocalizedField(props: {
  label: string;
  value: Localized;
  onChange: (v: Localized) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  issues?: Issues;
  path?: string;
}) {
  const err = (lang: 'tr' | 'en') => (props.path ? (props.issues?.[`${props.path}.${lang}`] ?? props.issues?.[props.path]) : undefined);
  return (
    <div className="loc-field">
      <Field
        label={`${props.label} (Türkçe)`}
        value={props.value.tr}
        onChange={(tr) => props.onChange({ ...props.value, tr })}
        multiline={props.multiline}
        rows={props.rows}
        hint={props.hint}
        error={err('tr')}
        lang="tr"
      />
      <Field
        label={`${props.label} (İngilizce)`}
        value={props.value.en}
        onChange={(en) => props.onChange({ ...props.value, en })}
        multiline={props.multiline}
        rows={props.rows}
        error={err('en')}
        lang="en"
      />
    </div>
  );
}

export function MarkdownField(props: { label: string; value: string; onChange: (v: string) => void; lang: 'tr' | 'en'; rows?: number; error?: string }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="md-field">
      <div className="row md-head">
        <span className="k-label">{props.label}</span>
        <button type="button" className="chip" aria-pressed={preview} onClick={() => setPreview(!preview)}>
          {preview ? 'Düzenle' : 'Önizle'}
        </button>
      </div>
      {preview ? (
        <div className="md-preview" lang={props.lang} dangerouslySetInnerHTML={{ __html: renderMarkdown(props.value) }} />
      ) : (
        <Field
          label={`${props.label} metni`}
          value={props.value}
          onChange={props.onChange}
          multiline
          rows={props.rows ?? 8}
          lang={props.lang}
          error={props.error}
          inputClassName="mono"
          hint="Paragrafları boş satırla ayırın. **kalın**, _italik_, [bağlantı](https://…) kullanabilirsiniz."
        />
      )}
    </div>
  );
}

/** Upload → resize → staged into the next save as `public/images/<dir><base>-<hash>.<ext>`. */
export function ImageField(props: {
  label: string;
  value: string | null;
  onChange: (publicPath: string | null) => void;
  preset: keyof typeof IMAGE_PRESETS;
  baseName: string;
  dir?: string;
  staging: Staging;
  allowRemove?: boolean;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<string | null>(null);
  const stagedData = props.value ? props.staging.data(`public${props.value}`) : undefined;
  const src = stagedData ? `data:image/${props.value?.endsWith('.jpg') ? 'jpeg' : 'webp'};base64,${stagedData}` : props.value;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await resizeImage(file, IMAGE_PRESETS[props.preset]);
      const hash = await shortHash(new Uint8Array(await img.blob.arrayBuffer()));
      const repoPath = `public/images/${props.dir ?? ''}${props.baseName}-${hash}.${img.ext}`;
      if (staged) props.staging.unstage(staged);
      else if (props.value?.startsWith('/images/')) props.staging.del(`public${props.value}`);
      props.staging.write(repoPath, img.base64);
      setStaged(repoPath);
      props.onChange(repoPath.replace(/^public/, ''));
    } catch (e) {
      setError(e instanceof ImageError ? e.message : 'Görsel hazırlanamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="k-field image-field">
      <span className="k-label">{props.label}</span>
      {src ? <img className={`image-preview preset-${props.preset}`} src={src} alt="" /> : <div className="image-empty">Görsel yok</div>}
      <div className="row">
        <Button busy={busy} onClick={() => input.current?.click()}>
          {props.value ? 'Değiştir' : 'Görsel seç'}
        </Button>
        {props.allowRemove && props.value && (
          <Button
            variant="ghost"
            onClick={() => {
              if (staged) props.staging.unstage(staged);
              else if (props.value?.startsWith('/images/')) props.staging.del(`public${props.value}`);
              setStaged(null);
              props.onChange(null);
            }}
          >
            Kaldır
          </Button>
        )}
      </div>
      {props.hint && <p className="k-hint">{props.hint}</p>}
      {error && <p className="k-error">{error}</p>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

export function ListEditor<T>(props: {
  items: T[];
  onChange: (items: T[]) => void;
  itemLabel: (item: T, index: number) => string;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  newItem?: () => T;
  addLabel?: string;
  canDelete?: (item: T) => string | true;
}) {
  const [confirm, setConfirm] = useState<number | null>(null);
  const update = (i: number) => (patch: Partial<T>) => props.onChange(props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="list-editor">
      <ol>
        {props.items.map((item, i) => {
          const label = props.itemLabel(item, i);
          const can = props.canDelete ? props.canDelete(item) : true;
          return (
            <li key={i} className="list-item">
              <div className="list-item-head">
                <span className="list-item-title">{label}</span>
                <span className="row">
                  <MoveButtons index={i} count={props.items.length} label={label} onMove={(to) => props.onChange(move(props.items, i, to))} />
                  {can !== true && <span className="k-hint">{can}</span>}
                  <Button variant="ghost" aria-label={`Sil: ${label}`} disabled={can !== true} onClick={() => setConfirm(i)}>
                    Sil
                  </Button>
                </span>
              </div>
              <div className="list-item-body">{props.render(item, update(i), i)}</div>
            </li>
          );
        })}
      </ol>
      {props.newItem && (
        <Button onClick={() => props.onChange([...props.items, props.newItem!()])}>{props.addLabel ?? 'Ekle'}</Button>
      )}
      {confirm !== null && (
        <Dialog
          title="Silinsin mi?"
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)}>Vazgeç</Button>
              <Button
                variant="danger"
                onClick={() => {
                  props.onChange(props.items.filter((_, j) => j !== confirm));
                  setConfirm(null);
                }}
              >
                Evet, sil
              </Button>
            </>
          }
        >
          <p>“{props.itemLabel(props.items[confirm], confirm)}” listeden çıkarılacak. Kaydet'e basana kadar sitede değişiklik olmaz.</p>
        </Dialog>
      )}
    </div>
  );
}

/**
 * Apple-style grouped form (owner's review 2026-10-19): the screen's fields are split at each <h3>
 * into inset cards, the heading becoming the small title above its card. Fields before the first
 * heading form an untitled card. Screens keep writing a flat list of fields and headings.
 */
export function groupSettings(content: ReactNode): ReactNode {
  const flat: ReactNode[] = [];
  const walk = (node: ReactNode) => {
    for (const child of Children.toArray(node)) {
      if (isValidElement(child) && child.type === Fragment) walk((child as ReactElement<{ children?: ReactNode }>).props.children);
      else flat.push(child);
    }
  };
  walk(content);
  const groups: { title: ReactNode; items: ReactNode[] }[] = [];
  for (const child of flat) {
    if (isValidElement(child) && child.type === 'h3') {
      groups.push({ title: (child as ReactElement<{ children?: ReactNode }>).props.children, items: [] });
    } else {
      if (!groups.length) groups.push({ title: null, items: [] });
      groups[groups.length - 1].items.push(child);
    }
  }
  return groups.map((g, i) => (
    <div className="k-group" key={i}>
      {g.title !== null && <h3 className="k-group-title">{g.title}</h3>}
      {g.items.length > 0 && <div className="k-group-card">{g.items}</div>}
    </div>
  ));
}

/** Screen frame: title, intro, loading/error, the grouped form, and a save bar. */
export function SettingsForm<T>(props: {
  title: string;
  /** Id from SETTINGS_SCREENS: supplies the header icon and the default intro. */
  screen?: string;
  intro?: ReactNode;
  file: SettingsFile<T>;
  onSave?: () => void;
  children: (value: T) => ReactNode;
}) {
  const { file } = props;
  const general = Object.entries(file.issues);
  const meta = SETTINGS_SCREENS.find((x) => x.id === props.screen);
  const intro = props.intro ?? meta?.intro;
  return (
    <section className="settings" aria-labelledby="settings-screen-title">
      <div className="screen-head">
        <h2 id="settings-screen-title">
          {meta && <Icon as={meta.icon} size={22} />}
          {props.title}
        </h2>
      </div>
      {intro && <p className="settings-intro">{intro}</p>}
      {file.loadError && (
        <Banner tone="error" action={<Button onClick={file.retry}>Tekrar dene</Button>}>
          {file.loadError}
        </Banner>
      )}
      {!file.value && !file.loadError && <Spinner />}
      {file.value && (
        <form
          className="settings-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            (props.onSave ?? (() => file.save()))();
          }}
        >
          {groupSettings(props.children(file.value))}
          <div className="save-bar">
            {file.message && <Banner tone={file.message.tone}>{file.message.text}</Banner>}
            {file.message?.tone === 'error' && general.length > 0 && (
              <ul className="issue-list">
                {general.map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code>: {v}
                  </li>
                ))}
              </ul>
            )}
            <Button type="submit" variant="primary" busy={file.saving}>
              Kaydet
            </Button>
            {file.dirty && !file.saving && <span className="k-hint">Kaydedilmemiş değişiklikler var.</span>}
          </div>
        </form>
      )}
    </section>
  );
}
