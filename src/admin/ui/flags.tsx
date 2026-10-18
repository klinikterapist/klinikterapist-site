/** Language flags for the editor's language buttons: inline SVG (never emoji), 20×14, decorative. */
import { useId } from 'react';

export function FlagTR() {
  return (
    <svg className="flag" width="20" height="14" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="30" height="20" fill="#e30a17" />
      <circle cx="10" cy="10" r="5" fill="#fff" />
      <circle cx="11.25" cy="10" r="4" fill="#e30a17" />
      <polygon fill="#fff" points="14.40,10.00 16.13,9.44 16.13,7.62 17.20,9.09 18.92,8.53 17.85,10.00 18.92,11.47 17.20,10.91 16.13,12.38 16.13,10.56" />
    </svg>
  );
}

/** United Kingdom (the panel's English pages). */
export function FlagGB() {
  const id = `gb${useId().replace(/[^\w-]/g, '')}`; // React's ids contain characters url(#…) dislikes
  return (
    <svg className="flag" width="20" height="14" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <clipPath id={`${id}-t`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}-t)`} stroke="#c8102e" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}
