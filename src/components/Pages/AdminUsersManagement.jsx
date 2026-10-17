import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Users,
  Key,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Shield
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import {
  listAdminUsers,
  createAdminUser,
  updateAdminPassword,
  toggleAdminUserStatus,
  deleteAdminUser,
  generateSecurePassword,
  checkPasswordStrengthLocal
} from '../../lib/adminUsersApi';

export default function AdminUsersManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // بيانات النموذج
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: ''
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (formData.password) {
      const strength = checkPasswordStrengthLocal(formData.password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await listAdminUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('فشل تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.password || !formData.fullName) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const result = await createAdminUser({
        username: formData.username,
        password: formData.password,
        fullName: formData.fullName,
        email: formData.email,
        createdBy: currentUser?.id
      });

      if (result.success) {
        toast.success('تم إنشاء المستخدم بنجاح');
        setShowCreateModal(false);
        setFormData({ username: '', password: '', fullName: '', email: '' });
        loadUsers();
      } else {
        toast.error(result.error || 'فشل إنشاء المستخدم');
        if (result.validation?.errors) {
          result.validation.errors.forEach(err => toast.warning(err));
        }
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('فشل إنشاء المستخدم');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('كلمة المرور الجديدة غير متطابقة');
      return;
    }

    try {
      const result = await updateAdminPassword(
        selectedUser.username,
        passwordData.oldPassword,
        passwordData.newPassword
      );

      if (result.success) {
        toast.success('تم تحديث كلمة المرور بنجاح');
        setShowPasswordModal(false);
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setSelectedUser(null);
      } else {
        toast.error(result.error || 'فشل تحديث كلمة المرور');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('فشل تحديث كلمة المرور');
    }
  };

  const handleToggleStatus = async (username, currentStatus) => {
    try {
      const result = await toggleAdminUserStatus(
        username,
        !currentStatus,
        currentUser?.id
      );

      if (result.success) {
        toast.success(result.message);
        loadUsers();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('فشل تحديث حالة المستخدم');
    }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟`)) {
      return;
    }

    try {
      const result = await deleteAdminUser(username, currentUser?.id);

      if (result.success) {
        toast.success('تم حذف المستخدم بنجاح');
        loadUsers();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('فشل حذف المستخدم');
    }
  };

  const handleGeneratePassword = () => {
    const password = generateSecurePassword();
    setFormData({ ...formData, password });
    toast.info('تم إنشاء كلمة مرور آمنة');
  };

  const getPasswordStrengthColor = (strength) => {
    switch (strength) {
      case 'ضعيفة': return 'bg-red-500';
      case 'متوسطة': return 'bg-orange-500';
      case 'قوية': return 'bg-yellow-500';
      case 'قوية جداً': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

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
          <Users className="w-8 h-8 text-blue-600" />
          إدارة مستخدمي لوحة التحكم
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          إضافة مستخدم جديد
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  اسم المستخدم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  الاسم الكامل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  البريد الإلكتروني
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  آخر دخول
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-gray-900">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {user.full_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {user.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        نشط
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        معطل
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleString('ar-EG')
                      : 'لم يسجل دخول بعد'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2 space-x-reverse">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowPasswordModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                      title="تغيير كلمة المرور"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user.username, user.is_active)}
                      className={user.is_active ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}
                      title={user.is_active ? 'تعطيل' : 'تفعيل'}
                    >
                      {user.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.username)}
                      className="text-red-600 hover:text-red-800"
                      title="حذف"
                      disabled={users.filter(u => u.is_active).length <= 1 && user.is_active}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <UserPlus className="w-6 h-6" />
              إضافة مستخدم جديد
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اسم المستخدم *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  كلمة المرور *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  إنشاء كلمة مرور آمنة
                </button>
              </div>

              {passwordStrength && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>قوة كلمة المرور:</span>
                    <span className="font-medium">{passwordStrength.strength}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getPasswordStrengthColor(passwordStrength.strength)}`}
                      style={{ width: `${passwordStrength.percentage}%` }}
                    ></div>
                  </div>
                  {passwordStrength.errors.length > 0 && (
                    <ul className="mt-2 text-xs text-red-600 space-y-1">
                      {passwordStrength.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={passwordStrength && !passwordStrength.valid}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  إنشاء المستخدم
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ username: '', password: '', fullName: '', email: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Key className="w-6 h-6" />
              تغيير كلمة المرور - {selectedUser.username}
            </h2>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  كلمة المرور القديمة *
                </label>
                <input
                  type="password"
                  value={passwordData.oldPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  كلمة المرور الجديدة *
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  تأكيد كلمة المرور الجديدة *
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  تحديث كلمة المرور
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
                    setSelectedUser(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
