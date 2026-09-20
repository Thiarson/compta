import {
  addTransactionBodySchema,
  addTransactionResponseSchema,
  allTransactionResponseSchema,
  deleteTransactionParamsSchema,
  deleteTransactionResponseSchema,
} from '@compta/contracts';
import { buildTransactionsRepository } from './transactions.repository.js';
import { buildTransactionsController } from './transactions.controller.js';
import { buildTransactionsService } from './transactions.service.js';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type {
  AddTransactionRoute,
  AllTransactionsRoute,
  DeleteTransactionRoute,
} from './transactions.controller.js';

const transactionsRoute: FastifyPluginAsyncTypebox = async (app) => {
  const transactionsRepository = buildTransactionsRepository(app.db);
  const transactionsService = buildTransactionsService(transactionsRepository);
  const transactionsController = buildTransactionsController(transactionsService);

  app.get<AllTransactionsRoute>(
    '/',
    {
      schema: { response: allTransactionResponseSchema },
      preHandler: [app.authenticate],
    },
    transactionsController.allTransactions,
  );

  app.post<AddTransactionRoute>(
    '/',
    {
      schema: { body: addTransactionBodySchema, response: addTransactionResponseSchema },
      preHandler: [app.authenticate],
    },
    transactionsController.addTransaction,
  );

  app.delete<DeleteTransactionRoute>(
    '/:id',
    {
      schema: { params: deleteTransactionParamsSchema, response: deleteTransactionResponseSchema },
      preHandler: [app.authenticate],
    },
    transactionsController.deleteTransaction,
  );
};

export default transactionsRoute;
