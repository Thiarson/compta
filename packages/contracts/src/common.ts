import { Null, Type, type Static } from '@sinclair/typebox';

export const idSchema = Type.String({ format: 'uuid', errorMessage: { format: 'Invalid id' } });

export const idParamsSchema = Type.Object({ id: idSchema });

export type IdParams = Static<typeof idParamsSchema>;

export const noContentResponseSchema = Null();
