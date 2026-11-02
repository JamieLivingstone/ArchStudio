import { Component, type ReactNode } from "react";
import { reason } from "./errorReason";
import { saveDiagram } from "./files/saveDiagram";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error?: unknown;
  saveError: string;
}

const button = "rounded-lg px-3 py-1.5 text-xs font-medium";

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { saveError: "" };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  // The diagram lives outside React, so it is still there to save after the app has failed.
  saveCopy = () => {
    this.setState({ saveError: "" });
    saveDiagram({ as: true }).catch((cause: unknown) => this.setState({ saveError: reason(cause) }));
  };

  render() {
    const { error, saveError } = this.state;
    if (error === undefined) return this.props.children;
    return (
      <main role="alert" className="flex h-full items-center justify-center bg-canvas p-4 text-fg">
        <div className="w-96 max-w-full">
          <h1 className="text-base font-medium">Something went wrong</h1>
          <p className="mt-1 text-muted">
            ArchStudio hit a problem it could not recover from. Save a copy of your diagram, then reload.
          </p>
          <p className="mt-2 font-mono text-xs break-words text-muted">{reason(error)}</p>
          {saveError && <p className="mt-2 text-xs text-red-500">Could not save. {saveError}</p>}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={this.saveCopy}
              className={`${button} bg-accent text-surface hover:opacity-90`}
            >
              Save a copy
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`${button} text-muted hover:bg-hover hover:text-fg`}
            >
              Reload
            </button>
          </div>
        </div>
      </main>
    );
  }
}
