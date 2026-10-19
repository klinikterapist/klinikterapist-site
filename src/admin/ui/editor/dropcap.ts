/**
 * Owner-placed drop cap: a `dropCap` attribute on top-level paragraphs, at most one per document.
 * In the editor it shows as `<p class="dropcap">`; in the post Markdown it is an empty
 * `<span class="dropcap"></span>` at the start of the paragraph (see lib/markdown.ts).
 */
import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dropCap: {
      /** Sets the drop cap on the paragraph whose first word holds the selection (clearing any other), or clears it there. */
      toggleDropCap: () => ReturnType;
    };
  }
}

export const DROPCAP_HINT = 'Büyük baş harf yalnızca bir paragrafın ilk kelimesine uygulanabilir.';

export const DropCap = Extension.create({
  name: 'dropCap',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          dropCap: {
            default: false,
            // Enter at the end of the paragraph must not hand the drop cap to the new one.
            keepOnSplit: false,
            parseHTML: (el) => el.classList.contains('dropcap'),
            renderHTML: (attrs) => (attrs.dropCap ? { class: 'dropcap' } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      toggleDropCap:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          const para = $from.parent;
          if (para.type.name !== 'paragraph' || $from.depth !== 1 || !para.textContent.trim()) return false;
          // Inside the first word: no whitespace between the paragraph start and the selection (a citation counts as one character).
          if (/\s/.test(para.textBetween(0, $from.parentOffset, undefined, 'x'))) return false;
          if (!dispatch) return true;
          const here = $from.before();
          const turnOn = !para.attrs.dropCap;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'paragraph' && node.attrs.dropCap && pos !== here) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, dropCap: false });
            }
          });
          tr.setNodeMarkup(here, undefined, { ...para.attrs, dropCap: turnOn });
          return true;
        },
    };
  },
});
