import type { NotificationType } from '@compta/contracts';

export const EMAIL_QUEUE = 'email';

// 3 attempts, waiting ~1s then ~2s (±50% jitter so a provider outage doesn't get a synchronized burst)
export const EMAIL_JOB_ATTEMPTS = 3;
export const EMAIL_JOB_BACKOFF = { type: 'exponential', delay: 1000, jitter: 0.5 } as const;

export interface EmailJob {
  to: string;
  template: NotificationType;
  params: { username: string; url: string };
}
