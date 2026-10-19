/**
 * The cover under the subtitle, at the site's fixed 16:9. A new upload opens "Kapağı ayarla"
 * first; the uncropped original is kept as `cover-orig.<ext>`, so the frame can be changed later.
 * The Ayarlar panel uses the same actions through `useCover`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Draft } from '../../api/types';
import type { Lang } from '../../../lib/schemas';
import { LANG_LABEL } from '../../lib/draft';
import { renderCrop, type CropArea } from '../../lib/crop';
import { IMAGE_PRESETS, ImageError, resizeImage } from '../../lib/image';
import { Button } from '../kit';
import { CropDialog } from './CropDialog';
import type { ImageStore } from './images';

export type CoverPatch = Partial<Pick<Draft, 'cover' | 'coverOriginal' | 'coverCrop'>>;

export const COVER_ASPECT = 16 / 9;
const COVER_OUT = { w: 1600, h: 900 };

type CoverProps = {
  draft: Pick<Draft, 'cover' | 'coverOriginal' | 'coverCrop'>;
  images: Pick<ImageStore, 'url' | 'add'>;
  /** Bumped after a new cover image, so every view of it reloads. */
  coverVersion: number;
  onShared: (patch: CoverPatch) => void;
  onCoverUploaded: () => void;
  onError: (message: string | null) => void;
};

/** What "Kapağı ayarla" is cropping: a fresh upload (not stored yet) or the stored original. */
type Source = { url: string; base64: string; origName: string; upload: boolean; initial: CropArea | null };

const base64Of = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);
const extOf = (name: string) => (name.endsWith('.jpg') ? 'jpg' : 'webp');

export function useCover({ draft, images, coverVersion, onShared, onCoverUploaded, onError }: CoverProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (draft.cover) images.url(draft.cover).then((u) => alive && setUrl(u));
    else setUrl(null);
    return () => {
      alive = false;
    };
  }, [draft.cover, images, coverVersion]);

  const fail = (e: unknown, fallback: string) => onError(e instanceof ImageError ? e.message : fallback);

  /** A new photo: kept in memory until "Uygula", so "Vazgeç" leaves the current cover as it was. */
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    onError(null);
    try {
      const orig = await resizeImage(file, IMAGE_PRESETS.original);
      setSource({ url: `data:${orig.type};base64,${orig.base64}`, base64: orig.base64, origName: `cover-orig.${orig.ext}`, upload: true, initial: null });
    } catch (e) {
      fail(e, 'Kapak görseli yüklenemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  /** Re-open the frame. An older cover with no original becomes its own original on the first "Uygula". */
  const adjust = async () => {
    if (!draft.cover) return;
    setBusy(true);
    onError(null);
    try {
      const origName = draft.coverOriginal ?? `cover-orig.${extOf(draft.cover)}`;
      const dataUrl = await images.url(draft.coverOriginal ?? draft.cover);
      if (!dataUrl) throw new ImageError('Kapak görseli açılamadı. Görseli yeniden yükleyin.');
      setSource({ url: dataUrl, base64: base64Of(dataUrl), origName, upload: !draft.coverOriginal, initial: draft.coverOriginal ? draft.coverCrop : null });
    } catch (e) {
      fail(e, 'Kapak görseli açılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const apply = async (area: CropArea) => {
    if (!source) return;
    setBusy(true);
    onError(null);
    try {
      const out = await renderCrop(source.base64, area, COVER_OUT, 'image/webp', 0.82);
      if (source.upload) await images.add(source.origName, source.base64);
      const name = `cover.${out.ext}`;
      await images.add(name, out.base64);
      onShared({ cover: name, coverOriginal: source.origName, coverCrop: area });
      onCoverUploaded();
      setSource(null);
    } catch (e) {
      fail(e, 'Kapak kaydedilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => onShared({ cover: null, coverOriginal: null, coverCrop: null });

  const elements: ReactNode = (
    <>
      <input ref={input} type="file" accept="image/*" hidden data-testid="cover-input" onChange={(e) => upload(e.target.files?.[0])} />
      {source && (
        <CropDialog title="Kapağı ayarla" imageUrl={source.url} aspect={COVER_ASPECT} initial={source.initial} onApply={apply} onClose={() => setSource(null)}>
          <p className="k-hint">Sitede kapak her zaman bu oranda (16:9) görünür. Sürükleyerek yerini, kaydırıcıyla yakınlığını ayarlayın.</p>
        </CropDialog>
      )}
    </>
  );

  return { url, busy, pick: () => input.current?.click(), adjust, remove, elements };
}

/** The cover block between the subtitle and the text. */
export function CoverBlock(props: CoverProps & { lang: Lang; alt: string }) {
  const c = useCover(props);
  return (
    <>
      {props.draft.cover ? (
        <figure className="ed-cover" aria-busy={c.busy || undefined}>
          {c.url ? <img className="ed-cover-img" src={c.url} alt={props.alt} lang={props.lang} /> : <div className="ed-cover-img ed-cover-loading" />}
          <div className="ed-cover-actions" role="group" aria-label={`Kapak görseli (${LANG_LABEL[props.lang]})`}>
            <Button onClick={c.adjust} disabled={c.busy}>
              Kapağı ayarla
            </Button>
            <Button onClick={c.pick} disabled={c.busy}>
              Değiştir
            </Button>
            <Button variant="ghost" onClick={c.remove} disabled={c.busy}>
              Kaldır
            </Button>
          </div>
        </figure>
      ) : (
        <button type="button" className="ed-cover-empty" onClick={c.pick} disabled={c.busy}>
          {c.busy ? 'Görsel hazırlanıyor…' : 'Kapak görseli ekle'}
          <span className="ed-cover-hint">16:9 oranında gösterilir</span>
        </button>
      )}
      {c.elements}
    </>
  );
}
