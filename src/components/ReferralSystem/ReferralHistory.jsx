import React from 'react';
import { formatDate } from '../../utils/formatters';

export default function ReferralHistory({ referrals = [] }) {
  if (referrals.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <div className="text-gray-500">لا توجد إحالات بعد</div>
        <p className="mt-2 text-sm text-gray-400">شارك كود الإحالة الخاص بك للحصول على نقاط إضافية</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-gray-800">سجل الإحالات</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المستخدم</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">معلومات الاتصال</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">النقاط</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {referrals.map((referral) => (
              <tr key={referral.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{referral.user_name || 'مستخدم جديد'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {referral.user_email && <div>البريد: {referral.user_email}</div>}
                    {referral.user_phone && <div>الهاتف: {referral.user_phone}</div>}
                    {!referral.user_email && !referral.user_phone && <div>لا توجد معلومات اتصال</div>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    referral.status === 'completed' 
                      ? 'bg-green-100 text-green-800' : 
                    referral.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {referral.status === 'completed' ? 'مكتمل' : 
                     referral.status === 'pending' ? 'معلق' : 'ملغي'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {referral.status === 'completed' ? `+${referral.points}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(referral.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}