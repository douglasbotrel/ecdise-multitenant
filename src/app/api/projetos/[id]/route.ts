import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// Qual etapa vem depois de cada etapa ao "salvar/confirmar"
const PROXIMA_ETAPA: Record<string, string> = {
  SOLICITACAO:         'EM_ANALISE_RAPIDA',
  EM_ANALISE_RAPIDA:   'ANALISE_CONCLUIDA',
  ANALISE_CONCLUIDA:   'AGUARDANDO_CONTRATO',  // ADM valida → direto para contratos
  AGUARDANDO_CONTRATO: 'AGUARDANDO_SINAL',      // Contratos elabora → financeiro aguarda sinal
  AGUARDANDO_SINAL:    'OPERACIONAL',            // Financeiro confirma pagamento → área técnica
  OPERACIONAL:         'EM_EXECUCAO',
  EM_EXECUCAO:         'CONCLUIDO',
}

async function criarNotificacaoEtapa(etapa: string, projeto: any) {
  const notifs: { usuarioId: string; titulo: string; mensagem: string; tipo: string; link: string }[] = []
  const base = `Projeto ${projeto.codigo} — ${projeto.imovelNome || projeto.tipoServico}`

  switch (etapa) {
    case 'ANALISE_CONCLUIDA': {
      const admins = await prisma.usuario.findMany({
        where: { role: { in: ['ADMIN', 'GESTOR_GERAL'] }, ativo: true },
        select: { id: true },
      })
      admins.forEach(a => notifs.push({
        usuarioId: a.id,
        titulo: '✅ Análise concluída — aguardando sua validação',
        mensagem: `${base}: análise técnica rápida finalizada. Revise os serviços recomendados e valide para negociação.`,
        tipo: 'success',
        link: '/comercial',
      }))
      break
    }
    case 'AGUARDANDO_CONTRATO': {
      const contratos = await prisma.usuario.findMany({
        where: { departamento: 'CONTRATOS', ativo: true },
        select: { id: true },
      })
      contratos.forEach(c => notifs.push({
        usuarioId: c.id,
        titulo: '📄 Novo contrato para elaborar',
        mensagem: `${base}: serviços e valores validados pelo ADM. Elabore o contrato com os dados fornecidos.`,
        tipo: 'info',
        link: '/contratos',
      }))
      break
    }
    case 'AGUARDANDO_SINAL': {
      const financeiro = await prisma.usuario.findMany({
        where: { departamento: 'FINANCEIRO', ativo: true },
        select: { id: true },
      })
      financeiro.forEach(f => notifs.push({
        usuarioId: f.id,
        titulo: '💰 Aguardando sinal — novo contrato',
        mensagem: `${base}: contrato elaborado. Aguardando recebimento do sinal para liberar operações.`,
        tipo: 'info',
        link: '/financeiro',
      }))
      break
    }
    case 'OPERACIONAL': {
      const gestorId = projeto.gestorResponsavelId || projeto.supervisorId
      if (gestorId) {
        notifs.push({
          usuarioId: gestorId,
          titulo: '🚀 Novo projeto operacional',
          mensagem: `${base}: sinal recebido. Atribua um analista e defina o prazo para iniciar.`,
          tipo: 'info',
          link: '/operacional',
        })
      }
      break
    }
    case 'EM_EXECUCAO': {
      if (projeto.responsavelId) {
        notifs.push({
          usuarioId: projeto.responsavelId,
          titulo: '📋 Novo projeto atribuído a você',
          mensagem: `${base}: você foi designado responsável. Acesse o módulo operacional para executar as tarefas.`,
          tipo: 'info',
          link: `/operacional/${projeto.id}`,
        })
      }
      break
    }
  }

  if (notifs.length > 0) {
    await prisma.notificacao.createMany({ data: notifs })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const projeto = await prisma.projeto.findUnique({
      where: { id: params.id },
      include: {
        cliente: true,
        responsavel: { select: { id: true, nome: true, email: true, cargo: true } },
        supervisor: { select: { id: true, nome: true, email: true } },
        analistaRapido: { select: { id: true, nome: true, email: true } },
        contrato: {
          include: { pagamentos: { orderBy: { numeroParcela: 'asc' } } }
        },
        tarefas: {
          orderBy: { ordem: 'asc' },
          include: {
            responsavel: { select: { id: true, nome: true } },
            documentos: true,
          }
        },
        vistorias: {
          orderBy: { dataAgendada: 'desc' },
          include: {
            responsavel: { select: { id: true, nome: true } },
            gastos: true,
          }
        },
        documentos: {
          orderBy: { criadoEm: 'desc' },
          include: { usuario: { select: { id: true, nome: true } } }
        },
        comentarios: {
          orderBy: { criadoEm: 'desc' },
          include: { autor: { select: { id: true, nome: true } } }
        },
        historico: {
          orderBy: { criadoEm: 'desc' },
          take: 20,
        },
        pendencias: {
          orderBy: { criadoEm: 'desc' },
          include: {
            acoes: {
              orderBy: { criadoEm: 'asc' },
              include: { responsavel: { select: { id: true, nome: true } } }
            }
          }
        },
        licenca: true,
      }
    })

    if (!projeto) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ projeto })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const projeto = await prisma.projeto.findUnique({ where: { id: params.id } })
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    // Avança pipeline quando o responsável da etapa atual confirma
    const avancarPipeline = body.avancarPipeline === true

    // Liberação sem pagamento: apenas ADMIN pode avançar de AGUARDANDO_SINAL → OPERACIONAL sem pagamento
    if (body.liberarSemPagamento === true) {
      if (!['ADMIN', 'GESTOR_GERAL'].includes(user.role)) {
        return NextResponse.json({ error: 'Sem permissão para liberar sem pagamento' }, { status: 403 })
      }
      if (projeto.etapaPipeline !== 'AGUARDANDO_SINAL') {
        return NextResponse.json({ error: 'Projeto não está em Aguardando Sinal' }, { status: 400 })
      }
    }

    let novaEtapa = projeto.etapaPipeline
    if ((avancarPipeline || body.liberarSemPagamento) && PROXIMA_ETAPA[projeto.etapaPipeline]) {
      novaEtapa = PROXIMA_ETAPA[projeto.etapaPipeline]
    } else if (body.etapaPipeline && body.etapaPipeline !== projeto.etapaPipeline) {
      novaEtapa = body.etapaPipeline
    }

    // Histórico de etapa
    if (novaEtapa !== projeto.etapaPipeline) {
      await prisma.historicoStatus.create({
        data: {
          projetoId: params.id,
          statusAnterior: projeto.etapaPipeline,
          statusNovo: novaEtapa,
          campo: 'etapaPipeline',
          observacao: body.liberarSemPagamento
            ? `Liberado para Operacional sem confirmação de pagamento pelo ADM (${user.nome || user.email}). Motivo: ${body.motivo || 'não informado'}`
            : (body.observacaoTransicao || null),
          usuarioId: user.id,
        }
      }).catch(() => {})
    }

    // Histórico de statusOperacional
    if (body.statusOperacional && body.statusOperacional !== projeto.statusOperacional) {
      await prisma.historicoStatus.create({
        data: {
          projetoId: params.id,
          statusAnterior: projeto.statusOperacional,
          statusNovo: body.statusOperacional,
          campo: 'statusOperacional',
          usuarioId: user.id,
        }
      }).catch(() => {})
    }

    // ── Validações de datas ──────────────────────────────────────────────────
    const dataInicio     = body.dataInicio     ? new Date(body.dataInicio)     : projeto.dataInicio
    const dataPrazo      = body.dataPrazo      ? new Date(body.dataPrazo)      : projeto.dataPrazo
    const dataConclusao  = body.dataConclusao  ? new Date(body.dataConclusao)  : null

    if (body.dataPrazo && dataInicio && dataPrazo) {
      if (dataPrazo < dataInicio) {
        return NextResponse.json(
          { error: 'O prazo do projeto não pode ser anterior à data de início.' },
          { status: 400 }
        )
      }
    }
    if (body.dataConclusao && dataInicio && dataConclusao) {
      if (dataConclusao < dataInicio) {
        return NextResponse.json(
          { error: 'A data de conclusão não pode ser anterior à data de início.' },
          { status: 400 }
        )
      }
    }
    if (body.dataInicio && dataPrazo && dataInicio) {
      if (dataPrazo < dataInicio) {
        return NextResponse.json(
          { error: 'A data de início não pode ser posterior ao prazo já definido.' },
          { status: 400 }
        )
      }
    }

    // Ao avançar de OPERACIONAL → EM_EXECUCAO, marca automaticamente como EM_ANDAMENTO
    const autoStatusOperacional =
      avancarPipeline &&
      projeto.etapaPipeline === 'OPERACIONAL' &&
      novaEtapa === 'EM_EXECUCAO' &&
      !body.statusOperacional
        ? 'EM_ANDAMENTO'
        : null

    const projetoAtualizado = await prisma.projeto.update({
      where: { id: params.id },
      data: {
        etapaPipeline: novaEtapa,
        ...(body.statusComercial && { statusComercial: body.statusComercial }),
        ...((body.statusOperacional || autoStatusOperacional) && {
          statusOperacional: body.statusOperacional || autoStatusOperacional,
        }),
        ...(body.tipoServico !== undefined && { tipoServico: body.tipoServico }),
        ...(body.caminhoSIGLA !== undefined && { caminhoSIGLA: body.caminhoSIGLA || null }),
        ...(body.descricao !== undefined && { descricao: body.descricao }),
        ...(body.imovelNome !== undefined && { imovelNome: body.imovelNome }),
        ...(body.municipio !== undefined && { municipio: body.municipio }),
        ...(body.estado !== undefined && { estado: body.estado }),
        ...(body.car !== undefined && { car: body.car }),
        ...(body.areaHectares !== undefined && { areaHectares: body.areaHectares ? parseFloat(body.areaHectares) : null }),
        ...(body.valorProposto !== undefined && { valorProposto: body.valorProposto ? parseFloat(body.valorProposto) : null }),
        ...(body.observacoes !== undefined && { observacoes: body.observacoes }),
        ...(body.observacoesAnalise !== undefined && { observacoesAnalise: body.observacoesAnalise }),
        ...(body.servicosRecomendados !== undefined && { servicosRecomendados: body.servicosRecomendados }),
        ...(body.servicosContratados !== undefined && { servicosContratados: body.servicosContratados }),
        ...(body.credenciais        !== undefined && { credenciais: body.credenciais }),
        ...(body.valorSinal !== undefined && { valorSinal: body.valorSinal ? parseFloat(body.valorSinal) : null }),
        ...(body.valorPrestacao !== undefined && { valorPrestacao: body.valorPrestacao ? parseFloat(body.valorPrestacao) : null }),
        ...(body.numeroPrestacoes !== undefined && { numeroPrestacoes: body.numeroPrestacoes ? parseInt(body.numeroPrestacoes) : null }),
        ...(body.responsavelId !== undefined && { responsavelId: body.responsavelId || null }),
        ...(body.supervisorId !== undefined && { supervisorId: body.supervisorId || null }),
        ...(body.analistaRapidoId !== undefined && { analistaRapidoId: body.analistaRapidoId || null }),
        ...(body.gestorResponsavelId !== undefined && { gestorResponsavelId: body.gestorResponsavelId || null }),
        ...(body.dataPrazo !== undefined && { dataPrazo: body.dataPrazo ? new Date(body.dataPrazo) : null }),
        ...(body.dataInicio !== undefined && { dataInicio: body.dataInicio ? new Date(body.dataInicio) : null }),
        ...(body.dataConclusao !== undefined && { dataConclusao: body.dataConclusao ? new Date(body.dataConclusao) : null }),
        ...(body.dataAprovacao !== undefined && { dataAprovacao: body.dataAprovacao ? new Date(body.dataAprovacao) : null }),
        ...(body.protocoloData !== undefined && { protocoloData: body.protocoloData ? new Date(body.protocoloData) : null }),
        ...(body.protocoloCodigoOrgao !== undefined && { protocoloCodigoOrgao: body.protocoloCodigoOrgao || null }),
        ...(body.checklistEncerramento !== undefined && { checklistEncerramento: body.checklistEncerramento }),
        ...(body.emAcompanhamento !== undefined && { emAcompanhamento: body.emAcompanhamento === true }),
      },
      include: {
        cliente: true,
        responsavel: { select: { id: true, nome: true } },
        analistaRapido: { select: { id: true, nome: true } },
        supervisor: { select: { id: true, nome: true } },
      }
    })

    // Notificações para a nova etapa
    if (novaEtapa !== projeto.etapaPipeline) {
      await criarNotificacaoEtapa(novaEtapa, projetoAtualizado)
    }

    // ── AUTO-CRIAR TAREFAS ao entrar em OPERACIONAL (ou forçado por gerarTarefas) ──
    // Geração acontece ao chegar em OPERACIONAL (não em EM_EXECUCAO) porque:
    //  - o gestor operacional precisa ver as tarefas para atribuir prazos/responsáveis
    //  - EM_EXECUCAO é acionado via tarefas/route.ts (bypass do PATCH) ao 1º check
    // body.gerarTarefas=true permite regenerar para projetos em OPERACIONAL ou EM_EXECUCAO sem tarefas
    const ETAPAS_PODE_GERAR = ['OPERACIONAL', 'EM_EXECUCAO']
    const forcarGeracao = body.gerarTarefas === true && ETAPAS_PODE_GERAR.includes(projeto.etapaPipeline)
    if ((novaEtapa === 'OPERACIONAL' && projeto.etapaPipeline !== 'OPERACIONAL') || forcarGeracao) {
      try {
        // Só cria se o projeto ainda não tem tarefas (evita duplicatas em re-entradas)
        const tarefasExistentes = await prisma.tarefa.count({ where: { projetoId: params.id } })
        if (tarefasExistentes === 0) {
          const servicosRaw = projetoAtualizado.servicosContratados
          if (servicosRaw) {
            const nomesServicos: string[] = JSON.parse(servicosRaw)
            const tiposServico = await prisma.tipoServico.findMany({
              where: { nome: { in: nomesServicos }, ativo: true },
              orderBy: { ordem: 'asc' },
            })
            const tarefasParaCriar: {
              projetoId: string; titulo: string; etapa: string | null
              ordem: number; responsavelId: string | null; status: string; obrigatorio: boolean
            }[] = []
            let ordemBase = 0
            for (const tipo of tiposServico) {
              if (tipo.tarefasPadrao) {
                const tasks: { titulo: string; etapa: string; ordem: number }[] = JSON.parse(tipo.tarefasPadrao)
                for (const t of tasks) {
                  tarefasParaCriar.push({
                    projetoId: params.id,
                    titulo: `[${tipo.nome}] ${t.titulo}`,
                    etapa: t.etapa || null,
                    ordem: ordemBase + t.ordem,
                    responsavelId: projetoAtualizado.responsavelId || null,
                    status: 'PENDENTE',
                    obrigatorio: true,
                  })
                }
                ordemBase += tasks.length
              }
            }
            if (tarefasParaCriar.length > 0) {
              await prisma.tarefa.createMany({ data: tarefasParaCriar })
            }
          }
        }
      } catch (e) {
        console.error('Erro ao criar tarefas automáticas:', e)
      }
    }

    await prisma.log.create({
      data: {
        usuarioId: user.id,
        acao: 'ATUALIZAR_PROJETO',
        entidade: 'Projeto',
        entidadeId: params.id,
        detalhes: JSON.stringify({ etapa: novaEtapa, campos: Object.keys(body) }),
      }
    })

    return NextResponse.json({ projeto: projetoAtualizado })
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas o Administrador pode excluir projetos' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const motivo = (body.motivo || '').trim()
    if (!motivo) {
      return NextResponse.json({ error: 'É obrigatório informar o motivo da exclusão' }, { status: 400 })
    }

    const projeto = await prisma.projeto.findUnique({ where: { id: params.id } })
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    // Exclusão lógica — o projeto some de todas as listagens, mas o registro
    // (com motivo, quem excluiu e quando) fica preservado para auditoria.
    // Contratos, pagamentos, tarefas e histórico ligados a ele continuam
    // intactos no banco, só deixam de aparecer nas telas normais.
    await prisma.projeto.update({
      where: { id: params.id },
      data: {
        excluido: true,
        motivoExclusao: motivo,
        excluidoEm: new Date(),
        excluidoPor: user.id,
      },
    })

    await prisma.log.create({
      data: {
        usuarioId: user.id,
        acao: 'EXCLUSAO_PROJETO',
        entidade: 'Projeto',
        entidadeId: params.id,
        detalhes: `Projeto ${projeto.codigo} excluído. Motivo: ${motivo}`,
      },
    }).catch(() => {}) // log é best-effort — não deve travar a exclusão em si

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[projetos DELETE]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
