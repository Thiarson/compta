import type { FastifyReply, FastifyRequest } from 'fastify';
import type { buildTransactionsService } from './transaction.service.js';
import type {
  AddTransactionBody,
  AddTransactionResponse,
  AllTransactionResponse,
  DeleteTransactionParams,
} from '@compta/contracts';

type TransactionService = ReturnType<typeof buildTransactionsService>;

export interface AllTransactionsRoute {
  Reply: AllTransactionResponse;
}

export interface AddTransactionRoute {
  Body: AddTransactionBody;
  Reply: AddTransactionResponse;
}

export interface DeleteTransactionRoute {
  Params: DeleteTransactionParams;
  Reply: void;
}

export function buildTransactionsController(transactionsService: TransactionService) {
  return {
    async allTransactions(
      request: FastifyRequest<AllTransactionsRoute>,
      reply: FastifyReply<AllTransactionsRoute>,
    ) {
      const { sub: userId } = request.accessTokenPayload!;
      const transactions = await transactionsService.getAllUserTransactions(userId);

      reply.send(
        transactions.map((t) => ({
          id: t.id,
          accountId: t.accountId,
          type: t.type,
          amount: t.amount,
          description: t.description,
          date: t.date,
          createdAt: t.createdAt.toISOString(),
        })),
      );
    },

    async addTransaction(
      request: FastifyRequest<AddTransactionRoute>,
      reply: FastifyReply<AddTransactionRoute>,
    ) {
      const { sub: userId } = request.accessTokenPayload!;
      const { accountId, type, amount, description, date } = request.body;

      const transaction = await transactionsService.createTransaction(userId, {
        accountId,
        type,
        amount,
        description,
        date,
      });

      reply.code(201).send({
        id: transaction.id,
        accountId: transaction.accountId,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date,
        createdAt: transaction.createdAt.toISOString(),
      });
    },

    async deleteTransaction(
      request: FastifyRequest<DeleteTransactionRoute>,
      reply: FastifyReply<DeleteTransactionRoute>,
    ) {
      const { sub: userId } = request.accessTokenPayload!;

      await transactionsService.deleteTransaction(userId, request.params.id);

      reply.code(204).send();
    },
  };
}
