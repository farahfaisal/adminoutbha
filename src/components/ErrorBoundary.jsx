import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    try {
      const errorLog = {
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      console.error('Error details:', errorLog);
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  handleReload = () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }
    window.location.href = '/';
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 px-4">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
              عذراً، حدث خطأ غير متوقع
            </h1>

            <p className="text-gray-600 text-center mb-8">
              نعتذر عن الإزعاج. يمكنك المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <button
                onClick={this.handleRefresh}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                إعادة المحاولة
              </button>

              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Home className="w-5 h-5" />
                العودة للرئيسية
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  تفاصيل الخطأ (Development Mode):
                </h2>
                <pre className="text-xs text-gray-700 overflow-auto max-h-40 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                نصائح لحل المشكلة:
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• تأكد من اتصالك بالإنترنت</li>
                <li>• حاول مسح ذاكرة التخزين المؤقت (Cache)</li>
                <li>• تأكد من استخدام متصفح حديث</li>
                <li>• إذا استمرت المشكلة، اتصل بالدعم الفني</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
