// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { drawStory, initShare, STORY, whatsappUrl, wrapLines, type ShareDeps, type StoryContext } from '../../src/lib/share';
import { parseSun } from '../../src/lib/sun-paths';
import { PALETTE } from '../../src/lib/palette';

const sun = parseSun(readFileSync('src/assets/brand/sun.svg', 'utf8'));
/** 10 px per character: easy widths to reason about. */
const measure = (s: string) => s.length * 10;

describe('whatsappUrl', () => {
  it('sends the title and the address as one message', () => {
    expect(whatsappUrl('Kaygı & sen', 'https://klinikterapist.com/blog/x/')).toBe(
      'https://wa.me/?text=Kayg%C4%B1%20%26%20sen%20https%3A%2F%2Fklinikterapist.com%2Fblog%2Fx%2F',
    );
  });
});

describe('wrapLines', () => {
  it('wraps on words within the width', () => {
    expect(wrapLines('bir iki üç dört beş', measure, 70, 5)).toEqual(['bir iki', 'üç dört', 'beş']);
  });
  it('keeps a too-long word whole', () => {
    expect(wrapLines('kısa çokuzunbirkelimeburada son', measure, 80, 5)).toEqual(['kısa', 'çokuzunbirkelimeburada', 'son']);
  });
  it('ends the last allowed line with an ellipsis', () => {
    const lines = wrapLines('a1 b2 c3 d4 e5 f6 g7 h8', measure, 50, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(50);
  });
});

function fakeCtx() {
  const calls: { op: string; args: unknown[]; fill?: unknown; stroke?: unknown; font?: string }[] = [];
  const ctx = {
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    font: '',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    // Half the font size per character.
    measureText: (s: string) => ({ width: s.length * Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 80) * 0.5 }) as TextMetrics,
  } as unknown as StoryContext;
  for (const op of ['fillRect', 'fillText', 'save', 'restore', 'translate', 'scale', 'fill', 'stroke'] as const) {
    (ctx as unknown as Record<string, unknown>)[op] = (...args: unknown[]) =>
      calls.push({ op, args, fill: ctx.fillStyle, stroke: ctx.strokeStyle, font: ctx.font });
  }
  return { ctx, calls };
}

describe('drawStory', () => {
  const path = (d: string) => ({ d }) as unknown as Path2D;

  it('fills the whole 1080×1920 frame in the theme colour and draws the sun, title and address', () => {
    for (const theme of ['day', 'night'] as const) {
      const { ctx, calls } = fakeCtx();
      const out = drawStory(ctx, { title: 'Kaygıyla yaşamak', theme, host: 'klinikterapist.com', sun, path });
      expect(calls[0]).toMatchObject({ op: 'fillRect', args: [0, 0, STORY.width, STORY.height], fill: PALETTE[theme].bg });
      const fills = calls.filter((c) => c.op === 'fill');
      expect(fills.map((c) => (c.args[0] as { d: string }).d)).toEqual([sun.halo, sun.disc]);
      expect(calls.filter((c) => c.op === 'stroke')).toHaveLength(sun.face.length);
      expect(calls.filter((c) => c.op === 'stroke').every((c) => c.stroke === PALETTE[theme]['sun-face'])).toBe(true);
      // Flat: scaled and moved, never rotated.
      expect(calls.some((c) => c.op === 'scale')).toBe(true);
      const texts = calls.filter((c) => c.op === 'fillText');
      expect(texts.map((c) => c.args[0])).toEqual([...out.lines, 'klinikterapist.com']);
      expect(texts[0].fill).toBe(PALETTE[theme].text);
      expect(texts[0].font).toContain('Fraunces');
      expect(out.lines.join(' ')).toBe('Kaygıyla yaşamak');
    }
  });

  it('shrinks a long title and keeps it within the side margins', () => {
    const { ctx } = fakeCtx();
    const long = 'Gece uyanmaları ve sabaha karşı gelen kaygı üzerine uzun bir başlık daha nasıl olur diye düşünürken';
    const out = drawStory(ctx, { title: long, theme: 'day', host: 'x', sun, path });
    expect(out.fontSize).toBeLessThan(96);
    expect(out.lines.length).toBeLessThanOrEqual(6);
    for (const l of out.lines) expect(l.length * out.fontSize * 0.5, l).toBeLessThanOrEqual(STORY.width - 220);
  });
});

