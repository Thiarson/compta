import { buildAccountsService } from './account.service.js';
import {
  allAccountsResponseSchema,
  createAccountBodySchema,
  createAccountResponseSchema,
  deleteAccountParamsSchema,
} from '@compta/contracts';
import { buildAccountsController } from './account.controller.js';
import { buildAccountsRepository } from './account.repository.js';

import type {
  AllAccountsRoute,
  CreateAccountRoute,
  DeleteAccountRoute,
} from './account.controller.js';
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

  app.post<CreateAccountRoute>(
    '/',
    {
      schema: { body: createAccountBodySchema, response: createAccountResponseSchema },
      preHandler: [app.authenticate],
    },
    accountsController.createAccount,
  );

  app.delete<DeleteAccountRoute>(
    '/:id',
    {
      schema: { params: deleteAccountParamsSchema },
      preHandler: [app.authenticate],
    },
    accountsController.deleteAccount,
  );
};

export default accountsRoute;
