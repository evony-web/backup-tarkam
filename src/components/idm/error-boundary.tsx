'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Lightweight ErrorBoundary that catches runtime errors in child components
 * and displays a helpful error message instead of blank content.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5 text-center space-y-3">
          <div className="text-red-400 text-sm font-semibold">Component Error</div>
          <p className="text-xs text-muted-foreground">
            {this.state.error?.message || 'Terjadi kesalahan saat memuat komponen'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-idm-gold-warm/15 text-idm-gold-warm hover:bg-idm-gold-warm/25 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
