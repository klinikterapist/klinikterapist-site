/**
 * Always-visible formatting row above the text (sticky). On narrow screens it scrolls sideways
 * instead of wrapping.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { BookOpenText, Bold, Ellipsis, Highlighter, Image, Italic, Link, List, ListOrdered, Quote, Redo2, Strikethrough, Undo2, Youtube } from '../icons';

const ICON = {
  undo: <Undo2 size={18} aria-hidden="true" />,
  redo: <Redo2 size={18} aria-hidden="true" />,
  link: <Link size={18} aria-hidden="true" />,
  image: <Image size={18} aria-hidden="true" />,
  youtube: <Youtube size={18} aria-hidden="true" />,
  quote: <Quote size={18} aria-hidden="true" />,
  bullets: <List size={18} aria-hidden="true" />,
  numbers: <ListOrdered size={18} aria-hidden="true" />,
  book: <BookOpenText size={18} aria-hidden="true" />,
  more: <Ellipsis size={18} aria-hidden="true" />,
  bold: <Bold size={18} aria-hidden="true" />,
  italic: <Italic size={18} aria-hidden="true" />,
  strike: <Strikethrough size={18} aria-hidden="true" />,
  highlight: <Highlighter size={18} aria-hidden="true" />,
};

export type ToolbarProps = {
  editor: Editor;
  onLink: () => void;
  onImage: () => void;
  onYoutube: () => void;
  onReference: () => void;
};

export function Toolbar({ editor, onLink, onImage, onYoutube, onReference }: ToolbarProps) {
  const [more, setMore] = useState<{ top: number; right: number } | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!more) return;
    const close = () => setMore(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMore(null);
        moreBtn.current?.focus();
      }
    };
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !moreBtn.current?.contains(t)) setMore(null);
    };
    const el = bar.current;
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', close);
    el?.addEventListener('scroll', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', close);
      el?.removeEventListener('scroll', close);
    };
  }, [more]);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
      quote: e.isActive('blockquote'),
      bullets: e.isActive('bulletList'),
      numbers: e.isActive('orderedList'),
      block: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const btn = (label: string, content: ReactNode, fn: () => void, opts: { active?: boolean; disabled?: boolean } = {}) => (
    <button
      type="button"
      className={`ed-tool ${opts.active ? 'is-active' : ''}`}
      aria-label={label}
      aria-pressed={opts.active === undefined ? undefined : opts.active}
      title={label}
      disabled={opts.disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={fn}
    >
      {content}
    </button>
  );
  const chain = () => editor.chain().focus();

  const setBlock = (value: string) => {
    if (value === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: value === 'h2' ? 2 : 3 }).run();
  };

  return (
    <div ref={bar} className="ed-toolbar" role="toolbar" aria-label="Biçimlendirme">
      {btn('Geri al', ICON.undo, () => chain().undo().run(), { disabled: !s.canUndo })}
      {btn('Yinele', ICON.redo, () => chain().redo().run(), { disabled: !s.canRedo })}
      <select className="ed-block-select" aria-label="Paragraf türü" value={s.block} onChange={(e) => setBlock(e.target.value)}>
        <option value="p">Paragraf</option>
        <option value="h2">Alt başlık</option>
        <option value="h3">Küçük alt başlık</option>
      </select>
      {btn('Kalın', ICON.bold, () => chain().toggleBold().run(), { active: s.bold })}
      {btn('İtalik', ICON.italic, () => chain().toggleItalic().run(), { active: s.italic })}
      {btn('Üstü çizili', ICON.strike, () => chain().toggleStrike().run(), { active: s.strike })}
      {btn('Vurgula', ICON.highlight, () => chain().toggleHighlight().run(), { active: s.highlight })}
      {btn('Bağlantı', ICON.link, onLink, { active: s.link })}
      {btn('Görsel', ICON.image, onImage)}
      {btn('YouTube', ICON.youtube, onYoutube)}
      {btn('Alıntı', ICON.quote, () => chain().toggleBlockquote().run(), { active: s.quote })}
      {btn('Madde listesi', ICON.bullets, () => chain().toggleBulletList().run(), { active: s.bullets })}
      {btn('Numaralı liste', ICON.numbers, () => chain().toggleOrderedList().run(), { active: s.numbers })}
      {btn('Referans ekle', ICON.book, onReference)}
      <div className="ed-more">
        <button
          ref={moreBtn}
          type="button"
          className="ed-tool"
          aria-controls="ed-more-menu"
          aria-label="Daha fazla"
          title="Daha fazla"
          aria-haspopup="menu"
          aria-expanded={!!more}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMore(more ? null : { top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
          }}
        >
          {ICON.more}
        </button>
        {more && (
          <div ref={menu} id="ed-more-menu" className="ed-more-menu" role="menu" style={{ top: more.top, right: more.right }}>
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setMore(null);
                chain().wrapIn('callout').run();
              }}
            >
              Vurgu kutusu
            </button>
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setMore(null);
                chain().setHorizontalRule().run();
              }}
            >
              Ayraç
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
