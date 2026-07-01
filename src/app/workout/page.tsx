// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

const BODY_PARTS = ['胸', '腕', '肩', '背中', '足']

export default function WorkoutPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [loading, setLoading] = useState(true)
  const [exercises, setExercises] = useState([])
  const [tab, setTab] = useState('record') // record | calendar | add
  const [selectedBodyPart, setSelectedBodyPart] = useState('胸')
  const [newExerciseName, setNewExerciseName] = useState('')
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [sets, setSets] = useState([{ weight: '', reps: '' }])
  const [trainedAt, setTrainedAt] = useState(new Date().toISOString().split('T')[0])
  const [calendarData, setCalendarData] = useState({})
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [savedMsg, setSavedMsg] = useState('')
  const [filterPart, setFilterPart] = useState('全て')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }
    setUserId(user.id)

    const { data: member } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single()

    if (member) {
      setGroupId(member.group_id)
      await loadExercises(member.group_id)
      await loadCalendar(user.id, member.group_id)
    }
    setLoading(false)
  }

  async function loadExercises(gId) {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('group_id', gId)
      .order('body_part', { ascending: true })
    setExercises(data || [])
  }

  async function loadCalendar(uId, gId) {
    const { data } = await supabase
      .from('workout_sets')
      .select('trained_at')
      .eq('user_id', uId)
      .eq('group_id', gId)
    const map = {}
    data?.forEach(s => { map[s.trained_at] = true })
    setCalendarData(map)
  }

  async function addExercise() {
    if (!newExerciseName.trim()) return
    const { error } = await supabase.from('exercises').insert({
      group_id: groupId,
      name: newExerciseName.trim(),
      body_part: selectedBodyPart,
      created_by: userId,
    })
    if (!error) {
      setNewExerciseName('')
      await loadExercises(groupId)
      setTab('record')
    }
  }

  function addSet() {
    setSets(prev => [...prev, { weight: '', reps: '' }])
  }

  function removeSet(i) {
    setSets(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateSet(i, field, value) {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  async function saveWorkout() {
    if (!selectedExercise) return
    const validSets = sets.filter(s => s.weight || s.reps)
    if (validSets.length === 0) return

    const { error } = await supabase.from('workout_sets').insert(
      validSets.map(s => ({
        user_id: userId,
        group_id: groupId,
        exercise_id: selectedExercise.id,
        weight_kg: s.weight ? parseFloat(s.weight) : null,
        reps: s.reps ? parseInt(s.reps) : null,
        trained_at: trainedAt,
      }))
    )
    if (!error) {
      setSets([{ weight: '', reps: '' }])
      setSelectedExercise(null)
      await loadCalendar(userId, groupId)
      setSavedMsg('保存しました！')
      setTimeout(() => setSavedMsg(''), 2000)
    }
  }

  // カレンダー描画
  function renderCalendar() {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date().toISOString().split('T')[0]

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    const dateStr = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCalendarMonth(new Date(year, month - 1))} className="text-gym-muted px-3 py-1">←</button>
          <p className="font-black">{year}年{month + 1}月</p>
          <button onClick={() => setCalendarMonth(new Date(year, month + 1))} className="text-gym-muted px-3 py-1">→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['日','月','火','水','木','金','土'].map(d => (
            <div key={d} className="text-center text-xs text-gym-muted font-bold py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i}/>
            const ds = dateStr(d)
            const trained = calendarData[ds]
            const isToday = ds === today
            return (
              <div
                key={i}
                className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold cursor-pointer
                  ${trained ? 'bg-gym-orange text-black' : isToday ? 'border border-gym-orange text-gym-orange' : 'text-gym-muted'}`}
                onClick={() => { setTrainedAt(ds); setTab('record') }}
              >
                {d}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gym-muted mt-3 text-center">オレンジ：トレーニングした日　日付タップで記録</p>
      </div>
    )
  }

  const filteredExercises = filterPart === '全て'
    ? exercises
    : exercises.filter(e => e.body_part === filterPart)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gym-orange font-black text-2xl animate-pulse">LOADING...</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto">
      <div className="px-4 pt-12 pb-3">
        <h2 className="section-title">💪 筋トレメモ</h2>
      </div>

      {/* タブ */}
      <div className="flex px-4 gap-2 mb-4">
        {[['record', '記録'], ['calendar', 'カレンダー'], ['add', '種目追加']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === key ? 'bg-gym-orange text-black' : 'bg-gym-surface border border-gym-border text-gym-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4">

        {/* 記録タブ */}
        {tab === 'record' && (
          <>
            {/* 日付 */}
            <div className="card mb-3">
              <p className="card-title">📅 記録日</p>
              <input
                type="date"
                value={trainedAt}
                onChange={e => setTrainedAt(e.target.value)}
                className="input-field mb-0"
              />
            </div>

            {/* 種目選択 */}
            <div className="card mb-3">
              <p className="card-title">種目を選ぶ</p>

              {/* 部位フィルター */}
              <div className="flex flex-wrap gap-2 mb-3">
                {['全て', ...BODY_PARTS].map(part => (
                  <button
                    key={part}
                    onClick={() => setFilterPart(part)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      filterPart === part ? 'bg-gym-orange text-black' : 'bg-gym-surface border border-gym-border text-gym-muted'
                    }`}
                  >
                    {part}
                  </button>
                ))}
              </div>

              {/* 種目プルダウン */}
              {filteredExercises.length === 0 ? (
                <p className="text-gym-muted text-sm text-center py-3">種目がありません。「種目追加」から追加してください</p>
              ) : (
                <select
                  className="input-field mb-0"
                  value={selectedExercise?.id || ''}
                  onChange={e => setSelectedExercise(exercises.find(ex => ex.id === e.target.value) || null)}
                >
                  <option value="">-- 種目を選択 --</option>
                  {filteredExercises.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.body_part} / {ex.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* セット記録 */}
            {selectedExercise && (
              <div className="card mb-3">
                <p className="card-title">{selectedExercise.name}</p>
                <div className="grid grid-cols-3 text-xs text-gym-muted font-bold mb-2 px-1">
                  <span>セット</span>
                  <span>kg</span>
                  <span>レップ</span>
                </div>
                {sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gym-orange/20 border border-gym-orange/30 flex items-center justify-center text-gym-orange font-black text-sm flex-shrink-0">
                      {i + 1}
                    </div>
                    <input
                      type="number"
                      placeholder="80"
                      value={s.weight}
                      onChange={e => updateSet(i, 'weight', e.target.value)}
                      className="input-field mb-0 flex-1 text-center"
                    />
                    <input
                      type="number"
                      placeholder="10"
                      value={s.reps}
                      onChange={e => updateSet(i, 'reps', e.target.value)}
                      className="input-field mb-0 flex-1 text-center"
                    />
                    {sets.length > 1 && (
                      <button onClick={() => removeSet(i)} className="text-red-400 text-lg flex-shrink-0">×</button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addSet}
                  className="w-full py-2 border border-dashed border-gym-orange/40 rounded-xl text-gym-orange text-sm font-bold mb-3"
                >
                  ＋ セット追加
                </button>
                {savedMsg && <p className="text-green-400 text-sm text-center mb-2">{savedMsg}</p>}
                <button className="btn-orange" onClick={saveWorkout}>💾 保存する</button>
              </div>
            )}
          </>
        )}

        {/* カレンダータブ */}
        {tab === 'calendar' && (
          <div className="card">
            {renderCalendar()}
          </div>
        )}

        {/* 種目追加タブ */}
        {tab === 'add' && (
          <div className="card">
            <p className="card-title">新しい種目を追加</p>
            <p className="text-xs text-gym-muted mb-3">追加した種目はグループ全員で共有されます</p>

            <label className="input-label">部位</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {BODY_PARTS.map(part => (
                <button
                  key={part}
                  onClick={() => setSelectedBodyPart(part)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    selectedBodyPart === part ? 'bg-gym-orange text-black' : 'bg-gym-surface border border-gym-border text-gym-muted'
                  }`}
                >
                  {part}
                </button>
              ))}
            </div>

            <label className="input-label">種目名</label>
            <input
              className="input-field"
              placeholder="例：インクラインベンチプレス"
              value={newExerciseName}
              onChange={e => setNewExerciseName(e.target.value)}
            />
            <button className="btn-orange" onClick={addExercise}>追加する</button>

            {/* 既存種目一覧 */}
            {exercises.length > 0 && (
              <div className="mt-4">
                <p className="card-title">登録済み種目</p>
                {BODY_PARTS.map(part => {
                  const partExercises = exercises.filter(e => e.body_part === part)
                  if (partExercises.length === 0) return null
                  return (
                    <div key={part} className="mb-3">
                      <p className="text-xs font-bold text-gym-orange mb-1">{part}</p>
                      {partExercises.map(ex => (
                        <div key={ex.id} className="flex items-center justify-between py-1.5 border-b border-gym-border last:border-b-0">
                          <p className="text-sm">{ex.name}</p>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
