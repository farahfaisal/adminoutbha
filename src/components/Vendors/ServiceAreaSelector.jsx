import React, { useState } from 'react';

export default function ServiceAreaSelector({ availableAreas, selectedAreas, onChange, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newArea, setNewArea] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);

  const filteredAreas = searchTerm
    ? availableAreas.filter(area => area.toLowerCase().includes(searchTerm.toLowerCase()))
    : availableAreas;

  const handleAreaToggle = (area) => {
    const newSelectedAreas = selectedAreas.includes(area)
      ? selectedAreas.filter(a => a !== area)
      : [...selectedAreas, area];
    
    onChange(newSelectedAreas);
  };

  const handleSelectAll = () => {
    onChange(availableAreas);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleAddNewArea = () => {
    if (!newArea.trim()) {
      return;
    }

    // تحقق من عدم وجود المنطقة بالفعل
    if (availableAreas.includes(newArea.trim()) || selectedAreas.includes(newArea.trim())) {
      alert('هذه المنطقة موجودة بالفعل');
      return;
    }

    // إضافة المنطقة الجديدة إلى المناطق المحددة
    onChange([...selectedAreas, newArea.trim()]);
    setNewArea('');
    setShowAddNew(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث عن منطقة..."
          className="flex-1 border rounded-md px-3 py-2"
        />
        <button
          type="button"
          onClick={handleSelectAll}
          className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
        >
          تحديد الكل
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
        >
          إلغاء الكل
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto border rounded-md p-4">
        {filteredAreas.length > 0 ? (
          filteredAreas.map(area => (
            <label key={area} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={selectedAreas.includes(area)}
                onChange={() => handleAreaToggle(area)}
                className="rounded text-blue-600"
              />
              <span>{area}</span>
            </label>
          ))
        ) : (
          <div className="col-span-full text-center py-4 text-gray-500">
            لا توجد مناطق متطابقة مع البحث
            <button
              type="button"
              onClick={() => setShowAddNew(true)}
              className="block mx-auto mt-2 text-blue-600 hover:text-blue-800"
            >
              إضافة منطقة جديدة
            </button>
          </div>
        )}
      </div>

      {showAddNew && (
        <div className="mt-4 p-4 border rounded-md bg-gray-50">
          <h4 className="font-medium text-gray-700 mb-2">إضافة منطقة خدمة جديدة</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="اسم المنطقة الجديدة..."
              className="flex-1 border rounded-md px-3 py-2"
            />
            <button
              type="button"
              onClick={handleAddNewArea}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              إضافة
            </button>
            <button
              type="button"
              onClick={() => setShowAddNew(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {!showAddNew && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowAddNew(true)}
            className="px-4 py-2 text-blue-600 hover:text-blue-800 flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة منطقة خدمة جديدة
          </button>
        </div>
      )}

      <div className="mt-4">
        <h4 className="font-medium text-gray-700 mb-2">المناطق المحددة ({selectedAreas.length})</h4>
        <div className="p-4 border rounded-md bg-blue-50">
          {selectedAreas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedAreas.map(area => (
                <span 
                  key={area} 
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center"
                >
                  {area}
                  <button
                    type="button"
                    onClick={() => handleAreaToggle(area)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500">لم يتم تحديد أي منطقة</div>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          سيتم التوصيل فقط إلى المناطق المحددة أعلاه. يمكنك تحديد منطقة واحدة أو أكثر.
        </p>
      </div>
    </div>
  );
}