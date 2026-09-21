'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search, ClipboardList, ChevronRight, MapPin, User, Calendar,
  CheckSquare, AlertCircle, Info, X, Phone, Mail, FileText,
  Layers, BarChart2, Loader2, ExternalLink, Lock,
  LayoutDashboard, TrendingUp, Clock, AlertTriangle, CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { formatDate, formatCurrency, STATUS_OPERACIONAL_LABELS, STATUS_COLORS } from '@/lib/utils'
import Link from 'next/link'

const FILTROS = [
  { label: 'Todos',        value: '' },
  { label: 'Não Iniciado', value: 'NAO_INICIADO' },
  { label: 'Em Andamento', value: 'EM_ANDAMENTO' },
  { label: 'Em Campo',     value: 'EM_CAMPO' },
  { label: 'Aguardando',   value: 'AGUARDANDO_INFO' },
  { label: 'Concluído',    value: 'CONCLUIDO' },
]

// Etapas válidas: só após primeiro pagamento registrado pelo financeiro
const ETAPAS_OPERACIONAL = 'OPERACIONAL,EM_EXECUCAO,CONCLUIDO'

// Roles com acesso à visão de gestão
const ROLES_GESTAO = ['ADMIN', 'GESTOR_GERAL', 'GESTOR_OPERACIONAL']

