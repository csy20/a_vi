import { useEffect, useState } from 'react'
import { toast, useToastStore } from '../lib/toastStore'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const removeToast = useToastStore((state) => state.removeToast)

  useEffect(() => {
    let offlineToastId: string | null = null

    const handleOnline = () => {
      setIsOnline(true)
      if (offlineToastId) {
        removeToast(offlineToastId)
        offlineToastId = null
      }
      toast.success('Back online! Syncing changes...')

      // Trigger auto-save flush via a custom event that useProjectManager listens to
      window.dispatchEvent(new Event('avi:reconnect'))
    }

    const handleOffline = () => {
      setIsOnline(false)
      offlineToastId = 'offline-warning'
      toast.warning('You are offline. Changes will be saved when you reconnect.', 0)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (offlineToastId) {
        removeToast(offlineToastId)
      }
    }
  }, [removeToast])

  return isOnline
}
