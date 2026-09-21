'use client'

import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { X, Upload, FileText, Trash2, ExternalLink, Loader2, FolderOpen } from 'lucide-react'

const CATEGORIAS = [
  { value: 'RG',                  label: 'RG',                   cor: 'bg-blue-100 text-blue-700' },
  { value: 'CPF',                 label: 'CPF',                  cor: 'bg-blue-100 text-blue-700' },
  { value: 'COMPROVANTE_ENDERECO',label: 'Comp. Endereço',        cor: 'bg-purple-100 text-purple-700' },
  { value: 'DOC_IMOVEL',          label: 'Doc. do Imóvel',        cor: 'bg-amber-100 text-amber-700' },
  { value: 'RECIBO_CAR',          label: 'Recibo CAR',            cor: 'bg-green-100 text-green-700' },
  { value: 'CCIR',                label: 'CCIR',                  cor: 'bg-green-100 text-green-700' },
  { value: 'ESCRITURA',           label: 'Escritura',             cor: 'bg-amber-100 text-amber-700' },
  { value: 'MATRICULA',           label: 'Matrícula',             cor: 'bg-amber-100 text-amber-700' },
  { value: 'CONTRATO',            label: 'Contrato',              cor: 'bg-pink-100 text-pink-700' },
  { value: 'OUTROS',              label: 'Outros',                cor: 'bg-gray-100 text-gray-600' },
]

function badgeCor(cat: string) {
  return CATEGORIAS.find(c => c.value === cat)?.cor || 'bg-gray-100 text-gray-600'
}
function badgeLabel(cat: string) {
  return CATEGORIAS.find(c => c.value === cat)?.label || cat
}

function formatTamanho(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface ModalDocumentosProps {
  open: boolean
  onClose: () => void
  projeto: any   // { id, codigo, imovelNome, municipio, estado, cliente: { nome } }
}

export function ModalDocumentos({ open, onClose, projeto }: ModalDocumentosProps) {
  useLockBodyScroll(open)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('OUTROS')
  const [filtro, setFiltro] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && projeto?.id) carregarDocumentos()
  }, [open, projeto?.id])

  async function carregarDocumentos() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projetos/${projeto.id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDocumentos(data.documentos || [])
    } catch {
      toast.error('Erro ao carregar documentos')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('arquivo', file)
      fd.append('projetoId', projeto.id)
      fd.append('categoria', categoriaSelecionada)
      fd.append('tipo', 'documento')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      toast.success(`"${file.name}" enviado para o Drive!`)
      await carregarDocumentos()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar arquivo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleExcluir(docId: string, nome: string) {
    if (!confirm(`Excluir "${nome}"?`)) return
    try {
      const res = await fetch(`/api/documentos/${docId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Documento excluído')
      setDocumentos(prev => prev.filter(d => d.id !== docId))
    } catch {
      toast.error('Erro ao excluir documento')
    }
  }

  if (!open) return null

  const docsFiltrados = filtro
    ? documentos.filter(d => d.categoria === filtro)
    : documentos

  // Agrupar por categoria para exibição
  const grupos: Record<string, any[]> = {}
  docsFiltrados.forEach(d => {
    const cat = d.categoria || 'OUTROS'
    if (!grupos[cat]) grupos[cat] = []
    grupos[cat].push(d)
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-amber-500" />
              Documentos — {projeto?.codigo}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {projeto?.cliente?.nome}
              {projeto?.imovelNome ? ` · ${projeto.imovelNome}` : ''}
              {projeto?.municipio ? ` · ${projeto.municipio}${projeto?.estado ? `/${projeto.estado}` : ''}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload area */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adicionar documento</p>
          <div className="flex gap-2">
            <select
              value={categoriaSelecionada}
              onChange={e => setCategoriaSelecionada(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 flex-1"
            >
              {CATEGORIAS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Enviando...' : 'Enviar arquivo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.xlsx,.xls,.zip,.xml,.kml,.kmz"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">PDF, imagens, Word, Excel, ZIP, KML — máx. 50 MB</p>
        </div>

        {/* Filtro por categoria */}
        {documentos.length > 0 && (
          <div className="px-6 pt-3 flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFiltro('')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                filtro === '' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos ({documentos.length})
            </button>
            {CATEGORIAS.filter(c => documentos.some(d => (d.categoria || 'OUTROS') === c.value)).map(c => (
              <button
                key={c.value}
                onClick={() => setFiltro(filtro === c.value ? '' : c.value)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  filtro === c.value ? 'bg-gray-800 text-white' : `${c.cor} hover:opacity-80`
                }`}
              >
                {c.label} ({documentos.filter(d => (d.categoria || 'OUTROS') === c.value).length})
              </button>
            ))}
          </div>
        )}

        {/* Lista de documentos */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : docsFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <FolderOpen className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">Nenhum documento enviado</p>
              <p className="text-xs mt-1">Use o botão acima para enviar o primeiro arquivo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(grupos).map(([cat, docs]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {badgeLabel(cat)}
                  </p>
                  <div className="space-y-1.5">
                    {docs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors group">
                        <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{doc.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeCor(doc.categoria)}`}>
                              {badgeLabel(doc.categoria)}
                            </span>
                            {doc.tamanho && (
                              <span className="text-xs text-gray-400">{formatTamanho(doc.tamanho)}</span>
                            )}
                            {doc.usuario && (
                              <span className="text-xs text-gray-400">· {doc.usuario.nome}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Abrir no Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleExcluir(doc.id, doc.nome)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {documentos.length} documento(s) · arquivos no Google Drive
          </span>
          <button onClick={onClose} className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
