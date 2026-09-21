'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  MapPin, Calendar, Plus, Loader2, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Navigation
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const TIPO_GASTO_LABELS: Record<string, string> = {
  ALIMENTACAO: '🍽️ Alimentação', HOSPEDAGEM: '🏨 Hospedagem',
  COMBUSTIVEL: '⛽ Combustível', PEDAGIO: '🚧 Pedágio', OUTRO: '📎 Outro'
}

export default function TecnicoPage() {
  const [vistorias, setVistorias]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [expandido, setExpandido]   = useState<string | null>(null)
  const [salvando, setSalvando]     = useState<string | null>(null)

  // Formulário de saída / chegada por vistoria
  const [saidas, setSaidas]   = useState<Record<string, { km: string; dataSaida: string }>>({})
  const [chegadas, setChegadas] = useState<Record<string, { km: string; obs: string; manutencao: string }>>({})

  // Gasto rápido (+)
  const [gastoAberto, setGastoAberto] = useState<string | null>(null)
  const [formGasto, setFormGasto]     = useState({ tipo: 'ALIMENTACAO', valor: '', descricao: '' })
  const [salvandoGasto, setSalvandoGasto] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vistorias?responsavelAtual=true')
      if (res.ok) {
        const d = await res.json()
        setVistorias(d.vistorias || [])
      }
    } catch { toast.error('Erro ao carregar') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Registrar saída
  async function registrarSaida(vistoriaId: string) {
    const s = saidas[vistoriaId] || {}
    setSalvando(vistoriaId)
    try {
      const res = await fetch(`/api/vistorias/${vistoriaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'EM_ANDAMENTO',
          dataSaida: s.dataSaida || new Date().toISOString(),
          kmSaida: s.km || undefined,
        }),
      })
      if (!res.ok) { toast.error('Erro ao registrar saída'); return }
      toast.success('Saída registrada!')
      load()
    } finally { setSalvando(null) }
  }

  // Registrar chegada / finalizar
  async function registrarChegada(vistoriaId: string) {
    const c = chegadas[vistoriaId] || {}
    setSalvando(vistoriaId)
    try {
      const res = await fetch(`/api/vistorias/${vistoriaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REALIZADA',
          dataVolta: new Date().toISOString(),
          kmChegada: c.km || undefined,
          resultado: c.obs || undefined,
          manutencaoObs: c.manutencao || undefined,
        }),
      })
      if (!res.ok) { toast.error('Erro ao finalizar'); return }
      toast.success('Vistoria finalizada!')
      load()
    } finally { setSalvando(null) }
  }

  // Apontar gasto rápido
  async function apontarGasto(vistoriaId: string) {
    if (!formGasto.valor) { toast.error('Informe o valor'); return }
    setSalvandoGasto(true)
    try {
      const res = await fetch('/api/campo/diarias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vistoriaId, ...formGasto }),
      })
      if (!res.ok) { toast.error('Erro ao registrar gasto'); return }
      toast.success('Gasto registrado!')
      setFormGasto({ tipo: 'ALIMENTACAO', valor: '', descricao: '' })
      setGastoAberto(null)
      load()
    } finally { setSalvandoGasto(false) }
  }

  const pendentes  = vistorias.filter(v => v.status === 'AGENDADA')
  const emCampo    = vistorias.filter(v => v.status === 'EM_ANDAMENTO')
  const realizadas = vistorias.filter(v => v.status === 'REALIZADA')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minhas Vistorias</h1>
        <p className="text-gray-500 text-sm mt-1">
          {emCampo.length > 0 && <span className="text-yellow-600 font-medium">{emCampo.length} em andamento · </span>}
          {pendentes.length} agendada(s) · {realizadas.length} realizadas
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Em andamento ─────────────────────────────── */}
          {emCampo.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-yellow-700 uppercase tracking-wider">Em Campo Agora</h2>
              {emCampo.map(v => (
                <VistoriaCard key={v.id} v={v} expandido={expandido} setExpandido={setExpandido}
                  salvando={salvando} chegadas={chegadas} setChegadas={setChegadas}
                  registrarChegada={registrarChegada}
                  gastoAberto={gastoAberto} setGastoAberto={setGastoAberto}
                  formGasto={formGasto} setFormGasto={setFormGasto}
                  salvandoGasto={salvandoGasto} apontarGasto={apontarGasto}
                  modo="chegada"
                />
              ))}
            </div>
          )}

          {/* ── Agendadas ────────────────────────────────── */}
          {pendentes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-blue-700 uppercase tracking-wider">Agendadas</h2>
              {pendentes.map(v => (
                <VistoriaCard key={v.id} v={v} expandido={expandido} setExpandido={setExpandido}
                  salvando={salvando} saidas={saidas} setSaidas={setSaidas}
                  registrarSaida={registrarSaida}
                  gastoAberto={gastoAberto} setGastoAberto={setGastoAberto}
                  formGasto={formGasto} setFormGasto={setFormGasto}
                  salvandoGasto={salvandoGasto} apontarGasto={apontarGasto}
                  modo="saida"
                />
              ))}
            </div>
          )}

          {/* ── Realizadas ───────────────────────────────── */}
          {realizadas.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-green-700 uppercase tracking-wider">Realizadas</h2>
              {realizadas.map(v => (
                <div key={v.id} className="bg-white rounded-2xl border border-gray-100 p-4 opacity-75">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="font-mono text-xs text-gray-400">{v.projeto?.codigo}</span>
                    <span className="text-xs text-green-700 font-medium">Realizada</span>
                  </div>
                  <p className="font-semibold text-gray-700 text-sm">{v.titulo}</p>
                  <p className="text-xs text-gray-400">{v.municipio || v.projeto?.municipio}</p>
                </div>
              ))}
            </div>
          )}

          {vistorias.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma vistoria atribuída a você</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Componente de card de vistoria ────────────────────────────
function VistoriaCard({ v, expandido, setExpandido, salvando, saidas, setSaidas, chegadas, setChegadas,
  registrarSaida, registrarChegada, gastoAberto, setGastoAberto, formGasto, setFormGasto, salvandoGasto, apontarGasto, modo }: any) {

  const isExp = expandido === v.id
  const isSaving = salvando === v.id
  const s = saidas?.[v.id] || {}
  const c = chegadas?.[v.id] || {}
  const totalGastos = (v.diarias || []).reduce((sum: number, d: any) => sum + d.valor, 0)

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all ${
      modo === 'chegada' ? 'border-yellow-200' : 'border-blue-100'
    }`}>
      {/* Header clicável */}
      <button className="w-full text-left p-4" onClick={() => setExpandido(isExp ? null : v.id)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-400">{v.projeto?.codigo}</span>
              {modo === 'chegada' && (
                <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">Em Campo</span>
              )}
            </div>
            <p className="font-bold text-gray-900 text-sm">{v.titulo}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{v.projeto?.imovelNome || '—'}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.municipio || v.projeto?.municipio || '—'}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(v.dataAgendada).toLocaleDateString('pt-BR')}</span>
              {totalGastos > 0 && <span className="text-green-600 font-medium">💰 {formatCurrency(totalGastos)}</span>}
            </div>
            {v.projeto?.tipoServico && (
              <span className="inline-block mt-1.5 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{v.projeto.tipoServico}</span>
            )}
          </div>
          {isExp ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </div>
      </button>

      {/* Expandido */}
      {isExp && (
        <div className="px-4 pb-5 space-y-4 border-t border-gray-100 pt-4">

          {/* Botão + Gasto rápido */}
          <div>
            {gastoAberto === v.id ? (
              <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-700">Registrar Gasto</p>
                <div className="grid grid-cols-2 gap-2">
                  <select value={formGasto.tipo} onChange={e => setFormGasto((p: any) => ({ ...p, tipo: e.target.value }))}
                    className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                    {Object.entries(TIPO_GASTO_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <input type="number" placeholder="Valor R$" step="0.01"
                    value={formGasto.valor} onChange={e => setFormGasto((p: any) => ({ ...p, valor: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                  <input placeholder="Descrição (opcional)"
                    value={formGasto.descricao} onChange={e => setFormGasto((p: any) => ({ ...p, descricao: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => apontarGasto(v.id)} disabled={salvandoGasto || !formGasto.valor}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">
                    {salvandoGasto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Registrar
                  </button>
                  <button onClick={() => setGastoAberto(null)} className="px-4 py-2 border border-gray-200 text-gray-500 rounded-lg text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setGastoAberto(v.id); setFormGasto({ tipo: 'ALIMENTACAO', valor: '', descricao: '' }) }}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 rounded-xl py-2.5 text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Registrar Gasto
              </button>
            )}
          </div>

          {/* Gastos existentes */}
          {v.diarias?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500">Gastos registrados</p>
              {v.diarias.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  <span>{TIPO_GASTO_LABELS[d.tipo]?.split(' ')[0]} {d.descricao || TIPO_GASTO_LABELS[d.tipo]?.split(' ').slice(1).join(' ')}</span>
                  <span className="font-semibold">{formatCurrency(d.valor)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Registrar saída */}
          {modo === 'saida' && (
            <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/40">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Registrar Saída
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Data/Hora de saída</label>
                  <input type="datetime-local"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                    onChange={e => setSaidas((p: any) => ({ ...p, [v.id]: { ...s, dataSaida: e.target.value } }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">KM de saída</label>
                  <input type="number" placeholder="45000"
                    value={s.km || ''} onChange={e => setSaidas((p: any) => ({ ...p, [v.id]: { ...s, km: e.target.value } }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              </div>
              <button onClick={() => registrarSaida(v.id)} disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                Iniciar — Estou saindo
              </button>
            </div>
          )}

          {/* Registrar chegada */}
          {modo === 'chegada' && (
            <div className="border border-green-200 rounded-xl p-4 space-y-3 bg-green-50/40">
              <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Registrar Chegada
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">KM de chegada</label>
                <input type="number" placeholder="47500"
                  value={c.km || ''} onChange={e => setChegadas((p: any) => ({ ...p, [v.id]: { ...c, km: e.target.value } }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Observações da vistoria</label>
                <textarea rows={3} placeholder="Descreva o resultado da vistoria..."
                  value={c.obs || ''} onChange={e => setChegadas((p: any) => ({ ...p, [v.id]: { ...c, obs: e.target.value } }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Manutenções necessárias</label>
                <textarea rows={2} placeholder="Registre manutenções ou problemas encontrados..."
                  value={c.manutencao || ''} onChange={e => setChegadas((p: any) => ({ ...p, [v.id]: { ...c, manutencao: e.target.value } }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none" />
              </div>
              <button onClick={() => registrarChegada(v.id)} disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Finalizar — Cheguei
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
