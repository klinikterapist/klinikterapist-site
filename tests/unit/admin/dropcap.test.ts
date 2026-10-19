// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DropCap } from '../../../src/admin/ui/editor/dropcap';

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
let editor: Editor;
afterEach(() => editor?.destroy());

function setup() {
  editor = new Editor({
    extensions: [StarterKit, DropCap],
    content: { type: 'doc', content: [para('Birinci paragraf burada.'), para('İkinci paragraf üç kelime.'), para('Üçüncü paragraf.')] },
  });
  return editor;
}
/** Document position `offset` characters into paragraph `n` (0-based). */
function at(e: Editor, n: number, offset: number) {
  let pos = 0;
  e.state.doc.forEach((node, p, i) => {
    if (i === n) pos = p + 1 + offset;
  });
  return pos;
}
const caps = (e: Editor) => (e.getJSON().content ?? []).map((n) => n.attrs?.dropCap === true);

describe('toggleDropCap', () => {
  it('in the first word of paragraph 2 sets it there only', () => {
    const e = setup();
    e.commands.setTextSelection(at(e, 1, 3));
    expect(e.commands.toggleDropCap()).toBe(true);
    expect(caps(e)).toEqual([false, true, false]);
    expect(e.getHTML()).toContain('<p class="dropcap">İkinci');
  });

  it('in the third word does nothing', () => {
    const e = setup();
    e.commands.setTextSelection(at(e, 1, 'İkinci paragraf üç'.length - 1));
    expect(e.commands.toggleDropCap()).toBe(false);
    expect(caps(e)).toEqual([false, false, false]);
  });

  it('moving it to paragraph 3 clears paragraph 2; toggling again clears it', () => {
    const e = setup();
    e.commands.setTextSelection(at(e, 1, 0));
    e.commands.toggleDropCap();
    e.commands.setTextSelection(at(e, 2, 2));
    expect(e.commands.toggleDropCap()).toBe(true);
    expect(caps(e)).toEqual([false, false, true]);
    expect(e.commands.toggleDropCap()).toBe(true);
    expect(caps(e)).toEqual([false, false, false]);
  });

  it('Enter does not copy it to the new paragraph, and it survives the editor HTML', () => {
    const e = setup();
    e.commands.setTextSelection(at(e, 0, 1));
    e.commands.toggleDropCap();
    e.commands.setTextSelection(at(e, 0, 'Birinci paragraf burada.'.length));
    e.commands.splitBlock();
    expect(caps(e)).toEqual([true, false, false, false]);
    const copy = new Editor({ extensions: [StarterKit, DropCap], content: e.getHTML() });
    expect((copy.getJSON().content ?? []).map((n) => n.attrs?.dropCap === true)).toEqual([true, false, false, false]);
    copy.destroy();
  });
});
