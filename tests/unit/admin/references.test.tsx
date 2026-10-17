// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Editor, JSONContent } from '@tiptap/core';
import { PostEditor } from '../../../src/admin/ui/editor/PostEditor';
import { Citation, canRemoveReference } from '../../../src/admin/ui/editor/Citation';
import { Editor as CoreEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorPage } from '../../../src/admin/ui/editor/EditorPage';
import type { ImageStore } from '../../../src/admin/ui/editor/images';
import { Panel } from '../../../src/admin/ui/context';
import { DeployProvider } from '../../../src/admin/ui/DeployStatus';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';
import { newDraft, normalizeDraft } from '../../../src/admin/lib/draft';
import type { LangFields } from '../../../src/admin/api/types';
import type { Reference } from '../../../src/lib/apa';

beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {} });
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const RAY = {
  type: 'article-journal', title: 'Why We Need Positive Psychology', author: [{ family: 'Ray', given: 'Oakley' }],
  issued: { 'date-parts': [[2004]] }, 'container-title': 'American Psychologist', volume: '59', issue: '1', page: '29-34', DOI: '10.1037/0003-066X.59.1.29',
};
const SMITH = {
  type: 'book', title: 'The Mind at Work', author: [{ family: 'Smith', given: 'Jane' }, { family: 'Lee', given: 'Kim' }],
  issued: { 'date-parts': [[2010]] }, publisher: 'Guilford Press', DOI: '10.1000/smith',
};
const REPORT = { type: 'report', title: 'Annual Report on Care', author: [{ family: 'Kaya', given: 'Ali' }], issued: { 'date-parts': [[2019]] }, DOI: '10.1000/report' };

const byDoi: Record<string, unknown> = { '10.1037/0003-066X.59.1.29': RAY, '10.1000/smith': SMITH, '10.1000/report': REPORT };
const stubFetch = () =>
  vi.fn(async (url: string) => {
    const csl = byDoi[url.replace('https://doi.org/', '')];
    return { ok: !!csl, status: csl ? 200 : 404, json: async () => csl } as unknown as Response;
  }) as unknown as typeof fetch;

const rayRef: Reference = {
  id: 'ray2004', type: 'article', authors: [{ family: 'Ray', given: 'Oakley' }], year: 2004, title: 'Why we need positive psychology',
  container: 'American Psychologist', volume: '59', issue: '1', pages: '29–34',
};

const para = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph', content }] });
const fields = (doc: JSONContent, references: Reference[] = []): LangFields => ({
  title: 'Başlık', subtitle: '', seoTitle: '', slug: 'baslik', slugTouched: false, description: '', focusKeyword: '', coverAlt: '', doc, references,
});

let latest: LangFields;
function Harness({ initial, fetchFn }: { initial: LangFields; fetchFn: typeof fetch }) {
  const [f, setF] = useState(initial);
  const [host, setHost] = useState<HTMLElement | null>(null);
  latest = f;
  return (
    <>
      <div ref={setHost} />
      <PostEditor
        lang="tr"
        fields={f}
        onChange={(p) => setF((x) => ({ ...x, ...p }))}
        images={{} as ImageStore}
        onError={() => {}}
        toolbarHost={host}
        fetchFn={fetchFn}
      />
    </>
  );
}

const setup = (initial = fields(para({ type: 'text', text: 'Metin ' }))) => {
  const fetchFn = stubFetch();
  render(<Harness initial={initial} fetchFn={fetchFn} />);
  return fetchFn;
};
const editorText = () => document.querySelector('.ProseMirror')!.textContent ?? '';
const editorOf = () => (document.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;
const citations = (doc: JSONContent): JSONContent[] =>
  doc.type === 'citation' ? [doc] : (doc.content ?? []).flatMap(citations);

async function openDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Referans ekle' }));
  return screen.findByRole('dialog', { name: 'Referans ekle' });
}
async function lookup(dlg: HTMLElement, doi: string) {
  fireEvent.click(within(dlg).getByRole('tab', { name: 'Yeni referans' }));
  fireEvent.change(within(dlg).getByLabelText('DOI ya da doi.org bağlantısı'), { target: { value: doi } });
  fireEvent.click(within(dlg).getByRole('button', { name: 'Bul' }));
}
const ekle = (dlg: HTMLElement) => within(dlg).getByRole('button', { name: 'Ekle' }) as HTMLButtonElement;

