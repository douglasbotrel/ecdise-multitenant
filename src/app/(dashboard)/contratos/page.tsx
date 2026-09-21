'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'
import { toast } from 'sonner'
import { Plus, FileText, Clock, AlertCircle, X, Upload, CheckCircle2, XCircle, Loader2, Edit2, Save } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { ModalContrato } from '@/components/modals/ModalContrato'
import { ModalProjeto } from '@/components/modals/ModalProjeto'

const STATUS_CONTRATO_LABELS: Record<string, string> = {
  ATIVO: 'Ativo', ASSINADO: 'Assinado', AGUARDANDO_ASSINATURA: 'Aguard. Assinatura',
  FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado', SUSPENSO: 'Suspenso',
  DESISTENCIA: 'Desistência',
}
const STATUS_CONTRATO_COLORS: Record<string, string> = {
  ATIVO: 'bg-blue-100 text-blue-800', ASSINADO: 'bg-green-100 text-green-800',
  AGUARDANDO_ASSINATURA: 'bg-yellow-100 text-yellow-800',
  FINALIZADO: 'bg-gray-100 text-gray-800', CANCELADO: 'bg-red-100 text-red-800',
  SUSPENSO: 'bg-orange-100 text-orange-800', DESISTENCIA: 'bg-red-100 text-red-800',
}

// Form de edição de dados do contrato
interface FormEdicao {
  tipoContrato: string
  valorTotal: string
  valorSinal: string
  numeroParcelas: string
  valorParcela: string
  dataVencimento: string
  dataAssinatura: string
  observacoes: string
}

function formFromContrato(c: any): FormEdicao {
  return {
    tipoContrato:  c.tipoContrato    || '',
    valorTotal:    c.valorTotal      != null ? String(c.valorTotal)    : '',
    valorSinal:    c.valorSinal      != null ? String(c.valorSinal)    : '',
    numeroParcelas:c.numeroParcelas  != null ? String(c.numeroParcelas): '',
    valorParcela:  c.valorParcela    != null ? String(c.valorParcela)  : '',
    dataVencimento:c.dataVencimento  ? c.dataVencimento.split('T')[0]  : '',
    dataAssinatura:c.dataAssinatura  ? c.dataAssinatura.split('T')[0]  : '',
    observacoes:   c.observacoes     || '',
  }
}

