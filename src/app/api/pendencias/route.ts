import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET /api/pendencias?projetoId=...
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const projetoId = searchParams.get('projetoId')

    const where: any = { projeto: { excluido: false } }
    if (projetoId) where.projetoId = projetoId

    const pendencias = await prisma.pendencia.findMany({
      where,
      include: {
        acoes: {
          orderBy: { criadoEm: 'asc' },
          include: { responsavel: { select: { id: true, nome: true } } }
        }
      },
      orderBy: { criadoEm: 'desc' },
    })

    return NextResponse.json({ pendencias })
  } catch (error) {
    console.error('Erro ao buscar pendências:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/pendencias — cria uma nova pendência com sua lista de ações
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { projetoId, numeroPedido, data, prazoResposta, acoes } = body

    if (!projetoId || !numeroPedido || !data || !prazoResposta) {
      return NextResponse.json(
        { error: 'Número do pedido, data e prazo de resposta são obrigatórios' },
        { status: 400 }
      )
    }
    if (!Array.isArray(acoes) || acoes.length === 0) {
      return NextResponse.json({ error: 'Inclua pelo menos uma ação' }, { status: 400 })
    }
    for (const a of acoes) {
      if (!a.descricao || !a.descricao.trim()) {
        return NextResponse.json({ error: 'Toda ação precisa de uma descrição' }, { status: 400 })
      }
    }

    const projeto = await prisma.projeto.findUnique({ where: { id: projetoId } })
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const pendencia = await prisma.pendencia.create({
      data: {
        projetoId,
        numeroPedido,
        data: new Date(data),
        prazoResposta: new Date(prazoResposta),
        status: 'ABERTA',
        acoes: {
          create: acoes.map((a: any) => ({
            descricao: a.descricao,
            responsavelId: a.responsavelId || null,
          })),
        },
      },
      include: {
        acoes: { include: { responsavel: { select: { id: true, nome: true } } } }
      },
    })

    // Notifica os responsáveis designados em cada ação
    const responsavelIds = Array.from(
      new Set(acoes.map((a: any) => a.responsavelId).filter(Boolean))
    ) as string[]
    if (responsavelIds.length > 0) {
      await prisma.notificacao.createMany({
        data: responsavelIds.map(uid => ({
          usuarioId: uid,
          titulo: '📌 Nova pendência no processo',
          mensagem: `Projeto ${projeto.codigo} — ${projeto.imovelNome || projeto.tipoServico}: pedido ${numeroPedido}. Prazo de resposta: ${new Date(prazoResposta).toLocaleDateString('pt-BR')}.`,
          tipo: 'info',
          link: `/acompanhamento/${projetoId}`,
        })),
      }).catch(() => {})
    }

    await prisma.log.create({
      data: {
        usuarioId: user.id,
        acao: 'CRIAR_PENDENCIA',
        entidade: 'Pendencia',
        entidadeId: pendencia.id,
        detalhes: `Pedido ${numeroPedido} criado no projeto ${projeto.codigo}`,
      },
    }).catch(() => {})

    return NextResponse.json({ pendencia }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pendência:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
