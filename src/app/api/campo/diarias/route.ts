import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const vistoriaId = searchParams.get('vistoriaId')
    const usuarioId  = searchParams.get('usuarioId')

    const where: any = {}
    if (vistoriaId) where.vistoriaId = vistoriaId
    if (usuarioId) where.usuarioId = usuarioId
    // Técnico vê apenas os próprios apontamentos
    if (user.role === 'TECNICO_CAMPO') where.usuarioId = user.id

    const diarias = await prisma.diaria.findMany({
      where,
      include: {
        vistoria: { select: { id: true, titulo: true, projeto: { select: { codigo: true, imovelNome: true } } } },
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { data: 'desc' },
    })
    return NextResponse.json({ diarias })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const body = await request.json()
    const { vistoriaId, tipo, descricao, valor, comprovante } = body
    if (!vistoriaId || !valor) {
      return NextResponse.json({ error: 'Vistoria e valor são obrigatórios' }, { status: 400 })
    }
    const diaria = await prisma.diaria.create({
      data: {
        vistoriaId,
        usuarioId: user.id,
        tipo: tipo || 'OUTRO',
        descricao,
        valor: parseFloat(valor),
        comprovante,
      },
      include: { usuario: { select: { id: true, nome: true } } }
    })
    return NextResponse.json({ diaria }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    const diaria = await prisma.diaria.findUnique({ where: { id } })
    if (!diaria) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
    // Só o próprio técnico ou admin pode deletar
    if (diaria.usuarioId !== user.id && !['ADMIN', 'GESTOR_GERAL', 'GESTOR_CAMPO'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    await prisma.diaria.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
