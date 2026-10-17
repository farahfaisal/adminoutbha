import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Package, Plus, Edit, Trash2, Eye, Grid, List as ListIcon } from 'lucide-react';
import {
  getProductCatalogs,
  getCatalogItems,
  createCatalog,
  updateCatalog,
  deleteCatalog,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem
} from '../../lib/productCatalogsApi';

export default function ProductCatalogs() {
  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [catalogItems, setCatalogItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  useEffect(() => {
    if (selectedCatalog) {
      fetchCatalogItems(selectedCatalog.id);
    }
  }, [selectedCatalog]);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const data = await getProductCatalogs();
      setCatalogs(data);
      if (data.length > 0 && !selectedCatalog) {
        setSelectedCatalog(data[0]);
      }
    } catch (error) {
      toast.error('فشل في تحميل القوائم');
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogItems = async (catalogId) => {
    try {
      const data = await getCatalogItems(catalogId);
      setCatalogItems(data);
    } catch (error) {
      toast.error('فشل في تحميل عناصر القائمة');
    }
  };

  const handleDeleteCatalog = async (catalogId) => {
    if (!confirm('هل أنت متأكد من حذف هذه القائمة؟ سيتم حذف جميع العناصر المرتبطة بها.')) {
      return;
    }

    try {
      await deleteCatalog(catalogId);
      toast.success('تم حذف القائمة بنجاح');
      fetchCatalogs();
      if (selectedCatalog?.id === catalogId) {
        setSelectedCatalog(null);
      }
    } catch (error) {
      toast.error('فشل في حذف القائمة');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
      return;
    }

    try {
      await deleteCatalogItem(itemId);
      toast.success('تم حذف العنصر بنجاح');
      fetchCatalogItems(selectedCatalog.id);
    } catch (error) {
      toast.error('فشل في حذف العنصر');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">القوائم المشتركة للمنتجات</h1>
          <p className="text-gray-600 mt-1">إدارة قوائم المنتجات التي يمكن للمتاجر استيرادها</p>
        </div>
        <button
          onClick={() => {
            setEditingCatalog(null);
            setShowCatalogModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          قائمة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Grid className="w-5 h-5 text-blue-600" />
            القوائم
          </h2>
          <div className="space-y-2">
            {catalogs.map((catalog) => (
              <div
                key={catalog.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedCatalog?.id === catalog.id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                }`}
                onClick={() => setSelectedCatalog(catalog)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-2xl">{catalog.icon || '📦'}</span>
                    <div>
                      <div className="font-medium text-gray-900">{catalog.name}</div>
                      <div className="text-xs text-gray-500">{catalog.name_en}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCatalog(catalog);
                        setShowCatalogModal(true);
                      }}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCatalog(catalog.id);
                      }}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {!catalog.is_active && (
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded mt-1 inline-block">
                    غير نشط
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {selectedCatalog ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <span className="text-2xl">{selectedCatalog.icon || '📦'}</span>
                    {selectedCatalog.name}
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">{selectedCatalog.description}</p>
                </div>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setShowItemModal(true);
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة منتج
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catalogItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                    )}
                    <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                    {item.name_en && (
                      <p className="text-xs text-gray-500 mb-2">{item.name_en}</p>
                    )}
                    {item.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold text-blue-600">
                        ₪{parseFloat(item.default_price).toFixed(2)}
                      </span>
                      <span className="text-sm text-gray-500">{item.unit}</span>
                    </div>
                    {item.variants && Array.isArray(item.variants) && item.variants.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">الأحجام:</p>
                        <div className="flex flex-wrap gap-1">
                          {item.variants.map((variant, idx) => (
                            <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {variant.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setShowItemModal(true);
                        }}
                        className="flex-1 btn-secondary text-sm py-1.5"
                      >
                        <Edit className="w-3 h-3 inline ml-1" />
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {!item.is_active && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded mt-2 inline-block">
                        غير نشط
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {catalogItems.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">لا توجد منتجات في هذه القائمة</p>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setShowItemModal(true);
                    }}
                    className="btn-primary mt-4"
                  >
                    إضافة منتج جديد
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <ListIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">اختر قائمة لعرض المنتجات</p>
            </div>
          )}
        </div>
      </div>

      {showCatalogModal && (
        <CatalogModal
          catalog={editingCatalog}
          onClose={() => {
            setShowCatalogModal(false);
            setEditingCatalog(null);
          }}
          onSave={() => {
            fetchCatalogs();
            setShowCatalogModal(false);
            setEditingCatalog(null);
          }}
        />
      )}

      {showItemModal && selectedCatalog && (
        <ItemModal
          item={editingItem}
          catalogId={selectedCatalog.id}
          onClose={() => {
            setShowItemModal(false);
            setEditingItem(null);
          }}
          onSave={() => {
            fetchCatalogItems(selectedCatalog.id);
            setShowItemModal(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}

function CatalogModal({ catalog, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: catalog?.name || '',
    name_en: catalog?.name_en || '',
    description: catalog?.description || '',
    icon: catalog?.icon || '📦',
    is_active: catalog?.is_active !== false
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (catalog) {
        await updateCatalog(catalog.id, formData);
        toast.success('تم تحديث القائمة بنجاح');
      } else {
        await createCatalog(formData);
        toast.success('تم إنشاء القائمة بنجاح');
      }
      onSave();
    } catch (error) {
      toast.error('فشل في حفظ القائمة');
    } finally {
      setSaving(false);
    }
  };

  const commonIcons = ['🥤', '🍰', '🍔', '🥛', '🥖', '🍕', '🍗', '🥗', '🍜', '🍱', '🧃', '☕'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {catalog ? 'تعديل القائمة' : 'قائمة جديدة'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم بالعربية *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الاسم بالإنجليزية</label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">الوصف</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">الأيقونة</label>
              <div className="grid grid-cols-6 gap-2 mb-2">
                {commonIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`text-3xl p-2 rounded-lg border-2 transition-colors ${
                      formData.icon === icon
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="input-field"
                placeholder="أو اكتب أيقونة مخصصة"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm font-medium">
                قائمة نشطة
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ItemModal({ item, catalogId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    catalog_id: catalogId,
    name: item?.name || '',
    name_en: item?.name_en || '',
    description: item?.description || '',
    default_price: item?.default_price || 0,
    image_url: item?.image_url || '',
    unit: item?.unit || 'حبة',
    variants: item?.variants || [],
    addons: item?.addons || [],
    is_active: item?.is_active !== false
  });
  const [saving, setSaving] = useState(false);
  const [newVariant, setNewVariant] = useState({ name: '', price: 0 });
  const [newAddon, setNewAddon] = useState({ name: '', price: 0, is_required: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (item) {
        await updateCatalogItem(item.id, formData);
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        await createCatalogItem(formData);
        toast.success('تم إضافة المنتج بنجاح');
      }
      onSave();
    } catch (error) {
      toast.error('فشل في حفظ المنتج');
    } finally {
      setSaving(false);
    }
  };

  const addVariant = () => {
    if (newVariant.name && newVariant.price > 0) {
      setFormData({
        ...formData,
        variants: [...formData.variants, { ...newVariant }]
      });
      setNewVariant({ name: '', price: 0 });
    }
  };

  const removeVariant = (index) => {
    setFormData({
      ...formData,
      variants: formData.variants.filter((_, i) => i !== index)
    });
  };

  const addAddon = () => {
    if (newAddon.name && newAddon.price >= 0) {
      setFormData({
        ...formData,
        addons: [...formData.addons, { ...newAddon }]
      });
      setNewAddon({ name: '', price: 0, is_required: false });
    }
  };

  const removeAddon = (index) => {
    setFormData({
      ...formData,
      addons: formData.addons.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {item ? 'تعديل المنتج' : 'منتج جديد'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم المنتج *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الاسم بالإنجليزية</label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">الوصف</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
                rows="2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">السعر الافتراضي *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.default_price}
                  onChange={(e) => setFormData({ ...formData, default_price: parseFloat(e.target.value) })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الوحدة</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="input-field"
                >
                  <option value="حبة">حبة</option>
                  <option value="كيلو">كيلو</option>
                  <option value="لتر">لتر</option>
                  <option value="كأس">كأس</option>
                  <option value="علبة">علبة</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">رابط الصورة</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="input-field"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">الأحجام/الأنواع (اختياري)</h3>
              <div className="space-y-2">
                {formData.variants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                    <span className="flex-1">{variant.name}</span>
                    <span className="text-blue-600 font-medium">₪{variant.price}</span>
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="text-red-600 hover:bg-red-100 p-1 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVariant.name}
                    onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                    placeholder="مثل: صغير، وسط، كبير"
                    className="input-field flex-1"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newVariant.price}
                    onChange={(e) => setNewVariant({ ...newVariant, price: parseFloat(e.target.value) })}
                    placeholder="السعر"
                    className="input-field w-24"
                  />
                  <button
                    type="button"
                    onClick={addVariant}
                    className="btn-secondary px-3"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">الإضافات (اختياري)</h3>
              <div className="space-y-2">
                {formData.addons.map((addon, index) => (
                  <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                    <span className="flex-1">{addon.name}</span>
                    <span className="text-blue-600 font-medium">₪{addon.price}</span>
                    {addon.is_required && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                        إجباري
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAddon(index)}
                      className="text-red-600 hover:bg-red-100 p-1 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAddon.name}
                    onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                    placeholder="مثل: جبنة، خس، طماطم"
                    className="input-field flex-1"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newAddon.price}
                    onChange={(e) => setNewAddon({ ...newAddon, price: parseFloat(e.target.value) })}
                    placeholder="السعر"
                    className="input-field w-24"
                  />
                  <button
                    type="button"
                    onClick={addAddon}
                    className="btn-secondary px-3"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="item_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="item_active" className="text-sm font-medium">
                منتج نشط
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
