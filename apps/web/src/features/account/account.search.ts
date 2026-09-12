export type AccountSearch = {
  accountId?: string;
};

export function validateAccountSearch(search: Record<string, unknown>): AccountSearch {
  return {
    accountId: typeof search.accountId === 'string' ? search.accountId : undefined,
  };
}
