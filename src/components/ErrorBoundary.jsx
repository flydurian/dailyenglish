import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        
        // 에러 로깅 (실제 프로덕션에서는 에러 추적 서비스 사용)
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--paper)', color: 'var(--ink)' }}>
                    <div style={{ background: 'var(--card-paper)', border: '1px solid var(--line)', borderRadius: '20px', boxShadow: '0 16px 30px rgba(63, 46, 22, 0.07)', padding: '24px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
                        <div style={{ color: 'var(--coral)', marginBottom: '16px' }}>
                            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 650, letterSpacing: '-0.02em' }}>
                            문제가 발생했습니다
                        </h2>
                        <p style={{ margin: '0 0 18px', color: 'var(--muted)', fontSize: '12.5px', lineHeight: 1.7 }}>
                            애플리케이션에서 예상치 못한 오류가 발생했습니다. 
                            페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.
                        </p>
                        <div className="space-y-2">
                            <button
                                onClick={() => window.location.reload()}
                                style={{ width: '100%', padding: '12px 16px', border: 0, borderRadius: '999px', background: 'var(--ink)', color: 'var(--paper)', fontSize: '13px', fontWeight: 650, cursor: 'pointer' }}
                            >
                                페이지 새로고침
                            </button>
                            <button
                                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                                style={{ width: '100%', marginTop: '8px', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '999px', background: 'transparent', color: 'var(--ink)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                다시 시도
                            </button>
                        </div>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-4 text-left">
                                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                                    개발자 정보 (클릭하여 확장)
                                </summary>
                                <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto">
                                    <div className="mb-2">
                                        <strong>Error:</strong> {this.state.error.toString()}
                                    </div>
                                    <div>
                                        <strong>Stack:</strong>
                                        <pre className="whitespace-pre-wrap">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </div>
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
