import { describe, expect, it, vi } from 'vitest';

import { createAccountDeletedHandler } from './account.hooks';

const accounts = [
  { id: 'a', category: 'Cash' },
  { id: 'b', category: 'Bank' },
] as Parameters<typeof createAccountDeletedHandler>[0];

describe('createAccountDeletedHandler', () => {
  it('selects another account when the active one is deleted', () => {
    const onSelect = vi.fn();

    createAccountDeletedHandler(accounts, 'a', onSelect)('a');

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('does nothing when a non-active account is deleted', () => {
    const onSelect = vi.fn();

    createAccountDeletedHandler(accounts, 'a', onSelect)('b');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does nothing when no other account is left', () => {
    const onSelect = vi.fn();

    createAccountDeletedHandler([accounts![0]], 'a', onSelect)('a');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does nothing when accounts are not loaded', () => {
    const onSelect = vi.fn();

    createAccountDeletedHandler(undefined, 'a', onSelect)('a');

    expect(onSelect).not.toHaveBeenCalled();
  });
});
