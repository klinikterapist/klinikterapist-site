/**
 * Writing surface for one language: a fixed toolbar, a big title, the subtitle, the 16:9 cover, then the body.
 */
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extensions';
import type { Draft, LangFields } from '../../api/types';
import type { Lang } from '../../../lib/schemas';
import { autoSlug, LANG_LABEL } from '../../lib/draft';
import { parseYoutubeId } from '../../lib/youtube';
import { IMAGE_PRESETS, ImageError, fileNameFor, resizeImage } from '../../lib/image';
import { Button, Dialog, Field } from '../kit';
import { Callout, Figure, Youtube } from './nodes';
import type { ImageStore } from './images';
import { Toolbar } from './Toolbar';
import { CoverBlock, type CoverPatch } from './CoverBlock';
import { DropCap } from './dropcap';
import { Citation, citationAtCursor, citedRefs, syncCitationRefs, type CitationAttrs } from './Citation';
import { CitationEditDialog, CitationMenu, type MenuAction } from './CitationMenu';
import { ReferenceDialog, ReferenceEditDialog, type InsertRequest } from './ReferenceDialog';
import type { Reference } from '../../../lib/apa';
import { sanitizeCiteItems } from '../../../lib/citations';

/** Same rule as the site's Markdown renderer: https, mailto or a site path. */
const SAFE_LINK = /^(https:\/\/|mailto:|\/(?![\/\\]))/i;

export function normalizeLink(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  if (/^(www\.)?klinikterapist\.com/i.test(v)) v = `https://${v.replace(/^www\./i, '')}`;
  else if (/^[^/:]+\.[a-z]{2,}(\/|$)/i.test(v)) v = `https://${v}`;
  return SAFE_LINK.test(v) ? v : null;
}

function useTiptap(lang: Lang, doc: JSONContent, references: Reference[], images: ImageStore, onDoc: (doc: JSONContent) => void, onError: (m: string | null) => void) {
  const onDocRef = useRef(onDoc);
  onDocRef.current = onDoc;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
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
        Figure.configure({ resolveUrl: (src) => images.url(src), store: images, onError: (m) => onErrorRef.current(m) }),
        Highlight,
        Youtube,
        Callout,
        DropCap,
        Citation.configure({ refs: citedRefs(references, doc, lang), lang }),
      ],
      content: doc,
      editorProps: { attributes: { class: 'ed-body prose', lang, 'aria-label': `Yazı metni (${LANG_LABEL[lang]})`, 'data-field': 'body' } },
      onUpdate: ({ editor }) => onDocRef.current(editor.getJSON()),
    },
    [lang],
  );
}

type Ask = { kind: 'link' | 'youtube'; value: string; error: string | null };

/** What the citation UI has open: the reference dialog (maybe joining a citation), one reference's form, a citation's menu or its settings. */
type CiteUi =
  | { kind: 'add'; join: { pos: number; attrs: CitationAttrs } | null }
  | { kind: 'editRef'; id: string }
  | { kind: 'menu'; pos: number; rect: DOMRect }
  | { kind: 'locator'; pos: number };

