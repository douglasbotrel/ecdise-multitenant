import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// Filtro reutilizado em toda consulta de Pagamento — ignora projetos excluídos
const PROJETO_ATIVO = { contrato: { projeto: { excluido: false } } }

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const hoje = new Date()
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    const fimSeteDias = new Date(inicioHoje)
    fimSeteDias.setDate(fimSeteDias.getDate() + 7)
    fimSeteDias.setHours(23, 59, 59, 999)

    // ── Evolução financeira dos últimos 6 meses ─────────────────────────────
    const evolucaoFinanceira = []

    for (let i = 5; i >= 0; i--) {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const fimMes   = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0, 23, 59, 59)

      const [recebido, pendente] = await Promise.all([
        // Recebido: pagamentos com status PAGO e dataPagamento no mês
        prisma.pagamento.aggregate({
          where: {
            status: 'PAGO',
            dataPagamento: { gte: inicioMes, lte: fimMes },
            ...PROJETO_ATIVO,
          },
          _sum: { valor: true },
        }),
        // Pendente: pagamentos ainda PENDENTE com dataVencimento no mês
        prisma.pagamento.aggregate({
          where: {
            status: { in: ['PENDENTE', 'VENCIDO'] },
            dataVencimento: { gte: inicioMes, lte: fimMes },
            ...PROJETO_ATIVO,
          },
          _sum: { valor: true },
        }),
      ])

      evolucaoFinanceira.push({
        mes: inicioMes.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        recebido: recebido._sum.valor ?? 0,
        pendente: pendente._sum.valor ?? 0,
      })
    }

    // ── Totais gerais ───────────────────────────────────────────────────────
    const [
      totalRecebido,
      totalPendente,
      totalVencido,
      pagamentosPorForma,
    ] = await Promise.all([
      prisma.pagamento.aggregate({
        where: { status: 'PAGO', ...PROJETO_ATIVO },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.pagamento.aggregate({
        where: { status: 'PENDENTE', ...PROJETO_ATIVO },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.pagamento.aggregate({
        where: { status: 'PENDENTE', dataVencimento: { lt: hoje }, ...PROJETO_ATIVO },
        _sum: { valor: true },
        _count: true,
      }),
      // Distribuição por forma de pagamento
      prisma.pagamento.groupBy({
        by: ['formaPagamento'],
        where: { status: 'PAGO', formaPagamento: { not: null }, ...PROJETO_ATIVO },
        _sum: { valor: true },
        _count: true,
        orderBy: { _sum: { valor: 'desc' } },
      }),
    ])

    // ── Distribuição de serviços contratados ────────────────────────────────
    // Parseia o JSON de cada projeto para contar serviços individualmente
    const projetosComServicos = await prisma.projeto.findMany({
      where: {
        servicosContratados: { not: null },
        etapaPipeline: { not: 'CANCELADO' },
        excluido: false,
      },
      select: {
        servicosContratados: true,
        etapaPipeline: true,
        contrato: { select: { valorTotal: true } },
      },
    })

    // Agrupa por nome do serviço: quantidade de projetos e valor total de contratos
    const servicoMap: Record<string, { qtd: number; valor: number }> = {}
    for (const p of projetosComServicos) {
      if (!p.servicosContratados) continue
      let lista: string[] = []
      try { lista = JSON.parse(p.servicosContratados) } catch { continue }
      for (const nome of lista) {
        if (!nome) continue
        if (!servicoMap[nome]) servicoMap[nome] = { qtd: 0, valor: 0 }
        servicoMap[nome].qtd += 1
        servicoMap[nome].valor += p.contrato?.valorTotal ?? 0
      }
    }
    const servicosContratados = Object.entries(servicoMap)
      .map(([nome, { qtd, valor }]) => ({ nome, qtd, valor }))
      .sort((a, b) => b.qtd - a.qtd)

    // ── Panorama de Pendências (Acompanhamento de Processos) ────────────────
    // Considera apenas pendências de projetos atualmente em acompanhamento
    // (e não excluídos, senão continuariam contando no painel para sempre)
    const filtroProjetoAcompanhamento = { projeto: { emAcompanhamento: true, excluido: false } }

    const [
      pendenciasAbertas,
      pendenciasAVencer,
      pendenciasAtrasadas,
      pendenciasRespondidas,
    ] = await Promise.all([
      prisma.pendencia.count({
        where: { status: 'ABERTA', ...filtroProjetoAcompanhamento },
      }),
      prisma.pendencia.count({
        where: {
          status: 'ABERTA',
          prazoResposta: { gte: inicioHoje, lte: fimSeteDias },
          ...filtroProjetoAcompanhamento,
        },
      }),
      prisma.pendencia.count({
        where: {
          status: 'ABERTA',
          prazoResposta: { lt: inicioHoje },
          ...filtroProjetoAcompanhamento,
        },
      }),
      prisma.pendencia.count({
        where: { status: 'CONCLUIDA', ...filtroProjetoAcompanhamento },
      }),
    ])

    // ── Tempos médios (operacional, protocolo→licença, tratativa de pendência) ──
    function mediaDias(pares: { inicio: Date; fim: Date }[]): number | null {
      const dias = pares
        .map(p => (p.fim.getTime() - p.inicio.getTime()) / 86_400_000)
        .filter(d => d >= 0)
      if (dias.length === 0) return null
      return Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 10) / 10
    }

    const [projetosOperacional, projetosComLicenca, pendenciasResolvidas] = await Promise.all([
      // Tempo médio operacional: do início da execução (dataInicio) até o protocolo no órgão
      prisma.projeto.findMany({
        where: { dataInicio: { not: null }, protocoloData: { not: null }, excluido: false },
        select: { dataInicio: true, protocoloData: true },
      }),
      // Tempo médio até a licença: do protocolo até a emissão da licença
      prisma.projeto.findMany({
        where: { protocoloData: { not: null }, licenca: { isNot: null }, excluido: false },
        select: { protocoloData: true, licenca: { select: { dataEmissao: true } } },
      }),
      // Tempo médio de tratativa de pendência: da abertura até a entrega da resposta
      prisma.pendencia.findMany({
        where: { dataEntrega: { not: null }, projeto: { excluido: false } },
        select: { data: true, dataEntrega: true },
      }),
    ])

    const tempoMedioOperacionalDias = mediaDias(
      projetosOperacional.map(p => ({ inicio: p.dataInicio!, fim: p.protocoloData! }))
    )
    const tempoMedioLicencaDias = mediaDias(
      projetosComLicenca
        .filter(p => p.licenca?.dataEmissao)
        .map(p => ({ inicio: p.protocoloData!, fim: p.licenca!.dataEmissao }))
    )
    const tempoMedioPendenciaDias = mediaDias(
      pendenciasResolvidas.map(p => ({ inicio: p.data, fim: p.dataEntrega! }))
    )

    return NextResponse.json({
      evolucaoFinanceira,
      totais: {
        totalRecebido:    totalRecebido._sum.valor   ?? 0,
        qtdRecebido:      totalRecebido._count,
        totalPendente:    totalPendente._sum.valor    ?? 0,
        qtdPendente:      totalPendente._count,
        totalVencido:     totalVencido._sum.valor     ?? 0,
        qtdVencido:       totalVencido._count,
      },
      pagamentosPorForma: pagamentosPorForma.map(p => ({
        forma:  p.formaPagamento ?? 'Não informado',
        valor:  p._sum.valor ?? 0,
        qtd:    p._count,
      })),
      servicosContratados,
      pendencias: {
        abertas:     pendenciasAbertas,
        aVencer:     pendenciasAVencer,
        atrasadas:   pendenciasAtrasadas,
        respondidas: pendenciasRespondidas,
      },
      tempos: {
        operacionalDias:   tempoMedioOperacionalDias,
        operacionalAmostra: projetosOperacional.length,
        licencaDias:        tempoMedioLicencaDias,
        licencaAmostra:     projetosComLicenca.filter(p => p.licenca?.dataEmissao).length,
        pendenciaDias:      tempoMedioPendenciaDias,
        pendenciaAmostra:   pendenciasResolvidas.length,
      },
    })
  } catch (error) {
    console.error('Erro na API BI:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
