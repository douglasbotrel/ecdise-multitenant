'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'
import { toast } from 'sonner'
import { Plus, Search, Edit2, X, Users, Loader2, ChevronDown, ChevronUp, MapPin, Home } from 'lucide-react'

interface ClienteForm {
  nome: string
  cpfCnpj: string
  email: string
  telefone: string
  endereco: string
  municipio: string
  estado: string
  cep: string
  observacoes: string
}

const FORM_VAZIO: ClienteForm = {
  nome: '', cpfCnpj: '', email: '', telefone: '',
  endereco: '', municipio: '', estado: '', cep: '', observacoes: '',
}

function formFromCliente(c: any): ClienteForm {
  return {
    nome: c.nome || '',
    cpfCnpj: c.cpfCnpj || '',
    email: c.email || '',
    telefone: c.telefone || '',
    endereco: c.endereco || '',
    municipio: c.municipio || '',
    estado: c.estado || '',
    cep: c.cep || '',
    observacoes: c.observacoes || '',
  }
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  const [modalOpen, setModalOpen]             = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<any | null>(null)
  const [form, setForm]                       = useState<ClienteForm>(FORM_VAZIO)
  const [salvando, setSalvando]               = useState(false)
  const [expandido, setExpandido]             = useState<Record<string, boolean>>({})
  const [fazendaEditando, setFazendaEditando] = useState<any | null>(null)
  useLockBodyScroll(!!(modalOpen || fazendaEditando))
  const [formFazenda, setFormFazenda]         = useState({ nome: '', municipio: '', estado: '', car: '', area: '' })
  const [salvandoFazenda, setSalvandoFazenda] = useState(false)

  function fazendasDoCliente(c: any): { nome: string; municipio: string; estado: string; car: string; area: number | null; codigos: string[]; projetoIds: string[] }[] {
    const mapa = new Map<string, { nome: string; municipio: string; estado: string; car: string; area: number | null; codigos: string[]; projetoIds: string[] }>()
    for (const p of c.projetos || []) {
      const chave = `${p.imovelNome || 'Sem nome do imóvel'}|${p.car || ''}`
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          nome: p.imovelNome || 'Sem nome do imóvel',
          municipio: p.municipio || c.municipio || '',
          estado: p.estado || c.estado || '',
          car: p.car || '',
          area: p.areaHectares ?? null,
          codigos: [p.codigo],
          projetoIds: [p.id],
        })
      } else {
        mapa.get(chave)!.codigos.push(p.codigo)
        mapa.get(chave)!.projetoIds.push(p.id)
      }
    }
    return Array.from(mapa.values())
  }

  function abrirEdicaoFazenda(f: any) {
    setFormFazenda({
      nome: f.nome === 'Sem nome do imóvel' ? '' : f.nome,
      municipio: f.municipio || '',
      estado: f.estado || '',
      car: f.car || '',
      area: f.area != null ? String(f.area) : '',
    })
    setFazendaEditando(f)
  }

  async function salvarFazenda() {
    if (!fazendaEditando) return
    setSalvandoFazenda(true)
    try {
      const payload = {
        imovelNome: formFazenda.nome || null,
        municipio: formFazenda.municipio || null,
        estado: formFazenda.estado || null,
        car: formFazenda.car || null,
        areaHectares: formFazenda.area ? parseFloat(formFazenda.area.replace(',', '.')) : null,
      }
      const resultados = await Promise.all(
        fazendaEditando.projetoIds.map((id: string) =>
          fetch(`/api/projetos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        )
      )
      if (resultados.some(r => !r.ok)) { toast.error('Erro ao salvar alguns projetos'); return }
      toast.success('Dados da fazenda atualizados!')
      setFazendaEditando(null)
      load()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSalvandoFazenda(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/clientes?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setClientes(data.clientes || [])
    } catch {
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  function abrirNovo() {
    setClienteSelecionado(null)
    setForm(FORM_VAZIO)
    setModalOpen(true)
  }

  function abrirEditar(cliente: any) {
    setClienteSelecionado(cliente)
    setForm(formFromCliente(cliente))
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setClienteSelecionado(null)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.cpfCnpj.trim()) {
      toast.error('Nome e CPF/CNPJ são obrigatórios')
      return
    }
    setSalvando(true)
    try {
      const editando = !!clienteSelecionado
      const res = await fetch(
        editando ? `/api/clientes/${clienteSelecionado.id}` : '/api/clientes',
        {
          method: editando ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar cliente')
        return
      }
      toast.success(editando ? 'Cliente atualizado!' : 'Cliente cadastrado!')
      fecharModal()
      load()
    } catch {
      toast.error('Erro ao salvar cliente')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{clientes.length} cliente(s) cadastrado(s)</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF/CNPJ, e-mail ou município..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
      </div>

      {/* Lista de clientes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Users className="w-8 h-8 mb-2" />
            <p className="font-medium">Nenhum cliente encontrado</p>
            <p className="text-sm mt-1">Cadastre um novo cliente ou ajuste a busca</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Nome</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">CPF/CNPJ</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Contato</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Local</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Projetos</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientes.map((c) => {
                  const fazendas = fazendasDoCliente(c)
                  const aberto = !!expandido[c.id]
                  return (
                  <Fragment key={c.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{c.nome}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-700">{c.cpfCnpj}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{c.email || <span className="text-gray-300">—</span>}</p>
                      <p className="text-xs text-gray-400">{c.telefone || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {c.municipio || '—'}{c.estado ? `/${c.estado}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {fazendas.length > 0 ? (
                        <button
                          onClick={() => setExpandido(p => ({ ...p, [c.id]: !p[c.id] }))}
                          className="flex items-center gap-1 text-sm text-green-700 font-medium hover:text-green-800"
                        >
                          {c._count?.projetos ?? 0} · {fazendas.length} fazenda{fazendas.length > 1 ? 's' : ''}
                          {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <span className="text-sm text-gray-600">{c._count?.projetos ?? 0}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => abrirEditar(c)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {aberto && fazendas.length > 0 && (
                    <tr key={`${c.id}-fazendas`} className="bg-gray-50/60">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {fazendas.map((f, i) => (
                            <div key={i} className="bg-white border border-gray-100 rounded-xl p-3">
                              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Home className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                  <p className="text-sm font-semibold text-gray-900 truncate">{f.nome}</p>
                                </div>
                                <button
                                  onClick={() => abrirEdicaoFazenda(f)}
                                  className="p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-md flex-shrink-0"
                                  title="Editar dados da fazenda"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="space-y-1 text-xs text-gray-500">
                                <p className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  {f.municipio || '—'}{f.estado ? `/${f.estado}` : ''}
                                </p>
                                <p>Área: {f.area != null ? `${Number(f.area).toLocaleString('pt-BR')} ha` : '—'}</p>
                                <p className="truncate" title={f.car}>CAR: {f.car || '—'}</p>
                                <p className="text-gray-400">Projeto(s): {f.codigos.join(', ')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de cadastro/edição ─────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={fecharModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <p className="font-bold text-gray-900">{clienteSelecionado ? 'Editar Cliente' : 'Novo Cliente'}</p>
              <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome / Razão Social *</label>
                  <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">CPF/CNPJ *</label>
                  <input type="text" value={form.cpfCnpj} onChange={e => setForm(f => ({ ...f, cpfCnpj: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
                  <input type="text" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Endereço</label>
                  <input type="text" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Município</label>
                  <input type="text" value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">UF</label>
                    <input type="text" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CEP</label>
                    <input type="text" value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                  <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={fecharModal}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edição de fazenda */}
      {fazendaEditando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setFazendaEditando(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-900">Editar Fazenda</p>
              <button onClick={() => setFazendaEditando(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome da Fazenda / Imóvel</label>
                <input
                  value={formFazenda.nome}
                  onChange={e => setFormFazenda(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Fazenda São João"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Município</label>
                  <input
                    value={formFazenda.municipio}
                    onChange={e => setFormFazenda(f => ({ ...f, municipio: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">UF</label>
                  <input
                    value={formFazenda.estado}
                    maxLength={2}
                    onChange={e => setFormFazenda(f => ({ ...f, estado: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Área (ha)</label>
                  <input
                    type="number" step="0.01"
                    value={formFazenda.area}
                    onChange={e => setFormFazenda(f => ({ ...f, area: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CAR</label>
                  <input
                    value={formFazenda.car}
                    onChange={e => setFormFazenda(f => ({ ...f, car: e.target.value }))}
                    placeholder="Número do CAR"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              {fazendaEditando.projetoIds.length > 1 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Essa fazenda está vinculada a {fazendaEditando.projetoIds.length} projetos ({fazendaEditando.codigos.join(', ')}) — os dados serão atualizados em todos eles.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setFazendaEditando(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={salvarFazenda} disabled={salvandoFazenda}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
                {salvandoFazenda && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
