import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const statusComercial = searchParams.get('statusComercial')
    const etapaPipeline = searchParams.get('etapaPipeline')
    const clienteId = searchParams.get('clienteId')
    const analistaRapidoId = searchParams.get('analistaRapidoId')
    const responsavelId = searchParams.get('responsavelId')
    const search = searchParams.get('search')
    const emAcompanhamento = searchParams.get('emAcompanhamento')
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')

    // suporta múltiplas etapas via "etapas=A,B,C"
    const etapasParam = searchParams.get('etapas')

    const where: any = {}
    // Projetos excluídos (soft-delete) nunca aparecem nas listagens normais
    if (searchParams.get('incluirExcluidos') !== 'true') {
      where.excluido = false
    }
    if (statusComercial) where.statusComercial = statusComercial
    if (etapaPipeline) where.etapaPipeline = etapaPipeline
    if (etapasParam) where.etapaPipeline = { in: etapasParam.split(',').map(e => e.trim()) }
    if (clienteId) where.clienteId = clienteId
    if (analistaRapidoId) where.analistaRapidoId = analistaRapidoId
    if (responsavelId) where.responsavelId = responsavelId
    if (emAcompanhamento === 'true')  where.emAcompanhamento = true
    if (emAcompanhamento === 'false') where.emAcompanhamento = false
    if (search) {
      where.OR = [
        { codigo: { contains: search } },
        { imovelNome: { contains: search } },
        { municipio: { contains: search } },
        { cliente: { nome: { contains: search } } },
      ]
    }

    // Restrição por role: analista rápido vê só os seus
    if (user.role === 'ANALISTA_RAPIDO') {
      where.analistaRapidoId = user.id
    } else if (user.role === 'ANALISTA' || user.role === 'TECNICO_CAMPO') {
      where.responsavelId = user.id
    }

    const [projetos, total] = await Promise.all([
      prisma.projeto.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, cpfCnpj: true } },
          responsavel: { select: { id: true, nome: true } },
          supervisor: { select: { id: true, nome: true } },
          analistaRapido: { select: { id: true, nome: true } },
          contrato: { select: { id: true, codigo: true, statusContrato: true, valorTotal: true, valorRestante: true } },
          licenca: { select: { id: true, numero: true, dataEmissao: true, dataValidade: true } },
          pendencias: { select: { id: true, status: true, prazoResposta: true, numeroPedido: true, data: true } },
          _count: { select: { tarefas: true, vistorias: true, documentos: true } },
        },
        orderBy: { criadoEm: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.projeto.count({ where }),
    ])

    return NextResponse.json({ projetos, total, page, limit })
  } catch (error) {
    console.error('Erro ao buscar projetos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const {
      clienteId, tipoServico, descricao, imovelNome, imovelEndereco,
      municipio, estado, car, areaHectares, valorProposto,
      observacoes, analistaRapidoId,
    } = body

    if (!clienteId || !tipoServico) {
      return NextResponse.json({ error: 'Cliente e tipo de serviço são obrigatórios' }, { status: 400 })
    }

    // Código sequencial
    const count = await prisma.projeto.count()
    const codigo = `PRJ-${String(count + 1).padStart(4, '0')}`

    const projeto = await prisma.projeto.create({
      data: {
        codigo,
        clienteId,
        tipoServico,
        descricao,
        imovelNome,
        imovelEndereco,
        municipio,
        estado,
        car,
        areaHectares: areaHectares ? parseFloat(areaHectares) : null,
        valorProposto: valorProposto ? parseFloat(valorProposto) : null,
        observacoes,
        analistaRapidoId: analistaRapidoId || null,
        etapaPipeline: 'SOLICITACAO',
        statusComercial: 'RECEBIDO',
        statusOperacional: 'NAO_INICIADO',
      },
      include: {
        cliente: true,
        analistaRapido: { select: { id: true, nome: true, email: true } },
      },
    })

    // Notifica o analista rápido designado
    if (analistaRapidoId) {
      await prisma.notificacao.create({
        data: {
          usuarioId: analistaRapidoId,
          titulo: 'Nova solicitação para análise',
          mensagem: `Projeto ${codigo} — ${imovelNome || tipoServico} (${municipio || 'sem município'}) aguarda sua análise técnica rápida.`,
          tipo: 'info',
          link: `/comercial`,
        },
      })
    }

    await prisma.log.create({
      data: {
        usuarioId: user.id,
        acao: 'CRIAR_PROJETO',
        entidade: 'Projeto',
        entidadeId: projeto.id,
        detalhes: `Projeto ${codigo} criado — etapa: SOLICITACAO`,
      },
    })

    return NextResponse.json({ projeto }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar projeto:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
