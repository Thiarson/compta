import * as React from 'react';

import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import { AppSidebar } from '@/components/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { DeleteTransactionDialog } from '@/components/delete-transaction-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createAccountDeletedHandler, useAccount } from '@/features/account/account.hooks';
import {
  useCreateTransaction,
  useTransactions,
  type Transaction,
} from '@/features/transaction/transaction.hooks';
import { cn, formatCurrency, isSameDay, toIsoDate } from '@/lib/utils';
import { getRouteApi } from '@tanstack/react-router';
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  ReceiptTextIcon,
  ScaleIcon,
  Trash2Icon,
  WalletIcon,
} from 'lucide-react';

import type { AllAccountsResponse } from '@compta/contracts';

const dayLabelFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

const routeApi = getRouteApi('/_authenticated/');

export default function DashboardPage() {
  const { data: accounts, isPending } = useAccount();
  const { data: allTransactions = [] } = useTransactions();
  const { mutate: addTransaction } = useCreateTransaction();
  const [addTransactionOpen, setAddTransactionOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(() => new Date());
  const [deleteTarget, setDeleteTarget] = React.useState<AllAccountsResponse[number] | null>(null);
  const [deleteTransactionTarget, setDeleteTransactionTarget] = React.useState<Transaction | null>(
    null,
  );

  const { accountId } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const hasAccounts = !isPending && accounts && accounts.length > 0;
  const activeAccount = hasAccounts
    ? (accounts.find((account) => account.id === accountId) ?? accounts[0])
    : undefined;

  React.useEffect(() => {
    if (hasAccounts && activeAccount && accountId !== activeAccount.id) {
      navigate({ search: (prev) => ({ ...prev, accountId: activeAccount.id }), replace: true });
    }
  }, [hasAccounts, activeAccount, accountId, navigate]);

  const transactions = activeAccount
    ? allTransactions.filter((transaction) => transaction.accountId === activeAccount.id)
    : [];

  const income = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const balance = income - expense;

  const selectedIsoDate = toIsoDate(selectedDate);
  const isToday = isSameDay(selectedDate, new Date());
  const dayLabel = isToday ? 'Today' : dayLabelFormatter.format(selectedDate);
  const selectedDayTransactions = transactions.filter(
    (transaction) => transaction.date === selectedIsoDate,
  );

  return (
    <SidebarProvider>
      <AppSidebar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {hasAccounts && (
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" onClick={() => setAddTransactionOpen(true)}>
                  <PlusIcon />
                  Add transaction
                </Button>
                {accounts.length > 1 && activeAccount && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" aria-label="Account options" />}
                    >
                      <EllipsisVerticalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(activeAccount)}
                      >
                        <Trash2Icon />
                        Delete account
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ) : hasAccounts ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardDescription className="flex items-center gap-1.5">
                      <ScaleIcon className="size-4" />
                      Balance
                    </CardDescription>
                    <CardTitle
                      className={cn('text-2xl font-heading', balance < 0 && 'text-destructive')}
                    >
                      {formatCurrency(balance)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription className="flex items-center gap-1.5">
                      <ArrowUpCircleIcon className="size-4" />
                      Income
                    </CardDescription>
                    <CardTitle className="text-2xl font-heading">
                      {formatCurrency(income)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription className="flex items-center gap-1.5">
                      <ArrowDownCircleIcon className="size-4" />
                      Expense
                    </CardDescription>
                    <CardTitle className="text-2xl font-heading">
                      {formatCurrency(expense)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{dayLabel}</CardTitle>
                  <CardDescription>
                    {isToday
                      ? 'Income and expenses recorded today.'
                      : `Income and expenses recorded on ${dayLabelFormatter.format(selectedDate)}.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedDayTransactions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDayTransactions.map((transaction) => (
                          <TableRow key={transaction.id} className="group/transaction-row">
                            <TableCell>
                              <Badge
                                variant={
                                  transaction.type === 'income' ? 'secondary' : 'destructive'
                                }
                              >
                                {transaction.type === 'income' ? 'Income' : 'Expense'}
                              </Badge>
                            </TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell
                              className={cn(
                                'text-right font-medium',
                                transaction.type === 'income'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-destructive',
                              )}
                            >
                              {transaction.type === 'income' ? '+' : '-'}
                              {formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground opacity-0 group-hover/transaction-row:opacity-100 hover:text-destructive focus-visible:opacity-100"
                                aria-label="Delete transaction"
                                onClick={() => setDeleteTransactionTarget(transaction)}
                              >
                                <Trash2Icon />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <ReceiptTextIcon className="size-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {isToday
                          ? 'No transactions recorded today yet.'
                          : 'No transactions recorded on this day.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="items-center py-16 text-center">
              <CardContent className="flex flex-col items-center gap-2">
                <WalletIcon className="size-8 text-muted-foreground" />
                <CardTitle>No accounts yet</CardTitle>
                <CardDescription>
                  Add your first account from the sidebar to start tracking your finances.
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>

      {hasAccounts && activeAccount && (
        <AddTransactionDialog
          open={addTransactionOpen}
          onOpenChange={setAddTransactionOpen}
          defaultAccountId={activeAccount.id}
          onSubmit={addTransaction}
          defaultDate={selectedIsoDate}
        />
      )}

      <DeleteTransactionDialog
        transaction={deleteTransactionTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTransactionTarget(null);
        }}
        onDeleted={() => setDeleteTransactionTarget(null)}
      />

      <DeleteAccountDialog
        key={deleteTarget?.id}
        account={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={createAccountDeletedHandler(accounts, activeAccount?.id, (accountId) =>
          navigate({ search: (prev) => ({ ...prev, accountId }), replace: true }),
        )}
      />
    </SidebarProvider>
  );
}
