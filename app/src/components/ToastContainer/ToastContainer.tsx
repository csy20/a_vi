import React from 'react'
import { useToastStore, Toast } from '../../lib/toastStore'

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)
  const removeToast = useToastStore((state) => state.removeToast)

  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const icons: Record<Toast['type'], string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }

  const colors: Record<Toast['type'], { bg: string; border: string; icon: string }> = {
    success: { bg: '#1a2a1a', border: '#059669', icon: '#059669' },
    error: { bg: '#2a1a1a', border: '#e94560', icon: '#e94560' },
    info: { bg: '#1a1a2a', border: '#3b82f6', icon: '#3b82f6' },
    warning: { bg: '#2a2a1a', border: '#f59e0b', icon: '#f59e0b' },
  }

  const color = colors[toast.type]

  return (
    <div
      style={{
        ...styles.toast,
        background: color.bg,
        borderColor: color.border,
      }}
    >
      <span style={{ ...styles.icon, color: color.icon }}>{icons[toast.type]}</span>
      <span style={styles.message}>{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} style={styles.closeButton}>
        ×
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 20,
    right: 20,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 400,
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    border: '1px solid',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    animation: 'slideIn 0.3s ease-out',
  },
  icon: {
    fontSize: 18,
    fontWeight: 700,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: 20,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
}

// Add animation keyframes to global CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `
  document.head.appendChild(style)
}
