import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

import { bold, dim, green, log } from './colors.js'

const PRAGMA_DOMAIN   = 'pragma.com.co'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES          = 'openid email'

// CLIENT_ID/SECRET are embedded at build time via env vars (acceptable for desktop apps per Google).
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? '<PLACEHOLDER>'
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '<PLACEHOLDER>'

export interface TokenData {
  access_token:  string
  refresh_token: string
  expiry_date:   number   // Unix ms
  email:         string
}

interface GoogleTokenResponse {
  access_token:       string
  refresh_token?:     string
  expires_in:         number
  id_token:           string
  error?:             string
  error_description?: string
}

interface IdTokenPayload {
  email:          string
  email_verified: boolean
  hd?:            string
}

// Config path is read lazily so that AUTOSKILLS_CONFIG_DIR can be set before any call (useful in tests).
function getConfigDir(): string {
  const base = process.env.AUTOSKILLS_CONFIG_DIR ?? join(homedir(), '.config')
  return join(base, 'autoskills-pragma')
}

function getAuthFile(): string {
  return join(getConfigDir(), 'auth.json')
}

// ── PKCE helpers (RFC 7636) ───────────────────────────────────

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

function generateState(): string {
  return randomBytes(16).toString('hex')
}

// ── Token storage (chmod 600) ─────────────────────────────────

export function loadToken(): TokenData | null {
  try {
    const authFile = getAuthFile()
    if (!existsSync(authFile)) return null
    return JSON.parse(readFileSync(authFile, 'utf-8')) as TokenData
  } catch {
    return null
  }
}

export function saveToken(data: TokenData): void {
  const configDir = getConfigDir()
  const authFile  = getAuthFile()
  mkdirSync(configDir, { recursive: true })
  writeFileSync(authFile, JSON.stringify(data, null, 2), { mode: 0o600 })
  // Enforce permissions even if the file already existed with different perms.
  chmodSync(authFile, 0o600)
}

function clearToken(): void {
  const authFile = getAuthFile()
  if (existsSync(authFile)) rmSync(authFile)
}

// ── Browser opener ────────────────────────────────────────────

async function openBrowser(url: string): Promise<void> {
  const [cmd, args] =
    process.platform === 'darwin' ? (['open', [url]] as const)
    : process.platform === 'win32' ? (['cmd', ['/c', 'start', url]] as const)
    : (['xdg-open', [url]] as const)

  return new Promise((resolve) => {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
    child.unref()
    resolve()
  })
}

// ── Loopback callback server ──────────────────────────────────

async function waitForCode(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url   = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      const code  = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html><html><body><h2>Error: ${error}</h2><p>Puedes cerrar esta ventana.</p></body></html>`)
        server.close()
        reject(new Error(`Google OAuth error: ${error}`))
        return
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html><html><body><h2>Solicitud inválida</h2><p>Puedes cerrar esta ventana.</p></body></html>`)
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!DOCTYPE html><html><body><h2>✓ Autenticado correctamente</h2><p>Puedes cerrar esta ventana y volver a la terminal.</p></body></html>`)
      server.close()
      resolve(code)
    })

    server.on('error', (err) => reject(err))
    server.listen(port, '127.0.0.1')
  })
}

// ── HTTPS helper ──────────────────────────────────────────────

async function httpsPost(hostname: string, path: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type':   'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Token exchange ────────────────────────────────────────────

async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri:  redirectUri,
    grant_type:    'authorization_code',
    code_verifier: verifier,
  }).toString()

  const raw  = await httpsPost('oauth2.googleapis.com', '/token', body)
  const data = JSON.parse(raw) as GoogleTokenResponse

  if (data.error) {
    throw new Error(`Token exchange failed: ${data.error_description ?? data.error}`)
  }

  return data
}

// ── Domain validation ─────────────────────────────────────────

export function validatePragmaAccount(email: string, hd?: string): void {
  if (!email.endsWith(`@${PRAGMA_DOMAIN}`)) {
    throw new Error(
      `Acceso denegado: solo se permiten cuentas @${PRAGMA_DOMAIN}. Cuenta usada: ${email}`,
    )
  }
  if (hd !== undefined && hd !== PRAGMA_DOMAIN) {
    throw new Error(
      `Acceso denegado: dominio no permitido. Esperado: ${PRAGMA_DOMAIN}, recibido: ${hd}`,
    )
  }
}

// ── ID token decode ───────────────────────────────────────────

function decodeIdToken(idToken: string): IdTokenPayload {
  const segments = idToken.split('.')
  if (segments.length !== 3) throw new Error('ID token inválido')
  // No signature verification needed: token was received directly over TLS from Google.
  return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf-8')) as IdTokenPayload
}

// ── Token refresh ─────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type:    'refresh_token',
  }).toString()

  const raw  = await httpsPost('oauth2.googleapis.com', '/token', body)
  const data = JSON.parse(raw) as {
    access_token:       string
    expires_in:         number
    error?:             string
    error_description?: string
  }

  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description ?? data.error}`)
  }

  const existing = loadToken()
  if (!existing) throw new Error('No se encontró token existente para refrescar')

  const refreshed: TokenData = {
    access_token:  data.access_token,
    refresh_token: refreshToken,
    expiry_date:   Date.now() + (data.expires_in - 30) * 1000, // 30 s safety margin
    email:         existing.email,
  }

  saveToken(refreshed)
  return refreshed
}

