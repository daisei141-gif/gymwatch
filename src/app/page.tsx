'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
      else router.replace('/auth')
    })
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gym-orange text-4xl font-black tracking-tight animate-pulse">
        GYM<span className="text-white">WATCH</span>
      </div>
    </div>
  )
}
