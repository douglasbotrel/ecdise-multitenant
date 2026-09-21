import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { PODE_GERENCIAR_LICENCAS } from '@/lib/permissoesLicencas'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!PODE_GERENCIAR_LICENCAS.includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const licenca = await prisma.licenca.findUnique({
      where: { id: params.id },
      include: {
        projeto: { select: { id: true, codigo: true, imovelNome: true, municipio: true, estado: true, cliente: { select: { id: true, nome: true } } } },
        cliente: { select: { id: true, nome: true } },
        planoAcao: { include: { responsavel: { select: { id: true, nome: true } } }, orderBy: { criadoEm: 'asc' } },
      },
    })
    if (!licenca) return NextResponse.json({ error: 'Licença não encontrada' }, { status: 404 })

    return NextResponse.json({ licenca })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH /api/licencas/[id] — edita os dados básicos da licença
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!PODE_GERENCIAR_LICENCAS.includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.numero !== undefined) updateData.numero = body.numero
    if (body.dataEmissao !== undefined) updateData.dataEmissao = new Date(body.dataEmissao)
    if (body.dataValidade !== undefined) updateData.dataValidade = body.dataValidade ? new Date(body.dataValidade) : null
    if (body.areaPermitida !== undefined) updateData.areaPermitida = body.areaPermitida ? parseFloat(body.areaPermitida) : null
    if (body.latitude !== undefined) updateData.latitude = body.latitude ? parseFloat(body.latitude) : null
    if (body.longitude !== undefined) updateData.longitude = body.longitude ? parseFloat(body.longitude) : null
    if (body.atividadePermitida !== undefined) updateData.atividadePermitida = body.atividadePermitida || null
    if (body.condicionantes !== undefined) updateData.condicionantes = body.condicionantes || null
    if (body.documentoUrl !== undefined) updateData.documentoUrl = body.documentoUrl || null
    if (body.clienteId !== undefined) updateData.clienteId = body.clienteId || null

    const licenca = await prisma.licenca.update({ where: { id: params.id }, data: updateData })

    await prisma.log.create({
      data: { usuarioId: user.id, acao: 'EDITAR_LICENCA', entidade: 'Licenca', entidadeId: licenca.id },
    }).catch(() => {})

    return NextResponse.json({ licenca })
  } catch (error) {
    console.error('[licencas PATCH]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
