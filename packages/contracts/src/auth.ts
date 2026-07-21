import { Type, type Static } from '@sinclair/typebox';

export const registerBodySchema = Type.Object({
  username: Type.String({ minLength: 2 }),
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
});

export type RegisterBody = Static<typeof registerBodySchema>;

export const loginBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String(),
});

export type LoginBody = Static<typeof loginBodySchema>;

export const verifyEmailBodySchema = Type.Object({
  verificationToken: Type.String(),
});

export type VerifyEmailBody = Static<typeof verifyEmailBodySchema>;

export const authResponseSchema = {
  200: Type.Object({
    accessToken: Type.String(),
    user: Type.Object({
      id: Type.String(),
      username: Type.String(),
      email: Type.String(),
    }),
  }),
};

export type AuthResponse = Static<(typeof authResponseSchema)[200]>;
