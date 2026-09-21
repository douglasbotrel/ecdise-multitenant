import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// Quem pode ver/planejar a semana de OUTRO usuário (além da própria)
const PODE_VER_OUTROS = ['ADMIN', 'GESTOR_GERAL', 'GESTOR_OPERACIONAL', 'GESTOR_ADMINISTRATIVO', 'SUPERVISOR']

function segundaFeiraDaSemana(data: Date): Date {
  const d = new Date(data)
  const dia = d.getDay() // 0=domingo..6=sábado
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const semanaParam = searchParams.get('semanaInicio')
    let usuarioId = searchParams.get('usuarioId') || user.id

    // Só ADMIN/gestores podem ver a semana de outra pessoa
    if (usuarioId !== user.id && !PODE_VER_OUTROS.includes(user.role)) {
      usuarioId = user.id
    }

    const semanaInicio = segundaFeiraDaSemana(semanaParam ? new Date(semanaParam) : new Date())

    const [planejadas, tarefasBruto, acoesBruto, condicionantesBruto] = await Promise.all([
      prisma.tarefaSemana.findMany({
        where: { usuarioId, semanaInicio },
        include: {
          tarefa: {
            include: {
              projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true, estado: true } },
            },
          },
          acaoPendencia: {
            include: {
              pendencia: {
                include: {
                  projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true, estado: true } },
                },
              },
            },
          },
          condicionanteLicenca: {
            include: {
              licenca: {
                include: {
                  projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true, estado: true, cliente: { select: { id: true, nome: true } } } },
                  cliente: { select: { id: true, nome: true } },
                },
              },
            },
          },
        },
        orderBy: { criadoEm: 'asc' },
      }),
      // Backlog — tarefas operacionais pendentes
      prisma.tarefa.findMany({
        where: { responsavelId: usuarioId, status: { notIn: ['CONCLUIDA', 'CANCELADA'] }, projeto: { excluido: false } },
        include: {
          projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true, estado: true } },
        },
        orderBy: [{ prazo: 'asc' }, { criadoEm: 'asc' }],
      }),
      // Backlog — ações de pendência com órgão, ainda não concluídas — só as
      // que estão sob a responsabilidade do usuário que está vendo a lista.
      prisma.acaoPendencia.findMany({
        where: { responsavelId: usuarioId, concluida: false, pendencia: { projeto: { excluido: false } } },
        include: {
          pendencia: {
            include: {
              projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true, estado: true } },
            },
          },
        },
        orderBy: [{ criadoEm: 'asc' }],
      }),
      // Backlog — condicionantes de licença (plano de ação), ainda não concluídas
      prisma.condicionanteLicenca.findMany({
        where: { responsavelId: usuarioId, concluida: false },
        include: {
          licenca: {
            include: {
              projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true, estado: true, cliente: { select: { id: true, nome: true } } } },
              cliente: { select: { id: true, nome: true } },
            },
          },
        },
        orderBy: [{ prazo: 'asc' }, { criadoEm: 'asc' }],
      }),
    ])

    const idsTarefaNaSemana = new Set(planejadas.filter(p => p.tarefaId).map(p => p.tarefaId))
    const idsAcaoNaSemana   = new Set(planejadas.filter(p => p.acaoPendenciaId).map(p => p.acaoPendenciaId))
    const idsCondNaSemana   = new Set(planejadas.filter(p => p.condicionanteLicencaId).map(p => p.condicionanteLicencaId))

    const backlogTarefas = tarefasBruto
      .filter(t => !idsTarefaNaSemana.has(t.id))
      .map(t => ({
        id: t.id,
        tipo: 'TAREFA' as const,
        titulo: t.titulo,
        prazo: t.prazo,
        projeto: t.projeto,
      }))

    const backlogPendencias = acoesBruto
      .filter(a => !idsAcaoNaSemana.has(a.id))
      .map(a => ({
        id: a.id,
        tipo: 'PENDENCIA' as const,
        titulo: a.descricao,
        prazo: a.pendencia.prazoResposta,
        numeroPedido: a.pendencia.numeroPedido,
        projeto: a.pendencia.projeto,
      }))

    const backlogCondicionantes = condicionantesBruto
      .filter(c => !idsCondNaSemana.has(c.id))
      .map(c => ({
        id: c.id,
        tipo: 'CONDICIONANTE_LICENCA' as const,
        titulo: c.descricao,
        prazo: c.prazo,
        projeto: c.licenca.projeto || null,
        cliente: c.licenca.cliente || c.licenca.projeto?.cliente || null,
        numeroLicenca: c.licenca.numero,
      }))

    // Backlog unificado, ordenado por prazo (sem prazo vai por último)
    const backlog = [...backlogTarefas, ...backlogPendencias, ...backlogCondicionantes].sort((a, b) => {
      if (!a.prazo && !b.prazo) return 0
      if (!a.prazo) return 1
      if (!b.prazo) return -1
      return new Date(a.prazo).getTime() - new Date(b.prazo).getTime()
    })

    return NextResponse.json({
      semanaInicio,
      usuarioId,
      backlog,
      planejadas: planejadas.map(p => {
        if (p.tipo === 'PENDENCIA' && p.acaoPendencia) {
          return {
            id: p.id,
            tipo: 'PENDENCIA' as const,
            itemId: p.acaoPendenciaId,
            criadoEm: p.criadoEm,
            diaSemana: p.diaSemana,
            titulo: p.acaoPendencia.descricao,
            numeroPedido: p.acaoPendencia.pendencia.numeroPedido,
            projeto: p.acaoPendencia.pendencia.projeto,
            concluida: p.acaoPendencia.concluida,
          }
        }
        if (p.tipo === 'CONDICIONANTE_LICENCA' && p.condicionanteLicenca) {
          return {
            id: p.id,
            tipo: 'CONDICIONANTE_LICENCA' as const,
            itemId: p.condicionanteLicencaId,
            criadoEm: p.criadoEm,
            diaSemana: p.diaSemana,
            titulo: p.condicionanteLicenca.descricao,
            numeroLicenca: p.condicionanteLicenca.licenca.numero,
            projeto: p.condicionanteLicenca.licenca.projeto || null,
            concluida: p.condicionanteLicenca.concluida,
          }
        }
        return {
          id: p.id,
          tipo: 'TAREFA' as const,
          itemId: p.tarefaId,
          criadoEm: p.criadoEm,
          diaSemana: p.diaSemana,
          titulo: p.tarefa?.titulo,
          projeto: p.tarefa?.projeto,
          concluida: p.tarefa?.status === 'CONCLUIDA',
        }
      }),
    })
  } catch (err) {
    console.error('[tarefas-semana GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Adiciona uma tarefa, ação de pendência ou condicionante de licença ao planejamento da semana
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { itemId, tipo, semanaInicio: semanaParam, diaSemana } = body
    if (!itemId) return NextResponse.json({ error: 'itemId é obrigatório' }, { status: 400 })

    const tipoFinal = tipo === 'PENDENCIA' ? 'PENDENCIA' : tipo === 'CONDICIONANTE_LICENCA' ? 'CONDICIONANTE_LICENCA' : 'TAREFA'

    let usuarioId = body.usuarioId || user.id
    if (usuarioId !== user.id && !PODE_VER_OUTROS.includes(user.role)) {
      usuarioId = user.id
    }

    const semanaInicio = segundaFeiraDaSemana(semanaParam ? new Date(semanaParam) : new Date())

    // Se ninguém escolheu um dia explicitamente (botão "+", sem arrastar/tocar
    // numa pílula), tenta descobrir sozinho a partir do prazo que o item já
    // tem — evita pedir pra "redefinir" uma data que já existe. Se o prazo
    // cair fora da semana atual (ou não existir), fica "sem dia definido"
    // mesmo, do jeito que já era — o usuário só ajusta se precisar.
    let diaFinal: number | null = diaSemana ?? null
    if (diaFinal === null) {
      let prazoReal: Date | null = null
      if (tipoFinal === 'TAREFA') {
        const tarefa = await prisma.tarefa.findUnique({ where: { id: itemId }, select: { prazo: true } })
        prazoReal = tarefa?.prazo ?? null
      } else if (tipoFinal === 'PENDENCIA') {
        const acao = await prisma.acaoPendencia.findUnique({
          where: { id: itemId },
          include: { pendencia: { select: { prazoResposta: true } } },
        })
        prazoReal = acao?.pendencia?.prazoResposta ?? null
      } else {
        const cond = await prisma.condicionanteLicenca.findUnique({ where: { id: itemId }, select: { prazo: true } })
        prazoReal = cond?.prazo ?? null
      }

      if (prazoReal) {
        const semanaFim = new Date(semanaInicio)
        semanaFim.setDate(semanaFim.getDate() + 7)
        if (prazoReal >= semanaInicio && prazoReal < semanaFim) {
          const diaSemanaJs = prazoReal.getDay() // 0=domingo..6=sábado
          diaFinal = diaSemanaJs === 0 ? 6 : diaSemanaJs - 1 // 0=Segunda..6=Domingo
        }
      }
    }

    let item
    if (tipoFinal === 'PENDENCIA') {
      item = await prisma.tarefaSemana.upsert({
        where: { acaoPendenciaId_usuarioId_semanaInicio: { acaoPendenciaId: itemId, usuarioId, semanaInicio } },
        create: { tipo: 'PENDENCIA', acaoPendenciaId: itemId, usuarioId, semanaInicio, diaSemana: diaFinal },
        update: {},
      })
    } else if (tipoFinal === 'CONDICIONANTE_LICENCA') {
      item = await prisma.tarefaSemana.upsert({
        where: { condicionanteLicencaId_usuarioId_semanaInicio: { condicionanteLicencaId: itemId, usuarioId, semanaInicio } },
        create: { tipo: 'CONDICIONANTE_LICENCA', condicionanteLicencaId: itemId, usuarioId, semanaInicio, diaSemana: diaFinal },
        update: {},
      })
    } else {
      item = await prisma.tarefaSemana.upsert({
        where: { tarefaId_usuarioId_semanaInicio: { tarefaId: itemId, usuarioId, semanaInicio } },
        create: { tipo: 'TAREFA', tarefaId: itemId, usuarioId, semanaInicio, diaSemana: diaFinal },
        update: {},
      })
    }

    return NextResponse.json({ item })
  } catch (err) {
    console.error('[tarefas-semana POST]', err)
    return NextResponse.json({ error: 'Erro ao adicionar à semana' }, { status: 500 })
  }
}

// Atualiza o dia da semana escolhido para um item já planejado
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { id, diaSemana } = body
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const item = await prisma.tarefaSemana.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    if (item.usuarioId !== user.id && !PODE_VER_OUTROS.includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const atualizado = await prisma.tarefaSemana.update({
      where: { id },
      data: { diaSemana: diaSemana === null ? null : Number(diaSemana) },
    })

    return NextResponse.json({ item: atualizado })
  } catch (err) {
    console.error('[tarefas-semana PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

// Remove um item do planejamento da semana (volta pro backlog)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const item = await prisma.tarefaSemana.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    if (item.usuarioId !== user.id && !PODE_VER_OUTROS.includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await prisma.tarefaSemana.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[tarefas-semana DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover' }, { status: 500 })
  }
}
