import React, { useState, useEffect, Fragment } from 'react';
import { Dialog } from '@headlessui/react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import SearchFilter from '../SearchFilter';
import useFilters from '../../hooks/useFilters';
import { getAllShippingZones, createShippingZone, updateShippingZone, deleteShippingZone } from '../../lib/shippingApi';

export default function ShippingMethods() {
  const [methods, setMethods] = useState([]);
  const [zones, setZones] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [editingZone, setEditingZone] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    zone_id: '',
    cost: 0,
    min_amount: null,
    max_amount: null,
    delivery_type: 'distance',
    settings: {
      distance: {
        min_distance: 1,
        max_distance: 20,
        base_fee: 5,
        price_per_km: 2
      },
      fixed: {
        fixed_price: 10
      },
      zones: {
        zones: [
          { name: 'المنطقة أ', price: 10 },
          { name: 'المنطقة ب', price: 15 },
          { name: 'المنطقة ج', price: 20 }
        ]
      },
      service_areas: {
        use_vendor_areas: true,
        selected_areas: []
      }
    }
  });

  const [zoneForm, setZoneForm] = useState({
    name: '',
    vendor_id: null
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // جلب مناطق الشحن
      const zonesData = await getAllShippingZones();
      setZones(zonesData || []);

      // جلب البائعين
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, store_name')
        .order('store_name');
      
      if (vendorsError) throw vendorsError;
      setVendors(vendorsData || []);

      // جلب طرق الشحن
      const { data: methodsData, error: methodsError } = await supabase
        .from('shipping_methods')
        .select(`
          *,
          zone:zone_id(name)
        `)
        .order('name');

      if (methodsError) throw methodsError;
      setMethods(methodsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('فشل في تحميل البيانات. الرجاء المحاولة مرة أخرى.');
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const initialFilters = {
    name: {
      type: 'text',
      label: 'اسم الطريقة',
      placeholder: 'البحث باسم طريقة الشحن',
      value: ''
    },
    zone_id: {
      type: 'select',
      label: 'منطقة الشحن',
      placeholder: 'جميع المناطق',
      options: zones.map(zone => ({
        value: zone.id,
        label: zone.name
      })),
      value: ''
    },
    delivery_type: {
      type: 'select',
      label: 'نوع التوصيل',
      placeholder: 'جميع الأنواع',
      options: [
        { value: 'distance', label: 'حسب المسافة' },
        { value: 'fixed', label: 'سعر ثابت' },
        { value: 'zones', label: 'مناطق' }
      ],
      value: ''
    },
    cost: {
      type: 'number',
      label: 'التكلفة',
      placeholder: 'البحث بالتكلفة',
      min: 0,
      value: ''
    }
  };

  const { filters, filterData, handleFilterChange } = useFilters(initialFilters);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // التحقق من البيانات المطلوبة
      if (!formData.name || formData.cost === '') {
        toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
        return;
      }

      // التحقق من صحة الحد الأدنى والأقصى
      if (formData.min_amount !== null && formData.max_amount !== null) {
        if (parseFloat(formData.min_amount) > parseFloat(formData.max_amount)) {
          toast.error('الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى');
          return;
        }
      }

      // تحضير الإعدادات حسب نوع التوصيل
      let settings = {};
      if (formData.delivery_type === 'distance') {
        settings = formData.settings.distance;
      } else if (formData.delivery_type === 'fixed') {
        settings = formData.settings.fixed;
      } else if (formData.delivery_type === 'zones') {
        settings = formData.settings.zones;
      } else if (formData.delivery_type === 'service_areas') {
        settings = formData.settings.service_areas;
      }

      // تحضير بيانات طريقة الشحن
      const methodData = {
        name: formData.name,
        zone_id: formData.zone_id || null,
        cost: parseFloat(formData.cost),
        min_amount: formData.min_amount !== '' ? parseFloat(formData.min_amount) : null,
        max_amount: formData.max_amount !== '' ? parseFloat(formData.max_amount) : null,
        delivery_type: formData.delivery_type,
        settings: settings
      };

      if (editingMethod) {
        // تحديث طريقة شحن موجودة
        const { error } = await supabase
          .from('shipping_methods')
          .update(methodData)
          .eq('id', editingMethod.id);

        if (error) throw error;
        toast.success('تم تحديث طريقة الشحن بنجاح');
      } else {
        // إضافة طريقة شحن جديدة
        const { error } = await supabase
          .from('shipping_methods')
          .insert([methodData]);

        if (error) throw error;
        toast.success('تم إضافة طريقة الشحن بنجاح');
      }

      // إعادة تحميل البيانات
      fetchData();

      // إغلاق النموذج وإعادة تعيين البيانات
      setShowModal(false);
      setEditingMethod(null);
      setFormData({
        name: '',
        zone_id: '',
        cost: 0,
        min_amount: null,
        max_amount: null,
        delivery_type: 'distance',
        settings: {
          distance: {
            min_distance: 1,
            max_distance: 20,
            base_fee: 5,
            price_per_km: 2
          },
          fixed: {
            fixed_price: 10
          },
          zones: {
            zones: [
              { name: 'المنطقة أ', price: 10 },
              { name: 'المنطقة ب', price: 15 },
              { name: 'المنطقة ج', price: 20 }
            ]
          }
        }
      });
    } catch (error) {
      console.error('Error saving shipping method:', error);
      toast.error(editingMethod ? 'فشل في تحديث طريقة الشحن' : 'فشل في إضافة طريقة الشحن');
    }
  };

  const handleZoneSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!zoneForm.name.trim()) {
        toast.error('الرجاء إدخال اسم المنطقة');
        return;
      }

      if (editingZone) {
        // تحديث منطقة شحن موجودة
        await updateShippingZone(editingZone.id, {
          name: zoneForm.name
        });
        
        toast.success('تم تحديث منطقة الشحن بنجاح');
      } else {
        // إضافة منطقة شحن جديدة
        await createShippingZone({
          name: zoneForm.name,
          vendor_id: zoneForm.vendor_id || null
        });
        
        toast.success('تم إضافة منطقة الشحن بنجاح');
      }

      // إعادة تحميل البيانات
      fetchData();

      // إغلاق النموذج وإعادة تعيين البيانات
      setShowZoneModal(false);
      setEditingZone(null);
      setZoneForm({
        name: '',
        vendor_id: null
      });
    } catch (error) {
      console.error('Error saving shipping zone:', error);
      toast.error(editingZone ? 'فشل في تحديث منطقة الشحن' : 'فشل في إضافة منطقة الشحن');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف طريقة الشحن هذه؟')) return;

    try {
      const { error } = await supabase
        .from('shipping_methods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف طريقة الشحن بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error deleting shipping method:', error);
      toast.error('فشل في حذف طريقة الشحن');
    }
  };

  const handleDeleteZone = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف منطقة الشحن هذه؟ سيتم حذف جميع طرق الشحن المرتبطة بها.')) return;

    try {
      await deleteShippingZone(id);
      toast.success('تم حذف منطقة الشحن بنجاح');
      fetchData();
    } catch (error) {
      console.error('Error deleting shipping zone:', error);
      toast.error('فشل في حذف منطقة الشحن');
    }
  };

  const getDeliveryTypeText = (type) => {
    switch (type) {
      case 'distance': return 'حسب المسافة';
      case 'fixed': return 'سعر ثابت';
      case 'zones': return 'مناطق';
      case 'service_areas': return 'مناطق الخدمة';
      default: return type;
    }
  };

  const filteredMethods = filterData(methods);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-800">
        <h3 className="text-lg font-semibold mb-2">خطأ</h3>
        <p>{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">طرق التوصيل</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingZone(null);
              setZoneForm({
                name: '',
                vendor_id: null
              });
              setShowZoneModal(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            إضافة منطقة شحن
          </button>
          <button
            onClick={() => {
              setEditingMethod(null);
              setFormData({
                name: '',
                zone_id: '',
                cost: 0,
                min_amount: null,
                max_amount: null,
                delivery_type: 'distance',
                settings: {
                  distance: {
                    min_distance: 1,
                    max_distance: 20,
                    base_fee: 5,
                    price_per_km: 2
                  },
                  fixed: {
                    fixed_price: 10
                  },
                  zones: {
                    zones: [
                      { name: 'المنطقة أ', price: 10 },
                      { name: 'المنطقة ب', price: 15 },
                      { name: 'المنطقة ج', price: 20 }
                    ]
                  }
                }
              });
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            إضافة طريقة توصيل
          </button>
        </div>
      </div>

      {/* مناطق الشحن */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">مناطق الشحن</h3>
          <div className="text-sm text-blue-600">هذه المناطق هي التي يتم توصيل الطلبات إليها</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {zones.length === 0 ? (
            <div className="col-span-full text-center py-4 text-gray-500">
              لا توجد مناطق شحن. قم بإضافة منطقة شحن جديدة.
            </div>
          ) : (
            zones.map(zone => (
              <div key={zone.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">{zone.name}</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingZone(zone);
                        setZoneForm({
                          name: zone.name,
                          vendor_id: zone.vendor_id
                        });
                        setShowZoneModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 ml-2"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDeleteZone(zone.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      حذف
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {methods.filter(m => m.zone_id === zone.id).length} طريقة توصيل
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <SearchFilter 
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم الطريقة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نوع التوصيل</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">منطقة الشحن</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التكلفة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحد الأدنى للطلب</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحد الأقصى للطلب</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإعدادات</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMethods.length === 0 ? (
                <tr>
                  <td colSpan="8\" className="px-6 py-4 text-center text-gray-500">
                    لا توجد طرق شحن متطابقة مع معايير البحث
                  </td>
                </tr>
              ) : (
                filteredMethods.map(method => (
                  <tr key={method.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{method.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getDeliveryTypeText(method.delivery_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {method.zone?.name || 'جميع المناطق'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ₪{method.cost}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {method.min_amount !== null ? `₪${method.min_amount}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {method.max_amount !== null ? `₪${method.max_amount}` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {method.delivery_type === 'distance' && method.settings && (
                        <div className="text-sm">
                          <div>السعر الأساسي: ₪{method.settings.base_fee}</div>
                          <div>سعر الكيلومتر: ₪{method.settings.price_per_km}</div>
                          <div>نطاق التوصيل: {method.settings.min_distance} - {method.settings.max_distance} كم</div>
                        </div>
                      )}
                      {method.delivery_type === 'fixed' && method.settings && (
                        <div className="text-sm">
                          <div>السعر الثابت: ₪{method.settings.fixed_price}</div>
                        </div>
                      )}
                      {method.delivery_type === 'zones' && method.settings && method.settings.zones && (
                        <div className="text-sm">
                          {Array.isArray(method.settings.zones) ? method.settings.zones.map((zone, index) => (
                            <div key={index}>{zone.name}: ₪{zone.price}</div>
                          )) : method.settings.zones?.zones?.map((zone, index) => (
                            <div key={index}>{zone.name}: ₪{zone.price}</div>
                          ))}
                        </div>
                      )}
                      {method.delivery_type === 'service_areas' && method.settings && (
                        <div className="text-sm">
                          {method.settings.use_vendor_areas ? (
                            <div className="text-green-600 font-medium">استخدام مناطق البائع</div>
                          ) : (
                            <div>
                              {method.settings.selected_areas?.length > 0 ? (
                                <div>{method.settings.selected_areas.length} منطقة محددة</div>
                              ) : (
                                <div className="text-gray-500">لا توجد مناطق محددة</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setEditingMethod(method);
                          setFormData({
                            name: method.name,
                            zone_id: method.zone_id || '',
                            cost: method.cost,
                            min_amount: method.min_amount,
                            max_amount: method.max_amount,
                            delivery_type: method.delivery_type || 'distance',
                            settings: {
                              distance: method.delivery_type === 'distance' ? method.settings : {
                                min_distance: 1,
                                max_distance: 20,
                                base_fee: 5,
                                price_per_km: 2
                              },
                              fixed: method.delivery_type === 'fixed' ? method.settings : {
                                fixed_price: 10
                              },
                              zones: method.delivery_type === 'zones' ? method.settings : {
                                zones: [
                                  { name: 'المنطقة أ', price: 10 },
                                  { name: 'المنطقة ب', price: 15 },
                                  { name: 'المنطقة ج', price: 20 }
                                ]
                              },
                              service_areas: method.delivery_type === 'service_areas' ? method.settings : {
                                use_vendor_areas: true,
                                selected_areas: []
                              }
                            }
                          });
                          setShowModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 ml-2"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(method.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipping Method Modal */}
      <Dialog
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingMethod(null);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-3xl w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              {editingMethod ? 'تعديل طريقة التوصيل' : 'إضافة طريقة توصيل جديدة'}
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اسم الطريقة <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    منطقة الشحن
                  </label>
                  <select
                    value={formData.zone_id}
                    onChange={(e) => setFormData({ ...formData, zone_id: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">جميع المناطق</option>
                    {zones.map(zone => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نوع التوصيل <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.delivery_type}
                    onChange={(e) => setFormData({ ...formData, delivery_type: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    <option value="distance">حسب المسافة</option>
                    <option value="fixed">سعر ثابت</option>
                    <option value="zones">مناطق</option>
                    <option value="service_areas">مناطق الخدمة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    التكلفة (₪) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الحد الأدنى للطلب (₪)
                  </label>
                  <input
                    type="number"
                    value={formData.min_amount !== null ? formData.min_amount : ''}
                    onChange={(e) => setFormData({ ...formData, min_amount: e.target.value === '' ? null : e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    min="0"
                    step="0.01"
                    placeholder="اتركه فارغاً إذا لم يكن هناك حد أدنى"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الحد الأقصى للطلب (₪)
                  </label>
                  <input
                    type="number"
                    value={formData.max_amount !== null ? formData.max_amount : ''}
                    onChange={(e) => setFormData({ ...formData, max_amount: e.target.value === '' ? null : e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                    min="0"
                    step="0.01"
                    placeholder="اتركه فارغاً إذا لم يكن هناك حد أقصى"
                  />
                </div>
              </div>

              {/* إعدادات حسب نوع التوصيل */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">إعدادات {getDeliveryTypeText(formData.delivery_type)}</h3>
                
                {formData.delivery_type === 'distance' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        السعر الأساسي (₪)
                      </label>
                      <input
                        type="number"
                        value={formData.settings.distance.base_fee}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            distance: {
                              ...formData.settings.distance,
                              base_fee: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full border rounded-md px-3 py-2"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        سعر الكيلومتر (₪)
                      </label>
                      <input
                        type="number"
                        value={formData.settings.distance.price_per_km}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            distance: {
                              ...formData.settings.distance,
                              price_per_km: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full border rounded-md px-3 py-2"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الحد الأدنى للمسافة (كم)
                      </label>
                      <input
                        type="number"
                        value={formData.settings.distance.min_distance}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            distance: {
                              ...formData.settings.distance,
                              min_distance: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full border rounded-md px-3 py-2"
                        min="0"
                        step="0.1"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الحد الأقصى للمسافة (كم)
                      </label>
                      <input
                        type="number"
                        value={formData.settings.distance.max_distance}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            distance: {
                              ...formData.settings.distance,
                              max_distance: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full border rounded-md px-3 py-2"
                        min="0"
                        step="0.1"
                      />
                    </div>
                  </div>
                )}
                
                {formData.delivery_type === 'fixed' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      السعر الثابت (₪)
                    </label>
                    <input
                      type="number"
                      value={formData.settings.fixed.fixed_price}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          fixed: {
                            fixed_price: parseFloat(e.target.value)
                          }
                        }
                      
                      })}
                      className="w-full border rounded-md px-3 py-2"
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}
                
                {formData.delivery_type === 'zones' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      المناطق
                    </label>
                    <div className="space-y-2">
                      {formData.settings.zones.zones.map((zone, index) => (
                        <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1 grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                اسم المنطقة
                              </label>
                              <input
                                type="text"
                                value={zone.name}
                                onChange={(e) => {
                                  const newZones = [...formData.settings.zones.zones];
                                  newZones[index] = { ...zone, name: e.target.value };
                                  setFormData({
                                    ...formData,
                                    settings: {
                                      ...formData.settings,
                                      zones: {
                                        zones: newZones
                                      }
                                    }
                                  });
                                }}
                                className="w-full border rounded-md px-3 py-1.5"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                السعر (₪)
                              </label>
                              <input
                                type="number"
                                value={zone.price}
                                onChange={(e) => {
                                  const newZones = [...formData.settings.zones.zones];
                                  newZones[index] = { ...zone, price: parseFloat(e.target.value) };
                                  setFormData({
                                    ...formData,
                                    settings: {
                                      ...formData.settings,
                                      zones: {
                                        zones: newZones
                                      }
                                    }
                                  });
                                }}
                                className="w-full border rounded-md px-3 py-1.5"
                                min="0"
                                step="0.01"
                              />
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              const newZones = formData.settings.zones.zones.filter((_, i) => i !== index);
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  zones: {
                                    zones: newZones
                                  }
                                }
                              });
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            حذف
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const newZones = [...formData.settings.zones.zones, { name: '', price: 0 }];
                          setFormData({
                            ...formData,
                            settings: {
                              ...formData.settings,
                              zones: {
                                zones: newZones
                              }
                            }
                          });
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        إضافة منطقة
                      </button>
                    </div>
                  </div>
                )}

                {formData.delivery_type === 'service_areas' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        نوع التوصيل هذا يستخدم مناطق الخدمة المحددة للبائع في صفحة "مناطق الخدمة".
                        سيتم احتساب سعر التوصيل حسب المنطقة الفرعية التي يختارها العميل.
                      </p>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="use_vendor_areas"
                        checked={formData.settings.service_areas.use_vendor_areas}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            service_areas: {
                              ...formData.settings.service_areas,
                              use_vendor_areas: e.target.checked
                            }
                          }
                        })}
                        className="ml-2"
                      />
                      <label htmlFor="use_vendor_areas" className="text-sm font-medium text-gray-700">
                        استخدام مناطق البائع تلقائياً
                      </label>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm text-green-800">
                          <p className="font-medium mb-1">كيفية العمل:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>سيظهر للعميل المناطق الفرعية التي يخدمها البائع</li>
                            <li>كل منطقة لها سعر توصيل خاص</li>
                            <li>يختار العميل منطقته ويتم احتساب السعر تلقائياً</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingMethod(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingMethod ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>

      {/* Zone Modal */}
      <Dialog
        open={showZoneModal}
        onClose={() => {
          setShowZoneModal(false);
          setEditingZone(null);
        }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <Dialog.Title className="text-2xl font-bold mb-6">
              {editingZone ? 'تعديل منطقة الشحن' : 'إضافة منطقة شحن جديدة'}
            </Dialog.Title>

            <form onSubmit={handleZoneSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم المنطقة <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  أمثلة: غزة، رام الله، نابلس، رفح، الخليل، بيت لحم
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowZoneModal(false);
                    setEditingZone(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingZone ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>
    </div>
  );
}