import { Null, Type } from '@sinclair/typebox';

import type { Static } from '@sinclair/typebox';

export const registerBodySchema = Type.Object(
  {
    username: Type.String({
      minLength: 2,
      errorMessage: { minLength: 'Username must be at least 2 characters' },
    }),
    email: Type.String({ format: 'email', errorMessage: { format: 'Invalid email address' } }),
    password: Type.String({
      minLength: 8,
      errorMessage: { minLength: 'Password must be at least 8 characters' },
    }),
  },
  {
    errorMessage: {
      required: {
        username: 'Username is required',
        email: 'Email is required',
        password: 'Password is required',
      },
    },
  },
);

export type RegisterBody = Static<typeof registerBodySchema>;

export const loginBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', errorMessage: { format: 'Invalid email address' } }),
    password: Type.String({
      minLength: 8,
      errorMessage: { minLength: 'Password must be at least 8 characters' },
    }),
  },
  {
    errorMessage: {
      required: {
        email: 'Email is required',
        password: 'Password is required',
      },
    },
  },
);

export type LoginBody = Static<typeof loginBodySchema>;

export const verifyEmailBodySchema = Type.Object(
  {
    verificationToken: Type.String(),
  },
  {
    errorMessage: {
      required: { verificationToken: 'Verification token is required' },
    },
  },
);

export type VerifyEmailBody = Static<typeof verifyEmailBodySchema>;

export const verifyEmailResponseSchema = {
  204: Null(),
};

export type VerifyEmailResponse = Static<(typeof verifyEmailResponseSchema)[204]>;

export const forgotPasswordBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', errorMessage: { format: 'Invalid email address' } }),
  },
  {
    errorMessage: {
      required: { email: 'Email is required' },
    },
  },
);

export type ForgotPasswordBody = Static<typeof forgotPasswordBodySchema>;

export const forgotPasswordResponseSchema = {
  204: Null(),
};

export type ForgotPasswordResponse = Static<(typeof forgotPasswordResponseSchema)[204]>;

export const verifyPasswordResetBodySchema = Type.Object(
  {
    passwordResetToken: Type.String(),
  },
  {
    errorMessage: {
      required: { passwordResetToken: 'Password reset token is required' },
    },
  },
);

export type VerifyPasswordResetBody = Static<typeof verifyPasswordResetBodySchema>;

export const verifyPasswordResetResponseSchema = {
  204: Null(),
};

export type VerifyPasswordResetResponse = Static<(typeof verifyPasswordResetResponseSchema)[204]>;

export const resetPasswordBodySchema = Type.Object(
  {
    passwordResetToken: Type.String(),
    newPassword: Type.String({
      minLength: 8,
      errorMessage: { minLength: 'Password must be at least 8 characters' },
    }),
  },
  {
    errorMessage: {
      required: {
        passwordResetToken: 'Password reset token is required',
        newPassword: 'New password is required',
      },
    },
  },
);

export type ResetPasswordBody = Static<typeof resetPasswordBodySchema>;

export const resetPasswordResponseSchema = {
  204: Null(),
};

export type ResetPasswordResponse = Static<(typeof resetPasswordResponseSchema)[204]>;

const userSchema = Type.Object({
  id: Type.String(),
  username: Type.String(),
  email: Type.String(),
  emailVerifiedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});

const authPayloadSchema = Type.Object({
  accessToken: Type.String(),
  user: userSchema,
});

export const authResponseSchema = {
  200: authPayloadSchema,
};

export const authCreatedResponseSchema = {
  201: authPayloadSchema,
};

export type AuthResponse = Static<(typeof authResponseSchema)[200]>;

export type AuthCreatedResponse = Static<(typeof authCreatedResponseSchema)[201]>;

export const meResponseSchema = {
  200: userSchema,
};

export type MeResponse = Static<(typeof meResponseSchema)[200]>;

export const resendVerificationResponseSchema = {
  202: Null(),
};

export type ResendVerificationResponse = Static<(typeof resendVerificationResponseSchema)[202]>;

export const logoutResponseSchema = {
  204: Null(),
};

export type LogoutResponse = Static<(typeof logoutResponseSchema)[204]>;
