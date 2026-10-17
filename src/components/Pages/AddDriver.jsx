import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export default function AddDriver() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    username: '',
    email: '',
    password: '',
    status: 'offline',
    vehicle_type: 'motorcycle',
    vehicle_plate: '',
    service_area_id: ''
  });
  const [serviceAreas, setServiceAreas] = useState([]);

  useEffect(() => {
    const fetchServiceAreas = async () => {
      try {
        const { data, error } = await supabase
          .from('service_areas')
          .select('id, name')
          .order('name');
        if (error) throw error;
        setServiceAreas(data || []);
      } catch (err) {
        console.error('Error fetching service areas:', err);
      }
    };
    fetchServiceAreas();
  }, []);
  
  // قائمة المناطق المتاحة
  const areas = [
    'رام الله', 'البيرة', 'نابلس', 'جنين', 'طولكرم', 'قلقيلية', 'طوباس', 'سلفيت', 'أريحا', 'بيت لحم', 'الخليل',
    'بيت جالا', 'بيت ساحور', 'بيرزيت', 'الظاهرية', 'دورا', 'يطا', 'عنبتا', 'بيت فجار', 'بديا', 'عزون'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { name, phone, password, username, email: rawEmail } = formData;

      if (!name || !phone || !password || !username) {
        toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        setLoading(false);
        return;
      }

      const userId = uuidv4();
      const driverId = uuidv4();
      const trimmedUsername = username.trim();
      let email = rawEmail?.trim() || `driver_${userId}@temp.local`;

      // إنشاء المستخدم المخصص
      const { error: userError } = await supabase
        .from('custom_users')
        .insert({
          id: userId,
          username: trimmedUsername,
          password: password,
          name: name,
          email: email,
          role: 'driver',
          is_active: true
        });

      if (userError) {
        console.error('User insert error:', userError);
        toast.error('فشل في إنشاء المستخدم: ' + userError.message);
        setLoading(false);
        return;
      }

      // إنشاء السائق
      const driverData = {
        id: driverId,
        user_id: userId,
        name,
        phone,
        email,
        status: formData.status,
        vehicle_type: formData.vehicle_type,
        password: password,
        rating: 5,
        rating_count: 0,
        is_active: true,
        is_available: false
      };

      if (formData.service_area_id) {
        driverData.service_area_id = formData.service_area_id;
      }

      if (formData.vehicle_plate?.trim()) {
        driverData.vehicle_number = formData.vehicle_plate.trim();
      }

      // إنشاء السائق بدون تحديد ON CONFLICT
      const { data: insertedDriverData, error: driverError } = await supabase
        .from('drivers')
        .insert(driverData);

      if (driverError) {
        console.error('Driver insert error:', driverError);
        // حذف المستخدم إذا فشل إدخال السائق
        await supabase.from('custom_users').delete().eq('id', userId);
        toast.error('فشل في إدخال بيانات السائق: ' + driverError.message);
        setLoading(false);
        return;
      }

      toast.success('تمت إضافة السائق بنجاح');

      setFormData({
        name: '',
        phone: '',
        username: '',
        email: '',
        password: '',
        status: 'offline',
        vehicle_type: 'motorcycle',
        vehicle_plate: '',
        service_area_id: ''
      });

    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">إضافة سائق جديد</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الاسم <span className="text-red-600">*</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              رقم الهاتف <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              اسم المستخدم <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              كلمة المرور <span className="text-red-600">*</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              required
            />
            <p className="text-xs text-gray-500 mt-1">يجب أن تكون 6 أحرف على الأقل</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الحالة
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="offline">غير متصل</option>
              <option value="available">متاح</option>
              <option value="busy">مشغول</option>
            </select>
          </div>
          
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-3">منطقة الخدمة</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              منطقة الخدمة المخصصة للسائق
            </label>
            <select
              value={formData.service_area_id}
              onChange={(e) => setFormData({ ...formData, service_area_id: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">-- بدون منطقة محددة (يستقبل كل الطلبات) --</option>
              {serviceAreas.map(area => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">عند تحديد منطقة خدمة، سيستقبل السائق فقط الطلبات الخاصة بهذه المنطقة</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-3">معلومات المركبة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                نوع المركبة
              </label>
              <select
                value={formData.vehicle_type}
                onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="motorcycle">دراجة نارية</option>
                <option value="car">سيارة</option>
                <option value="bicycle">دراجة هوائية</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                رقم اللوحة
              </label>
              <input
                type="text"
                value={formData.vehicle_plate}
                onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? 'جاري الإضافة...' : 'إضافة السائق'}
        </button>
      </form>
    </div>
  );
}