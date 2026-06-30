'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

export default function RankingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [ranking, setRanking] = useState<any[]>([])
  const [penalty, setPenalty] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadRanking() }, [])

  async function loadRanking() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }

    const { data: member } = await supabase
      .from('group_members')
      .select('group_id, groups(name, penalty)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single()

    if (!member) { setLoading(false); return }
    setPenalty(member.groups?.penalty || '')

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, monthly_goal, profiles(display_name)')
      .eq('group_id', member.group_id)

    if (!members) { setLoading(false); return }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const withCounts = await Promise.all(members.map(async m => {
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', m.user_id)
        .eq('group_id', member.group_id)
        .eq('status', 'approved')
        .gte('created_at', startOfMonth)

      return {
        ...m,
        count: count || 0,
        pct: Math.min(100, Math.round(((count || 0) / (m.monthly_goal || 12)) * 100)),
        isMe: m.user_id === user.id,
      }
    }))

    withCounts.sort((a, b) => b.pct - a.pct)
    setRanking(withCounts)
    setLoading(false)
  }

  const medals = ['🥇', '🥈', '🥉']

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gym-orange font-black text-2xl animate-pulse">LOADING...</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto">
      <div className="px-4 pt-12 pb-3">
        <h2 className="section-title">グループランキング</h2>
        <p className="text-gym-muted text-xs uppercase tracking-widest mb-4">
          {new Date().getMonth() + 1}月 / 達成率順
        </p>
      </div>

      <div className="px-4">
        <div className="card mb-3">
          {ranking.map((m, i) => (
            <div
              key={m.user_id}
              className={`flex items-center gap-3 py-3 border-b border-gym-border last:border-b-0
                          ${m.isMe ? 'opacity-100' : 'opacity-90'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0
                               ${i === 0 ? 'bg-yellow-900/40 text-yellow-400' :
                                 i === 1 ? 'bg-gray-700/40 text-gray-400' :
                                 i === 2 ? 'bg-orange-900/30 text-orange-600' :
                                 'bg-gym-border text-gym-muted'}`}>
                {i < 3 ? medals[i] : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-black text-base truncate">{m.profiles?.display_name}</p>
                  {m.isMe && <span className="text-xs text-gym-orange font-bold">YOU</span>}
                </div>
                <div className="mt-1 bg-gym-border rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700
                                ${m.pct >= 80 ? 'bg-green-400' : m.pct >= 50 ? 'bg-gym-orange' : 'bg-red-400'}`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
                <p className="text-xs text-gym-muted mt-0.5">目標 {m.monthly_goal}回</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-black text-gym-orange">{m.count}回</p>
                <p className={`text-xs font-bold
                               ${m.pct >= 80 ? 'text-green-400' : m.pct >= 50 ? 'text-gym-orange' : 'text-red-400'}`}>
                  {m.pct}%
                  {m.pct < 30 && ' 💀'}
                  {m.pct >= 80 && ' 🔥'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Danger zone */}
        {ranking.filter(m => m.pct < 50).length > 0 && (
          <div className="bg-[#1a0800] border border-gym-orange/30 rounded-2xl p-4 mb-3">
            <p className="text-gym-orange font-bold text-sm mb-2">⚠️ このままだと罰ゲーム確定</p>
            {ranking.filter(m => m.pct < 50).map(m => (
              <p key={m.user_id} className="text-[#ffb87a] text-xs">
                {m.profiles?.display_name} → あと{Math.max(0, m.monthly_goal - m.count)}回必要
              </p>
            ))}
          </div>
        )}

        {penalty && (
          <div className="bg-[#0a0014] border border-purple-800/50 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-1">🎲 罰ゲーム</p>
            <p className="text-purple-300 font-bold text-sm">{penalty}</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
