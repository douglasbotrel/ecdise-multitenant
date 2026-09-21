import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Autenticação por token fixo — definir SIGLA_BOT_TOKEN nas env vars do Vercel
function verificarToken(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  const esperado = process.env.SIGLA_BOT_TOKEN
  if (!esperado) return false
  return token === esperado
}

/**
 * GET /api/sigla/projetos
 * Retorna todos os projetos em acompanhamento que possuem credenciais SIGLA e número de protocolo.
 * Usado exclusivamente pelo script Python sigla_checker.py
 */
export async function GET(req: NextRequest) {
  if (!verificarToken(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const projetos = await prisma.projeto.findMany({
      where: {
        emAcompanhamento: true,
        protocoloCodigoOrgao: { not: null },
        credenciais: { not: null },
        excluido: false,
      },
      select: {
        id: true,
        codigo: true,
        tipoServico: true,
        caminhoSIGLA: true,
        protocoloCodigoOrgao: true,
        credenciais: true,
        statusSIGLA: true,
        ultimaConsultaSIGLA: true,
        cliente: { select: { nome: true } },
      },
    })

    // Filtra apenas os que têm credenciais SIGLA preenchidas
    const resultado = projetos
      .map(p => {
        let cred: Record<string, Record<string, string>> = {}
        try { cred = JSON.parse(p.credenciais ?? '{}') } catch {}

        const sigla = cred['SIGLA'] ?? cred['sigla']
        if (!sigla?.login || !sigla?.senha) return null

        return {
          id:                  p.id,
          codigo:              p.codigo,
          tipoServico:         p.tipoServico,      // ← fallback (texto livre) se caminhoSIGLA não estiver definido
          caminhoSIGLA:        p.caminhoSIGLA,      // ← explícito: recursos_florestais | licenciamento_ambiental | recursos_hidricos
          cliente:             p.cliente.nome,
          protocolo:           p.protocoloCodigoOrgao,
          login:               sigla.login,
          senha:               sigla.senha,
          statusAtual:         p.statusSIGLA,
          ultimaConsulta:      p.ultimaConsultaSIGLA,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ projetos: resultado, total: resultado.length })
  } catch (err) {
    console.error('[SIGLA] Erro ao buscar projetos:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
