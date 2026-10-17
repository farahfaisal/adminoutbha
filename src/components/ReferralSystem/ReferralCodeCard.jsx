import React, { useState } from 'react';
import { toast } from 'react-toastify';

export default function ReferralCodeCard({ code, stats, shareUrl, customerInfo }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('تم نسخ كود الإحالة');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('تم نسخ رابط الإحالة');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'شارك كود الإحالة',
          text: `استخدم كود الإحالة الخاص بي ${code} للحصول على نقاط مكافأة!`,
          url: shareUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 border border-blue-100">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-blue-800">كود الإحالة الخاص بك</h3>
        <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
          نشط
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-blue-200 flex justify-between items-center mb-6">
        <div className="font-mono text-xl font-bold text-blue-700">{code}</div>
        <button
          onClick={handleCopyCode}
          className={`px-3 py-1 rounded-md text-sm transition-colors ${
            copied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          {copied ? 'تم النسخ ✓' : 'نسخ'}
        </button>
      </div>

      {customerInfo && (
        <div className="bg-white p-4 rounded-lg border border-blue-200 mb-6">
          <h4 className="font-medium text-blue-800 mb-2">معلومات العميل</h4>
          <div className="space-y-2">
            <p><span className="font-medium">الاسم:</span> {customerInfo.name || 'غير متوفر'}</p>
            <p><span className="font-medium">الهاتف:</span> {customerInfo.phone || 'غير متوفر'}</p>
            <p><span className="font-medium">البريد الإلكتروني:</span> {customerInfo.email || 'غير متوفر'}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-3 rounded-lg border border-blue-100 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total_referrals}</div>
          <div className="text-sm text-gray-600">إجمالي الإحالات</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-blue-100 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.total_points}</div>
          <div className="text-sm text-gray-600">النقاط المكتسبة</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">مشاركة الكود</h4>
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 bg-white border border-blue-200 text-blue-700 px-3 py-2 rounded-md hover:bg-blue-50 transition-colors"
            >
              نسخ الرابط
            </button>
            <button
              onClick={handleShare}
              className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              مشاركة
            </button>
          </div>
        </div>

        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
          <h4 className="font-medium text-yellow-800 mb-2">كيف تعمل الإحالة؟</h4>
          <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
            <li>شارك الكود مع أصدقائك</li>
            <li>عندما يستخدمون الكود، يحصلون على 100 نقطة</li>
            <li>وأنت تحصل على 50 نقطة لكل صديق</li>
            <li>يمكن استبدال النقاط بمكافآت وخصومات</li>
          </ul>
        </div>
      </div>
    </div>
  );
}