'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { cn } from '@/lib/utils'

interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  departamento: string
  cargo?: string | null
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) {
          router.push('/login')
          return
        }
        const data = await res.json()
        setUsuario(data.usuario)
      } catch {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    loadUser()

    // Carrega preferência de sidebar
    const savedCollapsed = localStorage.getItem('sidebar_collapsed')
    if (savedCollapsed) setCollapsed(JSON.parse(savedCollapsed))
  }, [router])

  function handleToggleSidebar() {
    const newValue = !collapsed
    setCollapsed(newValue)
    localStorage.setItem('sidebar_collapsed', JSON.stringify(newValue))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!usuario) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        collapsed={collapsed}
        onToggle={handleToggleSidebar}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content */}
      <div className={cn(
        'flex flex-col min-h-screen transition-all duration-300',
        collapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}>
        <Header
          onMobileMenuOpen={() => setMobileOpen(true)}
          usuario={usuario}
        />

        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
