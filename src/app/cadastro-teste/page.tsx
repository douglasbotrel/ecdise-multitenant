'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

const FAIXAS_FUNCIONARIOS = [
  'Somente eu (autônomo)',
  '2 a 5 funcionários',
  '6 a 20 funcionários',
  '21 a 50 funcionários',
  'Mais de 50 funcionários',
]

export default function CadastroTestePage() {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    whatsapp: '',
    estado: '',
    qtdFuncionarios: '',
    nomeEmpresa: '',
    usaSistema: '',
  })
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado]   = useState(false)
  const [erro, setErro]         = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setErro('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const vazio = Object.entries(form).find(([, v]) => !v.trim())
    if (vazio) {
      setErro('Por favor, preencha todos os campos antes de enviar.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/cadastro-teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setErro(d.error || 'Erro ao enviar. Tente novamente.')
        return
      }
      setEnviado(true)
    } catch {
      setErro('Falha na conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro enviado!</h2>
          <p className="text-gray-600 mb-6">
            Recebemos suas informações. Em breve entraremos em contato para liberar seu acesso de 3 meses.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 text-green-700 hover:text-green-900 font-medium hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 py-10 px-4">
      <div className="w-full max-w-xl mx-auto">

        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="Ecdise" width={180} height={100} className="mx-auto mb-2 object-contain" priority />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">

          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Cadastro para Teste Gratuito de 3 meses – Sistema ECDISE
          </h1>

          {/* Regras */}
          <div className="mt-4 mb-6 bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed space-y-2">
            <p className="font-semibold text-green-800">Regras do período de teste:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>O acesso terá duração de <strong>3 meses</strong> a partir da liberação.</li>
              <li>Após esse prazo, o acesso será <strong>congelado</strong>.</li>
              <li>Caso não haja manifestação de interesse, a conta será excluída.</li>
              <li>Caso haja interesse em continuar, será formalizado contrato (SaaS ou compra única), mantendo o cadastro já realizado.</li>
              <li><strong>Não haverá treinamento formal</strong> — será disponibilizado apenas um documento de tutorial básico.</li>
              <li>Durante o teste: acesso <strong>ADM completo</strong> com livre uso de todas as funcionalidades.</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo</label>
              <input
                name="nome"
                value={form.nome}
                onChange={handleChange}
                placeholder="Seu nome"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 transition-all"
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 transition-all"
                disabled={loading}
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp</label>
              <input
                name="whatsapp"
                value={form.whatsapp}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 transition-all"
                disabled={loading}
              />
            </div>

            {/* Nome da empresa */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da empresa / consultoria</label>
              <input
                name="nomeEmpresa"
                value={form.nomeEmpresa}
                onChange={handleChange}
                placeholder="Nome da sua empresa"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 transition-all"
                disabled={loading}
              />
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado de atuação</label>
              <select
                name="estado"
                value={form.estado}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 transition-all bg-white"
                disabled={loading}
              >
                <option value="">Selecione o estado</option>
                {ESTADOS.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            {/* Quantidade de funcionários */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantidade de funcionários</label>
              <select
                name="qtdFuncionarios"
                value={form.qtdFuncionarios}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 transition-all bg-white"
                disabled={loading}
              >
                <option value="">Selecione uma faixa</option>
                {FAIXAS_FUNCIONARIOS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Usa sistema */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Utiliza algum sistema em alguma parte do serviço de consultoria ambiental?
              </label>
              <textarea
                name="usaSistema"
                value={form.usaSistema}
                onChange={handleChange}
                placeholder="Ex: Sim, uso Excel para controle de prazos. / Não, tudo é manual."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 transition-all resize-none"
                disabled={loading}
              />
            </div>

            {/* Erro */}
            {erro && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {erro}
              </p>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar cadastro'
              )}
            </button>

          </form>
        </div>

        <div className="text-center mt-6">
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </a>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          © {new Date().getFullYear()} Ecdise — Sistema de Gestão Ambiental
        </p>
      </div>
    </div>
  )
}
