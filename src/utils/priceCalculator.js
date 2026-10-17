/**
 * دوال حساب أسعار المنتجات والإضافات
 * يتم استخدام هذه الدوال في واجهة المستخدم لحساب الأسعار بشكل ديناميكي
 */

/**
 * حساب سعر إضافة واحدة مع الكمية
 * @param {Object} addon - الإضافة
 * @param {number} addon.price - سعر الإضافة
 * @param {number} addon.quantity - كمية الإضافة (افتراضي 1)
 * @returns {number} - سعر الإضافة × الكمية
 */
export const calculateAddonPrice = (addon) => {
  if (!addon || typeof addon.price !== 'number') {
    return 0;
  }
  const quantity = addon.quantity || 1;
  return addon.price * quantity;
};

/**
 * حساب إجمالي أسعار مجموعة إضافات
 * @param {Array} addons - مصفوفة الإضافات
 * @returns {number} - المجموع الإجمالي لأسعار الإضافات
 */
export const calculateAddonsTotal = (addons) => {
  if (!Array.isArray(addons) || addons.length === 0) {
    return 0;
  }

  return addons.reduce((total, addon) => {
    return total + calculateAddonPrice(addon);
  }, 0);
};

/**
 * حساب سعر منتج واحد مع إضافاته
 * المعادلة: (سعر المنتج × الكمية) + مجموع أسعار الإضافات (مع كمياتها)
 * @param {Object} item - المنتج
 * @param {number} item.price - سعر المنتج الأساسي
 * @param {number} item.quantity - كمية المنتج
 * @param {Array} item.addons - إضافات المنتج (كل إضافة لها price و quantity)
 * @returns {Object} - تفاصيل الحساب
 */
export const calculateItemTotal = (item) => {
  if (!item || typeof item.price !== 'number') {
    return {
      basePrice: 0,
      addonsTotal: 0,
      itemTotal: 0,
    };
  }

  const quantity = item.quantity || 1;
  const baseTotal = item.price * quantity;  // سعر المنتج × الكمية
  const addonsTotal = calculateAddonsTotal(item.addons);  // مجموع الإضافات (كل إضافة × كميتها)
  const itemTotal = baseTotal + addonsTotal;

  return {
    basePrice: baseTotal,       // سعر المنتج × الكمية
    addonsTotal,                 // مجموع أسعار الإضافات (مع كمياتها)
    itemTotal,                   // المجموع النهائي: baseTotal + addonsTotal
  };
};

/**
 * حساب إجمالي سعر الطلب (جميع المنتجات)
 * @param {Array} items - مصفوفة المنتجات في الطلب
 * @returns {number} - المجموع الإجمالي (Subtotal)
 */
export const calculateOrderSubtotal = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  return items.reduce((total, item) => {
    const { itemTotal } = calculateItemTotal(item);
    return total + itemTotal;
  }, 0);
};

/**
 * حساب المجموع النهائي للطلب مع رسوم التوصيل
 * @param {Array} items - مصفوفة المنتجات
 * @param {number} deliveryFee - رسوم التوصيل
 * @returns {Object} - تفاصيل الحساب الكامل
 */
export const calculateOrderTotal = (items, deliveryFee = 0) => {
  const subtotal = calculateOrderSubtotal(items);
  const total = subtotal + deliveryFee;

  return {
    subtotal,        // مجموع المنتجات فقط
    deliveryFee,     // رسوم التوصيل
    total,           // المجموع النهائي
  };
};

/**
 * فلترة الإضافات المحددة فقط (للعرض)
 * @param {Array} addons - جميع الإضافات
 * @param {Array} selectedAddonIds - معرفات الإضافات المحددة
 * @returns {Array} - الإضافات المحددة فقط
 */
export const getSelectedAddons = (addons, selectedAddonIds) => {
  if (!Array.isArray(addons) || !Array.isArray(selectedAddonIds)) {
    return [];
  }

  return addons.filter(addon => selectedAddonIds.includes(addon.id));
};

/**
 * الحصول على الإضافات الافتراضية
 * @param {Array} addons - جميع الإضافات
 * @returns {Array} - الإضافات المحددة افتراضياً
 */
export const getDefaultAddons = (addons) => {
  if (!Array.isArray(addons)) {
    return [];
  }

  return addons.filter(addon => addon.is_default === true);
};

/**
 * الحصول على المكونات الإلزامية
 * @param {Array} addons - جميع الإضافات
 * @returns {Array} - المكونات الإلزامية فقط
 */
export const getRequiredAddons = (addons) => {
  if (!Array.isArray(addons)) {
    return [];
  }

  return addons.filter(addon => addon.is_required === true);
};

/**
 * الحصول على الإضافات الاختيارية
 * @param {Array} addons - جميع الإضافات
 * @returns {Array} - الإضافات الاختيارية فقط
 */
export const getOptionalAddons = (addons) => {
  if (!Array.isArray(addons)) {
    return [];
  }

  return addons.filter(addon => addon.is_required !== true);
};

/**
 * تنسيق السعر للعرض
 * @param {number} price - السعر
 * @param {string} currency - رمز العملة (افتراضي ₪)
 * @returns {string} - السعر منسق
 */
export const formatPrice = (price, currency = '₪') => {
  if (typeof price !== 'number') {
    return `0.00 ${currency}`;
  }

  return `${price.toFixed(2)} ${currency}`;
};

/**
 * التحقق من صحة حساب السعر
 * يقارن السعر المحسوب مع السعر المتوقع
 * @param {number} calculatedPrice - السعر المحسوب
 * @param {number} expectedPrice - السعر المتوقع
 * @returns {boolean} - هل الحساب صحيح؟
 */
export const validatePriceCalculation = (calculatedPrice, expectedPrice) => {
  const tolerance = 0.01; // هامش خطأ مقبول
  return Math.abs(calculatedPrice - expectedPrice) < tolerance;
};

/**
 * مثال على الاستخدام في مكون React
 *
 * @example
 * ```jsx
 * import { calculateItemTotal, formatPrice } from './utils/priceCalculator';
 *
 * function ProductCard({ product, selectedAddons }) {
 *   const { basePrice, addonsTotal, itemTotal } = calculateItemTotal({
 *     price: product.price,
 *     quantity: 1,
 *     addons: selectedAddons
 *   });
 *
 *   return (
 *     <div>
 *       <p>سعر المنتج: {formatPrice(basePrice)}</p>
 *       <p>الإضافات: {formatPrice(addonsTotal)}</p>
 *       <p>المجموع: {formatPrice(itemTotal)}</p>
 *     </div>
 *   );
 * }
 * ```
 */

/**
 * مثال على حساب طلب كامل
 * المعادلة: (سعر المنتج × الكمية) + مجموع أسعار الإضافات
 *
 * @example
 * ```javascript
 * const order = {
 *   items: [
 *     {
 *       price: 25,
 *       quantity: 3,
 *       addons: [
 *         { price: 4 },
 *         { price: 2 }
 *       ]
 *       // الحساب: (25 × 3) + 4 + 2 = 75 + 6 = 81
 *     },
 *     {
 *       price: 15,
 *       quantity: 1,
 *       addons: [
 *         { price: 3 }
 *       ]
 *       // الحساب: (15 × 1) + 3 = 18
 *     }
 *   ]
 * };
 *
 * const { subtotal, deliveryFee, total } = calculateOrderTotal(order.items, 10);
 *
 * console.log('Subtotal:', subtotal);    // 99 (81 + 18)
 * console.log('Delivery:', deliveryFee); // 10
 * console.log('Total:', total);          // 109
 * ```
 */
