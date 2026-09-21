import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const {
      statusContrato, arquivoUrl, dataAssinatura, observacoes,
      // Campos editáveis pós-assinatura (complementação de dados)
      tipoContrato, valorTotal, valorSinal, numeroParcelas, valorParcela, dataVencimento,
    } = body

    const contrato = await prisma.contrato.findUnique({ where: { id: params.id } })
    if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })

    const updateData: any = {}
    if (statusContrato !== undefined) updateData.statusContrato = statusContrato
    if (arquivoUrl !== undefined) updateData.arquivoUrl = arquivoUrl
    if (dataAssinatura !== undefined) updateData.dataAssinatura = dataAssinatura ? new Date(dataAssinatura) : null
    if (observacoes !== undefined) updateData.observacoes = observacoes
    // Campos complementares editáveis
    if (tipoContrato !== undefined) updateData.tipoContrato = tipoContrato
    if (valorTotal !== undefined) updateData.valorTotal = parseFloat(String(valorTotal)) || contrato.valorTotal
    if (valorSinal !== undefined) updateData.valorSinal = parseFloat(String(valorSinal)) || contrato.valorSinal
    if (numeroParcelas !== undefined) updateData.numeroParcelas = parseInt(String(numeroParcelas)) || contrato.numeroParcelas
    if (valorParcela !== undefined) updateData.valorParcela = parseFloat(String(valorParcela)) || contrato.valorParcela
    if (dataVencimento !== undefined) updateData.dataVencimento = dataVencimento ? new Date(dataVencimento) : null
    // Recalcula valorRestante se valores financeiros mudaram
    if (valorTotal !== undefined || valorSinal !== undefined) {
      const vTotal = updateData.valorTotal ?? contrato.valorTotal ?? 0
      const vSinal = updateData.valorSinal ?? contrato.valorSinal ?? 0
      updateData.valorRestante = Math.max(0, vTotal - vSinal)
    }

    // Detecta se ADM está definindo valor pela primeira vez (contrato criado sem valor)
    const eraSeValor = !contrato.valorTotal || contrato.valorTotal <= 0
    const novoVTotal = updateData.valorTotal ?? 0
    const gerarParcelas = eraSeValor && novoVTotal > 0

    // Se validando assinatura, avança para ASSINADO e notifica analistas
    if (statusContrato === 'ASSINADO') {
      updateData.statusContrato = 'ASSINADO'
      updateData.dataAssinatura = updateData.dataAssinatura || new Date()

      // Notifica todo o departamento de Contratos (analistas + gestores de contratos)
      // São eles quem complementam os dados e dão continuidade ao processo
      const equipeContratos = await prisma.usuario.findMany({
        where: {
          ativo: true,
          OR: [
            { departamento: 'CONTRATOS' },
            { role: { in: ['ADMIN', 'GESTOR_GERAL'] } }, // gestores gerais também acompanham
          ],
        },
        select: { id: true },
      })
      if (equipeContratos.length > 0) {
        const projetoInfo = await prisma.projeto.findUnique({
          where: { id: contrato.projetoId },
          select: { codigo: true, imovelNome: true },
        })
        // Remove duplicatas
        const idsUnicos = Array.from(new Set(equipeContratos.map(u => u.id)))
        await prisma.notificacao.createMany({
          data: idsUnicos.map(uid => ({
            usuarioId: uid,
            titulo: '✅ Contrato assinado — complementar dados',
            mensagem: `O contrato do projeto ${projetoInfo?.codigo} (${projetoInfo?.imovelNome || ''}) foi marcado como assinado e está aguardando complementação de dados pelo setor de contratos.`,
            tipo: 'sucesso',
            link: `/contratos`,
          })),
        })
      }
    }

    // Se desistência, atualiza pipeline do projeto para base de dados
    if (statusContrato === 'DESISTENCIA') {
      await prisma.projeto.update({
        where: { id: contrato.projetoId },
        data: { etapaPipeline: 'CANCELADO', statusComercial: 'RECUSADO' },
      })
    }

    const contratoAtualizado = await prisma.contrato.update({
      where: { id: params.id },
      data: updateData,
    })

    // Se está definindo valor pela primeira vez, gera os registros de pagamento
    if (gerarParcelas) {
      const vSinalFinal   = updateData.valorSinal     ?? contrato.valorSinal     ?? 0
      const vParcelaFinal = updateData.valorParcela   ?? contrato.valorParcela   ?? 0
      const nParcelasFinal= updateData.numeroParcelas ?? contrato.numeroParcelas ?? 1
      const dataRef       = updateData.dataAssinatura ?? contrato.dataAssinatura ?? new Date()

      if (vSinalFinal > 0) {
        await prisma.pagamento.create({
          data: {
            contratoId: contrato.id,
            tipo: 'SINAL',
            descricao: 'Sinal / Entrada',
            valor: vSinalFinal,
            dataVencimento: dataRef,
            numeroParcela: 0,
            status: 'PENDENTE',
          },
        })
      }
      for (let i = 1; i <= nParcelasFinal; i++) {
        const venc = new Date(dataRef)
        venc.setMonth(venc.getMonth() + i)
        await prisma.pagamento.create({
          data: {
            contratoId: contrato.id,
            tipo: i === nParcelasFinal ? 'PAGAMENTO_FINAL' : 'PARCELA',
            descricao: i === nParcelasFinal ? 'Pagamento Final' : `Parcela ${i}/${nParcelasFinal}`,
            valor: vParcelaFinal,
            dataVencimento: venc,
            numeroParcela: i,
            status: 'PENDENTE',
          },
        })
      }
    }

    await prisma.log.create({
      data: {
        usuarioId: user.id,
        acao: 'ATUALIZAR_CONTRATO',
        entidade: 'Contrato',
        entidadeId: params.id,
        detalhes: JSON.stringify({ statusContrato, campos: Object.keys(updateData), parcelasGeradas: gerarParcelas }),
      },
    })

    return NextResponse.json({ contrato: contratoAtualizado, parcelasGeradas: gerarParcelas })
  } catch (error) {
    console.error('Erro ao atualizar contrato:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const contrato = await prisma.contrato.findUnique({
      where: { id: params.id },
      include: {
        projeto: { select: { id: true, codigo: true, imovelNome: true, tipoServico: true, municipio: true } },
        cliente: { select: { id: true, nome: true, cpfCnpj: true } },
        pagamentos: { orderBy: { numeroParcela: 'asc' } },
      },
    })

    if (!contrato) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json({ contrato })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
