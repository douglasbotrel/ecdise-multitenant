'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Plus, X, CheckCircle2, Circle, ChevronLeft, ChevronRight, ChevronDown,
  Calendar, Loader2, Users, TrendingUp, AlertTriangle, Landmark, GripVertical, Award
} from 'lucide-react'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'

const ROLES_GESTAO = ['ADMIN', 'GESTOR_GERAL', 'GESTOR_OPERACIONAL', 'GESTOR_ADMINISTRATIVO', 'SUPERVISOR']

const DIAS_LETRA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const DIAS_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const DIAS_NOME  = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
const DIAS_COR   = [
  'bg-indigo-500', 'bg-blue-500', 'bg-cyan-500', 'bg-teal-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
]

function segundaFeiraDaSemana(data: Date): Date {
  const d = new Date(data)
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDataCurta(d: string | Date) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function agruparPorProjeto(lista: any[]) {
  const grupos = new Map<string, { projeto: any; itens: any[] }>()
  for (const t of lista) {
    const pid = t.projeto?.id || 'sem-projeto'
    if (!grupos.has(pid)) grupos.set(pid, { projeto: t.projeto, itens: [] })
    grupos.get(pid)!.itens.push(t)
  }
  return Array.from(grupos.values()).sort((a, b) =>
    (a.projeto?.codigo || '').localeCompare(b.projeto?.codigo || '')
  )
}

function corUrgencia(prazo: string | null | undefined): { barra: string; texto: string } {
  if (!prazo) return { barra: 'bg-gray-200', texto: 'text-gray-400' }
  const dias = Math.floor((new Date(prazo).getTime() - Date.now()) / 86_400_000)
  if (dias < 0) return { barra: 'bg-red-500', texto: 'text-red-600' }
  if (dias <= 2) return { barra: 'bg-amber-500', texto: 'text-amber-600' }
  return { barra: 'bg-emerald-400', texto: 'text-gray-400' }
}

// Payload transportado durante o arraste
type DragPayload = { origem: 'backlog' | 'planejada'; id: string; tipo: 'TAREFA' | 'PENDENCIA' | 'CONDICIONANTE_LICENCA' }

export default function TarefasSemanaPage() {
  const [me, setMe] = useState<any>(null)
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [usuarioId, setUsuarioId] = useState<string>('')
  const [semanaInicio, setSemanaInicio] = useState<Date>(segundaFeiraDaSemana(new Date()))

  const [backlog, setBacklog] = useState<any[]>([])
  const [planejadas, setPlanejadas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [diaSobreDrag, setDiaSobreDrag] = useState<number | null>(null)

  const [verPainelEquipe, setVerPainelEquipe] = useState(false)
  const [kpi, setKpi] = useState<any>(null)
  const [carregandoKpi, setCarregandoKpi] = useState(false)
  useLockBodyScroll(verPainelEquipe)
  const [colapsados, setColapsados] = useState<Record<string, boolean>>({})

  const podeGerenciarEquipe = me && ROLES_GESTAO.includes(me.role)
  const hojeBlocoRef = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/tarefas-semana?usuarioId=${usuarioId}&semanaInicio=${semanaInicio.toISOString()}`
      )
      const data = await res.json()
      setBacklog(data.backlog || [])
      setPlanejadas(data.planejadas || [])
    } catch {
      toast.error('Erro ao carregar tarefas')
    } finally {
      setLoading(false)
    }
  }, [usuarioId, semanaInicio])

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setMe(data.usuario || data)
        setUsuarioId((data.usuario || data).id)
      }
    })()
  }, [])

  useEffect(() => {
    if (!podeGerenciarEquipe) return
    fetch('/api/usuarios?ativo=true')
      .then(r => r.json())
      .then(d => setUsuarios(d.usuarios || []))
      .catch(() => {})
  }, [podeGerenciarEquipe])

  useEffect(() => { carregar() }, [carregar])

  // Rola a faixa de dias para começar em "hoje" (quando está na semana atual)
  useEffect(() => {
    if (!loading && hojeBlocoRef.current) {
      hojeBlocoRef.current.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'smooth' })
    }
  }, [loading, semanaInicio])

  async function adicionarNaSemana(itemId: string, tipo: 'TAREFA' | 'PENDENCIA' | 'CONDICIONANTE_LICENCA', diaSemana: number | null = null) {
    setProcessando(itemId)
    try {
      const res = await fetch('/api/tarefas-semana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, tipo, usuarioId, semanaInicio: semanaInicio.toISOString(), diaSemana }),
      })
      if (!res.ok) { toast.error('Erro ao adicionar'); return }
      carregar()
    } finally {
      setProcessando(null)
    }
  }

  async function removerDaSemana(itemId: string) {
    setProcessando(itemId)
    try {
      const res = await fetch(`/api/tarefas-semana?id=${itemId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Erro ao remover'); return }
      carregar()
    } finally {
      setProcessando(null)
    }
  }

  async function alterarDia(itemId: string, diaAtual: number | null, diaClicado: number) {
    setProcessando(itemId)
    try {
      const novoDia = diaAtual === diaClicado ? null : diaClicado
      const res = await fetch('/api/tarefas-semana', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, diaSemana: novoDia }),
      })
      if (!res.ok) { toast.error('Erro ao definir o dia'); return }
      carregar()
    } finally {
      setProcessando(null)
    }
  }

  async function marcarConcluida(itemId: string, tipo: 'TAREFA' | 'PENDENCIA' | 'CONDICIONANTE_LICENCA', concluida: boolean) {
    setProcessando(itemId)
    try {
      const res = tipo === 'PENDENCIA'
        ? await fetch('/api/acoes', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: itemId, concluida: !concluida }),
          })
        : tipo === 'CONDICIONANTE_LICENCA'
        ? await fetch('/api/condicionantes-licenca', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: itemId, concluida: !concluida }),
          })
        : await fetch('/api/tarefas', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: itemId, status: concluida ? 'PENDENTE' : 'CONCLUIDA' }),
          })
      if (!res.ok) { toast.error('Erro ao atualizar'); return }
      toast.success(concluida ? 'Reaberta' : (
        tipo === 'PENDENCIA' ? 'Concluída! Também atualizado em Acompanhamento.'
        : tipo === 'CONDICIONANTE_LICENCA' ? 'Concluída! Também atualizado na aba Licenças.'
        : 'Concluída! Também atualizado no Operacional.'
      ))
      carregar()
    } finally {
      setProcessando(null)
    }
  }

  async function abrirPainelEquipe() {
    setVerPainelEquipe(true)
    setCarregandoKpi(true)
    try {
      const res = await fetch('/api/tarefas-semana/kpi?semanas=4')
      const data = await res.json()
      setKpi(data)
    } finally {
      setCarregandoKpi(false)
    }
  }

  // ── Drag & drop (desktop). No touch/mobile, as pílulas de dia continuam
  // funcionando como alternativa rápida — arrastar é sempre opcional. ──
  function onDragStartBacklog(e: React.DragEvent, item: any) {
    const payload: DragPayload = { origem: 'backlog', id: item.id, tipo: item.tipo }
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragStartPlanejada(e: React.DragEvent, item: any) {
    const payload: DragPayload = { origem: 'planejada', id: item.id, tipo: item.tipo }
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  async function soltarNoDia(e: React.DragEvent, dia: number | null) {
    e.preventDefault()
    setDiaSobreDrag(null)
    let payload: DragPayload
    try {
      payload = JSON.parse(e.dataTransfer.getData('application/json'))
    } catch {
      return
    }
    if (payload.origem === 'backlog') {
      await adicionarNaSemana(payload.id, payload.tipo, dia)
    } else {
      await alterarDiaDireto(payload.id, dia)
    }
  }

  async function alterarDiaDireto(itemId: string, dia: number | null) {
    setProcessando(itemId)
    try {
      const res = await fetch('/api/tarefas-semana', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, diaSemana: dia }),
      })
      if (!res.ok) { toast.error('Erro ao mover'); return }
      carregar()
    } finally {
      setProcessando(null)
    }
  }

  const totalPlanejadas = planejadas.length
  const totalConcluidas = planejadas.filter(p => p.concluida).length
  const progresso = totalPlanejadas > 0 ? Math.round((totalConcluidas / totalPlanejadas) * 100) : 0

  const semanaFim = new Date(semanaInicio)
  semanaFim.setDate(semanaFim.getDate() + 6)

  const hojeDiaIdx = (() => {
    const d = new Date().getDay()
    return d === 0 ? 6 : d - 1
  })()
  const ehSemanaAtual = segundaFeiraDaSemana(new Date()).getTime() === semanaInicio.getTime()

  const semDia = planejadas.filter(p => p.diaSemana == null)
  const diasDoBloco = [0, 1, 2, 3, 4, 5, 6].map(dia => {
    const data = new Date(semanaInicio)
    data.setDate(data.getDate() + dia)
    return {
      dia,
      data,
      itens: planejadas.filter(p => p.diaSemana === dia),
      ehHoje: ehSemanaAtual && dia === hojeDiaIdx,
      ehAmanha: ehSemanaAtual && dia === hojeDiaIdx + 1,
    }
  })

  function TaskCard({ item, draggable, onDragStart }: { item: any; draggable: boolean; onDragStart?: (e: React.DragEvent) => void }) {
    const ehPendencia = item.tipo === 'PENDENCIA'
    const ehLicenca = item.tipo === 'CONDICIONANTE_LICENCA'
    const concluida = !!item.concluida
    return (
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        className={`rounded-lg border overflow-hidden bg-white cursor-grab active:cursor-grabbing ${
          concluida ? 'border-green-100 bg-green-50/40' : ehPendencia ? 'border-purple-100' : ehLicenca ? 'border-amber-100' : 'border-gray-100'
        }`}
      >
        <div className="flex items-start gap-1.5 p-2">
          {draggable && <GripVertical className="w-3 h-3 text-gray-200 mt-0.5 flex-shrink-0 hidden sm:block" />}
          <button
            onClick={() => marcarConcluida(item.itemId, item.tipo, concluida)}
            disabled={processando === item.itemId}
            className="mt-0.5 flex-shrink-0 disabled:opacity-50"
            title={concluida ? 'Reabrir' : 'Marcar como concluída'}
          >
            {concluida
              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
              : <Circle className="w-4 h-4 text-gray-300 hover:text-green-500" />}
          </button>
          <div className="min-w-0 flex-1">
            {ehPendencia && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold text-purple-700 bg-purple-50 px-1 py-0.5 rounded-full w-fit mb-0.5">
                <Landmark className="w-2 h-2" /> Pendência
              </span>
            )}
            {ehLicenca && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.5 rounded-full w-fit mb-0.5">
                <Award className="w-2 h-2" /> Licença
              </span>
            )}
            <p className={`text-xs leading-tight ${concluida ? 'text-gray-400 line-through' : 'text-gray-800'} truncate`}>
              {item.titulo}
            </p>
            <p className="text-[10px] text-gray-400 truncate">{item.projeto?.codigo}</p>
          </div>
          <button
            onClick={() => removerDaSemana(item.id)}
            disabled={processando === item.id}
            className="p-0.5 text-gray-300 hover:text-red-500 flex-shrink-0"
            title="Tirar da semana"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        {/* Pílulas de dia — alternativa ao arraste (essencial no toque/mobile) */}
        <div className="flex items-center gap-0.5 px-2 pb-1.5 pl-6">
          {DIAS_LETRA.map((letra, i) => (
            <button
              key={i}
              onClick={() => alterarDia(item.id, item.diaSemana, i)}
              disabled={processando === item.id}
              title={DIAS_NOME[i]}
              className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center transition-colors disabled:opacity-50 ${
                item.diaSemana === i ? `${DIAS_COR[i]} text-white` : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {letra}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function GrupoProjeto({ grupo, prefixo }: { grupo: { projeto: any; itens: any[] }; prefixo: string }) {
    const pid = `${prefixo}:${grupo.projeto?.id || 'sem-projeto'}`
    const aberto = colapsados[pid] === true
    return (
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <button
          onClick={() => setColapsados(p => ({ ...p, [pid]: !aberto }))}
          className="w-full flex items-center justify-between gap-2 py-2.5 px-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-800 truncate">
              {grupo.projeto?.imovelNome || grupo.projeto?.codigo || 'Sem projeto'}
            </span>
            <span className="block text-[11px] text-gray-400 truncate">
              {grupo.projeto?.codigo}{grupo.projeto?.imovelNome ? ` · ${grupo.itens.length} pendente(s)` : ` — ${grupo.itens.length} pendente(s)`}
            </span>
          </span>
          <span className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs font-bold text-white bg-gray-400 rounded-full w-5 h-5 flex items-center justify-center">
              {grupo.itens.length}
            </span>
            {aberto
              ? <ChevronDown className="w-4 h-4 text-gray-400" />
              : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </span>
        </button>
        {aberto && (
          <div className="p-2 space-y-2 bg-white">
            {grupo.itens.map((t: any) => {
              const urg = corUrgencia(t.prazo)
              const ehPendencia = t.tipo === 'PENDENCIA'
              const ehLicenca = t.tipo === 'CONDICIONANTE_LICENCA'
              return (
                <div
                  key={t.id}
                  draggable
                  onDragStart={e => onDragStartBacklog(e, t)}
                  className="flex items-stretch gap-0 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all overflow-hidden cursor-grab active:cursor-grabbing"
                >
                  <div className={`w-1 flex-shrink-0 ${ehPendencia ? 'bg-purple-500' : ehLicenca ? 'bg-amber-500' : urg.barra}`} />
                  <div className="flex items-start gap-2 p-3 flex-1 min-w-0">
                    <GripVertical className="w-3.5 h-3.5 text-gray-200 mt-0.5 flex-shrink-0 hidden sm:block" />
                    <button
                      onClick={() => adicionarNaSemana(t.id, t.tipo)}
                      disabled={processando === t.id}
                      className="mt-0.5 p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0 disabled:opacity-50"
                      title="Colocar nesta semana (sem dia definido)"
                    >
                      {processando === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1 space-y-1">
                      {ehPendencia && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full w-fit">
                          <Landmark className="w-2.5 h-2.5" /> Pendência
                        </span>
                      )}
                      {ehLicenca && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full w-fit">
                          <Award className="w-2.5 h-2.5" /> Licença
                        </span>
                      )}
                      <p className="text-sm text-gray-800 leading-snug break-words">{t.titulo}</p>
                      {t.prazo && (
                        <p className={`text-xs flex items-center gap-1 ${urg.texto}`}>
                          {urg.texto === 'text-red-600' && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                          prazo {formatDataCurta(t.prazo)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const backlogTarefas    = backlog.filter(t => t.tipo === 'TAREFA')
  const backlogPendencias = backlog.filter(t => t.tipo === 'PENDENCIA')
  const backlogLicencas   = backlog.filter(t => t.tipo === 'CONDICIONANTE_LICENCA')

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tarefas da Semana</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Arraste uma pendente pro dia (ou toque nas letrinhas S T Q Q S S D) e marque conforme for concluindo.
          </p>
        </div>
        {podeGerenciarEquipe && (
          <button
            onClick={abrirPainelEquipe}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <Users className="w-4 h-4" /> Painel da Equipe
          </button>
        )}
      </div>

      {/* Seletor de usuário (gestores) + navegação de semana */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
        {podeGerenciarEquipe ? (
          <select
            value={usuarioId}
            onChange={e => setUsuarioId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {me && <option value={me.id}>Minhas tarefas ({me.nome})</option>}
            {usuarios.filter(u => u.id !== me?.id).map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        ) : <div />}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSemanaInicio(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {formatDataCurta(semanaInicio)} – {formatDataCurta(semanaFim)}
          </span>
          <button
            onClick={() => setSemanaInicio(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSemanaInicio(segundaFeiraDaSemana(new Date()))}
            className="text-xs text-green-600 font-medium hover:text-green-700 ml-1"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Progresso da semana */}
      {totalPlanejadas > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progresso da semana</span>
            <span className="text-sm text-gray-500">{totalConcluidas} de {totalPlanejadas} concluídas</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
          {/* ── Mini-calendário: blocos horizontais por dia ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Sua semana</h2>

            {/* Faixa "Sem dia definido" — também é alvo de drop, pra tirar o dia */}
            <div
              onDragOver={e => { e.preventDefault(); setDiaSobreDrag(-1) }}
              onDragLeave={() => setDiaSobreDrag(null)}
              onDrop={e => soltarNoDia(e, null)}
              className={`mb-3 rounded-xl border-2 border-dashed p-2 transition-colors ${
                diaSobreDrag === -1 ? 'border-gray-400 bg-gray-50' : 'border-gray-200'
              }`}
            >
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                Sem dia definido — arraste aqui pra tirar de um dia
              </p>
              {semDia.length === 0 ? (
                <p className="text-xs text-gray-300 px-1 py-1">Nada solto por aqui.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {semDia.map(item => (
                    <div key={item.id} className="w-48">
                      <TaskCard item={item} draggable onDragStart={e => onDragStartPlanejada(e, item)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blocos dos 7 dias, rolando a partir de hoje */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {diasDoBloco.map(bloco => (
                <div
                  key={bloco.dia}
                  ref={bloco.ehHoje ? hojeBlocoRef : undefined}
                  onDragOver={e => { e.preventDefault(); setDiaSobreDrag(bloco.dia) }}
                  onDragLeave={() => setDiaSobreDrag(null)}
                  onDrop={e => soltarNoDia(e, bloco.dia)}
                  className={`flex-shrink-0 w-44 rounded-xl border-2 p-2 transition-colors ${
                    diaSobreDrag === bloco.dia
                      ? 'border-gray-400 bg-gray-50'
                      : bloco.ehHoje
                        ? 'border-green-400 bg-green-50/40'
                        : bloco.ehAmanha
                          ? 'border-blue-300 bg-blue-50/30'
                          : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 px-0.5">
                    <div>
                      <p className={`text-xs font-bold ${bloco.ehHoje ? 'text-green-700' : bloco.ehAmanha ? 'text-blue-700' : 'text-gray-600'}`}>
                        {DIAS_CURTO[bloco.dia]}
                      </p>
                      <p className="text-[10px] text-gray-400">{formatDataCurta(bloco.data)}</p>
                    </div>
                    {bloco.ehHoje && <span className="text-[9px] bg-green-600 text-white font-bold px-1.5 py-0.5 rounded-full">HOJE</span>}
                    {bloco.ehAmanha && <span className="text-[9px] bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded-full">AMANHÃ</span>}
                  </div>
                  <div className="space-y-1.5 min-h-[3rem]">
                    {bloco.itens.length === 0 ? (
                      <div className="text-[10px] text-gray-300 text-center py-3 border border-dashed border-gray-100 rounded-lg">
                        arraste aqui
                      </div>
                    ) : (
                      bloco.itens.map(item => (
                        <TaskCard key={item.id} item={item} draggable onDragStart={e => onDragStartPlanejada(e, item)} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Pendentes (backlog) — painel da direita ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm xl:max-h-[calc(100vh-14rem)] xl:overflow-y-auto min-w-0 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                📋 Operacional
                <span className="text-xs font-normal text-gray-400">({backlogTarefas.length})</span>
              </h2>
              {backlogTarefas.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">Nenhuma tarefa operacional pendente.</p>
              ) : (
                <div className="space-y-2">
                  {agruparPorProjeto(backlogTarefas).map(grupo => (
                    <GrupoProjeto key={grupo.projeto?.id || 'sem-projeto'} grupo={grupo} prefixo="op" />
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-purple-500" /> Pendências (com órgão)
                <span className="text-xs font-normal text-gray-400">({backlogPendencias.length})</span>
              </h2>
              {backlogPendencias.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">Nenhuma pendência de órgão sob sua responsabilidade.</p>
              ) : (
                <div className="space-y-2">
                  {agruparPorProjeto(backlogPendencias).map(grupo => (
                    <GrupoProjeto key={grupo.projeto?.id || 'sem-projeto'} grupo={grupo} prefixo="pend" />
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" /> Licenças (plano de ação)
                <span className="text-xs font-normal text-gray-400">({backlogLicencas.length})</span>
              </h2>
              {backlogLicencas.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">Nenhuma condicionante de licença sob sua responsabilidade.</p>
              ) : (
                <div className="space-y-2">
                  {agruparPorProjeto(backlogLicencas).map(grupo => (
                    <GrupoProjeto key={grupo.projeto?.id || 'sem-projeto'} grupo={grupo} prefixo="lic" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Painel da equipe (gestores) */}
      {verPainelEquipe && podeGerenciarEquipe && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setVerPainelEquipe(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" /> Cumprimento semanal — últimas 4 semanas
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">% do que cada um planejou e realmente concluiu</p>
              </div>
              <button onClick={() => setVerPainelEquipe(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {carregandoKpi ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
              ) : !kpi?.usuarios?.length ? (
                <p className="text-sm text-gray-400 text-center py-8">Ainda sem dados suficientes.</p>
              ) : (
                <div className="space-y-3">
                  {kpi.usuarios.map((u: any) => (
                    <div key={u.usuarioId}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-800">{u.nome}</span>
                        <span className="text-gray-500">{u.concluidas}/{u.planejadas} · {u.taxa}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${u.taxa >= 70 ? 'bg-green-500' : u.taxa >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                          style={{ width: `${u.taxa}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
