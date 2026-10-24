import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import VendorFormWizard from '../Vendors/VendorFormWizard';

export default function AddVendor() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);

      // التحقق من البيانات المطلوبة
      if (!formData.store_name || !formData.phone) {
        toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
        setLoading(false);
        return;
      }

      // التحقق من عدم وجود بائع بنفس رقم الهاتف
      const { data: existingVendor } = await supabase
        .from('vendors')
        .select('id, store_name')
        .eq('phone', formData.phone)
        .maybeSingle();

      if (existingVendor) {
        toast.error(`رقم الهاتف مستخدم بالفعل من قبل المتجر: ${existingVendor.store_name}`);
        setLoading(false);
        return;
      }

      // التحقق من عدم وجود مستخدم بنفس رقم الهاتف في custom_users
      const { data: existingCustomUser } = await supabase
        .from('custom_users')
        .select('id, name, email')
        .eq('phone', formData.phone)
        .maybeSingle();

      if (existingCustomUser) {
        const { data: linkedVendor } = await supabase
          .from('vendors')
          .select('id, store_name')
          .eq('user_id', String(existingCustomUser.id))
          .maybeSingle();

        if (linkedVendor) {
          toast.error(`رقم الهاتف مستخدم بالفعل من قبل المتجر: ${linkedVendor.store_name}`);
        } else {
          toast.error(`يوجد حساب مستخدم بهذا الرقم ولكن بدون متجر مرتبط. يرجى استخدام رقم هاتف آخر أو حذف الحساب المعلق.`);
        }
        setLoading(false);
        return;
      }

      // Generate username from store name
      let baseUsername = formData.store_name
        .replace(/\s+/g, '_')
        .slice(0, 20);

      // التعامل مع البريد الإلكتروني
      let emailToUse = formData.email;

      if (emailToUse) {
        // التحقق من عدم وجود بريد إلكتروني مكرر
        const { data: existingEmail } = await supabase
          .from('custom_users')
          .select('id, name')
          .eq('email', emailToUse)
          .maybeSingle();

        if (existingEmail) {
          toast.error(`البريد الإلكتروني مستخدم بالفعل. يرجى استخدام بريد إلكتروني آخر أو تركه فارغًا.`);
          setLoading(false);
          return;
        }
      } else {
        // إنشاء بريد إلكتروني فريد باستخدام رقم الهاتف
        emailToUse = `vendor.${formData.phone.replace(/\D/g, '')}@alzaeem.com`;
      }

      const userData = {
        username: baseUsername.toLowerCase(),
        password: formData.password || 'password123',
        name: formData.store_name,
        email: emailToUse,
        phone: formData.phone,
        role: 'vendor'
      };

      // إنشاء مستخدم مخصص جديد
      const userId = await addCustomUser(userData);

      if (!userId) {
        throw new Error('فشل في إنشاء المستخدم المخصص');
      }

      formData.email = emailToUse;

      // إنشاء بائع جديد — only insert columns that exist in the vendors table
      const vendorInsert = {
        user_id: String(userId),
        store_name: formData.store_name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        description: formData.description,
        latitude: formData.latitude,
        longitude: formData.longitude,
        status: formData.status || 'active',
        logo_url: formData.logo_url,
        banner_url: formData.banner_url,
        commission_rate: formData.commission_rate || 10,
        wallet_enabled: formData.wallet_enabled || false,
        main_service_area_id: formData.main_service_area_id || null,
        service_areas: formData.service_areas || []
      };

      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .insert([vendorInsert])
        .select();
      
      if (vendorError) throw vendorError;
      
      const vendorId = vendorData[0].id;

      // ربط البائع بالتصنيفات — vendor_categories has no category_id column;
      // each row is a category belonging to this vendor (name, image_url, etc.)
      // Categories from the form are top-level category IDs, which map to the
      // vendors.category_id column instead.
      if (formData.categories && formData.categories.length > 0) {
        const { error: catError } = await supabase
          .from('vendors')
          .update({ category_id: formData.categories[0] })
          .eq('id', vendorId);

        if (catError) {
          console.error('Error linking category:', catError);
        }
      }

      // حفظ مناطق الخدمة
      if (formData.vendor_service_areas && formData.vendor_service_areas.length > 0) {
        const serviceAreasData = formData.vendor_service_areas.map(area => ({
          vendor_id: vendorId,
          service_area_id: area.service_area_id,
          custom_delivery_price: area.custom_delivery_price
        }));

        const { error: serviceAreasError } = await supabase
          .from('vendor_service_areas')
          .insert(serviceAreasData);

        if (serviceAreasError) {
          console.error('Error linking service areas:', serviceAreasError);
        }
      }

      toast.success('تم إضافة البائع بنجاح');
      
      // إعادة تعيين النموذج (سيتم التعامل معه في المكون الأب)
    } catch (error) {
      console.error('Error adding vendor:', error);

      let errorMessage = 'فشل في إضافة البائع';

      if (error.message) {
        const msg = error.message;
        if (msg.includes('duplicate key') || msg.includes('مستخدم بالفعل')) {
          if (msg.includes('email') || msg.includes('بريد')) {
            errorMessage = 'البريد الإلكتروني مستخدم بالفعل. يرجى استخدام بريد آخر أو تركه فارغًا.';
          } else if (msg.includes('phone') || msg.includes('هاتف')) {
            errorMessage = 'رقم الهاتف مستخدم بالفعل.';
          } else if (msg.includes('username') || msg.includes('اسم المستخدم')) {
            errorMessage = 'اسم المستخدم مستخدم بالفعل.';
          } else {
            errorMessage = msg;
          }
        } else {
          errorMessage = msg;
        }
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // دالة لإضافة مستخدم مخصص
  const addCustomUser = async (userData) => {
    try {
      let username = userData.username;
      let attempt = 0;

      // Check if username exists
      const { data: existingUser } = await supabase
        .from('custom_users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      // If username exists, add a random suffix
      if (existingUser) {
        attempt++;
        username = `${userData.username}_${Math.floor(Math.random() * 1000)}`;
      }

      userData.username = username;
      
      // استخدام دالة RPC لإضافة مستخدم مخصص
      const { data, error } = await supabase.rpc(
        'add_custom_user',
        {
          p_username: userData.username,
          p_password: userData.password,
          p_name: userData.name,
          p_email: userData.email, // Make sure email is passed to the RPC function
          p_phone: userData.phone,
          p_role: userData.role
        }
      );
      
      if (error) {
        console.error('RPC Error:', error);
        throw new Error(error.message || 'فشل في إنشاء المستخدم');
      }
      
      return data;
    } catch (error) {
      console.error('Error adding custom user:', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">إضافة بائع جديد</h2>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <VendorFormWizard onSubmit={handleSubmit} loading={loading} />
      </div>
      
      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          ملاحظات هامة
        </h3>
        <ul className="list-disc list-inside space-y-2 text-blue-700">
          <li>سيتم إنشاء حساب مستخدم مخصص للبائع تلقائيًا</li>
          <li>كلمة المرور الافتراضية هي "password123" ويجب تغييرها بعد الإنشاء</li>
          <li><strong>البريد الإلكتروني اختياري:</strong> إذا لم تقم بإدخاله، سيتم إنشاء بريد إلكتروني تلقائيًا باستخدام رقم الهاتف</li>
          <li><strong>رقم الهاتف يجب أن يكون فريدًا:</strong> تأكد من عدم استخدام نفس رقم الهاتف لأكثر من بائع</li>
          <li>تأكد من تحديد موقع المتجر بدقة على الخريطة لضمان دقة حسابات التوصيل</li>
          <li>اختر مناطق الخدمة المناسبة للبائع لتحديد نطاق التوصيل</li>
          <li>يمكن للبائع تحديث بياناته لاحقًا من خلال لوحة التحكم</li>
        </ul>
      </div>
    </div>
  );
}