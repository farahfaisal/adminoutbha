import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import MediaUpload from './MediaUpload';
import { BUCKETS } from '../../lib/supabaseStorage';

export default function ProductVariants({ variants = [], onChange, onUpdate }) {
  const handleChange = onChange || onUpdate || (() => {});
  const [newVariant, setNewVariant] = useState({
    name: '',
    price: 0,
    wholesale_price: 0,
    discount_price: 0,
    stock: 0,
    image_url: '',
    sku: '',
    preparation_time: '' // No default value, can be empty
  });

  const handleAddVariant = (e) => {
    e.preventDefault();

    if (!newVariant.name) {
      toast.error('الرجاء إدخال اسم النوع');
      return;
    }
    
    // No validation for preparation_time - it's optional now

    const variant = {
      id: uuidv4(),
      ...newVariant
    };

    handleChange([...variants, variant]);
    setNewVariant({ 
      name: '',
      price: 0,
      wholesale_price: 0,
      discount_price: 0,
      stock: 0,
      image_url: '',
      sku: '',
      preparation_time: ''
    });
  };

  const handleRemoveVariant = (variantId) => {
    handleChange(variants.filter(v => v.id !== variantId));
  };

  const handleUpdateVariant = (variantId, field, value) => {
    handleChange(variants.map(v =>
      v.id === variantId
        ? { ...v, [field]: value }
        : v
    ));
  };

  const handleImageUpload = (variantId, { preview }) => {
    if (preview) {
      handleUpdateVariant(variantId, 'image_url', preview);
    }
  };

  const handleNewVariantImageUpload = ({ preview }) => {
    if (preview) {
      setNewVariant({ ...newVariant, image_url: preview });
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">الأنواع المتوفرة</h3>

        {variants.length > 0 ? (
          <div className="space-y-4">
            {variants.map(variant => (
              <div key={variant.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم النوع</label>
                    <input
                      type="text"
                      value={variant.name}
                      onChange={(e) => handleUpdateVariant(variant.id, 'name', e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">وقت التحضير (دقائق)</label>
                    <input
                      type="number"
                      value={variant.preparation_time || ''}
                      onChange={(e) => handleUpdateVariant(variant.id, 'preparation_time', e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full border rounded-md px-3 py-1.5"
                      min="1"
                      placeholder="اختياري"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">السعر (₪)</label>
                    <input
                      type="number"
                      value={variant.price}
                      onChange={(e) => handleUpdateVariant(variant.id, 'price', parseFloat(e.target.value))}
                      className="w-full border rounded-md px-3 py-1.5"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">سعر الجملة (₪)</label>
                    <input
                      type="number"
                      value={variant.wholesale_price}
                      onChange={(e) => handleUpdateVariant(variant.id, 'wholesale_price', parseFloat(e.target.value))}
                      className="w-full border rounded-md px-3 py-1.5"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">سعر التخفيض (₪)</label>
                    <input
                      type="number"
                      value={variant.discount_price}
                      onChange={(e) => handleUpdateVariant(variant.id, 'discount_price', parseFloat(e.target.value))}
                      className="w-full border rounded-md px-3 py-1.5"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المخزون</label>
                    <input
                      type="number"
                      value={variant.stock}
                      onChange={(e) => handleUpdateVariant(variant.id, 'stock', parseInt(e.target.value))}
                      className="w-full border rounded-md px-3 py-1.5"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم المنتج (SKU)</label>
                    <input
                      type="text"
                      value={variant.sku}
                      onChange={(e) => handleUpdateVariant(variant.id, 'sku', e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                      <span>صورة النوع</span>
                      {variant.image_url && (
                        <button
                          type="button"
                          onClick={() => handleUpdateVariant(variant.id, 'image_url', '')}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          حذف الصورة
                        </button>
                      )}
                    </label>
                    <MediaUpload
                      type="image"
                      preview={variant.image_url}
                      onUpload={(data) => handleImageUpload(variant.id, data)}
                      storeInSupabase={true}
                      bucket={BUCKETS.PRODUCTS}
                      folder="variants"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveVariant(variant.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">لا توجد أنواع بعد</p>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">إضافة نوع جديد</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم النوع</label>
            <input
              type="text"
              value={newVariant.name}
              onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
              className="w-full border rounded-md px-3 py-1.5"
              placeholder="مثال: أحمر كبير"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">وقت التحضير (دقائق)</label>
            <input
              type="number"
              value={newVariant.preparation_time}
              onChange={(e) => setNewVariant({ ...newVariant, preparation_time: e.target.value })}
              className="w-full border rounded-md px-3 py-1.5"
              min="1"
              placeholder="اختياري"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">السعر (₪)</label>
            <input
              type="number"
              value={newVariant.price}
              onChange={(e) => setNewVariant({ ...newVariant, price: parseFloat(e.target.value) })}
              className="w-full border rounded-md px-3 py-1.5"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">سعر الجملة (₪)</label>
            <input
              type="number"
              value={newVariant.wholesale_price}
              onChange={(e) => setNewVariant({ ...newVariant, wholesale_price: parseFloat(e.target.value) })}
              className="w-full border rounded-md px-3 py-1.5"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">سعر التخفيض (₪)</label>
            <input
              type="number"
              value={newVariant.discount_price}
              onChange={(e) => setNewVariant({ ...newVariant, discount_price: parseFloat(e.target.value) })}
              className="w-full border rounded-md px-3 py-1.5"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المخزون</label>
            <input
              type="number"
              value={newVariant.stock}
              onChange={(e) => setNewVariant({ ...newVariant, stock: parseInt(e.target.value) })}
              className="w-full border rounded-md px-3 py-1.5"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم المنتج (SKU)</label>
            <input
              type="text"
              value={newVariant.sku}
              onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
              className="w-full border rounded-md px-3 py-1.5"
              placeholder="ABC123"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
              <span>صورة النوع</span>
              {newVariant.image_url && (
                <button
                  type="button"
                  onClick={() => setNewVariant({ ...newVariant, image_url: '' })}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  حذف الصورة
                </button>
              )}
            </label>
            <MediaUpload
              type="image"
              preview={newVariant.image_url}
              onUpload={handleNewVariantImageUpload}
              storeInSupabase={true}
              bucket={BUCKETS.PRODUCTS}
              folder="variants"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button 
            type="submit"
            onClick={handleAddVariant} 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            إضافة النوع
          </button>
        </div>
      </div>
    </div>
  );
}