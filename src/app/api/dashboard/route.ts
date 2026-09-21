import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const hoje = new Date()
    const proximos30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)

    // ── ANALISTA DE SERVIÇO RÁPIDO ──────────────────────────────
    if (user.role === 'ANALISTA_RAPIDO') {
      const [aguardando, emAnalise, concluidos, projetos] = await Promise.all([
        prisma.projeto.count({ where: { analistaRapidoId: user.id, etapaPipeline: 'SOLICITACAO', excluido: false } }),
        prisma.projeto.count({ where: { analistaRapidoId: user.id, etapaPipeline: 'EM_ANALISE_RAPIDA', excluido: false } }),
        prisma.projeto.count({ where: { analistaRapidoId: user.id, etapaPipeline: 'ANALISE_CONCLUIDA', excluido: false } }),
        prisma.projeto.findMany({
          where: {
            analistaRapidoId: user.id,
            etapaPipeline: { in: ['SOLICITACAO', 'EM_ANALISE_RAPIDA', 'ANALISE_CONCLUIDA'] },
            excluido: false,
          },
          include: { cliente: { select: { nome: true } } },
          orderBy: { criadoEm: 'desc' },
          take: 20,
        }),
      ])
      return NextResponse.json({
        tipoView: 'analista_rapido',
        estatisticas: { aguardando, emAnalise, concluidos },
        projetos,
      })
    }

    // ── ANALISTA OPERACIONAL ────────────────────────────────────
    if (user.role === 'ANALISTA') {
      // Tarefas atribuídas a este usuário
      const minhasTarefas = await prisma.tarefa.findMany({
        where: { responsavelId: user.id, status: { not: 'CONCLUIDA' }, projeto: { excluido: false } },
        select: { projetoId: true, status: true },
      })
      const projetoIdsComTarefas = Array.from(new Set(minhasTarefas.map(t => t.projetoId)))

      const [ativos, concluidos, proximasVistorias, projetos, tarefasList] = await Promise.all([
        prisma.projeto.count({ where: { etapaPipeline: 'EM_EXECUCAO', id: { in: projetoIdsComTarefas }, excluido: false } }),
        prisma.projeto.count({ where: { responsavelId: user.id, etapaPipeline: 'CONCLUIDO', excluido: false } }),
        prisma.vistoria.findMany({
          where: { responsavelId: user.id, status: 'AGENDADA', dataAgendada: { gte: hoje, lte: proximos30 }, projeto: { excluido: false } },
          include: { projeto: { select: { codigo: true, imovelNome: true } } },
          orderBy: { dataAgendada: 'asc' },
          take: 5,
        }),
        // Projetos onde é responsável do projeto OU tem tarefas atribuídas
        prisma.projeto.findMany({
          where: {
            etapaPipeline: { in: ['OPERACIONAL', 'EM_EXECUCAO'] },
            excluido: false,
            OR: [
              { responsavelId: user.id },
              { id: { in: projetoIdsComTarefas } },
            ],
          },
          include: { cliente: { select: { nome: true } } },
          orderBy: { criadoEm: 'desc' },
          take: 20,
        }),
        // Minhas tarefas pendentes com contexto
        prisma.tarefa.findMany({
          where: { responsavelId: user.id, status: { not: 'CONCLUIDA' }, projeto: { excluido: false } },
          include: { projeto: { select: { id: true, codigo: true, imovelNome: true } } },
          orderBy: [{ prazo: 'asc' }, { criadoEm: 'asc' }],
          take: 15,
        }),
      ])
      return NextResponse.json({
        tipoView: 'analista',
        estatisticas: { ativos, concluidos, tarefasPendentes: minhasTarefas.length },
        projetos,
        minhasTarefas: tarefasList,
        proximasVistorias,
      })
    }

    // ── GESTOR OPERACIONAL / SUPERVISOR ─────────────────────────
    if (['GESTOR_OPERACIONAL', 'GESTOR_CAMPO', 'SUPERVISOR'].includes(user.role)) {
      // Gestor vê TODOS os projetos em estágio operacional (não só os que ele é supervisor)
      // Inclui projetos onde é gestorResponsavelId OU supervisorId OU todos os operacionais
      const etapasOperacionais: string[] = ['OPERACIONAL', 'EM_EXECUCAO']

      const [novos, andamento, concluidos, projetos, proximasVistorias, tarefasAtrasadas, tarefasConcluidas, tarefasTotais] = await Promise.all([
        prisma.projeto.count({ where: { etapaPipeline: 'OPERACIONAL', excluido: false } }),
        prisma.projeto.count({ where: { etapaPipeline: 'EM_EXECUCAO', excluido: false } }),
        prisma.projeto.count({ where: { etapaPipeline: 'CONCLUIDO', excluido: false } }),
        prisma.projeto.findMany({
          where: { etapaPipeline: { in: etapasOperacionais }, excluido: false },
          include: {
            cliente: { select: { nome: true } },
            responsavel: { select: { nome: true } },
            _count: { select: { tarefas: true } },
          },
          orderBy: { criadoEm: 'desc' },
          take: 30,
        }),
        prisma.vistoria.findMany({
          where: {
            status: 'AGENDADA',
            dataAgendada: { gte: hoje, lte: proximos30 },
            projeto: { excluido: false },
          },
          include: { projeto: { select: { codigo: true, imovelNome: true } }, responsavel: { select: { nome: true } } },
          orderBy: { dataAgendada: 'asc' },
          take: 10,
        }),
        // Eficiência: tarefas atrasadas
        prisma.tarefa.count({
          where: { status: 'PENDENTE', prazo: { lt: hoje }, projeto: { etapaPipeline: { in: etapasOperacionais }, excluido: false } }
        }),
        // Tarefas concluídas no mês atual
        prisma.tarefa.count({
          where: {
            status: 'CONCLUIDA',
            dataConclusao: { gte: new Date(hoje.getFullYear(), hoje.getMonth(), 1) },
            projeto: { excluido: false },
          }
        }),
        // Total de tarefas em aberto
        prisma.tarefa.count({ where: { status: 'PENDENTE', projeto: { etapaPipeline: { in: etapasOperacionais }, excluido: false } } }),
      ])

      // Taxa de eficiência: tarefas concluídas / (concluídas + pendentes)
      const totalParaEficiencia = tarefasConcluidas + tarefasTotais
      const taxaEficiencia = totalParaEficiencia > 0
        ? Math.round((tarefasConcluidas / totalParaEficiencia) * 100)
        : 0

      return NextResponse.json({
        tipoView: 'gestor_operacional',
        estatisticas: { novos, andamento, concluidos, tarefasAtrasadas, tarefasConcluidas, tarefasTotais, taxaEficiencia },
        projetos,
        proximasVistorias,
      })
    }

    // ── FINANCEIRO ──────────────────────────────────────────────
    if (user.departamento === 'FINANCEIRO') {
      const [aguardandoSinal, pagamentosPendentes, pagamentosVencidos, projetosAguardando] = await Promise.all([
        prisma.projeto.count({ where: { etapaPipeline: 'AGUARDANDO_SINAL', excluido: false } }),
        prisma.pagamento.aggregate({ where: { status: 'PENDENTE', contrato: { projeto: { excluido: false } } }, _sum: { valor: true }, _count: true }),
        prisma.pagamento.aggregate({ where: { status: 'PENDENTE', dataVencimento: { lt: hoje }, contrato: { projeto: { excluido: false } } }, _sum: { valor: true }, _count: true }),
        prisma.projeto.findMany({
          where: { etapaPipeline: { in: ['AGUARDANDO_SINAL', 'OPERACIONAL', 'EM_EXECUCAO'] }, excluido: false },
          include: { cliente: { select: { nome: true } }, contrato: { select: { valorTotal: true, statusContrato: true } } },
          orderBy: { criadoEm: 'desc' },
          take: 20,
        }),
      ])
      const pagamentosProximos = await prisma.pagamento.findMany({
        where: { status: 'PENDENTE', dataVencimento: { gte: hoje, lte: proximos30 }, contrato: { projeto: { excluido: false } } },
        include: { contrato: { include: { cliente: { select: { nome: true } } } } },
        orderBy: { dataVencimento: 'asc' },
        take: 10,
      })
      return NextResponse.json({
        tipoView: 'financeiro',
        estatisticas: {
          aguardandoSinal,
          totalPendente: pagamentosPendentes._sum.valor || 0,
          qtdPendente: pagamentosPendentes._count,
          totalVencido: pagamentosVencidos._sum.valor || 0,
          qtdVencido: pagamentosVencidos._count,
        },
        projetos: projetosAguardando,
        pagamentosProximos,
      })
    }

    // ── CONTRATOS ───────────────────────────────────────────────
    if (user.departamento === 'CONTRATOS') {
      const [aguardando, emContrato, projetos] = await Promise.all([
        prisma.projeto.count({ where: { etapaPipeline: 'AGUARDANDO_CONTRATO', excluido: false } }),
        prisma.projeto.count({ where: { etapaPipeline: 'EM_CONTRATO', excluido: false } }),
        prisma.projeto.findMany({
          where: { etapaPipeline: { in: ['AGUARDANDO_CONTRATO', 'EM_CONTRATO'] }, excluido: false },
          include: { cliente: { select: { nome: true } }, contrato: true },
          orderBy: { criadoEm: 'desc' },
          take: 20,
        }),
      ])
      return NextResponse.json({
        tipoView: 'contratos',
        estatisticas: { aguardando, emContrato },
        projetos,
      })
    }

    // ── ADM / GESTOR GERAL — visão completa do pipeline ─────────
    const [
      totalProjetos,
      projetosAtivos,
      projetosConcluidos,
      tarefasAtrasadas,
      porEtapa,
      projetosRecentes,
      proximasVistorias,
      pagamentosProximos,
    ] = await Promise.all([
      prisma.projeto.count({ where: { excluido: false } }),
      prisma.projeto.count({ where: { etapaPipeline: { in: ['EM_ANALISE_RAPIDA', 'EM_NEGOCIACAO', 'EM_CONTRATO', 'EM_EXECUCAO'] }, excluido: false } }),
      prisma.projeto.count({ where: { etapaPipeline: 'CONCLUIDO', excluido: false } }),
      prisma.tarefa.count({ where: { status: 'PENDENTE', prazo: { lt: hoje }, projeto: { excluido: false } } }),
      prisma.projeto.groupBy({ by: ['etapaPipeline'], _count: true, where: { excluido: false } }),
      prisma.projeto.findMany({
        where: { excluido: false },
        take: 6,
        orderBy: { criadoEm: 'desc' },
        include: { cliente: { select: { nome: true } }, analistaRapido: { select: { nome: true } } },
      }),
      prisma.vistoria.findMany({
        where: { dataAgendada: { gte: hoje, lte: proximos30 }, status: 'AGENDADA', projeto: { excluido: false } },
        take: 5,
        orderBy: { dataAgendada: 'asc' },
        include: { projeto: { select: { codigo: true, imovelNome: true } }, responsavel: { select: { nome: true } } },
      }),
      prisma.pagamento.findMany({
        where: { status: 'PENDENTE', dataVencimento: { gte: hoje, lte: proximos30 }, contrato: { projeto: { excluido: false } } },
        take: 5,
        orderBy: { dataVencimento: 'asc' },
        include: { contrato: { include: { cliente: { select: { nome: true } } } } },
      }),
    ])

    // Evolução mensal (6 meses)
    const evolucaoMensal = []
    for (let i = 5; i >= 0; i--) {
      const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0)
      const count = await prisma.projeto.count({ where: { criadoEm: { gte: mes, lte: fimDoMes }, excluido: false } })
      evolucaoMensal.push({ mes: mes.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), projetos: count })
    }

    const pagamentosPendentes = await prisma.pagamento.aggregate({ where: { status: 'PENDENTE', contrato: { projeto: { excluido: false } } }, _sum: { valor: true } })
    const pagamentosVencidos = await prisma.pagamento.aggregate({ where: { status: 'PENDENTE', dataVencimento: { lt: hoje }, contrato: { projeto: { excluido: false } } }, _sum: { valor: true } })

    return NextResponse.json({
      tipoView: 'admin',
      estatisticas: {
        totalProjetos,
        projetosAtivos,
        projetosConcluidos,
        tarefasAtrasadas,
        totalPendente: pagamentosPendentes._sum.valor || 0,
        totalVencido: pagamentosVencidos._sum.valor || 0,
      },
      porEtapa: porEtapa.map(e => ({ etapa: e.etapaPipeline, count: e._count })),
      projetosRecentes,
      proximasVistorias,
      pagamentosProximos,
      evolucaoMensal,
    })
  } catch (error) {
    console.error('Erro no dashboard:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
