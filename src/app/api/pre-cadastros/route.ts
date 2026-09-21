import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || 'servicos'

    if (tipo === 'servicos') {
      const servicos = await prisma.tipoServico.findMany({
        where: { ativo: true },
        orderBy: { ordem: 'asc' }
      })
      return NextResponse.json({ servicos })
    }

    // Para a tela de configurações — retorna todos, inclusive inativos
    if (tipo === 'servicos_todos') {
      const servicos = await prisma.tipoServico.findMany({
        orderBy: { ordem: 'asc' }
      })
      return NextResponse.json({ servicos })
    }

    if (tipo === 'custos') {
      const custos = await prisma.tipoCusto.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' }
      })
      return NextResponse.json({ custos })
    }

    if (tipo === 'departamentos') {
      const departamentos = await prisma.configuracaoDepartamento.findMany({
        orderBy: { nome: 'asc' }
      })
      return NextResponse.json({ departamentos })
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.role, 'GESTOR_GERAL')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const { tipo, ...data } = body

    if (tipo === 'servico') {
      const count = await prisma.tipoServico.count()
      const servico = await prisma.tipoServico.create({
        data: { ...data, ordem: data.ordem || count + 1 }
      })
      return NextResponse.json({ servico }, { status: 201 })
    }

    if (tipo === 'custo') {
      const custo = await prisma.tipoCusto.create({ data })
      return NextResponse.json({ custo }, { status: 201 })
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.role, 'GESTOR_GERAL')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const { tipo, id, ...data } = body

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    if (tipo === 'servico') {
      // Se está renomeando, propaga o novo nome para todos os projetos existentes
      if (data.nome) {
        const servicoAtual = await prisma.tipoServico.findUnique({ where: { id }, select: { nome: true } })
        if (servicoAtual && servicoAtual.nome !== data.nome) {
          const nomeAntigo = servicoAtual.nome
          const nomeNovo   = data.nome
          // Atualiza servicosRecomendados e servicosContratados em todos os projetos
          const projetos = await prisma.projeto.findMany({
            where: {
              OR: [
                { servicosRecomendados: { contains: `"${nomeAntigo}"` } },
                { servicosContratados:  { contains: `"${nomeAntigo}"` } },
              ]
            },
            select: { id: true, servicosRecomendados: true, servicosContratados: true }
          })
          for (const p of projetos) {
            const updateP: any = {}
            if (p.servicosRecomendados?.includes(`"${nomeAntigo}"`)) {
              const lista: string[] = JSON.parse(p.servicosRecomendados)
              updateP.servicosRecomendados = JSON.stringify(lista.map(s => s === nomeAntigo ? nomeNovo : s))
            }
            if (p.servicosContratados?.includes(`"${nomeAntigo}"`)) {
              const lista: string[] = JSON.parse(p.servicosContratados)
              updateP.servicosContratados = JSON.stringify(lista.map(s => s === nomeAntigo ? nomeNovo : s))
            }
            if (Object.keys(updateP).length > 0) {
              await prisma.projeto.update({ where: { id: p.id }, data: updateP })
            }
          }
        }
      }
      const servico = await prisma.tipoServico.update({ where: { id }, data })
      return NextResponse.json({ servico })
    }

    if (tipo === 'custo') {
      const custo = await prisma.tipoCusto.update({ where: { id }, data })
      return NextResponse.json({ custo })
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.role, 'GESTOR_GERAL')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const id   = searchParams.get('id')

    if (!tipo || !id) return NextResponse.json({ error: 'tipo e id obrigatórios' }, { status: 400 })

    if (tipo === 'servico') {
      // Busca o nome do serviço antes de excluir
      const servico = await prisma.tipoServico.findUnique({ where: { id }, select: { nome: true } })
      if (!servico) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })

      // Verifica se o serviço está em uso em algum projeto
      const emUso = await prisma.projeto.count({
        where: {
          OR: [
            { servicosContratados:  { contains: `"${servico.nome}"` } },
            { servicosRecomendados: { contains: `"${servico.nome}"` } },
          ]
        }
      })
      if (emUso > 0) {
        return NextResponse.json({
          error: `Este serviço está vinculado a ${emUso} projeto(s) existente(s) e não pode ser excluído. Use "Desativar" para ocultá-lo de novas análises sem perder o histórico.`
        }, { status: 409 })
      }

      await prisma.tipoServico.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    if (tipo === 'custo') {
      await prisma.tipoCusto.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Este serviço possui dados vinculados e não pode ser excluído. Desative-o em vez disso.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
