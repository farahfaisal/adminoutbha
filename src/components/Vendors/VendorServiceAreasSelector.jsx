import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { MapPin, Check, ChevronDown, ChevronLeft, DollarSign, Percent } from 'lucide-react';

export default function VendorServiceAreasSelector({ vendorId, selectedAreas = [], onUpdate, onChange }) {
  const [serviceAreas, setServiceAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customPrices, setCustomPrices] = useState({});
  const [expandedCities, setExpandedCities] = useState({});
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkDiscount, setBulkDiscount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchServiceAreas();
  }, []);

  useEffect(() => {
    const prices = {};
    selectedAreas.forEach(area => {
      if (area.custom_delivery_price) {
        prices[area.service_area_id || area.id] = area.custom_delivery_price;
      }
    });
    setCustomPrices(prices);
  }, [selectedAreas]);

  const fetchServiceAreas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_areas')
        .select('*')
        .eq('is_active', true)
        .order('city', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      const areas = data || [];
      setServiceAreas(areas);

      const mainAreas = areas.filter(area => !area.parent_id);
      if (mainAreas.length > 0 && mainAreas.length <= 3) {
        const expanded = {};
        mainAreas.forEach(area => {
          expanded[area.id] = true;
        });
        setExpandedCities(expanded);
      }
    } catch (error) {
      console.error('Error fetching service areas:', error);
      toast.error('فشل تحميل مناطق الخدمة');
    } finally {
      setLoading(false);
    }
  };

  const isAreaSelected = (areaId) => {
    return selectedAreas.some(a => (a.service_area_id || a.id) === areaId);
  };

  const toggleArea = (area) => {
    let newSelectedAreas;

    if (isAreaSelected(area.id)) {
      newSelectedAreas = selectedAreas.filter(a => (a.service_area_id || a.id) !== area.id);
      const newCustomPrices = { ...customPrices };
      delete newCustomPrices[area.id];
      setCustomPrices(newCustomPrices);
    } else {
      newSelectedAreas = [
        ...selectedAreas,
        {
          service_area_id: area.id,
          custom_delivery_price: null
        }
      ];
    }

    const updateFn = onUpdate || onChange;
    if (updateFn) {
      updateFn(newSelectedAreas);
    }
  };

  const updateCustomPrice = (areaId, price) => {
    const newCustomPrices = { ...customPrices, [areaId]: price };
    setCustomPrices(newCustomPrices);

    const newSelectedAreas = selectedAreas.map(area => {
      if ((area.service_area_id || area.id) === areaId) {
        return {
          ...area,
          custom_delivery_price: price ? parseFloat(price) : null
        };
      }
      return area;
    });

    const updateFn = onUpdate || onChange;
    if (updateFn) {
      updateFn(newSelectedAreas);
    }
  };

  const toggleCity = (cityId) => {
    setExpandedCities(prev => ({
      ...prev,
      [cityId]: !prev[cityId]
    }));
  };

  const mainAreas = serviceAreas.filter(area => !area.parent_id);
  const subAreas = serviceAreas.filter(area => area.parent_id);

  const getSubAreasForParent = (parentId) => {
    return subAreas.filter(area => area.parent_id === parentId);
  };

  const filteredMainAreas = mainAreas.filter(mainArea => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const matchesMain = mainArea.name.toLowerCase().includes(searchLower) ||
                        mainArea.city.toLowerCase().includes(searchLower);

    const subAreasForMain = getSubAreasForParent(mainArea.id);
    const hasMatchingSubArea = subAreasForMain.some(subArea =>
      subArea.name.toLowerCase().includes(searchLower) ||
      subArea.city.toLowerCase().includes(searchLower)
    );

    return matchesMain || hasMatchingSubArea;
  });

  const getFilteredSubAreas = (parentId) => {
    const subAreasForParent = getSubAreasForParent(parentId);

    if (!searchTerm) return subAreasForParent;

    const searchLower = searchTerm.toLowerCase();
    return subAreasForParent.filter(subArea =>
      subArea.name.toLowerCase().includes(searchLower) ||
      subArea.city.toLowerCase().includes(searchLower)
    );
  };

  const applyBulkPrice = () => {
    if (!bulkPrice || parseFloat(bulkPrice) < 0) {
      toast.error('الرجاء إدخال سعر صحيح');
      return;
    }

    const price = parseFloat(bulkPrice);
    const newCustomPrices = {};
    const newSelectedAreas = selectedAreas.map(area => {
      const areaId = area.service_area_id || area.id;
      newCustomPrices[areaId] = price;
      return {
        ...area,
        custom_delivery_price: price
      };
    });

    setCustomPrices(newCustomPrices);
    const updateFn = onUpdate || onChange;
    if (updateFn) {
      updateFn(newSelectedAreas);
    }
    toast.success(`تم تطبيق السعر ₪${price} على ${selectedAreas.length} منطقة`);
    setBulkPrice('');
  };

  const applyBulkDiscount = () => {
    if (!bulkDiscount || parseFloat(bulkDiscount) < 0) {
      toast.error('الرجاء إدخال نسبة خصم صحيحة');
      return;
    }

    const discount = parseFloat(bulkDiscount);
    const newCustomPrices = {};
    const newSelectedAreas = selectedAreas.map(area => {
      const areaId = area.service_area_id || area.id;
      const serviceArea = serviceAreas.find(sa => sa.id === areaId);

      if (serviceArea) {
        const originalPrice = serviceArea.delivery_price;
        const discountedPrice = originalPrice - (originalPrice * discount / 100);
        const finalPrice = Math.max(0, discountedPrice);

        newCustomPrices[areaId] = finalPrice;
        return {
          ...area,
          custom_delivery_price: finalPrice
        };
      }
      return area;
    });

    setCustomPrices(newCustomPrices);
    const updateFn = onUpdate || onChange;
    if (updateFn) {
      updateFn(newSelectedAreas);
    }
    toast.success(`تم تطبيق خصم ${discount}% على ${selectedAreas.length} منطقة`);
    setBulkDiscount('');
  };

  const resetAllPrices = () => {
    const newCustomPrices = {};
    const newSelectedAreas = selectedAreas.map(area => ({
      ...area,
      custom_delivery_price: null
    }));

    setCustomPrices(newCustomPrices);
    const updateFn = onUpdate || onChange;
    if (updateFn) {
      updateFn(newSelectedAreas);
    }
    toast.success('تم إعادة تعيين جميع الأسعار للسعر الافتراضي');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800 font-medium mb-2">
              كيفية تحديد مناطق الخدمة:
            </p>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>انقر على المنطقة الرئيسية لتوسيعها ورؤية المناطق الفرعية</li>
              <li>اختر المناطق الفرعية التي يخدمها المتجر بالنقر على مربع الاختيار</li>
              <li>يمكنك تخصيص سعر التوصيل لكل منطقة أو استخدام السعر الافتراضي</li>
              <li>استخدم البحث للعثور على منطقة معينة بسرعة</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            placeholder="ابحث عن منطقة أو مدينة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <span className="text-xl">×</span>
            </button>
          )}
        </div>

        {!searchTerm && (
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                const allExpanded = {};
                filteredMainAreas.forEach(area => {
                  allExpanded[area.id] = true;
                });
                setExpandedCities(allExpanded);
              }}
              className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded hover:bg-blue-50"
            >
              توسيع الكل
            </button>
            <button
              type="button"
              onClick={() => setExpandedCities({})}
              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 rounded hover:bg-gray-100"
            >
              طي الكل
            </button>
          </div>
        )}
      </div>

      {selectedAreas.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBulkActions(!showBulkActions)}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">
                إجراءات جماعية على المناطق المحددة ({selectedAreas.length})
              </span>
            </div>
            {showBulkActions ? (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {showBulkActions && (
            <div className="p-4 space-y-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <h4 className="font-medium text-gray-900">تطبيق سعر موحد</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    تطبيق نفس السعر على جميع المناطق المحددة
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="السعر بالشيكل"
                      value={bulkPrice}
                      onChange={(e) => setBulkPrice(e.target.value)}
                      className="flex-1 border rounded-md px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={applyBulkPrice}
                      disabled={!bulkPrice}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      تطبيق
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Percent className="w-5 h-5 text-orange-600" />
                    <h4 className="font-medium text-gray-900">تطبيق خصم بنسبة مئوية</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    خصم نسبة من السعر الأساسي لكل منطقة
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder="نسبة الخصم %"
                      value={bulkDiscount}
                      onChange={(e) => setBulkDiscount(e.target.value)}
                      className="flex-1 border rounded-md px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={applyBulkDiscount}
                      disabled={!bulkDiscount}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      تطبيق
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={resetAllPrices}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  إعادة تعيين جميع الأسعار للقيمة الافتراضية
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {filteredMainAreas.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">
            {searchTerm ? 'لا توجد نتائج تطابق البحث' : 'لا توجد مناطق خدمة متاحة'}
          </p>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              مسح البحث
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto border rounded-lg p-4 bg-gray-50">
          {filteredMainAreas.map((mainArea) => {
            const subAreasForMain = getFilteredSubAreas(mainArea.id);
            const isExpanded = expandedCities[mainArea.id] || searchTerm;

            return (
              <div key={mainArea.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div
                  className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 cursor-pointer hover:from-gray-100 hover:to-gray-200 transition-all"
                  onClick={() => toggleCity(mainArea.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`transform transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                        <ChevronDown className="w-5 h-5 text-gray-700" />
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg">{mainArea.name}</h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        {subAreasForMain.length} منطقة
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 italic">انقر للتوسيع</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {subAreasForMain.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        لا توجد مناطق فرعية
                      </div>
                    ) : (
                      subAreasForMain.map((subArea) => {
                        const selected = isAreaSelected(subArea.id);
                        return (
                          <div
                            key={subArea.id}
                            className={`border rounded-lg p-4 transition-colors ${
                              selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 pt-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleArea(subArea);
                                  }}
                                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
                                    selected
                                      ? 'bg-blue-600 border-blue-600'
                                      : 'border-gray-300 hover:border-blue-400'
                                  }`}
                                  aria-label={`تحديد منطقة ${subArea.name}`}
                                >
                                  {selected && <Check className="w-4 h-4 text-white" />}
                                </button>
                              </div>

                              <div
                                className="flex-1 cursor-pointer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleArea(subArea);
                                }}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h4 className="font-medium text-gray-900">{subArea.name}</h4>
                                    <p className="text-sm text-gray-600">{subArea.city}</p>
                                  </div>
                                  <div className="text-left">
                                    <div className="text-lg font-bold text-gray-900">
                                      ₪{subArea.delivery_price}
                                    </div>
                                    <p className="text-xs text-gray-500">السعر الافتراضي</p>
                                  </div>
                                </div>

                                {selected && (
                                  <div
                                    className="mt-3 pt-3 border-t"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      سعر توصيل مخصص (اختياري)
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder={`السعر الافتراضي: ₪${subArea.delivery_price}`}
                                        value={customPrices[subArea.id] || ''}
                                        onChange={(e) => updateCustomPrice(subArea.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex-1 border rounded-md px-3 py-2 text-sm"
                                      />
                                      <span className="text-gray-600">₪</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      اترك فارغاً لاستخدام السعر الافتراضي
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedAreas.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800 font-medium">
            تم اختيار {selectedAreas.length} منطقة فرعية
          </p>
        </div>
      )}
    </div>
  );
}
