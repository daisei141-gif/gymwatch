// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { usePushNotification } from '@/lib/usePush'

const TAUNTS = [
  'お前、今月まだ{count}回しか行ってないじゃん笑',
  '{name}がサボり中。本当にジム会員なの？',
  '昨日もサボったの？ソファの上でプロテイン飲んでる人🤣',
  'このまま月末迎えたら罰ゲーム確定だけど大丈夫？',
  '筋肉じゃなくてサボり筋が鍛えられてそう',
]

const PUSH_TAUNTS = [
  '今日もサボり？そのプロテイン代、もったいないぞ💪',
  '3日連続サボりは本当のサボり魔だけがやること🤣',
  'グループのみんなが待ってるぞ！ジム行ってこい！',
  '筋肉は裏切らない。でもお前は筋肉を裏切ってる😤',
  '今すぐジムへ行け！それだけだ！🔥',
]

const TEAM_COLORS = ['#ff6b1a','#3ecf8e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#ef4444','#84cc16','#f97316']

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [memberData, setMemberData] = useState(null)
  const [groupId, setGroupId] = useState('')
  const [userId, setUserId] = useState('')
  const [postCount, setPostCount] = useState(0)
  const [groupName, setGroupName] = useState('')
  const [taunt, setTaunt] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState('')
  const [teamGraphData, setTeamGraphData] = useState([])
  const [exerciseList, setExerciseList] = useState([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [exerciseGraphData, setExerciseGraphData] = useState([])
  const { permission, supported, subscribe, sendLocalNotification } = usePushNotification()

  async function enableNotifications() {
    const sub = await subscribe()
    if (!sub) {
      setSendMsg('通知の許可が必要です')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: member } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single()

    if (!member) {
      setSendMsg('グループに参加してから通知をオンにしてください')
      return
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      group_id: member.group_id,
      subscription: sub.toJSON(),
    })

    if (error) {
      setSendMsg('登録に失敗しました: ' + error.message)
    } else {
      sendLocalNotification('GymWatch 通知オン！🔥', 'サボったらすぐ煽りが届くぞ💪')
      setSendMsg('通知登録しました！')
      setTimeout(() => setSendMsg(''), 3000)
    }
  }

  async function sendTauntToGroup() {
    if (!groupId || !userId) return
    setSending(true)
    setSendMsg('')
    const msg = PUSH_TAUNTS[Math.floor(Math.random() * PUSH_TAUNTS.length)]
    try {
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          senderId: userId,
          title: 'GymWatch 煽り通知🔥',
          body: msg,
        }),
      })
      const data = await res.json()
      setSendMsg(data.sent > 0 ? `${data.sent}人に送りました！` : '通知登録しているメンバーがいません')
    } catch {
      setSendMsg('送信に失敗しました')
    }
    setSending(false)
    setTimeout(() => setSendMsg(''), 3000)
  }

  useEffect(() => {
    loadData()
  }, [])

  // 通知が許可済みの場合、ページ読み込み時に自動登録
  useEffect(() => {
    if (permission === 'granted' && supported && groupId && userId) {
      autoRegisterPush()
    }
  }, [permission, supported, groupId, userId])

  async function autoRegisterPush() {
    try {
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BKbU7EY5Delp0ybLEgWaUFSbzLooqzOZG02Au2N4vrpfvgcDganEkewhK-1qt2tkhWJqqAPn_r5OZ1p3fhf-Px0',
        })
      }
      if (sub) {
        await supabase.from('push_subscriptions').upsert({
          user_id: userId,
          group_id: groupId,
          subscription: sub.toJSON(),
        })
      }
    } catch (e) {
      console.error('Auto push register error:', e)
    }
  }

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }
    setUserId(user.id)

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const { data: memberRaw }: { data: any } = await supabase
      .from('group_members')
      .select('*, groups(name, penalty)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single()

    const member: any = memberRaw

    if (member) {
      setMemberData(member)
      setGroupId(member.group_id)
      const groupData: any = member.groups
      setGroupName((groupData && groupData.name) || '')

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

      // グループメンバー取得
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id, profiles(display_name)')
        .eq('group_id', member.group_id)

      if (members) {
        setTeamGraphData(members.map((m, idx) => ({
          userId: m.user_id,
          name: m.profiles?.display_name || '?',
          color: TEAM_COLORS[idx % TEAM_COLORS.length],
        })))

        // グループ内の全種目を取得
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('exercise')
          .eq('group_id', member.group_id)
        const uniqueExercises = [...new Set((logs || []).map(l => l.exercise))]
        setExerciseList(uniqueExercises)
        if (uniqueExercises.length > 0) {
          setSelectedExercise(uniqueExercises[0])
          await loadExerciseGraph(uniqueExercises[0], member.group_id, members)
        }
      }
    }

    const t = TAUNTS[Math.floor(Math.random() * TAUNTS.length)]
    setTaunt(t.replace('{name}', prof?.display_name || 'お前').replace('{count}', String(postCount)))
    setLoading(false)
  }

  async function loadExerciseGraph(exercise, gId, members) {
    if (!exercise || !gId || !members) return
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('user_id, weight_kg, created_at')
      .eq('group_id', gId)
      .eq('exercise', exercise)
      .not('weight_kg', 'is', null)
      .order('created_at', { ascending: true })

    const dataByUser = {}
    members.forEach((m, idx) => {
      const userLogs = (logs || []).filter(l => l.user_id === m.user_id)
      dataByUser[m.user_id] = {
        name: m.profiles?.display_name || '?',
        color: TEAM_COLORS[idx % TEAM_COLORS.length],
        points: userLogs.map(l => ({
          date: new Date(l.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
          weight: l.weight_kg,
        }))
      }
    })
    setExerciseGraphData(Object.values(dataByUser).filter(d => d.points.length > 0))
  }

  async function handleExerciseChange(exercise) {
    setSelectedExercise(exercise)
    if (teamGraphData.length > 0 && groupId) {
      const members = teamGraphData.map(m => ({
        user_id: m.userId,
        profiles: { display_name: m.name }
      }))
      await loadExerciseGraph(exercise, groupId, members)
    }
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

        {/* 種目別チーム比較グラフ */}
        {exerciseList.length > 0 && (
          <div className="card mb-3">
            <p className="card-title">📊 種目別チーム比較</p>

            {/* 種目選択 */}
            <div className="flex flex-wrap gap-2 mb-3">
              {exerciseList.map(ex => (
                <button
                  key={ex}
                  onClick={() => handleExerciseChange(ex)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedExercise === ex
                      ? 'bg-gym-orange text-black'
                      : 'bg-gym-surface border border-gym-border text-gym-muted'
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>

            {exerciseGraphData.length === 0 ? (
              <p className="text-gym-muted text-sm text-center py-4">まだデータがありません</p>
            ) : (
              <>
                <div className="bg-gym-surface rounded-xl p-3 mb-3">
                  {(() => {
                    const allPoints = exerciseGraphData.flatMap(d => d.points)
                    if (allPoints.length < 1) return null
                    const maxW = Math.max(...allPoints.map(p => p.weight))
                    const minW = Math.min(...allPoints.map(p => p.weight))
                    const range = maxW - minW || 1
                    const W = 300, H = 140, PAD = 28

                    return (
                      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
                        {/* 横グリッド */}
                        {[0, 0.5, 1].map((t, i) => (
                          <g key={i}>
                            <line x1={PAD} y1={PAD + (1-t) * (H - PAD * 2)} x2={W - PAD} y2={PAD + (1-t) * (H - PAD * 2)} stroke="#2a2a2a" strokeWidth="0.5"/>
                            <text x={PAD - 2} y={PAD + (1-t) * (H - PAD * 2) + 3} textAnchor="end" fontSize="8" fill="#555">
                              {Math.round(minW + t * range)}kg
                            </text>
                          </g>
                        ))}

                        {exerciseGraphData.map((member) => {
                          if (member.points.length < 1) return null
                          const pts = member.points.map((p, i) => ({
                            x: PAD + (i / Math.max(member.points.length - 1, 1)) * (W - PAD * 2),
                            y: H - PAD - ((p.weight - minW) / range) * (H - PAD * 2),
                            ...p
                          }))
                          const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                          const last = pts[pts.length - 1]
                          return (
                            <g key={member.name}>
                              <path d={pathD} fill="none" stroke={member.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                              {pts.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r="3" fill={member.color}/>
                              ))}
                              <text x={last.x + 4} y={last.y + 3} fontSize="8" fill={member.color} fontWeight="bold">
                                {last.weight}kg
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    )
                  })()}
                </div>

                {/* 凡例 */}
                <div className="flex flex-wrap gap-3">
                  {exerciseGraphData.map(member => {
                    const latest = member.points[member.points.length - 1]
                    const first = member.points[0]
                    const diff = latest.weight - first.weight
                    return (
                      <div key={member.name} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: member.color }}/>
                        <span className="text-xs text-gym-muted">{member.name}</span>
                        <span className="text-xs font-black" style={{ color: member.color }}>{latest.weight}kg</span>
                        {diff !== 0 && (
                          <span className={`text-xs font-bold ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff > 0 ? `+${diff}` : diff}kg
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Post button */}
        <Link href="/post" className="btn-orange block text-center text-lg mt-2">
          📸　今日ジム行った！投稿
        </Link>

        {/* Push notification section */}
        {supported && (
          <div className="card mt-3">
            <p className="card-title">🔔 煽り通知</p>
            {permission !== 'granted' ? (
              <>
                <p className="text-sm text-gym-muted mb-3">通知をオンにするとグループの誰かから煽りが届く！</p>
                <button className="btn-orange py-3 text-sm" onClick={enableNotifications}>
                  通知をオンにする
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-green-400 mb-3">✓ 通知オン済み</p>
                {sendMsg && (
                  <p className="text-xs text-gym-orange mb-2">{sendMsg}</p>
                )}
                <button
                  onClick={sendTauntToGroup}
                  disabled={sending}
                  className="w-full py-3 bg-gym-orange text-black font-black text-sm rounded-2xl active:opacity-70 disabled:opacity-50"
                >
                  {sending ? '送信中...' : '🔥 グループ全員に煽りを送る'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
