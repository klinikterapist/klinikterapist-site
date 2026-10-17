/**
 * "Önizle": the selected language as the site's post page shows it, full screen. It always uses
 * the site's light look, whatever the panel theme is, and never saves or publishes anything.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../../../lib/schemas';
import type { Draft } from '../../api/types';
import { renderPreviewHtml } from '../../lib/preview';
import { Button, Spinner } from '../kit';
import type { ImageStore } from './images';

type Node = { type?: string; attrs?: Record<string, unknown>; content?: Node[] };

/** Image names the preview needs: the cover and every figure of this language. */
export function previewImageNames(draft: Draft, lang: Lang): string[] {
  const out = new Set<string>();
  if (draft.cover) out.add(draft.cover);
  const walk = (n: Node) => {
    if (n.type === 'figure' && typeof n.attrs?.src === 'string') out.add(n.attrs.src.replace(/^\.\//, ''));
    n.content?.forEach(walk);
  };
  walk(draft[lang].doc as Node);
  return [...out].filter(Boolean);
}

export function PreviewDialog({ draft, lang, images, onClose }: { draft: Draft; lang: Lang; images: Pick<ImageStore, 'url'>; onClose: () => void }) {
  const [urls, setUrls] = useState<Map<string, string> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const names = useMemo(() => previewImageNames(draft, lang), [draft, lang]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(names.map(async (n) => [n, await images.url(n)] as const));
      if (alive) setUrls(new Map(entries.filter((e): e is readonly [string, string] => !!e[1])));
    })();
    return () => {
      alive = false;
    };
  }, [names, images]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  const html = useMemo(() => (urls ? renderPreviewHtml(draft, lang, (n) => urls.get(n) ?? null) : ''), [urls, draft, lang]);

  return (
    <div className="preview-root" ref={rootRef} role="dialog" aria-modal="true" aria-label="Önizleme">
      <div className="preview-bar">
        <span>{`Önizleme · ${lang === 'tr' ? 'Türkçe' : 'İngilizce'} · Henüz yayınlanmadı`}</span>
        <Button onClick={onClose}>
          Kapat
        </Button>
      </div>
      <div className="preview-scroll">
        <article className="preview-page container-text">{urls ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <Spinner label="Önizleme hazırlanıyor…" />}</article>
      </div>
    </div>
  );
}
