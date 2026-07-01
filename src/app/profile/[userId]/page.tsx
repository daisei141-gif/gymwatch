// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

const COLORS = ['#ff6b1a','#3ecf8e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#ef4444','#84cc16','#f97316']

export default function ProfilePage() {
  const router = useRouter()
  const params = useParams()
  const targetUserId = params.userId
  const supabase = createClient()

  const [myId, setMyId] = useState('')
  const [profile, setProfile] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [postCount, setPostCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState('')
  const [exercises, setExercises] = useState([])

  useEffect(() => { loadProfile() }, [targetUserId])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }
    setMyId(user.id)

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()
    setProfile(prof)

    // 今月の投稿数
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .eq('status', 'approved')
      .gte('created_at', startOfMonth)
    setPostCount(count || 0)

    // 筋トレログ
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: true })
    setWorkouts(logs || [])

    // 種目リスト
    const uniqueExercises = [...new Set((logs || []).map(l => l.exercise))]
    setExercises(uniqueExercises)
    if (uniqueExercises.length > 0) setSelectedExercise(uniqueExercises[0])

    setLoading(false)
  }

  // 選択種目のデータ
  const exerciseData = workouts
    .filter(w => w.exercise === selectedExercise && w.weight_kg)
    .map(w => ({
      date: new Date(w.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
      weight: w.weight_kg,
    }))

  // グラフ描画
  function renderGraph() {
    if (exerciseData.length < 2) return null
    const maxW = Math.max(...exerciseData.map(d => d.weight))
    const minW = Math.min(...exerciseData.map(d => d.weight))
    const range = maxW - minW || 1
    const W = 300, H = 120, PAD = 20

    const points = exerciseData.map((d, i) => ({
      x: PAD + (i / (exerciseData.length - 1)) * (W - PAD * 2),
      y: H - PAD - ((d.weight - minW) / range) * (H - PAD * 2),
      ...d
    }))

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <path d={pathD} fill="none" stroke="#ff6b1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#ff6b1a"/>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#888">{p.weight}kg</text>
            {i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2) ? (
              <text x={p.x} y={H - 4} textAnchor="middle" fontSize="8" fill="#666">{p.date}</text>
            ) : null}
          </g>
        ))}
      </svg>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gym-orange font-black text-2xl animate-pulse">LOADING...</p>
    </div>
  )

  const isMe = myId === targetUserId

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="text-gym-muted text-2xl">←</button>
        <h2 className="section-title mb-0">{isMe ? 'マイページ' : `${profile?.display_name}のページ`}</h2>
      </div>

      <div className="px-4">
        {/* プロフィール */}
        <div className="card mb-3">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gym-orange/20 border-2 border-gym-orange/40 flex items-center justify-center text-3xl font-black text-gym-orange">
              {(profile?.display_name || '?')[0]}
            </div>
            <div>
              <p className="text-xl font-black">{profile?.display_name}</p>
              <p className="text-gym-muted text-sm">今月のジム回数：<span className="text-gym-orange font-black">{postCount}回</span></p>
            </div>
          </div>
        </div>

        {/* 種目別グラフ */}
        <div className="card mb-3">
          <p className="card-title">📈 重量推移</p>
          {exercises.length === 0 ? (
            <p className="text-gym-muted text-sm text-center py-4">まだ筋トレメモがありません</p>
          ) : (
            <>
              {/* 種目選択 */}
              <div className="flex flex-wrap gap-2 mb-4">
                {exercises.map(ex => (
                  <button
                    key={ex}
                    onClick={() => setSelectedExercise(ex)}
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

              {exerciseData.length >= 2 ? (
                <div className="bg-gym-surface rounded-xl p-3">
                  {renderGraph()}
                </div>
              ) : (
                <p className="text-gym-muted text-sm text-center py-4">データが2件以上になるとグラフが表示されます</p>
              )}
            </>
          )}
        </div>

        {/* 筋トレ記録一覧 */}
        <div className="card">
          <p className="card-title">📝 筋トレ記録</p>
          {workouts.length === 0 ? (
            <p className="text-gym-muted text-sm text-center py-4">まだ記録がありません</p>
          ) : (
            <div className="space-y-2">
              {[...workouts].reverse().slice(0, 20).map(w => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-gym-border last:border-b-0">
                  <div>
                    <p className="font-bold text-sm">{w.exercise}</p>
                    <p className="text-xs text-gym-muted">
                      {new Date(w.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div className="text-right">
                    {w.weight_kg && <p className="font-black text-gym-orange">{w.weight_kg}kg</p>}
                    {w.sets && w.reps && (
                      <p className="text-xs text-gym-muted">{w.sets}セット×{w.reps}レップ</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
