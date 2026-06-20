import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-8 text-on-surface">
        <section className="card-organic max-w-lg overflow-hidden p-0">
          <div className="h-1.5 bg-gradient-to-r from-error to-error-container"></div>
          <div className="p-8">
            <h1 className="font-display text-2xl font-bold text-on-surface">Console Display Error</h1>
            <p className="mt-2 text-sm text-on-surface-var">An unexpected error occurred in the interface.</p>
            <p className="mt-5 card-nested rounded-xl px-4 py-3.5 text-sm text-error-on-cont">
              {this.state.error.message}
            </p>
            <button
              type="button"
              className="btn-press mt-6 w-full rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-on-primary shadow-ambient transition-all hover:shadow-ambient-lg"
              onClick={() => window.location.reload()}
            >
              Reload Console
            </button>
          </div>
        </section>
      </main>
    );
  }
}
