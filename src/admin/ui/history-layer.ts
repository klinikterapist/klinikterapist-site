/**
 * Lets an overlay (preview, version history, crop dialogs) join the browser history, so the phone's
 * "back" gesture closes the overlay instead of leaving the page underneath.
 */
import { useCallback, useEffect, useRef } from 'react';

type Layer = { id: string; closed: boolean; releasing: boolean };

/** Open layers, bottom first. Only the top one reacts to "back". */
const stack: Layer[] = [];
let counter = 0;

const onTop = (layer: Layer) => (history.state as { layer?: string } | null)?.layer === layer.id;

function release(layer: Layer) {
  const at = stack.indexOf(layer);
  if (at >= 0) stack.splice(at, 1);
  // Take our own entry back off the stack, unless something was opened on top of it since.
  if (!layer.closed && onTop(layer)) history.back();
  layer.closed = true;
}

/**
 * Call while an overlay is mounted. Pushes one history entry; "back" (popstate) calls `onClose`.
 * Use the returned `close` for the overlay's own close paths (button, Esc): it calls `onClose` and
 * removes the entry again, so no stray entry is left behind.
 */
export function useHistoryLayer(onClose: () => void): () => void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const layerRef = useRef<Layer | null>(null);

  useEffect(() => {
    // React may unmount and remount at once (StrictMode): keep the same entry then.
    let layer = layerRef.current;
    if (layer && layer.releasing && !layer.closed) {
      layer.releasing = false;
    } else {
      layer = { id: `layer-${++counter}-${Math.random().toString(36).slice(2)}`, closed: false, releasing: false };
      layerRef.current = layer;
      stack.push(layer);
      history.pushState({ layer: layer.id }, '', location.href);
    }
    const mine = layer;
    const onPop = () => {
      if (mine.closed || stack[stack.length - 1] !== mine || onTop(mine)) return;
      mine.closed = true;
      stack.splice(stack.indexOf(mine), 1);
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (mine.closed) return;
      mine.releasing = true;
      queueMicrotask(() => mine.releasing && release(mine));
    };
  }, []);

  return useCallback(() => {
    const layer = layerRef.current;
    if (layer?.closed) return; // "back" already closed it
    if (layer) release(layer);
    onCloseRef.current();
  }, []);
}
