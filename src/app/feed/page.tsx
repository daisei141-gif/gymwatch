// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

const STAMP_EMOJIS = ['💪', '🔥', '😂', '👏', '🤣']

export default function FeedPage() {
  const router = useRouter()
  const supabase = createClient()
  const [posts, setPosts] = useState([])
  const [goalLogs, setGoalLogs] = useState([])
  const [userId, setUserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [memberCount, setMemberCount] = useState(2)
  const [loading, setLoading] = useState(true)
  const [myVotes, setMyVotes] = useState({})
  const [stamps, setStamps] = useState({})

  useEffect(() => { loadFeed() }, [])

  async function loadFeed() {
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

    if (!member) { setLoading(false); return }
    setGroupId(member.group_id)

    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', member.group_id)
    setMemberCount(count || 2)

    // 投稿を取得
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles(display_name)')
      .eq('group_id', member.group_id)
      .order('created_at', { ascending: false })
      .limit(30)
    setPosts(postsData || [])

    // 目標変更ログを取得
    const { data: logsData } = await supabase
      .from('goal_logs')
      .select('*, profiles(display_name)')
      .eq('group_id', member.group_id)
      .order('created_at', { ascending: false })
      .limit(20)
    setGoalLogs(logsData || [])

    // 自分の投票を取得
    const { data: votesData } = await supabase
      .from('votes')
      .select('post_id, vote_type')
      .eq('user_id', user.id)
    const vmap = {}
    votesData?.forEach(v => { vmap[v.post_id] = v.vote_type })
    setMyVotes(vmap)

    // スタンプを取得
    const postIds = (postsData || []).map(p => p.id)
    if (postIds.length > 0) {
      const { data: stampsData } = await supabase
        .from('stamps')
        .select('*')
        .in('post_id', postIds)

      const smap = {}
      stampsData?.forEach(s => {
        if (!smap[s.post_id]) smap[s.post_id] = {}
        if (!smap[s.post_id][s.emoji]) smap[s.post_id][s.emoji] = []
        smap[s.post_id][s.emoji].push(s.user_id)
      })
      setStamps(smap)
    }

    setLoading(false)
  }

  async function vote(postId, type) {
    if (myVotes[postId]) return
    setMyVotes(prev => ({ ...prev, [postId]: type }))

    await supabase.from('votes').insert({ post_id: postId, user_id: userId, vote_type: type })

    const post = posts.find(p => p.id === postId)
    if (!post) return
    const newApproved = post.approved_count + (type === 'approve' ? 1 : 0)
    const newRejected = post.rejected_count + (type === 'reject' ? 1 : 0)
    const majority = memberCount <= 2 ? 1 : Math.floor(memberCount / 2) + 1
    const newStatus = newApproved >= majority ? 'approved' : newRejected >= majority ? 'rejected' : 'pending'

    await supabase.from('posts').update({
      approved_count: newApproved,
      rejected_count: newRejected,
      status: newStatus,
    }).eq('id', postId)

    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, approved_count: newApproved, rejected_count: newRejected, status: newStatus }
        : p
    ))
  }

  async function toggleStamp(postId, emoji) {
    const currentStamps = stamps[postId]?.[emoji] || []
    const alreadyStamped = currentStamps.includes(userId)

    if (alreadyStamped) {
      // スタンプを外す
      await supabase.from('stamps').delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('emoji', emoji)

      setStamps(prev => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          [emoji]: currentStamps.filter(id => id !== userId)
        }
      }))
    } else {
      // スタンプを押す
      await supabase.from('stamps').insert({ post_id: postId, user_id: userId, emoji })

      setStamps(prev => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          [emoji]: [...currentStamps, userId]
        }
      }))
    }
  }

  function timeAgo(date) {
    const diff = (Date.now() - new Date(date).getTime()) / 1000
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`
    return `${Math.floor(diff / 86400)}日前`
  }

  // 投稿とゴールログを時系列でマージ
  const feedItems = [
    ...(posts || []).map(p => ({ ...p, type: 'post' })),
    ...(goalLogs || []).map(l => ({ ...l, type: 'goal_log' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gym-orange font-black text-2xl animate-pulse">LOADING...</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto">
      <div className="px-4 pt-12 pb-3">
        <h2 className="section-title">みんなの投稿</h2>
      </div>

      <div className="px-4">
        {feedItems.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-black text-lg mb-1">まだ投稿がありません</p>
            <p className="text-gym-muted text-sm">最初の投稿をしよう！</p>
          </div>
        )}

        {feedItems.map(item => {
          // 目標変更ログ
          if (item.type === 'goal_log') {
            return (
              <div key={item.id} className="bg-gym-surface border border-gym-border rounded-2xl p-3 mb-3 flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div className="flex-1">
                  <p className="text-sm text-gym-text">
                    <span className="font-bold text-gym-orange">{item.profiles?.display_name}</span>
                    {' '}が今月の目標を{' '}
                    <span className="font-bold text-red-400">{item.old_goal}回</span>
                    {' '}→{' '}
                    <span className="font-bold text-green-400">{item.new_goal}回</span>
                    {' '}に変更しました
                  </p>
                  <p className="text-xs text-gym-muted mt-0.5">{timeAgo(item.created_at)}</p>
                </div>
              </div>
            )
          }

          // 通常の投稿
          return (
            <div key={item.id} className="card mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gym-orange/20 border border-gym-orange/30 flex items-center justify-center font-black text-gym-orange text-sm">
                    {(item.profiles?.display_name || '?')[0]}
                  </div>
                  <div>
                    <p className="font-black text-sm">{item.profiles?.display_name}</p>
                    <p className="text-gym-muted text-xs">{timeAgo(item.created_at)}</p>
                  </div>
                </div>
                {item.status === 'approved' && (
                  <span className="bg-green-900/40 border border-green-500/40 text-green-400 text-xs font-bold px-3 py-1 rounded-full">✓ 承認済み</span>
                )}
                {item.status === 'rejected' && (
                  <span className="bg-red-900/40 border border-red-500/40 text-red-400 text-xs font-bold px-3 py-1 rounded-full">✗ 却下</span>
                )}
                {item.status === 'pending' && (
                  <span className="bg-gym-orange/10 border border-gym-orange/30 text-gym-orange text-xs font-bold px-3 py-1 rounded-full">審査中</span>
                )}
              </div>

              <div className="inline-flex items-center gap-1 bg-gym-orange/10 border border-gym-orange/30 rounded-lg px-3 py-1 text-xs text-gym-orange font-bold mb-3">
                🎯 お題：{item.theme}
              </div>

              <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-3 bg-gym-surface">
                <Image src={item.photo_url} alt="gym photo" fill className="object-cover" />
              </div>

              {item.caption && (
                <p className="text-sm text-gym-muted mb-3">{item.caption}</p>
              )}

              {/* スタンプ */}
              <div className="flex flex-wrap gap-2 mb-3">
                {STAMP_EMOJIS.map(emoji => {
                  const count = stamps[item.id]?.[emoji]?.length || 0
                  const stamped = stamps[item.id]?.[emoji]?.includes(userId)
                  return (
                    <button
                      key={emoji}
                      onClick={() => toggleStamp(item.id, emoji)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                        stamped
                          ? 'bg-gym-orange text-black'
                          : 'bg-gym-surface border border-gym-border text-gym-muted'
                      }`}
                    >
                      {emoji} {count > 0 && <span>{count}</span>}
                    </button>
                  )
                })}
              </div>

              {/* 投票 */}
              <div className="flex gap-3 mb-2 text-xs text-gym-muted">
                <span>👍 {item.approved_count}票</span>
                <span>👎 {item.rejected_count}票</span>
                <span>（{memberCount <= 2 ? 1 : Math.floor(memberCount / 2) + 1}票で確定）</span>
              </div>

              {item.user_id !== userId && !myVotes[item.id] && item.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => vote(item.id, 'approve')} className="flex-1 py-2.5 rounded-xl border border-green-500/50 bg-green-900/20 text-green-400 font-bold text-sm active:opacity-70">
                    👍 承認
                  </button>
                  <button onClick={() => vote(item.id, 'reject')} className="flex-1 py-2.5 rounded-xl border border-red-500/50 bg-red-900/20 text-red-400 font-bold text-sm active:opacity-70">
                    👎 却下
                  </button>
                </div>
              )}
              {myVotes[item.id] && (
                <p className="text-xs text-gym-muted text-center">「{myVotes[item.id] === 'approve' ? '承認' : '却下'}」に投票済み</p>
              )}
              {item.user_id === userId && (
                <p className="text-xs text-gym-muted text-center">自分の投稿</p>
              )}
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