export default function ContratosPage() {
  const [contratos, setContratos]                   = useState<any[]>([])
  const [projetosAguardando, setProjetosAguardando] = useState<any[]>([])
  const [loading, setLoading]                       = useState(true)
  const [modalOpen, setModalOpen]                   = useState(false)
  const [filtroStatus, setFiltroStatus]             = useState('')
  // Modal de elaboração de contrato
  const [projetoSelecionado, setProjetoSelecionado] = useState<any | null>(null)
  const [modalProjetoOpen, setModalProjetoOpen]     = useState(false)
  // Popup de ações no contrato
  const [contratoAcao, setContratoAcao]             = useState<any | null>(null)
  useLockBodyScroll(!!contratoAcao)
  const [uploading, setUploading]                   = useState(false)
  const [confirmDesistencia, setConfirmDesistencia] = useState(false)
  const [salvandoAcao, setSalvandoAcao]             = useState(false)
  // Modo edição de dados no popup
  const [editandoDados, setEditandoDados]           = useState(false)
  const [formEdicao, setFormEdicao]                 = useState<FormEdicao | null>(null)
  const [salvandoEdicao, setSalvandoEdicao]         = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [resContratos, resProjetos] = await Promise.all([
        fetch(`/api/contratos${filtroStatus ? `?statusContrato=${filtroStatus}` : ''}`),
        fetch('/api/projetos?etapaPipeline=AGUARDANDO_CONTRATO&limit=50'),
      ])
      if (resContratos.ok) setContratos((await resContratos.json()).contratos)
      if (resProjetos.ok)  setProjetosAguardando((await resProjetos.json()).projetos)
    } catch { toast.error('Erro ao carregar dados') }
    finally { setLoading(false) }
  }, [filtroStatus])

  useEffect(() => { load() }, [load])

  function abrirPopup(c: any) {
    setContratoAcao(c)
    setConfirmDesistencia(false)
    setEditandoDados(false)
    setFormEdicao(formFromContrato(c))
  }

  function fecharPopup() {
    setContratoAcao(null)
    setConfirmDesistencia(false)
    setEditandoDados(false)
    setFormEdicao(null)
  }

  function abrirElaboracao(projeto: any) {
    setProjetoSelecionado(projeto)
    setModalProjetoOpen(true)
  }

  async function uploadDocumentoAssinado(file: File): Promise<string | null> {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tipo', 'contrato')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const d = await res.json()
      return d.url
    } catch {
      toast.error('Erro ao enviar documento')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function marcarAssinado() {
    if (!contratoAcao) return
    const file = fileRef.current?.files?.[0]
    setSalvandoAcao(true)
    try {
      let arquivoUrl = contratoAcao.arquivoUrl
      if (file) {
        arquivoUrl = await uploadDocumentoAssinado(file)
        if (!arquivoUrl) { setSalvandoAcao(false); return }
      }
      const res = await fetch(`/api/contratos/${contratoAcao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusContrato: 'ASSINADO', arquivoUrl }),
      })
      if (!res.ok) { toast.error('Erro ao atualizar'); return }
      toast.success('Contrato marcado como assinado!')
      fecharPopup()
      load()
    } finally { setSalvandoAcao(false) }
  }

  async function marcarDesistencia() {
    if (!contratoAcao) return
    setSalvandoAcao(true)
    try {
      const res = await fetch(`/api/contratos/${contratoAcao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusContrato: 'DESISTENCIA' }),
      })
      if (!res.ok) { toast.error('Erro ao registrar desistência'); return }
      toast.success('Desistência registrada. Projeto movido para base de dados.')
      fecharPopup()
      load()
    } finally { setSalvandoAcao(false) }
  }

  async function salvarEdicao() {
    if (!contratoAcao || !formEdicao) return
    setSalvandoEdicao(true)
    try {
      const body: any = {
        tipoContrato:   formEdicao.tipoContrato   || undefined,
        observacoes:    formEdicao.observacoes,
        dataVencimento: formEdicao.dataVencimento || null,
        dataAssinatura: formEdicao.dataAssinatura || null,
      }
      if (formEdicao.valorTotal)     body.valorTotal     = parseFloat(formEdicao.valorTotal.replace(',', '.'))
      if (formEdicao.valorSinal)     body.valorSinal     = parseFloat(formEdicao.valorSinal.replace(',', '.'))
      if (formEdicao.numeroParcelas) body.numeroParcelas = parseInt(formEdicao.numeroParcelas)
      if (formEdicao.valorParcela)   body.valorParcela   = parseFloat(formEdicao.valorParcela.replace(',', '.'))

      const res = await fetch(`/api/contratos/${contratoAcao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error('Erro ao salvar'); return }
      const resData = await res.json()
      toast.success(resData.parcelasGeradas
        ? 'Valor definido e parcelas geradas com sucesso!'
        : 'Dados do contrato atualizados!'
      )
      setEditandoDados(false)
      fecharPopup()
      load()
    } finally { setSalvandoEdicao(false) }
  }

  // Totais
  const valorTotal = contratos.reduce((s, c) => s + (c.valorTotal || 0), 0)
  const ativos     = contratos.filter(c => ['ATIVO', 'ASSINADO'].includes(c.statusContrato)).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Contratos</h1>
          <p className="text-gray-500 text-sm mt-1">{contratos.length} contrato(s)</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Contrato
        </button>
      </div>

      {/* ── FILA: Projetos aguardando elaboração de contrato ──────── */}
      {projetosAguardando.length > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-pink-200">
            <AlertCircle className="w-4 h-4 text-pink-600" />
            <p className="text-sm font-semibold text-pink-800">
              {projetosAguardando.length} projeto(s) aguardando elaboração de contrato
            </p>
          </div>
          <div className="divide-y divide-pink-100">
            {projetosAguardando.map(p => {
              const servicos = p.servicosContratados
                ? (() => { try { return JSON.parse(p.servicosContratados) } catch { return [] } })()
                : []
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-pink-100/50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 bg-pink-200 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-pink-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-pink-600 font-medium">{p.codigo}</span>
                        <span className="text-sm font-semibold text-gray-900 truncate">{p.imovelNome || p.tipoServico}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500">{p.cliente?.nome}</span>
                        {servicos.length > 0 && (
                          <div className="flex gap-1">
                            {servicos.slice(0, 2).map((s: string) => (
                              <span key={s} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">{s}</span>
                            ))}
                            {servicos.length > 2 && <span className="text-xs text-gray-400">+{servicos.length - 2}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {p.valorSinal > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-400">Sinal</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.valorSinal)}</p>
                      </div>
                    )}
                    <button
                      onClick={() => abrirElaboracao(p)}
                      className="flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" /> Elaborar Contrato
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Total de Contratos</p>
          <p className="text-2xl font-bold text-gray-900">{contratos.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Contratos Ativos</p>
          <p className="text-2xl font-bold text-green-600">{ativos}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Valor Total</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(valorTotal)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroStatus('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!filtroStatus ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          Todos
        </button>
        {Object.entries(STATUS_CONTRATO_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFiltroStatus(k)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filtroStatus === k ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : contratos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <FileText className="w-10 h-10 mb-2 opacity-40" />
            <p>Nenhum contrato encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Código</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Projeto</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Tipo</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Valor Total</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Assinatura</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Parcelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contratos.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => abrirPopup(c)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-900">{c.codigo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{c.cliente?.nome}</p>
                      <p className="text-xs text-gray-400">{c.cliente?.cpfCnpj}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500">{c.projeto?.codigo}</span>
                      <p className="text-xs text-gray-400">{c.projeto?.tipoServico}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{c.tipoContrato}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(c.valorTotal)}</p>
                      <p className="text-xs text-gray-400">Sinal: {formatCurrency(c.valorSinal)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.dataAssinatura)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CONTRATO_COLORS[c.statusContrato]}`}>
                        {STATUS_CONTRATO_LABELS[c.statusContrato]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.numeroParcelas === 1
                        ? (c.pagamentos?.some((p: any) => p.status === 'PAGO') ? 'Pago' : 'Pagamento único')
                        : `${c.pagamentos?.filter((p: any) => p.status === 'PAGO').length || 0}/${c.numeroParcelas}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalContrato
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSalvo={() => { setModalOpen(false); load() }}
      />

      <ModalProjeto
        open={modalProjetoOpen}
        onClose={() => { setModalProjetoOpen(false); setProjetoSelecionado(null) }}
        projeto={projetoSelecionado}
        modoAcao="contrato_info"
        onSalvo={() => { setModalProjetoOpen(false); setProjetoSelecionado(null); load() }}
      />

      {/* ── Popup de ações do contrato ─────────────────────── */}
      {contratoAcao && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={fecharPopup}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <p className="font-bold text-gray-900">{contratoAcao.codigo}</p>
                <p className="text-xs text-gray-400">{contratoAcao.cliente?.nome} · {contratoAcao.projeto?.codigo}</p>
              </div>
              <button onClick={fecharPopup} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Info resumida */}
              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Status</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CONTRATO_COLORS[contratoAcao.statusContrato]}`}>
                    {STATUS_CONTRATO_LABELS[contratoAcao.statusContrato]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tipo</span>
                  <span className="text-gray-800 font-medium">{contratoAcao.tipoContrato || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor Total</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(contratoAcao.valorTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sinal</span>
                  <span className="text-gray-700">{formatCurrency(contratoAcao.valorSinal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Parcelas</span>
                  <span className="text-gray-700">{contratoAcao.numeroParcelas || '—'} × {formatCurrency(contratoAcao.valorParcela)}</span>
                </div>
                {contratoAcao.dataAssinatura && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Assinado em</span>
                    <span className="text-gray-900">{formatDate(contratoAcao.dataAssinatura)}</span>
                  </div>
                )}
                {contratoAcao.dataVencimento && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vencimento</span>
                    <span className="text-gray-900">{formatDate(contratoAcao.dataVencimento)}</span>
                  </div>
                )}
                {contratoAcao.arquivoUrl && (
                  <a
                    href={contratoAcao.arquivoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-xs font-medium pt-1"
                  >
                    <FileText className="w-3.5 h-3.5" /> Ver documento assinado
                  </a>
                )}
              </div>

              {/* ── EDITAR / COMPLEMENTAR DADOS ───────────────────── */}
              {!['DESISTENCIA', 'CANCELADO', 'FINALIZADO'].includes(contratoAcao.statusContrato) && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {!editandoDados && (
                    <div className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm bg-gray-50">
                      <span className="flex items-center gap-2 text-gray-500">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        Valores e dados podem ser ajustados aqui — o valor negociado pode ficar acima ou abaixo do sugerido.
                      </span>
                      <button
                        onClick={() => setEditandoDados(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex-shrink-0"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Editar valores
                      </button>
                    </div>
                  )}

                  {editandoDados && formEdicao && (() => {
                    const vTotal    = parseFloat(formEdicao.valorTotal    || '0') || 0
                    const vSinal    = parseFloat(formEdicao.valorSinal    || '0') || 0
                    const nParcelas = parseInt(formEdicao.numeroParcelas  || '1') || 1
                    const vRestante = Math.max(0, vTotal - vSinal)
                    const vParcAuto = nParcelas > 0 ? vRestante / nParcelas : 0

                    function updateCalc(field: string, value: string) {
                      setFormEdicao(f => {
                        if (!f) return f
                        const next = { ...f, [field]: value }
                        const t = parseFloat(field === 'valorTotal'    ? value : next.valorTotal    || '0') || 0
                        const s = parseFloat(field === 'valorSinal'    ? value : next.valorSinal    || '0') || 0
                        const n = parseInt (field === 'numeroParcelas' ? value : next.numeroParcelas || '1') || 1
                        const restante = Math.max(0, t - s)
                        next.valorParcela = n > 0 ? (restante / n).toFixed(2) : '0'
                        return next
                      })
                    }

                    return (
                      <div className="p-4 space-y-3 bg-white">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Contrato</label>
                          <input
                            type="text"
                            value={formEdicao.tipoContrato}
                            onChange={e => setFormEdicao(f => f ? { ...f, tipoContrato: e.target.value } : f)}
                            placeholder="Ex: Prestação de Serviços"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>

                        <div className="border border-blue-100 rounded-xl p-3 space-y-3 bg-blue-50/30">
                          <p className="text-xs font-semibold text-blue-700">Valores financeiros</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Valor Total (R$) *</label>
                              <input type="number" step="0.01" min="0.01"
                                value={formEdicao.valorTotal}
                                onChange={e => updateCalc('valorTotal', e.target.value)}
                                placeholder="0,00"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Valor do Sinal (R$)</label>
                              <input type="number" step="0.01" min="0"
                                value={formEdicao.valorSinal}
                                onChange={e => updateCalc('valorSinal', e.target.value)}
                                placeholder="0,00"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Nº de Parcelas</label>
                              <input type="number" min="1"
                                value={formEdicao.numeroParcelas}
                                onChange={e => updateCalc('numeroParcelas', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Valor por Parcela</label>
                              <div className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm bg-white text-gray-500 font-medium">
                                {vTotal > 0 ? formatCurrency(vParcAuto) : '—'}
                              </div>
                            </div>
                          </div>
                          {vTotal > 0 && (
                            <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                              <div className="text-center bg-white rounded-lg py-1.5 px-2 border border-blue-100">
                                <p className="text-gray-400">Sinal</p>
                                <p className="font-bold text-gray-900">{formatCurrency(vSinal)}</p>
                              </div>
                              <div className="text-center bg-white rounded-lg py-1.5 px-2 border border-blue-100">
                                <p className="text-gray-400">Restante</p>
                                <p className="font-bold text-gray-900">{formatCurrency(vRestante)}</p>
                              </div>
                              <div className="text-center bg-white rounded-lg py-1.5 px-2 border border-blue-100">
                                <p className="text-gray-400">{nParcelas}x de</p>
                                <p className="font-bold text-blue-700">{formatCurrency(vParcAuto)}</p>
                              </div>
                            </div>
                          )}
                          {vSinal > vTotal && vTotal > 0 && (
                            <p className="text-xs text-red-600">Sinal não pode ser maior que o valor total</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Data de Assinatura</label>
                            <input type="date" value={formEdicao.dataAssinatura}
                              onChange={e => setFormEdicao(f => f ? { ...f, dataAssinatura: e.target.value } : f)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Data de Vencimento</label>
                            <input type="date" value={formEdicao.dataVencimento}
                              onChange={e => setFormEdicao(f => f ? { ...f, dataVencimento: e.target.value } : f)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                          <textarea rows={2} value={formEdicao.observacoes}
                            onChange={e => setFormEdicao(f => f ? { ...f, observacoes: e.target.value } : f)}
                            placeholder="Observações sobre o contrato..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button onClick={salvarEdicao}
                            disabled={salvandoEdicao || vTotal <= 0 || vSinal > vTotal}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors">
                            {salvandoEdicao ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar alterações
                          </button>
                          <button onClick={() => setEditandoDados(false)}
                            className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ── VALIDAR ASSINATURA ─────── */}
              {contratoAcao.statusContrato === 'AGUARDANDO_ASSINATURA' && (
                <div className="border border-green-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Validar Assinatura
                  </p>
                  <p className="text-xs text-gray-500">
                    Faça upload do contrato assinado pelo cliente para registrar como assinado.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer border border-dashed border-green-300 rounded-lg px-3 py-2.5 text-xs text-green-600 hover:bg-green-50 transition-colors">
                    <Upload className="w-4 h-4" />
                    {fileRef.current?.files?.[0]?.name || 'Selecionar documento assinado (PDF)'}
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={() => {}} />
                  </label>
                  <button onClick={marcarAssinado} disabled={salvandoAcao || uploading}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                    {(salvandoAcao || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Marcar como Assinado
                  </button>
                </div>
              )}

              {/* ── DESISTÊNCIA ───────────────────────────────────── */}
              {!['DESISTENCIA', 'CANCELADO', 'FINALIZADO'].includes(contratoAcao.statusContrato) && (
                <div className="border border-red-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Desistência do Proprietário
                  </p>
                  {!confirmDesistencia ? (
                    <button onClick={() => setConfirmDesistencia(true)}
                      className="w-full border border-red-300 text-red-600 hover:bg-red-50 font-medium py-2 rounded-xl text-sm transition-colors">
                      Registrar Desistência
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-red-600">
                        Tem certeza? O projeto será movido para a base de dados e não poderá avançar.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDesistencia(false)}
                          className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium py-2 rounded-xl text-sm transition-colors">
                          Cancelar
                        </button>
                        <button onClick={marcarDesistencia} disabled={salvandoAcao}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm transition-colors">
                          {salvandoAcao ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
