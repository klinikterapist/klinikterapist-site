/**
 * Always-visible formatting row above the text (sticky). On narrow screens it scrolls sideways
 * instead of wrapping.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ICON = {
  undo: svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>),
  redo: svg(<><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></>),
  link: svg(<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>),
  image: svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-4-4L5 21" /></>),
  youtube: svg(<><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3z" /></>),
  quote: svg(<><path d="M5 17h4l2-4V7H5v6h3" /><path d="M14 17h4l2-4V7h-6v6h3" /></>),
  bullets: svg(<><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>),
  numbers: svg(<><path d="M10 6h11M10 12h11M10 18h11" /><path d="M4 5l1-1v4M3.5 14h2l-2 3h2" /></>),
  book: svg(<><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2Z" /><path d="M12 6v14" /></>),
  more: svg(<><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>),
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
      {btn('Kalın', <b>K</b>, () => chain().toggleBold().run(), { active: s.bold })}
      {btn('İtalik', <i>İ</i>, () => chain().toggleItalic().run(), { active: s.italic })}
      {btn('Üstü çizili', <s>S</s>, () => chain().toggleStrike().run(), { active: s.strike })}
      {btn('Vurgula', <mark className="ed-tool-mark">A</mark>, () => chain().toggleHighlight().run(), { active: s.highlight })}
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
