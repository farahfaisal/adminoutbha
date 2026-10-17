import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';

export default function VendorProductsManagement() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productCounts, setProductCounts] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);

      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (vendorsError) throw vendorsError;

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('vendor_id, status');

      if (productsError) throw productsError;

      const counts = {};
      vendorsData.forEach(vendor => {
        const vendorProducts = productsData.filter(p => p.vendor_id === vendor.id);
        counts[vendor.id] = {
          total: vendorProducts.length,
          active: vendorProducts.filter(p => p.status === 'active').length,
          inactive: vendorProducts.filter(p => p.status === 'inactive').length,
          draft: vendorProducts.filter(p => p.status === 'draft').length
        };
      });

      setProductCounts(counts);
      setVendors(vendorsData);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('حدث خطأ في جلب بيانات البائعين');
    } finally {
      setLoading(false);
    }
  };

  const handleVendorClick = (vendorId) => {
    navigate(`/admin-dashboard/vendor-products/${vendorId}`);
  };

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.phone?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: 'نشط', color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      inactive: { label: 'غير نشط', color: 'bg-gray-100 text-gray-800', icon: XCircleIcon },
      pending: { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800', icon: ChartBarIcon },
      suspended: { label: 'موقوف', color: 'bg-red-100 text-red-800', icon: XCircleIcon },
      busy: { label: 'مشغول', color: 'bg-orange-100 text-orange-800', icon: ChartBarIcon }
    };

    const config = statusConfig[status] || statusConfig.inactive;
    const StatusIcon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <StatusIcon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <BuildingStorefrontIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">إدارة المنتجات حسب البائعين</h1>
              <p className="text-sm text-gray-600 mt-1">اختر بائعاً لإدارة منتجاته</p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-sm text-gray-600">إجمالي البائعين</p>
            <p className="text-3xl font-bold text-blue-600">{vendors.length}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث عن بائع (الاسم أو رقم الهاتف)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
            <option value="pending">قيد المراجعة</option>
            <option value="suspended">موقوف</option>
            <option value="busy">مشغول</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">جاري تحميل البائعين...</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12">
            <BuildingStorefrontIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">لا توجد نتائج</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVendors.map((vendor) => {
              const counts = productCounts[vendor.id] || { total: 0, active: 0, inactive: 0, draft: 0 };

              return (
                <div
                  key={vendor.id}
                  onClick={() => handleVendorClick(vendor.id)}
                  className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-blue-400 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {vendor.logo_url ? (
                        <img
                          src={vendor.logo_url}
                          alt={vendor.store_name}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                          <BuildingStorefrontIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {vendor.store_name}
                        </h3>
                        <p className="text-xs text-gray-500">{vendor.phone}</p>
                      </div>
                    </div>
                    {getStatusBadge(vendor.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <CubeIcon className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-blue-600">{counts.total}</p>
                      <p className="text-xs text-gray-600">إجمالي المنتجات</p>
                    </div>

                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <CheckCircleIcon className="w-5 h-5 text-green-600 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-green-600">{counts.active}</p>
                      <p className="text-xs text-gray-600">منتجات نشطة</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      غير نشط: {counts.inactive}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                      مسودة: {counts.draft}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:from-blue-600 hover:to-blue-700 transition-all duration-200 group-hover:shadow-md">
                      إدارة المنتجات
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-blue-600" />
          إحصائيات سريعة
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <p className="text-sm text-gray-600 mb-1">إجمالي المنتجات</p>
            <p className="text-2xl font-bold text-gray-900">
              {Object.values(productCounts).reduce((sum, counts) => sum + counts.total, 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <p className="text-sm text-gray-600 mb-1">منتجات نشطة</p>
            <p className="text-2xl font-bold text-green-600">
              {Object.values(productCounts).reduce((sum, counts) => sum + counts.active, 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <p className="text-sm text-gray-600 mb-1">منتجات غير نشطة</p>
            <p className="text-2xl font-bold text-gray-600">
              {Object.values(productCounts).reduce((sum, counts) => sum + counts.inactive, 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <p className="text-sm text-gray-600 mb-1">مسودات</p>
            <p className="text-2xl font-bold text-yellow-600">
              {Object.values(productCounts).reduce((sum, counts) => sum + counts.draft, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
