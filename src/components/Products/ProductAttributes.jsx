import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

export default function ProductAttributes({ attributes = [], onChange }) {
  const [newAttribute, setNewAttribute] = useState({
    name: '',
    type: 'select',
    required: false,
    values: []
  });

  const [newValue, setNewValue] = useState('');

  const handleAddAttribute = () => {
    if (!newAttribute.name) {
      toast.error('الرجاء إدخال اسم السمة');
      return;
    }

    if (newAttribute.type === 'select' && newAttribute.values.length === 0) {
      toast.error('الرجاء إضافة قيم للسمة');
      return;
    }

    const attribute = {
      id: uuidv4(),
      ...newAttribute
    };

    onChange([...attributes, attribute]);
    setNewAttribute({
      name: '',
      type: 'select',
      required: false,
      values: []
    });
  };

  const handleRemoveAttribute = (attributeId) => {
    onChange(attributes.filter(a => a.id !== attributeId));
  };

  const handleUpdateAttribute = (attributeId, field, value) => {
    onChange(attributes.map(a => 
      a.id === attributeId 
        ? { ...a, [field]: value }
        : a
    ));
  };

  const handleAddValue = () => {
    if (!newValue) {
      toast.error('الرجاء إدخال قيمة');
      return;
    }

    setNewAttribute({
      ...newAttribute,
      values: [...newAttribute.values, { id: uuidv4(), value: newValue }]
    });
    setNewValue('');
  };

  const handleRemoveValue = (attributeId, valueId) => {
    onChange(attributes.map(a => 
      a.id === attributeId 
        ? { ...a, values: a.values.filter(v => v.id !== valueId) }
        : a
    ));
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">السمات العامة</h3>
        
        {attributes.length > 0 ? (
          <div className="space-y-4">
            {attributes.map(attribute => (
              <div key={attribute.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        اسم السمة
                      </label>
                      <input
                        type="text"
                        value={attribute.name}
                        onChange={(e) => handleUpdateAttribute(attribute.id, 'name', e.target.value)}
                        className="w-full border rounded-md px-3 py-1.5"
                        placeholder="مثال: المقاس"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        نوع السمة
                      </label>
                      <select
                        value={attribute.type}
                        onChange={(e) => handleUpdateAttribute(attribute.id, 'type', e.target.value)}
                        className="w-full border rounded-md px-3 py-1.5"
                      >
                        <option value="select">قائمة اختيار</option>
                        <option value="text">نص</option>
                        <option value="number">رقم</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={attribute.required}
                          onChange={(e) => handleUpdateAttribute(attribute.id, 'required', e.target.checked)}
                          className="ml-2"
                        />
                        إجباري
                      </label>
                    </div>
                  </div>

                  {attribute.type === 'select' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        القيم المتاحة
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {attribute.values.map(value => (
                          <span
                            key={value.id}
                            className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                          >
                            {value.value}
                            <button
                              type="button"
                              onClick={() => handleRemoveValue(attribute.id, value.id)}
                              className="mr-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => handleRemoveAttribute(attribute.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">لا توجد سمات بعد</p>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">إضافة سمة جديدة</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اسم السمة
              </label>
              <input
                type="text"
                value={newAttribute.name}
                onChange={(e) => setNewAttribute({ ...newAttribute, name: e.target.value })}
                className="w-full border rounded-md px-3 py-1.5"
                placeholder="مثال: المقاس"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                نوع السمة
              </label>
              <select
                value={newAttribute.type}
                onChange={(e) => setNewAttribute({ ...newAttribute, type: e.target.value })}
                className="w-full border rounded-md px-3 py-1.5"
              >
                <option value="select">قائمة اختيار</option>
                <option value="text">نص</option>
                <option value="number">رقم</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newAttribute.required}
                  onChange={(e) => setNewAttribute({ ...newAttribute, required: e.target.checked })}
                  className="ml-2"
                />
                إجباري
              </label>
            </div>
          </div>

          {newAttribute.type === 'select' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                القيم المتاحة
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="flex-1 border rounded-md px-3 py-1.5"
                  placeholder="أدخل قيمة"
                />
                <button
                  type="button"
                  onClick={handleAddValue}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  إضافة
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {newAttribute.values.map(value => (
                  <span
                    key={value.id}
                    className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {value.value}
                    <button
                      type="button"
                      onClick={() => setNewAttribute({
                        ...newAttribute,
                        values: newAttribute.values.filter(v => v.id !== value.id)
                      })}
                      className="mr-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleAddAttribute}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            إضافة السمة
          </button>
        </div>
      </div>
    </div>
  );
}