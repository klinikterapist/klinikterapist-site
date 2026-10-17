/**
 * Medium-style writing surface for one language: a big title, then the body. Selecting text opens
 * a floating toolbar; an empty line shows "+" for image, divider, YouTube and callout.
 */
import { useEffect, useRef, useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import type { LangFields } from '../../api/types';
import type { Lang } from '../../../lib/schemas';
import { autoSlug, LANG_LABEL } from '../../lib/draft';
import { parseYoutubeId } from '../../lib/youtube';
import { IMAGE_PRESETS, ImageError, fileNameFor, resizeImage } from '../../lib/image';
import { Button, Dialog, Field } from '../kit';
import { Callout, Figure, Youtube } from './nodes';
import type { ImageStore } from './images';

/** Same rule as the site's Markdown renderer: https, mailto or a site path. */
const SAFE_LINK = /^(https:\/\/|mailto:|\/(?![\/\\]))/i;

export function normalizeLink(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  if (/^(www\.)?klinikterapist\.com/i.test(v)) v = `https://${v.replace(/^www\./i, '')}`;
  else if (/^[^/:]+\.[a-z]{2,}(\/|$)/i.test(v)) v = `https://${v}`;
  return SAFE_LINK.test(v) ? v : null;
}

function useTiptap(lang: Lang, doc: JSONContent, images: ImageStore, onDoc: (doc: JSONContent) => void) {
  const onDocRef = useRef(onDoc);
  onDocRef.current = onDoc;
  return useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          code: false,
          codeBlock: false,
          strike: false,
          underline: false,
          link: { openOnClick: false, autolink: true, defaultProtocol: 'https', isAllowedUri: (url) => SAFE_LINK.test(url) },
        }),
        Placeholder.configure({ placeholder: lang === 'tr' ? 'Yazmaya başlayın…' : 'Start writing in English…' }),
        Figure.configure({ resolveUrl: (src) => images.url(src) }),
        Youtube,
        Callout,
      ],
      content: doc,
      editorProps: { attributes: { class: 'ed-body prose', lang, 'aria-label': `Yazı metni (${LANG_LABEL[lang]})` } },
      onUpdate: ({ editor }) => onDocRef.current(editor.getJSON()),
    },
    [lang],
  );
}

type Ask = { kind: 'link' | 'youtube'; value: string; error: string | null };

