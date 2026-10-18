import { afterAll, beforeAll } from 'vitest';

/**
 * Point the settings readers at tests/fixtures/data for this test file.
 *
 * deploy.yml runs `npm test` before every deploy, and the owner's panel edits to src/data deploy through it,
 * so a test that asserts the owner's real, editable values would block the live site after an ordinary edit.
 */
export function useFixtureData(): void {
  let prev: string | undefined;
  beforeAll(() => {
    prev = process.env.DATA_DIR;
    process.env.DATA_DIR = 'tests/fixtures/data';
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prev;
  });
}