describe('Referans ekle', () => {
  it('opens the dialog with the saved and new tabs', async () => {
    setup();
    const dlg = await openDialog();
    expect(within(dlg).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Kayıtlı referanslar (0)', 'Yeni referans']);
  });

  it('a DOI lookup fills the form, warns about title case, previews APA and inserts the citation', async () => {
    setup();
    const dlg = await openDialog();
    await lookup(dlg, 'https://doi.org/10.1037/0003-066X.59.1.29');
    expect(await within(dlg).findByText('Başlığın büyük/küçük harflerini kontrol edin.')).toBeTruthy();
    expect((within(dlg).getByLabelText('Başlık') as HTMLInputElement).value).toBe('Why we need positive psychology');
    expect((within(dlg).getAllByLabelText('Soyadı')[0] as HTMLInputElement).value).toBe('Ray');
    const preview = within(dlg).getByRole('region', { name: 'Önizleme (APA 7)' });
    expect(preview.textContent).toContain('Ray, O. (2004). Why we need positive psychology. American Psychologist, 59(1), 29–34. https://doi.org/10.1037/0003-066X.59.1.29');
    fireEvent.click(ekle(dlg));
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004)'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(latest.references.map((r) => r.id)).toEqual(['ray2004']);
    expect(latest.references[0].doi).toBe('10.1037/0003-066X.59.1.29');
  });

  it('a page and the narrative format give Ray (2004, s. 34)', async () => {
    setup();
    const dlg = await openDialog();
    await lookup(dlg, '10.1037/0003-066X.59.1.29');
    await within(dlg).findByText('Başlığın büyük/küçük harflerini kontrol edin.');
    fireEvent.change(within(dlg).getByLabelText('Sayfa (isteğe bağlı)'), { target: { value: 's. 34' } });
    const format = within(dlg).getByLabelText('Biçim') as HTMLSelectElement;
    expect(Array.from(format.options).map((o) => o.textContent)).toEqual(['(Ray, 2004)', 'Ray (2004)']);
    fireEvent.change(format, { target: { value: 'narrative' } });
    fireEvent.click(ekle(dlg));
    await waitFor(() => expect(editorText()).toContain('Ray (2004, s. 34)'));
    expect(citations(latest.doc)[0].attrs).toEqual({ items: [{ id: 'ray2004', locator: { kind: 'p', value: '34' } }], narrative: true });
  });

  it('with the cursor on a citation, a second reference joins that citation', async () => {
    setup();
    let dlg = await openDialog();
    await lookup(dlg, '10.1037/0003-066X.59.1.29');
    await within(dlg).findByText('Başlığın büyük/küçük harflerini kontrol edin.');
    fireEvent.click(ekle(dlg));
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004)'));

    dlg = await openDialog();
    expect(within(dlg).getByText('Referans, imlecin üzerindeki atıfa eklenecek.')).toBeTruthy();
    await lookup(dlg, '10.1000/smith');
    await within(dlg).findByText('Başlığın büyük/küçük harflerini kontrol edin.');
    fireEvent.click(ekle(dlg));
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004; Smith ve Lee, 2010)'));
    expect(citations(latest.doc)).toHaveLength(1);
    expect(latest.references.map((r) => r.id)).toEqual(['ray2004', 'smith2010']);
  });

  it('a saved reference can be cited again from "Kayıtlı referanslar"', async () => {
    setup(fields(para({ type: 'text', text: 'Metin ' }), [rayRef]));
    const dlg = await openDialog();
    expect(within(dlg).getByRole('tab', { name: 'Kayıtlı referanslar (1)', selected: true })).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('radio', { name: /Ray, O\. \(2004\)/ }));
    fireEvent.click(ekle(dlg));
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004)'));
    expect(latest.references).toHaveLength(1);
  });

  it('a failed lookup shows the Turkish error and switches to the manual form', async () => {
    setup();
    const dlg = await openDialog();
    await lookup(dlg, '10.9999/yok');
    expect(await within(dlg).findByText('Bu DOI bulunamadı.')).toBeTruthy();
    expect(within(dlg).getByLabelText('Tür')).toBeTruthy();
    expect(within(dlg).getByLabelText('Başlık')).toBeTruthy();
  });

  it('the manual form offers four types and its fields follow the type', async () => {
    setup();
    const dlg = await openDialog();
    fireEvent.click(within(dlg).getByRole('tab', { name: 'Yeni referans' }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'DOI yok, elle doldur' }));
    const type = within(dlg).getByLabelText('Tür') as HTMLSelectElement;
    expect(Array.from(type.options).map((o) => o.textContent)).toEqual(['Dergi makalesi', 'Kitap', 'Kitap bölümü', 'Web sayfası']);
    expect(within(dlg).getByLabelText('Dergi adı')).toBeTruthy();
    expect(within(dlg).queryByLabelText('Kitap adı')).toBeNull();
    expect(within(dlg).queryByText('Editörler')).toBeNull();
    fireEvent.change(type, { target: { value: 'chapter' } });
    expect(within(dlg).getByLabelText('Kitap adı')).toBeTruthy();
    expect(within(dlg).getByText('Editörler')).toBeTruthy();
    expect(within(dlg).queryByLabelText('Dergi adı')).toBeNull();
  });

  it('an organisation author, "t.y." and a manual book give a valid reference', async () => {
    setup();
    const dlg = await openDialog();
    fireEvent.click(within(dlg).getByRole('tab', { name: 'Yeni referans' }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'DOI yok, elle doldur' }));
    fireEvent.change(within(dlg).getByLabelText('Tür'), { target: { value: 'book' } });
    expect(ekle(dlg).disabled).toBe(true);
    fireEvent.click(within(dlg).getByLabelText('Kurum'));
    expect(within(dlg).queryByLabelText('Soyadı')).toBeNull();
    fireEvent.change(within(dlg).getByLabelText('Kurum adı'), { target: { value: 'Dünya Sağlık Örgütü' } });
    fireEvent.change(within(dlg).getByLabelText('Yıl'), { target: { value: 't.y.' } });
    fireEvent.change(within(dlg).getByLabelText('Başlık'), { target: { value: 'Ruh sağlığı rehberi' } });
    const preview = within(dlg).getByRole('region', { name: 'Önizleme (APA 7)' });
    expect(preview.textContent).toBe('Dünya Sağlık Örgütü. (t.y.). Ruh sağlığı rehberi.');
    fireEvent.change(within(dlg).getByLabelText('Yıl'), { target: { value: 'geçen yıl' } });
    expect(within(dlg).getByText('Yıl bir sayı, "t.y." ya da "baskıda" olmalı.')).toBeTruthy();
    expect(ekle(dlg).disabled).toBe(true);
    fireEvent.change(within(dlg).getByLabelText('Yıl'), { target: { value: 'baskıda' } });
    fireEvent.click(ekle(dlg));
    await waitFor(() => expect(editorText()).toContain('(Dünya Sağlık Örgütü, baskıda)'));
    expect(latest.references[0]).toMatchObject({ type: 'book', authors: [{ literal: 'Dünya Sağlık Örgütü' }], year: 'inpress' });
  });

  it('an unsupported DOI type keeps "Ekle" off until a type is chosen', async () => {
    setup();
    const dlg = await openDialog();
    await lookup(dlg, '10.1000/report');
    expect(
      await within(dlg).findByText('Bu kaynak türü (report) otomatik biçimlendirilemiyor. Uygun türü seçip alanları kontrol edin.'),
    ).toBeTruthy();
    expect(ekle(dlg).disabled).toBe(true);
    fireEvent.change(within(dlg).getByLabelText('Tür'), { target: { value: 'book' } });
    expect(ekle(dlg).disabled).toBe(false);
  });

  it('a cited reference cannot be deleted; a citation opens its menu', async () => {
    const cite = { type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: false } };
    setup(fields(para({ type: 'text', text: 'Metin ' }, cite), [rayRef]));
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004)'));
    const dlg = await openDialog();
    const del = within(dlg).getByRole('button', { name: 'Sil' }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    expect(within(dlg).getByText('Bu referans metinde kullanılıyor.')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Vazgeç' }));

    fireEvent.click(document.querySelector('[data-citation]')!);
    const menu = await screen.findByRole('menu', { name: 'Atıf' });
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Sayfayı / biçimi değiştir', 'Referansı düzenle', 'Bu atıfa referans ekle', 'Atıfı kaldır',
    ]);
  });

  it('a selected citation opens its menu with Enter', async () => {
    const cite = { type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: false } };
    setup(fields(para({ type: 'text', text: 'Metin ' }, cite), [rayRef]));
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004)'));
    editorOf().commands.setNodeSelection(7);
    fireEvent.keyDown(document.querySelector('.ProseMirror')!, { key: 'Enter' });
    expect(await screen.findByRole('menu', { name: 'Atıf' })).toBeTruthy();
  });

  it('the citation menu changes the page and format, and edits the reference', async () => {
    const cite = { type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: false } };
    setup(fields(para({ type: 'text', text: 'Metin ' }, cite), [rayRef]));
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004)'));

    fireEvent.click(document.querySelector('[data-citation]')!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sayfayı / biçimi değiştir' }));
    let dlg = await screen.findByRole('dialog', { name: 'Atıfı düzenle' });
    fireEvent.change(within(dlg).getByLabelText('Sayfa (isteğe bağlı)'), { target: { value: '12-14' } });
    fireEvent.change(within(dlg).getByLabelText('Biçim'), { target: { value: 'narrative' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(editorText()).toContain('Ray (2004, ss. 12–14)'));

    fireEvent.click(document.querySelector('[data-citation]')!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Referansı düzenle' }));
    dlg = await screen.findByRole('dialog', { name: 'Referansı düzenle' });
    fireEvent.change(within(dlg).getAllByLabelText('Soyadı')[0], { target: { value: 'Rey' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(editorText()).toContain('Rey (2004, ss. 12–14)'));
    expect(latest.references).toHaveLength(1);
    expect(latest.references[0]).toMatchObject({ id: 'ray2004', authors: [{ family: 'Rey', given: 'Oakley' }] });
  });

  it('removing the last citation keeps the reference saved (Review Focus 3)', async () => {
    const cite = { type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: false } };
    setup(fields(para({ type: 'text', text: 'Metin ' }, cite), [rayRef]));
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004)'));
    fireEvent.click(document.querySelector('[data-citation]')!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Atıfı kaldır' }));
    await waitFor(() => expect(editorText()).not.toContain('Ray'));
    expect(citations(latest.doc)).toHaveLength(0);
    expect(latest.references.map((r) => r.id)).toEqual(['ray2004']);
    const dlg = await openDialog();
    expect(within(dlg).getByRole('tab', { name: 'Kayıtlı referanslar (1)' })).toBeTruthy();
    const del = within(dlg).getByRole('button', { name: 'Sil' }) as HTMLButtonElement;
    expect(del.disabled).toBe(false);
    fireEvent.click(del);
    expect(within(dlg).getByRole('tab', { name: 'Kayıtlı referanslar (0)' })).toBeTruthy();
    expect(latest.references).toEqual([]);
  });

  it('a citation to a missing reference shows "[geçersiz atıf]" instead of crashing', async () => {
    const cite = { type: 'citation', attrs: { items: [{ id: 'yok2000' }], narrative: false } };
    setup(fields(para({ type: 'text', text: 'Metin ' }, cite), []));
    await waitFor(() => expect(editorText()).toContain('[geçersiz atıf]'));
  });

  it('a citation keeps its items and format through the editor HTML (copy/paste)', () => {
    const attrs = { items: [{ id: 'ray2004', locator: { kind: 'p', value: '34' } }, { id: 'smith2010' }], narrative: true };
    const a = new CoreEditor({ extensions: [StarterKit, Citation], content: para({ type: 'citation', attrs }) });
    const html = a.getHTML();
    expect(html).toContain('<cite data-refs="ray2004~p~34;smith2010" data-narrative="">');
    const b = new CoreEditor({ extensions: [StarterKit, Citation], content: html });
    expect(b.getJSON().content?.[0].content).toEqual([{ type: 'citation', attrs }]);
    a.destroy();
    b.destroy();
  });

  it('canRemoveReference is false only for an id cited in the doc', () => {
    const doc: JSONContent = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [
      { type: 'paragraph', content: [{ type: 'citation', attrs: { items: [{ id: 'a' }, { id: 'b' }], narrative: false } }] },
    ] }] }] };
    expect(canRemoveReference(doc, 'b')).toBe(false);
    expect(canRemoveReference(doc, 'c')).toBe(true);
  });

  it('with the cursor away from a citation, a new citation is made', async () => {
    const cite = { type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: false } };
    setup(fields(para({ type: 'text', text: 'Metin ' }, cite, { type: 'text', text: ' sonra' }), [rayRef]));
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004)'));
    editorOf().commands.setTextSelection(3);
    const dlg = await openDialog();
    expect(within(dlg).queryByText('Referans, imlecin üzerindeki atıfa eklenecek.')).toBeNull();
  });
});

