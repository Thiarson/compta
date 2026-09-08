import type { FastifyReply, FastifyRequest } from 'fastify';
import type { buildTransactionsService } from './transaction.service.js';
import type { AddTransactionBody, AddTransactionResponse } from '@compta/contracts';

type TransactionService = ReturnType<typeof buildTransactionsService>;

export interface AddTransactionRoute {
  Body: AddTransactionBody;
  Reply: AddTransactionResponse;
}

export function buildTransactionsController(transactionsService: TransactionService) {
  return {
    async addTransaction(
      request: FastifyRequest<AddTransactionRoute>,
      reply: FastifyReply<AddTransactionRoute>,
    ) {
      const { sub: userId } = request.accessTokenPayload;
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
  };
}
