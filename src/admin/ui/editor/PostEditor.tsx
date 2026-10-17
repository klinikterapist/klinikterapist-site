/**
 * Writing surface for one language: a fixed toolbar, a big title, then the body.
 */
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extensions';
import type { LangFields } from '../../api/types';
import type { Lang } from '../../../lib/schemas';
import { autoSlug, LANG_LABEL } from '../../lib/draft';
import { parseYoutubeId } from '../../lib/youtube';
import { IMAGE_PRESETS, ImageError, fileNameFor, resizeImage } from '../../lib/image';
import { Button, Dialog, Field } from '../kit';
import { Callout, Figure, Youtube } from './nodes';
import type { ImageStore } from './images';
import { Toolbar } from './Toolbar';

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
          underline: false,
          link: { openOnClick: false, autolink: true, defaultProtocol: 'https', isAllowedUri: (url) => SAFE_LINK.test(url) },
        }),
        Placeholder.configure({ placeholder: lang === 'tr' ? 'Yazmaya başlayın…' : 'Start writing in English…' }),
        Figure.configure({ resolveUrl: (src) => images.url(src) }),
        Highlight,
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
  /** Where the toolbar is mounted (full editor width, above the text and the settings column). */
  toolbarHost?: HTMLElement | null;
}) {
  const { lang, fields, onChange, images, onError, toolbarHost } = props;
  const editor = useTiptap(lang, fields.doc, images, (doc) => onChange({ doc }));
  const [ask, setAsk] = useState<Ask | null>(null);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLTextAreaElement>(null);
  const subtitle = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = title.current;
    if (t) {
      t.style.height = 'auto';
      t.style.height = `${t.scrollHeight}px`;
    }
  }, [fields.title]);

  useEffect(() => {
    const t = subtitle.current;
    if (t) {
      t.style.height = 'auto';
      t.style.height = `${t.scrollHeight}px`;
    }
  }, [fields.subtitle]);

  const onTitle = (value: string) => {
    const next = { ...fields, title: value.replace(/\n/g, ' ') };
    onChange({ title: next.title, slug: autoSlug(next, lang) });
  };

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

  return (
    <div className="post-editor">
      {editor && toolbarHost && createPortal(
        <Toolbar
          editor={editor}
          onLink={() => setAsk({ kind: 'link', value: String(editor.getAttributes('link').href ?? ''), error: null })}
          onImage={() => file.current?.click()}
          onYoutube={() => setAsk({ kind: 'youtube', value: '', error: null })}
        />,
        toolbarHost,
      )}
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
      <label className="k-visually-hidden" htmlFor={`subtitle-${lang}`}>
        Alt başlık ({LANG_LABEL[lang]})
      </label>
      <textarea
        id={`subtitle-${lang}`}
        ref={subtitle}
        className="ed-subtitle"
        rows={1}
        lang={lang}
        placeholder={lang === 'tr' ? 'Alt başlık ekleyin…' : 'Add a subtitle…'}
        value={fields.subtitle}
        onChange={(e) => onChange({ subtitle: e.target.value.replace(/\n/g, ' ') })}
      />
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
