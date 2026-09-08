import { addTransactionBodySchema, addTransactionResponseSchema } from '@compta/contracts';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { buildTransactionsController, type AddTransactionRoute } from './transaction.controller.js';
import { buildTransactionsRepository } from './transaction.repository.js';
import { buildTransactionsService } from './transaction.service.js';

const transactionsRoute: FastifyPluginAsyncTypebox = async (app) => {
  const transactionsRepository = buildTransactionsRepository(app.db);
  const transactionsService = buildTransactionsService(transactionsRepository);
  const transactionsController = buildTransactionsController(transactionsService);

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
