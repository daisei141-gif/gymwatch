// @ts-nocheck
'use client'
import { useEffect, useState, useCallback } from 'react'
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
  const [tab, setTab] = useState('record')
  const [selectedBodyPart, setSelectedBodyPart] = useState('胸')
  const [newExerciseName, setNewExerciseName] = useState('')
  const [trainedAt, setTrainedAt] = useState(new Date().toISOString().split('T')[0])
  const [calendarData, setCalendarData] = useState({})
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [calendarDayLogs, setCalendarDayLogs] = useState([])
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null)
  const [filterPart, setFilterPart] = useState('全て')

  // 記録中の種目リスト（その日の）
  const [dayWorkouts, setDayWorkouts] = useState([])
  // { exercise_id, exercise_name, sets: [{id, weight, reps}] }

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
      await loadDayWorkouts(user.id, member.group_id, new Date().toISOString().split('T')[0])
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

  async function loadDayWorkouts(uId, gId, date) {
    const { data } = await supabase
      .from('workout_sets')
      .select('*, exercises(name, body_part)')
      .eq('user_id', uId)
      .eq('group_id', gId)
      .eq('trained_at', date)
      .order('created_at', { ascending: true })

    // exercise_idでグループ化
    const grouped = {}
    data?.forEach(s => {
      if (!grouped[s.exercise_id]) {
        grouped[s.exercise_id] = {
          exercise_id: s.exercise_id,
          exercise_name: s.exercises?.name || '不明',
          sets: []
        }
      }
      grouped[s.exercise_id].sets.push({ id: s.id, weight: s.weight_kg || '', reps: s.reps || '' })
    })
    setDayWorkouts(Object.values(grouped))
  }

  async function addExerciseToDay(exercise) {
    // すでに追加済みか確認
    if (dayWorkouts.find(w => w.exercise_id === exercise.id)) return

    // 1セット目を即座に追加
    const { data, error } = await supabase.from('workout_sets').insert({
      user_id: userId,
      group_id: groupId,
      exercise_id: exercise.id,
      weight_kg: null,
      reps: null,
      trained_at: trainedAt,
    }).select().single()

    if (!error && data) {
      setDayWorkouts(prev => [...prev, {
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        sets: [{ id: data.id, weight: '', reps: '' }]
      }])
      await loadCalendar(userId, groupId)
    }
  }

  async function addSetToExercise(exerciseId) {
    const { data, error } = await supabase.from('workout_sets').insert({
      user_id: userId,
      group_id: groupId,
      exercise_id: exerciseId,
      weight_kg: null,
      reps: null,
      trained_at: trainedAt,
    }).select().single()

    if (!error && data) {
      setDayWorkouts(prev => prev.map(w =>
        w.exercise_id === exerciseId
          ? { ...w, sets: [...w.sets, { id: data.id, weight: '', reps: '' }] }
          : w
      ))
    }
  }

  async function updateSet(setId, exerciseId, field, value) {
    // UIを即更新
    setDayWorkouts(prev => prev.map(w =>
      w.exercise_id === exerciseId
        ? { ...w, sets: w.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) }
        : w
    ))

    // Supabaseに保存
    const updateData = field === 'weight'
      ? { weight_kg: value ? parseFloat(value) : null }
      : { reps: value ? parseInt(value) : null }
    await supabase.from('workout_sets').update(updateData).eq('id', setId)
  }

  async function removeSet(setId, exerciseId) {
    await supabase.from('workout_sets').delete().eq('id', setId)
    setDayWorkouts(prev => prev.map(w =>
      w.exercise_id === exerciseId
        ? { ...w, sets: w.sets.filter(s => s.id !== setId) }
        : w
    ).filter(w => w.sets.length > 0))
    await loadCalendar(userId, groupId)
  }

  async function addExercise() {
    if (!newExerciseName.trim()) return
    const { data, error } = await supabase.from('exercises').insert({
      group_id: groupId,
      name: newExerciseName.trim(),
      body_part: selectedBodyPart,
      created_by: userId,
    }).select().single()
    if (!error && data) {
      setNewExerciseName('')
      await loadExercises(groupId)
    }
  }

  async function handleCalendarDayTap(dateStr) {
    setSelectedCalendarDay(dateStr)
    // その日のログを取得
    const { data } = await supabase
      .from('workout_sets')
      .select('*, exercises(name, body_part)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .eq('trained_at', dateStr)
      .order('created_at', { ascending: true })

    const grouped = {}
    data?.forEach(s => {
      if (!grouped[s.exercise_id]) {
        grouped[s.exercise_id] = {
          name: s.exercises?.name || '不明',
          sets: []
        }
      }
      grouped[s.exercise_id].sets.push({ weight: s.weight_kg, reps: s.reps })
    })
    setCalendarDayLogs(Object.values(grouped))
  }

  const filteredExercises = filterPart === '全て'
    ? exercises
    : exercises.filter(e => e.body_part === filterPart)

  // カレンダー描画
  function renderCalendar() {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date().toISOString().split('T')[0]
    const dateStr = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCalendarMonth(new Date(year, month - 1))} className="text-gym-muted px-3 py-1 text-xl">←</button>
          <p className="font-black">{year}年{month + 1}月</p>
          <button onClick={() => setCalendarMonth(new Date(year, month + 1))} className="text-gym-muted px-3 py-1 text-xl">→</button>
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
            const isSelected = ds === selectedCalendarDay
            return (
              <div
                key={i}
                onClick={() => trained && handleCalendarDayTap(ds)}
                className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold transition-all
                  ${isSelected ? 'bg-white text-black' :
                    trained ? 'bg-gym-orange text-black cursor-pointer active:opacity-70' :
                    isToday ? 'border border-gym-orange text-gym-orange' :
                    'text-gym-muted'}`}
              >
                {d}
              </div>
            )
          })}
        </div>

        {/* 選択日のログ */}
        {selectedCalendarDay && calendarDayLogs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gym-border">
            <p className="font-black text-sm mb-3">
              {new Date(selectedCalendarDay + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}の記録
            </p>
            {calendarDayLogs.map((ex, i) => (
              <div key={i} className="mb-3">
                <p className="font-bold text-gym-orange text-sm mb-1">{ex.name}</p>
                {ex.sets.map((s, j) => (
                  <div key={j} className="flex gap-3 text-sm text-gym-muted ml-2">
                    <span>セット{j + 1}</span>
                    {s.weight && <span className="font-bold text-white">{s.weight}kg</span>}
                    {s.reps && <span>{s.reps}レップ</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {selectedCalendarDay && calendarDayLogs.length === 0 && (
          <p className="text-gym-muted text-sm text-center mt-4">記録なし</p>
        )}
      </div>
    )
  }

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
            <div className="flex items-center gap-3 mb-3">
              <input
                type="date"
                value={trainedAt}
                onChange={async e => {
                  setTrainedAt(e.target.value)
                  setDayWorkouts([])
                  await loadDayWorkouts(userId, groupId, e.target.value)
                }}
                className="input-field mb-0 flex-1"
              />
            </div>

            {/* その日の記録 */}
            {dayWorkouts.map(w => (
              <div key={w.exercise_id} className="card mb-3">
                <p className="card-title text-gym-orange">{w.exercise_name}</p>
                <div className="grid grid-cols-3 text-xs text-gym-muted font-bold mb-2 px-1">
                  <span>セット</span>
                  <span>kg</span>
                  <span>レップ</span>
                </div>
                {w.sets.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gym-orange/20 border border-gym-orange/30 flex items-center justify-center text-gym-orange font-black text-sm flex-shrink-0">
                      {i + 1}
                    </div>
                    <input
                      type="number"
                      placeholder="80"
                      value={s.weight}
                      onChange={e => updateSet(s.id, w.exercise_id, 'weight', e.target.value)}
                      className="input-field mb-0 flex-1 text-center"
                    />
                    <input
                      type="number"
                      placeholder="10"
                      value={s.reps}
                      onChange={e => updateSet(s.id, w.exercise_id, 'reps', e.target.value)}
                      className="input-field mb-0 flex-1 text-center"
                    />
                    <button onClick={() => removeSet(s.id, w.exercise_id)} className="text-red-400 text-lg flex-shrink-0">×</button>
                  </div>
                ))}
                <button
                  onClick={() => addSetToExercise(w.exercise_id)}
                  className="w-full py-2 border border-dashed border-gym-orange/40 rounded-xl text-gym-orange text-xs font-bold"
                >
                  ＋ セット追加
                </button>
              </div>
            ))}

            {/* 種目を追加するボタン */}
            <div className="card">
              <p className="card-title">種目を追加</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {['全て', ...BODY_PARTS].map(part => (
                  <button
                    key={part}
                    onClick={() => setFilterPart(part)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold ${
                      filterPart === part ? 'bg-gym-orange text-black' : 'bg-gym-surface border border-gym-border text-gym-muted'
                    }`}
                  >
                    {part}
                  </button>
                ))}
              </div>
              {filteredExercises.length === 0 ? (
                <p className="text-gym-muted text-sm text-center py-3">「種目追加」タブで種目を作ってください</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredExercises.map(ex => {
                    const already = dayWorkouts.find(w => w.exercise_id === ex.id)
                    return (
                      <button
                        key={ex.id}
                        onClick={() => !already && addExerciseToDay(ex)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          already
                            ? 'bg-gym-orange text-black opacity-50'
                            : 'bg-gym-surface border border-gym-border text-gym-muted active:opacity-70'
                        }`}
                      >
                        {already ? '✓ ' : '＋ '}{ex.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
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
                        <div key={ex.id} className="py-1.5 border-b border-gym-border last:border-b-0">
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
