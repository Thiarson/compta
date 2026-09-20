import { Type, type Static } from '@sinclair/typebox';
import { idParamsSchema, noContentResponseSchema } from './common.js';

const accountSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  category: Type.String(),
});

export const allAccountsResponseSchema = {
  200: Type.Array(accountSchema),
};

export type AllAccountsResponse = Static<(typeof allAccountsResponseSchema)[200]>;

export const createAccountBodySchema = Type.Object(
  {
    category: Type.String({
      minLength: 2,
      maxLength: 50,
      errorMessage: { minLength: 'Account name must be at least 2 characters' },
    }),
  },
  {
    errorMessage: {
      required: { category: 'Account name is required' },
    },
  },
);

export type CreateAccountBody = Static<typeof createAccountBodySchema>;

export const createAccountResponseSchema = {
  201: accountSchema,
};

export type CreateAccountResponse = Static<(typeof createAccountResponseSchema)[201]>;

export const deleteAccountParamsSchema = idParamsSchema;

export type DeleteAccountParams = Static<typeof deleteAccountParamsSchema>;

export const deleteAccountResponseSchema = {
  204: noContentResponseSchema,
};

export type DeleteAccountResponse = Static<(typeof deleteAccountResponseSchema)[204]>;
