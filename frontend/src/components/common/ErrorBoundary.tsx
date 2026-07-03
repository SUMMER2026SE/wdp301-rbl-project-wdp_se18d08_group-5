import React from 'react';
import i18n from 'i18next';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Catches render-time exceptions (invalid hooks, undefined access, etc.) so
 * the page doesn't go blank when a child component throws. Without this,
 * any thrown render error unmounts the entire tree under <App /> and the
 * user sees a black screen with no diagnostic.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught render error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: '#0a0a0f',
            color: '#fff',
            fontFamily: 'Rajdhani, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 480,
              padding: '1.5rem',
              border: '1px solid rgba(255,0,110,0.4)',
              borderRadius: 12,
              background: 'rgba(20,10,20,0.6)',
              textAlign: 'center',
            }}
          >
            <h2 style={{ color: '#ff006e', marginBottom: '0.5rem' }}>{i18n.t('common:components.errorBoundary.somethingWrong')}</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
              A render-time error stopped this page from loading. The details
              below are also in your browser console (F12 → Console).
            </p>
            <pre
              style={{
                textAlign: 'left',
                background: 'rgba(0,0,0,0.4)',
                padding: '0.75rem',
                borderRadius: 6,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#ffd60a',
                maxHeight: 160,
                overflow: 'auto',
              }}
            >
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={this.handleReset}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1.25rem',
                background: '#00f5ff',
                color: '#0a0a0f',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}