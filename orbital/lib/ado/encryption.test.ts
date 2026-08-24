import { describe, test, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.ADO_ENCRYPTION_KEY = 'a'.repeat(64)
})

test('encryptPat returns three colon-separated hex segments', async () => {
  const { encryptPat } = await import('./encryption')
  const result = encryptPat('my-secret-pat')
  const parts = result.split(':')
  expect(parts).toHaveLength(3)
  // IV = 12 bytes = 24 hex chars; GCM tag = 16 bytes = 32 hex chars
  expect(parts[0]).toHaveLength(24)
  expect(parts[1]).toHaveLength(32)
})

test('decryptPat round-trips correctly', async () => {
  const { encryptPat, decryptPat } = await import('./encryption')
  const pat = 'super-secret-token-abc123'
  expect(decryptPat(encryptPat(pat))).toBe(pat)
})

test('same plaintext produces different ciphertext each call (random IV)', async () => {
  const { encryptPat } = await import('./encryption')
  const a = encryptPat('same-pat')
  const b = encryptPat('same-pat')
  expect(a).not.toBe(b)
})

test('decryptPat throws on tampered ciphertext', async () => {
  const { encryptPat, decryptPat } = await import('./encryption')
  const encrypted = encryptPat('original')
  const tampered = encrypted.slice(0, -4) + '0000'
  expect(() => decryptPat(tampered)).toThrow()
})
