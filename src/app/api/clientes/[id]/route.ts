import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const cliente = await prisma.cliente.findUnique({
      where: { id: params.id },
      include: {
        projetos: {
          include: { contrato: true },
          orderBy: { criadoEm: 'desc' }
        },
        _count: { select: { projetos: true, contratos: true } }
      }
    })

    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    return NextResponse.json({ cliente })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: body
    })

    return NextResponse.json({ cliente })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
