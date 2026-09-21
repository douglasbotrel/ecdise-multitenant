import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const contratoId = searchParams.get('contratoId')
    const status     = searchParams.get('status')

    const where: any = { contrato: { projeto: { excluido: false } } }
    if (contratoId) where.contratoId = contratoId
    if (status)     where.status = status

    const pagamentos = await prisma.pagamento.findMany({
      where,
      include: {
        contrato: {
          include: {
            cliente: { select: { id: true, nome: true } },
            projeto: { select: { id: true, codigo: true, tipoServico: true, etapaPipeline: true } },
          },
        },
      },
      orderBy: { dataVencimento: 'asc' },
    })

    // Os totais SEMPRE consideram todos os status — independente do filtro de
    // aba aplicado acima — para não variarem/zerarem conforme o usuário troca
    // de aba (bug relatado: "Pendente"/"Pago"/"Vencido" mudavam ao trocar de filtro).
    const whereTotais: any = { contrato: { projeto: { excluido: false } } }
    if (contratoId) whereTotais.contratoId = contratoId
    const paraTotais = status
      ? await prisma.pagamento.findMany({
          where: whereTotais,
          select: { status: true, valor: true, valorRecebido: true, residual: true },
        })
      : pagamentos

    const totais = {
      totalPendente: paraTotais.filter(p => p.status === 'PENDENTE').reduce((s, p) => s + p.valor, 0),
      totalPago:     paraTotais.filter(p => p.status === 'PAGO').reduce((s, p) => s + p.valor, 0)
                   + paraTotais.filter(p => p.status === 'PARCIAL').reduce((s, p) => s + (p.valorRecebido ?? p.valor), 0),
      totalVencido:  paraTotais.filter(p => p.status === 'VENCIDO').reduce((s, p) => s + p.valor, 0),
      totalResidual: paraTotais.filter(p => p.status === 'PARCIAL').reduce((s, p) => s + (p.residual ?? 0), 0),
    }

    return NextResponse.json({ pagamentos, totais })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { id, status, dataPagamento, formaPagamento, comprovante, observacoes,
            valorRecebido, motivoAjuste, aprovadoAdm } = body

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    // Busca pagamento atual com contrato + projeto + servicosContratados
    const pagamentoAtual = await prisma.pagamento.findUnique({
      where: { id },
      include: {
        contrato: {
          include: {
            projeto: {
              select: {
                id: true,
                codigo: true,
                etapaPipeline: true,
                servicosContratados: true,
              },
            },
          },
        },
      },
    })
    if (!pagamentoAtual) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })

    // ── Calcular pagamento parcial ─────────────────────────────
    let statusEfetivo = status
    let valorRecebidoFinal: number | undefined
    let residualCalc: number | undefined

    if (valorRecebido !== undefined && valorRecebido !== null) {
      valorRecebidoFinal = Number(valorRecebido)
      if (valorRecebidoFinal < pagamentoAtual.valor) {
        statusEfetivo  = 'PARCIAL'
        residualCalc   = pagamentoAtual.valor - valorRecebidoFinal
      } else {
        statusEfetivo        = 'PAGO'
        valorRecebidoFinal   = undefined // pagamento integral — não precisa armazenar
        residualCalc         = undefined
      }
    }

    // Apenas ADM pode aprovar ajuste
    const isAdm = ['ADMIN', 'GESTOR_GERAL'].includes(user.role)
    if (aprovadoAdm && !isAdm) {
      return NextResponse.json({ error: 'Apenas ADM pode aprovar ajustes.' }, { status: 403 })
    }

    // Atualiza pagamento
    const pagamento = await prisma.pagamento.update({
      where: { id },
      data: {
        ...(statusEfetivo && { status: statusEfetivo }),
        ...(dataPagamento              && { dataPagamento: new Date(dataPagamento) }),
        ...(formaPagamento !== undefined && { formaPagamento }),
        ...(comprovante    !== undefined && { comprovante }),
        ...(observacoes    !== undefined && { observacoes }),
        ...(statusEfetivo === 'PAGO' && !dataPagamento && { dataPagamento: new Date() }),
        ...(statusEfetivo === 'PARCIAL' && !dataPagamento && { dataPagamento: new Date() }),
        ...(valorRecebidoFinal !== undefined && { valorRecebido: valorRecebidoFinal }),
        ...(residualCalc       !== undefined && { residual: residualCalc }),
        ...(motivoAjuste       !== undefined && { motivoAjuste }),
        ...(aprovadoAdm        !== undefined && { aprovadoAdm }),
      },
    })

    await prisma.log.create({
      data: {
        usuarioId: user.id,
        acao: 'ATUALIZAR_PAGAMENTO',
        entidade: 'Pagamento',
        entidadeId: id,
      },
    })

    // ── Avanço automático de pipeline ─────────────────────────
    // Primeiro pagamento PAGO de um contrato cujo projeto está em AGUARDANDO_SINAL
    // → avança para OPERACIONAL e cria tarefas automaticamente
    if (
      statusEfetivo === 'PAGO' &&
      pagamentoAtual.contrato?.projeto?.etapaPipeline === 'AGUARDANDO_SINAL'
    ) {
      const contrato  = pagamentoAtual.contrato
      const projeto   = contrato.projeto
      const projetoId = contrato.projetoId

      // Conta quantos PAGO este contrato já tinha antes desta atualização
      const pagosAntesCount = await prisma.pagamento.count({
        where: { contratoId: contrato.id, status: 'PAGO' },
      })

      // pagosAntesCount === 1 significa que só este (que acabou de virar PAGO) existe
      if (pagosAntesCount === 1) {

        // 1. Avança pipeline
        await prisma.projeto.update({
          where: { id: projetoId },
          data: { etapaPipeline: 'OPERACIONAL', dataAprovacao: new Date() },
        })

        // 2. Identifica serviços contratados
        let nomesServicos: string[] = []
        try {
          const raw = contrato.servicosContratados || projeto.servicosContratados || '[]'
          nomesServicos = JSON.parse(raw as string)
        } catch {}

        // 3. Busca TipoServico e cria tarefas
        if (nomesServicos.length > 0) {
          const tiposServico = await prisma.tipoServico.findMany({
            where: { nome: { in: nomesServicos } },
            orderBy: { ordem: 'asc' },
          })

          let ordem = 1
          for (const ts of tiposServico) {
            let tarefasPadrao: string[] = []
            try { tarefasPadrao = JSON.parse(ts.tarefasPadrao || '[]') } catch {}

            for (const item of tarefasPadrao) {
              const titulo = typeof item === 'string' ? item : (item as any).titulo
              if (!titulo) continue
              await prisma.tarefa.create({
                data: {
                  projetoId,
                  titulo,
                  etapa: ts.nome,
                  ordem: ordem++,
                },
              })
            }
          }
        }

        // 4. Notifica apenas o(s) gestor(es) responsável(eis) pelo projeto
        const projetoCompleto = await prisma.projeto.findUnique({
          where: { id: projetoId },
          select: { gestorResponsavelId: true, supervisorId: true },
        })

        const idsResponsaveis = [
          projetoCompleto?.gestorResponsavelId,
          projetoCompleto?.supervisorId,
        ].filter(Boolean) as string[]

        let destinatariosIds: string[] = idsResponsaveis
        if (destinatariosIds.length === 0) {
          const fallback = await prisma.usuario.findMany({
            where: { ativo: true, role: { in: ['ADMIN', 'GESTOR_GERAL'] } },
            select: { id: true },
          })
          destinatariosIds = fallback.map(u => u.id)
        }

        destinatariosIds = Array.from(new Set(destinatariosIds))

        if (destinatariosIds.length > 0) {
          await prisma.notificacao.createMany({
            data: destinatariosIds.map(uid => ({
              usuarioId: uid,
              titulo: '🚀 Projeto liberado para execução',
              mensagem: `Projeto ${projeto.codigo} teve sinal confirmado. Acesse Operacional para definir prazos e responsáveis.`,
              tipo: 'sucesso',
              link: `/operacional/${projetoId}`,
            })),
          })
        }

        return NextResponse.json({
          pagamento,
          avancouPipeline: true,
          novaEtapa: 'OPERACIONAL',
        })
      }
    }

    return NextResponse.json({ pagamento, avancouPipeline: false })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
