import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// PATCH /api/acoes — marca/desmarca uma ação como concluída
// Quando todas as ações de uma pendência ficam concluídas, a pendência é
// automaticamente marcada como CONCLUIDA e recebe a data de entrega.
// Pendências já concluídas ficam somente leitura (não aceitam novo toggle).
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { id, concluida, descricao, responsavelId } = body
    if (!id) return NextResponse.json({ error: 'ID da ação é obrigatório' }, { status: 400 })

    const acaoAtual = await prisma.acaoPendencia.findUnique({
      where: { id },
      include: { pendencia: true },
    })
    if (!acaoAtual) return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 })

    if (acaoAtual.pendencia.status === 'CONCLUIDA') {
      return NextResponse.json(
        { error: 'Esta pendência já foi concluída e está disponível apenas para leitura.' },
        { status: 403 }
      )
    }

    // Edição de texto/responsável (não mexe em conclusão) — usada pela tela
    // de Acompanhamento para corrigir a descrição ou trocar quem cuida da ação.
    if (descricao !== undefined || responsavelId !== undefined) {
      const acaoEditada = await prisma.acaoPendencia.update({
        where: { id },
        data: {
          ...(descricao !== undefined && { descricao: String(descricao).trim() }),
          ...(responsavelId !== undefined && { responsavelId: responsavelId || null }),
        },
        include: { responsavel: { select: { id: true, nome: true } } },
      })
      return NextResponse.json({ acao: acaoEditada, pendencia: null })
    }

    const novoValor = concluida !== undefined ? concluida === true : !acaoAtual.concluida

    const acao = await prisma.acaoPendencia.update({
      where: { id },
      data: {
        concluida: novoValor,
        dataConclusao: novoValor ? new Date() : null,
      },
      include: { responsavel: { select: { id: true, nome: true } } },
    })

    // ── Verifica se todas as ações da pendência foram concluídas ─────────
    const todasAcoes = await prisma.acaoPendencia.findMany({
      where: { pendenciaId: acaoAtual.pendenciaId },
      select: { concluida: true },
    })
    const todasConcluidas = todasAcoes.length > 0 && todasAcoes.every(a => a.concluida)

    let pendenciaAtualizada = null
    if (todasConcluidas) {
      pendenciaAtualizada = await prisma.pendencia.update({
        where: { id: acaoAtual.pendenciaId },
        data: { status: 'CONCLUIDA', dataEntrega: new Date() },
        include: {
          acoes: { include: { responsavel: { select: { id: true, nome: true } } } },
          projeto: { select: { id: true, codigo: true, imovelNome: true, gestorResponsavelId: true, responsavelId: true } },
        },
      })

      const destinatarios = Array.from(new Set(
        [pendenciaAtualizada.projeto.gestorResponsavelId, pendenciaAtualizada.projeto.responsavelId].filter(Boolean)
      )) as string[]
      if (destinatarios.length > 0) {
        await prisma.notificacao.createMany({
          data: destinatarios.map(uid => ({
            usuarioId: uid,
            titulo: '✅ Pendência concluída',
            mensagem: `Projeto ${pendenciaAtualizada!.projeto.codigo} — pedido ${pendenciaAtualizada!.numeroPedido}: todas as ações foram concluídas.`,
            tipo: 'success',
            link: `/acompanhamento/${pendenciaAtualizada!.projeto.id}`,
          })),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ acao, pendencia: pendenciaAtualizada })
  } catch (error) {
    console.error('Erro ao atualizar ação:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
