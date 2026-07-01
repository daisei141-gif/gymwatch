'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const tabs = [
  { href: '/dashboard', icon: '🏠', label: 'ホーム' },
  { href: '/post',      icon: '📸', label: '投稿' },
  { href: '/feed',      icon: '📋', label: 'フィード' },
  { href: '/ranking',   icon: '🏆', label: 'ランキング' },
  { href: '/group',     icon: '👥', label: 'グループ' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [stampBadge, setStampBadge] = useState(0)

  useEffect(() => {
    // バッジ数を読み込む
    const count = parseInt(localStorage.getItem('stamp_badge') || '0')
    setStampBadge(count)

    // フィード画面に来たらバッジをリセット
    if (pathname === '/feed') {
      localStorage.setItem('stamp_badge', '0')
      setStampBadge(0)
    }

    // バッジ更新イベントを監視
    const handler = () => {
      const newCount = parseInt(localStorage.getItem('stamp_badge') || '0')
      setStampBadge(newCount)
    }
    window.addEventListener('stamp_badge_update', handler)
    return () => window.removeEventListener('stamp_badge_update', handler)
  }, [pathname])

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gym-surface border-t border-gym-border flex max-w-lg mx-auto z-50">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs transition-colors relative ${
            pathname === tab.href ? 'text-gym-orange' : 'text-gym-muted'
          }`}
        >
          <span className="text-xl relative">
            {tab.icon}
            {tab.href === '/feed' && stampBadge > 0 && (
              <span className="absolute -top-1 -right-2 bg-gym-orange text-black text-xs font-black rounded-full w-4 h-4 flex items-center justify-center" style={{fontSize: '9px'}}>
                {stampBadge > 9 ? '9+' : stampBadge}
              </span>
            )}
          </span>
          <span className="font-bold tracking-wide">{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
