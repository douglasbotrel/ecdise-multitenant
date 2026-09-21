import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const vistoria = await prisma.vistoria.findUnique({
      where: { id: params.id },
      include: {
        projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true } },
        responsavel: { select: { id: true, nome: true } },
        gastos: true,
        documentos: true,
      }
    })

    if (!vistoria) return NextResponse.json({ error: 'Vistoria não encontrada' }, { status: 404 })

    return NextResponse.json({ vistoria })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const {
      status, dataRealizada, resultado, observacoes,
      kmSaida, kmChegada, horaSaida, horaChegada, responsavelId, frota,
    } = body

    const atual = await prisma.vistoria.findUnique({ where: { id: params.id } })
    if (!atual) return NextResponse.json({ error: 'Vistoria não encontrada' }, { status: 404 })

    // ── Validação: dataRealizada não pode ser anterior à dataAgendada ──────
    if (dataRealizada) {
      const dReal = new Date(dataRealizada)
      const dAgend = new Date(atual.dataAgendada)
      // Comparar apenas datas (ignorar horário para flexibilidade)
      dReal.setHours(0, 0, 0, 0)
      dAgend.setHours(0, 0, 0, 0)
      if (dReal < dAgend) {
        return NextResponse.json(
          { error: 'A data de realização não pode ser anterior à data agendada.' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (dataRealizada !== undefined) updateData.dataRealizada = dataRealizada ? new Date(dataRealizada) : null
    if (resultado !== undefined) updateData.resultado = resultado
    if (observacoes !== undefined) updateData.observacoes = observacoes
    if (kmSaida !== undefined) updateData.kmSaida = kmSaida !== '' ? parseFloat(kmSaida) : null
    if (kmChegada !== undefined) updateData.kmChegada = kmChegada !== '' ? parseFloat(kmChegada) : null
    if (horaSaida !== undefined) updateData.horaSaida = horaSaida || null
    if (horaChegada !== undefined) updateData.horaChegada = horaChegada || null
    if (responsavelId !== undefined) updateData.responsavelId = responsavelId || null
    if (frota !== undefined) updateData.frota = frota || null

    // Auto-preencher dataRealizada ao marcar como REALIZADA
    if (status === 'REALIZADA' && !updateData.dataRealizada && !atual.dataRealizada) {
      updateData.dataRealizada = atual.dataAgendada
    }

    const vistoria = await prisma.vistoria.update({
      where: { id: params.id },
      data: updateData,
      include: {
        responsavel: { select: { id: true, nome: true } },
        projeto: { select: { id: true, codigo: true } },
      }
    })

    await prisma.log.create({
      data: {
        usuarioId: user.id,
        acao: 'ATUALIZAR_VISTORIA',
        entidade: 'Vistoria',
        entidadeId: params.id,
        detalhes: JSON.stringify({ status, campos: Object.keys(updateData) }),
      }
    })

    return NextResponse.json({ vistoria })
  } catch (error) {
    console.error('Erro ao atualizar vistoria:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!['ADMIN', 'GESTOR_GERAL', 'GESTOR_CAMPO'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    await prisma.vistoria.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
