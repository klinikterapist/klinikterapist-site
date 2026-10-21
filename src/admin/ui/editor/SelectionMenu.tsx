/**
 * The small dark bar over selected text (owner's example 2026-10-21): bold, italic, strikethrough,
 * highlight, link and "Alt başlık", so the marks are at hand where the eye already is. It shows only
 * for a text selection, not on images or videos; the toolbar above the text keeps every tool.
 */
import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState, type Editor } from '@tiptap/react';
import { Bold, Heading2, Highlighter, Italic, Link, Strikethrough, type LucideIcon } from '../icons';
import { SHORTCUT } from './Toolbar';

export function SelectionMenu({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
      h2: e.isActive('heading', { level: 2 }),
    }),
  });
  const chain = () => editor.chain().focus();
  const tool = (name: string, label: string, Glyph: LucideIcon, active: boolean, fn: () => void) => (
    <button
      type="button"
      className={`sel-tool${active ? ' is-active' : ''}`}
      aria-label={`Seçili metin: ${label}`}
      aria-pressed={active}
      data-tip={SHORTCUT[name] ? `${label}  ${SHORTCUT[name].text}` : label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={fn}
    >
      <Glyph size={16} aria-hidden="true" />
    </button>
  );
  return (
    <BubbleMenu
      editor={editor}
      className="sel-menu"
      shouldShow={({ editor: e, from, to }) => from !== to && e.isEditable && !e.isActive('figure') && !e.isActive('youtube') && e.state.doc.textBetween(from, to).trim().length > 0}
    >
      {tool('Kalın', 'Kalın', Bold, s.bold, () => chain().toggleBold().run())}
      {tool('İtalik', 'İtalik', Italic, s.italic, () => chain().toggleItalic().run())}
      {tool('Üstü çizili', 'Üstü çizili', Strikethrough, s.strike, () => chain().toggleStrike().run())}
      {tool('Vurgula', 'Vurgula', Highlighter, s.highlight, () => chain().toggleHighlight().run())}
      <span className="sel-sep" aria-hidden="true" />
      {tool('Bağlantı', 'Bağlantı', Link, s.link, onLink)}
      {tool('Alt başlık', 'Alt başlık', Heading2, s.h2, () => chain().toggleHeading({ level: 2 }).run())}
    </BubbleMenu>
  );
}
