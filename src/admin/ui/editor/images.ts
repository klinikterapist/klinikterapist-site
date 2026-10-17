/**
 * Images of the post being edited: new uploads (kept in Drive under the draft key) and images
 * already committed in the post folder. Shown as data URLs; handed to the publish changeset.
 */
import type { Api } from '../../api/types';
import { ApiFailure } from '../../api/types';

type Data = { base64: string; inRepo: boolean };

const mime = (name: string) => (name.endsWith('.jpg') ? 'image/jpeg' : 'image/webp');
const nameOf = (src: string) => src.replace(/^\.\//, '');

export class ImageStore {
  private data = new Map<string, Data>();
  private loading = new Map<string, Promise<Data | null>>();

  constructor(
    private api: Api,
    private draftKey: string,
    /** image name → repo path, for a live post */
    private repo: Map<string, string>,
  ) {}

  /** Every name known so far (for unique file names). */
  names(): Set<string> {
    return new Set([...this.repo.keys(), ...this.data.keys()]);
  }

  private load(name: string): Promise<Data | null> {
    const cached = this.data.get(name);
    if (cached) return Promise.resolve(cached);
    let p = this.loading.get(name);
    if (!p) {
      p = (async () => {
        try {
          const { base64 } = await this.api.getImage(this.draftKey, name);
          return { base64, inRepo: false };
        } catch (e) {
          if (!(e instanceof ApiFailure && e.code === 'not_found')) throw e;
        }
        const path = this.repo.get(name);
        if (!path) return null;
        const { files } = await this.api.read([path]);
        return { base64: files[0].content, inRepo: true };
      })().then((d) => {
        if (d) this.data.set(name, d);
        this.loading.delete(name);
        return d;
      });
      this.loading.set(name, p);
    }
    return p;
  }

  async url(src: string): Promise<string | null> {
    const name = nameOf(src);
    const d = await this.load(name).catch(() => null);
    return d ? `data:${mime(name)};base64,${d.base64}` : null;
  }

  /** Upload to Drive first, so a reload on another device still finds the image. */
  async add(name: string, base64: string): Promise<void> {
    await this.api.putImage(this.draftKey, name, base64);
    this.data.set(name, { base64, inRepo: false });
  }

  /** Data of the named images for publishing; a missing image is left out (publish then refuses). */
  async forPublish(names: Iterable<string>): Promise<Map<string, Data>> {
    const out = new Map<string, Data>();
    for (const n of names) {
      const d = await this.load(n);
      if (d) out.set(n, d);
    }
    return out;
  }

  /** Before unpublishing: copy the committed images into Drive so the draft keeps them. */
  async copyRepoImagesToDrive(): Promise<void> {
    for (const name of this.repo.keys()) {
      const d = await this.load(name);
      if (d?.inRepo) {
        await this.api.putImage(this.draftKey, name, d.base64);
        this.data.set(name, { base64: d.base64, inRepo: false });
      }
    }
  }
}
