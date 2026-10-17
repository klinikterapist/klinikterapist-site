/**
 * In-text citation: an inline atom `{ items: CiteItem[], narrative }` whose text is generated from
 * the post's references (`editor.storage.citation.refs`, kept current by PostEditor).
 */
import { Node, type Editor, type JSONContent } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { useSyncExternalStore } from 'react';
import { bibliography, citationText, type CiteItem, type Reference } from '../../../lib/apa';
import { parseCiteAttr, sanitizeCiteItems, writeCiteAttr } from '../../../lib/citations';
import type { Lang } from '../../../lib/schemas';
import { INVALID_CITATION } from '../../lib/draft';

export type CitationAttrs = { items: CiteItem[]; narrative: boolean };

export type CitationStorage = {
  /** The cited references (reference-list order matters for 2004a/b). */
  refs: Reference[];
  lang: Lang;
  /** Called when a citation is clicked: its position and on-screen box. */
  onOpen: ((pos: number, rect: DOMRect) => void) | null;
  listeners: Set<() => void>;
};

declare module '@tiptap/core' {
  interface Storage {
    citation: CitationStorage;
  }
}

/** Ids cited anywhere in a doc. */
export function citedIdsInDoc(doc: JSONContent, out = new Set<string>()): Set<string> {
  if (doc.type === 'citation' && Array.isArray(doc.attrs?.items)) {
    for (const item of doc.attrs.items as CiteItem[]) if (typeof item?.id === 'string') out.add(item.id);
  }
  doc.content?.forEach((c) => citedIdsInDoc(c, out));
  return out;
}

/** A reference may be removed from the post only while no citation in the doc uses it. */
export function canRemoveReference(doc: JSONContent, id: string): boolean {
  return !citedIdsInDoc(doc).has(id);
}

/** Give the node views the references for this doc and redraw them. */
export function syncCitationRefs(editor: Editor, references: Reference[], doc: JSONContent, lang: Lang): void {
  const s = editor.storage.citation;
  if (!s) return;
  s.refs = bibliography(references, citedIdsInDoc(doc), lang);
  s.lang = lang;
  s.listeners.forEach((l) => l());
}

/** The APA text of a citation, or the invalid marker when it cannot be made. */
export function citationLabel(attrs: Partial<CitationAttrs>, refs: Reference[], lang: Lang): string {
  try {
    const items = sanitizeCiteItems(Array.isArray(attrs.items) ? attrs.items : []);
    if (!items.length) return INVALID_CITATION;
    return citationText({ items, narrative: attrs.narrative === true }, refs, lang);
  } catch {
    return INVALID_CITATION;
  }
}

/** The citation the cursor is on: selected, or directly before/after an empty cursor. */
export function citationAtCursor(editor: Editor): { pos: number; attrs: CitationAttrs } | null {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection && selection.node.type.name === 'citation') {
    return { pos: selection.from, attrs: selection.node.attrs as CitationAttrs };
  }
  if (!selection.empty) return null;
  const $pos = selection.$from;
  if ($pos.nodeBefore?.type.name === 'citation') return { pos: $pos.pos - $pos.nodeBefore.nodeSize, attrs: $pos.nodeBefore.attrs as CitationAttrs };
  if ($pos.nodeAfter?.type.name === 'citation') return { pos: $pos.pos, attrs: $pos.nodeAfter.attrs as CitationAttrs };
  return null;
}

function CitationView({ node, editor, getPos, selected }: ReactNodeViewProps) {
  const storage = editor.storage.citation;
  const refs = useSyncExternalStore(
    (l) => {
      storage.listeners.add(l);
      return () => storage.listeners.delete(l);
    },
    () => storage.refs,
  );
  const text = citationLabel(node.attrs as CitationAttrs, refs, storage.lang);
  return (
    <NodeViewWrapper
      as="span"
      className={`ed-citation ${selected ? 'is-selected' : ''} ${text === INVALID_CITATION ? 'is-invalid' : ''}`}
      data-citation=""
      contentEditable={false}
      onClick={(e: React.MouseEvent<HTMLElement>) => {
        const pos = getPos();
        if (typeof pos === 'number') storage.onOpen?.(pos, e.currentTarget.getBoundingClientRect());
      }}
    >
      {text}
    </NodeViewWrapper>
  );
}

export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addStorage(): CitationStorage {
    return { refs: [], lang: 'tr', onOpen: null, listeners: new Set() };
  },
  addAttributes() {
    return { items: { default: [] }, narrative: { default: false } };
  },
  // Copy/paste goes through this HTML.
  parseHTML() {
    return [
      {
        tag: 'cite[data-refs]',
        getAttrs: (el) => {
          const items = parseCiteAttr((el as HTMLElement).dataset.refs ?? '');
          return items ? { items, narrative: (el as HTMLElement).hasAttribute('data-narrative') } : false;
        },
      },
    ];
  },
  renderHTML({ node }) {
    let refs = '';
    try {
      refs = writeCiteAttr(node.attrs.items as CiteItem[]);
    } catch {
      /* invalid: copied without a reference */
    }
    const s = this.storage as CitationStorage;
    const text = citationLabel(node.attrs as CitationAttrs, s.refs, s.lang);
    return ['cite', node.attrs.narrative ? { 'data-refs': refs, 'data-narrative': '' } : { 'data-refs': refs }, text];
  },
  renderText({ node }) {
    const s = this.storage as CitationStorage;
    return citationLabel(node.attrs as CitationAttrs, s.refs, s.lang);
  },
  addKeyboardShortcuts() {
    return {
      // Keyboard path to the citation menu: select the citation, press Enter.
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'citation') return false;
        const dom = editor.view.nodeDOM(selection.from);
        const open = editor.storage.citation.onOpen;
        if (!open || !(dom instanceof HTMLElement)) return false;
        open(selection.from, dom.getBoundingClientRect());
        return true;
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CitationView, { as: 'span' });
  },
});
