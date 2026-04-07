"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-full flex flex-col items-center justify-center p-4 font-dashboard">
          <div className="text-sm text-status-critical mb-2">Panel Error</div>
          <div className="text-xs text-text-tertiary text-center max-w-xs">
            {this.state.error?.message ?? 'Something went wrong'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 text-xs text-text-secondary hover:text-text-primary underline"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
