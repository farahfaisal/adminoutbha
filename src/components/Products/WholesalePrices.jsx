import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

export default function WholesalePrices({ prices = [], onChange }) {
  const [tiers] = useState([
    { id: 1, name: 'برونزي' },
    { id: 2, name: 'فضي' },
    { id: 3, name: 'ذهبي' },
    { id: 4, name: 'بلاتيني' }
  ]);

  const [newPrice, setNewPrice] = useState({
    tier_id: '',
    price: '',
    min_quantity: 1
  });

  const handleAddPrice = () => {
    if (!newPrice.tier_id || !newPrice.price) {
      toast.error('الرجاء إدخال المستوى والسعر');
      return;
    }

    const price = {
      id: uuidv4(),
      ...newPrice
    };

    onChange([...prices, price]);
    setNewPrice({
      tier_id: '',
      price: '',
      min_quantity: 1
    });
  };

  const handleRemovePrice = (priceId) => {
    onChange(prices.filter(p => p.id !== priceId));
  };

  const handleUpdatePrice = (priceId, field, value) => {
    onChange(prices.map(p => 
      p.id === priceId 
        ? { ...p, [field]: value }
        : p
    ));
  };

  const getTierColor = (tierId) => {
    const tier = tiers.find(t => t.id === Number(tierId));
    switch (tier?.name) {
      case 'برونزي': return 'bg-amber-100 text-amber-800';
      case 'فضي': return 'bg-gray-100 text-gray-800';
      case 'ذهبي': return 'bg-yellow-100 text-yellow-800';
      case 'بلاتيني': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">أسعار الجملة</h3>
        
        {prices.length > 0 ? (
          <div className="space-y-4">
            {prices.map(price => (
              <div key={price.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      المستوى
                    </label>
                    <select
                      value={price.tier_id}
                      onChange={(e) => handleUpdatePrice(price.id, 'tier_id', Number(e.target.value))}
                      className={`w-full border rounded-md px-3 py-1.5 ${getTierColor(price.tier_id)}`}
                    >
                      <option value="">اختر المستوى</option>
                      {tiers.map(tier => (
                        <option key={tier.id} value={tier.id}>
                          {tier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      السعر (₪)
                    </label>
                    <input
                      type="number"
                      value={price.price}
                      onChange={(e) => handleUpdatePrice(price.id, 'price', parseFloat(e.target.value))}
                      className="w-full border rounded-md px-3 py-1.5"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      الحد الأدنى للكمية
                    </label>
                    <input
                      type="number"
                      value={price.min_quantity}
                      onChange={(e) => handleUpdatePrice(price.id, 'min_quantity', parseInt(e.target.value))}
                      className="w-full border rounded-md px-3 py-1.5"
                      min="1"
                    />
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleRemovePrice(price.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">لا توجد أسعار جملة</p>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">إضافة سعر جديد</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              المستوى
            </label>
            <select
              value={newPrice.tier_id}
              onChange={(e) => setNewPrice({ ...newPrice, tier_id: Number(e.target.value) })}
              className={`w-full border rounded-md px-3 py-1.5 ${getTierColor(newPrice.tier_id)}`}
            >
              <option value="">اختر المستوى</option>
              {tiers.map(tier => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              السعر (₪)
            </label>
            <input
              type="number"
              value={newPrice.price}
              onChange={(e) => setNewPrice({ ...newPrice, price: parseFloat(e.target.value) })}
              className="w-full border rounded-md px-3 py-1.5"
              min="0"
              step="0.01"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الحد الأدنى للكمية
            </label>
            <input
              type="number"
              value={newPrice.min_quantity}
              onChange={(e) => setNewPrice({ ...newPrice, min_quantity: parseInt(e.target.value) })}
              className="w-full border rounded-md px-3 py-1.5"
              min="1"
            />
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleAddPrice}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            إضافة السعر
          </button>
        </div>
      </div>
    </div>
  );
}