import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/car/extrair
 * Recebe um documento do CAR (PDF ou foto/JPG/PNG) em base64 e usa a API da
 * Anthropic (Claude) para extrair os dados básicos do imóvel/declarante,
 * devolvendo-os para pré-preencher o formulário de Nova Proposta.
 *
 * O usuário SEMPRE revisa e corrige os campos antes de salvar — isso aqui
 * só acelera o preenchimento, não substitui a conferência humana.
 *
 * Requer a variável de ambiente ANTHROPIC_API_KEY (gerar em console.anthropic.com).
 */

const CAMPOS_ESPERADOS = [
  'nomeCliente', 'cpfCnpj', 'municipio', 'estado',
  'nomeFazenda', 'areaHectares', 'car',
] as const

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no servidor. Adicione essa variável de ambiente (Vercel/​.env) para habilitar a leitura automática do CAR.' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { fileBase64, mimeType, fileName } = body as { fileBase64: string; mimeType: string; fileName?: string }

    if (!fileBase64 || !mimeType) {
      return NextResponse.json({ error: 'Arquivo (fileBase64) e mimeType são obrigatórios' }, { status: 400 })
    }

    const ehPdf = mimeType === 'application/pdf'
    const ehImagem = mimeType.startsWith('image/')
    if (!ehPdf && !ehImagem) {
      return NextResponse.json({ error: 'Formato não suportado. Envie um PDF, JPG ou PNG.' }, { status: 400 })
    }

    const conteudoArquivo = ehPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBase64 } }

    const prompt = `Este é um documento de CAR (Cadastro Ambiental Rural) — pode ser o recibo/certidão do CAR, uma declaração, ou uma foto do documento.

Extraia os seguintes dados e responda APENAS com um JSON válido, sem nenhum texto antes ou depois, sem marcação markdown (sem \`\`\`), exatamente neste formato:

{
  "nomeCliente": "nome completo do declarante/detentor do imóvel",
  "cpfCnpj": "CPF ou CNPJ do declarante, apenas números ou com máscara como estiver no documento",
  "municipio": "município onde fica o imóvel",
  "estado": "sigla da UF, 2 letras (ex: MA)",
  "nomeFazenda": "nome do imóvel rural / fazenda",
  "areaHectares": número da área total do imóvel em hectares, apenas o número (use ponto como separador decimal, sem 'ha'),
  "car": "número de inscrição do CAR (código completo)"
}

Se algum campo não for encontrado no documento, use uma string vazia "" (ou 0 para areaHectares). Não invente valores.`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [conteudoArquivo, { type: 'text', text: prompt }],
          },
        ],
      }),
    })

    if (!resp.ok) {
      const errBody = await resp.text()
      console.error('[CAR extrair] Erro na API Anthropic:', resp.status, errBody)
      return NextResponse.json({ error: 'Erro ao processar o documento com IA. Tente novamente ou preencha manualmente.' }, { status: 502 })
    }

    const data = await resp.json()
    const textoResposta: string = (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')

    const limpo = textoResposta.replace(/```json|```/g, '').trim()

    let extraido: Record<string, any>
    try {
      extraido = JSON.parse(limpo)
    } catch (e) {
      console.error('[CAR extrair] Falha ao parsear JSON da IA:', limpo)
      return NextResponse.json({ error: 'Não consegui interpretar os dados do documento. Preencha manualmente.' }, { status: 502 })
    }

    // Garante que só os campos esperados voltam, e no formato certo
    const resultado: Record<string, string> = {}
    for (const campo of CAMPOS_ESPERADOS) {
      const valor = extraido[campo]
      resultado[campo] = valor === undefined || valor === null ? '' : String(valor)
    }

    return NextResponse.json({ dados: resultado, arquivo: fileName || null })
  } catch (err) {
    console.error('[CAR extrair] Erro:', err)
    return NextResponse.json({ error: 'Erro interno ao processar o documento' }, { status: 500 })
  }
}
