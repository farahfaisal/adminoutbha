import { useState, useCallback } from 'react';

export default function useFilters(initialFilters = {}, data = []) {
  const [filters, setFilters] = useState(initialFilters);

  const filterData = useCallback((items) => {
    return items.filter(item => {
      return Object.entries(filters).every(([key, filter]) => {
        // Skip if filter value is empty
        if (!filter.value && filter.value !== 0) return true;

        switch (filter.type) {
          case 'text':
            // For text filters, check if the item's value contains the filter value
            const itemValue = String(item[key] || '').toLowerCase();
            const filterValue = String(filter.value || '').toLowerCase();
            return itemValue.includes(filterValue);
          
          case 'select':
            // For select filters, check if the item's value equals the filter value
            if (key === 'vendor_id' && item.vendor) {
              return filter.value === '' || item.vendor.id === filter.value;
            }
            if (key === 'category_id' && item.category) {
              return filter.value === '' || item.category.id === filter.value;
            }
            return filter.value === '' || item[key] === filter.value;
          
          case 'number':
            // For number filters, check if the item's value is greater than or equal to the filter value
            return item[key] >= Number(filter.value);
          
          case 'date':
            // For date filters, check if the item's date equals the filter date
            const itemDate = new Date(item[key]).toISOString().split('T')[0];
            return itemDate === filter.value;
          
          case 'dateRange':
            // For date range filters, check if the item's date is within the filter range
            const date = new Date(item[key]);
            const start = filter.value.start ? new Date(filter.value.start) : null;
            const end = filter.value.end ? new Date(filter.value.end) : null;
            
            if (start && end) {
              return date >= start && date <= end;
            } else if (start) {
              return date >= start;
            } else if (end) {
              return date <= end;
            }
            return true;
          
          default:
            return true;
        }
      });
    });
  }, [filters]);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      ...Object.fromEntries(
        Object.entries(newFilters).map(([key, value]) => [
          key,
          { ...prevFilters[key], value }
        ])
      )
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  return {
    filters,
    filterData,
    handleFilterChange,
    resetFilters
  };
}