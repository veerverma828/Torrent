import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Application crash captured:", error, info);
  }

  reloadApp = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg-base p-6 text-white font-sans">
          <div className="max-w-lg rounded-2xl bg-bg-surface p-8 text-center">
            <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
            <p className="mb-6 text-text-secondary">
              The app encountered an unexpected error.
            </p>
            <button
              onClick={this.reloadApp}
              className="rounded-lg bg-white px-5 py-2 font-semibold text-black"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
