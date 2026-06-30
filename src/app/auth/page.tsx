'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          username: email.split('@')[0] + '_' + Math.floor(Math.random() * 1000),
          display_name: name || email.split('@')[0],
        })
        setMessage('確認メールを送りました！メールを確認してからログインしてください。')
      }
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) { setError('メールアドレスかパスワードが違います'); setLoading(false); return }
      router.replace('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black tracking-tight">
            GYM<span className="text-gym-orange">WATCH</span>
          </h1>
          <p className="text-gym-muted text-sm mt-2 tracking-widest uppercase">
            サボりを許さないアプリ
          </p>
        </div>

        {/* Tab */}
        <div className="flex bg-gym-surface rounded-2xl p-1 mb-6 border border-gym-border">
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setMessage('') }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mode === m
                  ? 'bg-gym-orange text-black'
                  : 'text-gym-muted'
              }`}
            >
              {m === 'login' ? 'ログイン' : '新規登録'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="card">
          {mode === 'signup' && (
            <>
              <label className="input-label">ニックネーム</label>
              <input
                className="input-field"
                placeholder="田中 剛志"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </>
          )}
          <label className="input-label">メールアドレス</label>
          <input
            className="input-field"
            type="email"
            placeholder="gym@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <label className="input-label">パスワード</label>
          <input
            className="input-field"
            type="password"
            placeholder="6文字以上"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {error && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-3 mb-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-3 mb-3 text-green-400 text-sm">
              {message}
            </div>
          )}

          <button
            className="btn-orange mt-2"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン 💪' : 'アカウント作成 🔥'}
          </button>
        </div>
      </div>
    </div>
  )
}
