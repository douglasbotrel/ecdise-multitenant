import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hashPassword, hasPermission } from '@/lib/auth'

// Valida complexidade mínima de senha
function validarSenha(senha: string): string | null {
  if (senha.length < 8)           return 'A senha deve ter pelo menos 8 caracteres'
  if (!/[A-Z]/.test(senha))       return 'A senha deve conter pelo menos uma letra maiúscula'
  if (!/[0-9]/.test(senha))       return 'A senha deve conter pelo menos um número'
  return null
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const departamento = searchParams.get('departamento')
    const ativo = searchParams.get('ativo')

    const where: any = {}
    if (role) where.role = role
    if (departamento) where.departamento = departamento
    if (ativo !== null && ativo !== undefined) where.ativo = ativo === 'true'

    const usuarios = await prisma.usuario.findMany({
      where,
      select: {
        id: true, nome: true, email: true, cargo: true,
        role: true, departamento: true, ativo: true, criadoEm: true,
        _count: { select: { projetosResponsavel: true } }
      },
      orderBy: { nome: 'asc' }
    })

    return NextResponse.json({ usuarios })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.role, 'GESTOR_GERAL')) {
      return NextResponse.json({ error: 'Sem permissão para criar usuários' }, { status: 403 })
    }

    const body = await request.json()
    const { nome, email, senha, cargo, role, departamento, telefone, modulosAcesso } = body

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 })
    }

    // Valida complexidade da senha
    const erroSenha = validarSenha(senha)
    if (erroSenha) {
      return NextResponse.json({ error: erroSenha }, { status: 400 })
    }

    // Valida formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Formato de email inválido' }, { status: 400 })
    }

    const existing = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (existing) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
    }

    const senhaHash = await hashPassword(senha)
    const usuario = await prisma.usuario.create({
      data: {
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        senha: senhaHash,
        cargo,
        role: role || 'ANALISTA',
        departamento: departamento || 'OPERACIONAL_AMBIENTAL',
        telefone,
        modulosAcesso: modulosAcesso || null,
        ativo: true,
      },
      select: {
        id: true, nome: true, email: true, cargo: true,
        role: true, departamento: true, ativo: true
      }
    })

    await prisma.log.create({
      data: { usuarioId: user.id, acao: 'CRIAR_USUARIO', entidade: 'Usuario', entidadeId: usuario.id }
    })

    return NextResponse.json({ usuario }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
