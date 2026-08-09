import { buildAccountsService } from './account.service.js';
import { allAccountsResponseSchema } from '@compta/contracts';
import { buildAccountsController } from './account.controller.js';
import { buildAccountsRepository } from './account.repository.js';

import type { AllAccountsRoute } from './account.controller.js';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const accountsRoute: FastifyPluginAsyncTypebox = async (app) => {
  const accountsRepository = buildAccountsRepository(app.db);
  const accountsService = buildAccountsService(accountsRepository);
  const accountsController = buildAccountsController(accountsService);

  app.get<AllAccountsRoute>(
    '/',
    {
      schema: { response: allAccountsResponseSchema },
      preHandler: [app.authenticate],
    },
    accountsController.allAccounts,
  );
};

export default accountsRoute;
