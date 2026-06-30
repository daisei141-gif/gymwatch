'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

const TAUNTS = [
  'お前、今月まだ{count}回しか行ってないじゃん笑',
  '{name}がサボり中。本当にジム会員なの？',
  '昨日もサボったの？ソファの上でプロテイン飲んでる人🤣',
  'このまま月末迎えたら罰ゲーム確定だけど大丈夫？',
  '筋肉じゃなくてサボり筋が鍛えられてそう',
]

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [memberData, setMemberData] = useState<any>(null)
  const [postCount, setPostCount] = useState(0)
  const [groupName, setGroupName] = useState('')
  const [taunt, setTaunt] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const { data: memberRaw } = await supabase
      .from('group_members')
      .select('*, groups(name, penalty)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single()

    const member = memberRaw as any

    if (member) {
      setMemberData(member)
      setGroupName(member.groups?.name || '')

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('group_id', member.group_id)
        .eq('status', 'approved')
        .gte('created_at', startOfMonth)
      setPostCount(count || 0)
    }

    const t = TAUNTS[Math.floor(Math.random() * TAUNTS.length)]
    setTaunt(t.replace('{name}', prof?.display_name || 'お前').replace('{count}', String(postCount)))
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gym-orange font-black text-2xl animate-pulse">LOADING...</p>
    </div>
  )

  const goal = memberData?.monthly_goal || 12
  const pct = Math.min(100, Math.round((postCount / goal) * 100))
  const remaining = Math.max(0, goal - postCount)
  const today = new Date()
  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate()

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <h1 className="text-3xl font-black tracking-tight">
          GYM<span className="text-gym-orange">WATCH</span>
        </h1>
        <div className="flex items-center gap-3">
          <span className="bg-gym-orange/20 border border-gym-orange/40 text-gym-orange
                           text-xs font-bold px-3 py-1 rounded-full animate-pulse">
            ● LIVE
          </span>
          <button onClick={handleLogout} className="text-gym-muted text-xs">ログアウト</button>
        </div>
      </div>

      <div className="px-4">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-gym-muted text-sm">お疲れさま、</p>
            <p className="text-2xl font-black">{profile?.display_name} 💪</p>
            {groupName && <p className="text-gym-muted text-xs mt-0.5">グループ：{groupName}</p>}
          </div>
          <div className="bg-gym-orange/10 border border-gym-orange/30 rounded-2xl px-4 py-2 text-center">
            <p className="text-xs text-gym-muted uppercase tracking-widest">今月の目標</p>
            <p className="text-3xl font-black text-gym-orange">{goal}回</p>
          </div>
        </div>

        {/* Progress */}
        <div className="card">
          <p className="card-title">今月の進捗</p>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-6xl font-black leading-none">
              {postCount}<span className="text-gym-orange text-3xl">/{goal}</span>
            </span>
            <div className="mb-1">
              <p className={`text-3xl font-black leading-none ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-gym-orange' : 'text-red-400'}`}>
                {pct}%
              </p>
              <p className="text-xs text-gym-muted">達成率</p>
            </div>
          </div>
          <div className="bg-gym-border rounded-full h-2 mb-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-gym-orange transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gym-muted">
            残り <span className="text-gym-orange font-bold">{remaining}回</span> でクリア！あと <span className="text-white">{daysLeft}日</span>
          </p>
        </div>

        {/* Taunt */}
        {pct < 80 && (
          <div className="bg-[#1a0d00] border border-gym-orange/30 rounded-2xl p-4 mb-3">
            <p className="text-gym-orange text-lg mb-1">🔥 煽りメッセージ</p>
            <p className="text-[#ffb87a] text-sm leading-relaxed">{taunt}</p>
          </div>
        )}

        {/* No group yet */}
        {!memberData && (
          <div className="card text-center py-8">
            <p className="text-4xl mb-3">👥</p>
            <p className="font-black text-lg mb-1">グループに参加しよう！</p>
            <p className="text-gym-muted text-sm mb-4">友達と一緒じゃないとサボり放題</p>
            <Link href="/group" className="btn-orange block">グループを作る / 参加する</Link>
          </div>
        )}

        {/* Penalty */}
        {memberData?.groups?.penalty && (
          <div className="bg-[#0a0014] border border-purple-800/50 rounded-2xl p-4 mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-1">🎲 今月の罰ゲーム</p>
            <p className="text-purple-300 font-bold text-sm">{memberData.groups.penalty}</p>
          </div>
        )}

        {/* Post button */}
        <Link href="/post" className="btn-orange block text-center text-lg mt-2">
          📸　今日ジム行った！投稿
        </Link>
      </div>

      <BottomNav />
    </div>
  )
}
