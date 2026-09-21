import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const frota = await prisma.frota.findMany({ orderBy: { placa: 'asc' } })
    return NextResponse.json({ frota })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const body = await request.json()
    const { placa, tipo, marca, modelo, ano, cor, kmAtual, documentoUrl } = body
    if (!placa) return NextResponse.json({ error: 'Placa obrigatória' }, { status: 400 })
    const veiculo = await prisma.frota.create({
      data: {
        placa: placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        tipo: tipo || 'CARRO',
        marca, modelo,
        ano: ano ? parseInt(ano) : null,
        cor, kmAtual: kmAtual ? parseFloat(kmAtual) : null,
        documentoUrl
      }
    })
    return NextResponse.json({ veiculo }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Placa já cadastrada' }, { status: 409 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const body = await request.json()
    const { id, placa, tipo, marca, modelo, ano, cor, kmAtual, documentoUrl, ativa } = body
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    const veiculo = await prisma.frota.update({
      where: { id },
      data: {
        ...(placa !== undefined && { placa: placa.toUpperCase().replace(/[^A-Z0-9]/g, '') }),
        ...(tipo !== undefined && { tipo }),
        ...(marca !== undefined && { marca }),
        ...(modelo !== undefined && { modelo }),
        ...(ano !== undefined && { ano: ano ? parseInt(ano) : null }),
        ...(cor !== undefined && { cor }),
        ...(kmAtual !== undefined && { kmAtual: kmAtual ? parseFloat(kmAtual) : null }),
        ...(documentoUrl !== undefined && { documentoUrl }),
        ...(ativa !== undefined && { ativa }),
      }
    })
    return NextResponse.json({ veiculo })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    await prisma.frota.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Erro interno' }, { status: 500 }) }
}
