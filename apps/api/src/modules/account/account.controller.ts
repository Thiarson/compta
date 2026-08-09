import type { FastifyReply, FastifyRequest } from 'fastify';
import type { buildAccountsService } from './account.service.js';
import type { AllAccountsResponse } from '@compta/contracts';

type AccountsService = ReturnType<typeof buildAccountsService>;

export interface AllAccountsRoute {
  Reply: AllAccountsResponse;
}

export function buildAccountsController(accountsService: AccountsService) {
  return {
    async allAccounts(
      request: FastifyRequest<AllAccountsRoute>,
      reply: FastifyReply<AllAccountsRoute>,
    ) {
      const { sub: userId } = request.accessTokenPayload!;

      const accounts = await accountsService.getAllUserAccounts(userId);

      reply.send(accounts);
    },
  };
}
