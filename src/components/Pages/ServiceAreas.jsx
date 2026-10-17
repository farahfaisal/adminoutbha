import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, MapPin, ChevronDown, ChevronLeft } from 'lucide-react';

export default function ServiceAreas() {
  const [serviceAreas, setServiceAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [expandedCities, setExpandedCities] = useState({});
  const [ordersByCity, setOrdersByCity] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    delivery_price: '',
    is_active: true,
    parent_id: null
  });

  useEffect(() => {
    fetchServiceAreas();
    fetchOrdersByCity();
  }, []);

  const fetchOrdersByCity = async () => {
    try {
      setLoadingOrders(true);
      const { data, error } = await supabase
        .from('orders')
        .select('city, service_area_id, service_area:service_areas(name, city)')
        .not('city', 'is', null);

      if (error) throw error;

      const cityStats = {};
      data?.forEach(order => {
        const city = order.city || 'غير محدد';
        if (!cityStats[city]) {
          cityStats[city] = {
            city: city,
            count: 0,
            serviceAreaName: order.service_area?.name || 'غير محدد'
          };
        }
        cityStats[city].count++;
      });

      const sortedStats = Object.values(cityStats).sort((a, b) => b.count - a.count);
      setOrdersByCity(sortedStats);
    } catch (error) {
      console.error('Error fetching orders by city:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchServiceAreas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_areas')
        .select('*')
        .order('city', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setServiceAreas(data || []);

      const cities = {};
      data?.forEach(area => {
        if (!area.parent_id) {
          cities[area.city] = true;
        }
      });
      setExpandedCities(cities);
    } catch (error) {
      console.error('Error fetching service areas:', error);
      if (error.message?.includes('does not exist')) {
        toast.error('جدول مناطق الخدمة غير موجود. يرجى تطبيق الـ migration من SQL Editor في Supabase');
      } else {
        toast.error('فشل تحميل مناطق الخدمة: ' + (error.message || 'خطأ غير معروف'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.delivery_price) {
      toast.error('الرجاء ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const dataToSave = {
        name: formData.name,
        city: formData.parent_id ? formData.city : formData.name,
        delivery_price: parseFloat(formData.delivery_price),
        is_active: formData.is_active,
        parent_id: formData.parent_id || null
      };

      if (editingArea) {
        const { error } = await supabase
          .from('service_areas')
          .update(dataToSave)
          .eq('id', editingArea.id);

        if (error) throw error;
        toast.success('تم تحديث المنطقة بنجاح');
      } else {
        const { error } = await supabase
          .from('service_areas')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('تم إضافة المنطقة بنجاح');
      }

      setShowModal(false);
      setEditingArea(null);
      setFormData({ name: '', city: '', delivery_price: '', is_active: true, parent_id: null });
      fetchServiceAreas();
      fetchOrdersByCity();
    } catch (error) {
      console.error('Error saving service area:', error);
      toast.error('فشل حفظ المنطقة');
    }
  };

  const handleEdit = (area) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      city: area.city,
      delivery_price: area.delivery_price,
      is_active: area.is_active,
      parent_id: area.parent_id
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المنطقة؟ سيتم حذف جميع المناطق الفرعية أيضاً.')) return;

    try {
      const { data, error } = await supabase
        .from('service_areas')
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      toast.success('تم حذف المنطقة بنجاح');
      fetchServiceAreas();
      fetchOrdersByCity();
    } catch (error) {
      console.error('Error deleting service area:', error);
      const errorMessage = error.message || error.hint || 'حدث خطأ غير معروف';
      toast.error('فشل حذف المنطقة: ' + errorMessage);
    }
  };

  const toggleCity = (city) => {
    setExpandedCities(prev => ({
      ...prev,
      [city]: !prev[city]
    }));
  };

  const mainAreas = serviceAreas.filter(area => !area.parent_id);
  const subAreas = serviceAreas.filter(area => area.parent_id);

  const getSubAreasForParent = (parentId) => {
    return subAreas.filter(area => area.parent_id === parentId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مناطق الخدمة</h1>
          <p className="text-gray-600 mt-1">إدارة المناطق الرئيسية والفرعية مع أسعار التوصيل</p>
        </div>
        <button
          onClick={() => {
            setEditingArea(null);
            setFormData({ name: '', city: '', delivery_price: '', is_active: true, parent_id: null });
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          إضافة منطقة
        </button>
      </div>

      <div className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-blue-600" />
          إحصائيات الطلبات حسب المدينة
        </h2>

        {loadingOrders ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : ordersByCity.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg">
            <p className="text-gray-500">لا توجد طلبات بعد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg shadow">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="px-6 py-3 text-right text-sm font-semibold">المدينة</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">منطقة الخدمة</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">عدد الطلبات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ordersByCity.map((stat, index) => (
                  <tr
                    key={index}
                    className="hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-gray-900">{stat.city}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {stat.serviceAreaName}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {stat.count} طلب
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mainAreas.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">لا توجد مناطق خدمة</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mainAreas.map((mainArea) => {
            const subAreasForMain = getSubAreasForParent(mainArea.id);
            const isExpanded = expandedCities[mainArea.city];

            return (
              <div key={mainArea.id} className="bg-white rounded-lg shadow">
                <div
                  className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b cursor-pointer hover:from-blue-100 hover:to-blue-150 transition-colors"
                  onClick={() => toggleCity(mainArea.city)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-blue-600" />
                      ) : (
                        <ChevronLeft className="w-5 h-5 text-blue-600" />
                      )}
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{mainArea.name}</h2>
                        <p className="text-sm text-gray-600">{subAreasForMain.length} منطقة فرعية</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <div className="text-2xl font-bold text-blue-600">
                          ₪{mainArea.delivery_price}
                        </div>
                        <p className="text-xs text-gray-500">السعر الافتراضي</p>
                      </div>
                      <span className={`px-3 py-1 text-sm rounded-full ${
                        mainArea.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {mainArea.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleEdit(mainArea)}
                          className="p-2 bg-white text-blue-600 rounded hover:bg-blue-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mainArea.id)}
                          className="p-2 bg-white text-red-600 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-700">المناطق الفرعية</h3>
                      <button
                        onClick={() => {
                          setEditingArea(null);
                          setFormData({
                            name: '',
                            city: mainArea.city,
                            delivery_price: mainArea.delivery_price,
                            is_active: true,
                            parent_id: mainArea.id
                          });
                          setShowModal(true);
                        }}
                        className="flex items-center gap-2 text-sm bg-blue-50 text-blue-600 px-3 py-2 rounded hover:bg-blue-100"
                      >
                        <Plus className="w-4 h-4" />
                        إضافة منطقة فرعية
                      </button>
                    </div>

                    {subAreasForMain.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">لا توجد مناطق فرعية</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subAreasForMain.map((subArea) => (
                          <div
                            key={subArea.id}
                            className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900">{subArea.name}</h4>
                              </div>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                subArea.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {subArea.is_active ? 'نشط' : 'غير نشط'}
                              </span>
                            </div>

                            <div className="mb-4">
                              <div className="text-2xl font-bold text-blue-600">
                                ₪{subArea.delivery_price}
                              </div>
                              <p className="text-xs text-gray-500">سعر التوصيل</p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(subArea)}
                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                              >
                                <Edit2 className="w-4 h-4" />
                                تعديل
                              </button>
                              <button
                                onClick={() => handleDelete(subArea.id)}
                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100"
                              >
                                <Trash2 className="w-4 h-4" />
                                حذف
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              {editingArea
                ? 'تعديل المنطقة'
                : formData.parent_id
                  ? 'إضافة منطقة فرعية'
                  : 'إضافة منطقة رئيسية'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.parent_id ? 'اسم المنطقة الفرعية' : 'اسم المنطقة الرئيسية'} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder={formData.parent_id ? "مثال: المركز، البلدة القديمة" : "مثال: القدس، رام الله"}
                  required
                />
              </div>

              {formData.parent_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>المنطقة الرئيسية:</strong> {formData.city}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  سعر التوصيل (₪) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.delivery_price}
                  onChange={(e) => setFormData({ ...formData, delivery_price: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="10.00"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="ml-2"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  منطقة نشطة
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingArea(null);
                    setFormData({ name: '', city: '', delivery_price: '', is_active: true, parent_id: null });
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingArea ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
