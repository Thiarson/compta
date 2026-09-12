'use client';

import * as React from 'react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useDeleteAccount } from '@/features/account/account.hooks';

import type { AllAccountsResponse } from '@compta/contracts';

export function DeleteAccountDialog({
  account,
  onOpenChange,
  onDeleted,
}: {
  account: AllAccountsResponse[number] | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (accountId: string) => void;
}) {
  const deleteAccount = useDeleteAccount();
  const [confirmText, setConfirmText] = React.useState('');

  const isConfirmed = account !== null && confirmText.trim() === account.category;

  async function handleConfirm() {
    if (!account || !isConfirmed) return;

    try {
      await deleteAccount.mutateAsync(account.id);
      onDeleted(account.id);
      onOpenChange(false);
    } catch {
      // surfaced via deleteAccount.isError below
    }
  }

  return (
    <AlertDialog open={account !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {account?.category}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this account and all of its transactions. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="delete-account-confirm">
            Type <span className="font-medium text-foreground">{account?.category}</span> to confirm
          </FieldLabel>
          <Input
            id="delete-account-confirm"
            autoFocus
            autoComplete="off"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleConfirm();
              }
            }}
          />
        </Field>
        {deleteAccount.isError && <FieldError>{deleteAccount.error.message}</FieldError>}
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || deleteAccount.isPending}
          >
            {deleteAccount.isPending ? 'Deleting...' : 'Delete account'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
