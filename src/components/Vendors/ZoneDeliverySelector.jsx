import React, { useState } from 'react';
import { toast } from 'react-toastify';

export default function ZoneDeliverySelector({ zones = [], onChange, availableAreas = [] }) {
  const [newZone, setNewZone] = useState({
    name: '',
    price: 0
  });
  const [editingIndex, setEditingIndex] = useState(null);

  const handleAddZone = () => {
    if (!newZone.name) {
      toast.error('الرجاء إدخال اسم المنطقة');
      return;
    }

    if (newZone.price < 0) {
      toast.error('الرجاء إدخال سعر صحيح');
      return;
    }

    // التحقق من عدم وجود المنطقة بالفعل
    if (zones.some(zone => zone.name === newZone.name)) {
      toast.error('هذه المنطقة موجودة بالفعل');
      return;
    }

    // إضافة المنطقة الجديدة
    const updatedZones = [...zones, { ...newZone }];
    onChange(updatedZones);
    
    // إعادة تعيين النموذج
    setNewZone({
      name: '',
      price: 0
    });
  };

  const handleUpdateZone = () => {
    if (editingIndex === null) return;

    if (!newZone.name) {
      toast.error('الرجاء إدخال اسم المنطقة');
      return;
    }

    if (newZone.price < 0) {
      toast.error('الرجاء إدخال سعر صحيح');
      return;
    }

    // التحقق من عدم وجود المنطقة بالفعل (باستثناء المنطقة الحالية)
    if (zones.some((zone, index) => index !== editingIndex && zone.name === newZone.name)) {
      toast.error('هذه المنطقة موجودة بالفعل');
      return;
    }

    // تحديث المنطقة
    const updatedZones = [...zones];
    updatedZones[editingIndex] = { ...newZone };
    onChange(updatedZones);
    
    // إعادة تعيين النموذج
    setNewZone({
      name: '',
      price: 0
    });
    setEditingIndex(null);
  };

  const handleEditZone = (index) => {
    setNewZone({ ...zones[index] });
    setEditingIndex(index);
  };

  const handleRemoveZone = (index) => {
    const updatedZones = zones.filter((_, i) => i !== index);
    onChange(updatedZones);
    
    // إذا كنا نقوم بتحرير هذه المنطقة، إعادة تعيين النموذج
    if (editingIndex === index) {
      setNewZone({
        name: '',
        price: 0
      });
      setEditingIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <h4 className="font-medium text-blue-800 mb-2">إعدادات التوصيل حسب المناطق</h4>
        <p className="text-blue-700">
          أضف المناطق التي ترغب في التوصيل إليها وحدد سعر التوصيل لكل منطقة.
        </p>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-4">المناطق المضافة</h4>
        
        {zones.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            لم تتم إضافة أي مناطق بعد
          </div>
        ) : (
          <div className="space-y-2">
            {zones.map((zone, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">{zone.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-green-600 font-bold">₪{parseFloat(zone.price).toFixed(2)}</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => handleEditZone(index)}
                      className="text-blue-600 hover:text-blue-800 ml-2"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveZone(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-4">
          {editingIndex !== null ? 'تعديل منطقة' : 'إضافة منطقة جديدة'}
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم المنطقة <span className="text-red-600">*</span>
            </label>
            <select
              value={newZone.name}
              onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              required
            >
              <option value="">اختر منطقة</option>
              {availableAreas.map(area => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              سعر التوصيل (₪) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={newZone.price}
              onChange={(e) => setNewZone({ ...newZone, price: parseFloat(e.target.value) })}
              className="w-full border rounded-md px-3 py-2"
              min="0"
              step="0.1"
              required
            />
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          {editingIndex !== null ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setNewZone({ name: '', price: 0 });
                  setEditingIndex(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 ml-2"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleUpdateZone}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                تحديث
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleAddZone}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              إضافة
            </button>
          )}
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h4 className="font-medium text-yellow-800 mb-2">ملاحظات هامة</h4>
        <ul className="list-disc list-inside space-y-1 text-yellow-700">
          <li>يجب إضافة جميع المناطق التي ترغب في التوصيل إليها</li>
          <li>سيتم تطبيق سعر التوصيل المحدد لكل منطقة بغض النظر عن المسافة</li>
          <li>يمكنك تعديل أسعار التوصيل لاحقًا من صفحة طرق التوصيل</li>
        </ul>
      </div>
    </div>
  );
}