import type { FastifyReply, FastifyRequest } from 'fastify';
import type { buildAccountsService } from './account.service.js';
import type {
  AllAccountsResponse,
  CreateAccountBody,
  CreateAccountResponse,
  DeleteAccountParams,
} from '@compta/contracts';

type AccountsService = ReturnType<typeof buildAccountsService>;

export interface AllAccountsRoute {
  Reply: AllAccountsResponse;
}

export interface CreateAccountRoute {
  Body: CreateAccountBody;
  Reply: CreateAccountResponse;
}

export interface DeleteAccountRoute {
  Params: DeleteAccountParams;
  Reply: void;
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

    async deleteAccount(
      request: FastifyRequest<DeleteAccountRoute>,
      reply: FastifyReply<DeleteAccountRoute>,
    ) {
      const { sub: userId } = request.accessTokenPayload!;

      await accountsService.deleteAccount(userId, request.params.id);

      reply.code(204).send();
    },
  };
}
