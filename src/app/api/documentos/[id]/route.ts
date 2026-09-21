import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { excluirDoDrive, isDriveConfigurado } from '@/lib/gdrive'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { usuario: user, prisma } = auth

    const doc = await prisma.documento.findUnique({ where: { id: params.id } })
    if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })

    // Exclui do Google Drive (se configurado e tiver ID)
    if (isDriveConfigurado() && doc.driveFileId) {
      await excluirDoDrive(doc.driveFileId)
    }

    // Exclui do banco
    await prisma.documento.delete({ where: { id: params.id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir documento:', error)
    return NextResponse.json({ error: 'Erro ao excluir documento' }, { status: 500 })
  }
}
