import React from 'react'

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
  text?: string
}

export function Spinner({ size = 'medium', color = '#e94560', text }: SpinnerProps) {
  const sizes: Record<string, number> = {
    small: 16,
    medium: 24,
    large: 40,
  }

  const borderWidth: Record<string, number> = {
    small: 2,
    medium: 3,
    large: 4,
  }

  const spinnerSize = sizes[size]
  const border = borderWidth[size]

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.spinner,
          width: spinnerSize,
          height: spinnerSize,
          border: `${border}px solid ${color}33`,
          borderTopColor: color,
        }}
      />
      {text && <span style={{ ...styles.text, color }}>{text}</span>}
    </div>
  )
}

// Full-screen loading overlay
export function LoadingOverlay({ text = 'Loading...' }: { text?: string }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <Spinner size="large" />
        <p style={{ color: '#888', marginTop: 16, fontSize: 14 }}>{text}</p>
      </div>
    </div>
  )
}

// Inline loading indicator for buttons
export function ButtonSpinner() {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        border: '2px solid rgba(255, 255, 255, 0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  spinner: {
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  text: {
    fontSize: 13,
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 15, 15, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9998,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
}

// Add spin animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  if (!document.getElementById('spinner-styles')) {
    style.id = 'spinner-styles'
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(style)
  }
}
