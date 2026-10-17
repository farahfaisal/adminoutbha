import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  getServiceAreaManagers,
  createServiceAreaManager,
  updateServiceAreaManager,
  deleteServiceAreaManager
} from '../../lib/serviceAreaManagersApi';
import { supabase } from '../../lib/supabase';
import { UserCircle, MapPin, Phone, Mail, Plus, Edit, Trash2, X } from 'lucide-react';

export default function ServiceAreaManagers() {
  const [managers, setManagers] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingManager, setEditingManager] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    status: 'active',
    service_area_ids: []
  });

  useEffect(() => {
    fetchManagers();
    fetchServiceAreas();
  }, []);

  const fetchManagers = async () => {
    setLoading(true);
    const data = await getServiceAreaManagers();
    setManagers(data);
    setLoading(false);
  };

  const fetchServiceAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('service_areas')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setServiceAreas(data || []);
    } catch (error) {
      console.error('Error fetching service areas:', error);
      toast.error('فشل في جلب مناطق الخدمة');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }

    if (!editingManager && !formData.password) {
      toast.error('الرجاء إدخال كلمة المرور');
      return;
    }

    try {
      const managerData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        status: formData.status
      };

      if (formData.password) {
        managerData.password_hash = formData.password;
      }

      if (editingManager) {
        await updateServiceAreaManager(editingManager.id, managerData, formData.service_area_ids);
      } else {
        await createServiceAreaManager(managerData, formData.service_area_ids);
      }

      setShowModal(false);
      setEditingManager(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        status: 'active',
        service_area_ids: []
      });
      fetchManagers();
    } catch (error) {
      console.error('Error saving manager:', error);
    }
  };

  const handleEdit = (manager) => {
    setEditingManager(manager);
    setFormData({
      name: manager.name,
      email: manager.email,
      phone: manager.phone || '',
      password: '',
      status: manager.status,
      service_area_ids: manager.assignments?.map(a => a.service_area_id) || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المسؤول؟')) return;

    const success = await deleteServiceAreaManager(id);
    if (success) {
      fetchManagers();
    }
  };

  const handleServiceAreaToggle = (areaId) => {
    setFormData(prev => ({
      ...prev,
      service_area_ids: prev.service_area_ids.includes(areaId)
        ? prev.service_area_ids.filter(id => id !== areaId)
        : [...prev.service_area_ids, areaId]
    }));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">مسؤولو مناطق الخدمة</h1>
        <button
          onClick={() => {
            setEditingManager(null);
            setFormData({
              name: '',
              email: '',
              phone: '',
              password: '',
              status: 'active',
              service_area_ids: []
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة مسؤول جديد
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : managers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">لا يوجد مسؤولون</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {managers.map((manager) => (
            <div key={manager.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{manager.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      manager.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {manager.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(manager)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(manager.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>{manager.email}</span>
                </div>
                {manager.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{manager.phone}</span>
                  </div>
                )}
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium">المناطق المسندة:</span>
                  </div>
                  {manager.assignments && manager.assignments.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {manager.assignments.map((assignment) => (
                        <span
                          key={assignment.id}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                        >
                          {assignment.service_area?.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">لا توجد مناطق مسندة</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingManager ? 'تعديل مسؤول منطقة' : 'إضافة مسؤول منطقة جديد'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الاسم *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  البريد الإلكتروني *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كلمة المرور {!editingManager && '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required={!editingManager}
                  placeholder={editingManager ? 'اتركه فارغاً للإبقاء على كلمة المرور الحالية' : ''}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحالة
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المناطق المسندة
                </label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  {serviceAreas.length === 0 ? (
                    <p className="text-gray-500 text-sm">لا توجد مناطق خدمة متاحة</p>
                  ) : (
                    <div className="space-y-2">
                      {serviceAreas.map((area) => (
                        <label
                          key={area.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={formData.service_area_ids.includes(area.id)}
                            onChange={() => handleServiceAreaToggle(area.id)}
                            className="w-4 h-4"
                          />
                          <span>{area.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingManager ? 'تحديث' : 'إضافة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
