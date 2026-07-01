// @ts-nocheck
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function BottomNav() {
  const pathname = usePathname()
  const [stampBadge, setStampBadge] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('unread_stamps')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setStampBadge(count || 0)
    }
    init()
    const handler = (e) => setStampBadge(e.detail)
    window.addEventListener('stamp_badge_count', handler)
    return () => window.removeEventListener('stamp_badge_count', handler)
  }, [pathname])

  const tabs = [
    { href: '/dashboard', icon: '🏠', label: 'ホーム' },
    { href: '/post',      icon: '📸', label: '投稿' },
    { href: '/feed',      icon: '📋', label: 'フィード' },
    { href: '/workout',   icon: '💪', label: '筋トレ' },
    { href: '/group',     icon: '👥', label: 'グループ' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gym-surface border-t border-gym-border flex max-w-lg mx-auto z-50">
      {tabs.map(tab => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs transition-colors relative ${
            pathname === tab.href ? 'text-gym-orange' : 'text-gym-muted'
          }`}
        >
          <span className="text-xl relative">
            {tab.icon}
            {tab.icon === '📋' && stampBadge > 0 && (
              <span className="absolute -top-1 -right-2 bg-gym-orange text-black font-black rounded-full w-4 h-4 flex items-center justify-center" style={{fontSize: '9px'}}>
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
