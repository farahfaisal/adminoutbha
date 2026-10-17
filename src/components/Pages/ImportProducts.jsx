import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Package, Download, Check, Grid } from 'lucide-react';
import { useVendor } from '../../contexts/VendorContext';
import {
  getActiveCatalogs,
  getActiveCatalogItems,
  importMultipleCatalogItems
} from '../../lib/productCatalogsApi';

export default function ImportProducts() {
  const { vendor } = useVendor();
  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [catalogItems, setCatalogItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

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
      const data = await getActiveCatalogs();
      setCatalogs(data);
      if (data.length > 0) {
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
      const data = await getActiveCatalogItems(catalogId);
      setCatalogItems(data);
      setSelectedItems(new Set());
    } catch (error) {
      toast.error('فشل في تحميل المنتجات');
    }
  };

  const toggleItem = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === catalogItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(catalogItems.map(item => item.id)));
    }
  };

  const handleImport = async () => {
    if (selectedItems.size === 0) {
      toast.warning('الرجاء اختيار منتج واحد على الأقل');
      return;
    }

    if (!confirm(`هل تريد استيراد ${selectedItems.size} منتج إلى متجرك؟`)) {
      return;
    }

    setImporting(true);
    try {
      const itemIds = Array.from(selectedItems);
      const results = await importMultipleCatalogItems(itemIds, vendor.id);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        toast.success(`تم استيراد ${successCount} منتج بنجاح`);
      }
      if (failCount > 0) {
        toast.error(`فشل في استيراد ${failCount} منتج`);
      }

      setSelectedItems(new Set());
    } catch (error) {
      toast.error('فشل في استيراد المنتجات');
    } finally {
      setImporting(false);
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

  if (catalogs.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-sm">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">لا توجد قوائم متاحة</h2>
        <p className="text-gray-600">لا توجد قوائم مشتركة متاحة حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">استيراد منتجات جاهزة</h1>
          <p className="text-gray-600 mt-1">اختر المنتجات التي تريد إضافتها إلى متجرك</p>
        </div>
        {selectedItems.size > 0 && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            {importing ? 'جاري الاستيراد...' : `استيراد (${selectedItems.size})`}
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {catalogs.map((catalog) => (
            <button
              key={catalog.id}
              onClick={() => setSelectedCatalog(catalog)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedCatalog?.id === catalog.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-2xl">{catalog.icon || '📦'}</span>
              <span className="font-medium">{catalog.name}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedCatalog && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="text-2xl">{selectedCatalog.icon || '📦'}</span>
              {selectedCatalog.name}
            </h2>
            <button
              onClick={selectAll}
              className="btn-secondary text-sm"
            >
              {selectedItems.size === catalogItems.length ? 'إلغاء الكل' : 'اختيار الكل'}
            </button>
          </div>

          {catalogItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد منتجات في هذه القائمة</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {catalogItems.map((item) => {
                const isSelected = selectedItems.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                        <Check className="w-4 h-4" />
                      </div>
                    )}

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

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-blue-600">
                        ₪{parseFloat(item.default_price).toFixed(2)}
                      </span>
                      <span className="text-sm text-gray-500">{item.unit}</span>
                    </div>

                    {item.variants && Array.isArray(item.variants) && item.variants.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">الأحجام المتاحة:</p>
                        <div className="flex flex-wrap gap-1">
                          {item.variants.slice(0, 3).map((variant, idx) => (
                            <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {variant.name}
                            </span>
                          ))}
                          {item.variants.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{item.variants.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-amber-600">
                          {item.addons.length} إضافة متاحة
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4">
          <span className="font-medium">تم اختيار {selectedItems.size} منتج</span>
          <button
            onClick={handleImport}
            disabled={importing}
            className="bg-white text-blue-600 px-4 py-2 rounded-full font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {importing ? 'جاري الاستيراد...' : 'استيراد الآن'}
          </button>
        </div>
      )}
    </div>
  );
}
