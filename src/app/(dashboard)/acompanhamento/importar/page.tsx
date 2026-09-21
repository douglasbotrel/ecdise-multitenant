'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Upload, Eye, EyeOff, Loader2 } from 'lucide-react'

const TIPOS_SERVICO = [
  'Licenciamento Ambiental (LAU/LAR)',
  'LAUR - Licença Ambiental Única Rural',
  'Outorga / Recursos Hídricos (OSI)',
  'Outros',
]

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
]

export default function ImportarProcesso() {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const [form, setForm] = useState({
    clienteNome:          '',
    clienteCpfCnpj:       '',
    tipoServico:          '',
    imovelNome:           '',
    municipio:            '',
    estado:               'MA',
    protocoloCodigoOrgao: '',
    protocoloData:        '',
    siglaLogin:           '',
    siglaSenha:           '',
  })

  function set(campo: string, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.clienteNome.trim() || !form.clienteCpfCnpj.trim()) {
      toast.error('Informe nome e CPF/CNPJ do cliente')
      return
    }
    if (!form.tipoServico) {
      toast.error('Selecione o tipo de serviço')
      return
    }
    if (!form.protocoloCodigoOrgao.trim()) {
      toast.error('Informe o Nº do processo')
      return
    }
    if (!form.siglaLogin.trim() || !form.siglaSenha.trim()) {
      toast.error('Informe login e senha do SIGLA')
      return
    }

    setSalvando(true)
    try {
      const res = await fetch('/api/projetos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao importar processo')
        return
      }
      toast.success('✅ Processo importado com sucesso!')
      router.push(`/acompanhamento/${data.projeto.id}`)
    } catch {
      toast.error('Erro ao conectar com o servidor')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/acompanhamento')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-100 rounded-xl">
            <Upload className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Importar Processo Existente</h1>
            <p className="text-sm text-gray-500">
              Para processos que já estavam em andamento antes da implantação do sistema
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── Cliente ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Cliente</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome do cliente *</label>
              <input
                type="text"
                value={form.clienteNome}
                onChange={e => set('clienteNome', e.target.value)}
                placeholder="Nome completo ou razão social"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">CPF / CNPJ *</label>
              <input
                type="text"
                value={form.clienteCpfCnpj}
                onChange={e => set('clienteCpfCnpj', e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Município</label>
              <input
                type="text"
                value={form.municipio}
                onChange={e => set('municipio', e.target.value)}
                placeholder="Ex: São Luís"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        {/* ── Processo ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Processo SIGLA</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de serviço *</label>
              <select
                value={form.tipoServico}
                onChange={e => set('tipoServico', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">Selecione...</option>
                {TIPOS_SERVICO.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome do imóvel / empreendimento</label>
              <input
                type="text"
                value={form.imovelNome}
                onChange={e => set('imovelNome', e.target.value)}
                placeholder="Ex: Fazenda Santa Maria, Lava Rápido Central"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nº do processo SIGLA *</label>
              <input
                type="text"
                value={form.protocoloCodigoOrgao}
                onChange={e => set('protocoloCodigoOrgao', e.target.value)}
                placeholder="Ex: 26070010650/2026"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Data do protocolo</label>
              <input
                type="date"
                value={form.protocoloData}
                onChange={e => set('protocoloData', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        {/* ── Credenciais SIGLA ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Credenciais SIGLA</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Login e senha que o cliente usa para acessar o Módulo Empreendedor no SIGLA
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Login (CPF) *</label>
              <input
                type="text"
                value={form.siglaLogin}
                onChange={e => set('siglaLogin', e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha *</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={form.siglaSenha}
                  onChange={e => set('siglaSenha', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ As credenciais são armazenadas de forma criptografada e usadas apenas para consulta automática de status.
          </p>
        </div>

        {/* Botão */}
        <button
          type="submit"
          disabled={salvando}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {salvando ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Importando...</>
          ) : (
            <><Upload className="w-5 h-5" /> Importar Processo</>
          )}
        </button>

      </form>
    </div>
  )
}
