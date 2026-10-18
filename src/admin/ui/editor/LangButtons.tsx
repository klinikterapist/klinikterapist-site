/**
 * "Türkçe Sayfa" / "English Page" switch in the editor's top bar: flag, name and ✓/⚠ for whether that
 * language is ready (its required publish-checklist items are done). On a narrow phone only the flag and the mark show; the name stays for screen readers.
 */
import type { Lang } from '../../../lib/schemas';
import type { ChecklistItem } from '../../lib/checklist';
import { FlagGB, FlagTR } from '../flags';
import { useNarrow } from './SideRail';

const PAGE_LABEL: Record<Lang, string> = { tr: 'Türkçe Sayfa', en: 'English Page' };
const FLAG = { tr: FlagTR, en: FlagGB } satisfies Record<Lang, unknown>;

export function LangButtons({ checklist, lang, onLang }: { checklist: ChecklistItem[]; lang: Lang; onLang: (l: Lang) => void }) {
  const narrow = useNarrow(560);
  return (
    <div className="lang-switch" role="group" aria-label="Dil">
      {(['tr', 'en'] as Lang[]).map((l) => {
        // The same rule as the publish gate, so ✓ never shows while Yayınla would be blocked by this language.
        const ok = checklist.every((i) => !(i.required && i.lang === l) || i.done);
        const Flag = FLAG[l];
        return (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            title={`${PAGE_LABEL[l]}${ok ? '' : ' (eksik alanlar var)'}`}
            className={`lang-btn ${lang === l ? 'is-active' : ''}`}
            onClick={() => onLang(l)}
          >
            <Flag />
            <span className={narrow ? 'k-visually-hidden' : 'lang-name'}>{PAGE_LABEL[l]}</span>
            <span className={`dot ${ok ? 'dot-ok' : 'dot-missing'}`} aria-hidden="true">
              {ok ? '✓' : '⚠'}
            </span>
            <span className="k-visually-hidden">{ok ? ' tamam' : ' eksik alanlar var'}</span>
          </button>
        );
      })}
    </div>
  );
}
