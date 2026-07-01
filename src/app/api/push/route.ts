// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { groupId, title, body, senderId } = await req.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // グループの全メンバーの通知登録情報を取得（送信者以外）
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription, user_id')
      .eq('group_id', groupId)
      .neq('user_id', senderId)

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscribers', sent: 0 })
    }

    const webpush = await import('web-push')
    webpush.default.setVapidDetails(
      process.env.VAPID_EMAIL!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )

    const payload = JSON.stringify({ title, body, url: '/dashboard' })

    let sent = 0
    for (const sub of subscriptions) {
      try {
        await webpush.default.sendNotification(sub.subscription, payload)
        sent++
      } catch (err) {
        // 無効なトークンは削除
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', sub.user_id)
          .eq('group_id', groupId)
      }
    }

    return NextResponse.json({ success: true, sent })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
