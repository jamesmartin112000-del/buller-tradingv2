import React, { Component } from 'react';
import { AlertOctagonIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { auditLog } from '../../lib/security/auditLog';
/**
 * ErrorBoundary — top-level React error boundary. Catches uncaught render
 * errors, logs them to the audit trail, and shows a recoverable fallback
 * UI that matches the app's dark theme.
 *
 * Wrap <App /> at the very top of the tree (index.tsx).
 */
interface State {
  error: Error | null;
  componentStack: string | null;
}
interface Props {
  children: React.ReactNode;
}
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    componentStack: null
  };
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      error
    };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({
      componentStack: info.componentStack || null
    });
    // Fire-and-forget audit write
    void auditLog('error', 'client-error', error.message || 'Render error', {
      name: error.name,
      stack: error.stack?.slice(0, 4000),
      componentStack: info.componentStack?.slice(0, 4000)
    });
  }
  handleReload = () => {
    try {
      window.location.reload();
    } catch {

      // ignore
    }};
  handleReset = () => {
    this.setState({
      error: null,
      componentStack: null
    });
  };
  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen w-full bg-bg-900 flex items-center justify-center p-6">
        <div className="bg-bg-700 border border-line rounded-xl p-8 max-w-lg w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-sell/15 border border-sell/40 flex items-center justify-center shrink-0">
              <AlertOctagonIcon className="w-5 h-5 text-sell" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">
                Something went wrong
              </h2>
              <p className="text-2xs text-ink-muted uppercase tracking-[0.18em] font-bold mt-0.5">
                Unexpected client error
              </p>
            </div>
          </div>

          <p className="text-sm text-ink-muted mb-3 leading-relaxed">
            The app hit an error it couldn't recover from. The issue has been
            logged. Try reloading — if it keeps happening, contact support.
          </p>

          <div className="bg-bg-900 border border-line rounded-md p-3 mb-4 font-mono text-2xs text-ink-muted whitespace-pre-wrap break-words max-h-40 overflow-auto">
            {error.message || 'Unknown error'}
            {componentStack ?
            <div className="mt-2 pt-2 border-t border-line text-ink-dim">
                {componentStack.trim().split('\n').slice(0, 6).join('\n')}
              </div> :
            null}
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={this.handleReload}
              icon={<RefreshCwIcon className="w-4 h-4" />}>
              
              Reload
            </Button>
            <Button variant="secondary" onClick={this.handleReset}>
              Try again
            </Button>
          </div>
        </div>
      </div>);

  }
}