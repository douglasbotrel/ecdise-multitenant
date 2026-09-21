// Endpoint interno chamado pelo control-plane quando você cria/reseta o
// acesso de um usuário na tela de "Acessos" de uma empresa. É o que de fato
// cria o usuário (com senha) dentro do banco daquele tenant — o
// AcessoRoteamento no control-plane só serve pra roteamento de login, não
// tem senha nenhuma.
//
// Protegido pelo mesmo segredo compartilhado que /api/login-roteamento usa
// no control-plane (CONTROL_PLANE_INTERNAL_SECRET).
import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma, resolverDatabaseUrlPorEmpresa } from '@/lib/tenant'
import { hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const segredoEsperado = process.env.CONTROL_PLANE_INTERNAL_SECRET
  if (!segredoEsperado) {
    return NextResponse.json({ error: 'CONTROL_PLANE_INTERNAL_SECRET não configurado.' }, { status: 500 })
  }
  const segredoRecebido = request.headers.get('x-internal-secret')
  if (segredoRecebido !== segredoEsperado) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : null
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : null
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : null
  const senha = typeof body?.senha === 'string' ? body.senha : null
  const role = typeof body?.role === 'string' && body.role.trim() ? body.role.trim() : 'ADMIN'
  const departamento =
    typeof body?.departamento === 'string' && body.departamento.trim() ? body.departamento.trim() : 'GESTAO_GERAL'

  if (!empresaId || !nome || !email || !senha) {
    return NextResponse.json({ error: 'empresaId, nome, email e senha são obrigatórios.' }, { status: 400 })
  }
  if (senha.length < 8) {
    return NextResponse.json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 })
  }

  const databaseUrl = await resolverDatabaseUrlPorEmpresa(empresaId)
  if (!databaseUrl) {
    return NextResponse.json(
      { error: 'Essa empresa ainda não tem banco de dados configurado no control-plane.' },
      { status: 409 }
    )
  }

  const prisma = getTenantPrisma(databaseUrl)
  const senhaHash = await hashPassword(senha)

  try {
    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: { nome, senha: senhaHash, ativo: true },
      create: { nome, email, senha: senhaHash, role, departamento },
      select: { id: true, nome: true, email: true },
    })
    return NextResponse.json({ ok: true, usuario })
  } catch (err) {
    console.error('[provisionar-usuario] falha ao criar/atualizar usuário no tenant:', err)
    return NextResponse.json({ error: 'Falha ao salvar o usuário no banco do tenant.' }, { status: 500 })
  }
}
