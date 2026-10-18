/**
 * The post's share buttons (ShareButtons.astro): an Instagram story image, copy link, WhatsApp.
 *
 * The web cannot post to an Instagram story, so the story button draws a 1080×1920 image on a canvas
 * (the page's day or night palette, the post title in the serif heading font, the flat sun mark and the
 * site address) and hands it to the device's share sheet (`navigator.share({ files })`, where the reader
 * picks Instagram). Where files cannot be shared it downloads the PNG and shows a one-line hint.
 * Everything runs in the browser: no third-party script, no upload.
 */
import { PALETTE, type ThemeName } from './palette';
import type { SunPaths } from './sun-paths';

export const STORY = { width: 1080, height: 1920 } as const;

/** WhatsApp's own share link: the title and the address as one message. */
export function whatsappUrl(title: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
}

/**
 * Greedy word wrap. A word wider than the line is kept whole (it overflows a little rather than
 * breaking mid-word). Past `maxLines` the last line ends with "…".
 */
export function wrapLines(text: string, measure: (s: string) => number, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.includes(' ') && measure(`${last}…`) > maxWidth) last = last.slice(0, last.lastIndexOf(' '));
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** The parts of CanvasRenderingContext2D the story uses (a fake one in the unit tests). */
export type StoryContext = Pick<
  CanvasRenderingContext2D,
  'fillRect' | 'fillText' | 'measureText' | 'save' | 'restore' | 'translate' | 'scale' | 'fill' | 'stroke'
> & {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: CanvasLineCap;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

export type StoryOptions = {
  title: string;
  theme: ThemeName;
  /** Shown at the bottom, e.g. "klinikterapist.com". */
  host: string;
  sun: SunPaths;
  /** `new Path2D(d)` in the browser. */
  path: (d: string) => Path2D;
  serif?: string;
  sans?: string;
};

export const STORY_FONTS = { serif: "'Fraunces Variable', Georgia, serif", sans: "'DM Sans Variable', system-ui, sans-serif" };

export function drawStory(ctx: StoryContext, o: StoryOptions): { lines: string[]; fontSize: number } {
  const p = PALETTE[o.theme];
  const serif = o.serif ?? STORY_FONTS.serif;
  const sans = o.sans ?? STORY_FONTS.sans;
  const { width: W, height: H } = STORY;

  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);

  // The flat sun (never rotated), centred in the upper third, clear of Instagram's top bar.
  const sunSize = 300;
  ctx.save();
  ctx.translate((W - sunSize) / 2, 330);
  ctx.scale(sunSize / 100, sunSize / 100);
  ctx.fillStyle = p['sun-halo'];
  ctx.fill(o.path(o.sun.halo));
  ctx.fillStyle = p['sun-disc'];
  ctx.fill(o.path(o.sun.disc));
  ctx.strokeStyle = p['sun-face'];
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  for (const d of o.sun.face) ctx.stroke(o.path(d));
  ctx.restore();

  // The title: as large as fits in six lines, centred.
  const maxWidth = W - 2 * 110;
  let fontSize = 96;
  let lines: string[] = [];
  for (; fontSize >= 56; fontSize -= 8) {
    ctx.font = `500 ${fontSize}px ${serif}`;
    lines = wrapLines(o.title, (s) => ctx.measureText(s).width, maxWidth, 6);
    if (lines.length <= 5 || fontSize === 56) break;
  }
  const lineHeight = Math.round(fontSize * 1.18);
  const top = 780;
  ctx.fillStyle = p.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, top + i * lineHeight));

  // A short sunflower rule under the title, then the site address near the bottom.
  ctx.fillStyle = p['quote-rule'];
  ctx.fillRect(W / 2 - 60, top + lines.length * lineHeight + 50, 120, 8);
  ctx.fillStyle = p.muted;
  ctx.font = `600 44px ${sans}`;
  ctx.fillText(o.host, W / 2, H - 300);
  return { lines, fontSize };
}

export type ShareTexts = { copied: string; downloaded: string };

type CanvasLike = { width: number; height: number; getContext(type: '2d'): unknown; toBlob(cb: (b: Blob | null) => void, type?: string): void };

