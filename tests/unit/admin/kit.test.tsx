// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileText } from '../../../src/admin/ui/icons';
import { EmptyState } from '../../../src/admin/ui/kit';

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
});
