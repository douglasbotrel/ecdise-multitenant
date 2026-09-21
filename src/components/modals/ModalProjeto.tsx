'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { X, Loader2, Upload, FileText, Trash2, CheckCircle, ArrowRight, DollarSign } from 'lucide-react'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

// ── Máscaras de input ─────────────────────────────────────────
function maskCpfCnpj(value: string): string {
  const nums = value.replace(/\D/g, '').slice(0, 14)
  if (nums.length <= 11) {
    return nums
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return nums
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function maskTelefone(value: string): string {
  const nums = value.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 10) {
    return nums
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  return nums
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

// ── Validações ────────────────────────────────────────────────
function validarCPF(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '')
  if (n.length !== 11) return false
  if (/^(\d)\1{10}$/.test(n)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(n[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(n[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(n[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(n[10])
}

function validarCNPJ(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, '')
  if (n.length !== 14) return false
  if (/^(\d)\1{13}$/.test(n)) return false
  const calc = (s: string, pesos: number[]) =>
    s.split('').reduce((acc, d, i) => acc + parseInt(d) * pesos[i], 0)
  const p1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  let r1 = 11 - (calc(n.slice(0,12), p1) % 11)
  if (r1 >= 10) r1 = 0
  if (r1 !== parseInt(n[12])) return false
  const p2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  let r2 = 11 - (calc(n.slice(0,13), p2) % 11)
  if (r2 >= 10) r2 = 0
  return r2 === parseInt(n[13])
}

function validarCpfCnpj(valor: string): string {
  const n = valor.replace(/\D/g, '')
  if (n.length === 0) return 'CPF ou CNPJ é obrigatório'
  if (n.length < 11) return `CPF incompleto — faltam ${11 - n.length} dígito(s)`
  if (n.length === 11) return validarCPF(n) ? '' : 'CPF inválido — verifique os dígitos'
  if (n.length < 14) return `CNPJ incompleto — faltam ${14 - n.length} dígito(s)`
  return validarCNPJ(n) ? '' : 'CNPJ inválido — verifique os dígitos'
}

function validarTelefone(valor: string): string {
  const n = valor.replace(/\D/g, '')
  if (n.length === 0) return ''
  if (n.length < 10) return `Número incompleto — faltam ${10 - n.length} dígito(s)`
  if (n.length > 11) return 'Número inválido — máximo 11 dígitos'
  return ''
}

const ETAPA_LABELS: Record<string, string> = {
  SOLICITACAO:         'Nova Solicitação',
  EM_ANALISE_RAPIDA:   'Em Análise Rápida',
  ANALISE_CONCLUIDA:   'Análise Concluída — aguard. validação ADM',
  AGUARDANDO_CONTRATO: 'Aguardando Elaboração de Contrato',
  AGUARDANDO_SINAL:    'Aguardando Pagamento do Sinal',
  OPERACIONAL:         'Aguardando atribuição operacional',
  EM_EXECUCAO:         'Em Execução',
  CONCLUIDO:           'Concluído',
  CANCELADO:           'Cancelado',
}

interface ModalProjetoProps {
  open: boolean
  onClose: () => void
  projeto?: any
  onSalvo: () => void
  modoAcao?: 'criar' | 'analise' | 'validacao' | 'contrato_info' | 'financeiro' | 'operacional' | 'execucao' | 'editar'
}

export function ModalProjeto({ open, onClose, projeto, onSalvo, modoAcao = 'editar' }: ModalProjetoProps) {
  useLockBodyScroll(open)
  const [meRole, setMeRole] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/auth/me').then(r => r.json()).then(d => setMeRole((d.usuario || d)?.role || null)).catch(() => {})
  }, [open])

  async function excluirProjetoAgora() {
    if (!projeto?.id) return
    const motivo = window.prompt(
      `Excluir o projeto ${projeto.codigo || ''} (${projeto.cliente?.nome || projeto.imovelNome || 'sem nome'})?\n\nInforme o motivo da exclusão (obrigatório):`
    )
    if (motivo === null) return // cancelou
    if (!motivo.trim()) { toast.error('É obrigatório informar o motivo da exclusão'); return }

    setExcluindo(true)
    try {
      const res = await fetch(`/api/projetos/${projeto.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Erro ao excluir'); return }
      toast.success('Projeto excluído')
      onSalvo?.()
      onClose()
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setExcluindo(false)
    }
  }

  const [clientes, setClientes] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [novoCliente, setNovoCliente] = useState(false)
  const carFileInputRef = useRef<HTMLInputElement>(null)
  const [importandoCar, setImportandoCar] = useState(false)
  const [arquivos, setArquivos] = useState<{ nome: string; url: string; uploading?: boolean }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [erros, setErros] = useState<{ cpfCnpj?: string; telefone?: string }>({})

  function validarCamposCliente(): boolean {
    const novosErros: { cpfCnpj?: string; telefone?: string } = {}
    const erroCpf = validarCpfCnpj(form.clienteCpfCnpj)
    if (erroCpf) novosErros.cpfCnpj = erroCpf
    const erroTel = validarTelefone(form.clienteTelefone)
    if (erroTel) novosErros.telefone = erroTel
    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  // Auto-detect mode from pipeline stage when modoAcao='editar'
  const modoReal = !projeto ? 'criar' : (modoAcao !== 'editar' ? modoAcao :
    projeto.etapaPipeline === 'EM_ANALISE_RAPIDA'   ? 'analise'      :
    projeto.etapaPipeline === 'ANALISE_CONCLUIDA'   ? 'validacao'    :
    projeto.etapaPipeline === 'AGUARDANDO_CONTRATO' ? 'contrato_info':
    projeto.etapaPipeline === 'AGUARDANDO_SINAL'    ? 'financeiro'   :
    projeto.etapaPipeline === 'OPERACIONAL'         ? 'operacional'  :
    'editar'
  )

  const [form, setForm] = useState({
    // Dados base
    clienteId: '', clienteNome: '', clienteCpfCnpj: '', clienteEmail: '', clienteTelefone: '',
    tipoServico: '', descricao: '', imovelNome: '', municipio: '', estado: '', car: '', areaHectares: '',
    valorProposto: '', observacoes: '',
    // Analista rápido
    analistaRapidoId: '',
    // Análise técnica rápida
    observacoesAnalise: '', servicosRecomendados: [] as string[],
    // Validação ADM
    servicosContratados: [] as string[], valorSinal: '', valorPrestacao: '', numeroPrestacoes: '',
    gestorResponsavelId: '', supervisorId: '',
    // Contrato (setor de contratos)
    tipoContrato: '', observacoesContrato: '', dataAssinaturaContrato: '', dataVencimentoContrato: '',
    // Financeiro (registro de pagamento)
    dataPagamento: '', formaPagamento: '',
    // Operacional
    responsavelId: '', dataPrazo: '',
  })

  useEffect(() => {
    if (open) {
      loadDados()
      if (projeto) {
        const srec = projeto.servicosRecomendados ? JSON.parse(projeto.servicosRecomendados) : []
        const scon = projeto.servicosContratados  ? JSON.parse(projeto.servicosContratados)  : []
        setForm(prev => ({
          ...prev,
          clienteId: projeto.clienteId || '',
          tipoServico: projeto.tipoServico || '',
          descricao: projeto.descricao || '',
          imovelNome: projeto.imovelNome || '',
          municipio: projeto.municipio || '',
          estado: projeto.estado || '',
          car: projeto.car || '',
          areaHectares: projeto.areaHectares?.toString() || '',
          valorProposto: projeto.valorProposto?.toString() || '',
          observacoes: projeto.observacoes || '',
          analistaRapidoId: projeto.analistaRapidoId || '',
          observacoesAnalise: projeto.observacoesAnalise || '',
          servicosRecomendados: srec,
          servicosContratados: scon,
          valorSinal: projeto.valorSinal?.toString() || '',
          valorPrestacao: projeto.valorPrestacao?.toString() || '',
          numeroPrestacoes: projeto.numeroPrestacoes?.toString() || '',
          gestorResponsavelId: projeto.gestorResponsavelId || '',
          supervisorId: projeto.supervisorId || '',
          tipoContrato: projeto.contrato?.tipoContrato ||
            (projeto.tipoServico === 'Ambiental'      ? 'Licenciamento Ambiental'  :
             projeto.tipoServico === 'Regularização'  ? 'Regularização Fundiária'  :
             projeto.tipoServico || ''),
          observacoesContrato: projeto.contrato?.observacoes || '',
          dataAssinaturaContrato: projeto.contrato?.dataAssinatura
            ? new Date(projeto.contrato.dataAssinatura).toISOString().split('T')[0] : '',
          dataVencimentoContrato: projeto.contrato?.dataVencimento
            ? new Date(projeto.contrato.dataVencimento).toISOString().split('T')[0] : '',
          dataPagamento: projeto.dataAprovacao
            ? new Date(projeto.dataAprovacao).toISOString().split('T')[0] : '',
          responsavelId: projeto.responsavelId || '',
          dataPrazo: projeto.dataPrazo ? new Date(projeto.dataPrazo).toISOString().split('T')[0] : '',
        }))
        if (projeto.documentos) {
          setArquivos(projeto.documentos.map((d: any) => ({ nome: d.nome, url: d.url })))
        }
      } else {
        resetForm()
      }
    }
  }, [open, projeto])

  function resetForm() {
    setForm({
      clienteId: '', clienteNome: '', clienteCpfCnpj: '', clienteEmail: '', clienteTelefone: '',
      tipoServico: '', descricao: '', imovelNome: '', municipio: '', estado: '', car: '', areaHectares: '',
      valorProposto: '', observacoes: '', analistaRapidoId: '', observacoesAnalise: '',
      servicosRecomendados: [], servicosContratados: [], valorSinal: '', valorPrestacao: '',
      numeroPrestacoes: '', gestorResponsavelId: '', supervisorId: '',
      tipoContrato: '', observacoesContrato: '', dataAssinaturaContrato: '', dataVencimentoContrato: '',
      dataPagamento: '', formaPagamento: '',
      responsavelId: '', dataPrazo: '',
    })
    setArquivos([])
    setNovoCliente(false)
    setErros({})
  }

  async function loadDados() {
    const [resC, resS, resU] = await Promise.all([
      fetch('/api/clientes'),
      fetch('/api/pre-cadastros?tipo=servicos_todos'),
      fetch('/api/usuarios?ativo=true'),
    ])
    if (resC.ok) setClientes((await resC.json()).clientes)
    if (resS.ok) setServicos((await resS.json()).servicos)
    if (resU.ok) setUsuarios((await resU.json()).usuarios)
  }

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleServico(lista: 'servicosRecomendados' | 'servicosContratados', servico: string) {
    setForm(prev => {
      const atual = prev[lista]
      return {
        ...prev,
        [lista]: atual.includes(servico) ? atual.filter(s => s !== servico) : [...atual, servico],
      }
    })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const novoArquivo = { nome: file.name, url: '', uploading: true }
    setArquivos(prev => [...prev, novoArquivo])
    try {
      const fd = new FormData()
      fd.append('arquivo', file)
      fd.append('categoria', 'SOLICITACAO')
      if (projeto?.id) fd.append('projetoId', projeto.id)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      setArquivos(prev => prev.map(a => a.nome === file.name && a.uploading ? { nome: file.name, url } : a))
      toast.success('Arquivo enviado com sucesso')
    } catch {
      setArquivos(prev => prev.filter(a => !(a.nome === file.name && a.uploading)))
      toast.error('Erro ao enviar arquivo')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e?: React.FormEvent, fecharValidacao: boolean = true) {
    e?.preventDefault()

    if (modoReal === 'criar') {
      if (!form.tipoServico) { toast.error('Selecione o tipo de serviço'); return }
      if (!novoCliente && !form.clienteId) { toast.error('Selecione ou cadastre um cliente'); return }
      if (novoCliente) {
        if (!form.clienteNome) { toast.error('Informe o nome do cliente'); return }
        if (!validarCamposCliente()) {
          toast.error('Corrija os campos marcados em vermelho')
          return
        }
      }
    }

    setLoading(true)
    try {
      let clienteId = form.clienteId

      if (novoCliente && modoReal === 'criar') {
        const res = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: form.clienteNome, cpfCnpj: form.clienteCpfCnpj,
            email: form.clienteEmail, telefone: form.clienteTelefone,
            municipio: form.municipio,
          }),
        })
        if (!res.ok) { toast.error((await res.json()).error || 'Erro ao criar cliente'); return }
        clienteId = (await res.json()).cliente.id
      }

      let payload: any = {}

      if (modoReal === 'criar') {
        payload = {
          clienteId, tipoServico: form.tipoServico, descricao: form.descricao,
          imovelNome: form.imovelNome, municipio: form.municipio, estado: form.estado,
          car: form.car, areaHectares: form.areaHectares, valorProposto: form.valorProposto,
          observacoes: form.observacoes, analistaRapidoId: form.analistaRapidoId || null,
        }
      } else if (modoReal === 'analise') {
        payload = {
          observacoesAnalise: form.observacoesAnalise,
          servicosRecomendados: JSON.stringify(form.servicosRecomendados),
          avancarPipeline: true,
          observacaoTransicao: 'Análise técnica concluída pelo analista de serviço rápido',
        }
      } else if (modoReal === 'validacao') {
        payload = {
          servicosContratados: JSON.stringify(form.servicosContratados),
          valorProposto: calcularValorTotal(form.servicosContratados),
          gestorResponsavelId: form.gestorResponsavelId || null,
          supervisorId: form.supervisorId || null,
          avancarPipeline: fecharValidacao,
          observacaoTransicao: fecharValidacao
            ? 'Serviços e valores validados pelo ADM — encaminhado ao setor de contratos'
            : 'Serviços e valor total salvos — proposta ainda não fechada com o cliente',
        }
      } else if (modoReal === 'contrato_info') {
        const resContrato = await fetch('/api/contratos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projetoId: projeto.id,
            tipoContrato: form.tipoContrato,
            dataAssinatura: form.dataAssinaturaContrato || null,
            dataVencimento: form.dataVencimentoContrato || null,
            observacoes: form.observacoesContrato || null,
          }),
        })
        if (!resContrato.ok) {
          toast.error('Erro ao salvar dados do contrato')
          setLoading(false)
          return
        }
        payload = {
          avancarPipeline: true,
          observacaoTransicao: 'Contrato elaborado — encaminhado ao financeiro para aguardar sinal',
        }
      } else if (modoReal === 'financeiro') {
        const contratoSemValor = !projeto?.contrato?.valorTotal || Number(projeto.contrato.valorTotal) <= 0
        if (contratoSemValor) {
          // Contrato sem valor definido → libera direto para Operacional sem exigir data de pagamento
          payload = {
            avancarPipeline: true,
            observacaoTransicao: 'Contrato sem valor definido — liberado diretamente para área técnica',
          }
        } else {
          if (!form.dataPagamento) { toast.error('Informe a data do pagamento'); setLoading(false); return }
          payload = {
            dataAprovacao: form.dataPagamento,
            avancarPipeline: true,
            observacaoTransicao: `Sinal recebido em ${form.dataPagamento} — projeto liberado para área técnica`,
          }
        }
      } else if (modoReal === 'operacional') {
        payload = {
          responsavelId: form.responsavelId || null,
          dataInicio: new Date().toISOString(), // marca o início real da execução, para o KPI de tempo operacional
          dataPrazo: form.dataPrazo || null,
          statusOperacional: 'EM_ANDAMENTO',
          avancarPipeline: true,
          observacaoTransicao: 'Analista e prazo definidos — projeto em execução',
        }
      } else {
        payload = {
          tipoServico: form.tipoServico, descricao: form.descricao,
          imovelNome: form.imovelNome, municipio: form.municipio, estado: form.estado,
          car: form.car, areaHectares: form.areaHectares, valorProposto: form.valorProposto,
          observacoes: form.observacoes, analistaRapidoId: form.analistaRapidoId || null,
          responsavelId: form.responsavelId || null, supervisorId: form.supervisorId || null,
          dataPrazo: form.dataPrazo || null,
        }
      }

      const url = projeto ? `/api/projetos/${projeto.id}` : '/api/projetos'
      const method = projeto ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) { toast.error((await res.json()).error || 'Erro ao salvar'); return }

      const msgs: Record<string, string> = {
        criar:         '✅ Projeto criado! Analista notificado.',
        analise:       '✅ Análise concluída! ADM notificado para validação.',
        validacao:     fecharValidacao ? '✅ Proposta validada! Setor de contratos notificado.' : '💾 Valores salvos — proposta ainda não fechada.',
        contrato_info: '✅ Contrato salvo! Financeiro notificado para aguardar sinal.',
        financeiro:    !projeto?.contrato?.valorTotal || Number(projeto?.contrato?.valorTotal) <= 0
          ? '✅ Projeto liberado para Operacional! Defina o valor do contrato depois.'
          : '✅ Pagamento registrado! Área técnica notificada.',
        operacional:   '✅ Projeto atribuído! Analista notificado para execução.',
        editar:        'Projeto atualizado.',
      }
      toast.success(msgs[modoReal] || 'Salvo com sucesso!')
      onSalvo()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const titulo = {
    criar:         'Nova Solicitação de Projeto',
    analise:       `Análise Técnica — ${projeto?.codigo}`,
    validacao:     `Validar e Encaminhar Contrato — ${projeto?.codigo}`,
    contrato_info: `Elaborar Contrato — ${projeto?.codigo}`,
    financeiro:    `Registrar Pagamento — ${projeto?.codigo}`,
    operacional:   `Atribuir Analista — ${projeto?.codigo}`,
    execucao:      `Execução — ${projeto?.codigo}`,
    editar:        `Editar Projeto — ${projeto?.codigo}`,
  }[modoReal]

  const analistasRapidos = usuarios.filter(u => u.role === 'ANALISTA_RAPIDO' || u.role === 'ANALISTA')
  const gestores = usuarios.filter(u => ['ADMIN','GESTOR_GERAL','GESTOR_OPERACIONAL','GESTOR_CAMPO','SUPERVISOR'].includes(u.role))
  const analistasOp = usuarios.filter(u => ['ANALISTA','TECNICO_CAMPO'].includes(u.role))

  const normalizeCateg = (c: string) => (c || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  const servicosAmbiental    = servicos.filter(s => normalizeCateg(s.categoria) === 'ambiental')
  const servicosRegularizacao = servicos.filter(s => ['regularizacao', 'regularização'].includes(normalizeCateg(s.categoria)))

  // Redimensiona/comprime uma imagem no navegador antes de enviar, para não
  // estourar o limite de tamanho de requisição da Vercel (fotos de celular
  // costumam vir com vários MB). PDFs não são comprimidos aqui.
  async function comprimirImagem(file: File): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
      reader.readAsDataURL(file)
    })

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Falha ao processar a imagem'))
      el.src = dataUrl
    })

    const MAX_LADO = 1800
    let { width, height } = img
    if (width > MAX_LADO || height > MAX_LADO) {
      const escala = MAX_LADO / Math.max(width, height)
      width = Math.round(width * escala)
      height = Math.round(height * escala)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl.split(',')[1] // fallback: envia original se canvas falhar
    ctx.drawImage(img, 0, 0, width, height)

    // Qualidade 0.75 mantém o texto legível e reduz bastante o tamanho
    return canvas.toDataURL('image/jpeg', 0.75).split(',')[1]
  }

  async function handleImportarCar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const tiposAceitos = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!tiposAceitos.includes(file.type)) {
      toast.error('Envie um arquivo PDF, JPG ou PNG')
      if (carFileInputRef.current) carFileInputRef.current.value = ''
      return
    }

    setImportandoCar(true)
    try {
      const ehImagem = file.type.startsWith('image/')
      let base64: string
      let mimeTypeEnvio = file.type

      if (ehImagem) {
        base64 = await comprimirImagem(file)
        mimeTypeEnvio = 'image/jpeg' // canvas sempre reexporta como JPEG
      } else {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
          reader.readAsDataURL(file)
        })
      }

      // Limite prático de ~3.3MB no base64 (~4.5MB é o teto da Vercel; deixamos
      // margem para o JSON em volta). PDFs não são comprimidos automaticamente.
      const LIMITE_BASE64 = 3_300_000
      if (base64.length > LIMITE_BASE64) {
        toast.error(
          ehImagem
            ? 'Imagem ainda muito grande mesmo após compressão. Tente outra foto com menos resolução.'
            : 'PDF muito grande (limite ~2,5MB). Tente exportar com menos páginas/qualidade, ou envie uma foto do documento em vez do PDF.'
        )
        return
      }

      const res = await fetch('/api/car/extrair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, mimeType: mimeTypeEnvio, fileName: file.name }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao ler o documento')
        return
      }

      const { dados } = data
      // Preenche o formulário — o usuário ainda precisa revisar e confirmar
      setNovoCliente(true)
      if (dados.nomeCliente) set('clienteNome', dados.nomeCliente)
      if (dados.cpfCnpj) set('clienteCpfCnpj', maskCpfCnpj(dados.cpfCnpj))
      if (dados.municipio) set('municipio', dados.municipio)
      if (dados.estado) set('estado', dados.estado.toUpperCase().slice(0, 2))
      if (dados.nomeFazenda) set('imovelNome', dados.nomeFazenda)
      if (dados.areaHectares && Number(dados.areaHectares) > 0) set('areaHectares', dados.areaHectares)
      if (dados.car) set('car', dados.car)

      toast.success('Dados extraídos do CAR! Confira e corrija o que precisar antes de salvar.')
    } catch (err) {
      toast.error('Erro ao importar o documento CAR')
    } finally {
      setImportandoCar(false)
      if (carFileInputRef.current) carFileInputRef.current.value = ''
    }
  }

  function calcularValorTotal(nomes: string[]): number {
    return servicos
      .filter(s => nomes.includes(s.nome))
      .reduce((acc, s) => acc + (Number(s.valor) || 0), 0)
  }

  function ServiceCheckList({ lista }: { lista: 'servicosRecomendados' | 'servicosContratados' }) {
    return (
      <div className="space-y-3">
        {servicosAmbiental.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Ambiental</p>
            <div className="space-y-1.5">
              {servicosAmbiental.map(s => (
                <label key={s.id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  form[lista].includes(s.nome) ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="checkbox" checked={form[lista].includes(s.nome)}
                    onChange={() => toggleServico(lista, s.nome)} className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">{s.nome}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {servicosRegularizacao.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Regularização</p>
            <div className="space-y-1.5">
              {servicosRegularizacao.map(s => (
                <label key={s.id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  form[lista].includes(s.nome) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="checkbox" checked={form[lista].includes(s.nome)}
                    onChange={() => toggleServico(lista, s.nome)} className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">{s.nome}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
            {projeto && (
              <p className="text-xs text-gray-400 mt-0.5">
                Etapa atual: <span className="font-medium text-gray-600">{ETAPA_LABELS[projeto.etapaPipeline] || projeto.etapaPipeline}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── MODO CRIAR ──────────────────────────────────────── */}
          {modoReal === 'criar' && (<>
            <div className="bg-green-50 border border-dashed border-green-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-green-800">📄 Importar dados via CAR</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Envie o PDF ou foto do CAR — nome, CPF, fazenda, município e área são preenchidos automaticamente. Você confere e corrige antes de salvar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => carFileInputRef.current?.click()}
                disabled={importandoCar}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-white border border-green-300 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 disabled:opacity-60"
              >
                {importandoCar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importandoCar ? 'Lendo documento...' : 'Importar CAR'}
              </button>
              <input ref={carFileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleImportarCar} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Cliente *</label>
                <button type="button" onClick={() => setNovoCliente(!novoCliente)} className="text-xs text-green-600 font-medium">
                  {novoCliente ? 'Selecionar existente' : '+ Novo cliente'}
                </button>
              </div>
              {novoCliente ? (
                <div className="space-y-2">
                  <input type="text" value={form.clienteNome} onChange={e => set('clienteNome', e.target.value)}
                    placeholder="Nome do cliente / empresa *" className="input-field" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        value={form.clienteCpfCnpj}
                        onChange={e => {
                          set('clienteCpfCnpj', maskCpfCnpj(e.target.value))
                          setErros(prev => ({ ...prev, cpfCnpj: undefined }))
                        }}
                        onBlur={() => {
                          if (form.clienteCpfCnpj) {
                            const err = validarCpfCnpj(form.clienteCpfCnpj)
                            setErros(prev => ({ ...prev, cpfCnpj: err || undefined }))
                          }
                        }}
                        placeholder="CPF ou CNPJ *"
                        maxLength={18}
                        inputMode="numeric"
                        className={`input-field ${erros.cpfCnpj ? 'input-field-error' : ''}`}
                      />
                      {erros.cpfCnpj ? (
                        <p className="text-xs text-red-500 mt-0.5 pl-1 flex items-center gap-1">
                          <span>⚠</span> {erros.cpfCnpj}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5 pl-1">
                          {form.clienteCpfCnpj.replace(/\D/g, '').length <= 11 ? 'CPF (11 dígitos)' : 'CNPJ (14 dígitos)'}
                        </p>
                      )}
                    </div>
                    <div>
                      <input
                        type="text"
                        value={form.clienteTelefone}
                        onChange={e => {
                          set('clienteTelefone', maskTelefone(e.target.value))
                          setErros(prev => ({ ...prev, telefone: undefined }))
                        }}
                        onBlur={() => {
                          if (form.clienteTelefone) {
                            const err = validarTelefone(form.clienteTelefone)
                            setErros(prev => ({ ...prev, telefone: err || undefined }))
                          }
                        }}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        inputMode="numeric"
                        className={`input-field ${erros.telefone ? 'input-field-error' : ''}`}
                      />
                      {erros.telefone ? (
                        <p className="text-xs text-red-500 mt-0.5 pl-1 flex items-center gap-1">
                          <span>⚠</span> {erros.telefone}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5 pl-1">
                          {form.clienteTelefone.replace(/\D/g, '').length <= 10 ? 'Fixo (10 dígitos)' : 'Celular (11 dígitos)'}
                        </p>
                      )}
                    </div>
                  </div>
                  <input type="email" value={form.clienteEmail} onChange={e => set('clienteEmail', e.target.value)}
                    placeholder="E-mail (opcional)" className="input-field" />
                </div>
              ) : (
                <select value={form.clienteId} onChange={e => set('clienteId', e.target.value)} className="input-field">
                  <option value="">Selecione um cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} — {c.cpfCnpj}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de Serviço *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'Ambiental',      label: 'Ambiental',      desc: 'Licenciamento, Outorga, PRAD, AEF…', color: 'green' },
                  { value: 'Regularização',  label: 'Regularização',  desc: 'ACAIO, CAR, Tipologia Florestal…',    color: 'blue'  },
                ].map(({ value, label, desc, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('tipoServico', value)}
                    className={`flex flex-col items-start p-3.5 rounded-xl border-2 text-left transition-all ${
                      form.tipoServico === value
                        ? color === 'green'
                          ? 'border-green-500 bg-green-50'
                          : 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <span className={`text-sm font-semibold mb-0.5 ${
                      form.tipoServico === value
                        ? color === 'green' ? 'text-green-700' : 'text-blue-700'
                        : 'text-gray-800'
                    }`}>{label}</span>
                    <span className="text-xs text-gray-400 leading-snug">{desc}</span>
                  </button>
                ))}
              </div>
              {!form.tipoServico && (
                <p className="text-xs text-red-500 mt-1 pl-1">Selecione o tipo de serviço</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da Fazenda / Imóvel</label>
                <input type="text" value={form.imovelNome} onChange={e => set('imovelNome', e.target.value)}
                  placeholder="Ex: Fazenda São João" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Município</label>
                <input type="text" value={form.municipio} onChange={e => set('municipio', e.target.value)}
                  placeholder="Cidade" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">UF</label>
                <select value={form.estado} onChange={e => set('estado', e.target.value)} className="input-field">
                  <option value="">UF</option>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Área (ha)</label>
                <input type="number" step="0.01" value={form.areaHectares} onChange={e => set('areaHectares', e.target.value)}
                  placeholder="0,00" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CAR</label>
                <input type="text" value={form.car} onChange={e => set('car', e.target.value)}
                  placeholder="Número do CAR" className="input-field" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição / contexto do pedido</label>
              <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)}
                placeholder="Informações recebidas pelo cliente (WhatsApp, reunião, etc.)..." rows={3} className="input-field resize-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Analista de Serviço Rápido <span className="text-gray-400 font-normal">(quem fará a análise técnica inicial)</span>
              </label>
              <select value={form.analistaRapidoId} onChange={e => set('analistaRapidoId', e.target.value)} className="input-field">
                <option value="">Não atribuído</option>
                {analistasRapidos.map(u => <option key={u.id} value={u.id}>{u.nome} — {u.role}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Documentos de referência <span className="text-gray-400 font-normal">(KML, PDF, mapa, etc.)</span>
              </label>
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                <p className="text-sm text-gray-500">Clique para enviar arquivo</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF, KML, KMZ, imagens, ZIP — máx. 50MB</p>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload}
                accept=".pdf,.kml,.kmz,.jpg,.jpeg,.png,.tif,.tiff,.zip,.xlsx,.xls,.xml" />
              {arquivos.length > 0 && (
                <div className="mt-2 space-y-1">
                  {arquivos.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      {a.uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <FileText className="w-4 h-4 text-green-600" />}
                      <span className="text-sm text-gray-700 flex-1 truncate">{a.nome}</span>
                      {!a.uploading && (
                        <button type="button" onClick={() => setArquivos(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>)}

          {/* ── MODO ANÁLISE (Analista Rápido) ──────────────────── */}
          {modoReal === 'analise' && (<>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm font-medium text-yellow-800">📋 Preencha a análise técnica e selecione os serviços viáveis</p>
              <p className="text-xs text-yellow-600 mt-1">Ao salvar, o ADM será notificado para validar sua análise.</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <p className="text-sm"><span className="font-medium">Imóvel:</span> {projeto?.imovelNome || '—'}</p>
              <p className="text-sm"><span className="font-medium">Município/UF:</span> {projeto?.municipio} / {projeto?.estado}</p>
              <p className="text-sm"><span className="font-medium">Área:</span> {projeto?.areaHectares ? `${projeto.areaHectares} ha` : '—'}</p>
              <p className="text-sm"><span className="font-medium">Tipo solicitado:</span> {projeto?.tipoServico}</p>
              {projeto?.descricao && <p className="text-sm"><span className="font-medium">Contexto:</span> {projeto.descricao}</p>}
            </div>

            {arquivos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Documentos disponíveis</label>
                <div className="space-y-1">
                  {arquivos.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-blue-600 hover:underline truncate">{a.nome}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Serviços que podem ser prestados *</label>
              <ServiceCheckList lista="servicosRecomendados" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações técnicas da análise</label>
              <textarea value={form.observacoesAnalise} onChange={e => set('observacoesAnalise', e.target.value)}
                placeholder="Descreva sua análise: situação do CAR, restrições legais, viabilidade, pendências de documentos, etc."
                rows={4} className="input-field resize-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enviar documentos complementares</label>
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                <p className="text-sm text-gray-500">Clique para enviar</p>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload}
                accept=".pdf,.kml,.kmz,.jpg,.jpeg,.png,.tif,.tiff,.zip,.xlsx,.xls,.xml" />
            </div>
          </>)}

          {/* ── MODO VALIDAÇÃO (ADM) ─────────────────────────────── */}
          {modoReal === 'validacao' && (<>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-800">✅ Análise técnica concluída — valide os serviços e defina os valores</p>
              <p className="text-xs text-blue-600 mt-1">Ao salvar, o setor de contratos será notificado diretamente para elaborar o contrato.</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Análise do {projeto?.analistaRapido?.nome || 'Analista'}:</p>
              <p className="text-sm text-gray-600">{projeto?.observacoesAnalise || 'Sem observações registradas.'}</p>
              {projeto?.servicosRecomendados && (() => {
                try {
                  const s = JSON.parse(projeto.servicosRecomendados)
                  return s.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mt-1">Serviços recomendados pelo analista:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.map((sv: string) => <span key={sv} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{sv}</span>)}
                      </div>
                    </div>
                  ) : null
                } catch { return null }
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Serviços contratados com o cliente *</label>
              <ServiceCheckList lista="servicosContratados" />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Valor total do serviço</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Soma automática dos serviços selecionados acima — apresentado ao cliente nesta etapa, sem parcelamento.
                </p>
              </div>
              <p className="text-xl font-bold text-green-800">
                {calcularValorTotal(form.servicosContratados).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            {form.servicosContratados.length > 0 && calcularValorTotal(form.servicosContratados) <= 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 -mt-2">
                ⚠️ O valor deu R$ 0,00 mesmo com serviço(s) selecionado(s) — provavelmente esse tipo de serviço
                está sem valor cadastrado em <strong>Configurações → Tipos de Serviço</strong>. Se não corrigir,
                o contrato também nascerá zerado e o projeto pulará direto pro Operacional sem passar pelo Financeiro.
              </p>
            )}
            <p className="text-xs text-gray-400 -mt-2 pl-1">
              O parcelamento (sinal + parcelas) será definido depois, na elaboração do contrato — podendo ficar igual, maior ou menor que este valor.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Gestor/Supervisor responsável</label>
                <select value={form.gestorResponsavelId} onChange={e => set('gestorResponsavelId', e.target.value)} className="input-field">
                  <option value="">Não atribuído</option>
                  {gestores.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supervisor de campo</label>
                <select value={form.supervisorId} onChange={e => set('supervisorId', e.target.value)} className="input-field">
                  <option value="">Não atribuído</option>
                  {gestores.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            </div>
          </>)}

          {/* ── MODO CONTRATO (Setor de Contratos) ──────────────── */}
          {modoReal === 'contrato_info' && (<>
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
              <p className="text-sm font-medium text-pink-800">📄 Elabore o contrato com os dados fornecidos pelo ADM</p>
              <p className="text-xs text-pink-600 mt-1">Ao salvar, o setor financeiro será notificado para aguardar o pagamento do sinal.</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
              <p className="text-sm font-semibold text-gray-700 mb-2">Dados do projeto</p>
              <p className="text-sm"><span className="font-medium">Cliente:</span> {projeto?.cliente?.nome}</p>
              <p className="text-sm"><span className="font-medium">Imóvel:</span> {projeto?.imovelNome || '—'} — {projeto?.municipio}/{projeto?.estado}</p>
              {projeto?.servicosContratados && (() => {
                try {
                  const s = JSON.parse(projeto.servicosContratados)
                  return s.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.map((sv: string) => <span key={sv} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">{sv}</span>)}
                    </div>
                  ) : null
                } catch { return null }
              })()}
              <div className="flex gap-4 pt-1 text-sm">
                {projeto?.valorProposto > 0 && (
                  <span><span className="font-medium">Valor total do serviço (comercial):</span> {Number(projeto.valorProposto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                )}
              </div>
              <p className="text-xs text-gray-400">Defina abaixo o valor final do contrato (pode ser igual, maior ou menor) e a forma de pagamento.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de Contrato</label>
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-sm font-medium text-gray-800">{form.tipoContrato || projeto?.tipoServico || '—'}</span>
                <span className="ml-auto text-xs text-gray-400 italic">Definido na etapa comercial</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 pl-1">
                Tipo de serviço: <strong>{projeto?.tipoServico}</strong> — definido pela equipe comercial, não editável aqui.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Data de Assinatura</label>
                <input type="date" value={form.dataAssinaturaContrato} onChange={e => set('dataAssinaturaContrato', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Data de Vencimento</label>
                <input type="date" value={form.dataVencimentoContrato} onChange={e => set('dataVencimentoContrato', e.target.value)} className="input-field" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações do contrato</label>
              <textarea value={form.observacoesContrato} onChange={e => set('observacoesContrato', e.target.value)}
                placeholder="Condições especiais, cláusulas adicionais, observações relevantes..."
                rows={3} className="input-field resize-none" />
            </div>
          </>)}

          {/* ── MODO FINANCEIRO (Registrar pagamento) ───────────── */}
          {modoReal === 'financeiro' && (() => {
            const contratoSemValor = !projeto?.contrato?.valorTotal || Number(projeto?.contrato?.valorTotal) <= 0
            return (<>
              {contratoSemValor ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-blue-800">📋 Contrato sem valor definido</p>
                  <p className="text-xs text-blue-600 mt-1">Este contrato ainda não tem valor estipulado. Você pode liberar o projeto para Operacional agora — o valor poderá ser definido depois no módulo de Contratos.</p>
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-orange-800">💰 Registre a data em que o sinal foi recebido</p>
                  <p className="text-xs text-orange-600 mt-1">Ao confirmar, o projeto será liberado para a área técnica iniciar o trabalho.</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                <p className="text-sm font-semibold text-gray-700 mb-2">Dados financeiros</p>
                <p className="text-sm"><span className="font-medium">Projeto:</span> {projeto?.codigo} — {projeto?.imovelNome}</p>
                <p className="text-sm"><span className="font-medium">Cliente:</span> {projeto?.cliente?.nome}</p>
                {projeto?.servicosContratados && (() => {
                  try {
                    const s = JSON.parse(projeto.servicosContratados)
                    return s.length > 0 ? <p className="text-sm"><span className="font-medium">Serviços:</span> {s.join(', ')}</p> : null
                  } catch { return null }
                })()}
                <div className="flex gap-4 pt-1 text-sm">
                  {projeto?.contrato?.valorSinal > 0 && (
                    <span className="font-semibold text-green-700">
                      Sinal esperado: {Number(projeto.contrato.valorSinal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  )}
                  {contratoSemValor && (
                    <span className="text-amber-600 font-medium text-xs bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Valor a definir
                    </span>
                  )}
                </div>
                {projeto?.contrato && (
                  <p className="text-sm"><span className="font-medium">Contrato:</span> {projeto.contrato.tipoContrato} — {projeto.contrato.codigo}</p>
                )}
              </div>

              {!contratoSemValor && (<>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Data de recebimento do sinal *</label>
                  <input type="date" value={form.dataPagamento} onChange={e => set('dataPagamento', e.target.value)}
                    className="input-field" required />
                  <p className="text-xs text-gray-400 mt-1">Esta data será registrada no fluxo de caixa.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Forma de pagamento</label>
                  <select value={form.formaPagamento} onChange={e => set('formaPagamento', e.target.value)} className="input-field">
                    <option value="">Selecione...</option>
                    <option value="PIX">PIX</option>
                    <option value="TRANSFERENCIA">Transferência Bancária</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </>)}
            </>)
          })()}

          {/* ── MODO OPERACIONAL (Gestor atribui analista) ──────── */}
          {modoReal === 'operacional' && (<>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-sm font-medium text-indigo-800">🚀 Sinal recebido — atribua um analista e defina o prazo</p>
              <p className="text-xs text-indigo-600 mt-1">O analista será notificado para iniciar a execução do projeto.</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <p className="text-sm"><span className="font-medium">Projeto:</span> {projeto?.codigo} — {projeto?.imovelNome}</p>
              <p className="text-sm"><span className="font-medium">Tipo:</span> {projeto?.tipoServico}</p>
              <p className="text-sm"><span className="font-medium">Município:</span> {projeto?.municipio}/{projeto?.estado}</p>
              <p className="text-sm"><span className="font-medium">Área:</span> {projeto?.areaHectares} ha</p>
              {projeto?.servicosContratados && (() => {
                try {
                  const s = JSON.parse(projeto.servicosContratados)
                  return s.length > 0 ? <p className="text-sm"><span className="font-medium">Serviços:</span> {s.join(', ')}</p> : null
                } catch { return null }
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Analista Responsável *</label>
              <select value={form.responsavelId} onChange={e => set('responsavelId', e.target.value)} className="input-field" required>
                <option value="">Selecione o analista...</option>
                {analistasOp.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Prazo para conclusão *</label>
              <input type="date" value={form.dataPrazo} onChange={e => set('dataPrazo', e.target.value)} className="input-field" required />
            </div>
          </>)}

          {/* ── MODO EDITAR LIVRE ─────────────────────────────────── */}
          {modoReal === 'editar' && (<>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome do Imóvel</label>
                <input type="text" value={form.imovelNome} onChange={e => set('imovelNome', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Município</label>
                <input type="text" value={form.municipio} onChange={e => set('municipio', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">UF</label>
                <select value={form.estado} onChange={e => set('estado', e.target.value)} className="input-field">
                  <option value="">UF</option>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Área (ha)</label>
                <input type="number" step="0.01" value={form.areaHectares} onChange={e => set('areaHectares', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Analista Rápido</label>
                <select value={form.analistaRapidoId} onChange={e => set('analistaRapidoId', e.target.value)} className="input-field">
                  <option value="">Não atribuído</option>
                  {analistasRapidos.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações</label>
              <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={3} className="input-field resize-none" />
            </div>
          </>)}

          {/* Botões */}
          <div className="flex justify-between items-center gap-3 pt-2 border-t border-gray-100">
            {meRole === 'ADMIN' && projeto?.id && modoReal !== 'criar' ? (
              <button type="button" onClick={excluirProjetoAgora} disabled={excluindo || loading}
                className="flex items-center gap-1.5 px-3 py-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl text-sm font-medium disabled:opacity-50">
                {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir Projeto
              </button>
            ) : <div />}
            <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm">
              Cancelar
            </button>
            {modoReal === 'validacao' ? (
              <>
                <button type="button" onClick={() => handleSubmit(undefined, false)} disabled={loading}
                  className="px-5 py-2.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 font-semibold rounded-xl text-sm flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar — Serviço Não Fechado
                </button>
                <button type="button" onClick={() => handleSubmit(undefined, true)} disabled={loading}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-xl text-sm flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <CheckCircle className="w-4 h-4" /> Encerrar e Enviar Contrato
                </button>
              </>
            ) : (
              <button type="submit" disabled={loading}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-xl text-sm flex items-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {modoReal === 'criar'         && 'Criar e Notificar Analista'}
                {modoReal === 'analise'       && <><CheckCircle className="w-4 h-4" /> Concluir Análise</>}
                {modoReal === 'contrato_info' && <><FileText className="w-4 h-4" /> Salvar Contrato e Notificar Financeiro</>}
                {modoReal === 'financeiro'    && (
                  (!projeto?.contrato?.valorTotal || Number(projeto?.contrato?.valorTotal) <= 0)
                    ? <><ArrowRight className="w-4 h-4" /> Liberar para Operacional</>
                    : <><DollarSign className="w-4 h-4" /> Confirmar Recebimento</>
                )}
                {modoReal === 'operacional'   && <><ArrowRight className="w-4 h-4" /> Atribuir e Iniciar</>}
                {modoReal === 'editar'        && 'Salvar Alterações'}
              </button>
            )}
            </div>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .input-field {
          width: 100%;
          padding: 0.625rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          background: white;
          outline: none;
          transition: box-shadow 0.15s, border-color 0.15s;
        }
        .input-field:focus {
          border-color: transparent;
          box-shadow: 0 0 0 2px #22c55e;
        }
        .input-field-error {
          border-color: #ef4444 !important;
          background-color: #fff5f5;
        }
        .input-field-error:focus {
          box-shadow: 0 0 0 2px #ef4444;
        }
      `}</style>
    </div>
  )
}
