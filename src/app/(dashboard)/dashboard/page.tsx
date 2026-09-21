'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Briefcase, FileText, MapPin, DollarSign, TrendingUp, AlertTriangle, Clock, CheckCircle, Search, ArrowRight, User } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { ModalProjeto } from '@/components/modals/ModalProjeto'

// Labels e cores do pipeline
const ETAPA_LABELS: Record<string, string> = {
  SOLICITACAO:         'Nova Solicitação',
  EM_ANALISE_RAPIDA:   'Em Análise Rápida',
  ANALISE_CONCLUIDA:   'Análise Concluída',
  EM_NEGOCIACAO:       'Em Negociação',
  PROPOSTA_ACEITA:     'Proposta Aceita',
  AGUARDANDO_CONTRATO: 'Aguard. Contrato',
  EM_CONTRATO:         'Em Contrato',
  AGUARDANDO_SINAL:    'Aguard. Sinal',
  OPERACIONAL:         'Iniciar Operação',
  EM_EXECUCAO:         'Em Execução',
  CONCLUIDO:           'Concluído',
  CANCELADO:           'Cancelado',
}

const ETAPA_CORES: Record<string, string> = {
  SOLICITACAO:         '#94a3b8',
  EM_ANALISE_RAPIDA:   '#f59e0b',
  ANALISE_CONCLUIDA:   '#3b82f6',
  EM_NEGOCIACAO:       '#8b5cf6',
  PROPOSTA_ACEITA:     '#06b6d4',
  AGUARDANDO_CONTRATO: '#ec4899',
  EM_CONTRATO:         '#14b8a6',
  AGUARDANDO_SINAL:    '#f97316',
  OPERACIONAL:         '#6366f1',
  EM_EXECUCAO:         '#22c55e',
  CONCLUIDO:           '#16a34a',
  CANCELADO:           '#ef4444',
}

const ETAPA_BADGES: Record<string, string> = {
  SOLICITACAO:         'bg-gray-100 text-gray-700',
  EM_ANALISE_RAPIDA:   'bg-yellow-100 text-yellow-800',
  ANALISE_CONCLUIDA:   'bg-blue-100 text-blue-800',
  EM_NEGOCIACAO:       'bg-purple-100 text-purple-800',
  PROPOSTA_ACEITA:     'bg-cyan-100 text-cyan-800',
  AGUARDANDO_CONTRATO: 'bg-pink-100 text-pink-800',
  EM_CONTRATO:         'bg-teal-100 text-teal-800',
  AGUARDANDO_SINAL:    'bg-orange-100 text-orange-800',
  OPERACIONAL:         'bg-indigo-100 text-indigo-800',
  EM_EXECUCAO:         'bg-green-100 text-green-800',
  CONCLUIDO:           'bg-green-200 text-green-900',
  CANCELADO:           'bg-red-100 text-red-800',
}

// ─── Views por perfil ──────────────────────────────────────────

