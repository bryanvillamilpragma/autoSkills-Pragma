import { createHash } from 'node:crypto'
import { deepStrictEqual, doesNotThrow, ok, strictEqual, throws } from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import {
  checkAuth,
  generateCodeChallenge,
  generateCodeVerifier,
  loadToken,
  saveToken,
  validatePragmaAccount,
} from '../auth.js'
import type { TokenData } from '../auth.js'
import { useTmpDir } from './helpers.js'

// useTmpDir registers beforeEach (creates dir) first, then our beforeEach sets the env var.
// afterEach order is reversed: env var deleted first, then dir removed.
const tmp = useTmpDir('autoskills-auth-test-')

beforeEach(() => {
  process.env.AUTOSKILLS_CONFIG_DIR = tmp.path
})

afterEach(() => {
  delete process.env.AUTOSKILLS_CONFIG_DIR
})

// ── generateCodeVerifier ──────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('produces a 43-character base64url string', () => {
    const v = generateCodeVerifier()
    strictEqual(v.length, 43)
  })

  it('only contains base64url characters', () => {
    const v = generateCodeVerifier()
    ok(/^[A-Za-z0-9\-_]+$/.test(v), `unexpected chars in: ${v}`)
  })

  it('produces a different value each call', () => {
    const a = generateCodeVerifier()
    const b = generateCodeVerifier()
    ok(a !== b, 'verifiers should be unique')
  })
})

// ── generateCodeChallenge ─────────────────────────────────────

describe('generateCodeChallenge', () => {
  it('produces the SHA-256 base64url of the verifier', () => {
    const verifier = 'test-verifier-string'
    const expected = createHash('sha256').update(verifier).digest('base64url')
    strictEqual(generateCodeChallenge(verifier), expected)
  })

  it('only contains base64url characters', () => {
    const challenge = generateCodeChallenge(generateCodeVerifier())
    ok(/^[A-Za-z0-9\-_]+$/.test(challenge), `unexpected chars in challenge`)
  })
})

// ── validatePragmaAccount ─────────────────────────────────────

describe('validatePragmaAccount', () => {
  it('accepts a valid @pragma.com.co email', () => {
    doesNotThrow(() => validatePragmaAccount('user@pragma.com.co'))
  })

  it('accepts valid email with matching hd claim', () => {
    doesNotThrow(() => validatePragmaAccount('user@pragma.com.co', 'pragma.com.co'))
  })

  it('rejects email from a different domain', () => {
    throws(
      () => validatePragmaAccount('user@gmail.com'),
      /Acceso denegado/,
    )
  })

  it('rejects an email that only ends with the domain string but has a different TLD', () => {
    throws(
      () => validatePragmaAccount('user@notpragma.com.co'),
      /Acceso denegado/,
    )
  })

  it('rejects when hd claim does not match the domain', () => {
    throws(
      () => validatePragmaAccount('user@pragma.com.co', 'other.com'),
      /Acceso denegado/,
    )
  })
})

// ── loadToken ─────────────────────────────────────────────────

describe('loadToken', () => {
  it('returns null when auth.json does not exist', () => {
    strictEqual(loadToken(), null)
  })
})

// ── saveToken / loadToken round-trip ──────────────────────────

describe('saveToken / loadToken round-trip', () => {
  it('saves and reloads a token without data loss', () => {
    const token: TokenData = {
      access_token:  'test-access-token',
      refresh_token: 'test-refresh-token',
      expiry_date:   Date.now() + 3_600_000,
      email:         'user@pragma.com.co',
    }

    saveToken(token)
    deepStrictEqual(loadToken(), token)
  })
})

// ── checkAuth ─────────────────────────────────────────────────

describe('checkAuth', () => {
  it('returns null when no token is stored', async () => {
    strictEqual(await checkAuth(), null)
  })

  it('returns the stored token when it is valid and not expired', async () => {
    const token: TokenData = {
      access_token:  'valid-access-token',
      refresh_token: 'valid-refresh-token',
      expiry_date:   Date.now() + 3_600_000,
      email:         'user@pragma.com.co',
    }
    saveToken(token)
    deepStrictEqual(await checkAuth(), token)
  })

  it('returns null when token is expired and refresh fails', async () => {
    // Uses an invalid refresh_token so Google rejects it (or the network call fails).
    // checkAuth() catches all errors from refreshAccessToken and returns null.
    saveToken({
      access_token:  'old-access-token',
      refresh_token: 'invalid-refresh-token',
      expiry_date:   1,   // clearly in the past
      email:         'user@pragma.com.co',
    })

    strictEqual(await checkAuth(), null)
  })
})
