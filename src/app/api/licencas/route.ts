import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { PODE_GERENCIAR_LICENCAS } from '@/lib/permissoesLicencas'

// GET /api/licencas — lista todas as licenças (vinculadas a projeto ou cadastradas soltas)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!PODE_GERENCIAR_LICENCAS.includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const licencas = await prisma.licenca.findMany({
      where: search
        ? {
            OR: [
              { numero: { contains: search, mode: 'insensitive' } },
              { projeto: { codigo: { contains: search, mode: 'insensitive' } } },
              { projeto: { imovelNome: { contains: search, mode: 'insensitive' } } },
              { cliente: { nome: { contains: search, mode: 'insensitive' } } },
              { projeto: { cliente: { nome: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {},
      include: {
        projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true, estado: true, cliente: { select: { id: true, nome: true } } } },
        cliente: { select: { id: true, nome: true } },
        planoAcao: {
          include: { responsavel: { select: { id: true, nome: true } } },
          orderBy: { criadoEm: 'asc' },
        },
      },
      orderBy: { dataEmissao: 'desc' },
    })

    return NextResponse.json({ licencas })
  } catch (error) {
    console.error('[licencas GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/licencas — cria uma licença nova.
// Se vier projetoId: vincula ao projeto (upsert, mantendo o comportamento 1:1 já existente).
// Se vier só clienteId (sem projetoId): cria uma licença "solta" — cadastro manual/externo,
// sem ter passado pelo pipeline (não terá código PRJ-00XX).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!PODE_GERENCIAR_LICENCAS.includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const {
      projetoId, clienteId, numero, dataEmissao, dataValidade,
      areaPermitida, atividadePermitida, latitude, longitude, condicionantes, documentoUrl,
      planoAcao, // opcional: array de { descricao, comoSeraFeito, responsavelId, prazo }
    } = body

    if (!numero || !dataEmissao) {
      return NextResponse.json({ error: 'Número da licença e data de emissão são obrigatórios' }, { status: 400 })
    }
    if (!projetoId && !clienteId) {
      return NextResponse.json({ error: 'Informe o projeto vinculado ou, na falta dele, o cliente da licença' }, { status: 400 })
    }

    let projeto = null
    if (projetoId) {
      projeto = await prisma.projeto.findUnique({ where: { id: projetoId } })
      if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    const dadosBase = {
      numero,
      dataEmissao: new Date(dataEmissao),
      dataValidade: dataValidade ? new Date(dataValidade) : null,
      areaPermitida: areaPermitida ? parseFloat(areaPermitida) : null,
      atividadePermitida: atividadePermitida || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      condicionantes: condicionantes || null,
      documentoUrl: documentoUrl || null,
    }

    const licenca = projetoId
      ? await prisma.licenca.upsert({
          where: { projetoId },
          update: dadosBase,
          create: { projetoId, clienteId: clienteId || null, ...dadosBase },
        })
      : await prisma.licenca.create({
          data: { clienteId, ...dadosBase },
        })

    // Cria os itens do plano de ação, se vieram junto
    if (Array.isArray(planoAcao) && planoAcao.length > 0) {
      await prisma.condicionanteLicenca.createMany({
        data: planoAcao
          .filter((item: any) => item?.descricao?.trim())
          .map((item: any) => ({
            licencaId: licenca.id,
            descricao: item.descricao.trim(),
            comoSeraFeito: item.comoSeraFeito || null,
            responsavelId: item.responsavelId || null,
            prazo: item.prazo ? new Date(item.prazo) : null,
          })),
      })
    }

    if (projeto) {
      const destinatarios = [projeto.gestorResponsavelId, projeto.responsavelId].filter(Boolean) as string[]
      if (destinatarios.length > 0) {
        await prisma.notificacao.createMany({
          data: Array.from(new Set(destinatarios)).map(uid => ({
            usuarioId: uid,
            titulo: '🎉 Licença concedida',
            mensagem: `Projeto ${projeto!.codigo} — licença nº ${numero} foi emitida.`,
            tipo: 'success',
            link: `/acompanhamento/${projetoId}`,
          })),
        }).catch(() => {})
      }
    }

    await prisma.log.create({
      data: {
        usuarioId: user.id,
        acao: 'CONCEDER_LICENCA',
        entidade: 'Licenca',
        entidadeId: licenca.id,
        detalhes: projeto
          ? `Licença nº ${numero} registrada para o projeto ${projeto.codigo}`
          : `Licença nº ${numero} cadastrada manualmente (sem projeto vinculado)`,
      },
    }).catch(() => {})

    const licencaCompleta = await prisma.licenca.findUnique({
      where: { id: licenca.id },
      include: {
        projeto: { select: { id: true, codigo: true, imovelNome: true } },
        cliente: { select: { id: true, nome: true } },
        planoAcao: true,
      },
    })

    return NextResponse.json({ licenca: licencaCompleta }, { status: 201 })
  } catch (error) {
    console.error('Erro ao registrar licença:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
