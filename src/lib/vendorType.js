import { supabase } from './supabase';

/**
 * تطبيق الزبون يعرض المتاجر حسب عمود vendors.type (مثل "مطاعم" أو "ماركت").
 * التصنيف المختار في نموذج البائع هو معرّف من vendor_categories_table،
 * فنحوّله إلى اسمه ونحفظه في type.
 * @param {string[]} categoryIds
 * @returns {Promise<string|null>}
 */
export async function resolveVendorType(categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return null;
  const { data, error } = await supabase
    .from('vendor_categories_table')
    .select('id, name')
    .in('id', categoryIds);
  if (error || !data || data.length === 0) {
    if (error) console.error('Error resolving vendor type:', error);
    return null;
  }
  // نحافظ على ترتيب الاختيار: أول تصنيف مختار هو نوع المتجر
  const first = categoryIds.map((id) => data.find((c) => c.id === id)).find(Boolean);
  return first ? first.name.trim() : null;
}

/** يحفظ نوع المتجر حسب التصنيفات المختارة (لا يغيّر شيئاً إذا لم يُختر تصنيف) */
export async function saveVendorType(vendorId, categoryIds) {
  const type = await resolveVendorType(categoryIds);
  if (!type) return null;
  const { error } = await supabase.from('vendors').update({ type }).eq('id', vendorId);
  if (error) {
    console.error('Error saving vendor type:', error);
    return null;
  }
  return type;
}
