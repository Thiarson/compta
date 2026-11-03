import { describe, expect, it } from 'vitest';
import { renderEmail } from '../../../src/workers/email.worker.js';

describe('renderEmail', () => {
  const params = { username: 'alice', url: 'http://app.test/x?token=abc' };

  it.each([
    ['verify-email', 'Verify your Compta email'],
    ['reset-password', 'Reset your Compta password'],
  ] as const)('renders the %s template', (template, subject) => {
    const email = renderEmail({ to: 'alice@test.dev', template, params });

    expect(email.subject).toBe(subject);
    expect(email.html).toContain('Hi alice,');
    expect(email.html).toContain(params.url);
  });

  it('escapes the username', () => {
    const { html } = renderEmail({
      to: 'a@test.dev',
      template: 'reset-password',
      params: { ...params, username: '<script>' },
    });

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
