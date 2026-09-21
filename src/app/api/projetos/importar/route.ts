import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/projetos/importar
 * Cria um projeto "slim" diretamente em emAcompanhamento=true,
 * sem passar pela esteira comercial. Usado para importar processos
 * ambientais que já existiam antes da implantação do Ecdise.
 *
 * Body: {
 *   clienteNome        string   — nome do cliente (busca ou cria)
 *   clienteCpfCnpj     string   — CPF/CNPJ do cliente
 *   tipoServico        string   — ex: "Licenciamento Ambiental (LAU/LAR)"
 *   imovelNome?        string
 *   municipio?         string
 *   estado?            string
 *   protocoloCodigoOrgao string — Nº do processo no SIGLA
 *   protocoloData?     string   — ISO date
 *   siglaLogin         string   — CPF usado no SIGLA
 *   siglaSenha         string   — senha do SIGLA
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const isAdm = ['ADMIN', 'GESTOR_GERAL'].includes(user.role)
    if (!isAdm) return NextResponse.json({ error: 'Apenas ADM pode importar processos' }, { status: 403 })

    const body = await req.json()
    const {
      clienteNome,
      clienteCpfCnpj,
      tipoServico,
      imovelNome,
      municipio,
      estado,
      protocoloCodigoOrgao,
      protocoloData,
      siglaLogin,
      siglaSenha,
    } = body

    // Validações mínimas
    if (!clienteNome?.trim()) return NextResponse.json({ error: 'Nome do cliente obrigatório' }, { status: 400 })
    if (!clienteCpfCnpj?.trim()) return NextResponse.json({ error: 'CPF/CNPJ do cliente obrigatório' }, { status: 400 })
    if (!tipoServico?.trim()) return NextResponse.json({ error: 'Tipo de serviço obrigatório' }, { status: 400 })
    if (!protocoloCodigoOrgao?.trim()) return NextResponse.json({ error: 'Nº do processo obrigatório' }, { status: 400 })
    if (!siglaLogin?.trim()) return NextResponse.json({ error: 'Login SIGLA obrigatório' }, { status: 400 })
    if (!siglaSenha?.trim()) return NextResponse.json({ error: 'Senha SIGLA obrigatória' }, { status: 400 })

    // Find or create cliente
    let cliente = await prisma.cliente.findUnique({
      where: { cpfCnpj: clienteCpfCnpj.trim() },
    })

    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          nome:     clienteNome.trim(),
          cpfCnpj: clienteCpfCnpj.trim(),
          municipio: municipio?.trim() || null,
          estado:    estado?.trim() || null,
        },
      })
    }

    // Monta credenciais SIGLA em JSON
    const credenciais = JSON.stringify({
      SIGLA: {
        login: siglaLogin.trim(),
        senha: siglaSenha.trim(),
      },
    })

    // Cria o projeto diretamente em acompanhamento
    const projeto = await prisma.projeto.create({
      data: {
        clienteId:            cliente.id,
        tipoServico:          tipoServico.trim(),
        imovelNome:           imovelNome?.trim() || null,
        municipio:            municipio?.trim() || null,
        estado:               estado?.trim() || null,
        protocoloCodigoOrgao: protocoloCodigoOrgao.trim(),
        protocoloData:        protocoloData ? new Date(protocoloData) : null,
        credenciais,
        emAcompanhamento:     true,
        // Pipeline: trabalho de campo já concluído fora do app — aguarda licença do órgão
        etapaPipeline:        'CONCLUIDO',
        statusComercial:      'ACEITO',
        statusOperacional:    'CONCLUIDO',
      },
    })

    await prisma.log.create({
      data: {
        usuarioId:  user.id,
        acao:       'IMPORTAR_PROCESSO',
        entidade:   'Projeto',
        entidadeId: projeto.id,
        detalhes:   `Processo ${protocoloCodigoOrgao} importado diretamente para acompanhamento`,
      },
    })

    return NextResponse.json({ projeto }, { status: 201 })
  } catch (err) {
    console.error('[importar]', err)
    return NextResponse.json({ error: 'Erro interno ao importar processo' }, { status: 500 })
  }
}
