// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

function makeCode() {
  return 'GW-' + Math.random().toString(36).substring(2, 6).toUpperCase()
}

export default function GroupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState('')
  const [group, setGroup] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [myGoal, setMyGoal] = useState(12)
  const [newGoal, setNewGoal] = useState(12)
  const [penalty, setPenalty] = useState('')
  const [editPenalty, setEditPenalty] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupPenalty, setNewGroupPenalty] = useState('')
  const [tab, setTab] = useState<'main' | 'create' | 'join'>('main')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { loadGroup() }, [])

  async function loadGroup() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }
    setUserId(user.id)

    const { data: memberRaw }: { data: any } = await supabase
      .from('group_members')
      .select('group_id, monthly_goal, groups(id, name, invite_code, penalty)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single()

    const member: any = memberRaw

    if (member) {
      const groupData: any = member.groups
      setGroup(groupData)
      setMyGoal(member.monthly_goal)
      setNewGoal(member.monthly_goal)
      setPenalty((groupData && groupData.penalty) || '')

      const { data: membersList } = await supabase
        .from('group_members')
        .select('user_id, monthly_goal, profiles(display_name)')
        .eq('group_id', member.group_id)
      setMembers(membersList || [])
    }
    setLoading(false)
  }

  async function createGroup() {
    if (!newGroupName.trim()) { setErr('グループ名を入力してください'); return }
    setErr('')
    const code = makeCode()
    const { data, error } = await supabase.from('groups').insert({
      name: newGroupName,
      invite_code: code,
      penalty: newGroupPenalty,
      created_by: userId,
    }).select().single()

    if (error || !data) { setErr('作成に失敗しました'); return }

    await supabase.from('group_members').insert({
      group_id: data.id, user_id: userId, monthly_goal: 12
    })
    setMsg(`グループ「${newGroupName}」を作成しました！`)
    loadGroup()
    setTab('main')
  }

  async function joinGroup() {
    if (!inviteCode.trim()) { setErr('招待コードを入力してください'); return }
    setErr('')
    const { data: grp } = await supabase
      .from('groups')
      .select('id, name')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()

    if (!grp) { setErr('招待コードが見つかりません'); return }

    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', grp.id)
    if ((count || 0) >= 10) { setErr('グループは最大10人です'); return }

    const { error } = await supabase.from('group_members').insert({
      group_id: grp.id, user_id: userId, monthly_goal: 12
    })
    if (error) { setErr('すでに参加しているか、エラーが発生しました'); return }
    setMsg(`「${grp.name}」に参加しました！`)
    loadGroup()
    setTab('main')
  }

  async function saveGoal() {
    const { data: member } = await supabase
      .from('group_members')
      .select('id')
      .eq('user_id', userId)
      .eq('group_id', group?.id)
      .single()
    if (!member) return
    await supabase.from('group_members').update({ monthly_goal: newGoal }).eq('id', member.id)
    setMyGoal(newGoal)
    setMsg('目標を保存しました！')
  }

  async function savePenalty() {
    await supabase.from('groups').update({ penalty }).eq('id', group?.id)
    setEditPenalty(false)
    setMsg('罰ゲームを更新しました！')
  }

  function copyCode() {
    navigator.clipboard.writeText(group?.invite_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gym-orange font-black text-2xl animate-pulse">LOADING...</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto">
      <div className="px-4 pt-12 pb-3">
        <h2 className="section-title">グループ</h2>
      </div>

      <div className="px-4">
        {msg && (
          <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-3 mb-3 text-green-400 text-sm">
            {msg}
          </div>
        )}

        {/* No group */}
        {!group && tab === 'main' && (
          <div className="card text-center py-8">
            <p className="text-4xl mb-3">💪</p>
            <p className="font-black text-xl mb-2">グループに参加しよう</p>
            <p className="text-gym-muted text-sm mb-6">2〜10人でジムをお互い監視し合おう</p>
            <button className="btn-orange mb-2" onClick={() => setTab('create')}>新しいグループを作る</button>
            <button className="btn-ghost" onClick={() => setTab('join')}>招待コードで参加する</button>
          </div>
        )}

        {/* Create */}
        {tab === 'create' && (
          <div className="card">
            <p className="card-title">グループを作成</p>
            <label className="input-label">グループ名</label>
            <input className="input-field" placeholder="筋肉部隊α" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
            <label className="input-label">罰ゲーム（任意）</label>
            <input className="input-field" placeholder="未達成者は飲み会で全額払い" value={newGroupPenalty} onChange={e => setNewGroupPenalty(e.target.value)} />
            {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
            <button className="btn-orange" onClick={createGroup}>作成する</button>
            <button className="btn-ghost mt-2" onClick={() => { setTab('main'); setErr('') }}>戻る</button>
          </div>
        )}

        {/* Join */}
        {tab === 'join' && (
          <div className="card">
            <p className="card-title">招待コードで参加</p>
            <label className="input-label">招待コード</label>
            <input className="input-field" placeholder="GW-XXXX" value={inviteCode} onChange={e => setInviteCode(e.target.value)} />
            {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
            <button className="btn-orange" onClick={joinGroup}>参加する</button>
            <button className="btn-ghost mt-2" onClick={() => { setTab('join'); setErr('') }}>戻る</button>
          </div>
        )}

        {/* Group exists */}
        {group && tab === 'main' && (
          <>
            {/* Group info */}
            <div className="card">
              <p className="card-title">{group.name}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {members.map(m => (
                  <span key={m.user_id} className="bg-gym-orange/10 border border-gym-orange/20
                                                    text-gym-orange text-xs font-bold px-3 py-1 rounded-full">
                    {m.profiles?.display_name}
                  </span>
                ))}
              </div>
              {/* Invite code */}
              <div className="flex items-center gap-2 bg-gym-surface rounded-xl p-3 border border-gym-border">
                <div className="flex-1">
                  <p className="text-xs text-gym-muted mb-0.5">招待コード</p>
                  <p className="text-xl font-black text-gym-orange tracking-widest">{group.invite_code}</p>
                </div>
                <button
                  onClick={copyCode}
                  className="bg-gym-orange/10 border border-gym-orange/30 text-gym-orange
                             text-xs font-bold px-4 py-2 rounded-xl active:opacity-70"
                >
                  {copied ? '✓ コピー済み' : '📋 コピー'}
                </button>
              </div>
              <p className="text-xs text-gym-muted mt-2">このコードを友達に送ってグループに招待しよう（最大10人）</p>
            </div>

            {/* Goal */}
            <div className="card">
              <p className="card-title">今月の目標</p>
              <div className="flex items-center justify-between">
                <p className="text-sm">今月のジム回数目標</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNewGoal(g => Math.max(1, g - 1))}
                    className="w-8 h-8 bg-gym-border rounded-lg font-black text-lg flex items-center justify-center"
                  >-</button>
                  <span className="text-2xl font-black text-gym-orange w-8 text-center">{newGoal}</span>
                  <button
                    onClick={() => setNewGoal(g => Math.min(31, g + 1))}
                    className="w-8 h-8 bg-gym-border rounded-lg font-black text-lg flex items-center justify-center"
                  >+</button>
                </div>
              </div>
              {newGoal !== myGoal && (
                <button className="btn-orange mt-3 py-3 text-sm" onClick={saveGoal}>保存する</button>
              )}
            </div>

            {/* Penalty */}
            <div className="bg-[#0a0014] border border-purple-800/50 rounded-2xl p-4 mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">🎲 罰ゲーム</p>
              {editPenalty ? (
                <>
                  <input
                    className="input-field text-sm"
                    value={penalty}
                    onChange={e => setPenalty(e.target.value)}
                    placeholder="例：飲み会で全額払い"
                  />
                  <div className="flex gap-2">
                    <button className="btn-orange py-2.5 text-sm" onClick={savePenalty}>保存</button>
                    <button className="btn-ghost py-2.5 text-sm" onClick={() => setEditPenalty(false)}>キャンセル</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-purple-300 font-bold text-sm mb-3">{penalty || '未設定'}</p>
                  <button
                    onClick={() => setEditPenalty(true)}
                    className="text-xs text-purple-400 border border-purple-800/50 rounded-lg px-4 py-2"
                  >✏️ 編集</button>
                </>
              )}
            </div>

            <button className="btn-ghost" onClick={() => setTab('join')}>別のグループに参加する</button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
