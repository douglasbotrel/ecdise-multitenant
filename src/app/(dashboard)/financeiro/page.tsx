'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  DollarSign, AlertTriangle, CheckCircle, Clock,
  ChevronDown, ChevronRight, Upload, X, ArrowRight, ShieldAlert, AlertCircle, Check,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_PAG: Record<string, string> = {
  PENDENTE: 'Pendente', PAGO: 'Pago', VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado', PARCIAL: 'Parcial',
}
const PAG_COLORS: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800', PAGO: 'bg-green-100 text-green-800',
  VENCIDO: 'bg-red-100 text-red-800', CANCELADO: 'bg-gray-100 text-gray-600',
  PARCIAL: 'bg-orange-100 text-orange-800',
}
const FORMAS_PAGAMENTO = [
  'PIX', 'Transferência Bancária', 'Cartão de Crédito',
  'Cartão de Débito', 'Dinheiro', 'Cheque', 'Boleto',
]

interface ModalPagData {
  id: string
  descricao: string
  valor: number
  contratoId: string
  projetoId?: string
}

export default function FinanceiroPage() {
  const [pagamentos, setPagamentos]   = useState<any[]>([])
  const [totais, setTotais]           = useState({ totalPendente: 0, totalPago: 0, totalVencido: 0 })
  const [loading, setLoading]         = useState(true)
  const [filtro, setFiltro]           = useState('')
  const [expandidos, setExpandidos]   = useState<Set<string>>(new Set())
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Modal liberação sem pagamento (ADM)
  const [modalLiberar, setModalLiberar] = useState<{ projetoId: string; codigo: string; clienteNome: string } | null>(null)
  const [motivoLiberar, setMotivoLiberar] = useState('')
  const [liberando, setLiberando]         = useState(false)

  // Modal pagamento
  const [modalPag, setModalPag]       = useState<ModalPagData | null>(null)
  const [formPag, setFormPag]         = useState({
    dataPagamento: new Date().toISOString().split('T')[0],
    formaPagamento: 'PIX',
    observacoes: '',
    valorRecebido: '',
  })

  // Modal aprovação ADM
  const [modalAprovar, setModalAprovar] = useState<{ id: string; valor: number; valorRecebido: number; residual: number } | null>(null)
  const [motivoAprovar, setMotivoAprovar] = useState('')
  const [aprovando, setAprovando]         = useState(false)
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [salvando, setSalvando]       = useState(false)
  const inputFileRef                  = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtro) params.set('status', filtro)
      const res = await fetch(`/api/pagamentos?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPagamentos(data.pagamentos)
      setTotais(data.totais)
    } catch { toast.error('Erro ao carregar financeiro') }
    finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUser(d.usuario || null))
  }, [])

  const isAdmin = ['ADMIN', 'GESTOR_GERAL'].includes(currentUser?.role)

  // ── Group by contrato ──────────────────────────────────────
  type GrupoContrato = { contrato: any; pagamentos: any[] }
  const grupos: Record<string, GrupoContrato> = pagamentos.reduce<Record<string, GrupoContrato>>((acc, p) => {
    const key = p.contratoId
    if (!acc[key]) acc[key] = { contrato: p.contrato, pagamentos: [] }
    acc[key].pagamentos.push(p)
    return acc
  }, {})

  function toggleExpand(key: string) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function abrirModal(p: any) {
    setModalPag({
      id: p.id,
      descricao: p.descricao || '',
      valor: p.valor,
      contratoId: p.contratoId,
      projetoId: p.contrato?.projeto?.id,
    })
    setFormPag({
      dataPagamento: new Date().toISOString().split('T')[0],
      formaPagamento: 'PIX',
      observacoes: '',
      valorRecebido: String(p.valor),
    })
    setComprovante(null)
  }

  async function aprovarAjuste() {
    if (!modalAprovar || !motivoAprovar.trim()) return
    setAprovando(true)
    try {
      const res = await fetch('/api/pagamentos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modalAprovar.id, motivoAjuste: motivoAprovar, aprovadoAdm: true }),
      })
      if (!res.ok) throw new Error()
      toast.success('Ajuste aprovado e registrado!')
      setModalAprovar(null)
      setMotivoAprovar('')
      load()
    } catch { toast.error('Erro ao aprovar ajuste') }
    finally { setAprovando(false) }
  }

  async function registrarPagamento() {
    if (!modalPag) return
    setSalvando(true)
    try {
      let comprovanteUrl: string | undefined

      if (comprovante) {
        const fd = new FormData()
        fd.append('arquivo', comprovante)
        fd.append('tipo', 'pagamento')
        if (modalPag.projetoId) fd.append('projetoId', modalPag.projetoId)
        fd.append('categoria', 'COMPROVANTE')
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (upRes.ok) comprovanteUrl = (await upRes.json()).url
      }

      const res = await fetch('/api/pagamentos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modalPag.id,
          status: 'PAGO',
          valorRecebido: parseFloat(formPag.valorRecebido) || modalPag.valor,
          dataPagamento: formPag.dataPagamento,
          formaPagamento: formPag.formaPagamento,
          ...(formPag.observacoes && { observacoes: formPag.observacoes }),
          ...(comprovanteUrl  && { comprovante: comprovanteUrl }),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Pagamento registrado!')
      setModalPag(null)
      load()
    } catch { toast.error('Erro ao registrar pagamento') }
    finally { setSalvando(false) }
  }

  async function liberarSemPagamento() {
    if (!modalLiberar) return
    setLiberando(true)
    try {
      const res = await fetch(`/api/projetos/${modalLiberar.projetoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liberarSemPagamento: true, motivo: motivoLiberar }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro ao liberar'); return }
      toast.success('Projeto liberado para Operacional!')
      setModalLiberar(null)
      setMotivoLiberar('')
      load()
    } catch { toast.error('Erro ao liberar projeto') }
    finally { setLiberando(false) }
  }

  function grupoStatus(pags: any[]) {
    if (pags.every(p => p.status === 'PAGO')) return 'PAGO'
    if (pags.some(p => p.status === 'PENDENTE' && new Date(p.dataVencimento) < new Date())) return 'VENCIDO'
    return 'PENDENTE'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-gray-500 text-sm mt-1">Controle de recebimentos por projeto</p>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'A Receber', value: totais.totalPendente, color: 'yellow', Icon: Clock },
          { label: 'Recebido',  value: totais.totalPago,     color: 'green',  Icon: CheckCircle },
          { label: 'Vencido',   value: totais.totalVencido,  color: 'red',    Icon: AlertTriangle },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 bg-${color}-100 rounded-xl flex items-center justify-center`}>
              <Icon className={`w-6 h-6 text-${color}-600`} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className={`text-xl font-bold ${color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCurrency(value)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['', ...Object.keys(STATUS_PAG)].map(s => (
          <button
            key={s}
            onClick={() => setFiltro(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtro === s ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {s ? STATUS_PAG[s] : 'Todos'}
          </button>
        ))}
      </div>

      {/* Grupos por projeto */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-40 bg-white rounded-2xl border border-gray-100">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : Object.keys(grupos).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-12 text-gray-400">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum pagamento encontrado</p>
          </div>
        ) : (
          (Object.entries(grupos) as [string, GrupoContrato][]).map(([key, grupo]) => {
            const { contrato, pagamentos: pags } = grupo
            const expanded    = expandidos.has(key)
            const pagos       = pags.filter(p => p.status === 'PAGO').length
            const totalValor  = pags.reduce((s, p) => s + p.valor, 0)
            const totalPago   = pags.filter(p => p.status === 'PAGO').reduce((s, p) => s + p.valor, 0)
            const status      = grupoStatus(pags)
            const primeiroPendente = pags.find(p => p.status === 'PENDENTE')

            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Summary row */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
                  onClick={() => toggleExpand(key)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${expanded ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {expanded
                        ? <ChevronDown  className="w-4 h-4 text-green-600" />
                        : <ChevronRight className="w-4 h-4 text-gray-500" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-gray-900">{contrato?.projeto?.codigo}</span>
                        <span className="text-sm text-gray-700 truncate">{contrato?.cliente?.nome}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{contrato?.projeto?.tipoServico}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400">Recebido</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(totalPago)}
                        <span className="text-gray-400 font-normal"> / {formatCurrency(totalValor)}</span>
                      </p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-gray-400">{pags.length === 1 ? 'Pagamento' : 'Parcelas'}</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {pags.length === 1 ? (pagos === 1 ? 'Pago' : 'Único') : `${pagos}/${pags.length}`}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PAG_COLORS[status]}`}>
                      {STATUS_PAG[status]}
                    </span>
                    {primeiroPendente && (
                      <button
                        onClick={e => { e.stopPropagation(); abrirModal(primeiroPendente) }}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                      >
                        <ArrowRight className="w-3.5 h-3.5" /> Registrar
                      </button>
                    )}
                    {/* Botão ADM: liberar sem pagamento */}
                    {isAdmin && contrato?.projeto?.etapaPipeline === 'AGUARDANDO_SINAL' && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setMotivoLiberar('')
                          setModalLiberar({
                            projetoId: contrato.projeto.id,
                            codigo: contrato.projeto.codigo,
                            clienteNome: contrato.cliente?.nome || '',
                          })
                        }}
                        className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                        title="Liberar para Operacional sem pagamento (apenas ADM)"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Liberar sem pgto.
                      </button>
                    )}
                  </div>
                </div>

                {/* Detail rows */}
                {expanded && (
                  <div className="border-t border-gray-100">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/80">
                          <th className="text-left text-xs font-medium text-gray-400 px-5 py-2.5 pl-16">Descrição</th>
                          <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Valor</th>
                          <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Vencimento</th>
                          <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Forma</th>
                          <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Status</th>
                          <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pags.map(p => {
                          const vencido = p.status === 'PENDENTE' && new Date(p.dataVencimento) < new Date()
                          return (
                            <tr key={p.id} className={`${vencido ? 'bg-red-50/30' : ''} hover:bg-gray-50/50 transition-colors`}>
                              <td className="px-5 py-3 pl-16 text-sm text-gray-700">{p.descricao}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(p.valor)}</td>
                              <td className="px-4 py-3">
                                <span className={`text-sm ${vencido ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                  {formatDate(p.dataVencimento)}{vencido && ' ⚠️'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{p.formaPagamento || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PAG_COLORS[p.status]}`}>
                                  {STATUS_PAG[p.status]}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {p.status === 'PENDENTE' && (
                                  <button
                                    onClick={() => abrirModal(p)}
                                    className="text-xs font-medium text-green-600 hover:text-green-700 px-3 py-1.5 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                                  >
                                    Registrar
                                  </button>
                                )}
                                {p.status === 'PARCIAL' && (
                                  <div className="space-y-1">
                                    <p className="text-xs text-orange-700">
                                      Recebido: <strong>{formatCurrency(p.valorRecebido)}</strong>
                                      {' · '}Residual: <strong>{formatCurrency(p.residual)}</strong>
                                    </p>
                                    {p.aprovadoAdm ? (
                                      <div className="flex items-center gap-1 text-xs text-green-700">
                                        <Check className="w-3 h-3" />
                                        <span>ADM: {p.motivoAjuste}</span>
                                      </div>
                                    ) : isAdmin ? (
                                      <button
                                        onClick={() => { setModalAprovar({ id: p.id, valor: p.valor, valorRecebido: p.valorRecebido, residual: p.residual }); setMotivoAprovar('') }}
                                        className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-800 px-2 py-1 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
                                      >
                                        <ShieldAlert className="w-3 h-3" /> Aprovar ajuste
                                      </button>
                                    ) : (
                                      <span className="text-xs text-orange-500 italic">Aguardando aprovação ADM</span>
                                    )}
                                  </div>
                                )}
                                {p.status === 'PAGO' && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-gray-400">
                                      {p.dataPagamento ? formatDate(p.dataPagamento) : ''}
                                    </span>
                                    {p.comprovante && (
                                      <a
                                        href={p.comprovante}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-blue-500 hover:underline"
                                      >
                                        Ver comprovante
                                      </a>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Modal ADM: liberar sem pagamento ────────────────── */}
      {modalLiberar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-orange-100 bg-orange-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Liberar sem Pagamento</h2>
                  <p className="text-xs text-orange-700 font-medium">Ação exclusiva do ADM</p>
                </div>
              </div>
              <button onClick={() => setModalLiberar(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <p className="text-gray-500 text-xs mb-1">Projeto</p>
                <p className="font-semibold text-gray-900">
                  <span className="font-mono text-gray-500 mr-2">{modalLiberar.codigo}</span>
                  {modalLiberar.clienteNome}
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800 leading-relaxed">
                ⚠️ Este projeto será <strong>liberado imediatamente para Operacional</strong> sem que o primeiro pagamento seja confirmado. O financeiro continuará com as parcelas pendentes.
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Motivo da liberação <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivoLiberar}
                  onChange={e => setMotivoLiberar(e.target.value)}
                  rows={3}
                  placeholder="Ex: Cliente solicitou início imediato, pagamento pendente de compensação bancária..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                  autoFocus
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setModalLiberar(null)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={liberarSemPagamento}
                disabled={liberando || !motivoLiberar.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {liberando
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <ShieldAlert className="w-4 h-4" />
                }
                Confirmar Liberação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ADM: aprovar ajuste parcial ───────────────── */}
      {modalAprovar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-orange-100 bg-orange-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Aprovar Ajuste de Pagamento</h2>
                  <p className="text-xs text-orange-700 font-medium">Ação exclusiva do ADM</p>
                </div>
              </div>
              <button onClick={() => setModalAprovar(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Valor esperado</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(modalAprovar.valor)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Recebido</p>
                  <p className="text-sm font-bold text-green-700">{formatCurrency(modalAprovar.valorRecebido)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Residual</p>
                  <p className="text-sm font-bold text-orange-600">{formatCurrency(modalAprovar.residual)}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Motivo do ajuste <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivoAprovar}
                  onChange={e => setMotivoAprovar(e.target.value)}
                  rows={3}
                  placeholder="Ex: Cliente negociou desconto de R$500 por antecipação. Residual a acertar em 30 dias."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setModalAprovar(null)} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={aprovarAjuste}
                disabled={aprovando || !motivoAprovar.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {aprovando
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check className="w-4 h-4" />
                }
                Confirmar Aprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de pagamento ───────────────────────────────── */}
      {modalPag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Registrar Pagamento</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {modalPag.descricao} — {formatCurrency(modalPag.valor)}
                </p>
              </div>
              <button onClick={() => setModalPag(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* Valor recebido */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Valor recebido <span className="text-gray-400 font-normal">(esperado: {formatCurrency(modalPag.valor)})</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formPag.valorRecebido}
                  onChange={e => setFormPag(f => ({ ...f, valorRecebido: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {(() => {
                  const vr = parseFloat(formPag.valorRecebido)
                  const residual = modalPag.valor - vr
                  if (!isNaN(vr) && residual > 0.01) {
                    return (
                      <div className="mt-2 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                        <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-orange-700">
                          Pagamento <strong>parcial</strong>. Residual de <strong>{formatCurrency(residual)}</strong> ficará pendente e precisará de aprovação do ADM.
                        </p>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Data do Pagamento</label>
                <input
                  type="date"
                  value={formPag.dataPagamento}
                  onChange={e => setFormPag(f => ({ ...f, dataPagamento: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Forma de Pagamento</label>
                <select
                  value={formPag.formaPagamento}
                  onChange={e => setFormPag(f => ({ ...f, formaPagamento: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                </select>
              </div>

              {/* Comprovante upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Comprovante (opcional)</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
                  onClick={() => inputFileRef.current?.click()}
                >
                  {comprovante ? (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate max-w-[200px]">{comprovante.name}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setComprovante(null) }}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-5 h-5 mx-auto text-gray-300 mb-1" />
                      <p className="text-xs text-gray-400">Clique para enviar PDF, imagem ou planilha</p>
                    </div>
                  )}
                </div>
                <input
                  ref={inputFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                  onChange={e => setComprovante(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observações (opcional)</label>
                <textarea
                  value={formPag.observacoes}
                  onChange={e => setFormPag(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                  placeholder="Ex: Referente ao sinal do contrato..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Se for o <strong>1º pagamento</strong> do projeto, ele avança automaticamente para
                  a fila <strong>Operacional</strong> e a equipe técnica é notificada.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setModalPag(null)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={registrarPagamento}
                disabled={salvando}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {salvando
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <CheckCircle className="w-4 h-4" />
                }
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