function ViewAnalistaRapido({ dados }: { dados: any }) {
  const { estatisticas, projetos } = dados
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minha Área — Análise Técnica</h1>
        <p className="text-gray-500 text-sm mt-1">Projetos atribuídos para análise de viabilidade</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Aguardando análise', value: estatisticas.aguardando, cor: 'bg-yellow-100 text-yellow-700', icon: Clock },
          { label: 'Em análise', value: estatisticas.emAnalise, cor: 'bg-blue-100 text-blue-700', icon: Search },
          { label: 'Concluídos', value: estatisticas.concluidos, cor: 'bg-green-100 text-green-700', icon: CheckCircle },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${card.cor}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Projetos Atribuídos</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {projetos.length === 0 ? (
            <div className="py-12 text-center text-gray-400"><p>Nenhum projeto atribuído</p></div>
          ) : projetos.map((p: any) => (
            <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-medium text-gray-900">{p.codigo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ETAPA_BADGES[p.etapaPipeline] || 'bg-gray-100 text-gray-700'}`}>
                    {ETAPA_LABELS[p.etapaPipeline] || p.etapaPipeline}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{p.imovelNome || p.tipoServico}</p>
                <p className="text-xs text-gray-400">{p.cliente?.nome} • {p.municipio || 'sem município'} • {p.areaHectares ? `${p.areaHectares} ha` : ''}</p>
              </div>
              <div className="text-xs text-gray-400">{formatDate(p.criadoEm)}</div>
              <Link
                href={`/comercial`}
                className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                Analisar <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ViewAnalista({ dados }: { dados: any }) {
  const { estatisticas, projetos, proximasVistorias, minhasTarefas } = dados
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minha Área — Operacional</h1>
        <p className="text-gray-500 text-sm mt-1">Projetos e atividades sob sua responsabilidade</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Projetos Ativos', value: estatisticas.ativos, cor: 'bg-blue-100 text-blue-700', icon: Briefcase },
          { label: 'Tarefas Pendentes', value: estatisticas.tarefasPendentes, cor: 'bg-yellow-100 text-yellow-700', icon: Clock },
          { label: 'Concluídos', value: estatisticas.concluidos, cor: 'bg-green-100 text-green-700', icon: CheckCircle },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${card.cor}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {minhasTarefas?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Minhas Atividades</h3>
            <p className="text-xs text-gray-400 mt-0.5">Tarefas que foram atribuídas a você</p>
          </div>
          <div className="divide-y divide-gray-50">
            {minhasTarefas.map((t: any) => {
              const atrasada = t.prazo && new Date(t.prazo) < new Date()
              return (
                <Link key={t.id} href={`/operacional/${t.projeto?.id}`}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${atrasada ? 'bg-red-500' : 'bg-yellow-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.titulo}</p>
                    <p className="text-xs text-gray-400">{t.projeto?.codigo} • {t.projeto?.imovelNome}</p>
                  </div>
                  {t.prazo && (
                    <span className={`text-xs font-medium flex-shrink-0 ${atrasada ? 'text-red-600' : 'text-gray-500'}`}>
                      {atrasada ? '⚠️ ' : ''}{formatDate(t.prazo)}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Meus Projetos</h3>
            <Link href="/operacional" className="text-xs text-green-600 font-medium">Ver todos →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {projetos.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">Nenhum projeto ativo</div>
            ) : projetos.map((p: any) => (
              <Link key={p.id} href={`/operacional/${p.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.imovelNome || p.tipoServico}</p>
                  <p className="text-xs text-gray-400">{p.codigo} • {p.cliente?.nome}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ETAPA_BADGES[p.etapaPipeline] || 'bg-gray-100 text-gray-700'}`}>
                  {ETAPA_LABELS[p.etapaPipeline]}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Próximas Vistorias</h3>
            <Link href="/campo" className="text-xs text-green-600 font-medium">Ver todas →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {proximasVistorias?.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">Nenhuma vistoria agendada</div>
            ) : proximasVistorias?.map((v: any) => (
              <div key={v.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{v.titulo}</p>
                  <p className="text-xs text-gray-400">{v.projeto?.codigo}</p>
                </div>
                <span className="text-xs font-medium text-blue-600">{formatDate(v.dataAgendada)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ViewGestorOperacional({ dados }: { dados: any }) {
  const { estatisticas, projetos, proximasVistorias } = dados
  const { novos, andamento, concluidos, tarefasAtrasadas, tarefasConcluidas, tarefasTotais, taxaEficiencia } = estatisticas

  const eficienciaCor = taxaEficiencia >= 70 ? 'text-green-600' : taxaEficiencia >= 40 ? 'text-yellow-600' : 'text-red-600'
  const eficienciaBar = taxaEficiencia >= 70 ? 'bg-green-500' : taxaEficiencia >= 40 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minha Área — Gestão Operacional</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral dos projetos em execução e análise de eficiência</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Para atribuir', value: novos, cor: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
          { label: 'Em execução', value: andamento, cor: 'bg-blue-100 text-blue-700', icon: TrendingUp },
          { label: 'Concluídos', value: concluidos, cor: 'bg-green-100 text-green-700', icon: CheckCircle },
          { label: 'Tarefas atrasadas', value: tarefasAtrasadas ?? 0, cor: 'bg-red-100 text-red-700', icon: AlertTriangle },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.cor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-600" />
          Análise de Eficiência Operacional
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">Taxa de conclusão de atividades</p>
              <p className={`text-lg font-bold ${eficienciaCor}`}>{taxaEficiencia ?? 0}%</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${eficienciaBar}`} style={{ width: `${taxaEficiencia ?? 0}%` }} />
            </div>
            <p className="text-xs text-gray-400">{tarefasConcluidas ?? 0} concluídas de {(tarefasConcluidas ?? 0) + (tarefasTotais ?? 0)} no mês</p>
          </div>
          <div className="flex flex-col justify-center border-l border-gray-100 pl-6">
            <p className="text-xs text-gray-400 mb-1">Tarefas pendentes (projetos ativos)</p>
            <p className="text-2xl font-bold text-gray-900">{tarefasTotais ?? 0}</p>
            {(tarefasAtrasadas ?? 0) > 0 && (
              <p className="text-xs text-red-600 mt-1">⚠️ {tarefasAtrasadas} atrasada(s)</p>
            )}
          </div>
          <div className="flex flex-col justify-center border-l border-gray-100 pl-6">
            <p className="text-xs text-gray-400 mb-1">Projetos em execução</p>
            <p className="text-2xl font-bold text-blue-600">{andamento}</p>
            <p className="text-xs text-gray-400 mt-1">+ {novos} aguardando início</p>
          </div>
        </div>
      </div>

      {novos > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Atenção: {novos} projeto(s) aguardando atribuição de analista</p>
            <p className="text-xs text-orange-600 mt-0.5">Acesse o módulo Operacional para designar responsáveis e definir prazos.</p>
          </div>
          <Link href="/operacional" className="ml-auto text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            Ir para Operacional
          </Link>
        </div>
      )}

      {proximasVistorias?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Próximas Vistorias (30 dias)</h3>
            <Link href="/campo" className="text-xs text-green-600 font-medium">Ver todas →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {proximasVistorias.map((v: any) => (
              <div key={v.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{v.titulo}</p>
                  <p className="text-xs text-gray-400">{v.projeto?.codigo} {v.responsavel?.nome ? `• ${v.responsavel.nome}` : ''}</p>
                </div>
                <span className="text-xs font-medium text-blue-600 flex-shrink-0">{formatDate(v.dataAgendada)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Projetos em Operação</h3>
          <Link href="/operacional" className="text-xs text-green-600 font-medium">Ver todos →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {projetos.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">Nenhum projeto em operação</div>
          ) : projetos.map((p: any) => (
            <Link key={p.id} href={`/operacional/${p.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.imovelNome || p.tipoServico}</p>
                <p className="text-xs text-gray-400">
                  {p.codigo} • {p.cliente?.nome}
                  {p.responsavel?.nome ? ` • Resp: ${p.responsavel.nome}` : ' • Sem responsável'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {p._count?.tarefas > 0 && (
                  <span className="text-xs text-gray-400">{p._count.tarefas} tarefa(s)</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${ETAPA_BADGES[p.etapaPipeline] || 'bg-gray-100 text-gray-700'}`}>
                  {ETAPA_LABELS[p.etapaPipeline]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function ViewFinanceiro({ dados }: { dados: any }) {
  const { estatisticas, projetos, pagamentosProximos } = dados
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minha Área — Financeiro</h1>
        <p className="text-gray-500 text-sm mt-1">Controle de recebimentos e pagamentos</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Aguardando sinal', value: String(estatisticas.aguardandoSinal), cor: 'bg-orange-100 text-orange-700', icon: Clock, tipo: 'numero' },
          { label: 'A receber', value: formatCurrency(estatisticas.totalPendente), cor: 'bg-blue-100 text-blue-700', icon: DollarSign, tipo: 'valor' },
          { label: 'Qtd. pendentes', value: String(estatisticas.qtdPendente), cor: 'bg-yellow-100 text-yellow-700', icon: FileText, tipo: 'numero' },
          { label: 'Vencidos', value: formatCurrency(estatisticas.totalVencido), cor: 'bg-red-100 text-red-700', icon: AlertTriangle, tipo: 'valor' },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.cor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className={`font-bold text-gray-900 ${card.tipo === 'valor' ? 'text-lg' : 'text-2xl'}`}>{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>
      {estatisticas.aguardandoSinal > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">{estatisticas.aguardandoSinal} contrato(s) aguardando recebimento do sinal</p>
            <p className="text-xs text-orange-600 mt-0.5">Quando receber o sinal, confirme no financeiro para liberar o projeto para operações.</p>
          </div>
          <Link href="/financeiro" className="text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            Ver Financeiro
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Projetos Ativos</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {projetos.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.cliente?.nome}</p>
                  <p className="text-xs text-gray-400">{p.codigo}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(p.contrato?.valorTotal)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ETAPA_BADGES[p.etapaPipeline] || 'bg-gray-100 text-gray-700'}`}>
                    {ETAPA_LABELS[p.etapaPipeline]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Vencimentos próximos (30 dias)</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {pagamentosProximos?.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">Nenhum vencimento próximo</div>
            ) : pagamentosProximos?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.contrato?.cliente?.nome}</p>
                  <p className="text-xs text-gray-400">{p.descricao}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(p.valor)}</p>
                  <p className="text-xs text-orange-600 font-medium">{formatDate(p.dataVencimento)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ViewContratos({ dados }: { dados: any }) {
  const { estatisticas, projetos } = dados
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minha Área — Contratos</h1>
        <p className="text-gray-500 text-sm mt-1">Elaboração e gestão de contratos</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{estatisticas.aguardando}</p>
            <p className="text-xs text-gray-500 mt-0.5">Para elaborar</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{estatisticas.emContrato}</p>
            <p className="text-xs text-gray-500 mt-0.5">Em contrato</p>
          </div>
        </div>
      </div>
      {estatisticas.aguardando > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-pink-800">{estatisticas.aguardando} contrato(s) aguardando elaboração</p>
          </div>
          <Link href="/contratos" className="text-xs font-medium text-pink-700 bg-pink-100 hover:bg-pink-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            Elaborar Contratos
          </Link>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between">
          <h3 className="font-semibold text-gray-900">Projetos para contratualizar</h3>
          <Link href="/contratos" className="text-xs text-green-600 font-medium">Ver contratos →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {projetos.map((p: any) => (
            <Link key={p.id} href="/contratos" className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{p.cliente?.nome}</p>
                <p className="text-xs text-gray-400">{p.codigo} • {p.tipoServico}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${ETAPA_BADGES[p.etapaPipeline] || 'bg-gray-100 text-gray-700'}`}>
                {ETAPA_LABELS[p.etapaPipeline]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function ViewAdmin({ dados }: { dados: any }) {
  const { estatisticas, porEtapa, projetosRecentes, proximasVistorias, pagamentosProximos, evolucaoMensal } = dados
  const [modalOpen, setModalOpen] = useState(false)
  const [projetoSelecionado, setProjetoSelecionado] = useState<any>(null)

  const ETAPAS_PIPELINE = [
    'SOLICITACAO', 'EM_ANALISE_RAPIDA', 'ANALISE_CONCLUIDA', 'EM_NEGOCIACAO',
    'PROPOSTA_ACEITA', 'AGUARDANDO_CONTRATO', 'EM_CONTRATO', 'AGUARDANDO_SINAL', 'OPERACIONAL', 'EM_EXECUCAO',
  ]
  const etapaMap = Object.fromEntries((porEtapa || []).map((e: any) => [e.etapa, e.count]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Gerencial</h1>
        <p className="text-gray-500 text-sm mt-1">Visão completa do pipeline Ecdise</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Projetos', value: estatisticas.totalProjetos, cor: 'bg-blue-100 text-blue-700', icon: Briefcase },
          { label: 'Em Andamento', value: estatisticas.projetosAtivos, cor: 'bg-green-100 text-green-700', icon: TrendingUp },
          { label: 'Tarefas Atrasadas', value: estatisticas.tarefasAtrasadas, cor: 'bg-red-100 text-red-700', icon: AlertTriangle },
          { label: 'Concluídos', value: estatisticas.projetosConcluidos, cor: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${card.cor}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Pipeline de Projetos</h3>
        <div className="grid grid-cols-5 lg:grid-cols-10 gap-2">
          {ETAPAS_PIPELINE.map((etapa) => {
            const count = etapaMap[etapa] || 0
            return (
              <div key={etapa} className="flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-xl flex items-center justify-center font-bold text-white text-lg"
                  style={{ backgroundColor: ETAPA_CORES[etapa], minHeight: '56px' }}
                >
                  {count}
                </div>
                <p className="text-xs text-gray-500 text-center leading-tight">{ETAPA_LABELS[etapa]}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Projetos por Mês</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={evolucaoMensal} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="projetos" fill="#22c55e" radius={[4, 4, 0, 0]} name="Projetos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Distribuição do Pipeline</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={(porEtapa || []).filter((e: any) => e.count > 0 && e.etapa !== 'CONCLUIDO' && e.etapa !== 'CANCELADO').map((e: any) => ({
                  name: ETAPA_LABELS[e.etapa] || e.etapa,
                  value: e.count,
                  color: ETAPA_CORES[e.etapa] || '#94a3b8',
                }))}
                cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value"
              >
                {(porEtapa || []).filter((e: any) => e.count > 0).map((e: any, i: number) => (
                  <Cell key={i} fill={ETAPA_CORES[e.etapa] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => [v, 'Projetos']} />
              <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-xs">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between">
            <h3 className="font-semibold text-gray-900">Projetos Recentes</h3>
            <Link href="/comercial" className="text-xs text-green-600 font-medium">Ver todos →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {projetosRecentes?.map((p: any) => (
              <button
                key={p.id}
                onClick={() => { setProjetoSelecionado(p); setModalOpen(true) }}
                className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-50 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.imovelNome || p.tipoServico}</p>
                  <p className="text-xs text-gray-400">{p.cliente?.nome}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ETAPA_BADGES[p.etapaPipeline] || 'bg-gray-100 text-gray-700'}`}>
                    {ETAPA_LABELS[p.etapaPipeline] || p.etapaPipeline}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(p.criadoEm)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between">
            <h3 className="font-semibold text-gray-900">Próximas Vistorias</h3>
            <Link href="/campo" className="text-xs text-green-600 font-medium">Ver todas →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {proximasVistorias?.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">Nenhuma vistoria agendada</div>
            ) : proximasVistorias?.map((v: any) => (
              <div key={v.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{v.titulo}</p>
                  <p className="text-xs text-gray-400">{v.projeto?.codigo} • {v.responsavel?.nome}</p>
                </div>
                <span className="text-xs text-blue-600 font-medium flex-shrink-0">{formatDate(v.dataAgendada)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {pagamentosProximos?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Pagamentos Vencendo (30 dias)
            </h3>
            <Link href="/financeiro" className="text-xs text-green-600 font-medium">Ver financeiro →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {pagamentosProximos?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-4 py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{p.contrato?.cliente?.nome}</p>
                  <p className="text-xs text-gray-500">{p.descricao}</p>
                </div>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(p.valor)}</p>
                <p className="text-xs text-yellow-600 font-medium w-20 text-right">{formatDate(p.dataVencimento)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ModalProjeto
        open={modalOpen}
        onClose={() => { setModalOpen(false); setProjetoSelecionado(null) }}
        projeto={projetoSelecionado}
        modoAcao="editar"
        onSalvo={() => { setModalOpen(false); setProjetoSelecionado(null) }}
      />
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────

export default function DashboardPage() {
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) throw new Error()
        setDados(await res.json())
      } catch {
        toast.error('Erro ao carregar dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!dados) return null

  switch (dados.tipoView) {
    case 'analista_rapido':    return <ViewAnalistaRapido dados={dados} />
    case 'analista':           return <ViewAnalista dados={dados} />
    case 'gestor_operacional': return <ViewGestorOperacional dados={dados} />
    case 'financeiro':         return <ViewFinanceiro dados={dados} />
    case 'contratos':          return <ViewContratos dados={dados} />
    default:                   return <ViewAdmin dados={dados} />
  }
}
