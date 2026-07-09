import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ui boundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-red-200">
          <div>
            <h1 className="text-lg font-bold">页面加载出错</h1>
            <p className="mt-2 text-sm text-red-200/70">请刷新后重试。</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
