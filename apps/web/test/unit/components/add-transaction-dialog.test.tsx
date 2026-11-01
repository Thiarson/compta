import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddTransactionDialog } from '@/components/add-transaction-dialog';

afterEach(() => vi.useRealTimers());

function setup(props: Partial<React.ComponentProps<typeof AddTransactionDialog>> = {}) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  const dialog = (open: boolean) => (
    <AddTransactionDialog
      open={open}
      onOpenChange={onOpenChange}
      defaultAccountId="a1"
      onSubmit={onSubmit}
      defaultDate="2025-06-15"
      {...props}
    />
  );
  const utils = render(dialog(true));

  return {
    onSubmit,
    onOpenChange,
    user: userEvent.setup(),
    reopen: () => {
      utils.rerender(dialog(false));
      utils.rerender(dialog(true));
    },
  };
}

const amountField = () => screen.getByLabelText('Amount (Ar)');
const submit = () => screen.getByRole('button', { name: 'Add transaction' });

describe('AddTransactionDialog', () => {
  it('submits an expense for the active account on the default date, then closes', async () => {
    const { user, onSubmit, onOpenChange } = setup();

    await user.type(amountField(), '2500');
    await user.type(screen.getByLabelText('Description'), '  Groceries ');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      accountId: 'a1',
      type: 'expense',
      amount: 2500,
      description: 'Groceries',
      date: '2025-06-15',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('can record an income', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Income' }));
    await user.type(amountField(), '10000');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', amount: 10000 }),
    );
  });

  it.each([
    ['expense', 'Expense'],
    ['income', 'Income'],
  ])('describes a %s as "%s" when no description is given', async (type, expected) => {
    const { user, onSubmit } = setup();

    if (type === 'income') {
      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: 'Income' }));
    }
    await user.type(amountField(), '100');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ description: expected }));
  });

  // the input's native min/step constraints stop these before the custom message can show
  it.each(['0', '-5', '1.5'])('blocks submission of an amount of %s', async (amount) => {
    const { user, onSubmit, onOpenChange } = setup();

    await user.type(amountField(), amount);
    await user.click(submit());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('explains an empty amount', async () => {
    const { user, onSubmit } = setup();

    await user.click(submit());

    expect(await screen.findByText('Amount must be greater than 0')).toBeInTheDocument();
    expect(amountField()).toHaveAttribute('aria-invalid', 'true');
    expect(submit()).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('starts empty each time it is reopened', async () => {
    const { user, reopen } = setup();
    await user.type(amountField(), '2500');
    await user.type(screen.getByLabelText('Description'), 'Groceries');
    await user.click(submit());

    reopen();

    expect(amountField()).toHaveValue(null);
    expect(screen.getByLabelText('Description')).toHaveValue('');
  });

  it('uses the date it is given each time it opens', async () => {
    const { user, onSubmit } = setup({ defaultDate: '2025-06-10' });

    await user.type(amountField(), '100');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ date: '2025-06-10' }));
  });

  it("defaults to today's local date, even just after local midnight", async () => {
    // 01:30 on 15 June in UTC+3 is still 14 June in UTC
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2025, 5, 15, 1, 30));
    const { user, onSubmit } = setup({ defaultDate: undefined });

    await user.type(amountField(), '100');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ date: '2025-06-15' }));
  });

  it('closes without submitting on Cancel', async () => {
    const { user, onSubmit, onOpenChange } = setup();

    await user.click(screen.getAllByRole('button', { name: 'Close' })[0]);

    // base-ui passes extra event details after the flag
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
