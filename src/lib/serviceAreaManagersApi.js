import { supabase } from './supabase';
import { toast } from 'react-toastify';

export const getServiceAreaManagers = async () => {
  try {
    const { data, error } = await supabase
      .from('service_area_managers')
      .select(`
        *,
        assignments:service_area_manager_assignments(
          id,
          service_area_id,
          service_area:service_areas(id, name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching service area managers:', error);
    toast.error('فشل في جلب مسؤولي المناطق');
    return [];
  }
};

export const getServiceAreaManager = async (id) => {
  try {
    const { data, error } = await supabase
      .from('service_area_managers')
      .select(`
        *,
        assignments:service_area_manager_assignments(
          id,
          service_area_id,
          service_area:service_areas(id, name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching service area manager:', error);
    toast.error('فشل في جلب بيانات المسؤول');
    return null;
  }
};

export const createServiceAreaManager = async (managerData, serviceAreaIds = []) => {
  try {
    // إنشاء سجل المسؤول مباشرة
    const { data: manager, error: createError } = await supabase
      .from('service_area_managers')
      .insert({
        name: managerData.name,
        email: managerData.email,
        phone: managerData.phone,
        password_hash: managerData.password_hash,
        status: managerData.status || 'active'
      })
      .select()
      .single();

    if (createError) throw createError;

    // ربط المسؤول بمناطق الخدمة
    if (serviceAreaIds && serviceAreaIds.length > 0) {
      const assignments = serviceAreaIds.map(areaId => ({
        manager_id: manager.id,
        service_area_id: areaId
      }));

      const { error: assignError } = await supabase
        .from('service_area_manager_assignments')
        .insert(assignments);

      if (assignError) {
        console.error('Error creating assignments:', assignError);
      }
    }

    toast.success('تم إنشاء المسؤول بنجاح');
    return manager;
  } catch (error) {
    console.error('Error creating service area manager:', error);
    toast.error('فشل في إنشاء المسؤول: ' + error.message);
    throw error;
  }
};

export const updateServiceAreaManager = async (id, managerData, serviceAreaIds = []) => {
  try {
    const { data: manager, error: updateError } = await supabase
      .from('service_area_managers')
      .update({
        name: managerData.name,
        email: managerData.email,
        phone: managerData.phone,
        status: managerData.status
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    const { error: deleteError } = await supabase
      .from('service_area_manager_assignments')
      .delete()
      .eq('manager_id', id);

    if (deleteError) throw deleteError;

    if (serviceAreaIds.length > 0) {
      const assignments = serviceAreaIds.map(areaId => ({
        manager_id: id,
        service_area_id: areaId
      }));

      const { error: assignError } = await supabase
        .from('service_area_manager_assignments')
        .insert(assignments);

      if (assignError) throw assignError;
    }

    toast.success('تم تحديث المسؤول بنجاح');
    return manager;
  } catch (error) {
    console.error('Error updating service area manager:', error);
    toast.error('فشل في تحديث المسؤول: ' + error.message);
    throw error;
  }
};

export const deleteServiceAreaManager = async (id) => {
  try {
    const { error } = await supabase
      .from('service_area_managers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    toast.success('تم حذف المسؤول بنجاح');
    return true;
  } catch (error) {
    console.error('Error deleting service area manager:', error);
    toast.error('فشل في حذف المسؤول: ' + error.message);
    return false;
  }
};

export const getCurrentManagerServiceAreas = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('service_area_managers')
      .select(`
        id,
        assignments:service_area_manager_assignments(
          service_area_id,
          service_area:service_areas(id, name)
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return [];
      throw error;
    }

    return data?.assignments?.map(a => a.service_area) || [];
  } catch (error) {
    console.error('Error fetching current manager service areas:', error);
    return [];
  }
};

export const isServiceAreaManager = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('service_area_managers')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking service area manager status:', error);
    return false;
  }
};
