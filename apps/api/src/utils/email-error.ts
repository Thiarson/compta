/** A failed send. `retryable` tells the queue worker whether trying again can help. */
export class EmailSendError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'EmailSendError';
    this.retryable = retryable;
  }
}