export function PostEditor(props: {
  lang: Lang;
  fields: LangFields;
  onChange: (patch: Partial<LangFields>) => void;
  images: ImageStore;
  onError: (message: string | null) => void;
  /** Where the toolbar is mounted (full editor width, above the text and the settings column). */
  toolbarHost?: HTMLElement | null;
  /** For the DOI lookup; tests pass a stub. */
  fetchFn?: typeof fetch;
  /** The shared cover, shown under the subtitle; left out, there is no cover block. */
  cover?: { draft: Pick<Draft, 'cover' | 'coverOriginal' | 'coverCrop'>; coverVersion: number; onShared: (patch: CoverPatch) => void; onCoverUploaded: () => void };
}) {
  const { lang, fields, onChange, images, onError, toolbarHost } = props;
  const editor = useTiptap(lang, fields.doc, fields.references, images, (doc) => onChange({ doc }), onError);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [cite, setCite] = useState<CiteUi | null>(null);
  const closeCite = useCallback(() => setCite(null), []);

  useLayoutEffect(() => {
    if (editor) syncCitationRefs(editor, fields.references, fields.doc, lang);
  }, [editor, fields.references, fields.doc, lang]);
  useEffect(() => {
    if (!editor) return;
    editor.storage.citation.onOpen = (pos, rect) => setCite({ kind: 'menu', pos, rect });
    return () => {
      editor.storage.citation.onOpen = null;
    };
  }, [editor]);
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

  /** The citation node still at `pos`, or null when the text changed under it. */
  const citationAt = (pos: number): CitationAttrs | null => {
    const node = editor?.state.doc.nodeAt(pos);
    return node?.type.name === 'citation' ? (node.attrs as CitationAttrs) : null;
  };
  const setCitation = (pos: number, attrs: CitationAttrs) =>
    editor?.chain().focus().command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, attrs);
      return true;
    }).run();

  const insertCitation = (r: InsertRequest, join: { pos: number } | null) => {
    if (!editor) return;
    const references = r.isNew ? [...fields.references, r.ref] : fields.references;
    if (r.isNew) onChange({ references });
    // The dialog refuses forbidden characters; this is the same boundary the Markdown writer uses.
    const [item] = sanitizeCiteItems([r.locator ? { id: r.ref.id, locator: r.locator } : { id: r.ref.id }]);
    const existing = join ? citationAt(join.pos) : null;
    if (join && existing) {
      setCitation(join.pos, { items: [...existing.items.filter((i) => i.id !== item.id), item], narrative: r.narrative });
    } else {
      editor.chain().focus().insertContent({ type: 'citation', attrs: { items: [item], narrative: r.narrative } }).run();
    }
    syncCitationRefs(editor, references, editor.getJSON(), lang);
    setCite(null);
  };

  const saveReference = (ref: Reference) => onChange({ references: fields.references.map((r) => (r.id === ref.id ? ref : r)) });

  const onMenu = (pos: number, a: MenuAction) => {
    const attrs = citationAt(pos);
    if (!attrs || !editor) return setCite(null);
    if (a.kind === 'locator') setCite({ kind: 'locator', pos });
    else if (a.kind === 'edit') setCite({ kind: 'editRef', id: a.id });
    else if (a.kind === 'add') setCite({ kind: 'add', join: { pos, attrs } });
    else {
      editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();
      setCite(null);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f || !editor) return;
    setUploading(true);
    onError(null);
    try {
      // The original first (kept for "Düzenle"), then the body image as before; then "Görseli düzenle" opens.
      const orig = await resizeImage(f, IMAGE_PRESETS.original);
      const img = await resizeImage(f, IMAGE_PRESETS.body);
      const name = fileNameFor(f.name.replace(/\.[^.]+$/, ''), images.names(), img.ext);
      const origName = fileNameFor(`${name.replace(/\.[^.]+$/, '')}-orig`, new Set([...images.names(), name]), orig.ext);
      await images.add(origName, orig.base64);
      await images.add(name, img.base64);
      editor.storage.figure.openFor = `./${name}`;
      editor.chain().focus().insertContent({ type: 'figure', attrs: { src: `./${name}`, alt: '', caption: '', orig: origName } }).run();
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
          onReference={() => setCite({ kind: 'add', join: citationAtCursor(editor) })}
          onError={onError}
        />,
        toolbarHost,
      )}
      <label className="k-visually-hidden" htmlFor={`title-${lang}`}>
        Başlık ({LANG_LABEL[lang]})
      </label>
      <textarea
        id={`title-${lang}`}
        data-field="title"
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
        data-field="subtitle"
        ref={subtitle}
        className="ed-subtitle"
        rows={1}
        lang={lang}
        placeholder={lang === 'tr' ? 'Alt başlık ekleyin…' : 'Add a subtitle…'}
        value={fields.subtitle}
        onChange={(e) => onChange({ subtitle: e.target.value.replace(/\n/g, ' ') })}
      />
      {props.cover && <CoverBlock {...props.cover} images={images} onError={onError} lang={lang} alt={fields.coverAlt} />}
      <EditorContent editor={editor} />
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {uploading && <p className="ed-muted" role="status">Görsel küçültülüp yükleniyor…</p>}
      {cite?.kind === 'add' && (
        <ReferenceDialog
          lang={lang}
          references={fields.references}
          doc={fields.doc}
          joining={cite.join ? { narrative: cite.join.attrs.narrative } : null}
          fetchFn={props.fetchFn}
          onClose={closeCite}
          onInsert={(r) => insertCitation(r, cite.join)}
          onSave={saveReference}
          onDelete={(id) => onChange({ references: fields.references.filter((r) => r.id !== id) })}
        />
      )}
      {cite?.kind === 'editRef' && (() => {
        const ref = fields.references.find((r) => r.id === cite.id);
        return ref ? (
          <ReferenceEditDialog
            initial={ref}
            references={fields.references}
            doc={fields.doc}
            lang={lang}
            dialogTitle="Referansı düzenle"
            onClose={closeCite}
            onCancel={closeCite}
            onSave={(r) => {
              saveReference(r);
              setCite(null);
            }}
          />
        ) : null;
      })()}
      {cite?.kind === 'menu' && citationAt(cite.pos) && (
        <CitationMenu
          rect={cite.rect}
          attrs={citationAt(cite.pos)!}
          references={fields.references}
          lang={lang}
          onAction={(a) => onMenu(cite.pos, a)}
          onClose={closeCite}
        />
      )}
      {cite?.kind === 'locator' && citationAt(cite.pos) && (
        <CitationEditDialog
          attrs={citationAt(cite.pos)!}
          references={fields.references}
          lang={lang}
          onClose={closeCite}
          onSave={(attrs) => {
            if (attrs.items.length) setCitation(cite.pos, attrs);
            setCite(null);
          }}
        />
      )}
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
