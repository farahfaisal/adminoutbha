import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  Activity,
  Lock,
  Eye,
  Clock,
  Users,
  XCircle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getSecurityStats,
  getRecentLoginAttempts,
  getActiveSessions,
  getAuditLogs,
  detectSuspiciousActivity,
  cleanupOldSecurityLogs,
  endSession
} from '../../lib/securityApi';

export default function SecurityDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [loginAttempts, setLoginAttempts] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [suspiciousActivity, setSuspiciousActivity] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadSecurityData();
    const interval = setInterval(loadSecurityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      const [
        statsData,
        attemptsData,
        sessionsData,
        logsData,
        suspiciousData
      ] = await Promise.all([
        getSecurityStats(),
        getRecentLoginAttempts(50),
        getActiveSessions(),
        getAuditLogs({ limit: 100 }),
        detectSuspiciousActivity()
      ]);

      setStats(statsData);
      setLoginAttempts(attemptsData);
      setActiveSessions(sessionsData);
      setAuditLogs(logsData);
      setSuspiciousActivity(suspiciousData);
    } catch (error) {
      console.error('Error loading security data:', error);
      toast.error('فشل تحميل بيانات الأمان');
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async (sessionId) => {
    try {
      const session = activeSessions.find(s => s.id === sessionId);
      if (!session) return;

      await endSession(session.session_token);
      toast.success('تم إنهاء الجلسة بنجاح');
      loadSecurityData();
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('فشل إنهاء الجلسة');
    }
  };

  const handleCleanup = async () => {
    try {
      const success = await cleanupOldSecurityLogs();
      if (success) {
        toast.success('تم تنظيف السجلات القديمة بنجاح');
        loadSecurityData();
      } else {
        toast.error('فشل تنظيف السجلات');
      }
    } catch (error) {
      console.error('Error cleaning up logs:', error);
      toast.error('فشل تنظيف السجلات');
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {suspiciousActivity?.hasIssues && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 mt-1" />
            <div>
              <h3 className="font-semibold text-red-800 mb-2">تنبيه أمني</h3>
              <p className="text-red-700 text-sm">
                تم رصد نشاطات مشبوهة. يرجى مراجعة السجلات فوراً.
              </p>
              {suspiciousActivity.failedAttempts?.length > 0 && (
                <p className="text-red-600 text-sm mt-2">
                  {suspiciousActivity.failedAttempts.length} محاولة دخول فاشلة في الساعة الأخيرة
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm">محاولات الدخول</h3>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {stats?.totalLoginAttempts || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">إجمالي المحاولات</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm">محاولات فاشلة</h3>
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {stats?.failedAttempts24h || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">آخر 24 ساعة</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm">جلسات نشطة</h3>
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {stats?.activeSessions || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">حالياً</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm">أحداث حرجة</h3>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {stats?.criticalEvents7d || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">آخر 7 أيام</p>
        </div>
      </div>
    </div>
  );

  const renderLoginAttempts = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Lock className="w-5 h-5" />
          محاولات تسجيل الدخول
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                اسم المستخدم
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                عنوان IP
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الحالة
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الوقت
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الرسالة
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loginAttempts.map((attempt) => (
              <tr key={attempt.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {attempt.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {attempt.ip_address || 'غير معروف'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {attempt.success ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3" />
                      نجح
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <XCircle className="w-3 h-3" />
                      فشل
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(attempt.attempted_at).toLocaleString('ar-EG')}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {attempt.error_message || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderActiveSessions = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          الجلسات النشطة
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                معرف المستخدم
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                عنوان IP
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                بدأت في
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                آخر نشاط
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                تنتهي في
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                إجراءات
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activeSessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                  {session.user_id.substring(0, 8)}...
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {session.ip_address || 'غير معروف'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(session.created_at).toLocaleString('ar-EG')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(session.last_activity).toLocaleString('ar-EG')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(session.expires_at).toLocaleString('ar-EG')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleEndSession(session.id)}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    إنهاء
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAuditLogs = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Eye className="w-5 h-5" />
          سجل التدقيق
        </h2>
        <button
          onClick={handleCleanup}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          تنظيف السجلات القديمة
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الإجراء
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الجدول
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الخطورة
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                عنوان IP
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الوقت
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.action}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.table_name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      log.severity === 'critical'
                        ? 'bg-red-100 text-red-800'
                        : log.severity === 'warning'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {log.severity}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.ip_address || 'غير معروف'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(log.created_at).toLocaleString('ar-EG')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          لوحة تحكم الأمان
        </h1>
        <button
          onClick={loadSecurityData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          تحديث
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              نظرة عامة
            </button>
            <button
              onClick={() => setActiveTab('attempts')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'attempts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              محاولات الدخول
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'sessions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              الجلسات النشطة
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'audit'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              سجل التدقيق
            </button>
          </nav>
        </div>
        <div className="p-6">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'attempts' && renderLoginAttempts()}
          {activeTab === 'sessions' && renderActiveSessions()}
          {activeTab === 'audit' && renderAuditLogs()}
        </div>
      </div>
    </div>
  );
}