export type ShareDeps = {
  navigator: Pick<Navigator, 'share' | 'canShare' | 'clipboard'>;
  document: Document;
  sun: SunPaths;
  createCanvas: () => CanvasLike;
  path: (d: string) => Path2D;
  /** Saves a file the reader can find again (an <a download> click in the browser). */
  download: (blob: Blob, name: string) => void;
  /** Waits for the heading font so the canvas does not fall back to Georgia. */
  fontsReady?: () => Promise<unknown>;
};

const theme = (doc: Document): ThemeName => (doc.documentElement.dataset.theme === 'dark' ? 'night' : 'day');

/** Builds the PNG for the current theme; cached per theme so a click can share at once. */
export function storyMaker(title: string, host: string, deps: ShareDeps) {
  const cache = new Map<ThemeName, Promise<Blob>>();
  return (): Promise<Blob> => {
    const t = theme(deps.document);
    let job = cache.get(t);
    if (!job) {
      job = (async () => {
        await deps.fontsReady?.();
        const canvas = deps.createCanvas();
        canvas.width = STORY.width;
        canvas.height = STORY.height;
        const ctx = canvas.getContext('2d') as StoryContext | null;
        if (!ctx) throw new Error('no canvas');
        drawStory(ctx, { title, theme: t, host, sun: deps.sun, path: deps.path });
        return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));
      })();
      job.catch(() => cache.delete(t));
      cache.set(t, job);
    }
    return job;
  };
}

/** Wires one `[data-share]` box. Buttons that need a missing browser feature stay hidden. */
export function initShare(box: HTMLElement, deps: ShareDeps): void {
  const title = box.dataset.title ?? '';
  const url = box.dataset.url ?? deps.document.location?.href ?? '';
  const host = box.dataset.host ?? '';
  const file = box.dataset.file ?? 'klinikterapist-hikaye.png';
  const texts = JSON.parse(box.dataset.texts ?? '{}') as ShareTexts;
  const status = box.querySelector<HTMLElement>('[data-share-status]')!;
  const copyBtn = box.querySelector<HTMLButtonElement>('[data-share-copy]');
  const storyBtn = box.querySelector<HTMLButtonElement>('[data-share-story]');
  let clear: ReturnType<typeof setTimeout> | undefined;
  /** The buttons sit in hidden list items (`[data-share-item]`) until their feature is found. */
  const show = (btn: HTMLElement) => btn.closest<HTMLElement>('[data-share-item]')?.removeAttribute('hidden');
  const say = (text: string) => {
    status.textContent = text;
    clearTimeout(clear);
    clear = setTimeout(() => (status.textContent = ''), 6000);
  };

  if (copyBtn && deps.navigator.clipboard?.writeText) {
    show(copyBtn);
    const label = copyBtn.querySelector<HTMLElement>('.label') ?? copyBtn;
    const idle = label.textContent ?? '';
    copyBtn.addEventListener('click', async () => {
      try {
        await deps.navigator.clipboard.writeText(url);
      } catch {
        return; // Copy refused (permissions): leave the page as it is.
      }
      label.textContent = texts.copied;
      say(texts.copied);
      setTimeout(() => (label.textContent = idle), 2500);
    });
  }

  if (storyBtn && deps.createCanvas().getContext('2d')) {
    show(storyBtn);
    const make = storyMaker(title, host, deps);
    // Drawn ahead (on first hover, touch or focus) so the share sheet opens inside the click's gesture.
    const warm = () => void make().catch(() => {});
    for (const ev of ['pointerenter', 'touchstart', 'focus'] as const) storyBtn.addEventListener(ev, warm, { once: true, passive: true });
    storyBtn.addEventListener('click', async () => {
      storyBtn.disabled = true;
      try {
        const blob = await make();
        const png = new File([blob], file, { type: 'image/png' });
        if (typeof deps.navigator.share === 'function' && deps.navigator.canShare?.({ files: [png] })) {
          try {
            await deps.navigator.share({ files: [png], title });
            return;
          } catch (e) {
            if ((e as Error).name === 'AbortError') return; // The reader closed the sheet.
          }
        }
        deps.download(blob, file);
        say(texts.downloaded);
      } catch {
        /* No image could be drawn: nothing to offer. */
      } finally {
        storyBtn.disabled = false;
      }
    });
  }
}
