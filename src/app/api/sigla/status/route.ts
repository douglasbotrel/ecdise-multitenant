import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function verificarToken(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  const esperado = process.env.SIGLA_BOT_TOKEN
  if (!esperado) return false
  return token === esperado
}

/**
 * POST /api/sigla/status
 * Recebe o resultado de uma consulta automática ao SIGLA.
 * Body: { projetoId, protocolo, statusNovo, erro? }
 */
export async function POST(req: NextRequest) {
  if (!verificarToken(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { projetoId, protocolo, statusNovo, erro } = body

    if (!projetoId || !protocolo) {
      return NextResponse.json({ error: 'projetoId e protocolo são obrigatórios' }, { status: 400 })
    }

    // Busca status anterior para comparação
    const projetoAtual = await prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { statusSIGLA: true, codigo: true, gestorResponsavelId: true, supervisorId: true },
    })
    if (!projetoAtual) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    const statusAnterior = projetoAtual.statusSIGLA

    // Registra log da consulta
    await prisma.logSIGLA.create({
      data: {
        projetoId,
        protocolo,
        statusAnterior,
        statusNovo: statusNovo ?? 'ERRO',
        erro: erro ?? null,
      },
    })

    // Atualiza o projeto (mesmo em caso de erro — registra para mostrar na UI)
    if (statusNovo) {
      await prisma.projeto.update({
        where: { id: projetoId },
        data: {
          statusSIGLA: statusNovo,
          ultimaConsultaSIGLA: new Date(),
        },
      })
    } else {
      // Apenas atualiza a data da última tentativa
      await prisma.projeto.update({
        where: { id: projetoId },
        data: { ultimaConsultaSIGLA: new Date() },
      })
    }

    // Notifica responsáveis se o status mudou
    if (statusNovo && statusAnterior && statusNovo !== statusAnterior) {
      const idsResponsaveis = [
        projetoAtual.gestorResponsavelId,
        projetoAtual.supervisorId,
      ].filter(Boolean) as string[]

      // Fallback para ADMINs se não tiver responsáveis
      let destinatarios: string[] = idsResponsaveis
      if (destinatarios.length === 0) {
        const admins = await prisma.usuario.findMany({
          where: { ativo: true, role: { in: ['ADMIN', 'GESTOR_GERAL'] } },
          select: { id: true },
        })
        destinatarios = admins.map(u => u.id)
      }

      if (destinatarios.length > 0) {
        await prisma.notificacao.createMany({
          data: destinatarios.map(uid => ({
            usuarioId: uid,
            titulo: '🔄 Status SIGLA atualizado',
            mensagem: `Projeto ${projetoAtual.codigo} — protocolo ${protocolo}: status alterado de "${statusAnterior}" para "${statusNovo}".`,
            tipo: 'info',
            link: `/acompanhamento/${projetoId}`,
          })),
        })
      }
    }

    return NextResponse.json({
      ok: true,
      mudou: statusNovo !== statusAnterior,
      statusAnterior,
      statusNovo,
    })
  } catch (err) {
    console.error('[SIGLA] Erro ao salvar status:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
