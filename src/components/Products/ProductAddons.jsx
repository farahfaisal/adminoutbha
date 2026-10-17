import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import MediaUpload from './MediaUpload';
import { BUCKETS } from '../../lib/supabaseStorage';

export default function ProductAddons({ addons = [], onChange, onUpdate }) {
  const handleChange = onChange || onUpdate || (() => {});
  const [newAddon, setNewAddon] = useState({
    name: '',
    price: 0,
    is_default: false,
    is_required: false,
    image_url: ''
  });

  const handleAddAddon = () => {
    if (!newAddon.name) {
      toast.error('الرجاء إدخال اسم الإضافة');
      return;
    }

    const addon = {
      id: uuidv4(),
      ...newAddon
    };

    handleChange([...addons, addon]);
    setNewAddon({
      name: '',
      price: 0,
      is_default: false,
      is_required: false,
      image_url: ''
    });
  };

  const handleRemoveAddon = (addonId) => {
    handleChange(addons.filter(a => a.id !== addonId));
  };

  const handleUpdateAddon = (addonId, field, value) => {
    handleChange(addons.map(a =>
      a.id === addonId
        ? { ...a, [field]: value }
        : a
    ));
  };

  const handleImageUpload = (addonId, { preview }) => {
    if (preview) {
      handleUpdateAddon(addonId, 'image_url', preview);
    }
  };

  const handleNewAddonImageUpload = ({ preview }) => {
    if (preview) {
      setNewAddon({ ...newAddon, image_url: preview });
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">الإضافات</h3>
        
        {addons.length > 0 ? (
          <div className="space-y-4">
            {addons.map(addon => (
              <div key={addon.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        اسم الإضافة
                      </label>
                      <input
                        type="text"
                        value={addon.name}
                        onChange={(e) => handleUpdateAddon(addon.id, 'name', e.target.value)}
                        className="w-full border rounded-md px-3 py-1.5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        السعر (₪)
                      </label>
                      <input
                        type="number"
                        value={addon.price}
                        onChange={(e) => handleUpdateAddon(addon.id, 'price', parseFloat(e.target.value))}
                        className="w-full border rounded-md px-3 py-1.5"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={addon.is_default}
                          onChange={(e) => handleUpdateAddon(addon.id, 'is_default', e.target.checked)}
                          className="ml-2"
                        />
                        افتراضي
                      </label>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={addon.is_required}
                          onChange={(e) => handleUpdateAddon(addon.id, 'is_required', e.target.checked)}
                          className="ml-2"
                        />
                        مكونات
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      صورة الإضافة
                    </label>
                    <MediaUpload
                      bucket={BUCKETS.ADDONS}
                      onUpload={(result) => handleImageUpload(addon.id, result)}
                      currentImage={addon.image_url}
                      accept="image/*"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveAddon(addon.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">لا توجد إضافات بعد</p>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">إضافة إضافة جديدة</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اسم الإضافة
              </label>
              <input
                type="text"
                value={newAddon.name}
                onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                className="w-full border rounded-md px-3 py-1.5"
                placeholder="مثال: سكر إضافي"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                السعر (₪)
              </label>
              <input
                type="number"
                value={newAddon.price}
                onChange={(e) => setNewAddon({ ...newAddon, price: parseFloat(e.target.value) })}
                className="w-full border rounded-md px-3 py-1.5"
                min="0"
                step="0.01"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newAddon.is_default}
                  onChange={(e) => setNewAddon({ ...newAddon, is_default: e.target.checked })}
                  className="ml-2"
                />
                افتراضي
              </label>
            </div>

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newAddon.is_required}
                  onChange={(e) => setNewAddon({ ...newAddon, is_required: e.target.checked })}
                  className="ml-2"
                />
                مكونات
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              صورة الإضافة
            </label>
            <MediaUpload
              bucket={BUCKETS.ADDONS}
              onUpload={handleNewAddonImageUpload}
              currentImage={newAddon.image_url}
              accept="image/*"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleAddAddon}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            إضافة
          </button>
        </div>
      </div>
    </div>
  );
}