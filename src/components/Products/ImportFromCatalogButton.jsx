import { useState } from 'react';
import { Download, Package, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getActiveCatalogs,
  getActiveCatalogItems
} from '../../lib/productCatalogsApi';

export default function ImportFromCatalogButton({ onImport, isVendorMode }) {
  const [showModal, setShowModal] = useState(false);
  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [catalogItems, setCatalogItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const openModal = async () => {
    setShowModal(true);
    setLoading(true);
    try {
      const data = await getActiveCatalogs();
      setCatalogs(data);
      if (data.length > 0) {
        setSelectedCatalog(data[0]);
        await loadItems(data[0].id);
      }
    } catch (error) {
      toast.error('فشل في تحميل القوائم');
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (catalogId) => {
    try {
      const data = await getActiveCatalogItems(catalogId);
      setCatalogItems(data);
    } catch (error) {
      toast.error('فشل في تحميل المنتجات');
    }
  };

  const handleCatalogChange = async (catalog) => {
    setSelectedCatalog(catalog);
    await loadItems(catalog.id);
  };

  const handleItemSelect = (item) => {
    const importedData = {
      name: item.name,
      name_en: item.name_en,
      description: item.description,
      price: parseFloat(item.default_price),
      image: item.image_url,
      stock: 100,
      status: 'active',
      variants: Array.isArray(item.variants) ? item.variants : [],
      addons: Array.isArray(item.addons) ? item.addons : []
    };

    onImport(importedData);
    setShowModal(false);
    toast.success('تم استيراد بيانات المنتج بنجاح');
  };

  if (!showModal) {
    return (
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>استيراد من القوائم المشتركة</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[85vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold">استيراد منتج من القوائم المشتركة</h2>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : catalogs.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد قوائم متاحة</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">اختر القائمة:</label>
                <div className="flex gap-2 flex-wrap">
                  {catalogs.map((catalog) => (
                    <button
                      key={catalog.id}
                      onClick={() => handleCatalogChange(catalog)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        selectedCatalog?.id === catalog.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="text-xl">{catalog.icon || '📦'}</span>
                      <span className="font-medium">{catalog.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {catalogItems.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">لا توجد منتجات في هذه القائمة</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catalogItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleItemSelect(item)}
                      className="border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all"
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
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold text-blue-600">
                          ₪{parseFloat(item.default_price).toFixed(2)}
                        </span>
                        <span className="text-sm text-gray-500">{item.unit}</span>
                      </div>

                      {item.variants && Array.isArray(item.variants) && item.variants.length > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">
                            {item.variants.length} حجم متاح
                          </p>
                        </div>
                      )}

                      {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                        <div className="pt-2">
                          <p className="text-xs text-amber-600">
                            {item.addons.length} إضافة متاحة
                          </p>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          <Check className="w-4 h-4" />
                          <span>اختيار هذا المنتج</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
