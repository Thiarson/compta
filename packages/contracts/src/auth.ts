import { Type, type Static } from '@sinclair/typebox';

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

const userSchema = Type.Object({
  id: Type.String(),
  username: Type.String(),
  email: Type.String(),
});

export const authResponseSchema = {
  200: Type.Object({
    accessToken: Type.String(),
    user: userSchema,
  }),
};

export type AuthResponse = Static<(typeof authResponseSchema)[200]>;

export const meResponseSchema = {
  200: userSchema,
};

export type MeResponse = Static<(typeof meResponseSchema)[200]>;
