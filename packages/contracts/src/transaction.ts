import { Type, type Static } from '@sinclair/typebox';

export const transactionTypes = ['income', 'expense'] as const;

export type TransactionType = (typeof transactionTypes)[number];

export const transactionSchema = Type.Object({
  id: Type.String(),
  accountId: Type.String(),
  type: Type.Union(transactionTypes.map((type) => Type.Literal(type))),
  amount: Type.Number(),
  description: Type.Union([Type.String(), Type.Null()]),
  date: Type.String({ format: 'date' }),
  createdAt: Type.String({ format: 'date-time' }),
});

export const addTransactionBodySchema = Type.Object(
  {
    accountId: Type.String(),
    type: Type.Union(
      transactionTypes.map((type) => Type.Literal(type)),
      { errorMessage: 'Type must be either income or expense' },
    ),
    amount: Type.Number({
      exclusiveMinimum: 0,
      errorMessage: { exclusiveMinimum: 'Amount must be positive' },
    }),
    description: Type.String({
      minLength: 2,
      maxLength: 200,
      errorMessage: { minLength: 'Description must be at least 2 characters' },
    }),
    date: Type.String({
      format: 'date',
      errorMessage: { format: 'Invalid date' },
    }),
  },
  {
    errorMessage: {
      required: {
        accountId: 'Account id is required',
        type: 'Type is required',
        amount: 'Amount is required',
        description: 'Description is required',
        date: 'Date is required',
      },
    },
  },
);

export type AddTransactionBody = Static<typeof addTransactionBodySchema>;

export const addTransactionResponseSchema = {
  201: transactionSchema,
};

export type AddTransactionResponse = Static<(typeof addTransactionResponseSchema)[201]>;

export const allTransactionResponseSchema = {
  200: Type.Array(transactionSchema),
};

export type AllTransactionResponse = Static<(typeof allTransactionResponseSchema)[200]>;

export const deleteTransactionParamsSchema = Type.Object({
  id: Type.String(),
});

export type DeleteTransactionParams = Static<typeof deleteTransactionParamsSchema>;
