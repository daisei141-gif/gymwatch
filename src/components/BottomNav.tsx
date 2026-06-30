'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/dashboard', icon: '🏠', label: 'ホーム' },
  { href: '/post',      icon: '📸', label: '投稿' },
  { href: '/feed',      icon: '📋', label: 'フィード' },
  { href: '/ranking',   icon: '🏆', label: 'ランキング' },
  { href: '/group',     icon: '👥', label: 'グループ' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gym-surface border-t border-gym-border
                    flex max-w-lg mx-auto z-50">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs transition-colors ${
            pathname === tab.href ? 'text-gym-orange' : 'text-gym-muted'
          }`}
        >
          <span className="text-xl">{tab.icon}</span>
          <span className="font-bold tracking-wide">{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
