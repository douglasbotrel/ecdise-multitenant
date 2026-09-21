'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, MapPin, Calendar, AlertCircle, CheckCircle2, Loader2,
  Users, Truck, DollarSign, ChevronLeft, ChevronRight,
  Trash2, Edit2, Save, Car
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { ModalVistoria } from '@/components/modals/ModalVistoria'

const STATUS_VISTORIA_LABELS: Record<string, string> = {
  AGENDADA: 'Agendada', EM_ANDAMENTO: 'Em Andamento', REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada', ADIADA: 'Adiada'
}
const STATUS_VISTORIA_COLORS: Record<string, string> = {
  AGENDADA: 'bg-blue-100 text-blue-800', EM_ANDAMENTO: 'bg-yellow-100 text-yellow-800',
  REALIZADA: 'bg-green-100 text-green-800', CANCELADA: 'bg-red-100 text-red-800',
  ADIADA: 'bg-orange-100 text-orange-800'
}
const TIPO_DIARIA_LABELS: Record<string, string> = {
  ALIMENTACAO: '🍽️ Alimentação', HOSPEDAGEM: '🏨 Hospedagem',
  COMBUSTIVEL: '⛽ Combustível', PEDAGIO: '🚧 Pedágio', OUTRO: '📎 Outro'
}
const TIPO_FROTA = ['CARRO', 'CAMINHONETE', 'VAN', 'MOTO', 'OUTRO']
const EQUIPE_CORES = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'
]
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export default function CampoPage() {
  const [aba, setAba] = useState<'vistorias'|'calendario'|'equipes'|'frota'|'diarias'>('vistorias')
  const [vistorias, setVistorias]       = useState<any[]>([])
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [equipes, setEquipes]           = useState<any[]>([])
  const [frota, setFrota]               = useState<any[]>([])
  const [diarias, setDiarias]           = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [modalOpen, setModalOpen]       = useState(false)
  const [filtro, setFiltro]             = useState('')
  const [formSol, setFormSol] = useState<Record<string, {
    dataSaida: string; dataVolta: string; equipeId: string; frotaId: string; responsavelId: string
  }>>({})
  const [salvandoSol, setSalvandoSol]   = useState<string | null>(null)
  const [usarMesmaData, setUsarMesmaData] = useState<Record<string, boolean>>({})
  const [usuarios, setUsuarios]         = useState<any[]>([])

  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))

  // Equipes
  const [formEquipe, setFormEquipe]       = useState({ nome: '', cor: EQUIPE_CORES[0] })
  const [salvandoEquipe, setSalvandoEquipe] = useState(false)

  // Frota
  const [formFrota, setFormFrota]         = useState({ placa: '', tipo: 'CARRO', marca: '', modelo: '', ano: '', cor: '', kmAtual: '' })
  const [salvandoFrota, setSalvandoFrota] = useState(false)
  const [frotaEditando, setFrotaEditando] = useState<any | null>(null)

  // Diárias
  const [formDiaria, setFormDiaria]         = useState({ vistoriaId: '', tipo: 'ALIMENTACAO', descricao: '', valor: '' })
  const [salvandoDiaria, setSalvandoDiaria] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtro) params.set('status', filtro)
      const [resV, resS, resE, resF, resD, resU] = await Promise.all([
        fetch(`/api/vistorias?${params}`),
        fetch('/api/tarefas?solicitadasCampo=true'),
        fetch('/api/campo/equipes'),
        fetch('/api/campo/frota'),
        fetch('/api/campo/diarias'),
        fetch('/api/usuarios?ativo=true'),
      ])
      if (resV.ok) setVistorias((await resV.json()).vistorias)
      if (resS.ok) setSolicitacoes((await resS.json()).tarefas || [])
      if (resE.ok) setEquipes((await resE.json()).equipes || [])
      if (resF.ok) setFrota((await resF.json()).frota || [])
      if (resD.ok) setDiarias((await resD.json()).diarias || [])
      if (resU.ok) setUsuarios((await resU.json()).usuarios || [])
    } catch { toast.error('Erro ao carregar dados') }
    finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { load() }, [load])

  function setSolField(tarefaId: string, field: string, value: string) {
    setFormSol(prev => ({
      ...prev,
      [tarefaId]: { ...{ dataSaida: '', dataVolta: '', equipeId: '', frotaId: '', responsavelId: '' }, ...prev[tarefaId], [field]: value }
    }))
  }

  async function confirmarAgendamento(tarefa: any) {
    const f = formSol[tarefa.id] || { dataSaida: '', dataVolta: '', equipeId: '', frotaId: '', responsavelId: '' }
    // Resolve data efetiva: usa data de referência quando "mesma data" está marcado
    const dataSaidaRef = Object.values(formSol).find(x => x.dataSaida)?.dataSaida || ''
    const dataSaidaEfetiva = (usarMesmaData[tarefa.id] && dataSaidaRef) ? dataSaidaRef : f.dataSaida
    if (!dataSaidaEfetiva) { toast.error('Informe pelo menos a data de saída'); return }
    if (f.dataVolta && f.dataVolta < dataSaidaEfetiva) { toast.error('Data de volta anterior à de saída'); return }
    setSalvandoSol(tarefa.id)
    try {
      const resV = await fetch('/api/vistorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projetoId:    tarefa.projetoId || tarefa.projeto?.id,
          tarefaId:     tarefa.id,
          titulo:       tarefa.titulo,
          tipo:         'VISTORIA_CAMPO',
          dataAgendada: dataSaidaEfetiva,
          dataSaida:    dataSaidaEfetiva,
          dataVolta:    f.dataVolta || null,
          municipio:    tarefa.projeto?.municipio || '',
          responsavelId: f.responsavelId || null,
          equipeId:     f.equipeId  || null,
          frotaId:      f.frotaId   || null,
        }),
      })
      if (!resV.ok) { const d = await resV.json(); toast.error(d.error || 'Erro ao criar vistoria'); return }

      const resT = await fetch('/api/tarefas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tarefa.id, dataCampo: dataSaidaEfetiva, status: 'EM_ANDAMENTO' }),
      })
      if (!resT.ok) { const d = await resT.json(); toast.error(d.error); return }

      toast.success('Vistoria agendada! Operacional notificado.')
      setFormSol(prev => { const n = { ...prev }; delete n[tarefa.id]; return n })
      setUsarMesmaData(prev => { const n = { ...prev }; delete n[tarefa.id]; return n })
      load()
    } catch { toast.error('Erro ao confirmar agendamento') }
    finally { setSalvandoSol(null) }
  }

  async function atualizarStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/vistorias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Status atualizado')
      load()
    } catch { toast.error('Erro') }
  }

  async function criarEquipe() {
    if (!formEquipe.nome) { toast.error('Nome obrigatório'); return }
    setSalvandoEquipe(true)
    try {
      const res = await fetch('/api/campo/equipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEquipe),
      })
      if (!res.ok) { toast.error('Erro ao criar equipe'); return }
      toast.success('Equipe criada!')
      setFormEquipe({ nome: '', cor: EQUIPE_CORES[0] })
      load()
    } finally { setSalvandoEquipe(false) }
  }

  async function excluirEquipe(id: string) {
    if (!confirm('Excluir esta equipe?')) return
    await fetch(`/api/campo/equipes?id=${id}`, { method: 'DELETE' })
    toast.success('Excluída'); load()
  }

  async function salvarFrota() {
    if (!formFrota.placa) { toast.error('Placa obrigatória'); return }
    setSalvandoFrota(true)
    try {
      const method = frotaEditando ? 'PATCH' : 'POST'
      const body   = frotaEditando ? { id: frotaEditando.id, ...formFrota } : formFrota
      const res = await fetch('/api/campo/frota', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
      toast.success(frotaEditando ? 'Atualizado!' : 'Veículo cadastrado!')
      setFormFrota({ placa: '', tipo: 'CARRO', marca: '', modelo: '', ano: '', cor: '', kmAtual: '' })
      setFrotaEditando(null); load()
    } finally { setSalvandoFrota(false) }
  }

  async function excluirFrota(id: string) {
    if (!confirm('Excluir este veículo?')) return
    await fetch(`/api/campo/frota?id=${id}`, { method: 'DELETE' })
    toast.success('Veículo excluído'); load()
  }

  async function apontarDiaria() {
    if (!formDiaria.vistoriaId || !formDiaria.valor) { toast.error('Vistoria e valor obrigatórios'); return }
    setSalvandoDiaria(true)
    try {
      const res = await fetch('/api/campo/diarias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formDiaria),
      })
      if (!res.ok) { toast.error('Erro ao registrar'); return }
      toast.success('Gasto registrado!')
      setFormDiaria({ vistoriaId: '', tipo: 'ALIMENTACAO', descricao: '', valor: '' }); load()
    } finally { setSalvandoDiaria(false) }
  }

  function diasDoMes() {
    const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth()
    const primeiroDia = new Date(ano, mes, 1).getDay()
    const totalDias   = new Date(ano, mes + 1, 0).getDate()
    const dias: (number | null)[] = Array(primeiroDia).fill(null)
    for (let d = 1; d <= totalDias; d++) dias.push(d)
    return dias
  }
  function vistoriasNoDia(dia: number) {
    const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth()
    return vistorias.filter(v => {
      const d = new Date(v.dataAgendada)
      return d.getFullYear() === ano && d.getMonth() === mes && d.getDate() === dia
    })
  }

  const proximasVistorias = vistorias.filter(v => {
    const d = new Date(v.dataAgendada)
    return d >= hoje && d <= new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000) && v.status === 'AGENDADA'
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Campo</h1>
          <p className="text-gray-500 text-sm mt-1">{vistorias.length} vistoria(s)</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Agendar Vistoria
        </button>
      </div>

      {/* Solicitações do Operacional */}
      {solicitacoes.length > 0 && (() => {
        // Paleta de cores por projeto
        const PALETTE = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#f97316','#06b6d4','#84cc16','#6366f1']
        const projetoIds = [...new Set(solicitacoes.map((t: any) => t.projetoId).filter(Boolean))]
        const projetoCores: Record<string, string> = {}
        projetoIds.forEach((pid, i) => { projetoCores[pid as string] = PALETTE[i % PALETTE.length] })

        // Data de referência = primeira dataSaida preenchida entre todos os cards
        const entradaRef = Object.entries(formSol).find(([, f]) => f.dataSaida)
        const dataSaidaRef = entradaRef?.[1]?.dataSaida || ''
        const tarefaRefId = entradaRef?.[0] || ''
        const tarefaRef = solicitacoes.find((t: any) => t.id === tarefaRefId)
        const dataRefLabel = dataSaidaRef
          ? new Date(dataSaidaRef).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : ''

        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <h3 className="font-semibold text-blue-900 text-sm">Solicitações de Vistoria do Operacional</h3>
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{solicitacoes.length}</span>
              {/* Legenda de cores por projeto */}
              {projetoIds.length > 1 && (
                <div className="flex items-center gap-2 ml-2 flex-wrap">
                  {projetoIds.map((pid: any) => {
                    const nome = solicitacoes.find((t: any) => t.projetoId === pid)?.projeto?.codigo
                    return (
                      <span key={pid} className="flex items-center gap-1 text-xs text-gray-600">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: projetoCores[pid] }} />
                        {nome}
                      </span>
                    )
                  })}
                </div>
              )}
              {dataSaidaRef && (
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full ml-auto">
                  <Calendar className="w-3 h-3" /> Ref: {dataRefLabel}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {solicitacoes.map((tarefa: any) => {
                const f = formSol[tarefa.id] || { dataSaida: '', dataVolta: '', equipeId: '', frotaId: '', responsavelId: '' }
                const cor = projetoCores[tarefa.projetoId] || '#3b82f6'
                const mesmaData = !!usarMesmaData[tarefa.id]
                const dataSaidaEfetiva = mesmaData && dataSaidaRef ? dataSaidaRef : f.dataSaida
                const pronto = !!dataSaidaEfetiva
                const isRef = tarefa.id === tarefaRefId
                const podeMesmaData = !isRef && !!dataSaidaRef

                return (
                  <div key={tarefa.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    style={{ border: `1px solid ${cor}33`, borderLeft: `4px solid ${cor}` }}
                  >
                    {/* Card header */}
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
                        <span className="font-mono text-xs font-semibold text-gray-700">{tarefa.projeto?.codigo}</span>
                        <span className="text-xs text-gray-400 truncate">{tarefa.projeto?.imovelNome}</span>
                      </div>
                      {isRef && dataSaidaRef && (
                        <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-medium flex-shrink-0">ref</span>
                      )}
                    </div>

                    <div className="px-4 pt-3 pb-1">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{tarefa.titulo}</p>
                      {tarefa.projeto?.municipio && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{tarefa.projeto.municipio}
                        </p>
                      )}
                    </div>

                    {/* Form fields */}
                    <div className="px-4 py-3 space-y-2">
                      {/* Checkbox "Mesma data" */}
                      {podeMesmaData && (
                        <label className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={mesmaData}
                            onChange={e => setUsarMesmaData(prev => ({ ...prev, [tarefa.id]: e.target.checked }))}
                            className="w-3.5 h-3.5 accent-green-600"
                          />
                          <span className="text-xs text-green-800 font-medium">
                            Mesma data que <strong>{tarefaRef?.projeto?.codigo}</strong>
                          </span>
                          <span className="text-xs text-green-700 font-mono ml-auto">{dataRefLabel}</span>
                        </label>
                      )}

                      {/* Datas */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            <span className="text-red-500">*</span> Saída
                          </label>
                          <input type="datetime-local"
                            value={dataSaidaEfetiva}
                            onChange={e => !mesmaData && setSolField(tarefa.id, 'dataSaida', e.target.value)}
                            readOnly={mesmaData}
                            min={new Date().toISOString().slice(0, 16)}
                            className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                              mesmaData
                                ? 'border-green-200 bg-green-50 text-green-800 cursor-default'
                                : 'border-gray-200 bg-gray-50 focus:bg-white'
                            }`} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Volta</label>
                          <input type="datetime-local"
                            value={f.dataVolta}
                            onChange={e => setSolField(tarefa.id, 'dataVolta', e.target.value)}
                            min={dataSaidaEfetiva || new Date().toISOString().slice(0, 16)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors" />
                        </div>
                      </div>

                      {/* Selects */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Equipe
                        </label>
                        <select value={f.equipeId} onChange={e => setSolField(tarefa.id, 'equipeId', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors">
                          <option value="">Sem equipe</option>
                          {equipes.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                            <Car className="w-3 h-3" /> Frota
                          </label>
                          <select value={f.frotaId} onChange={e => setSolField(tarefa.id, 'frotaId', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors">
                            <option value="">Veículo</option>
                            {frota.filter((v: any) => v.ativa !== false).map((v: any) => (
                              <option key={v.id} value={v.id}>{v.placa}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                            <span className="w-3 h-3 inline-block text-center leading-none">👤</span> Técnico
                          </label>
                          <select value={f.responsavelId} onChange={e => setSolField(tarefa.id, 'responsavelId', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors">
                            <option value="">Técnico</option>
                            {usuarios.map((u: any) => <option key={u.id} value={u.id}>{u.nome.split(' ')[0]}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Confirm button */}
                    <div className="px-4 pb-4">
                      <button onClick={() => confirmarAgendamento(tarefa)}
                        disabled={salvandoSol === tarefa.id || !pronto}
                        className={`w-full flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-xl transition-all ${
                          pronto
                            ? 'text-white shadow-sm hover:shadow'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        style={pronto ? { backgroundColor: cor } : {}}>
                        {salvandoSol === tarefa.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <CheckCircle2 className="w-4 h-4" />}
                        Confirmar Agendamento
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Abas */}
      <div className="border-b border-gray-100 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {[
            { id: 'vistorias', label: 'Vistorias', Icon: MapPin },
            { id: 'calendario', label: 'Calendário', Icon: Calendar },
            { id: 'equipes', label: 'Equipes', Icon: Users },
            { id: 'frota', label: 'Frota', Icon: Truck },
            { id: 'diarias', label: 'Diárias', Icon: DollarSign },
          ].map(a => (
            <button key={a.id} onClick={() => setAba(a.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                aba === a.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <a.Icon className="w-4 h-4" />{a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ ABA VISTORIAS ══════════════════════════════════════ */}
      {aba === 'vistorias' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(STATUS_VISTORIA_LABELS).map(([status, label]) => (
              <div key={status} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{vistorias.filter(v => v.status === status).length}</p>
                <p className="text-xs text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {proximasVistorias.length > 0 && (
            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Próximas vistorias (30 dias)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {proximasVistorias.slice(0, 6).map(v => (
                  <div key={v.id} className="bg-white rounded-xl p-3 border border-blue-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-gray-400">{v.projeto?.codigo}</span>
                      <span className="text-xs text-blue-600 font-medium">{formatDate(v.dataAgendada)}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{v.titulo}</p>
                    <p className="text-xs text-gray-400">{v.municipio || v.projeto?.municipio}</p>
                    {v.responsavel && <p className="text-xs text-gray-400 mt-1">👤 {v.responsavel.nome}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFiltro('')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!filtro ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>Todas</button>
            {Object.entries(STATUS_VISTORIA_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setFiltro(k)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filtro === k ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{v}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : vistorias.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhuma vistoria encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vistorias.map(v => (
                <div key={v.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-gray-400">{v.projeto?.codigo}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_VISTORIA_COLORS[v.status]}`}>
                          {STATUS_VISTORIA_LABELS[v.status]}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">{v.titulo}</p>
                      <p className="text-sm text-gray-500">{v.projeto?.imovelNome}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(v.dataAgendada)}</span>
                        {v.dataSaida && <span>🚀 Saída: {new Date(v.dataSaida).toLocaleDateString('pt-BR')}</span>}
                        {v.dataVolta && <span>🏁 Volta: {new Date(v.dataVolta).toLocaleDateString('pt-BR')}</span>}
                        {v.diasCampo && <span>⏱ {v.diasCampo}d</span>}
                        {v.municipio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.municipio}</span>}
                        {v.responsavel && <span>👤 {v.responsavel.nome}</span>}
                      </div>
                    </div>
                    <select value={v.status} onChange={e => atualizarStatus(v.id, e.target.value)}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-green-500 flex-shrink-0">
                      {Object.entries(STATUS_VISTORIA_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ ABA CALENDÁRIO ════════════════════════════════════ */}
      {aba === 'calendario' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-lg text-gray-900 capitalize">
              {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          {equipes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {equipes.map(e => (
                <span key={e.id} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: e.cor }}>
                  {e.nome}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
            ))}
            {diasDoMes().map((dia, idx) => {
              const vsDia = dia ? vistoriasNoDia(dia) : []
              const isHoje = dia &&
                new Date().getDate() === dia &&
                new Date().getMonth() === mesAtual.getMonth() &&
                new Date().getFullYear() === mesAtual.getFullYear()
              return (
                <div key={idx} className={`min-h-[72px] p-1 rounded-lg border text-xs ${
                  !dia ? 'border-transparent' :
                  isHoje ? 'border-green-400 bg-green-50' : 'border-gray-100 hover:bg-gray-50'
                }`}>
                  {dia && (
                    <>
                      <p className={`font-semibold mb-0.5 ${isHoje ? 'text-green-700' : 'text-gray-600'}`}>{dia}</p>
                      {vsDia.map(v => {
                        const eq = equipes.find(e => e.id === v.equipeId)
                        return (
                          <div key={v.id}
                            className="text-white text-xs px-1 py-0.5 rounded mb-0.5 truncate leading-tight"
                            style={{ backgroundColor: eq?.cor || '#6b7280' }}
                            title={`${v.titulo} — ${v.responsavel?.nome || ''}`}>
                            {v.titulo}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ ABA EQUIPES ═══════════════════════════════════════ */}
      {aba === 'equipes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Nova Equipe</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome da Equipe *</label>
                <input value={formEquipe.nome} onChange={e => setFormEquipe(p => ({ ...p, nome: e.target.value }))}
                  placeholder="ex: Equipe Norte"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cor no calendário</label>
                <div className="flex gap-1.5">
                  {EQUIPE_CORES.map(c => (
                    <button key={c} onClick={() => setFormEquipe(p => ({ ...p, cor: c }))}
                      className={`w-7 h-7 rounded-full transition-all ${formEquipe.cor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button onClick={criarEquipe} disabled={salvandoEquipe || !formEquipe.nome}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
                {salvandoEquipe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {equipes.map(e => (
              <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: e.cor }} />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{e.nome}</p>
                  <p className="text-xs text-gray-400">{e.ativa ? '✅ Ativa' : '❌ Inativa'}</p>
                </div>
                <button onClick={() => excluirEquipe(e.id)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {equipes.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma equipe cadastrada</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ ABA FROTA ════════════════════════════════════════ */}
      {aba === 'frota' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">{frotaEditando ? 'Editar Veículo' : 'Cadastrar Veículo'}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { k: 'placa', label: 'Placa *', ph: 'ABC1234' },
                { k: 'marca', label: 'Marca', ph: 'Toyota' },
                { k: 'modelo', label: 'Modelo', ph: 'Hilux' },
                { k: 'ano', label: 'Ano', ph: '2023', type: 'number' },
                { k: 'cor', label: 'Cor', ph: 'Branco' },
                { k: 'kmAtual', label: 'KM Atual', ph: '45000', type: 'number' },
              ].map(field => (
                <div key={field.k}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                  <input type={field.type || 'text'} placeholder={field.ph}
                    value={(formFrota as any)[field.k]}
                    onChange={e => setFormFrota(p => ({ ...p, [field.k]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select value={formFrota.tipo} onChange={e => setFormFrota(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {TIPO_FROTA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={salvarFrota} disabled={salvandoFrota}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm">
                {salvandoFrota ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {frotaEditando ? 'Salvar' : 'Cadastrar'}
              </button>
              {frotaEditando && (
                <button onClick={() => { setFrotaEditando(null); setFormFrota({ placa: '', tipo: 'CARRO', marca: '', modelo: '', ano: '', cor: '', kmAtual: '' }) }}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  Cancelar
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {frota.map(v => (
              <div key={v.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900 text-sm">{v.placa}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{v.tipo}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[v.marca, v.modelo, v.ano].filter(Boolean).join(' · ')}
                    {v.kmAtual != null && ` · ${v.kmAtual.toLocaleString('pt-BR')} km`}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => {
                    setFrotaEditando(v)
                    setFormFrota({ placa: v.placa, tipo: v.tipo, marca: v.marca||'', modelo: v.modelo||'', ano: v.ano?.toString()||'', cor: v.cor||'', kmAtual: v.kmAtual?.toString()||'' })
                  }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => excluirFrota(v.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {frota.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum veículo cadastrado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ ABA DIÁRIAS ════════════════════════════════════════ */}
      {aba === 'diarias' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Apontar Gasto / Diária</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Vistoria *</label>
                <select value={formDiaria.vistoriaId} onChange={e => setFormDiaria(p => ({ ...p, vistoriaId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Selecionar...</option>
                  {vistorias.filter(v => ['AGENDADA','EM_ANDAMENTO'].includes(v.status)).map(v => (
                    <option key={v.id} value={v.id}>{v.projeto?.codigo} — {v.titulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select value={formDiaria.tipo} onChange={e => setFormDiaria(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {Object.entries(TIPO_DIARIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$) *</label>
                <input type="number" step="0.01" placeholder="0,00"
                  value={formDiaria.valor} onChange={e => setFormDiaria(p => ({ ...p, valor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
                <input placeholder="Observação" value={formDiaria.descricao}
                  onChange={e => setFormDiaria(p => ({ ...p, descricao: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <button onClick={apontarDiaria} disabled={salvandoDiaria || !formDiaria.vistoriaId || !formDiaria.valor}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm">
              {salvandoDiaria ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Registrar
            </button>
          </div>
          <div className="space-y-2">
            {diarias.map(d => (
              <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="text-2xl">{TIPO_DIARIA_LABELS[d.tipo]?.split(' ')[0] || '📎'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-gray-400">{d.vistoria?.projeto?.codigo}</span>
                    <span className="text-xs text-gray-500 truncate">{d.vistoria?.titulo}</span>
                  </div>
                  <p className="text-sm text-gray-700">{TIPO_DIARIA_LABELS[d.tipo]} {d.descricao && `· ${d.descricao}`}</p>
                  <p className="text-xs text-gray-400">{d.usuario?.nome} · {new Date(d.data).toLocaleDateString('pt-BR')}</p>
                </div>
                <p className="font-bold text-gray-900 text-sm flex-shrink-0">{formatCurrency(d.valor)}</p>
              </div>
            ))}
            {diarias.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum apontamento registrado</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ModalVistoria
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSalvo={() => { setModalOpen(false); load() }}
      />
    </div>
  )
}
