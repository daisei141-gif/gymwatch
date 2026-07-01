// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'

export function usePushNotification() {
  const [permission, setPermission] = useState('default')
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setSupported(true)
      setPermission(Notification.permission)
      // Register service worker
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  async function requestPermission() {
    if (!supported) return false
    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
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

  return { permission, supported, requestPermission, sendLocalNotification }
}
