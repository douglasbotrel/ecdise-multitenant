// Resolução de banco por cliente (multi-tenant). Este arquivo é o único
// ponto do sistema que sabe conversar com o control-plane e resolver
// qual PrismaClient usar pra cada empresa.
import { PrismaClient } from '@prisma/client'

function getControlPlaneConfig() {
  const url = process.env.CONTROL_PLANE_URL
  const secret = process.env.CONTROL_PLANE_INTERNAL_SECRET
  if (!url || !secret) {
    throw new Error(
      'CONTROL_PLANE_URL e/ou CONTROL_PLANE_INTERNAL_SECRET não configurados nas variáveis de ambiente.'
    )
  }
  return { url: url.replace(/\/$/, ''), secret }
}

// ── Cache de PrismaClient por connection string ──────────────────────
// Evita reconectar no banco a cada requisição. Mantido em memória do
// processo (sobrevive entre requisições enquanto a instância serverless
// estiver "quente").
const tenantClients = new Map<string, PrismaClient>()

export function getTenantPrisma(databaseUrl: string): PrismaClient {
  let client = tenantClients.get(databaseUrl)
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
    tenantClients.set(databaseUrl, client)
  }
  return client
}

// ── Cache de empresaId -> databaseUrl ────────────────────────────────
// Evita chamar o control-plane a cada requisição só pra redescobrir o
// banco de uma empresa que já resolvemos antes nesta instância.
const empresaDatabaseCache = new Map<string, string>()

export interface TenantResolvido {
  empresaId: string
  nomeEmpresa: string
  databaseUrl: string
}

// Usado no LOGIN: descobre a empresa a partir do e-mail.
export async function resolverTenantPorEmail(email: string): Promise<TenantResolvido | null> {
  const { url, secret } = getControlPlaneConfig()

  const res = await fetch(`${url}/api/login-roteamento`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  })

  if (!res.ok) return null
  const data = await res.json()
  if (!data?.empresaId || !data?.databaseUrl) return null

  empresaDatabaseCache.set(data.empresaId, data.databaseUrl)
  return { empresaId: data.empresaId, nomeEmpresa: data.nomeEmpresa, databaseUrl: data.databaseUrl }
}

// Usado em toda requisição autenticada (via getCurrentUser): redescobre o
// banco a partir do empresaId guardado no JWT — usa cache em memória antes
// de chamar o control-plane de novo.
export async function resolverDatabaseUrlPorEmpresa(empresaId: string): Promise<string | null> {
  const cacheado = empresaDatabaseCache.get(empresaId)
  if (cacheado) return cacheado

  const { url, secret } = getControlPlaneConfig()

  const res = await fetch(`${url}/api/empresa-database`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ empresaId }),
    cache: 'no-store',
  })

  if (!res.ok) return null
  const data = await res.json()
  if (!data?.databaseUrl) return null

  empresaDatabaseCache.set(empresaId, data.databaseUrl)
  return data.databaseUrl
}
