import { apiFetch } from '../../lib/api-client';

import type {
  LoginBody,
  RegisterBody,
  AuthResponse,
  MeResponse,
  VerifyEmailBody,
  ForgotPasswordBody,
  VerifyPasswordResetBody,
  ResetPasswordBody,
} from '@compta/contracts';

export const authApi = {
  me: () => apiFetch<MeResponse>('/auth/me'),

  login: (body: LoginBody) => apiFetch<AuthResponse>('/auth/login', { method: 'POST', body }),

  register: (body: RegisterBody) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body }),

  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),

  verifyEmail: (body: VerifyEmailBody) =>
    apiFetch<void>('/auth/verify-email', { method: 'POST', body }),

  resendVerification: () => apiFetch<void>('/auth/resend-verification', { method: 'POST' }),

  forgotPassword: (body: ForgotPasswordBody) =>
    apiFetch<void>('/auth/forgot-password', { method: 'POST', body }),

  verifyPasswordReset: (body: VerifyPasswordResetBody) =>
    apiFetch<void>('/auth/verify-password-reset', { method: 'POST', body }),

  resetPassword: (body: ResetPasswordBody) =>
    apiFetch<void>('/auth/reset-password', { method: 'POST', body }),
};
