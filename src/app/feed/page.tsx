// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

export default function FeedPage() {
  const router = useRouter()
  const supabase = createClient()
  const [posts, setPosts] = useState<any[]>([])
  const [userId, setUserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [memberCount, setMemberCount] = useState(2)
  const [loading, setLoading] = useState(true)
  const [myVotes, setMyVotes] = useState<Record<string, string>>({})

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

    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles(display_name)')
      .eq('group_id', member.group_id)
      .order('created_at', { ascending: false })
      .limit(30)

    setPosts(postsData || [])

    const { data: votesData } = await supabase
      .from('votes')
      .select('post_id, vote_type')
      .eq('user_id', user.id)

    const vmap: Record<string, string> = {}
    votesData?.forEach(v => { vmap[v.post_id] = v.vote_type })
    setMyVotes(vmap)
    setLoading(false)
  }

  async function vote(postId: string, type: 'approve' | 'reject') {
    if (myVotes[postId]) return
    setMyVotes(prev => ({ ...prev, [postId]: type }))

    await supabase.from('votes').insert({ post_id: postId, user_id: userId, vote_type: type })

    // Update count on post
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const newApproved = post.approved_count + (type === 'approve' ? 1 : 0)
    const newRejected = post.rejected_count + (type === 'reject' ? 1 : 0)
    const majority = Math.floor(memberCount / 2) + 1
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

  function timeAgo(date: string) {
    const diff = (Date.now() - new Date(date).getTime()) / 1000
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`
    return `${Math.floor(diff / 86400)}日前`
  }

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
        {posts.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-black text-lg mb-1">まだ投稿がありません</p>
            <p className="text-gym-muted text-sm">最初の投稿をしよう！</p>
          </div>
        )}

        {posts.map(post => (
          <div key={post.id} className="card mb-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gym-orange/20 border border-gym-orange/30
                                flex items-center justify-center font-black text-gym-orange text-sm">
                  {(post.profiles?.display_name || '?')[0]}
                </div>
                <div>
                  <p className="font-black text-sm">{post.profiles?.display_name}</p>
                  <p className="text-gym-muted text-xs">{timeAgo(post.created_at)}</p>
                </div>
              </div>
              {/* Status badge */}
              {post.status === 'approved' && (
                <span className="bg-green-900/40 border border-green-500/40 text-green-400 text-xs font-bold px-3 py-1 rounded-full">
                  ✓ 承認済み
                </span>
              )}
              {post.status === 'rejected' && (
                <span className="bg-red-900/40 border border-red-500/40 text-red-400 text-xs font-bold px-3 py-1 rounded-full">
                  ✗ 却下
                </span>
              )}
              {post.status === 'pending' && (
                <span className="bg-gym-orange/10 border border-gym-orange/30 text-gym-orange text-xs font-bold px-3 py-1 rounded-full">
                  審査中
                </span>
              )}
            </div>

            {/* Theme badge */}
            <div className="inline-flex items-center gap-1 bg-gym-orange/10 border border-gym-orange/30
                            rounded-lg px-3 py-1 text-xs text-gym-orange font-bold mb-3">
              🎯 お題：{post.theme}
            </div>

            {/* Photo */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-3 bg-gym-surface">
              <Image src={post.photo_url} alt="gym photo" fill className="object-cover" />
            </div>

            {post.caption && (
              <p className="text-sm text-gym-muted mb-3">{post.caption}</p>
            )}

            {/* Vote counts */}
            <div className="flex gap-3 mb-3 text-xs text-gym-muted">
              <span>👍 {post.approved_count}票</span>
              <span>👎 {post.rejected_count}票</span>
              <span>（過半数 {Math.floor(memberCount / 2) + 1}票で確定）</span>
            </div>

            {/* Vote buttons */}
            {post.user_id !== userId && !myVotes[post.id] && post.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => vote(post.id, 'approve')}
                  className="flex-1 py-2.5 rounded-xl border border-green-500/50 bg-green-900/20
                             text-green-400 font-bold text-sm active:opacity-70"
                >
                  👍 承認
                </button>
                <button
                  onClick={() => vote(post.id, 'reject')}
                  className="flex-1 py-2.5 rounded-xl border border-red-500/50 bg-red-900/20
                             text-red-400 font-bold text-sm active:opacity-70"
                >
                  👎 却下
                </button>
              </div>
            )}
            {myVotes[post.id] && (
              <p className="text-xs text-gym-muted text-center">
                あなたは「{myVotes[post.id] === 'approve' ? '承認' : '却下'}」に投票しました
              </p>
            )}
            {post.user_id === userId && (
              <p className="text-xs text-gym-muted text-center">自分の投稿</p>
            )}
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
