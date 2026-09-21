import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const projetoId          = searchParams.get('projetoId')
    const status             = searchParams.get('status')
    const responsavelId      = searchParams.get('responsavelId')
    const responsavelAtual   = searchParams.get('responsavelAtual') // técnico vê as suas
    const dataInicio         = searchParams.get('dataInicio')
    const dataFim            = searchParams.get('dataFim')

    const where: any = { projeto: { excluido: false } }
    if (projetoId) where.projetoId = projetoId
    if (status) where.status = status
    if (responsavelId) where.responsavelId = responsavelId
    // Técnico: filtra apenas as vistorias atribuídas a ele
    if (responsavelAtual === 'true') where.responsavelId = user.id
    if (dataInicio || dataFim) {
      where.dataAgendada = {}
      if (dataInicio) where.dataAgendada.gte = new Date(dataInicio)
      if (dataFim) where.dataAgendada.lte = new Date(dataFim)
    }

    const vistorias = await prisma.vistoria.findMany({
      where,
      include: {
        projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true, tipoServico: true } },
        responsavel: { select: { id: true, nome: true } },
        equipeRef: { select: { id: true, nome: true, cor: true } },
        gastos: true,
        diarias: { include: { usuario: { select: { id: true, nome: true } } } },
        _count: { select: { documentos: true } }
      },
      orderBy: { dataAgendada: 'desc' }
    })

    return NextResponse.json({ vistorias })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const {
      projetoId, tarefaId, titulo, tipo, dataAgendada, dataSaida, dataVolta,
      local, municipio, responsavelId, equipeId, frotaId, equipe, frota, observacoes
    } = body

    if (!projetoId || !dataAgendada) {
      return NextResponse.json({ error: 'Projeto e data são obrigatórios' }, { status: 400 })
    }

    const vistoria = await prisma.vistoria.create({
      data: {
        projetoId,
        tarefaId: tarefaId || null,
        titulo: titulo || 'Vistoria de Campo',
        tipo: tipo || 'VISTORIA_CAMPO',
        dataAgendada: new Date(dataAgendada),
        dataSaida:    dataSaida ? new Date(dataSaida) : null,
        dataVolta:    dataVolta ? new Date(dataVolta) : null,
        local,
        municipio,
        responsavelId: responsavelId || null,
        equipeId:     equipeId  || null,
        frotaId:      frotaId   || null,
        equipe: equipe ? JSON.stringify(equipe) : null,
        frota,
        observacoes,
        status: 'AGENDADA',
      },
      include: {
        responsavel: { select: { id: true, nome: true } },
        projeto: { select: { id: true, codigo: true } },
      }
    })

    await prisma.log.create({
      data: { usuarioId: user.id, acao: 'CRIAR_VISTORIA', entidade: 'Vistoria', entidadeId: vistoria.id }
    })

    return NextResponse.json({ vistoria }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar vistoria:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
