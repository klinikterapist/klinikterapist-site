/**
 * Post images written by the admin panel as `![alt](./x.webp "Caption")`, alone in a paragraph,
 * render as `<figure><img><figcaption>Caption</figcaption></figure>`. Runs as an mdast plugin of
 * Astro's Markdown processor (Sätteri), so the image stays an mdast image and Astro still
 * optimizes it.
 */
import type { MdastPluginDefinition } from 'satteri';
import { parseFrameOpen, publicFrameOpen } from './figure-frame';

type Child = { type: string; value?: string; title?: string | null };

/** The caption of an image alone in a paragraph (`''` when untitled), or null when not alone. */
export function loneImageCaption(children: readonly Child[]): string | null {
  const parts = children.filter((c) => !(c.type === 'text' && !(c.value ?? '').trim()));
  if (parts.length !== 1 || parts[0].type !== 'image') return null;
  return (parts[0].title ?? '').trim();
}

export const figurePlugin: MdastPluginDefinition = {
  name: 'post-figure',
  // A figure wrapper reaches visitors with its shape and size only: the crop and the original's
  // name are for the panel (the original is never built or served).
  html(node, ctx) {
    const frame = parseFrameOpen(String(node.value ?? '').trim());
    if (frame) ctx.setProperty(node, 'value', publicFrameOpen(frame));
  },
  paragraph(node, ctx) {
    const caption = loneImageCaption(node.children as Child[]);
    if (caption === null) return;
    const image = node.children.find((c) => c.type === 'image');
    if (image) ctx.setProperty(image, 'title', null);
    ctx.setProperty(node, 'data', { hName: 'figure' });
    if (caption) {
      ctx.appendChild(node, { type: 'figcaption', data: { hName: 'figcaption' }, children: [{ type: 'text', value: caption }] });
    }
  },
};
