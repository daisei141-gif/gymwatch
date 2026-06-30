// @ts-nocheck
'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

const THEMES = [
  'ベンチプレス', 'ダンベル', 'ラットプルダウン',
  'スクワットラック', 'ケーブルマシン', 'レッグプレス',
  'トレッドミル', 'バーベル', 'ショルダープレス', 'チェストフライ'
]

export default function PostPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [theme, setTheme] = useState(() => THEMES[Math.floor(Math.random() * THEMES.length)])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function rerollTheme() {
    let next = theme
    while (next === theme) next = THEMES[Math.floor(Math.random() * THEMES.length)]
    setTheme(next)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handlePost() {
    if (!file) { setError('写真を選択してください'); return }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }

    // Get user's group
    const { data: member } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single()

    if (!member) { setError('先にグループに参加してください'); setLoading(false); return }

    // Upload photo
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('gym-photos').upload(path, file)
    if (uploadErr) { setError('写真のアップロードに失敗しました'); setLoading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('gym-photos').getPublicUrl(path)

    // Create post
    const { error: postErr } = await supabase.from('posts').insert({
      user_id: user.id,
      group_id: member.group_id,
      photo_url: publicUrl,
      theme,
      caption,
    })

    if (postErr) { setError('投稿に失敗しました'); setLoading(false); return }
    router.replace('/feed')
  }

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="text-gym-muted text-2xl">←</button>
        <h2 className="section-title mb-0">ジム行ってきた！</h2>
      </div>

      <div className="px-4">
        {/* Theme */}
        <div className="bg-[#1a0800] border border-gym-orange/30 rounded-2xl p-4 mb-4">
          <p className="card-title">🎯 今日のお題</p>
          <p className="text-4xl font-black text-gym-orange mb-1">{theme}</p>
          <p className="text-gym-muted text-xs mb-3">この器具が写った写真を投稿してください</p>
          <button
            onClick={rerollTheme}
            className="border border-gym-border rounded-xl px-4 py-2 text-gym-muted text-xs"
          >
            🔀 別のお題にする
          </button>
        </div>

        {/* Photo upload */}
        <div
          onClick={() => fileRef.current?.click()}
          className={`w-full aspect-video rounded-2xl flex flex-col items-center justify-center gap-2
                      border-2 border-dashed cursor-pointer transition-colors mb-4
                      ${preview ? 'border-gym-orange' : 'border-gym-border'}`}
          style={preview ? { backgroundImage: `url(${preview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          {!preview && (
            <>
              <span className="text-5xl">📷</span>
              <p className="text-gym-muted text-sm">タップして写真を選択</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

        {/* Caption */}
        <label className="input-label">一言コメント（任意）</label>
        <textarea
          className="input-field resize-none h-20"
          placeholder="今日もベンチプレス100kg達成💪"
          value={caption}
          onChange={e => setCaption(e.target.value)}
        />

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-3 mb-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button className="btn-orange" onClick={handlePost} disabled={loading}>
          {loading ? '投稿中...' : '📤　投稿する'}
        </button>
        <button className="btn-ghost mt-2" onClick={() => router.back()}>キャンセル</button>
      </div>

      <BottomNav />
    </div>
  )
}
