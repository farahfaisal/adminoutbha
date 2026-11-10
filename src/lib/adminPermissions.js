/**
 * صلاحيات مدراء لوحة التحكم.
 * كل صلاحية = قسم من القائمة الجانبية. المدير الذي صلاحياته null له كل الصلاحيات.
 */
export const PERMISSION_GROUPS = [
  { key: 'overview', label: 'الإحصائيات', tabs: ['overview'] },
  { key: 'financial-dashboard', label: 'لوحة المعلومات المالية', tabs: ['financial-dashboard'] },
  { key: 'statistics-reports', label: 'التقارير التفصيلية', tabs: ['vendor-statistics', 'driver-statistics', 'vendor-settlement', 'driver-settlement'] },
  { key: 'orders-management', label: 'إدارة الطلبات', tabs: ['orders', 'parcel-orders', 'captain-orders'] },
  { key: 'products-management', label: 'إدارة المنتجات والتصنيفات', tabs: ['products', 'products-management', 'vendor-products-management', 'vendor-products', 'product-catalogs', 'categories', 'vendor-product-categories'] },
  { key: 'vendors-management', label: 'إدارة البائعين', tabs: ['vendors', 'vendors-list', 'add-vendor', 'vendor-categories-table', 'vendor-locations', 'vendor-discounts'] },
  { key: 'drivers-management', label: 'إدارة السائقين', tabs: ['drivers', 'driver-trips', 'driver-tracking', 'add-driver'] },
  { key: 'delivery', label: 'التوصيل ومناطق الخدمة', tabs: ['shipping-methods', 'service-areas', 'service-area-managers', 'delivery-offers'] },
  { key: 'payments-management', label: 'المدفوعات والمحفظة', tabs: ['payments', 'wallet', 'wallet-settings', 'payment-notifications'] },
  { key: 'customers-management', label: 'إدارة الزبائن', tabs: ['customers', 'add-customer', 'wholesale', 'customer-messages'] },
  { key: 'ratings', label: 'التقييمات', tabs: ['vendor-ratings', 'driver-ratings', 'customer-ratings', 'ratings-report'] },
  { key: 'marketing', label: 'الإعلانات والكوبونات والنقاط', tabs: ['advertisements', 'coupons', 'points-rewards', 'referral', 'user-referral'] },
  { key: 'notifications', label: 'الإشعارات', tabs: ['notifications', 'notification-settings', 'firebase-notifications'] },
  { key: 'media', label: 'الوسائط', tabs: ['media'] },
  { key: 'system', label: 'الإعدادات والأمان ومفاتيح API', tabs: ['settings', 'security', 'api-keys', 'users'] },
  { key: 'admin-users', label: 'إدارة مدراء اللوحة', tabs: ['admin-users'] },
];

const groupOfTab = new Map();
PERMISSION_GROUPS.forEach((g) => g.tabs.forEach((t) => groupOfTab.set(t, g.key)));

/** هل للمدير صلاحيات محدودة؟ (null أو غير مصفوفة = صلاحيات كاملة) */
export const hasLimitedPermissions = (user) =>
  !!user && !user.isSuperAdmin && Array.isArray(user.permissions);

/** هل يستطيع المدير فتح هذه الصفحة؟ */
export const canAccessTab = (user, tabId) => {
  if (!hasLimitedPermissions(user)) return true;
  const group = groupOfTab.get(tabId);
  if (!group) return false;
  return user.permissions.includes(group);
};

/** أول صفحة مسموحة للمدير (للتحويل إليها) */
export const firstAllowedTab = (user) => {
  if (canAccessTab(user, 'orders')) return 'orders';
  for (const g of PERMISSION_GROUPS) {
    if (!hasLimitedPermissions(user) || user.permissions.includes(g.key)) return g.tabs[0];
  }
  return null;
};
