/**
 * Lets an overlay (preview, version history, crop dialogs, the editor's confirms and "⋯" menu) join the browser history, so the phone's
 * "back" gesture closes the overlay instead of leaving the page underneath.
 */
import { useCallback, useEffect, useRef } from 'react';

type Layer = { id: string; closed: boolean; releasing: boolean };

/** Open layers, bottom first. Only the top one reacts to "back". */
const stack: Layer[] = [];
let counter = 0;

const onTop = (layer: Layer) => (history.state as { layer?: string } | null)?.layer === layer.id;

/**
 * `history.back()` is asynchronous. While one of ours is on its way, a new layer waits before it
 * pushes its entry (or that back would pop the new entry), and the popstate it causes is nobody's "back".
 */
let pendingBacks = 0;
let waiting: Array<() => void> = [];
let ours: Event | null = null;

function settle() {
  pendingBacks = 0;
  const run = waiting;
  waiting = [];
  run.forEach((f) => f());
}

if (typeof window !== 'undefined') {
  // Registered before any layer's own listener, so it runs first.
  window.addEventListener('popstate', (e) => {
    if (pendingBacks === 0) return;
    ours = e;
    if (--pendingBacks === 0) settle();
  });
}

let backs = 0;

function goBack() {
  pendingBacks++;
  history.back();
  // Safety net: never leave new layers waiting if a popstate does not arrive.
  const mine = ++backs;
  setTimeout(() => mine === backs && pendingBacks > 0 && settle(), 1000);
}

function whenSettled(f: () => void) {
  if (pendingBacks === 0) f();
  else waiting.push(f);
}

function release(layer: Layer) {
  const at = stack.indexOf(layer);
  if (at >= 0) stack.splice(at, 1);
  // Take our own entry back off the stack, unless something was opened on top of it since.
  if (!layer.closed && onTop(layer)) goBack();
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
      const pushing = layer;
      whenSettled(() => !pushing.closed && history.pushState({ layer: pushing.id }, '', location.href));
    }
    const mine = layer;
    const onPop = (e: Event) => {
      if (e === ours || mine.closed || stack[stack.length - 1] !== mine || onTop(mine)) return;
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
