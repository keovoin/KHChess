import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort boundary around the whole app.
 * Without it, any render-time throw (e.g. a missing env var on a Vercel build)
 * leaves the user with a blank black screen and no way to know what happened.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('RootErrorBoundary caught:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#0f0d0a',
            color: '#f5f0e8',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, marginBottom: 12 }}>
              Something went wrong
            </h1>
            <p style={{ opacity: 0.75, marginBottom: 20, fontSize: 14 }}>
              The app hit an unexpected error while starting. If you control
              this deployment, check the browser console and the project
              environment variables (Supabase, API, socket).
            </p>
            <details style={{ textAlign: 'left', opacity: 0.7, fontSize: 12 }}>
              <summary>Technical details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>
                {String(this.state.error)}
                {'\n'}
                {this.state.error.stack ?? ''}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 20,
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.08)',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
