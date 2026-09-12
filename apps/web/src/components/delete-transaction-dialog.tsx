'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { useDeleteTransaction } from '@/features/transaction/transaction.hooks';

import type { Transaction } from '@/features/transaction/transaction.hooks';

export function DeleteTransactionDialog({
  transaction,
  onOpenChange,
  onDeleted,
}: {
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const deleteTransaction = useDeleteTransaction();

  async function handleConfirm() {
    if (!transaction) return;

    try {
      await deleteTransaction.mutateAsync(transaction.id);
      onDeleted();
      onOpenChange(false);
    } catch {
      // surfaced via deleteTransaction.isError below
    }
  }

  return (
    <AlertDialog open={transaction !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            {transaction?.description ? `“${transaction.description}” ` : ''}
            This will permanently remove this transaction. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteTransaction.isError && <FieldError>{deleteTransaction.error.message}</FieldError>}
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteTransaction.isPending}
          >
            {deleteTransaction.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
