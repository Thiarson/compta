export type AuthSearch = {
  redirect?: string;
};

export function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  return {
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  };
}
