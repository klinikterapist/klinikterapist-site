/**
 * Live SEO panel for the active language (spec §8.2, §5.4): score, lights with tips and the focus
 * keyword most lights look at. Advice only: nothing here blocks publishing. The Google and share
 * previews live in the Meta panel.
 */
import { useEffect, useState } from 'react';
import type { Draft, LangFields } from '../../api/types';
import type { Lang } from '../../../lib/schemas';
import { LANG_LABEL } from '../../lib/draft';
import { runSeoChecks, type SeoCheck } from '../../lib/seo-check';
import { Field, Light } from '../kit';

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    if (ms <= 0) return setV(value);
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return ms <= 0 ? value : v;
}

/** Colour band of a score: the ring here and the dot on the rail. */
export const scoreTone = (score: number) => (score >= 80 ? 'good' : score >= 50 ? 'ok' : 'bad');

export function SeoPanel(props: { lang: Lang; draft: Draft; otherKeywords: string[]; onLang: (patch: Partial<LangFields>) => void; delayMs?: number }) {
  const { lang } = props;
  const draft = useDebounced(props.draft, props.delayMs ?? 300);
  const f = draft[lang];
  const { checks, score } = runSeoChecks({ lang, fields: f, hasCover: !!draft.cover, otherKeywords: props.otherKeywords });

  const order: Record<SeoCheck['level'], number> = { red: 0, yellow: 1, green: 2 };
  const sorted = [...checks].sort((a, b) => order[a.level] - order[b.level]);

  return (
    <div className="rail-panel-body seo-panel">
      <h3>SEO ({LANG_LABEL[lang]})</h3>
      <div className="seo-score">
        <div
          className={`score-ring score-${scoreTone(score)}`}
          role="meter"
          aria-label="SEO puanı"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          data-field="seoScore"
          tabIndex={-1}
          style={{ ['--score' as string]: score }}
        >
          <span>{score}</span>
        </div>
        <p className="k-hint">Kırmızı ışıklar yayını engellemez; yalnızca öneridir.</p>
      </div>
      <Field
        label="Odak kelime"
        field="focusKeyword"
        value={props.draft[lang].focusKeyword}
        onChange={(focusKeyword) => props.onLang({ focusKeyword })}
        hint="Bu yazının Google'da bulunmasını istediğiniz kelime ya da ifade."
        lang={lang}
        className="seo-keyword"
      />
      <ul className="seo-checks">
        {sorted.map((c) => (
          <li key={c.id}>
            <Light level={c.level} />
            <div>
              <p className="seo-label">{c.label}</p>
              {c.level !== 'green' && <p className="seo-tip">{c.tip}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
