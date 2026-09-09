import {
  addTransactionBodySchema,
  addTransactionResponseSchema,
  allTransactionResponseSchema,
} from '@compta/contracts';
import { buildTransactionsRepository } from './transaction.repository.js';
import { buildTransactionsController } from './transaction.controller.js';
import { buildTransactionsService } from './transaction.service.js';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { AddTransactionRoute, AllTransactionsRoute } from './transaction.controller.js';

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
};

export default transactionsRoute;
