import { describe, expect, it } from 'vitest';
import { generateToken, hashToken } from '../../../src/utils/token.js';

const HEX_64 = /^[a-f0-9]{64}$/;

describe('hashToken', () => {
  it('returns a 64-character hex digest', () => {
    expect(hashToken('some-token')).toMatch(HEX_64);
  });

  it('is deterministic for the same input', () => {
    expect(hashToken('some-token')).toBe(hashToken('some-token'));
  });

  it('returns different digests for different inputs', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  it('does not contain the original token', () => {
    const token = 'plain-token';

    expect(hashToken(token)).not.toContain(token);
  });

  it('matches the known SHA-256 digest of an input', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('generateToken', () => {
  it('returns a 64-character hex string', () => {
    expect(generateToken()).toMatch(HEX_64);
  });

  it('returns a unique token on every call', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateToken()));

    expect(tokens.size).toBe(1000);
  });
});
