import { describe, it, expect } from 'vitest';
import { closedAs, typeState } from '../../src/lib/booking-form';
import { typeInfo } from '../../src/components/appointment/booking-info';

describe('session types switched off (owner, 2026-10-23)', () => {
  it('types with places close as "Kontenjan Doldu", the others as "Şu an uygun değil", unless set', () => {
    expect(closedAs({}, 'supervision')).toBe('full');
    expect(closedAs({}, 'accessible')).toBe('full');
    expect(closedAs({}, 'face')).toBe('off');
    expect(closedAs({ closedAs: { face: 'hidden' } }, 'face')).toBe('hidden');
    expect(typeState({ types: { accessible: false } }, 'accessible')).toBe('full');
    expect(typeState({ types: { supervision: true } }, 'supervision')).toBe('on');
  });

  it('the explanations under the form follow the settings', () => {
    const items = typeInfo('tr', { types: { group: false, face: false, supervision: false, accessible: true }, closedAs: { face: 'hidden' } });
    expect(items.map((i) => i.q)).toEqual([
      'Bireysel terapi seansı',
      'Çift terapisi seansı',
      'Erişilebilir terapi seansı',
      'Grup terapisi seansı (şu an uygun değil)',
      'Süpervizyon terapi seansı (kontenjan doldu)',
    ]);
    const open = typeInfo('en', { types: { supervision: true } }).find((i) => i.id === 'supervizyon')!;
    expect(open.q).toBe('Supervision therapy session');
    expect(JSON.stringify(open.body)).toContain('Just choose');
  });
});
