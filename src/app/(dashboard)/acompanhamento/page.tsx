'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Search, FileSearch, ChevronRight, MapPin, FileText,
  Award, AlertCircle, Upload, RefreshCw, Clock,
  X, AlertTriangle, CheckCircle2, HelpCircle,
} from 'lucide-react'

// ── Categoriza pelo status das pendências registradas manualmente ──
// (Não depende mais do robô/verificação automática do SIGLA.)
type PendenciaCategoria = 'pendente' | 'ok'

function categorizarPendencia(projeto: any): PendenciaCategoria {
  const temAberta = (projeto.pendencias || []).some((p: any) => p.status === 'ABERTA')
  return temAberta ? 'pendente' : 'ok'
}

export default function AcompanhamentoPage() {
  const router = useRouter()
  const [projetos, setProjetos]       = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('emAcompanhamento', 'true')
      if (search) params.set('search', search)
      const res = await fetch(`/api/projetos?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProjetos(data.projetos || [])
    } catch {
      toast.error('Erro ao carregar processos')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  function servicoPrestado(projeto: any) {
    if (projeto.servicosContratados) {
      try {
        const lista = JSON.parse(projeto.servicosContratados)
        if (Array.isArray(lista) && lista.length > 0) return lista.join(', ')
      } catch {}
    }
    return projeto.tipoServico
  }

  function formatDataConsulta(dt: string | null) {
    if (!dt) return null
    const d = new Date(dt)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  // ── Separação em colunas ──
  const filtrar = (p: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.codigo?.toLowerCase().includes(q) ||
      p.cliente?.nome?.toLowerCase().includes(q) ||
      p.imovelNome?.toLowerCase().includes(q) ||
      p.municipio?.toLowerCase().includes(q)
    )
  }

  const visiveis     = projetos.filter(filtrar)
  // Coluna 1 — processos com pendência aberta registrada
  const pendentes    = visiveis.filter(p => categorizarPendencia(p) === 'pendente')
  // Coluna 2 — sem pendência aberta, ainda sem licença emitida
  const statusOk     = visiveis.filter(p => !p.licenca && categorizarPendencia(p) !== 'pendente')
  // Coluna 3 — licença registrada no sistema
  const licenciados  = visiveis.filter(p => !!p.licenca)

  const total        = projetos.length
  const emExigencia  = projetos.filter(p => categorizarPendencia(p) === 'pendente').length
  const semPend      = projetos.filter(p => categorizarPendencia(p) === 'ok' && !p.licenca).length
  const totalLicenc  = projetos.filter(p => !!p.licenca).length

  // ── Resumo de pendências formais (Pendencia/AcaoPendencia) por projeto ──
  const resumoPendencias = visiveis
    .map((p: any) => {
      const abertas = (p.pendencias || []).filter((pd: any) => pd.status === 'ABERTA')
      if (abertas.length === 0) return null
      const prazosValidos = abertas
        .map((pd: any) => pd.prazoResposta ? new Date(pd.prazoResposta).getTime() : null)
        .filter((t: number | null): t is number => t !== null && !isNaN(t))
      const prazoMaisProximo = prazosValidos.length > 0 ? new Date(Math.min(...prazosValidos)) : null
      const dias = prazoMaisProximo
        ? Math.ceil((prazoMaisProximo.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
        : null
      return { projeto: p, quantidade: abertas.length, prazo: prazoMaisProximo, dias }
    })
    .filter((x: any): x is NonNullable<typeof x> => x !== null)
    .sort((a: any, b: any) => (a.dias ?? 9999) - (b.dias ?? 9999))

  function corPrazo(dias: number | null) {
    if (dias === null) return 'text-gray-400'
    if (dias < 0) return 'text-red-700 font-bold'
    if (dias <= 3) return 'text-red-600 font-semibold'
    if (dias <= 7) return 'text-amber-600 font-semibold'
    return 'text-gray-600'
  }

  function textoPrazo(dias: number | null) {
    if (dias === null) return '—'
    if (dias < 0) return `Vencido há ${Math.abs(dias)}d`
    if (dias === 0) return 'Vence hoje'
    return `${dias} dia${dias > 1 ? 's' : ''}`
  }

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Acompanhamento de Processos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Registre as pendências de cada processo — a categorização aqui embaixo segue o que estiver aberto
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            href="/acompanhamento/importar"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors flex-1 sm:flex-none justify-center"
          >
            <Upload className="w-4 h-4" />
            Importar
          </Link>
        </div>
      </div>

      {/* ── Painel de resumo ──────────────────────────── */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total de processos</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{emExigencia}</p>
            <p className="text-xs text-red-500 mt-0.5">Com pendência aberta</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{semPend}</p>
            <p className="text-xs text-green-500 mt-0.5">Sem pendências</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totalLicenc}</p>
            <p className="text-xs text-emerald-500 mt-0.5">Licença emitida</p>
          </div>
        </div>
      )}

      {/* ── Busca + Atualizar ─────────────────────────── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, código ou município..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
          />
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors bg-white"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* ── Lista de pendências (com prazo) ────────────── */}
      {!loading && resumoPendencias.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              Pendências abertas ({resumoPendencias.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Cliente</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Fazenda</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Processo</th>
                  <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2">Qtd.</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Prazo</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Dias p/ vencer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {resumoPendencias.map(({ projeto: p, quantidade, prazo, dias }: any) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/acompanhamento/${p.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{p.cliente?.nome || '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{p.imovelNome || '—'}</td>
                    <td className="px-4 py-2.5 text-sm font-mono text-gray-600">{p.protocoloCodigoOrgao || p.codigo}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                        {quantidade}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">
                      {prazo ? prazo.toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className={`px-4 py-2.5 text-sm ${corPrazo(dias)}`}>
                      {textoPrazo(dias)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Duas Colunas ──────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileSearch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum processo em acompanhamento</p>
          <p className="text-sm mt-1">Use o botão <strong>Importar Processo</strong> para adicionar processos existentes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* ── Coluna 1: Pendência ────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 pb-1 border-b-2 border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="font-bold text-red-700 text-sm uppercase tracking-wide">Pendência</h2>
              <span className="ml-auto text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                {pendentes.length}
              </span>
            </div>

            {pendentes.length === 0 ? (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-red-200" />
                <p className="text-sm text-red-400 font-medium">Nenhuma pendência</p>
              </div>
            ) : (
              pendentes.map(projeto => (
                <ProjetoCard key={projeto.id} projeto={projeto} servicoPrestado={servicoPrestado} formatDataConsulta={formatDataConsulta} />
              ))
            )}
          </div>

          {/* ── Coluna 2: Status OK ────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 pb-1 border-b-2 border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <h2 className="font-bold text-green-700 text-sm uppercase tracking-wide">Status OK</h2>
              <span className="ml-auto text-xs font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">
                {statusOk.length}
              </span>
            </div>

            {statusOk.length === 0 ? (
              <div className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center">
                <HelpCircle className="w-10 h-10 mx-auto mb-2 text-green-200" />
                <p className="text-sm text-green-400 font-medium">Nenhum processo aqui</p>
              </div>
            ) : (
              statusOk.map(projeto => (
                <ProjetoCard key={projeto.id} projeto={projeto} servicoPrestado={servicoPrestado} formatDataConsulta={formatDataConsulta} />
              ))
            )}
          </div>

          {/* ── Coluna 3: Licença Emitida ──────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 pb-1 border-b-2 border-emerald-300">
              <Award className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-emerald-700 text-sm uppercase tracking-wide">Licença Emitida</h2>
              <span className="ml-auto text-xs font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                {licenciados.length}
              </span>
            </div>

            {licenciados.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center">
                <Award className="w-10 h-10 mx-auto mb-2 text-emerald-200" />
                <p className="text-sm text-emerald-400 font-medium">Nenhuma licença emitida ainda</p>
              </div>
            ) : (
              licenciados.map(projeto => (
                <ProjetoCard key={projeto.id} projeto={projeto} servicoPrestado={servicoPrestado} formatDataConsulta={formatDataConsulta} />
              ))
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ── Card de projeto ───────────────────────────────────────────
function ProjetoCard({ projeto, servicoPrestado, formatDataConsulta }: {
  projeto: any
  servicoPrestado: (p: any) => string
  formatDataConsulta: (dt: string | null) => string | null
}) {
  const licenciado   = !!projeto.licenca
  const pendenciasAbertas = (projeto.pendencias || []).filter((p: any) => p.status === 'ABERTA')
  const pendencias   = pendenciasAbertas.length
  const categoria: PendenciaCategoria = pendencias > 0 ? 'pendente' : 'ok'

  // Pega a pendência mais urgente (prazo mais próximo) para mostrar no card
  const pendenciaMaisUrgente = pendenciasAbertas.length > 0
    ? [...pendenciasAbertas].sort((a: any, b: any) =>
        new Date(a.prazoResposta).getTime() - new Date(b.prazoResposta).getTime()
      )[0]
    : null

  const bordas: Record<string, string> = {
    pendente: 'border-l-4 border-l-red-400',
    ok:       'border-l-4 border-l-green-400',
  }
  const badges: Record<string, string> = {
    pendente: 'bg-red-50 text-red-700 border border-red-100',
    ok:       'bg-green-50 text-green-700 border border-green-100',
  }
  const labels: Record<string, string> = {
    pendente: pendencias === 1 ? '🔴 1 pendência aberta' : `🔴 ${pendencias} pendências abertas`,
    ok:       '✅ Sem pendências',
  }

  return (
    <Link
      href={`/acompanhamento/${projeto.id}`}
      className={`group bg-white rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col ${bordas[categoria]}`}
    >
      {licenciado && <div className="bg-emerald-500 h-1 w-full" />}

      <div className="p-4 flex-1 flex flex-col gap-3">

        {/* Topo: nome + badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="font-mono text-xs text-gray-400">{projeto.codigo}</span>
            <p className="font-semibold text-gray-900 mt-0.5 group-hover:text-green-700 transition-colors leading-snug">
              {projeto.imovelNome || projeto.cliente?.nome}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{servicoPrestado(projeto)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {licenciado ? (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
                <Award className="w-3 h-3" /> Licenciado
              </span>
            ) : (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                Em processo
              </span>
            )}
            {pendencias > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                <AlertCircle className="w-3 h-3" /> {pendencias} pendência(s)
              </span>
            )}
          </div>
        </div>

        {/* Status de pendências (registro manual) */}
        <div className={`rounded-lg px-3 py-2 flex items-center justify-between gap-2 ${badges[categoria]}`}>
          <div className="min-w-0">
            <p className="text-xs font-semibold">{labels[categoria]}</p>
            {pendenciaMaisUrgente && (
              <p className="text-xs opacity-75 truncate mt-0.5">
                Nº {pendenciaMaisUrgente.numeroPedido} · prazo {formatDataConsulta(pendenciaMaisUrgente.prazoResposta)?.split(' ')[0]}
              </p>
            )}
          </div>
        </div>

        {/* Info secundária */}
        <div className="space-y-1">
          {(projeto.municipio || projeto.estado) && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              <span>{[projeto.municipio, projeto.estado].filter(Boolean).join(' / ')}</span>
            </div>
          )}
          {projeto.protocoloCodigoOrgao && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FileText className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              <span className="font-mono">Nº {projeto.protocoloCodigoOrgao}</span>
            </div>
          )}
          {projeto.protocoloData && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              <span>
                {projeto.licenca?.dataEmissao
                  ? `Protocolo → licença: ${Math.max(0, Math.floor((new Date(projeto.licenca.dataEmissao).getTime() - new Date(projeto.protocoloData).getTime()) / 86_400_000))} dias`
                  : `${Math.max(0, Math.floor((Date.now() - new Date(projeto.protocoloData).getTime()) / 86_400_000))} dias desde o protocolo`}
              </span>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">{projeto.cliente?.nome}</span>
          <span className="flex items-center gap-1 text-xs font-medium text-green-600 group-hover:gap-2 transition-all">
            Ver detalhes <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