// ─── Painel de Gestão ────────────────────────────────────────────────────────
function PainelGestao({ data, loading, onRefresh }: { data: any; loading: boolean; onRefresh: () => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 bg-white rounded-2xl border border-gray-100">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
      </div>
    )
  }
  if (!data) return null

  const { stats, projetos } = data

  const resumo = [
    {
      icon: <Layers className="w-5 h-5 text-indigo-500" />,
      label: 'Projetos ativos',
      value: stats.totalProjetos,
      sub: `${stats.totalTarefas} tarefas no total`,
      cor: 'border-indigo-100',
      destaque: false,
      alerta: false,
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-green-500" />,
      label: 'Progresso médio',
      value: `${stats.pctGlobal}%`,
      sub: `${stats.totalConcluidas} de ${stats.totalTarefas} concluídas`,
      cor: 'border-green-100',
      destaque: stats.pctGlobal >= 75,
      alerta: false,
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      label: 'Tarefas atrasadas',
      value: stats.totalAtrasadas,
      sub: 'prazo vencido, ainda pendentes',
      cor: 'border-red-100',
      destaque: false,
      alerta: stats.totalAtrasadas > 0,
    },
    {
      icon: <User className="w-5 h-5 text-amber-500" />,
      label: 'Sem responsável',
      value: stats.totalSemResponsavel,
      sub: 'tarefas sem analista atribuído',
      cor: 'border-amber-100',
      destaque: false,
      alerta: stats.totalSemResponsavel > 0,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {resumo.map((c, i) => (
          <div key={i} className={`bg-white rounded-2xl border-2 ${c.cor} p-4 flex flex-col gap-1`}>
            <div className="flex items-center gap-2">
              {c.icon}
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">{c.label}</span>
            </div>
            <p className={`text-3xl font-bold mt-1 ${c.alerta ? 'text-red-600' : c.destaque ? 'text-green-600' : 'text-gray-900'}`}>
              {c.value}
            </p>
            <p className="text-xs text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Barra de progresso global */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Progresso global das atividades</span>
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap justify-end">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              {stats.totalConcluidas} concluídas
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {stats.totalTarefas - stats.totalConcluidas} pendentes
            </span>
            {stats.totalAtrasadas > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertTriangle className="w-3.5 h-3.5" />
                {stats.totalAtrasadas} atrasadas
              </span>
            )}
            <button
              onClick={onRefresh}
              className="ml-1 p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-700 ${
              stats.pctGlobal >= 75 ? 'bg-green-500' : stats.pctGlobal >= 40 ? 'bg-amber-400' : 'bg-red-400'
            }`}
            style={{ width: `${stats.pctGlobal}%` }}
          />
        </div>
      </div>

      {/* Tabela de projetos */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Análise por Projeto</h3>
          <span className="text-xs text-gray-400">{projetos.length} projeto(s) em andamento</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Projeto</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Responsável</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Prazo</th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">Tempo</th>
                <th className="text-left px-4 py-3">Progresso</th>
                <th className="text-center px-3 py-3 text-green-600">✓</th>
                <th className="text-center px-3 py-3">Pend.</th>
                <th className="text-center px-3 py-3 text-red-500">Atras.</th>
                <th className="text-center px-3 py-3 text-amber-500">S/R</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...projetos]
                .sort((a: any, b: any) => a._stats.pct - b._stats.pct)
                .map((p: any) => {
                  const { pct, concluidas, pendentes, atrasadas, semResponsavel, total } = p._stats
                  const prazoVencido = p.dataPrazo && new Date(p.dataPrazo) < new Date()
                  return (
                    <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/operacional/${p.id}`} className="group block">
                          <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors leading-snug">
                            {p.imovelNome || p.cliente?.nome}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{p.codigo} · {p.tipoServico}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-xs ${p.responsavel ? 'text-gray-600' : 'text-amber-500 font-medium'}`}>
                          {p.responsavel?.nome || '— sem responsável'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-xs font-medium ${prazoVencido ? 'text-red-500' : 'text-gray-500'}`}>
                          {p.dataPrazo ? formatDate(p.dataPrazo) : '—'}
                          {prazoVencido && ' ⚠️'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {p.dataInicio ? (
                          <span className="text-xs text-gray-500">
                            {Math.max(0, Math.floor((Date.now() - new Date(p.dataInicio).getTime()) / 86_400_000))} dias
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                pct === 100 ? 'bg-green-500'
                                : atrasadas > 0 ? 'bg-red-400'
                                : pct >= 50 ? 'bg-amber-400'
                                : 'bg-indigo-400'
                              }`}
                              style={{ width: total > 0 ? `${pct}%` : '0%' }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-9 text-right shrink-0 ${pct === 100 ? 'text-green-600' : 'text-gray-600'}`}>
                            {total > 0 ? `${pct}%` : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-semibold text-green-600">{concluidas}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-medium text-gray-500">{pendentes}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-bold ${atrasadas > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                          {atrasadas > 0 ? atrasadas : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-bold ${semResponsavel > 0 ? 'text-amber-500' : 'text-gray-300'}`}>
                          {semResponsavel > 0 ? semResponsavel : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
          {projetos.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum projeto operacional encontrado
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function OperacionalPage() {
  const router = useRouter()
  const [projetos, setProjetos]           = useState<any[]>([])
  const [contagens, setContagens]         = useState<Record<string, number>>({})
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filtro, setFiltro]               = useState('')
  // Quick view drawer
  const [quickView, setQuickView]         = useState<any | null>(null)
  useLockBodyScroll(!!quickView)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  // Gestão de Projetos
  const [currentUser, setCurrentUser]     = useState<any>(null)
  const [modoGestao, setModoGestao]       = useState(false)
  const [gestaoData, setGestaoData]       = useState<any>(null)
  const [loadingGestao, setLoadingGestao] = useState(false)

  // Abre o drawer lateral com dados completos do projeto
  async function abrirQuickView(e: React.MouseEvent, projetoId: string) {
    e.preventDefault()
    e.stopPropagation()
    setQuickView({ _loading: true, id: projetoId })
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/projetos/${projetoId}`)
      const data = await res.json()
      setQuickView(data.projeto || null)
    } catch {
      toast.error('Erro ao carregar detalhes')
      setQuickView(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Fecha drawer ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setQuickView(null)
      }
    }
    if (quickView) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [quickView])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('etapas', ETAPAS_OPERACIONAL)
      // Exclui projetos importados só para monitoramento — EXCETO na aba
      // "Concluído", onde queremos ver também os que já foram protocolados
      // e seguiram para Acompanhamento (senão eles somem sem nunca aparecer
      // como concluídos aqui no Operacional).
      if (filtro !== 'CONCLUIDO') {
        params.set('emAcompanhamento', 'false')
      }
      if (filtro) params.set('statusOperacional', filtro)
      if (search)  params.set('search', search)
      const res = await fetch(`/api/projetos?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProjetos(data.projetos)
    } catch {
      toast.error('Erro ao carregar projetos')
    } finally {
      setLoading(false)
    }
  }, [filtro, search])

  // Contadores das abas — busca INDEPENDENTE da aba selecionada, para que o
  // número de cada aba não mude conforme o usuário clica em outra (bug
  // relatado: "Todos" mostrava 3 numa aba e 16 noutra).
  const carregarContagens = useCallback(async () => {
    try {
      const base = new URLSearchParams()
      base.set('etapas', ETAPAS_OPERACIONAL)
      if (search) base.set('search', search)

      const paramsAtivos = new URLSearchParams(base)
      paramsAtivos.set('emAcompanhamento', 'false')

      const paramsConcluidos = new URLSearchParams(base)
      paramsConcluidos.set('statusOperacional', 'CONCLUIDO')
      // sem emAcompanhamento aqui — conta também os já protocolados/em Acompanhamento

      const [resAtivos, resConcluidos] = await Promise.all([
        fetch(`/api/projetos?${paramsAtivos}`),
        fetch(`/api/projetos?${paramsConcluidos}`),
      ])
      const [dataAtivos, dataConcluidos] = await Promise.all([
        resAtivos.ok ? resAtivos.json() : { projetos: [] },
        resConcluidos.ok ? resConcluidos.json() : { projetos: [] },
      ])

      const porStatus: Record<string, number> = {}
      for (const p of dataAtivos.projetos || []) {
        porStatus[p.statusOperacional] = (porStatus[p.statusOperacional] || 0) + 1
      }
      const totalTodos = Object.values(porStatus).reduce((a: number, b: number) => a + b, 0)
      porStatus['CONCLUIDO'] = (dataConcluidos.projetos || []).length
      porStatus[''] = totalTodos

      setContagens(porStatus)
    } catch {
      // contadores não são críticos — falha silenciosa
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    const t = setTimeout(carregarContagens, 300)
    return () => clearTimeout(t)
  }, [carregarContagens])

  // Carrega usuário atual
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUser(d.usuario || null))
  }, [])

  const loadGestao = useCallback(async () => {
    setLoadingGestao(true)
    try {
      const res = await fetch('/api/projetos/gestao')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGestaoData(data)
    } catch {
      toast.error('Erro ao carregar dados de gestão')
    } finally {
      setLoadingGestao(false)
    }
  }, [])

  function toggleGestao() {
    const abrir = !modoGestao
    setModoGestao(abrir)
    if (abrir && !gestaoData) loadGestao()
  }

  const podeVerGestao = currentUser && ROLES_GESTAO.includes(currentUser.role)

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento Operacional</h1>
          <p className="text-gray-500 text-sm mt-1">
            Projetos liberados pelo financeiro — clique em um projeto para ver detalhes e atribuir tarefas
          </p>
        </div>
        {podeVerGestao && (
          <button
            onClick={toggleGestao}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              modoGestao
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Gestão de Projetos
          </button>
        )}
      </div>

      {/* Painel de Gestão */}
      {modoGestao && podeVerGestao && (
        <PainelGestao data={gestaoData} loading={loadingGestao} onRefresh={loadGestao} />
      )}
      {modoGestao && <div className="border-t border-gray-200" />}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map(f => {
          const count = contagens[f.value] ?? 0
          return (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filtro === f.value
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-green-300'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs ${filtro === f.value ? 'opacity-80' : 'opacity-50'}`}>
                ({count})
              </span>
            </button>
          )
        })}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, código ou município..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
        />
      </div>

      {/* Lista de projetos */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projetos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum projeto operacional encontrado</p>
          <p className="text-sm mt-1 text-gray-400">
            Projetos aparecem aqui após o financeiro registrar o primeiro pagamento
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projetos.map(projeto => {
            const aguardandoPlanejamento = projeto.etapaPipeline === 'OPERACIONAL'

            return (
              <Link
                key={projeto.id}
                href={`/operacional/${projeto.id}`}
                className="group bg-white rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
              >
                {aguardandoPlanejamento && <div className="bg-amber-400 h-1 w-full" />}

                <div className="p-5 flex-1 flex flex-col">
                  {/* Topo: código + status + botão info */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs text-gray-400">{projeto.codigo}</span>
                      <p className="font-semibold text-gray-900 mt-0.5 group-hover:text-green-700 transition-colors leading-snug">
                        {projeto.imovelNome || projeto.cliente?.nome}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{projeto.tipoServico}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[projeto.statusOperacional]}`}>
                        {STATUS_OPERACIONAL_LABELS[projeto.statusOperacional]}
                      </span>
                      {aguardandoPlanejamento && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <AlertCircle className="w-3 h-3" /> Planejar
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 flex-1">
                    {projeto.municipio && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        <span>{projeto.municipio}{projeto.estado ? ` / ${projeto.estado}` : ''}</span>
                      </div>
                    )}
                    {projeto.responsavel ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <User className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        <span>{projeto.responsavel.nome}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-amber-500">
                        <User className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Responsável não definido</span>
                      </div>
                    )}
                    {projeto.dataPrazo && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        <span>Prazo: {formatDate(projeto.dataPrazo)}</span>
                      </div>
                    )}
                  </div>

                  {/* Rodapé: contadores + botão info + seta */}
                  <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-3">
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-1">
                      <span className="flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5" />
                        {projeto._count?.tarefas || 0} tarefas
                      </span>
                      <span>📷 {projeto._count?.vistorias || 0}</span>
                      <span>📎 {projeto._count?.documentos || 0}</span>
                    </div>
                    {/* Botão de visualização rápida */}
                    <button
                      onClick={e => abrirQuickView(e, projeto.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                      title="Ver dados rápidos"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600 group-hover:gap-2 transition-all">
                      Abrir <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          DRAWER DE VISUALIZAÇÃO RÁPIDA
          ══════════════════════════════════════════════════════════ */}
      {quickView && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40" />

          {/* Painel lateral */}
          <div
            ref={drawerRef}
            className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            style={{ animation: 'slideIn 0.2s ease-out' }}
          >
            <style>{`
              @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
              }
            `}</style>

            {/* Header do drawer */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs text-gray-400">{quickView.codigo}</span>
                <p className="font-bold text-gray-900 leading-snug truncate">
                  {quickView.imovelNome || quickView.cliente?.nome || '…'}
                </p>
                {quickView.statusOperacional && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[quickView.statusOperacional]}`}>
                    {STATUS_OPERACIONAL_LABELS[quickView.statusOperacional]}
                  </span>
                )}
              </div>
              <button
                onClick={() => setQuickView(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-3"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do drawer */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingDetail ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {/* Dados básicos */}
                  <div className="space-y-2">
                    {[
                      { icon: <Layers className="w-4 h-4" />, label: 'Serviço', value: quickView.tipoServico },
                      { icon: <MapPin className="w-4 h-4" />, label: 'Local', value: [quickView.municipio, quickView.estado].filter(Boolean).join(' / ') || '—' },
                      { icon: <User className="w-4 h-4" />, label: 'Responsável', value: quickView.responsavel?.nome || 'Não atribuído' },
                      { icon: <User className="w-4 h-4" />, label: 'Cliente', value: quickView.cliente?.nome || '—' },
                      { icon: <Calendar className="w-4 h-4" />, label: 'Prazo', value: quickView.dataPrazo ? formatDate(quickView.dataPrazo) : '—' },
                      { icon: <BarChart2 className="w-4 h-4" />, label: 'Área', value: quickView.areaHectares ? `${Number(quickView.areaHectares).toLocaleString('pt-BR')} ha` : '—' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <span className="text-gray-300 mt-0.5 flex-shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400">{item.label}</span>
                          <p className="font-medium text-gray-800 truncate">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Contrato */}
                  {quickView.contrato && (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contrato</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Valor total</span>
                        <span className="font-semibold">{formatCurrency(quickView.contrato.valorTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Status</span>
                        <span className="font-medium text-gray-700">{quickView.contrato.statusContrato}</span>
                      </div>
                    </div>
                  )}

                  {/* Tarefas resumo */}
                  {quickView.tarefas && quickView.tarefas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tarefas</p>
                      <div className="space-y-1">
                        {(() => {
                          const total     = quickView.tarefas.length
                          const concluidas = quickView.tarefas.filter((t: any) => t.status === 'CONCLUIDA').length
                          const pct       = Math.round((concluidas / total) * 100)
                          return (
                            <>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-500">{concluidas} de {total} concluídas</span>
                                <span className="font-semibold text-gray-800">{pct}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-green-400'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Credenciais (bloqueadas) */}
                  {quickView.credenciais && (
                    <div className="bg-amber-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-1">
                        <Lock className="w-3.5 h-3.5" /> Credenciais registradas
                      </p>
                      <p className="text-xs text-gray-500">
                        {Object.keys(JSON.parse(quickView.credenciais)).join(', ')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer do drawer */}
            <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-gray-50">
              <Link
                href={`/operacional/${quickView.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Abrir projeto completo <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
