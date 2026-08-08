export type AuthSearch = {
  redirect?: string;
};

export function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  return {
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  };
}

export type VerifyEmailSearch = AuthSearch & {
  token?: string;
};

export function validateVerifyEmailSearch(search: Record<string, unknown>): VerifyEmailSearch {
  return {
    ...validateAuthSearch(search),
    token: typeof search.token === 'string' ? search.token : undefined,
  };
}