// ── Public API ────────────────────────────────────────────────

export async function checkAuth(): Promise<TokenData | null> {
  const token = loadToken()
  if (!token) return null

  if (Date.now() >= token.expiry_date) {
    try {
      return await refreshAccessToken(token.refresh_token)
    } catch {
      return null
    }
  }

  return token
}

export async function authenticate(): Promise<TokenData> {
  if (CLIENT_ID === '<PLACEHOLDER>' || CLIENT_SECRET === '<PLACEHOLDER>') {
    throw new Error(
      'Google OAuth no está configurado. Define las variables de entorno GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.',
    )
  }

  const port        = Math.floor(Math.random() * 7000) + 3000  // 3000–9999
  const verifier    = generateCodeVerifier()
  const challenge   = generateCodeChallenge(verifier)
  const state       = generateState()
  const redirectUri = `http://127.0.0.1:${port}`

  const authUrl = new URL(GOOGLE_AUTH_URL)
  authUrl.searchParams.set('client_id',             CLIENT_ID)
  authUrl.searchParams.set('redirect_uri',          redirectUri)
  authUrl.searchParams.set('response_type',         'code')
  authUrl.searchParams.set('scope',                 SCOPES)
  authUrl.searchParams.set('code_challenge',        challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state',                 state)
  authUrl.searchParams.set('access_type',           'offline')
  authUrl.searchParams.set('prompt',                'consent')

  log()
  log(`  Abriendo tu navegador...`)
  log(dim(`  → ${authUrl.toString()}`))
  log()
  log(dim(`  ⏳ Esperando autorización en ${redirectUri}...`))

  await openBrowser(authUrl.toString())
  const code    = await waitForCode(port, state)
  const tokens  = await exchangeCode(code, verifier, redirectUri)
  const payload = decodeIdToken(tokens.id_token)

  if (!payload.email_verified) {
    throw new Error('La cuenta de Google no tiene el email verificado.')
  }

  validatePragmaAccount(payload.email, payload.hd)

  if (!tokens.refresh_token) {
    throw new Error('Google no retornó refresh_token. Asegúrate de solicitar access_type=offline.')
  }

  const tokenData: TokenData = {
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date:   Date.now() + (tokens.expires_in - 30) * 1000,
    email:         payload.email,
  }

  saveToken(tokenData)

  log()
  log(green(bold(`  ✓ Autenticado como ${payload.email}`)))
  log()

  return tokenData
}

async function revokeToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token }).toString()
  await httpsPost('oauth2.googleapis.com', '/revoke', body)
}

export async function logout(): Promise<void> {
  const stored = loadToken()
  if (stored) {
    try {
      // Prefer refresh_token: revoking it invalidates both tokens on Google's side.
      await revokeToken(stored.refresh_token ?? stored.access_token)
    } catch {
      // Network failures must not prevent local token removal.
    }
  }
  clearToken()
}
