/**
 * "Önizle": the selected language as the site's post page shows it, full screen. It always uses
 * the site's light look, whatever the panel theme is, and never saves or publishes anything.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../../../lib/schemas';
import type { Draft } from '../../api/types';
import { renderPreviewHtml } from '../../lib/preview';
import { Button, Spinner } from '../kit';
import { useHistoryLayer } from '../history-layer';
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
  const close = useHistoryLayer(onClose);

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
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex=\'-1\'])') ?? []);
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close();
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!rootRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [close]);

  const html = useMemo(() => (urls ? renderPreviewHtml(draft, lang, (n) => urls.get(n) ?? null) : ''), [urls, draft, lang]);

  return (
    <div className="preview-root" ref={rootRef} role="dialog" aria-modal="true" aria-label="Önizleme">
      <div className="preview-bar">
        <span>{`Önizleme · ${lang === 'tr' ? 'Türkçe' : 'İngilizce'} · Henüz yayınlanmadı`}</span>
        <Button onClick={close}>
          ← Düzenlemeye dön
        </Button>
      </div>
      <div className="preview-scroll">
        <article className="preview-page">{urls ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <Spinner label="Önizleme hazırlanıyor…" />}</article>
      </div>
    </div>
  );
}
