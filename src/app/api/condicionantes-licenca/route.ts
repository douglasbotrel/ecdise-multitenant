import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { PODE_GERENCIAR_LICENCAS } from '@/lib/permissoesLicencas'

// POST /api/condicionantes-licenca — adiciona um item ao plano de ação de uma licença
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!PODE_GERENCIAR_LICENCAS.includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const { licencaId, descricao, comoSeraFeito, responsavelId, prazo, nota } = body

    if (!licencaId || !descricao?.trim()) {
      return NextResponse.json({ error: 'Licença e descrição são obrigatórios' }, { status: 400 })
    }

    const item = await prisma.condicionanteLicenca.create({
      data: {
        licencaId,
        descricao: descricao.trim(),
        comoSeraFeito: comoSeraFeito || null,
        responsavelId: responsavelId || null,
        prazo: prazo ? new Date(prazo) : null,
        nota: nota || null,
      },
      include: { responsavel: { select: { id: true, nome: true } } },
    })

    if (responsavelId) {
      await prisma.notificacao.create({
        data: {
          usuarioId: responsavelId,
          titulo: '📋 Nova condicionante de licença',
          mensagem: descricao.trim(),
          tipo: 'info',
          link: '/licencas',
        },
      }).catch(() => {})
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('[condicionantes-licenca POST]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH /api/condicionantes-licenca — marca concluída, ou edita descrição/responsável/prazo
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { id, concluida, descricao, comoSeraFeito, responsavelId, prazo, nota } = body
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    const atual = await prisma.condicionanteLicenca.findUnique({ where: { id } })
    if (!atual) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    // Marcar/desmarcar concluída e anotar uma nota: o próprio responsável pode
    // fazer isso (aparece pra ele em Tarefas da Semana). Editar descrição,
    // como-será-feito, responsável ou prazo é restrito a quem gerencia o
    // módulo de Licenças.
    const apenasAcaoDoResponsavel =
      (concluida !== undefined || nota !== undefined) &&
      descricao === undefined && comoSeraFeito === undefined && responsavelId === undefined && prazo === undefined
    if (!apenasAcaoDoResponsavel && !PODE_GERENCIAR_LICENCAS.includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão para editar este item' }, { status: 403 })
    }
    if (apenasAcaoDoResponsavel && atual.responsavelId !== user.id && !PODE_GERENCIAR_LICENCAS.includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const item = await prisma.condicionanteLicenca.update({
      where: { id },
      data: {
        ...(concluida !== undefined && { concluida: concluida === true, dataConclusao: concluida === true ? new Date() : null }),
        ...(descricao !== undefined && { descricao: String(descricao).trim() }),
        ...(comoSeraFeito !== undefined && { comoSeraFeito: comoSeraFeito || null }),
        ...(responsavelId !== undefined && { responsavelId: responsavelId || null }),
        ...(prazo !== undefined && { prazo: prazo ? new Date(prazo) : null }),
        ...(nota !== undefined && { nota: nota || null }),
      },
      include: { responsavel: { select: { id: true, nome: true } } },
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('[condicionantes-licenca PATCH]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/condicionantes-licenca?id=... — remove um item do plano de ação.
// Restrito ao ADMIN — os demais gestores podem editar, mas não excluir.
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas o Administrador pode excluir condicionantes' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const item = await prisma.condicionanteLicenca.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    // Remove primeiro qualquer planejamento na semana que referencie esse item
    // (senão a exclusão falha por restrição de chave estrangeira)
    await prisma.tarefaSemana.deleteMany({ where: { condicionanteLicencaId: id } })
    await prisma.condicionanteLicenca.delete({ where: { id } })

    await prisma.log.create({
      data: { usuarioId: user.id, acao: 'EXCLUIR_CONDICIONANTE_LICENCA', entidade: 'CondicionanteLicenca', entidadeId: id },
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[condicionantes-licenca DELETE]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
