import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

/**
 * GET /api/admin/fix-importados
 *
 * One-time migration: corrige projetos importados diretamente para acompanhamento
 * que foram criados com etapaPipeline='OPERACIONAL' (causando aparição indesejada
 * no módulo Operacional).
 *
 * Critério seguro: emAcompanhamento=true + sem nenhuma tarefa + sem contrato
 *
 * Acesse apenas uma vez: https://ecdise.vercel.app/api/admin/fix-importados
 */
export async function GET() {
  try {
    const auth = await getAuthContext()
    if (!auth || auth.usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado — apenas ADMIN' }, { status: 403 })
    }
    const { prisma } = auth

    // Identifica projetos importados: emAcompanhamento=true, sem tarefas, sem contrato,
    // e ainda com etapaPipeline=OPERACIONAL (o bug).
    // Nota: contrato é relação reversa (sem campo contratoId no Projeto), usa `is: null`.
    const candidatos = await prisma.projeto.findMany({
      where: {
        emAcompanhamento: true,
        etapaPipeline:    'OPERACIONAL',
        contrato:         { is: null },
      },
      include: {
        tarefas: { take: 1 },
      },
    })

    // Garante que só atualiza projetos SEM tarefas
    const paraCorrigir = candidatos.filter(p => p.tarefas.length === 0)

    if (paraCorrigir.length === 0) {
      return NextResponse.json({
        ok: true,
        mensagem: 'Nenhum projeto precisava ser corrigido.',
        corrigidos: 0,
      })
    }

    const ids = paraCorrigir.map(p => p.id)

    const { count } = await prisma.projeto.updateMany({
      where: { id: { in: ids } },
      data: {
        etapaPipeline:     'CONCLUIDO',
        statusOperacional: 'CONCLUIDO',
      },
    })

    const nomes = paraCorrigir.map(p => p.codigo)
    console.log('[fix-importados] Corrigidos:', nomes)

    return NextResponse.json({
      ok: true,
      mensagem: `${count} projeto(s) corrigido(s) com sucesso.`,
      corrigidos: count,
      projetos: nomes,
    })
  } catch (err) {
    console.error('[fix-importados]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
