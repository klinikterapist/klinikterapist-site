import { describe, it, expect } from 'vitest';
import { parseYoutubeId } from '../../../src/admin/lib/youtube';

describe('parseYoutubeId', () => {
  it.each([
    'https://youtu.be/dQw4w9WgXcQ?t=3',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    '  dQw4w9WgXcQ  ',
  ])('reads %s', (input) => {
    expect(parseYoutubeId(input)).toBe('dQw4w9WgXcQ');
  });
  it.each(['https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/short', 'merhaba', '', 'javascript:alert(1)'])('rejects %j', (input) => {
    expect(parseYoutubeId(input)).toBeNull();
  });
});
