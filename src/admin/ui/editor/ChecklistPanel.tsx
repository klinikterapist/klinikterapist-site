/**
 * Kontrol listesi panel: everything a post needs before it can be published (required) and what is
 * recommended (spec §5.4.1). Clicking an item goes to the panel and field it is about.
 */
import type { ChecklistItem } from '../../lib/checklist';
import { HELP } from '../../lib/help-texts';
import { HelpTip } from '../kit';

export function ChecklistPanel({ items, flagMissing, onGo }: { items: ChecklistItem[]; flagMissing: boolean; onGo: (item: ChecklistItem) => void }) {
  const required = items.filter((i) => i.required);
  const recommended = items.filter((i) => !i.required);
  const row = (i: ChecklistItem) => (
    <li key={i.id} data-done={i.done} className={`checklist-item ${i.done ? 'is-done' : ''} ${flagMissing && i.required && !i.done ? 'is-flagged' : ''}`}>
      <button type="button" onClick={() => onGo(i)}>
        <span className="checklist-mark" aria-hidden="true">
          {i.done ? '✓' : '○'}
        </span>
        <span>{i.label}</span>
        <span className="k-visually-hidden">{i.done ? ' (tamam)' : ' (eksik)'}</span>
      </button>
    </li>
  );
  return (
    <div className="rail-panel-body">
      <div className="checklist" data-field="checklist">
        <div className="k-label-row">
          <h3>Yayın kontrol listesi</h3>
          <HelpTip label="Yayın kontrol listesi">{HELP.checklist}</HelpTip>
        </div>
        <ul aria-label="Yayın kontrol listesi">
          <li className="checklist-group">Zorunlu</li>
          {required.map(row)}
          <li className="checklist-group">Önerilen (yayını engellemez)</li>
          {recommended.map(row)}
        </ul>
      </div>
    </div>
  );
}
