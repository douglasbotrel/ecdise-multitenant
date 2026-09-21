import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const equipes = await prisma.equipe.findMany({ orderBy: { nome: 'asc' } })
    return NextResponse.json({ equipes })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const body = await request.json()
    const { nome, cor, membros } = body
    if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    const equipe = await prisma.equipe.create({
      data: { nome, cor: cor || '#3b82f6', membros: membros ? JSON.stringify(membros) : null }
    })
    return NextResponse.json({ equipe }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const body = await request.json()
    const { id, nome, cor, membros, ativa } = body
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    const equipe = await prisma.equipe.update({
      where: { id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(cor !== undefined && { cor }),
        ...(membros !== undefined && { membros: JSON.stringify(membros) }),
        ...(ativa !== undefined && { ativa }),
      }
    })
    return NextResponse.json({ equipe })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    await prisma.equipe.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
