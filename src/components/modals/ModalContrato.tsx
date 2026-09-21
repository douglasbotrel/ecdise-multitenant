'use client'

import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ModalContratoProps {
  open: boolean
  onClose: () => void
  onSalvo: () => void
}

export function ModalContrato({ open, onClose, onSalvo }: ModalContratoProps) {
  useLockBodyScroll(open)
  const [projetos, setProjetos]   = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [erros, setErros]         = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    projetoId:     '',
    clienteId:     '',
    tipoContrato:  'Serviço Ambiental',
    dataAssinatura:'',
    dataVencimento:'',
    valorTotal:    '',
    valorSinal:    '',
    numeroParcelas:'1',
    observacoes:   '',
  })

  useEffect(() => {
    if (open) {
      loadProjetos()
      setErros({})
      setForm({
        projetoId: '', clienteId: '', tipoContrato: 'Serviço Ambiental',
        dataAssinatura: '', dataVencimento: '',
        valorTotal: '', valorSinal: '', numeroParcelas: '1', observacoes: '',
      })
    }
  }, [open])

  async function loadProjetos() {
    const res = await fetch('/api/projetos?statusComercial=ACEITO&limit=100')
    if (res.ok) {
      const data = await res.json()
      setProjetos(data.projetos.filter((p: any) => !p.contrato))
    }
  }

  function handleChange(field: string, value: string) {
    setErros(prev => ({ ...prev, [field]: '' }))
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-fill clienteId + valorTotal quando seleciona projeto
      if (field === 'projetoId') {
        const proj = projetos.find(p => p.id === value)
        if (proj) {
          next.clienteId  = proj.clienteId
          next.valorTotal = proj.valorProposto?.toString() || ''
        }
      }
      return next
    })
  }

  function validar(): boolean {
    const novosErros: Record<string, string> = {}

    if (!form.projetoId) {
      novosErros.projetoId = 'Selecione um projeto'
    }
    const vTotal = parseFloat(form.valorTotal)
    const temValor = form.valorTotal !== '' && !isNaN(vTotal)
    if (temValor && vTotal <= 0) {
      novosErros.valorTotal = 'Valor total deve ser maior que zero'
    }
    const vSinal = parseFloat(form.valorSinal || '0')
    if (vSinal < 0) {
      novosErros.valorSinal = 'Valor do sinal não pode ser negativo'
    }
    if (temValor && vSinal > vTotal) {
      novosErros.valorSinal = 'Sinal não pode ser maior que o valor total'
    }
    const nParcelas = parseInt(form.numeroParcelas)
    if (!form.numeroParcelas || isNaN(nParcelas) || nParcelas < 1) {
      novosErros.numeroParcelas = 'Mínimo 1 parcela'
    }
    if (form.dataAssinatura && form.dataVencimento) {
      if (new Date(form.dataVencimento) <= new Date(form.dataAssinatura)) {
        novosErros.dataVencimento = 'Vencimento deve ser posterior à assinatura'
      }
    }

    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return

    setLoading(true)
    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erro ao criar contrato')
        return
      }
      const data = await res.json()
      const semValor = !form.valorTotal || parseFloat(form.valorTotal) <= 0
      if (semValor && data.avancouPipeline) {
        toast.success('Contrato criado! Projeto liberado para Operacional. Defina o valor depois.')
      } else if (semValor) {
        toast.success('Contrato criado! ADM deverá definir o valor depois.')
      } else {
        toast.success('Contrato criado com parcelas geradas!')
      }
      onSalvo()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const proj      = projetos.find(p => p.id === form.projetoId)
  const vTotal    = parseFloat(form.valorTotal    || '0') || 0
  const vSinal    = parseFloat(form.valorSinal    || '0') || 0
  const nParcelas = parseInt(form.numeroParcelas  || '1') || 1
  const vRestante = Math.max(0, vTotal - vSinal)
  const vParcela  = nParcelas > 0 ? vRestante / nParcelas : 0

  function campo(label: string, children: React.ReactNode, erro?: string, obrigatorio = false) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}{obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
        {erro && (
          <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />{erro}
          </p>
        )}
      </div>
    )
  }

  const inputClass = (err?: string) =>
    `w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 text-sm ${
      err ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-green-500'
    }`

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
          <h2 className="text-lg font-semibold text-gray-900">Novo Contrato</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Projeto */}
          {campo('Projeto (aceito)', (
            <select
              value={form.projetoId}
              onChange={e => handleChange('projetoId', e.target.value)}
              className={inputClass(erros.projetoId) + ' bg-white'}
            >
              <option value="">Selecione um projeto...</option>
              {projetos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.cliente?.nome} — {p.tipoServico}
                </option>
              ))}
            </select>
          ), erros.projetoId, true)}

          {proj && (
            <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-xs text-blue-700 space-y-0.5">
              <p><span className="font-semibold">Cliente:</span> {proj.cliente?.nome}</p>
              <p><span className="font-semibold">Município:</span> {proj.municipio || '—'}</p>
              {proj.valorProposto > 0 && (
                <p><span className="font-semibold">Valor proposto:</span> {formatCurrency(proj.valorProposto)}</p>
              )}
            </div>
          )}

          {/* Tipo */}
          {campo('Tipo de Contrato', (
            <input
              type="text"
              value={form.tipoContrato}
              onChange={e => handleChange('tipoContrato', e.target.value)}
              className={inputClass()}
            />
          ))}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            {campo('Data de Assinatura', (
              <input
                type="date"
                value={form.dataAssinatura}
                onChange={e => handleChange('dataAssinatura', e.target.value)}
                className={inputClass()}
              />
            ))}
            {campo('Data de Vencimento', (
              <input
                type="date"
                value={form.dataVencimento}
                onChange={e => handleChange('dataVencimento', e.target.value)}
                className={inputClass(erros.dataVencimento)}
              />
            ), erros.dataVencimento)}
          </div>

          {/* Valores financeiros */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Valores financeiros</p>

            <div className="grid grid-cols-2 gap-3">
              {campo('Valor Total (R$)', (
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.valorTotal}
                  onChange={e => handleChange('valorTotal', e.target.value)}
                  placeholder="Deixar em branco para definir depois"
                  className={inputClass(erros.valorTotal)}
                />
              ), erros.valorTotal)}

              {campo('Valor do Sinal (R$)', (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valorSinal}
                  onChange={e => handleChange('valorSinal', e.target.value)}
                  placeholder="0,00"
                  className={inputClass(erros.valorSinal)}
                />
              ), erros.valorSinal)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {campo('Nº de Parcelas', (
                <input
                  type="number"
                  min="1"
                  value={form.numeroParcelas}
                  onChange={e => handleChange('numeroParcelas', e.target.value)}
                  className={inputClass(erros.numeroParcelas)}
                />
              ), erros.numeroParcelas, true)}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor por Parcela</label>
                <div className="w-full px-4 py-2.5 border border-gray-100 rounded-xl bg-white text-sm text-gray-500 font-medium">
                  {vTotal > 0 ? formatCurrency(vParcela) : '—'}
                </div>
              </div>
            </div>

            {/* Preview do parcelamento */}
            {vTotal > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-green-700">Resumo do parcelamento</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center bg-white rounded-lg py-1.5 px-2">
                    <p className="text-gray-400">Sinal</p>
                    <p className="font-bold text-gray-900">{formatCurrency(vSinal)}</p>
                  </div>
                  <div className="text-center bg-white rounded-lg py-1.5 px-2">
                    <p className="text-gray-400">Restante</p>
                    <p className="font-bold text-gray-900">{formatCurrency(vRestante)}</p>
                  </div>
                  <div className="text-center bg-white rounded-lg py-1.5 px-2">
                    <p className="text-gray-400">{nParcelas}x de</p>
                    <p className="font-bold text-green-700">{formatCurrency(vParcela)}</p>
                  </div>
                </div>
                {vSinal > vTotal && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Sinal maior que o valor total
                  </p>
                )}
              </div>
            )}

            {!form.valorTotal && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Sem valor definido — o contrato será criado como <strong>Valor a Definir</strong>. Um ADM poderá preencher o valor depois para gerar as parcelas.</span>
              </div>
            )}
          </div>

          {/* Observações */}
          {campo('Observações', (
            <textarea
              value={form.observacoes}
              onChange={e => handleChange('observacoes', e.target.value)}
              rows={2}
              className={inputClass() + ' resize-none'}
            />
          ))}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar Contrato
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
