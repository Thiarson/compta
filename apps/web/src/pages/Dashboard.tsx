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
import { useAccount } from '@/features/account/account.hooks';
import { useCreateTransaction, useTransactions } from '@/features/transaction/transaction.hooks';
import { cn, formatCurrency, isSameDay, toIsoDate } from '@/lib/utils';
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  PlusIcon,
  ReceiptTextIcon,
  ScaleIcon,
  WalletIcon,
} from 'lucide-react';

const dayLabelFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export default function DashboardPage() {
  const { data: accounts, isPending } = useAccount();
  const { data: transactions = [] } = useTransactions();
  const { mutate: addTransaction } = useCreateTransaction();
  const [addTransactionOpen, setAddTransactionOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(() => new Date());

  const accountsById = React.useMemo(
    () => new Map((accounts ?? []).map((account) => [account.id, account.category])),
    [accounts],
  );

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

  const hasAccounts = !isPending && accounts && accounts.length > 0;

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
              <Button size="sm" className="ml-auto" onClick={() => setAddTransactionOpen(true)}>
                <PlusIcon />
                Add transaction
              </Button>
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
                      className={cn(
                        'text-2xl font-heading',
                        balance < 0 && 'text-destructive',
                      )}
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
                          <TableHead>Description</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDayTransactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {accountsById.get(transaction.accountId) ?? 'Unknown account'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  transaction.type === 'income' ? 'secondary' : 'destructive'
                                }
                              >
                                {transaction.type === 'income' ? 'Income' : 'Expense'}
                              </Badge>
                            </TableCell>
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

      {hasAccounts && (
        <AddTransactionDialog
          open={addTransactionOpen}
          onOpenChange={setAddTransactionOpen}
          accounts={accounts}
          onSubmit={addTransaction}
          defaultDate={selectedIsoDate}
        />
      )}
    </SidebarProvider>
  );
}
