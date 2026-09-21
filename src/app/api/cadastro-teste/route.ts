import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { nome, email, whatsapp, estado, qtdFuncionarios, nomeEmpresa, usaSistema } = body

    if (!nome || !email || !whatsapp || !estado || !qtdFuncionarios || !nomeEmpresa || !usaSistema) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
    }

    const cadastro = await prisma.cadastroTeste.create({
      data: { nome, email, whatsapp, estado, qtdFuncionarios, nomeEmpresa, usaSistema },
    })

    return NextResponse.json({ ok: true, id: cadastro.id }, { status: 201 })
  } catch (err) {
    console.error('[cadastro-teste POST]', err)
    return NextResponse.json({ error: 'Erro interno ao salvar cadastro.' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!['ADMIN', 'GESTOR_GERAL'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const cadastros = await prisma.cadastroTeste.findMany({
      orderBy: { criadoEm: 'desc' },
    })
    return NextResponse.json(cadastros)
  } catch (err) {
    console.error('[cadastro-teste GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
