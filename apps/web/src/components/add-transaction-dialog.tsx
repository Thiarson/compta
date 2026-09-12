import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TransactionType } from '@/features/transaction/transaction.hooks';
import type { AddTransactionBody } from '@compta/contracts';

import type { SubmitEvent } from 'react';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  defaultAccountId,
  onSubmit,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId: string;
  onSubmit: (input: AddTransactionBody) => void;
  defaultDate?: string;
}) {
  const [type, setType] = React.useState<TransactionType>('expense');
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState(defaultDate ?? todayIsoDate());
  const [touched, setTouched] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDate(defaultDate ?? todayIsoDate());
  }

  const parsedAmount = Number(amount);
  const isAmountValid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const isValid = isAmountValid && date !== '';

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!isValid) return;

    onSubmit({
      accountId: defaultAccountId,
      type,
      amount: Math.round(parsedAmount),
      description: description.trim() || (type === 'income' ? 'Income' : 'Expense'),
      date,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add transaction</DialogTitle>
            <DialogDescription>Record a new income or expense.</DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select value={type} onValueChange={(value) => setType(value as TransactionType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-amount">Amount (Ar)</FieldLabel>
            <Input
              id="transaction-amount"
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={touched && !isAmountValid}
            />
            {touched && !isAmountValid && <FieldError>Amount must be greater than 0</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-description">Description</FieldLabel>
            <Input
              id="transaction-description"
              placeholder={type === 'income' ? 'Salary' : 'Groceries'}
              maxLength={200}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={touched && !isValid}>
              Add transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
