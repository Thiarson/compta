export const EMAIL_QUEUE = 'email';

export interface EmailJob {
  to: string;
  template: 'verify-email' | 'reset-password';
  params: { username: string; url: string };
}
