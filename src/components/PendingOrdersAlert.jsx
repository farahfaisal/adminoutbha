import React, { useEffect, useState } from 'react';
import { Bell, X, Volume2 } from 'lucide-react';

export default function PendingOrdersAlert({ totalPendingOrders, onActivate }) {
  const [showAlert, setShowAlert] = useState(true);
  const [isActivating, setIsActivating] = useState(false);

  if (!showAlert || totalPendingOrders === 0) return null;

  const handleActivate = () => {
    setIsActivating(true);
    if (onActivate) {
      onActivate();
    }
    setTimeout(() => {
      setShowAlert(false);
    }, 1000);
  };

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg shadow-2xl p-4 max-w-md">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="relative">
              <Bell className="w-8 h-8 animate-pulse" />
              <span className="absolute -top-1 -right-1 bg-white text-red-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalPendingOrders}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              لديك {totalPendingOrders} طلب معلق!
            </h3>
            <p className="text-sm text-white/90 mb-3">
              {isActivating ? 'جاري تفعيل الإشعارات الصوتية...' : 'انقر في أي مكان على الصفحة لتفعيل الإشعارات الصوتية'}
            </p>

            <button
              onClick={handleActivate}
              disabled={isActivating}
              className="w-full bg-white text-red-600 font-semibold py-2 px-4 rounded-lg hover:bg-red-50 transition-all transform hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Volume2 className="w-5 h-5" />
              {isActivating ? 'جاري التفعيل...' : 'تفعيل الإشعارات الصوتية'}
            </button>
          </div>

          <button
            onClick={() => setShowAlert(false)}
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
            disabled={isActivating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
