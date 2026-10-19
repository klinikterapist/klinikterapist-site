/** A GitHub seed and a complete draft for the backend publish tests. */
import type { Draft, LangFields } from '../../../src/admin/api/types';

export const ghProps = { GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'klinikterapist/klinikterapist-site', GITHUB_BRANCH: 'main' };
export const ghSeed = {
  'src/data/categories.json': '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}}]\n',
  'src/data/redirects.json': '[]\n',
};

const lang = (title: string, slug: string, figure = false): LangFields => ({
  title, subtitle: '', seoTitle: '', slug, slugTouched: true, description: 'Açıklama', focusKeyword: 'kelime', coverAlt: '', references: [],
  doc: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Metin.' }] },
      ...(figure ? [{ type: 'figure', attrs: { src: './yaprak.webp', alt: 'Yaprak', caption: '' } }] : []),
    ],
  },
});
export const completeDraft = (over: Partial<Draft> = {}): Draft => ({
  key: 'taslak-abc', rev: 0, updatedAt: '', published: false, category: 'terapi', cover: null, coverOriginal: null, coverCrop: null, publishedAt: '2026-10-17',
  tr: lang('Kaygı', 'kaygi', true), en: lang('Anxiety', 'anxiety'), ...over,
});
