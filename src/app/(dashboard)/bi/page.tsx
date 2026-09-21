'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { formatCurrency, ETAPA_LABELS } from '@/lib/utils'

const CORES = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f43f5e', '#0ea5e9', '#a855f7', '#f97316',
]

// Formata valor no eixo Y dos gráficos (ex: 1500 → 1,5k)
function fmtEixo(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000)    return `${(v / 1000).toFixed(0)}k`
  return String(v)
}

export default function BIPage() {
  const [dadosDash, setDadosDash]   = useState<any>(null)
  const [dadosBi, setDadosBi]       = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [atualizando, setAtualizando] = useState(false)

  async function load() {
    setAtualizando(true)
    try {
      const [resDash, resBi] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/bi'),
      ])
      if (resDash.ok) setDadosDash(await resDash.json())
      if (resBi.ok)   setDadosBi(await resBi.json())
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
      setAtualizando(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!dadosDash) return null

  const { estatisticas, porEtapa, evolucaoMensal } = dadosDash

  const pieData = (porEtapa || [])
    .filter((p: any) => p.count > 0)
    .map((p: any, i: number) => ({
      name:  ETAPA_LABELS[p.etapa] || p.etapa,
      value: p.count,
      color: CORES[i % CORES.length],
    }))

  // Dados financeiros reais (do /api/bi)
  const evolucaoFinanceira  = dadosBi?.evolucaoFinanceira  ?? []
  const totaisFinanceiros   = dadosBi?.totais              ?? {}
  const pagamentosPorForma  = dadosBi?.pagamentosPorForma  ?? []
  const servicosContratados = dadosBi?.servicosContratados ?? []
  const pendenciasPanorama  = dadosBi?.pendencias          ?? {}
  const tempos              = dadosBi?.tempos              ?? {}

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BI / Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Análise gerencial e indicadores de desempenho</p>
        </div>
        <button
          onClick={load}
          disabled={atualizando}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* KPIs de projetos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Projetos',   value: estatisticas.totalProjetos     ?? 0, color: 'bg-blue-600' },
          { label: 'Em Andamento',        value: estatisticas.projetosAtivos    ?? 0, color: 'bg-green-600' },
          { label: 'Concluídos',          value: estatisticas.projetosConcluidos ?? 0, color: 'bg-purple-600' },
          { label: 'Tarefas Atrasadas',   value: estatisticas.tarefasAtrasadas  ?? 0, color: 'bg-red-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className={`w-1.5 h-8 ${kpi.color} rounded-full mb-3`} />
            <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* KPIs financeiros reais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Recebido</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totaisFinanceiros.totalRecebido ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{totaisFinanceiros.qtdRecebido ?? 0} pagamento(s) confirmado(s)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">A Receber (Pendente)</p>
          <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totaisFinanceiros.totalPendente ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{totaisFinanceiros.qtdPendente ?? 0} pagamento(s) em aberto</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Vencido</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totaisFinanceiros.totalVencido ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{totaisFinanceiros.qtdVencido ?? 0} vencido(s) sem baixa</p>
        </div>
      </div>

      {/* Panorama de Pendências (Acompanhamento de Processos) */}
      <div>
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900">Pendências de Processos</h3>
          <p className="text-xs text-gray-400 mt-0.5">Panorama geral dos processos em acompanhamento ambiental</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pendências Abertas',     value: pendenciasPanorama.abertas     ?? 0, color: 'bg-amber-500' },
            { label: 'A Vencer (≤ 7 dias)',     value: pendenciasPanorama.aVencer     ?? 0, color: 'bg-orange-500' },
            { label: 'Atrasadas',               value: pendenciasPanorama.atrasadas   ?? 0, color: 'bg-red-600' },
            { label: 'Respondidas',             value: pendenciasPanorama.respondidas ?? 0, color: 'bg-green-600' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className={`w-1.5 h-8 ${kpi.color} rounded-full mb-3`} />
              <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tempos Médios — Operacional, Protocolo → Licença, Tratativa de Pendência */}
      <div>
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900">Tempos Médios</h3>
          <p className="text-xs text-gray-400 mt-0.5">Quanto tempo cada etapa está levando, em média</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="w-1.5 h-8 bg-indigo-500 rounded-full mb-3" />
            <p className="text-3xl font-bold text-gray-900">
              {tempos.operacionalDias != null ? `${tempos.operacionalDias}` : '—'}
              {tempos.operacionalDias != null && <span className="text-base font-medium text-gray-400"> dias</span>}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Tempo médio Operacional (início da execução até o protocolo no órgão)
            </p>
            <p className="text-[11px] text-gray-300 mt-1">
              {tempos.operacionalAmostra ?? 0} projeto(s) considerado(s)
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="w-1.5 h-8 bg-emerald-500 rounded-full mb-3" />
            <p className="text-3xl font-bold text-gray-900">
              {tempos.licencaDias != null ? `${tempos.licencaDias}` : '—'}
              {tempos.licencaDias != null && <span className="text-base font-medium text-gray-400"> dias</span>}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Tempo médio até a Licença (protocolo no órgão até a emissão)
            </p>
            <p className="text-[11px] text-gray-300 mt-1">
              {tempos.licencaAmostra ?? 0} projeto(s) considerado(s)
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="w-1.5 h-8 bg-amber-500 rounded-full mb-3" />
            <p className="text-3xl font-bold text-gray-900">
              {tempos.pendenciaDias != null ? `${tempos.pendenciaDias}` : '—'}
              {tempos.pendenciaDias != null && <span className="text-base font-medium text-gray-400"> dias</span>}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Tempo médio de tratativa de pendência com o órgão
            </p>
            <p className="text-[11px] text-gray-300 mt-1">
              {tempos.pendenciaAmostra ?? 0} pendência(s) respondida(s)
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recebimentos vs Pendências — dados REAIS do banco */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recebimentos vs Pendências</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Últimos 6 meses</span>
          </div>
          {evolucaoFinanceira.every((d: any) => d.recebido === 0 && d.pendente === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm flex-col gap-2">
              <span className="text-3xl">📊</span>
              <p>Nenhum pagamento registrado ainda</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={evolucaoFinanceira} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={fmtEixo} />
                <Tooltip formatter={(v: any) => [formatCurrency(Number(v))]} />
                <Bar dataKey="recebido" fill="#22c55e" radius={[4, 4, 0, 0]} name="Recebido" />
                <Bar dataKey="pendente" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Pendente" />
                <Legend iconType="circle" iconSize={8} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Evolução de novos projetos */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Novos Projetos por Mês</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Últimos 6 meses</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={evolucaoMensal || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="projetos"
                stroke="#22c55e"
                strokeWidth={3}
                dot={{ r: 4, fill: '#22c55e' }}
                name="Projetos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status dos projetos (pizza) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Status dos Projetos</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                    {pieData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, 'Projetos']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {pieData.map((entry: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-gray-600 truncate">{entry.name}: <strong>{entry.value}</strong></span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sem dados</div>
          )}
        </div>

        {/* Pagamentos por forma de pagamento */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recebimentos por Forma de Pagamento</h3>
          {pagamentosPorForma.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Nenhum pagamento confirmado ainda
            </div>
          ) : (
            <div className="space-y-3">
              {pagamentosPorForma.map((item: any, i: number) => {
                const totalGeral = pagamentosPorForma.reduce((s: number, p: any) => s + p.valor, 0)
                const pct = totalGeral > 0 ? (item.valor / totalGeral) * 100 : 0
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 font-medium">{item.forma}</span>
                      <span className="text-gray-900 font-semibold">
                        {formatCurrency(item.valor)}
                        <span className="text-xs text-gray-400 font-normal ml-1">({item.qtd}x)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: CORES[i % CORES.length] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Serviços mais contratados */}
      {servicosContratados.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Serviços Mais Contratados</h3>
          <p className="text-xs text-gray-400 mb-4">Baseado nos serviços registrados em projetos ativos e concluídos</p>
          <div className="space-y-3">
            {servicosContratados.map((item: any, i: number) => {
              const max = servicosContratados[0]?.qtd ?? 1
              const pct = (item.qtd / max) * 100
              return (
                <div key={i}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-700 font-medium">{item.nome}</span>
                    <div className="text-right flex-shrink-0 ml-4">
                      <span className="font-bold text-gray-900">{item.qtd} projeto(s)</span>
                      {item.valor > 0 && (
                        <span className="text-xs text-gray-400 ml-2">{formatCurrency(item.valor)}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: CORES[i % CORES.length] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Indicadores operacionais */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Indicadores Operacionais</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              label: 'Taxa de Conclusão',
              value: estatisticas.totalProjetos > 0
                ? `${Math.round((estatisticas.projetosConcluidos / estatisticas.totalProjetos) * 100)}%`
                : '0%',
              pct: estatisticas.totalProjetos > 0
                ? (estatisticas.projetosConcluidos / estatisticas.totalProjetos) * 100
                : 0,
              color: 'bg-green-500',
              sub: `${estatisticas.projetosConcluidos} de ${estatisticas.totalProjetos} projetos`,
            },
            {
              label: 'Projetos Ativos',
              value: `${Math.round((estatisticas.projetosAtivos / Math.max(estatisticas.totalProjetos, 1)) * 100)}%`,
              pct:   (estatisticas.projetosAtivos / Math.max(estatisticas.totalProjetos, 1)) * 100,
              color: 'bg-blue-500',
              sub:   `${estatisticas.projetosAtivos} em andamento`,
            },
            {
              label: 'Taxa de Cancelamento',
              value: `${Math.round(((estatisticas.projetosCancelados ?? 0) / Math.max(estatisticas.totalProjetos ?? 1, 1)) * 100)}%`,
              pct:   ((estatisticas.projetosCancelados ?? 0) / Math.max(estatisticas.totalProjetos ?? 1, 1)) * 100,
              color: 'bg-red-400',
              sub:   `${estatisticas.projetosCancelados ?? 0} cancelado(s)`,
            },
          ].map((ind) => (
            <div key={ind.label}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-600 font-medium">{ind.label}</span>
                <span className="font-bold text-gray-900">{ind.value}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${ind.color} rounded-full transition-all duration-700`}
                  style={{ width: `${Math.min(ind.pct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{ind.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
