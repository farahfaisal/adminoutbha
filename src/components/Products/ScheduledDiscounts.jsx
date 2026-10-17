import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { toast } from 'react-toastify';

export default function ScheduledDiscounts({ discounts = [], onChange }) {
  const [newDiscount, setNewDiscount] = useState({
    price: '',
    start_date: null,
    end_date: null,
    description: ''
  });

  const handleAddDiscount = () => {
    if (!newDiscount.price || !newDiscount.start_date || !newDiscount.end_date) {
      toast.error('الرجاء إدخال السعر وتواريخ التخفيض');
      return;
    }

    if (newDiscount.start_date >= newDiscount.end_date) {
      toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }

    const discount = {
      id: uuidv4(),
      ...newDiscount
    };

    onChange([...discounts, discount]);
    setNewDiscount({
      price: '',
      start_date: null,
      end_date: null,
      description: ''
    });
  };

  const handleRemoveDiscount = (discountId) => {
    onChange(discounts.filter(d => d.id !== discountId));
  };

  const handleUpdateDiscount = (discountId, field, value) => {
    onChange(discounts.map(d => 
      d.id === discountId 
        ? { ...d, [field]: value }
        : d
    ));
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">التخفيضات المجدولة</h3>
        
        {discounts.length > 0 ? (
          <div className="space-y-4">
            {discounts.map(discount => (
              <div key={discount.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      سعر التخفيض (₪)
                    </label>
                    <input
                      type="number"
                      value={discount.price}
                      onChange={(e) => handleUpdateDiscount(discount.id, 'price', parseFloat(e.target.value))}
                      className="w-full border rounded-md px-3 py-1.5"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      تاريخ البداية
                    </label>
                    <DatePicker
                      selected={new Date(discount.start_date)}
                      onChange={(date) => handleUpdateDiscount(discount.id, 'start_date', date)}
                      className="w-full border rounded-md px-3 py-1.5"
                      dateFormat="yyyy/MM/dd"
                      minDate={new Date()}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      تاريخ النهاية
                    </label>
                    <DatePicker
                      selected={new Date(discount.end_date)}
                      onChange={(date) => handleUpdateDiscount(discount.id, 'end_date', date)}
                      className="w-full border rounded-md px-3 py-1.5"
                      dateFormat="yyyy/MM/dd"
                      minDate={new Date(discount.start_date)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      الوصف
                    </label>
                    <input
                      type="text"
                      value={discount.description}
                      onChange={(e) => handleUpdateDiscount(discount.id, 'description', e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5"
                      placeholder="مثال: تخفيض العيد"
                    />
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleRemoveDiscount(discount.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">لا توجد تخفيضات مجدولة</p>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">إضافة تخفيض جديد</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              سعر التخفيض (₪)
            </label>
            <input
              type="number"
              value={newDiscount.price}
              onChange={(e) => setNewDiscount({ ...newDiscount, price: parseFloat(e.target.value) })}
              className="w-full border rounded-md px-3 py-1.5"
              min="0"
              step="0.01"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تاريخ البداية
            </label>
            <DatePicker
              selected={newDiscount.start_date}
              onChange={(date) => setNewDiscount({ ...newDiscount, start_date: date })}
              className="w-full border rounded-md px-3 py-1.5"
              dateFormat="yyyy/MM/dd"
              minDate={new Date()}
              placeholderText="اختر تاريخ البداية"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تاريخ النهاية
            </label>
            <DatePicker
              selected={newDiscount.end_date}
              onChange={(date) => setNewDiscount({ ...newDiscount, end_date: date })}
              className="w-full border rounded-md px-3 py-1.5"
              dateFormat="yyyy/MM/dd"
              minDate={newDiscount.start_date || new Date()}
              placeholderText="اختر تاريخ النهاية"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الوصف
            </label>
            <input
              type="text"
              value={newDiscount.description}
              onChange={(e) => setNewDiscount({ ...newDiscount, description: e.target.value })}
              className="w-full border rounded-md px-3 py-1.5"
              placeholder="مثال: تخفيض العيد"
            />
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleAddDiscount}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            إضافة التخفيض
          </button>
        </div>
      </div>
    </div>
  );
}