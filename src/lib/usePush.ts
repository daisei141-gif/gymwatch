// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'

const VAPID_PUBLIC_KEY = 'BKbU7EY5Delp0ybLEgWaUFSbzLooqzOZG02Au2N4vrpfvgcDganEkewhK-1qt2tkhWJqqAPn_r5OZ1p3fhf-Px0'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotification() {
  const [permission, setPermission] = useState('default')
  const [supported, setSupported] = useState(false)
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true)
      setPermission(Notification.permission)
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  async function subscribe() {
    if (!supported) return null
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') return null

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    setSubscription(sub)
    return sub
  }

  function sendLocalNotification(title: string, body: string) {
    if (permission !== 'granted') return
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        vibrate: [200, 100, 200],
      })
    })
  }

  return { permission, supported, subscription, subscribe, sendLocalNotification }
}
