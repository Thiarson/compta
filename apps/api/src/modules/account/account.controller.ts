import type { FastifyReply, FastifyRequest } from 'fastify';
import type { buildAccountsService } from './account.service.js';
import type {
  AllAccountsResponse,
  CreateAccountBody,
  CreateAccountResponse,
} from '@compta/contracts';

type AccountsService = ReturnType<typeof buildAccountsService>;

export interface AllAccountsRoute {
  Reply: AllAccountsResponse;
}

export interface CreateAccountRoute {
  Body: CreateAccountBody;
  Reply: CreateAccountResponse;
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

    async createAccount(
      request: FastifyRequest<CreateAccountRoute>,
      reply: FastifyReply<CreateAccountRoute>,
    ) {
      const { sub: userId } = request.accessTokenPayload!;

      const newAccount = await accountsService.createNewAccount(userId, request.body.category);

      reply.send({
        id: newAccount.id,
        category: newAccount.category,
      });
    },
  };
}
