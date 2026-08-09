import { Type, type Static } from '@sinclair/typebox';

const accountSchema = Type.Object({
  id: Type.String(),
  category: Type.String(),
});

export const allAccountsResponseSchema = {
  200: Type.Array(accountSchema),
};

export type AllAccountsResponse = Static<(typeof allAccountsResponseSchema)[200]>;
