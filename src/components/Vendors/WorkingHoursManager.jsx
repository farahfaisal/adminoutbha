import React, { useState } from 'react';
import { ClockIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const DAYS_OF_WEEK = [
  { key: 'saturday', label: 'السبت' },
  { key: 'sunday', label: 'الأحد' },
  { key: 'monday', label: 'الإثنين' },
  { key: 'tuesday', label: 'الثلاثاء' },
  { key: 'wednesday', label: 'الأربعاء' },
  { key: 'thursday', label: 'الخميس' },
  { key: 'friday', label: 'الجمعة' }
];

export default function WorkingHoursManager({ workingHours, holidays, autoStatusChange, timezone, onChange }) {
  const [activeTab, setActiveTab] = useState('hours');

  const handleDayToggle = (dayKey) => {
    const updatedHours = {
      ...workingHours,
      [dayKey]: {
        ...workingHours[dayKey],
        enabled: !workingHours[dayKey]?.enabled
      }
    };
    onChange({ workingHours: updatedHours, holidays, autoStatusChange, timezone });
  };

  const handleTimeChange = (dayKey, field, value) => {
    const updatedHours = {
      ...workingHours,
      [dayKey]: {
        ...workingHours[dayKey],
        [field]: value
      }
    };
    onChange({ workingHours: updatedHours, holidays, autoStatusChange, timezone });
  };

  const handleAutoStatusChange = (value) => {
    onChange({ workingHours, holidays, autoStatusChange: value, timezone });
  };

  const handleTimezoneChange = (value) => {
    onChange({ workingHours, holidays, autoStatusChange, timezone: value });
  };

  const addHoliday = () => {
    const newHoliday = {
      id: Date.now(),
      date: '',
      name: '',
      type: 'holiday'
    };
    onChange({ workingHours, holidays: [...holidays, newHoliday], autoStatusChange, timezone });
  };

  const removeHoliday = (id) => {
    onChange({ workingHours, holidays: holidays.filter(h => h.id !== id), autoStatusChange, timezone });
  };

  const updateHoliday = (id, field, value) => {
    const updatedHolidays = holidays.map(h =>
      h.id === id ? { ...h, [field]: value } : h
    );
    onChange({ workingHours, holidays: updatedHolidays, autoStatusChange, timezone });
  };

  return (
    <div className="space-y-6">
      {/* التبويبات */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('hours')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'hours'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            أوقات العمل
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'holidays'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            العطل والإجازات
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            الإعدادات
          </button>
        </nav>
      </div>

      {/* محتوى التبويبات */}
      {activeTab === 'hours' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4 p-4 bg-blue-50 rounded-lg">
            <ClockIcon className="h-5 w-5 text-blue-600" />
            <p className="text-sm text-blue-800">
              حدد أوقات عمل المتجر لكل يوم. سيتم تغيير حالة المتجر تلقائياً إلى "مفتوح" أو "مغلق" حسب الأوقات المحددة.
            </p>
          </div>

          {DAYS_OF_WEEK.map(day => (
            <div key={day.key} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={workingHours[day.key]?.enabled || false}
                    onChange={() => handleDayToggle(day.key)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="font-medium">{day.label}</span>
                </div>
                {workingHours[day.key]?.enabled && (
                  <span className="text-sm text-green-600">مفتوح</span>
                )}
              </div>

              {workingHours[day.key]?.enabled && (
                <div className="grid grid-cols-2 gap-4 mr-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      وقت الفتح
                    </label>
                    <input
                      type="time"
                      value={workingHours[day.key]?.open || '08:00'}
                      onChange={(e) => handleTimeChange(day.key, 'open', e.target.value)}
                      className="w-full border rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      وقت الإغلاق
                    </label>
                    <input
                      type="time"
                      value={workingHours[day.key]?.close || '22:00'}
                      onChange={(e) => handleTimeChange(day.key, 'close', e.target.value)}
                      className="w-full border rounded-md px-3 py-2"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              أضف العطل الرسمية والإجازات التي سيكون المتجر مغلقاً فيها
            </p>
            <button
              type="button"
              onClick={addHoliday}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5" />
              إضافة عطلة
            </button>
          </div>

          {holidays.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">لم يتم إضافة أي عطل بعد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        اسم العطلة
                      </label>
                      <input
                        type="text"
                        value={holiday.name}
                        onChange={(e) => updateHoliday(holiday.id, 'name', e.target.value)}
                        placeholder="مثال: عيد الفطر"
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        التاريخ
                      </label>
                      <input
                        type="date"
                        value={holiday.date}
                        onChange={(e) => updateHoliday(holiday.id, 'date', e.target.value)}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeHoliday(holiday.id)}
                        className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 flex items-center justify-center gap-2"
                      >
                        <TrashIcon className="h-5 w-5" />
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">التغيير التلقائي للحالة</h3>
                <p className="text-sm text-gray-500 mt-1">
                  تفعيل تغيير حالة المتجر تلقائياً حسب أوقات العمل المحددة
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoStatusChange}
                  onChange={(e) => handleAutoStatusChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              المنطقة الزمنية
            </label>
            <select
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="Asia/Gaza">غزة (Asia/Gaza)</option>
              <option value="Asia/Jerusalem">القدس (Asia/Jerusalem)</option>
              <option value="Asia/Amman">عمّان (Asia/Amman)</option>
              <option value="Asia/Beirut">بيروت (Asia/Beirut)</option>
              <option value="Asia/Damascus">دمشق (Asia/Damascus)</option>
              <option value="Asia/Baghdad">بغداد (Asia/Baghdad)</option>
              <option value="Asia/Riyadh">الرياض (Asia/Riyadh)</option>
              <option value="Africa/Cairo">القاهرة (Africa/Cairo)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              اختر المنطقة الزمنية المناسبة لموقع المتجر
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">ملاحظات مهمة</h4>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li>سيتم فحص حالة المتجر كل دقيقة وتحديثها حسب أوقات العمل</li>
              <li>إذا كان اليوم عطلة، سيتم إغلاق المتجر تلقائياً</li>
              <li>يمكنك تغيير الحالة يدوياً في أي وقت من صفحة البائعين</li>
              <li>التغيير التلقائي سيعيد تطبيق الحالة المناسبة بعد دقيقة واحدة</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
