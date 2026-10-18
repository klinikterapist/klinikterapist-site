// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileText } from '../../../src/admin/ui/icons';
import { EmptyState, HelpTip } from '../../../src/admin/ui/kit';

describe('kit', () => {
  it('EmptyState shows the icon, text and action', () => {
    const { container } = render(
      <EmptyState icon={FileText} action={<a href="#/x">Yeni</a>}>
        Taslak yok.
      </EmptyState>,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Taslak yok.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Yeni' })).toBeTruthy();
  });

  it('HelpTip reveals its text on click and hides it on a second click or Escape', () => {
    render(<HelpTip label="Odak kelime">Açıklama metni.</HelpTip>);
    const btn = screen.getByRole('button', { name: 'Odak kelime hakkında bilgi' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Açıklama metni.')).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Açıklama metni.').id).toBe(btn.getAttribute('aria-controls'));
    fireEvent.click(btn);
    expect(screen.queryByText('Açıklama metni.')).toBeNull();
    fireEvent.click(btn);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByText('Açıklama metni.')).toBeNull();
  });
});
