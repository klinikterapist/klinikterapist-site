/** APA reference and citation data shared by the build and the admin panel. No `node:` imports here. */
import { z } from 'astro/zod';

export type Person = { family: string; given?: string; suffix?: string } | { literal: string };
export type RefType = 'article' | 'book' | 'chapter' | 'web';
export type Year = number | 'nd' | 'inpress';
export type Reference = {
  id: string; type: RefType; authors: Person[]; editors?: Person[]; year: Year;
  title: string; container?: string; volume?: string; issue?: string; pages?: string;
  edition?: string; publisher?: string; doi?: string; url?: string; accessed?: string /* YYYY-MM-DD */;
};
export type LocatorKind = 'p' | 'pp' | 'para' | 'ch';
export type CiteItem = { id: string; locator?: { kind: LocatorKind; value: string } };
export type Citation = { items: CiteItem[]; narrative: boolean };

const personSchema = z.union([
  z.object({ family: z.string(), given: z.string().optional(), suffix: z.string().optional() }),
  z.object({ literal: z.string() }),
]);

export const referenceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['article', 'book', 'chapter', 'web']),
  authors: z.array(personSchema),
  editors: z.array(personSchema).optional(),
  year: z.union([z.number().int(), z.literal('nd'), z.literal('inpress')]),
  title: z.string(),
  container: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  edition: z.string().optional(),
  publisher: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  accessed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
