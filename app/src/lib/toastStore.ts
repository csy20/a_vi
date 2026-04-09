import { create } from 'zustand'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: ({ type, message, duration = 4000 }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(7)}`
    set((state) => ({ toasts: [...state.toasts, { id, type, message, duration }] }))

    // Auto-remove after duration
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, duration)
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

// Convenience functions
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'success', message, duration }),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'error', message, duration }),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'info', message, duration }),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'warning', message, duration }),
}
