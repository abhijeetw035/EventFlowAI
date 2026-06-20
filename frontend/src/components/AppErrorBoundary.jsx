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
      <main className="flex min-h-screen items-center justify-center bg-console-bg p-6 text-console-text">
        <section className="max-w-lg border border-red-500/50 bg-red-500/10 p-5">
          <h1 className="text-lg font-semibold">The console hit a display error</h1>
          <p className="mt-2 text-sm text-red-100">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-4 bg-sky-500 px-3 py-2 text-sm font-bold text-slate-950"
            onClick={() => window.location.reload()}
          >
            Reload console
          </button>
        </section>
      </main>
    );
  }
}