describe('invalid citations in a stored draft (Task 10 carry-over)', () => {
  const bad = (): JSONContent =>
    para(
      { type: 'text', text: 'Metin ' },
      { type: 'citation', attrs: { items: [{ id: 'bad id"><img>' }], narrative: false } },
      { type: 'citation', attrs: { items: [{ id: 'ray2004', locator: { kind: 'evil', value: 1 } }, { id: null }], narrative: 'yes' } },
      { type: 'citation', attrs: { items: 'nope' } },
    );

  it('normalizeDraft keeps the valid items and turns an unusable citation into text', () => {
    const d = normalizeDraft({ ...newDraft(new Date('2026-10-17T10:00:00')), tr: fields(bad(), [rayRef]) });
    expect(d.tr.doc.content![0].content).toEqual([
      { type: 'text', text: 'Metin ' },
      { type: 'text', text: '[geçersiz atıf]' },
      { type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: false } },
      { type: 'text', text: '[geçersiz atıf]' },
    ]);
  });

  it('the editor opens such a draft from Drive without crashing', async () => {
    const api = createMockApi({
      seed: {
        'src/data/categories.json': '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}}]\n',
        'src/data/redirects.json': '[]\n',
      },
    });
    const draft = { ...newDraft(new Date('2026-10-17T10:00:00')), category: 'terapi', tr: fields(bad(), [rayRef]), en: fields(para()) };
    api.state.drafts.set(draft.key, { ...draft, rev: 1 });
    const config = { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' };
    render(
      <Panel.Provider value={{ api, config, store: createSessionStore(localStorage) }}>
        <DeployProvider api={api}>
          <EditorPage postKey={draft.key} />
        </DeployProvider>
      </Panel.Provider>,
    );
    await waitFor(() => expect(editorText()).toContain('(Ray, 2004)'));
    expect(editorText()).toContain('[geçersiz atıf]');
    expect(screen.getByText(/kelime · /)).toBeTruthy();
  });
});
