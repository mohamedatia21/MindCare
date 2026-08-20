import React, { Component, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center',
          background: 'var(--mc-bg, #0a0e1a)',
          color: 'var(--mc-text, #e8ecf4)',
          fontFamily: 'var(--font-body, system-ui)',
          gap: '16px'
        }}>
          <h2 style={{ fontFamily: 'var(--font-display, system-ui)', fontSize: '1.5rem', fontWeight: 600 }}>
            Something went wrong.
          </h2>
          <p style={{ color: 'var(--mc-text-secondary, #8892a8)', fontSize: '0.9375rem' }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mc-btn mc-btn-primary"
            style={{ marginTop: '8px' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
