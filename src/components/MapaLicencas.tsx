'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Corrige o ícone padrão do Leaflet, que não carrega certo com o bundler do Next.js
const iconePadrao = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function formatData(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

// Ajusta o zoom/centro pra caber todos os marcadores na tela
function AjustarAosMarcadores({ pontos }: { pontos: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (pontos.length === 0) return
    if (pontos.length === 1) {
      map.setView(pontos[0], 15)
    } else {
      map.fitBounds(L.latLngBounds(pontos), { padding: [40, 40] })
    }
  }, [pontos, map])
  return null
}

export default function MapaLicencas({ licencas }: { licencas: any[] }) {
  const comCoordenadas = licencas.filter(l => l.latitude != null && l.longitude != null)
  const pontos: [number, number][] = comCoordenadas.map(l => [l.latitude, l.longitude])
  const centroInicial: [number, number] = pontos[0] || [-5.5, -45.2] // fallback: Maranhão

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '520px' }}>
      <MapContainer center={centroInicial} zoom={7} style={{ height: '100%', width: '100%' }}>
        {/* Camada de satélite — Esri World Imagery, gratuita, sem chave de API */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          maxZoom={19}
        />
        <AjustarAosMarcadores pontos={pontos} />
        {comCoordenadas.map(l => (
          <Marker key={l.id} position={[l.latitude, l.longitude]} icon={iconePadrao}>
            <Popup>
              <div className="text-sm min-w-[180px]">
                <p className="font-semibold text-gray-900">Licença nº {l.numero}</p>
                <p className="text-gray-600">{l.cliente?.nome || l.projeto?.cliente?.nome || '—'}</p>
                {l.projeto?.imovelNome && <p className="text-gray-500 text-xs">{l.projeto.imovelNome}</p>}
                <div className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                  <p>Emitida: {formatData(l.dataEmissao)}</p>
                  <p>Válida até: {formatData(l.dataValidade)}</p>
                  {l.areaPermitida != null && <p>Área: {l.areaPermitida} ha</p>}
                  {l.atividadePermitida && <p>Atividade: {l.atividadePermitida}</p>}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
