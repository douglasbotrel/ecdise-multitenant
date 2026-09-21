import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function GET() {
  try {
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const { usuario: userPayload, prisma } = auth

    const usuario = await prisma.usuario.findUnique({
      where: { id: userPayload.id },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        role: true,
        departamento: true,
        avatar: true,
        ativo: true,
        criadoEm: true,
      },
    })

    if (!usuario || !usuario.ativo) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ usuario })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
