import React from 'react'

interface PreviewErrorBoundaryProps {
  children: React.ReactNode
}

interface PreviewErrorBoundaryState {
  error: Error | null
}

export class PreviewErrorBoundary extends React.Component<PreviewErrorBoundaryProps, PreviewErrorBoundaryState> {
  state: PreviewErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Preview panel render error:', error)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#101010',
          borderLeft: '1px solid #232323',
          borderRight: '1px solid #232323',
        }}
      >
        <div
          style={{
            width: 'min(90%, 460px)',
            borderRadius: 10,
            border: '1px solid rgba(233,69,96,0.4)',
            background: 'rgba(20,20,20,0.95)',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: '#f87171', fontFamily: 'monospace' }}>
            PREVIEW ERROR
          </div>
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700, color: '#f3f4f6' }}>
            Unable to load the preview panel
          </div>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: '#b6b6b6' }}>
            {this.state.error.message || 'Unexpected preview failure.'}
          </div>
        </div>
      </div>
    )
  }
}
