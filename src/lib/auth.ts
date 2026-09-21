import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

// Acessa JWT_SECRET de forma lazy (só na hora de usar), nunca no carregamento do módulo.
// Isso permite que o Next.js compile as rotas sem precisar do env durante o build.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET não definido nas variáveis de ambiente.')
  }
  return secret
}

const JWT_EXPIRES_IN = () => process.env.JWT_EXPIRES_IN || '7d'

export interface JWTPayload {
  id: string
  email: string
  nome: string
  role: string
  departamento: string
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN() as jwt.SignOptions['expiresIn'],
  })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('ecdise_token')?.value
    if (!token) return null

    const payload = verifyToken(token)
    if (!payload) return null

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id },
      select: { ativo: true },
    })
    if (!usuario || !usuario.ativo) return null

    return payload
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<JWTPayload> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export const ROLE_HIERARCHY: Record<string, number> = {
  TECNICO_CAMPO: 1,
  ANALISTA_RAPIDO: 2,
  ANALISTA: 2,
  SUPERVISOR: 3,
  GESTOR_CAMPO: 4,
  GESTOR_OPERACIONAL: 5,
  GESTOR_ADMINISTRATIVO: 6,
  GESTOR_GERAL: 7,
  ADMIN: 8,
}

export function hasPermission(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0)
}

export const MODULE_ACCESS: Record<string, string[]> = {
  comercial: ['GESTAO_GERAL', 'COMERCIAL', 'CONTRATOS'],
  clientes: ['GESTAO_GERAL', 'COMERCIAL', 'CONTRATOS'],
  contratos: ['GESTAO_GERAL', 'COMERCIAL', 'FINANCEIRO', 'CONTRATOS'],
  operacional: ['GESTAO_GERAL', 'OPERACIONAL_AMBIENTAL', 'OPERACIONAL_REGULARIZACAO'],
  acompanhamento: ['GESTAO_GERAL', 'OPERACIONAL_AMBIENTAL', 'OPERACIONAL_REGULARIZACAO'],
  campo: ['GESTAO_GERAL', 'GESTAO_CAMPO', 'OPERACIONAL_AMBIENTAL', 'OPERACIONAL_REGULARIZACAO'],
  financeiro: ['GESTAO_GERAL', 'FINANCEIRO', 'COMERCIAL'],
  configuracoes: ['GESTAO_GERAL'],
  bi: ['GESTAO_GERAL', 'BI'],
}

export function canAccessModule(userDepartamento: string, modulo: string): boolean {
  const allowedDepartamentos = MODULE_ACCESS[modulo] || []
  return allowedDepartamentos.includes(userDepartamento) || userDepartamento === 'GESTAO_GERAL'
}
