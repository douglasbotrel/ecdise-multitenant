'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  Award, Plus, X, Search, Loader2, Calendar, MapPin, Ruler, FileText,
  Check, Circle, Trash2, ChevronDown, ChevronUp, Pencil, Map as MapIcon,
} from 'lucide-react'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'

// Carregado só no navegador — Leaflet precisa do DOM, não funciona em SSR
const MapaLicencas = dynamic(() => import('@/components/MapaLicencas'), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
      <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
    </div>
  ),
})

function formatData(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

// Converte graus/minutos/segundos para decimal (N e E ficam positivos; S e W, negativos)
function gmsParaDecimal(graus: string, min: string, seg: string, hemisferio: 'N' | 'S' | 'E' | 'W'): number | null {
  const g = parseFloat(graus)
  if (isNaN(g)) return null
  const m = parseFloat(min) || 0
  const s = parseFloat(seg) || 0
  const decimal = Math.abs(g) + m / 60 + s / 3600
  const negativo = hemisferio === 'S' || hemisferio === 'W'
  return negativo ? -decimal : decimal
}

// Converte decimal para graus/minutos/segundos — usado ao editar uma licença
// que já tem coordenada salva, pra pré-preencher o formulário em GMS também
function decimalParaGms(valor: number): { graus: string; min: string; seg: string } {
  const abs = Math.abs(valor)
  const graus = Math.floor(abs)
  const minFloat = (abs - graus) * 60
  const min = Math.floor(minFloat)
  const seg = Math.round((minFloat - min) * 60 * 100) / 100
  return { graus: String(graus), min: String(min), seg: String(seg) }
}

function maskCpfCnpj(value: string): string {
  const digitos = value.replace(/\D/g, '').slice(0, 14)
  if (digitos.length <= 11) {
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digitos
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function statusVigencia(dataValidade: string | Date | null | undefined): { label: string; cor: string } {
  if (!dataValidade) return { label: 'Sem validade definida', cor: 'bg-gray-100 text-gray-500' }
  const dias = Math.floor((new Date(dataValidade).getTime() - Date.now()) / 86_400_000)
  if (dias < 0) return { label: `Vencida há ${Math.abs(dias)}d`, cor: 'bg-red-100 text-red-700' }
  if (dias <= 90) return { label: `Vence em ${dias}d`, cor: 'bg-amber-100 text-amber-700' }
  return { label: 'Vigente', cor: 'bg-green-100 text-green-700' }
}

interface PlanoAcaoItem {
  id?: string
  descricao: string
  comoSeraFeito: string
  responsavelId: string
  prazo: string
  concluida?: boolean
}

const FORM_VAZIO = {
  id: '' as string | null,
  vinculo: 'projeto' as 'projeto' | 'avulsa',
  projetoId: '',
  clienteId: '',
  numero: '',
  dataEmissao: new Date().toISOString().split('T')[0],
  dataValidade: '',
  areaPermitida: '',
  atividadePermitida: '',
  latitude: '',
  longitude: '',
}

export default function LicencasPage() {
  const [licencas, setLicencas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [projetos, setProjetos] = useState<any[]>([])
  const [meRole, setMeRole] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [verMapa, setVerMapa] = useState(false)
  const [formatoCoord, setFormatoCoord] = useState<'decimal' | 'gms'>('decimal')
  const [gms, setGms] = useState({
    latGraus: '', latMin: '', latSeg: '', latHemis: 'S' as 'N' | 'S',
    lonGraus: '', lonMin: '', lonSeg: '', lonHemis: 'W' as 'E' | 'W',
  })
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [planoAcao, setPlanoAcao] = useState<PlanoAcaoItem[]>([])
  const [criandoCliente, setCriandoCliente] = useState(false)
  const [formNovoCliente, setFormNovoCliente] = useState({ nome: '', cpfCnpj: '', telefone: '' })
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [editandoCondicionanteId, setEditandoCondicionanteId] = useState<string | null>(null)
  const [formEdicaoCondicionante, setFormEdicaoCondicionante] = useState({
    descricao: '', comoSeraFeito: '', responsavelId: '', prazo: '', nota: '',
  })
  const [salvandoCondicionante, setSalvandoCondicionante] = useState(false)
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({})
  useLockBodyScroll(modalOpen)

  async function carregar() {
    setLoading(true)
    try {
      const res = await fetch(`/api/licencas${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro ao carregar licenças'); return }
      setLicencas(data.licencas || [])
    } catch { toast.error('Erro ao carregar licenças') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const t = setTimeout(carregar, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetch('/api/usuarios?ativo=true').then(r => r.json()).then(d => setUsuarios(d.usuarios || [])).catch(() => {})
    fetch('/api/auth/me').then(r => r.json()).then(d => setMeRole((d.usuario || d)?.role || null)).catch(() => {})
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(d.clientes || [])).catch(() => {})
    fetch('/api/projetos?limit=200').then(r => r.json()).then(d => setProjetos(d.projetos || [])).catch(() => {})
  }, [])

  function abrirNova() {
    setForm(FORM_VAZIO)
    setPlanoAcao([])
    setCriandoCliente(false)
    setFormNovoCliente({ nome: '', cpfCnpj: '', telefone: '' })
    setFormatoCoord('decimal')
    setGms({ latGraus: '', latMin: '', latSeg: '', latHemis: 'S', lonGraus: '', lonMin: '', lonSeg: '', lonHemis: 'W' })
    setModalOpen(true)
  }

  async function criarClienteRapido() {
    if (!formNovoCliente.nome.trim() || !formNovoCliente.cpfCnpj.trim()) {
      toast.error('Nome e CPF/CNPJ são obrigatórios')
      return
    }
    setSalvandoCliente(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formNovoCliente.nome.trim(),
          cpfCnpj: formNovoCliente.cpfCnpj,
          telefone: formNovoCliente.telefone || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro ao criar cliente'); return }
      toast.success('Cliente cadastrado!')
      setClientes(prev => [...prev, data.cliente])
      setForm(f => ({ ...f, clienteId: data.cliente.id }))
      setCriandoCliente(false)
      setFormNovoCliente({ nome: '', cpfCnpj: '', telefone: '' })
    } catch { toast.error('Erro ao criar cliente') }
    finally { setSalvandoCliente(false) }
  }

  function abrirEdicao(l: any) {
    setForm({
      id: l.id,
      vinculo: l.projetoId ? 'projeto' : 'avulsa',
      projetoId: l.projetoId || '',
      clienteId: l.clienteId || l.projeto?.cliente?.id || '',
      numero: l.numero,
      dataEmissao: l.dataEmissao ? l.dataEmissao.split('T')[0] : '',
      dataValidade: l.dataValidade ? l.dataValidade.split('T')[0] : '',
      areaPermitida: l.areaPermitida != null ? String(l.areaPermitida) : '',
      atividadePermitida: l.atividadePermitida || '',
      latitude: l.latitude != null ? String(l.latitude) : '',
      longitude: l.longitude != null ? String(l.longitude) : '',
    })
    setFormatoCoord('decimal')
    if (l.latitude != null && l.longitude != null) {
      const gLat = decimalParaGms(l.latitude)
      const gLon = decimalParaGms(l.longitude)
      setGms({
        latGraus: gLat.graus, latMin: gLat.min, latSeg: gLat.seg, latHemis: l.latitude < 0 ? 'S' : 'N',
        lonGraus: gLon.graus, lonMin: gLon.min, lonSeg: gLon.seg, lonHemis: l.longitude < 0 ? 'W' : 'E',
      })
    } else {
      setGms({ latGraus: '', latMin: '', latSeg: '', latHemis: 'S', lonGraus: '', lonMin: '', lonSeg: '', lonHemis: 'W' })
    }
    setPlanoAcao((l.planoAcao || []).map((c: any) => ({
      id: c.id,
      descricao: c.descricao,
      comoSeraFeito: c.comoSeraFeito || '',
      responsavelId: c.responsavelId || '',
      prazo: c.prazo ? c.prazo.split('T')[0] : '',
      concluida: c.concluida,
    })))
    setModalOpen(true)
  }

  function adicionarItemPlano() {
    setPlanoAcao(p => [...p, { descricao: '', comoSeraFeito: '', responsavelId: '', prazo: '' }])
  }

  function removerItemPlano(idx: number) {
    setPlanoAcao(p => p.filter((_, i) => i !== idx))
  }

  function atualizarItemPlano(idx: number, campo: keyof PlanoAcaoItem, valor: string) {
    setPlanoAcao(p => p.map((item, i) => i === idx ? { ...item, [campo]: valor } : item))
  }

  async function toggleItemExistente(itemId: string, atual: boolean) {
    try {
      const res = await fetch('/api/condicionantes-licenca', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, concluida: !atual }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Erro'); return }
      setPlanoAcao(p => p.map(item => item.id === itemId ? { ...item, concluida: !atual } : item))
    } catch { toast.error('Erro ao atualizar') }
  }

  function abrirEdicaoCondicionante(c: any) {
    setFormEdicaoCondicionante({
      descricao: c.descricao,
      comoSeraFeito: c.comoSeraFeito || '',
      responsavelId: c.responsavelId || '',
      prazo: c.prazo ? c.prazo.split('T')[0] : '',
      nota: c.nota || '',
    })
    setEditandoCondicionanteId(c.id)
  }

  async function salvarEdicaoCondicionante(itemId: string) {
    if (!formEdicaoCondicionante.descricao.trim()) {
      toast.error('A descrição não pode ficar vazia')
      return
    }
    setSalvandoCondicionante(true)
    try {
      const res = await fetch('/api/condicionantes-licenca', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemId,
          descricao: formEdicaoCondicionante.descricao.trim(),
          comoSeraFeito: formEdicaoCondicionante.comoSeraFeito || null,
          responsavelId: formEdicaoCondicionante.responsavelId || null,
          prazo: formEdicaoCondicionante.prazo || null,
          nota: formEdicaoCondicionante.nota || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Erro ao salvar'); return }
      toast.success('Condicionante atualizada!')
      setEditandoCondicionanteId(null)
      carregar()
    } catch { toast.error('Erro ao salvar') }
    finally { setSalvandoCondicionante(false) }
  }

  async function excluirCondicionante(itemId: string, descricao: string) {
    const confirmado = window.confirm(`Excluir a condicionante "${descricao}"? Esta ação não pode ser desfeita.`)
    if (!confirmado) return
    try {
      const res = await fetch(`/api/condicionantes-licenca?id=${itemId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Erro ao excluir'); return }
      toast.success('Condicionante excluída')
      carregar()
    } catch { toast.error('Erro ao excluir') }
  }

  async function salvar() {
    if (!form.numero.trim() || !form.dataEmissao) {
      toast.error('Número da licença e data de emissão são obrigatórios')
      return
    }
    if (form.vinculo === 'projeto' && !form.projetoId) {
      toast.error('Selecione o projeto vinculado')
      return
    }
    if (form.vinculo === 'avulsa' && !form.clienteId) {
      toast.error('Selecione o cliente (obrigatório para licença sem projeto)')
      return
    }

    setSalvando(true)
    try {
      if (form.id) {
        // Edição: atualiza dados básicos
        const res = await fetch(`/api/licencas/${form.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero: form.numero.trim(),
            dataEmissao: form.dataEmissao,
            dataValidade: form.dataValidade || null,
            areaPermitida: form.areaPermitida || null,
            atividadePermitida: form.atividadePermitida || null,
            latitude: form.latitude || null,
            longitude: form.longitude || null,
          }),
        })
        if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Erro ao salvar'); return }

        // Salva só os itens NOVOS do plano de ação (sem id ainda)
        const novos = planoAcao.filter(item => !item.id && item.descricao.trim())
        for (const item of novos) {
          await fetch('/api/condicionantes-licenca', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              licencaId: form.id,
              descricao: item.descricao.trim(),
              comoSeraFeito: item.comoSeraFeito || null,
              responsavelId: item.responsavelId || null,
              prazo: item.prazo || null,
            }),
          })
        }
        toast.success('Licença atualizada!')
      } else {
        const res = await fetch('/api/licencas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projetoId: form.vinculo === 'projeto' ? form.projetoId : null,
            clienteId: form.vinculo === 'avulsa' ? form.clienteId : null,
            numero: form.numero.trim(),
            dataEmissao: form.dataEmissao,
            dataValidade: form.dataValidade || null,
            areaPermitida: form.areaPermitida || null,
            atividadePermitida: form.atividadePermitida || null,
            latitude: form.latitude || null,
            longitude: form.longitude || null,
            planoAcao: planoAcao.filter(item => item.descricao.trim()).map(item => ({
              descricao: item.descricao,
              comoSeraFeito: item.comoSeraFeito || null,
              responsavelId: item.responsavelId || null,
              prazo: item.prazo || null,
            })),
          }),
        })
        if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Erro ao salvar'); return }
        toast.success('🏅 Licença cadastrada!')
      }
      setModalOpen(false)
      carregar()
    } catch { toast.error('Erro ao salvar') }
    finally { setSalvando(false) }
  }

  const clientesOrdenados = useMemo(() => [...clientes].sort((a, b) => a.nome.localeCompare(b.nome)), [clientes])
  const projetosOrdenados = useMemo(() => [...projetos].sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '')), [projetos])
  const licencasComCoordenadas = useMemo(() => licencas.filter(l => l.latitude != null && l.longitude != null), [licencas])

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" /> Licenças
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Todas as licenças obtidas — vindas de projetos ou cadastradas manualmente.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVerMapa(v => !v)}
            disabled={licencasComCoordenadas.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-sm font-semibold rounded-xl transition-colors"
            title={licencasComCoordenadas.length === 0 ? 'Nenhuma licença com coordenadas cadastradas ainda' : ''}
          >
            <MapIcon className="w-4 h-4" /> {verMapa ? 'Ocultar Mapa' : 'Ver Mapa'} ({licencasComCoordenadas.length})
          </button>
          <button
            onClick={abrirNova}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Licença
          </button>
        </div>
      </div>

      {verMapa && licencasComCoordenadas.length > 0 && (
        <MapaLicencas licencas={licencasComCoordenadas} />
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente, projeto..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : licencas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <Award className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nenhuma licença cadastrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {licencas.map(l => {
            const vig = statusVigencia(l.dataValidade)
            const nomeCliente = l.cliente?.nome || l.projeto?.cliente?.nome || '—'
            const concluidas = (l.planoAcao || []).filter((c: any) => c.concluida).length
            const total = (l.planoAcao || []).length
            const aberto = !!expandidas[l.id]
            return (
              <div key={l.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">Licença nº {l.numero}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${vig.cor}`}>{vig.label}</span>
                      {l.projeto ? (
                        <span className="text-xs font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{l.projeto.codigo}</span>
                      ) : (
                        <span className="text-xs font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full">Cadastro externo</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{nomeCliente} {l.projeto?.imovelNome ? `· ${l.projeto.imovelNome}` : ''}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Emitida {formatData(l.dataEmissao)}</span>
                      {l.dataValidade && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Válida até {formatData(l.dataValidade)}</span>}
                      {l.areaPermitida != null && <span className="flex items-center gap-1"><Ruler className="w-3 h-3" /> {l.areaPermitida} ha</span>}
                      {l.atividadePermitida && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {l.atividadePermitida}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {total > 0 && (
                      <button
                        onClick={() => setExpandidas(p => ({ ...p, [l.id]: !aberto }))}
                        className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg"
                      >
                        {concluidas}/{total} condicionantes
                        {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => abrirEdicao(l)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Editar licença"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {aberto && total > 0 && (
                  <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
                    {l.planoAcao.map((c: any) => (
                      editandoCondicionanteId === c.id ? (
                        <div key={c.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                          <input
                            value={formEdicaoCondicionante.descricao}
                            onChange={e => setFormEdicaoCondicionante(f => ({ ...f, descricao: e.target.value }))}
                            placeholder="O que precisa ser feito"
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={formEdicaoCondicionante.responsavelId}
                              onChange={e => setFormEdicaoCondicionante(f => ({ ...f, responsavelId: e.target.value }))}
                              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                              <option value="">Sem responsável</option>
                              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                            </select>
                            <input
                              type="date"
                              value={formEdicaoCondicionante.prazo}
                              onChange={e => setFormEdicaoCondicionante(f => ({ ...f, prazo: e.target.value }))}
                              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <input
                            value={formEdicaoCondicionante.comoSeraFeito}
                            onChange={e => setFormEdicaoCondicionante(f => ({ ...f, comoSeraFeito: e.target.value }))}
                            placeholder="Como será feito (opcional)"
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <textarea
                            value={formEdicaoCondicionante.nota}
                            onChange={e => setFormEdicaoCondicionante(f => ({ ...f, nota: e.target.value }))}
                            placeholder="Nota / observação (opcional)"
                            rows={2}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditandoCondicionanteId(null)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => salvarEdicaoCondicionante(c.id)}
                              disabled={salvandoCondicionante}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {salvandoCondicionante && <Loader2 className="w-3 h-3 animate-spin" />} Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={c.id} className="flex items-start gap-2 text-sm group">
                          <button onClick={() => toggleItemExistente(c.id, c.concluida)} className="mt-0.5 flex-shrink-0">
                            {c.concluida ? <Check className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-gray-300" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={c.concluida ? 'text-gray-400 line-through' : 'text-gray-800'}>{c.descricao}</p>
                            <p className="text-xs text-gray-400">
                              {c.responsavel?.nome || 'Sem responsável'}{c.prazo ? ` · prazo ${formatData(c.prazo)}` : ''}
                            </p>
                            {c.nota && (
                              <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 mt-1">📝 {c.nota}</p>
                            )}
                          </div>
                          <button
                            onClick={() => abrirEdicaoCondicionante(c)}
                            className="p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-md flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Editar condicionante"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {meRole === 'ADMIN' && (
                            <button
                              onClick={() => excluirCondicionante(c.id, c.descricao)}
                              className="p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-md flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Excluir condicionante"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de criação/edição */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <p className="font-bold text-gray-900">{form.id ? 'Editar Licença' : 'Nova Licença'}</p>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {!form.id && (
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    onClick={() => setForm(f => ({ ...f, vinculo: 'projeto' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.vinculo === 'projeto' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                  >
                    Vinculada a um projeto
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, vinculo: 'avulsa' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.vinculo === 'avulsa' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                  >
                    Cadastro externo (sem projeto)
                  </button>
                </div>
              )}

              {!form.id && form.vinculo === 'projeto' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Projeto *</label>
                  <select
                    value={form.projetoId}
                    onChange={e => setForm(f => ({ ...f, projetoId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Selecione o projeto...</option>
                    {projetosOrdenados.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.codigo} — {p.imovelNome || p.cliente?.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {!form.id && form.vinculo === 'avulsa' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-600">Cliente *</label>
                    <button
                      type="button"
                      onClick={() => setCriandoCliente(v => !v)}
                      className="text-xs text-green-600 font-medium hover:text-green-700"
                    >
                      {criandoCliente ? 'Selecionar existente' : '+ Novo cliente'}
                    </button>
                  </div>

                  {criandoCliente ? (
                    <div className="p-3 border border-dashed border-green-200 rounded-lg bg-green-50/40 space-y-2">
                      <input
                        value={formNovoCliente.nome}
                        onChange={e => setFormNovoCliente(f => ({ ...f, nome: e.target.value }))}
                        placeholder="Nome do cliente *"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={formNovoCliente.cpfCnpj}
                          onChange={e => setFormNovoCliente(f => ({ ...f, cpfCnpj: maskCpfCnpj(e.target.value) }))}
                          placeholder="CPF/CNPJ *"
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <input
                          value={formNovoCliente.telefone}
                          onChange={e => setFormNovoCliente(f => ({ ...f, telefone: e.target.value }))}
                          placeholder="Telefone (opcional)"
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={criarClienteRapido}
                        disabled={salvandoCliente}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                      >
                        {salvandoCliente && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Cadastrar e usar
                      </button>
                    </div>
                  ) : (
                    <select
                      value={form.clienteId}
                      onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Selecione o cliente...</option>
                      {clientesOrdenados.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Essa licença não terá código de projeto (PRJ-00XX) — é um registro manual/externo.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número da licença *</label>
                <input
                  value={form.numero}
                  onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                  placeholder="Ex: LP-1234/2026"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data de emissão *</label>
                  <input type="date" value={form.dataEmissao} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data de validade</label>
                  <input type="date" value={form.dataValidade} onChange={e => setForm(f => ({ ...f, dataValidade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Área permitida (ha)</label>
                  <input type="number" step="0.01" value={form.areaPermitida} onChange={e => setForm(f => ({ ...f, areaPermitida: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Atividade permitida</label>
                  <input value={form.atividadePermitida} onChange={e => setForm(f => ({ ...f, atividadePermitida: e.target.value }))}
                    placeholder="Ex: Pecuária extensiva"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-600">Coordenadas (opcional)</label>
                  <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFormatoCoord('decimal')}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${formatoCoord === 'decimal' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                      Decimal
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormatoCoord('gms')}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${formatoCoord === 'gms' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                      Grau/Min/Seg
                    </button>
                  </div>
                </div>

                {formatoCoord === 'decimal' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                      placeholder="Latitude — ex: -5.5231"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                      placeholder="Longitude — ex: -45.2145"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Latitude em GMS */}
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={gms.latGraus} onChange={e => {
                        const novo = { ...gms, latGraus: e.target.value }
                        setGms(novo)
                        setForm(f => ({ ...f, latitude: String(gmsParaDecimal(novo.latGraus, novo.latMin, novo.latSeg, novo.latHemis) ?? '') }))
                      }} placeholder="Graus" className="w-1/4 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <span className="text-gray-400 text-xs">°</span>
                      <input type="number" value={gms.latMin} onChange={e => {
                        const novo = { ...gms, latMin: e.target.value }
                        setGms(novo)
                        setForm(f => ({ ...f, latitude: String(gmsParaDecimal(novo.latGraus, novo.latMin, novo.latSeg, novo.latHemis) ?? '') }))
                      }} placeholder="Min" className="w-1/4 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <span className="text-gray-400 text-xs">'</span>
                      <input type="number" step="any" value={gms.latSeg} onChange={e => {
                        const novo = { ...gms, latSeg: e.target.value }
                        setGms(novo)
                        setForm(f => ({ ...f, latitude: String(gmsParaDecimal(novo.latGraus, novo.latMin, novo.latSeg, novo.latHemis) ?? '') }))
                      }} placeholder="Seg" className="w-1/4 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <span className="text-gray-400 text-xs">"</span>
                      <select value={gms.latHemis} onChange={e => {
                        const novo = { ...gms, latHemis: e.target.value as 'N' | 'S' }
                        setGms(novo)
                        setForm(f => ({ ...f, latitude: String(gmsParaDecimal(novo.latGraus, novo.latMin, novo.latSeg, novo.latHemis) ?? '') }))
                      }} className="px-1.5 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="S">S</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                    {/* Longitude em GMS */}
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={gms.lonGraus} onChange={e => {
                        const novo = { ...gms, lonGraus: e.target.value }
                        setGms(novo)
                        setForm(f => ({ ...f, longitude: String(gmsParaDecimal(novo.lonGraus, novo.lonMin, novo.lonSeg, novo.lonHemis) ?? '') }))
                      }} placeholder="Graus" className="w-1/4 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <span className="text-gray-400 text-xs">°</span>
                      <input type="number" value={gms.lonMin} onChange={e => {
                        const novo = { ...gms, lonMin: e.target.value }
                        setGms(novo)
                        setForm(f => ({ ...f, longitude: String(gmsParaDecimal(novo.lonGraus, novo.lonMin, novo.lonSeg, novo.lonHemis) ?? '') }))
                      }} placeholder="Min" className="w-1/4 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <span className="text-gray-400 text-xs">'</span>
                      <input type="number" step="any" value={gms.lonSeg} onChange={e => {
                        const novo = { ...gms, lonSeg: e.target.value }
                        setGms(novo)
                        setForm(f => ({ ...f, longitude: String(gmsParaDecimal(novo.lonGraus, novo.lonMin, novo.lonSeg, novo.lonHemis) ?? '') }))
                      }} placeholder="Seg" className="w-1/4 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <span className="text-gray-400 text-xs">"</span>
                      <select value={gms.lonHemis} onChange={e => {
                        const novo = { ...gms, lonHemis: e.target.value as 'E' | 'W' }
                        setGms(novo)
                        setForm(f => ({ ...f, longitude: String(gmsParaDecimal(novo.lonGraus, novo.lonMin, novo.lonSeg, novo.lonHemis) ?? '') }))
                      }} className="px-1.5 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="W">W</option>
                        <option value="E">E</option>
                      </select>
                    </div>
                    {form.latitude && form.longitude && (
                      <p className="text-xs text-gray-400">Convertido: {parseFloat(form.latitude).toFixed(6)}, {parseFloat(form.longitude).toFixed(6)}</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Opcional — se preencher os dois, essa licença aparece no mapa geral (botão "Ver Mapa").
                </p>
              </div>

              {/* Plano de ação */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">Plano de ação (condicionantes)</label>
                  <button onClick={adicionarItemPlano} className="flex items-center gap-1 text-xs text-green-600 font-medium hover:text-green-700">
                    <Plus className="w-3 h-3" /> Adicionar item
                  </button>
                </div>
                <div className="space-y-2">
                  {planoAcao.map((item, idx) => (
                    <div key={item.id || idx} className={`p-3 rounded-lg border space-y-2 ${item.concluida ? 'border-green-100 bg-green-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                      <div className="flex items-start gap-2">
                        <input
                          value={item.descricao}
                          onChange={e => atualizarItemPlano(idx, 'descricao', e.target.value)}
                          placeholder="O que precisa ser feito"
                          disabled={!!item.id}
                          className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        {!item.id && (
                          <button onClick={() => removerItemPlano(idx)} className="p-1.5 text-gray-300 hover:text-red-500 flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={item.responsavelId}
                          onChange={e => atualizarItemPlano(idx, 'responsavelId', e.target.value)}
                          disabled={!!item.id}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Responsável</option>
                          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                        <input
                          type="date"
                          value={item.prazo}
                          onChange={e => atualizarItemPlano(idx, 'prazo', e.target.value)}
                          disabled={!!item.id}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <input
                        value={item.comoSeraFeito}
                        onChange={e => atualizarItemPlano(idx, 'comoSeraFeito', e.target.value)}
                        placeholder="Como será feito (opcional)"
                        disabled={!!item.id}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      {item.id && (
                        <p className="text-[10px] text-gray-400">Item já salvo — marque como concluído na lista principal.</p>
                      )}
                    </div>
                  ))}
                  {planoAcao.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">Nenhum item ainda — clique em "Adicionar item".</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl disabled:opacity-50">
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
