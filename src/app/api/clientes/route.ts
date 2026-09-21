import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = { ativo: true }
    if (search) {
      where.OR = [
        { nome: { contains: search } },
        { cpfCnpj: { contains: search } },
        { email: { contains: search } },
        { municipio: { contains: search } },
      ]
    }

    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { nome: 'asc' },
      take: limit,
      include: {
        _count: { select: { projetos: true } },
        projetos: {
          select: {
            id: true, codigo: true, imovelNome: true, imovelEndereco: true,
            municipio: true, estado: true, car: true, areaHectares: true,
          },
          orderBy: { criadoEm: 'desc' },
        },
      }
    })

    return NextResponse.json({ clientes })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { nome, cpfCnpj, email, telefone, endereco, municipio, estado, cep, observacoes } = body

    if (!nome || !cpfCnpj) {
      return NextResponse.json({ error: 'Nome e CPF/CNPJ são obrigatórios' }, { status: 400 })
    }

    // Verifica se já existe
    const existing = await prisma.cliente.findUnique({ where: { cpfCnpj } })
    if (existing) {
      return NextResponse.json({ error: 'CPF/CNPJ já cadastrado' }, { status: 409 })
    }

    const cliente = await prisma.cliente.create({
      data: { nome, cpfCnpj, email, telefone, endereco, municipio, estado, cep, observacoes }
    })

    await prisma.log.create({
      data: { usuarioId: user.id, acao: 'CRIAR_CLIENTE', entidade: 'Cliente', entidadeId: cliente.id }
    })

    return NextResponse.json({ cliente }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
