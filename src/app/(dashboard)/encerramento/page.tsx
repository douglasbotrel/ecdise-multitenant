'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CheckSquare, Check, Lock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// Itens com `auto: true` são calculados a partir de dados reais do sistema —
// ninguém precisa lembrar de marcar, e não dá pra desmarcar manualmente
// (refletem o estado de verdade do projeto). Os demais são confirmações que
// só uma pessoa pode dar (ex: "laudo assinado", "cliente notificado") e ficam
// como checkbox manual, salvo no banco.
const CHECKLIST_ENCERRAMENTO = [
  { id: 'contrato_assinado',   label: 'Contrato assinado pelo cliente',              auto: true },
  { id: 'pagamento_quitado',   label: 'Pagamento totalmente quitado',                 auto: true },
  { id: 'protocolo_emitido',   label: 'Protocolo/licença emitido',                    auto: true },
  { id: 'documentos_entregues', label: 'Documentos técnicos entregues',              auto: false },
  { id: 'laudo_assinado',      label: 'Laudo técnico assinado pelo responsável',      auto: false },
  { id: 'arquivo_organizado',  label: 'Arquivos organizados no sistema',              auto: false },
  { id: 'cliente_notificado',  label: 'Cliente notificado sobre conclusão',           auto: false },
]

// Calcula o valor "de verdade" dos itens automáticos, a partir do projeto
function valorAutomatico(projeto: any, itemId: string): boolean {
  switch (itemId) {
    case 'contrato_assinado':
      return ['ASSINADO', 'ATIVO', 'FINALIZADO'].includes(projeto.contrato?.statusContrato)
    case 'pagamento_quitado':
      return projeto.contrato != null && Number(projeto.contrato.valorRestante ?? projeto.contrato.valorTotal) <= 0
    case 'protocolo_emitido':
      return !!projeto.protocoloData || !!projeto.licenca
    default:
      return false
  }
}

export default function EncerramentoPage() {
  const [projetos, setProjetos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Só os itens MANUAIS ficam nesse estado — os automáticos são recalculados
  // direto do projeto a cada render, nunca ficam "desatualizados".
  const [checklist, setChecklist] = useState<Record<string, Record<string, boolean>>>({})

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/projetos?statusOperacional=EM_ANDAMENTO')
        if (!res.ok) throw new Error()
        const data = await res.json()
        const filtrados = data.projetos.filter((p: any) => p.contrato)
        setProjetos(filtrados)

        const checklistInicial: Record<string, Record<string, boolean>> = {}
        for (const p of filtrados) {
          if (p.checklistEncerramento) {
            try { checklistInicial[p.id] = JSON.parse(p.checklistEncerramento) } catch {}
          }
        }
        setChecklist(checklistInicial)
      } catch {
        toast.error('Erro ao carregar projetos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function toggleCheck(projetoId: string, itemId: string) {
    const novoChecklistDoProjeto = {
      ...checklist[projetoId],
      [itemId]: !checklist[projetoId]?.[itemId],
    }
    setChecklist(prev => ({ ...prev, [projetoId]: novoChecklistDoProjeto }))
    try {
      const res = await fetch(`/api/projetos/${projetoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistEncerramento: JSON.stringify(novoChecklistDoProjeto) }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Não foi possível salvar essa marcação — tente novamente')
      setChecklist(prev => ({
        ...prev,
        [projetoId]: { ...prev[projetoId], [itemId]: !novoChecklistDoProjeto[itemId] },
      }))
    }
  }

  async function encerrarProjeto(projetoId: string, itensPendentes: number) {
    if (itensPendentes > 0) {
      toast.error(`Ainda há ${itensPendentes} item(ns) pendente(s) no checklist`)
      return
    }
    try {
      const res = await fetch(`/api/projetos/${projetoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusOperacional: 'CONCLUIDO',
          dataConclusao: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Projeto encerrado com sucesso!')
      setProjetos(prev => prev.filter(p => p.id !== projetoId))
    } catch {
      toast.error('Erro ao encerrar projeto')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Encerramento de Projetos</h1>
        <p className="text-gray-500 text-sm mt-1">
          Gerencie o checklist de encerramento e finalize projetos concluídos
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projetos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum projeto em andamento com contrato para encerrar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projetos.map((projeto) => {
            const manual = checklist[projeto.id] || {}
            const estados = CHECKLIST_ENCERRAMENTO.map(item => ({
              ...item,
              checked: item.auto ? valorAutomatico(projeto, item.id) : !!manual[item.id],
            }))
            const concluidos = estados.filter(i => i.checked).length
            const total = CHECKLIST_ENCERRAMENTO.length
            const pct = Math.round((concluidos / total) * 100)

            return (
              <div key={projeto.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header do projeto */}
                <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-gray-400">{projeto.codigo}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900">
                      {projeto.imovelNome || projeto.cliente?.nome}
                    </h3>
                    <p className="text-sm text-gray-500">{projeto.tipoServico} • {projeto.municipio}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{pct}%</p>
                    <p className="text-xs text-gray-400">{concluidos}/{total} itens</p>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="h-1.5 bg-gray-100">
                  <div
                    className={`h-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Checklist */}
                <div className="p-6">
                  <div className="space-y-2 mb-6">
                    {estados.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 ${item.auto ? '' : 'cursor-pointer group'}`}
                        onClick={() => !item.auto && toggleCheck(projeto.id, item.id)}
                      >
                        <button
                          type="button"
                          disabled={item.auto}
                          onClick={(e) => { e.stopPropagation(); if (!item.auto) toggleCheck(projeto.id, item.id) }}
                          className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                            item.checked
                              ? 'bg-green-600 border-green-600'
                              : 'border-gray-300 group-hover:border-green-400'
                          } ${item.auto ? 'cursor-default' : ''}`}
                        >
                          {item.checked && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <span className={`text-sm flex items-center gap-1.5 ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                          {item.label}
                          {item.auto && (
                            <span
                              className="flex items-center gap-0.5 text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-full no-underline"
                              title="Detectado automaticamente pelo sistema — não precisa marcar"
                            >
                              <Lock className="w-2.5 h-2.5" /> automático
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Dados do contrato */}
                  {projeto.contrato && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Contrato</p>
                        <p className="font-medium text-gray-900">{projeto.contrato.codigo}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Valor Total</p>
                        <p className="font-medium text-gray-900">{formatCurrency(projeto.contrato.valorTotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Status</p>
                        <p className="font-medium text-gray-900">{projeto.contrato.statusContrato}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Cliente</p>
                        <p className="font-medium text-gray-900">{projeto.cliente?.nome}</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => encerrarProjeto(projeto.id, total - concluidos)}
                    disabled={pct < 100}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                      pct === 100
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {pct === 100
                      ? '✅ Confirmar Encerramento do Projeto'
                      : `Complete o checklist (${total - concluidos} item(ns) restante(s))`
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