describe('share buttons', () => {
  let box: HTMLElement;
  beforeEach(() => {
    document.documentElement.dataset.theme = 'dark';
    document.body.innerHTML = `
      <div data-share data-title="Başlık" data-url="https://klinikterapist.com/blog/x/" data-host="klinikterapist.com"
           data-file="klinikterapist-hikaye.png" data-texts='{"copied":"Kopyalandı","downloaded":"Görsel indirildi"}'>
        <ul>
          <li data-share-item hidden><button data-share-story><span class="label">IG</span></button></li>
          <li data-share-item hidden><button data-share-copy><span class="label">Kopyala</span></button></li>
          <li><a href="https://wa.me/?text=x">WA</a></li>
        </ul>
        <p data-share-status role="status"></p>
      </div>`;
    box = document.querySelector('[data-share]')!;
  });

  const deps = (over: Partial<ShareDeps> = {}): ShareDeps & { drawn: string[] } => {
    const drawn: string[] = [];
    return {
      drawn,
      navigator: { clipboard: { writeText: vi.fn(async () => {}) } } as unknown as ShareDeps['navigator'],
      document,
      sun,
      path: (d) => ({ d }) as unknown as Path2D,
      createCanvas: () => {
        const { ctx, calls } = fakeCtx();
        return {
          width: 0,
          height: 0,
          getContext: () => ctx,
          toBlob(cb: (b: Blob | null) => void) {
            drawn.push(String(calls[0]?.fill));
            cb(new Blob(['png'], { type: 'image/png' }));
          },
        };
      },
      download: vi.fn(),
      ...over,
    };
  };
  const items = () => [...box.querySelectorAll<HTMLElement>('[data-share-item]')].map((li) => !li.hidden);
  const status = () => box.querySelector('[data-share-status]')!.textContent;
  const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };

  it('shows only what the browser can do', () => {
    initShare(box, deps({ navigator: {} as ShareDeps['navigator'], createCanvas: () => ({ width: 0, height: 0, getContext: () => null, toBlob() {} }) }));
    expect(items()).toEqual([false, false]);
    initShare(box, deps());
    expect(items()).toEqual([true, true]);
  });

  it('copy link writes the address and announces "Kopyalandı"', async () => {
    const d = deps();
    initShare(box, d);
    box.querySelector<HTMLButtonElement>('[data-share-copy]')!.click();
    await flush();
    expect(d.navigator.clipboard.writeText).toHaveBeenCalledWith('https://klinikterapist.com/blog/x/');
    expect(status()).toBe('Kopyalandı');
    expect(box.querySelector('[data-share-copy] .label')!.textContent).toBe('Kopyalandı');
  });

  it('story: shares the PNG through the share sheet where files can be shared', async () => {
    const share = vi.fn(async () => {});
    const d = deps({ navigator: { share, canShare: () => true, clipboard: undefined } as unknown as ShareDeps['navigator'] });
    initShare(box, d);
    box.querySelector<HTMLButtonElement>('[data-share-story]')!.click();
    await flush();
    expect(share).toHaveBeenCalledTimes(1);
    const arg = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(arg.files).toHaveLength(1);
    expect(arg.files![0].name).toBe('klinikterapist-hikaye.png');
    expect(arg.files![0].type).toBe('image/png');
    expect(d.download).not.toHaveBeenCalled();
    // Night theme on the page: the story uses the night palette.
    expect(d.drawn).toEqual([PALETTE.night.bg]);
  });

  it('story: downloads the PNG with a hint where files cannot be shared', async () => {
    const d = deps({ navigator: { canShare: () => false, clipboard: undefined } as unknown as ShareDeps['navigator'] });
    initShare(box, d);
    box.querySelector<HTMLButtonElement>('[data-share-story]')!.click();
    await flush();
    expect(d.download).toHaveBeenCalledTimes(1);
    expect((d.download as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('klinikterapist-hikaye.png');
    expect(status()).toBe('Görsel indirildi');
  });

  it('story: closing the share sheet does nothing more; another share error falls back to the download', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    const d1 = deps({ navigator: { share: vi.fn(async () => { throw abort; }), canShare: () => true } as unknown as ShareDeps['navigator'] });
    initShare(box, d1);
    box.querySelector<HTMLButtonElement>('[data-share-story]')!.click();
    await flush();
    expect(d1.download).not.toHaveBeenCalled();

    document.body.innerHTML = box.outerHTML;
    box = document.querySelector('[data-share]')!;
    const denied = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    const d2 = deps({ navigator: { share: vi.fn(async () => { throw denied; }), canShare: () => true } as unknown as ShareDeps['navigator'] });
    initShare(box, d2);
    box.querySelector<HTMLButtonElement>('[data-share-story]')!.click();
    await flush();
    expect(d2.download).toHaveBeenCalledTimes(1);
  });
});
