'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ChevronsUpDownIcon, PlusIcon, Trash2Icon, WalletIcon } from 'lucide-react';
import { getRouteApi } from '@tanstack/react-router';
import {
  createAccountDeletedHandler,
  useAccount,
  useCreateAccount,
} from '@/features/account/account.hooks';

import type { AllAccountsResponse } from '@compta/contracts';
import type { SubmitEvent } from 'react';

const routeApi = getRouteApi('/_authenticated/');

function AddAccountDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (accountId: string) => void;
}) {
  const [category, setCategory] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const createAccount = useCreateAccount();

  const trimmed = category.trim();
  const isValid = trimmed.length >= 2;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!isValid) return;

    try {
      const account = await createAccount.mutateAsync({ category: trimmed });
      onCreated(account.id);
      onOpenChange(false);
    } catch {
      // surfaced via createAccount.isError below
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
            <DialogDescription>Give your new account a name.</DialogDescription>
          </DialogHeader>
          <Field className="mt-4">
            <FieldLabel htmlFor="account-category">Account name</FieldLabel>
            <Input
              id="account-category"
              autoFocus
              placeholder="Business"
              required
              minLength={2}
              maxLength={50}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !isValid}
            />
            {touched && !isValid && (
              <FieldError>Account name must be at least 2 characters</FieldError>
            )}
            {createAccount.isError && <FieldError>{createAccount.error.message}</FieldError>}
          </Field>
          <DialogFooter showCloseButton>
            <Button type="submit" disabled={createAccount.isPending || (touched && !isValid)}>
              {createAccount.isPending ? 'Creating...' : 'Create account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountSwitcher() {
  const { isMobile } = useSidebar();
  const { data: accounts, isPending } = useAccount();
  const { accountId } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const [addAccountOpen, setAddAccountOpen] = React.useState(false);
  const [addAccountKey, setAddAccountKey] = React.useState(0);
  const [deleteTarget, setDeleteTarget] = React.useState<AllAccountsResponse[number] | null>(null);

  if (isPending || !accounts) {
    return null;
  }

  const canDelete = accounts.length > 1;

  const activeAccount = accounts.find((account) => account.id === accountId) ?? accounts[0];

  function selectAccount(id: string) {
    navigate({ search: (prev) => ({ ...prev, accountId: id }), replace: true });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <WalletIcon className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {activeAccount?.category ?? 'Add an account'}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            {accounts.length > 0 && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Accounts
                  </DropdownMenuLabel>
                  {accounts.map((account) => (
                    <DropdownMenuItem
                      key={account.id}
                      onClick={() => selectAccount(account.id)}
                      className="group/account-item gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-md border">
                        <WalletIcon className="size-4" />
                      </div>
                      <span className="flex-1 truncate">{account.category}</span>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground opacity-0 group-hover/account-item:opacity-100 hover:text-destructive focus-visible:opacity-100"
                          aria-label={`Delete ${account.category}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(account);
                          }}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => {
                  setAddAccountKey((key) => key + 1);
                  setAddAccountOpen(true);
                }}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">Add account</div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <AddAccountDialog
        key={addAccountKey}
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onCreated={selectAccount}
      />
      <DeleteAccountDialog
        key={deleteTarget?.id}
        account={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={createAccountDeletedHandler(accounts, activeAccount?.id, selectAccount)}
      />
    </SidebarMenu>
  );
}
