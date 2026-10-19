/**
 * Planned publishing: the hourly trigger publishes every draft whose `scheduledAt` has passed,
 * through the panel's own publish flow. A failure leaves the draft planned and records a Turkish
 * message for the panel; the next hour tries again. A planned post's text never reaches GitHub
 * before its time: it waits in Drive like any draft.
 */
import { ApiFailure } from '../../src/admin/api/types';
import { PublishError } from '../../src/admin/lib/publish';
import { publishDraft } from '../../src/admin/lib/publish-flow';
import { istanbulDay } from '../../src/lib/stats-wire';
import type { Gas } from './gas';
import { SCHEDULE_ERROR, getDraft, listDrafts } from './drive';
import { serverApi } from './server-api';

const FAILED = 'Yayınlanamadı. Bir saat sonra tekrar denenecek.';

export async function runScheduled(gas: Gas, now: Date): Promise<{ published: string[]; failed: { key: string; message: string }[] }> {
  const due = listDrafts(gas)
    .drafts.filter((d) => d.scheduledAt && Date.parse(d.scheduledAt) <= now.getTime())
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  const published: string[] = [];
  const failed: { key: string; message: string }[] = [];
  for (const s of due) {
    try {
      // The last saved copy is what goes live; it may have been re-planned since the list was cached.
      const { draft } = getDraft(gas, { key: s.key });
      if (!draft.scheduledAt || Date.parse(draft.scheduledAt) > now.getTime()) continue;
      const day = istanbulDay(Date.parse(draft.scheduledAt));
      await publishDraft(serverApi(gas), { ...draft, publishedAt: day, scheduledAt: null }, { now });
      gas.props.del(SCHEDULE_ERROR(s.key));
      published.push(s.key);
    } catch (e) {
      const message = e instanceof PublishError || e instanceof ApiFailure ? e.message : FAILED;
      if (!(e instanceof PublishError || e instanceof ApiFailure)) gas.log(`schedule ${s.key}: ${e instanceof Error ? e.message : String(e)}`);
      gas.props.set(SCHEDULE_ERROR(s.key), message);
      failed.push({ key: s.key, message });
    }
  }
  return { published, failed };
}
