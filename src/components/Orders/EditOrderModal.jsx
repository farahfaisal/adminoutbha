import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { calculateItemTotal } from '../../utils/priceCalculator';

export default function EditOrderModal({ isOpen, onClose, order, onSave }) {
  const [editedOrder, setEditedOrder] = useState({
    customer_name: '',
    customer_phone: '',
    address: '',
    notes: '',
    status: '',
    payment_method: '',
    delivery_fee: 0,
    items: []
  });
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (order) {
      setEditedOrder({
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        address: order.address || '',
        notes: order.notes || '',
        status: order.status || 'pending',
        payment_method: order.payment_method || 'cash',
        delivery_fee: Number(order.delivery_fee || 0),
        items: order.items?.map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.name || '',
          quantity: item.quantity || 1,
          price: Number(item.price || 0),
          addons: item.addons_data || [],
          total: Number(item.total || 0)
        })) || []
      });
    }
  }, [order]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, vendor_id')
        .eq('vendor_id', order?.vendor_id)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...editedOrder.items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    // إعادة حساب الإجمالي عند تغيير الكمية أو السعر
    if (field === 'quantity' || field === 'price') {
      const quantity = field === 'quantity' ? Number(value) : newItems[index].quantity;
      const price = field === 'price' ? Number(value) : newItems[index].price;
      const addons = newItems[index].addons || [];

      // استخدام دالة حساب الأسعار التي تأخذ الإضافات في الاعتبار
      const { itemTotal } = calculateItemTotal({
        price: price,
        quantity: quantity,
        addons: addons
      });

      newItems[index].total = itemTotal;
    }

    setEditedOrder({ ...editedOrder, items: newItems });
  };

  const handleAddItem = () => {
    setEditedOrder({
      ...editedOrder,
      items: [
        ...editedOrder.items,
        {
          product_id: null,
          product_name: '',
          quantity: 1,
          price: 0,
          addons: [],
          total: 0
        }
      ]
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = editedOrder.items.filter((_, i) => i !== index);
    setEditedOrder({ ...editedOrder, items: newItems });
  };

  const handleProductSelect = (index, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...editedOrder.items];
      newItems[index] = {
        ...newItems[index],
        product_id: product.id,
        product_name: product.name,
        price: product.price
      };

      // إعادة حساب الإجمالي
      const { itemTotal } = calculateItemTotal({
        price: product.price,
        quantity: newItems[index].quantity,
        addons: newItems[index].addons || []
      });

      newItems[index].total = itemTotal;
      setEditedOrder({ ...editedOrder, items: newItems });
    }
  };

  const calculateTotal = () => {
    const subtotal = editedOrder.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    return subtotal + Number(editedOrder.delivery_fee);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const subtotal = editedOrder.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const total = subtotal + Number(editedOrder.delivery_fee);

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          customer_name: editedOrder.customer_name,
          customer_phone: editedOrder.customer_phone,
          address: editedOrder.address,
          notes: editedOrder.notes,
          status: editedOrder.status,
          payment_method: editedOrder.payment_method,
          delivery_fee: editedOrder.delivery_fee,
          subtotal: subtotal,
          total: total,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      const existingItemIds = editedOrder.items.filter(item => item.id).map(item => item.id);
      const itemsToDelete = order.items
        .filter(item => !existingItemIds.includes(item.id))
        .map(item => item.id);

      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .in('id', itemsToDelete);

        if (deleteError) throw deleteError;
      }

      for (const item of editedOrder.items) {
        if (item.id) {
          const { error: updateError } = await supabase
            .from('order_items')
            .update({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              price: item.price,
              addons_data: item.addons || []
            })
            .eq('id', item.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('order_items')
            .insert({
              order_id: order.id,
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              price: item.price,
              addons_data: item.addons || []
            });

          if (insertError) throw insertError;
        }
      }

      toast.success('تم تحديث الطلب بنجاح');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('حدث خطأ أثناء تحديث الطلب');
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { value: 'pending', label: 'قيد الانتظار' },
    { value: 'confirmed', label: 'مؤكد' },
    { value: 'preparing', label: 'قيد التحضير' },
    { value: 'ready', label: 'جاهز' },
    { value: 'out_for_delivery', label: 'في الطريق' },
    { value: 'delivered', label: 'تم التوصيل' },
    { value: 'cancelled', label: 'ملغي' }
  ];

  const paymentMethods = [
    { value: 'cash', label: 'نقدي' },
    { value: 'card', label: 'بطاقة' },
    { value: 'wallet', label: 'محفظة' }
  ];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={onClose}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>

          <span className="inline-block h-screen align-middle">&#8203;</span>

          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="inline-block w-full max-w-4xl my-8 text-right align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <Dialog.Title as="h3" className="text-2xl font-bold text-gray-900">
                  تعديل الطلب #{order?.order_number}
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      اسم العميل
                    </label>
                    <input
                      type="text"
                      value={editedOrder.customer_name}
                      onChange={(e) => setEditedOrder({ ...editedOrder, customer_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={editedOrder.customer_phone}
                      onChange={(e) => setEditedOrder({ ...editedOrder, customer_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      العنوان
                    </label>
                    <input
                      type="text"
                      value={editedOrder.address}
                      onChange={(e) => setEditedOrder({ ...editedOrder, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      حالة الطلب
                    </label>
                    <select
                      value={editedOrder.status}
                      onChange={(e) => setEditedOrder({ ...editedOrder, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      طريقة الدفع
                    </label>
                    <select
                      value={editedOrder.payment_method}
                      onChange={(e) => setEditedOrder({ ...editedOrder, payment_method: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {paymentMethods.map(method => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      رسوم التوصيل (شيكل)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editedOrder.delivery_fee}
                      onChange={(e) => setEditedOrder({ ...editedOrder, delivery_fee: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ملاحظات
                    </label>
                    <textarea
                      value={editedOrder.notes}
                      onChange={(e) => setEditedOrder({ ...editedOrder, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">المنتجات</h4>
                    <button
                      onClick={handleAddItem}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة منتج
                    </button>
                  </div>

                  <div className="space-y-4">
                    {editedOrder.items.map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                المنتج
                              </label>
                              <select
                                value={item.product_id || ''}
                                onChange={(e) => handleProductSelect(index, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                              >
                                <option value="">اختر منتج</option>
                                {products.map(product => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={item.product_name}
                                onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                                placeholder="أو اكتب اسم المنتج يدويًا"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm mt-2"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                الكمية
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                السعر الأساسي (شيكل)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col items-center gap-2 pt-6">
                            <div className="text-sm font-semibold text-gray-900">
                              {(item.total || 0).toFixed(2)} شيكل
                            </div>
                            <button
                              onClick={() => handleRemoveItem(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* عرض الإضافات */}
                        {item.addons && item.addons.length > 0 && (
                          <div className="mr-4 p-3 bg-blue-50 rounded-lg border-r-4 border-blue-400">
                            <div className="text-xs font-semibold text-blue-900 mb-2">
                              الإضافات المحددة:
                            </div>
                            <div className="space-y-1">
                              {item.addons.map((addon, addonIndex) => (
                                <div key={addonIndex} className="flex justify-between items-center text-xs text-blue-800">
                                  <span>
                                    {addon.name}
                                    {addon.quantity > 1 && ` (×${addon.quantity})`}
                                  </span>
                                  <span className="font-medium">
                                    {((addon.price || 0) * (addon.quantity || 1)).toFixed(2)} شيكل
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between items-center">
                              <span className="text-xs font-bold text-blue-900">مجموع الإضافات:</span>
                              <span className="text-xs font-bold text-blue-900">
                                {item.addons.reduce((sum, addon) => sum + ((addon.price || 0) * (addon.quantity || 1)), 0).toFixed(2)} شيكل
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">الإجمالي:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        ₪{calculateTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t">
                <button
                  onClick={onClose}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