export function PostEditor(props: {
  lang: Lang;
  fields: LangFields;
  onChange: (patch: Partial<LangFields>) => void;
  images: ImageStore;
  onError: (message: string | null) => void;
}) {
  const { lang, fields, onChange, images, onError } = props;
  const editor = useTiptap(lang, fields.doc, images, (doc) => onChange({ doc }));
  const [ask, setAsk] = useState<Ask | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = title.current;
    if (t) {
      t.style.height = 'auto';
      t.style.height = `${t.scrollHeight}px`;
    }
  }, [fields.title]);

  const onTitle = (value: string) => {
    const next = { ...fields, title: value.replace(/\n/g, ' ') };
    onChange({ title: next.title, slug: autoSlug(next, lang) });
  };

  const run = (fn: (e: Editor) => void) => editor && fn(editor);

  const confirmAsk = () => {
    if (!ask || !editor) return;
    if (ask.kind === 'link') {
      if (!ask.value.trim()) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return setAsk(null);
      }
      const href = normalizeLink(ask.value);
      if (!href) return setAsk({ ...ask, error: 'Bağlantı https:// ile, mailto: ile ya da site içi bir yol (/blog/…) ile başlamalı.' });
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    } else {
      const id = parseYoutubeId(ask.value);
      if (!id) return setAsk({ ...ask, error: 'Bu bir YouTube video bağlantısı değil gibi görünüyor.' });
      editor.chain().focus().insertContent({ type: 'youtube', attrs: { id } }).run();
    }
    setAsk(null);
  };

  const onFile = async (f: File | undefined) => {
    if (!f || !editor) return;
    setPlusOpen(false);
    setUploading(true);
    onError(null);
    try {
      const img = await resizeImage(f, IMAGE_PRESETS.body);
      const name = fileNameFor(f.name.replace(/\.[^.]+$/, ''), images.names(), img.ext);
      await images.add(name, img.base64);
      editor.chain().focus().insertContent({ type: 'figure', attrs: { src: `./${name}`, alt: '', caption: '' } }).run();
    } catch (e) {
      onError(e instanceof ImageError ? e.message : (e as Error).message || 'Görsel yüklenemedi. Tekrar deneyin.');
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };

  const tool = (label: string, active: boolean, fn: () => void, text: string) => (
    <button type="button" className={`ed-tool ${active ? 'is-active' : ''}`} aria-label={label} aria-pressed={active} title={label} onMouseDown={(e) => e.preventDefault()} onClick={fn}>
      {text}
    </button>
  );

  return (
    <div className="post-editor">
      <label className="k-visually-hidden" htmlFor={`title-${lang}`}>
        Başlık ({LANG_LABEL[lang]})
      </label>
      <textarea
        id={`title-${lang}`}
        ref={title}
        className="ed-title"
        rows={1}
        lang={lang}
        placeholder={lang === 'tr' ? 'Başlık' : 'Title'}
        value={fields.title}
        onChange={(e) => onTitle(e.target.value)}
      />
      {editor && (
        <BubbleMenu
          editor={editor}
          className="ed-bubble"
          shouldShow={({ editor: ed, state }) => !state.selection.empty && !ed.isActive('figure') && !ed.isActive('youtube')}
        >
          {tool('Kalın', editor.isActive('bold'), () => run((e) => e.chain().focus().toggleBold().run()), 'K')}
          {tool('İtalik', editor.isActive('italic'), () => run((e) => e.chain().focus().toggleItalic().run()), 'İ')}
          {tool('Alt başlık (H2)', editor.isActive('heading', { level: 2 }), () => run((e) => e.chain().focus().toggleHeading({ level: 2 }).run()), 'H2')}
          {tool('Küçük alt başlık (H3)', editor.isActive('heading', { level: 3 }), () => run((e) => e.chain().focus().toggleHeading({ level: 3 }).run()), 'H3')}
          {tool('Bağlantı', editor.isActive('link'), () => setAsk({ kind: 'link', value: String(editor.getAttributes('link').href ?? ''), error: null }), '🔗')}
          {tool('Alıntı', editor.isActive('blockquote'), () => run((e) => e.chain().focus().toggleBlockquote().run()), '❝')}
          {tool('Madde listesi', editor.isActive('bulletList'), () => run((e) => e.chain().focus().toggleBulletList().run()), '•')}
        </BubbleMenu>
      )}
      {editor && (
        <FloatingMenu editor={editor} className="ed-plus">
          <button
            type="button"
            className="ed-plus-toggle"
            aria-label="Ekle"
            aria-expanded={plusOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPlusOpen(!plusOpen)}
          >
            +
          </button>
          {plusOpen && (
            <div className="ed-plus-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => file.current?.click()}>
                Görsel
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPlusOpen(false);
                  editor.chain().focus().setHorizontalRule().run();
                }}
              >
                Ayraç
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPlusOpen(false);
                  setAsk({ kind: 'youtube', value: '', error: null });
                }}
              >
                YouTube
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPlusOpen(false);
                  editor.chain().focus().wrapIn('callout').run();
                }}
              >
                Vurgu kutusu
              </button>
            </div>
          )}
        </FloatingMenu>
      )}
      <EditorContent editor={editor} />
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {uploading && <p className="ed-muted" role="status">Görsel küçültülüp yükleniyor…</p>}
      {ask && (
        <Dialog
          title={ask.kind === 'link' ? 'Bağlantı' : 'YouTube videosu'}
          onClose={() => setAsk(null)}
          actions={
            <>
              <Button onClick={() => setAsk(null)}>Vazgeç</Button>
              <Button variant="primary" onClick={confirmAsk}>
                {ask.kind === 'link' ? 'Bağlantıyı ekle' : 'Videoyu ekle'}
              </Button>
            </>
          }
        >
          <Field
            label={ask.kind === 'link' ? 'Adres' : 'YouTube bağlantısı'}
            value={ask.value}
            onChange={(value) => setAsk({ ...ask, value, error: null })}
            placeholder={ask.kind === 'link' ? 'https://… ya da /blog/…' : 'https://youtu.be/…'}
            hint={ask.kind === 'link' ? 'Boş bırakırsanız bağlantı kaldırılır.' : undefined}
            error={ask.error}
          />
        </Dialog>
      )}
    </div>
  );
}
