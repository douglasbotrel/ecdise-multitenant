'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Search, Users2, Loader2, Phone, Mail, Building2, MapPin } from 'lucide-react'

export default function CadastrosTestePage() {
  const [cadastros, setCadastros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cadastro-teste')
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          toast.error(d.error || 'Erro ao carregar cadastros')
          return
        }
        const data = await res.json()
        setCadastros(Array.isArray(data) ? data : [])
      } catch {
        toast.error('Erro ao carregar cadastros')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtrados = useMemo(() => {
    if (!search.trim()) return cadastros
    const q = search.toLowerCase()
    return cadastros.filter(c =>
      c.nome?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.nomeEmpresa?.toLowerCase().includes(q) ||
      c.whatsapp?.toLowerCase().includes(q) ||
      c.estado?.toLowerCase().includes(q)
    )
  }, [cadastros, search])

  function formatData(d: string) {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users2 className="w-6 h-6 text-green-600" /> Cadastros — Acesso Grátis
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Pessoas que se inscreveram pelo link de teste grátis na tela de login.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, empresa, whatsapp ou estado..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <Users2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {cadastros.length === 0 ? 'Nenhum cadastro ainda.' : 'Nenhum resultado para essa busca.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-medium text-gray-500">{filtrados.length} cadastro(s)</p>
          </div>
          <div className="divide-y divide-gray-50">
            {filtrados.map(c => (
              <div key={c.id} className="p-4 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{c.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatData(c.criadoEm)}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 flex-shrink-0">
                    {c.qtdFuncionarios} funcionário(s)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    <span className="truncate">{c.nomeEmpresa}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    <span>{c.estado}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    <a href={`mailto:${c.email}`} className="truncate hover:text-green-600">{c.email}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    <a
                      href={`https://wa.me/55${c.whatsapp?.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:text-green-600"
                    >
                      {c.whatsapp}
                    </a>
                  </div>
                </div>
                {c.usaSistema && (
                  <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                    Já usa outro sistema? <span className="text-gray-600">{c.usaSistema}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
