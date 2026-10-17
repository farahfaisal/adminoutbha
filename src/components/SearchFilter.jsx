import React from 'react';

export default function SearchFilter({ filters, onFilterChange }) {
  const handleChange = (key, value) => {
    onFilterChange({ [key]: value });
  };

  const renderFilterInput = (key, filter) => {
    switch (filter.type) {
      case 'text':
        return (
          <input
            type="text"
            value={filter.value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={filter.placeholder}
            className="w-full border rounded-md px-3 py-2"
          />
        );
      case 'select':
        return (
          <select
            value={filter.value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">{filter.placeholder}</option>
            {filter.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={filter.value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={filter.placeholder}
            min={filter.min}
            max={filter.max}
            step={filter.step}
            className="w-full border rounded-md px-3 py-2"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={filter.value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        );
      case 'dateRange':
        return (
          <div className="flex gap-2">
            <input
              type="date"
              value={filter.value?.start || ''}
              onChange={(e) => handleChange(`${key}Start`, e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            />
            <input
              type="date"
              value={filter.value?.end || ''}
              onChange={(e) => handleChange(`${key}End`, e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.entries(filters).map(([key, filter]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {filter.label}
            </label>
            {renderFilterInput(key, filter)}
          </div>
        ))}
      </div>
    </div>
  );
}