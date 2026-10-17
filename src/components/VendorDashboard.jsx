import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendor } from '../contexts/VendorContext';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';
import {
  Store,
  Package,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  LogOut,
  Settings,
  Plus,
  Eye,
  Edit,
  Trash2,
  Search,
  Download
} from 'lucide-react';
import ProductFormWizard from './Products/ProductFormWizard';
import ImportProducts from './Pages/ImportProducts';

export default function VendorDashboard() {
  const navigate = useNavigate();
  const { vendor, logout, loading: vendorLoading } = useVendor();
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (!vendorLoading && !vendor) {
      navigate('/vendor/login');
    } else if (vendor) {
      fetchVendorData();
    }
  }, [vendor, vendorLoading, navigate]);

  const fetchVendorData = async () => {
    try {
      setLoading(true);

      // جلب المنتجات
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:category_id(id, name),
          product_addons(*)
        `)
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      const productsWithAddons = productsData?.map(product => ({
        ...product,
        addons: product.product_addons || []
      })) || [];

      setProducts(productsWithAddons);

      // جلب التصنيفات
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // حساب الإحصائيات
      const activeProducts = productsWithAddons.filter(p => p.status === 'active').length;

      // جلب الطلبات
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('total')
        .eq('vendor_id', vendor.id)
        .eq('status', 'completed');

      if (ordersError) throw ordersError;

      const totalRevenue = ordersData?.reduce((sum, order) => sum + parseFloat(order.total || 0), 0) || 0;

      setStats({
        totalProducts: productsWithAddons.length,
        activeProducts: activeProducts,
        totalOrders: ordersData?.length || 0,
        totalRevenue: totalRevenue
      });
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('تم تسجيل الخروج بنجاح');
      navigate('/vendor/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('فشل تسجيل الخروج');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('vendor_id', vendor.id);

      if (error) throw error;

      toast.success('تم حذف المنتج بنجاح');
      fetchVendorData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('فشل في حذف المنتج');
    }
  };

  const handleProductSubmit = async () => {
    setShowProductModal(false);
    setEditingProduct(null);
    await fetchVendorData();
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (vendorLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{vendor?.store_name}</h1>
                <p className="text-xs text-gray-500">لوحة تحكم البائع</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 space-x-reverse">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي المنتجات</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">المنتجات النشطة</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeProducts}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">الطلبات المكتملة</p>
                <p className="text-3xl font-bold text-purple-600">{stats.totalOrders}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي الإيرادات</p>
                <p className="text-3xl font-bold text-orange-600">{stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">إدارة المنتجات</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center space-x-2 space-x-reverse bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-lg transition-all"
                >
                  <Download className="w-5 h-5" />
                  <span>استيراد منتجات جاهزة</span>
                </button>
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setShowProductModal(true);
                  }}
                  className="flex items-center space-x-2 space-x-reverse bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-all"
                >
                  <Plus className="w-5 h-5" />
                  <span>إضافة منتج جديد</span>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث عن منتج..."
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Products Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المنتج
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    التصنيف
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    السعر
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الحالة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                      لا توجد منتجات
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-10 w-10 rounded-lg object-cover ml-3"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-gray-200 rounded-lg ml-3 flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div className="text-sm font-medium text-gray-900">
                            {product.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {product.category?.name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {parseFloat(product.price).toFixed(2)} ر.س
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : product.status === 'inactive'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {product.status === 'active' ? 'نشط' : product.status === 'inactive' ? 'غير نشط' : 'مسودة'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setShowProductModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Product Modal */}
      {showProductModal && (
        <ProductFormWizard
          product={editingProduct}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          onSubmit={handleProductSubmit}
          vendors={[vendor]}
          categories={categories}
          isVendorMode={true}
          vendorId={vendor.id}
        />
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">استيراد منتجات جاهزة</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  fetchVendorData();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <ImportProducts />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
