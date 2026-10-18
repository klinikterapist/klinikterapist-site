/** The anonymous page counter (Counter.astro). `COUNTER=0` turns it off for a build. */
export const COUNTER_ENABLED = process.env.COUNTER !== '0';

export const SITE = (process.env.SITE_URL ?? 'https://example.com').replace(/\/$/, '')
