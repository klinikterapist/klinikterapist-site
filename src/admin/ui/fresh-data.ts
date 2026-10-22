/** A number that goes up when the panel's memory of the appointment lists changed (api/cache.ts); screens read again on it. */
import { useEffect, useState } from 'react';
import type { Api } from '../api/types';
import { onFresh } from '../api/cache';

export function useFreshData(api: Api): number {
  const [n, setN] = useState(0);
  useEffect(() => onFresh(api, () => setN((x) => x + 1)), [api]);
  return n;
}
