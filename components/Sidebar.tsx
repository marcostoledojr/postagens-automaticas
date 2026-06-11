'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Clock, Tags, Calendar, BarChart2,
  Linkedin, Zap, Settings
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { href: '/',            label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/fila',        label: 'Fila de Aprovação', icon: Clock },
  { href: '/temas',       label: 'Temas',         icon: Tags },
  { href: '/calendario',  label: 'Calendário',    icon: Calendar },
  { href: '/analytics',   label: 'Analytics',     icon: BarChart2 },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg">
            <Linkedin size={20} />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Postagens Auto</p>
            <p className="text-slate-400 text-xs">Marcos Toledo</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Status do sistema */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Zap size={14} className="text-green-400" />
          <span>Sistema ativo</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Próxima geração: hoje às 09:00</p>
      </div>
    </aside>
  )
}
