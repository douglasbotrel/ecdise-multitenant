import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// Roles que têm acesso ao módulo de contratos
const ROLES_CONTRATOS = ['ADMIN', 'GESTOR_GERAL', 'GESTOR_ADMINISTRATIVO']

function temAcessoContratos(user: any) {
  return ROLES_CONTRATOS.includes(user.role) || user.departamento === 'CONTRATOS'
}


export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!temAcessoContratos(user)) {
      return NextResponse.json({ error: 'Sem permissão para acessar contratos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const statusContrato = searchParams.get('statusContrato')
    const clienteId = searchParams.get('clienteId')

    const where: any = { projeto: { excluido: false } }
    if (statusContrato) where.statusContrato = statusContrato
    if (clienteId) where.clienteId = clienteId

    const contratos = await prisma.contrato.findMany({
      where,
      include: {
        projeto: { select: { id: true, codigo: true, tipoServico: true, municipio: true } },
        cliente: { select: { id: true, nome: true, cpfCnpj: true } },
        pagamentos: { orderBy: { numeroParcela: 'asc' } },
        _count: { select: { pagamentos: true } }
      },
      orderBy: { criadoEm: 'desc' }
    })

    return NextResponse.json({ contratos })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!temAcessoContratos(user)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const {
      projetoId, tipoContrato, dataAssinatura, dataVencimento, observacoes,
      // optional overrides; if not provided, values come from the project
      clienteId: clienteIdBody, valorTotal: valorTotalBody,
      valorSinal: valorSinalBody, numeroParcelas: numParcelasBody,
    } = body

    if (!projetoId) {
      return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 })
    }

    // ── Validação de datas ────────────────────────────────────
    if (dataAssinatura && dataVencimento) {
      if (new Date(dataVencimento) <= new Date(dataAssinatura)) {
        return NextResponse.json(
          { error: 'A data de vencimento deve ser posterior à data de assinatura.' },
          { status: 400 }
        )
      }
    }

    // Load project to get financial values and clienteId
    const projeto = await prisma.projeto.findUnique({ where: { id: projetoId } })
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const clienteId = clienteIdBody || projeto.clienteId
    const vSinal    = Math.max(0, parseFloat(valorSinalBody ?? projeto.valorSinal ?? 0))
    const vParcela  = projeto.valorPrestacao || 0
    const nParcelas = Math.max(1, parseInt(numParcelasBody ?? projeto.numeroPrestacoes ?? 1))
    // vTotal pode ser 0/nulo quando o valor ainda não foi definido (será preenchido depois por ADM)
    // Total = sinal + todas as parcelas (são geradas exatamente nParcelas parcelas abaixo, além do sinal)
    const vTotalRaw = parseFloat(valorTotalBody ?? '') || (vSinal + vParcela * nParcelas)
    const vTotal    = isNaN(vTotalRaw) ? 0 : vTotalRaw
    const vRestante = Math.max(0, vTotal - vSinal)
    const valorADefinir = vTotal <= 0

    // ── Validações de negócio ─────────────────────────────────
    if (!valorADefinir && (vSinal < 0 || vSinal > vTotal)) {
      return NextResponse.json(
        { error: 'O valor do sinal não pode ser negativo nem superior ao valor total.' },
        { status: 400 }
      )
    }
    if (nParcelas < 1) {
      return NextResponse.json(
        { error: 'O número de parcelas deve ser pelo menos 1.' },
        { status: 400 }
      )
    }
    if (!clienteId) {
      return NextResponse.json(
        { error: 'Não foi possível identificar o cliente do projeto.' },
        { status: 400 }
      )
    }

    // Check if contrato already exists for this project
    const existente = await prisma.contrato.findUnique({ where: { projetoId } })

    let contrato
    if (existente) {
      // Update existing
      contrato = await prisma.contrato.update({
        where: { projetoId },
        data: {
          tipoContrato: tipoContrato || existente.tipoContrato,
          dataAssinatura: dataAssinatura ? new Date(dataAssinatura) : existente.dataAssinatura,
          dataVencimento: dataVencimento ? new Date(dataVencimento) : existente.dataVencimento,
          valorTotal: vTotal,
          valorSinal: vSinal,
          valorRestante: vRestante,
          numeroParcelas: nParcelas,
          valorParcela: vParcela,
          observacoes: observacoes ?? existente.observacoes,
          servicosContratados: projeto.servicosContratados,
        },
      })
    } else {
      // Create new
      const count = await prisma.contrato.count()
      const codigo = `CTR-${String(count + 1).padStart(4, '0')}`

      contrato = await prisma.contrato.create({
        data: {
          codigo,
          projetoId,
          clienteId,
          tipoContrato: tipoContrato || 'Prestação de Serviços',
          dataAssinatura: dataAssinatura ? new Date(dataAssinatura) : null,
          dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
          valorTotal: vTotal,
          valorSinal: vSinal,
          valorRestante: vRestante,
          numeroParcelas: nParcelas,
          valorParcela: vParcela,
          observacoes: observacoes || null,
          servicosContratados: projeto.servicosContratados,
          statusContrato: 'AGUARDANDO_ASSINATURA',
        },
      })

      // Gera registros de pagamento automaticamente (apenas quando valor está definido)
      if (!valorADefinir) {
        if (vSinal > 0) {
          await prisma.pagamento.create({
            data: {
              contratoId: contrato.id,
              tipo: 'SINAL',
              descricao: 'Sinal / Entrada',
              valor: vSinal,
              dataVencimento: dataAssinatura ? new Date(dataAssinatura) : new Date(),
              numeroParcela: 0,
              status: 'PENDENTE',
            },
          })
        }
        for (let i = 1; i <= nParcelas; i++) {
          const venc = new Date(dataAssinatura || new Date())
          venc.setMonth(venc.getMonth() + i)
          await prisma.pagamento.create({
            data: {
              contratoId: contrato.id,
              tipo: i === nParcelas ? 'PAGAMENTO_FINAL' : 'PARCELA',
              descricao: i === nParcelas ? 'Pagamento Final' : `Parcela ${i}/${nParcelas}`,
              valor: vParcela,
              dataVencimento: venc,
              numeroParcela: i,
              status: 'PENDENTE',
            },
          })
        }
      } else {
        // Contrato sem valor definido → avança direto para OPERACIONAL e cria tarefas
        if (projeto.etapaPipeline === 'AGUARDANDO_SINAL') {
          await prisma.projeto.update({
            where: { id: projetoId },
            data: { etapaPipeline: 'OPERACIONAL', dataAprovacao: new Date() },
          })

          // Cria tarefas padrão baseadas nos serviços contratados
          let nomesServicos: string[] = []
          try {
            const raw = projeto.servicosContratados || '[]'
            nomesServicos = JSON.parse(raw as string)
          } catch {}

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
                  data: { projetoId, titulo, etapa: ts.nome, ordem: ordem++ },
                })
              }
            }
          }

          // Notifica gestores responsáveis
          const projetoInfo = await prisma.projeto.findUnique({
            where: { id: projetoId },
            select: { gestorResponsavelId: true, supervisorId: true },
          })
          let destinatariosIds = [projetoInfo?.gestorResponsavelId, projetoInfo?.supervisorId].filter(Boolean) as string[]
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
                titulo: '🚀 Projeto liberado para execução (valor a definir)',
                mensagem: `Projeto ${projeto.codigo} teve contrato registrado sem valor definido e foi liberado para Operacional. Lembre-se de definir o valor do contrato depois.`,
                tipo: 'aviso',
                link: `/operacional/${projetoId}`,
              })),
            })
          }
        }
      }
    }

    await prisma.log.create({
      data: {
        usuarioId: user.id,
        acao: existente ? 'ATUALIZAR_CONTRATO' : 'CRIAR_CONTRATO',
        entidade: 'Contrato',
        entidadeId: contrato.id,
        detalhes: JSON.stringify({ projetoId, tipoContrato, valorADefinir }),
      },
    })

    return NextResponse.json({ contrato, avancouPipeline: valorADefinir && !existente }, { status: existente ? 200 : 201 })
  } catch (error) {
    console.error('Erro ao salvar contrato:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
