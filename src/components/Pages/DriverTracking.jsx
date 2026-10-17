import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../utils/formatters';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createDriverIcon = (status) => {
  const colors = {
    available: '#10B981',
    busy: '#F59E0B',
    offline: '#6B7280'
  };
  const color = colors[status] || colors.offline;
  return L.divIcon({
    html: `<div style="background-color:${color};width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">🚗</div>`,
    className: 'custom-driver-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

function MapUpdater({ selectedDriver }) {
  const map = useMap();
  useEffect(() => {
    if (selectedDriver && selectedDriver.latitude && selectedDriver.longitude) {
      map.setView([selectedDriver.latitude, selectedDriver.longitude], 15);
    }
  }, [selectedDriver, map]);
  return null;
}

export default function DriverTracking() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverTrips, setDriverTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef(null);

  // Manual assignment state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [assignDriverId, setAssignDriverId] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTrip, setTransferTrip] = useState(null);
  const [transferTargetDriver, setTransferTargetDriver] = useState('');

  useEffect(() => {
    fetchDriversData();
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchDriversData();
        setLastUpdate(new Date());
      }, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  useEffect(() => {
    if (selectedDriver) {
      fetchDriverTrips(selectedDriver.id);
    }
  }, [selectedDriver]);

  const fetchDriversData = async () => {
    try {
      setLoading(drivers.length === 0);
      setError(null);

      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select(`
          id,
          name,
          phone,
          status,
          rating,
          rating_count,
          current_latitude,
          current_longitude,
          last_seen_at,
          vehicle_type,
          vehicle_number
        `);

      if (driversError) throw driversError;

      const { data: serviceAreasData } = await supabase
        .from('service_areas')
        .select('id, name');

      const serviceAreaMap = {};
      (serviceAreasData || []).forEach(sa => { serviceAreaMap[sa.id] = sa.name; });

      const driversWithTrips = await Promise.all(
        (driversData || []).map(async (driver) => {
          try {
            const { data: tripsData, error: tripsError } = await supabase
              .from('driver_trips')
              .select(`
                id,
                status,
                customer_name,
                customer_phone,
                delivery_address,
                total,
                assigned_at,
                started_at,
                order:order_id(id, order_number, status)
              `)
              .eq('driver_id', driver.id)
              .in('status', ['assigned', 'in_progress'])
              .order('assigned_at', { ascending: false });

            if (tripsError) {
              return { ...driver, active_trips: [] };
            }
            return {
              ...driver,
              latitude: driver.current_latitude,
              longitude: driver.current_longitude,
              last_location_update: driver.last_seen_at,
              vehicle_plate: driver.vehicle_number,
              service_area_name: driver.service_area_id ? serviceAreaMap[driver.service_area_id] || null : null,
              active_trips: tripsData || []
            };
          } catch {
            return { ...driver, latitude: driver.current_latitude, longitude: driver.current_longitude, last_location_update: driver.last_seen_at, vehicle_plate: driver.vehicle_number, service_area_name: driver.service_area_id ? serviceAreaMap[driver.service_area_id] || null : null, active_trips: [] };
          }
        })
      );

      setDrivers(driversWithTrips);
    } catch (err) {
      console.error('Error fetching drivers data:', err);
      setError('فشل في تحميل بيانات السائقين');
      toast.error('فشل في تحميل بيانات السائقين');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverTrips = async (driverId) => {
    try {
      const { data, error } = await supabase
        .from('driver_trips')
        .select(`*, order:order_id(id, order_number, status, created_at)`)
        .eq('driver_id', driverId)
        .order('assigned_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setDriverTrips(data || []);
    } catch (err) {
      console.error('Error fetching driver trips:', err);
    }
  };

  const updateDriverStatus = async (driverId, newStatus) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: newStatus, last_seen_at: new Date().toISOString() })
        .eq('id', driverId);

      if (error) throw error;

      setDrivers(drivers.map(d => d.id === driverId ? { ...d, status: newStatus } : d));
      toast.success(`تم تحديث حالة السائق إلى ${getStatusText(newStatus)}`);
    } catch (err) {
      console.error('Error updating driver status:', err);
      toast.error('فشل في تحديث حالة السائق');
    }
  };

  const fetchAvailableOrders = async (driverServiceAreaId) => {
    try {
      let query = supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_phone, address, total, status, created_at, vendor_name, service_area_id')
        .in('status', ['processing', 'waiting_for_driver', 'pending'])
        .is('driver_id', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (driverServiceAreaId) {
        query = query.eq('service_area_id', driverServiceAreaId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAvailableOrders(data || []);
    } catch (err) {
      console.error('Error fetching available orders:', err);
      toast.error('فشل في تحميل الطلبات المتاحة');
    }
  };

  const handleAssignOrder = async (orderId) => {
    if (!assignDriverId) {
      toast.error('الرجاء اختيار سائق');
      return;
    }

    try {
      setAssigning(true);

      const driver = drivers.find(d => d.id === assignDriverId);
      if (!driver) {
        toast.error('السائق غير موجود');
        return;
      }

      const order = availableOrders.find(o => o.id === orderId);
      if (!order) {
        toast.error('الطلب غير موجود');
        return;
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          driver_id: driver.id,
          driver_name: driver.name,
          status: 'processing'
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      const { error: tripError } = await supabase
        .from('driver_trips')
        .insert({
          order_id: orderId,
          driver_id: driver.id,
          status: 'assigned',
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          delivery_address: order.address,
          total: order.total,
          assigned_at: new Date().toISOString()
        });

      if (tripError) {
        console.error('Error creating trip:', tripError);
      }

      await supabase
        .from('driver_waiting_list')
        .update({ driver_id: driver.id, assigned_at: new Date().toISOString(), status: 'assigned' })
        .eq('order_id', orderId);

      toast.success(`تم تعيين الطلب ${order.order_number} للسائق ${driver.name}`);

      setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
      fetchDriversData();
    } catch (err) {
      console.error('Error assigning order:', err);
      toast.error('فشل في تعيين الطلب');
    } finally {
      setAssigning(false);
    }
  };

  const handleTransferOrder = async () => {
    if (!transferTrip || !transferTargetDriver) {
      toast.error('الرجاء اختيار سائق مستلم');
      return;
    }

    try {
      setAssigning(true);

      const targetDriver = drivers.find(d => d.id === transferTargetDriver);
      if (!targetDriver) {
        toast.error('السائق المستلم غير موجود');
        return;
      }

      const { error: tripError } = await supabase
        .from('driver_trips')
        .update({ driver_id: transferTargetDriver })
        .eq('id', transferTrip.id);

      if (tripError) throw tripError;

      const { error: orderError } = await supabase
        .from('orders')
        .update({ driver_id: transferTargetDriver, driver_name: targetDriver.name })
        .eq('id', transferTrip.order_id);

      if (orderError) throw orderError;

      toast.success(`تم نقل الطلب من ${selectedDriver.name} إلى ${targetDriver.name}`);

      setShowTransferModal(false);
      setTransferTrip(null);
      setTransferTargetDriver('');
      fetchDriversData();
    } catch (err) {
      console.error('Error transferring order:', err);
      toast.error('فشل في نقل الطلب');
    } finally {
      setAssigning(false);
    }
  };

  const openAssignModal = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    setAssignDriverId(driverId || null);
    fetchAvailableOrders(driver?.service_area_id);
    setShowAssignModal(true);
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return 'متاح';
      case 'busy': return 'مشغول';
      case 'offline': return 'غير متصل';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTripStatusText = (status) => {
    switch (status) {
      case 'assigned': return 'معينة';
      case 'in_progress': return 'قيد التنفيذ';
      case 'completed': return 'مكتملة';
      case 'cancelled': return 'ملغية';
      default: return status;
    }
  };

  const getTripStatusColor = (status) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVehicleTypeText = (type) => {
    switch (type) {
      case 'motorcycle': return 'دراجة نارية';
      case 'car': return 'سيارة';
      case 'bicycle': return 'دراجة هوائية';
      default: return type || 'غير محدد';
    }
  };

  const mapCenter = [31.5017, 34.4668];
  const mapZoom = 10;

  if (loading && drivers.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-800">
        <h3 className="text-lg font-semibold mb-2">خطأ</h3>
        <p>{error}</p>
        <button onClick={fetchDriversData} className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold">تتبع السائقين</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => openAssignModal(null)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <span>+</span> تعيين طلب يدوياً
          </button>
          <div className="flex items-center gap-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="mr-2 text-sm">تحديث تلقائي</span>
            </label>
          </div>
          <div className="text-sm text-gray-500">
            آخر تحديث: {lastUpdate.toLocaleTimeString('ar-SA')}
          </div>
          <button onClick={fetchDriversData} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            تحديث الآن
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Drivers List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold mb-4">قائمة السائقين ({drivers.length})</h3>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-green-50 p-2 rounded text-center">
              <div className="text-lg font-bold text-green-600">{drivers.filter(d => d.status === 'available').length}</div>
              <div className="text-xs text-green-700">متاح</div>
            </div>
            <div className="bg-yellow-50 p-2 rounded text-center">
              <div className="text-lg font-bold text-yellow-600">{drivers.filter(d => d.status === 'busy').length}</div>
              <div className="text-xs text-yellow-700">مشغول</div>
            </div>
            <div className="bg-gray-50 p-2 rounded text-center">
              <div className="text-lg font-bold text-gray-600">{drivers.filter(d => d.status === 'offline').length}</div>
              <div className="text-xs text-gray-700">غير متصل</div>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {drivers.length === 0 ? (
              <div className="text-center py-4 text-gray-500">لا يوجد سائقين</div>
            ) : (
              drivers.map(driver => (
                <div
                  key={driver.id}
                  onClick={() => setSelectedDriver(driver)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDriver?.id === driver.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{driver.name}</h4>
                      <p className="text-sm text-gray-500">{driver.phone || '-'}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(driver.status)}`}>
                      {getStatusText(driver.status)}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <div>المركبة: {getVehicleTypeText(driver.vehicle_type)}</div>
                    {driver.vehicle_plate && <div>اللوحة: {driver.vehicle_plate}</div>}
                    {driver.service_area_name && (
                      <div className="text-blue-600 font-medium">منطقة الخدمة: {driver.service_area_name}</div>
                    )}
                    <div>الطلبات النشطة: {driver.active_trips?.length || 0}</div>
                    {driver.last_location_update && (
                      <div>آخر تحديث: {new Date(driver.last_location_update).toLocaleTimeString('ar-SA')}</div>
                    )}
                  </div>

                  {driver.active_trips && driver.active_trips.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-700 mb-1">الطلبات النشطة:</div>
                      {driver.active_trips.slice(0, 2).map(trip => (
                        <div key={trip.id} className="text-xs text-gray-600 mb-1">
                          • {trip.customer_name} - ₪{trip.total}
                        </div>
                      ))}
                      {driver.active_trips.length > 2 && (
                        <div className="text-xs text-blue-600">+{driver.active_trips.length - 2} طلب إضافي</div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); openAssignModal(driver.id); }}
                    className="mt-2 w-full text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100"
                  >
                    + تعيين طلب لهذا السائق
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="h-96 lg:h-[600px]">
            <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater selectedDriver={selectedDriver} />
              {drivers.map(driver => (
                driver.latitude && driver.longitude && (
                  <Marker
                    key={driver.id}
                    position={[driver.latitude, driver.longitude]}
                    icon={createDriverIcon(driver.status)}
                    eventHandlers={{ click: () => setSelectedDriver(driver) }}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-gray-900">{driver.name}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(driver.status)}`}>
                            {getStatusText(driver.status)}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div>📞 {driver.phone || '-'}</div>
                          <div>⭐ {driver.rating} ({driver.rating_count} تقييم)</div>
                          <div>🚗 {getVehicleTypeText(driver.vehicle_type)}</div>
                          {driver.vehicle_plate && <div>🔢 {driver.vehicle_plate}</div>}
                          {driver.service_area_name && <div>📍 {driver.service_area_name}</div>}
                          <div>📦 {driver.active_trips?.length || 0} طلب نشط</div>
                          {driver.last_location_update && (
                            <div className="text-xs text-gray-500">
                              آخر تحديث: {new Date(driver.last_location_update).toLocaleString('ar-SA')}
                            </div>
                          )}
                        </div>
                        {driver.active_trips && driver.active_trips.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-gray-200">
                            <div className="text-sm font-medium text-gray-700 mb-2">الطلبات النشطة:</div>
                            {driver.active_trips.map(trip => (
                              <div key={trip.id} className="text-sm text-gray-600 mb-1 p-2 bg-gray-50 rounded">
                                <div className="font-medium">{trip.customer_name}</div>
                                <div className="text-xs">📍 {trip.delivery_address || '-'}</div>
                                <div className="text-xs">💰 ₪{trip.total}</div>
                                <div className="text-xs">
                                  <span className={`px-1 py-0.5 rounded ${getTripStatusColor(trip.status)}`}>
                                    {getTripStatusText(trip.status)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          <select
                            value={driver.status}
                            onChange={(e) => updateDriverStatus(driver.id, e.target.value)}
                            className="flex-1 text-xs border rounded px-2 py-1 w-full"
                          >
                            <option value="available">متاح</option>
                            <option value="busy">مشغول</option>
                            <option value="offline">غير متصل</option>
                          </select>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Selected Driver Details */}
      {selectedDriver && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-semibold">{selectedDriver.name}</h3>
              <p className="text-gray-600">{selectedDriver.phone || '-'}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full ${getStatusColor(selectedDriver.status)}`}>
                {getStatusText(selectedDriver.status)}
              </span>
              <select
                value={selectedDriver.status}
                onChange={(e) => updateDriverStatus(selectedDriver.id, e.target.value)}
                className="border rounded-md px-3 py-2"
              >
                <option value="available">متاح</option>
                <option value="busy">مشغول</option>
                <option value="offline">غير متصل</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Driver Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800">معلومات السائق</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">التقييم:</span>
                  <span>⭐ {selectedDriver.rating} ({selectedDriver.rating_count})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">المركبة:</span>
                  <span>{getVehicleTypeText(selectedDriver.vehicle_type)}</span>
                </div>
                {selectedDriver.vehicle_plate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">رقم اللوحة:</span>
                    <span>{selectedDriver.vehicle_plate}</span>
                  </div>
                )}
                {selectedDriver.service_area_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">منطقة الخدمة:</span>
                    <span className="text-blue-600 font-medium">{selectedDriver.service_area_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">الموقع:</span>
                  <span>
                    {selectedDriver.latitude ? `${Number(selectedDriver.latitude).toFixed(4)}, ${Number(selectedDriver.longitude).toFixed(4)}` : 'غير متوفر'}
                  </span>
                </div>
                {selectedDriver.last_location_update && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">آخر تحديث:</span>
                    <span>{new Date(selectedDriver.last_location_update).toLocaleString('ar-SA')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Active Trips */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-800">الطلبات النشطة ({selectedDriver.active_trips?.length || 0})</h4>
              </div>
              {selectedDriver.active_trips && selectedDriver.active_trips.length > 0 ? (
                <div className="space-y-3">
                  {selectedDriver.active_trips.map(trip => (
                    <div key={trip.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{trip.customer_name}</div>
                          <div className="text-sm text-gray-600">{trip.customer_phone || '-'}</div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getTripStatusColor(trip.status)}`}>
                          {getTripStatusText(trip.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>📍 {trip.delivery_address || '-'}</div>
                        <div>💰 ₪{trip.total}</div>
                        <div>🕐 {formatDate(trip.assigned_at)}</div>
                        {trip.order && (
                          <div>📋 طلب #{trip.order.order_number || trip.order.id.substring(0, 8)}</div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setTransferTrip(trip);
                          setTransferTargetDriver('');
                          setShowTransferModal(true);
                        }}
                        className="mt-2 text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded hover:bg-orange-100"
                      >
                        نقل الطلب لسائق آخر
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">لا توجد طلبات نشطة</div>
              )}
            </div>

            {/* Recent Trips History */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800">سجل الرحلات الأخيرة</h4>
              {driverTrips.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {driverTrips.map(trip => (
                    <div key={trip.id} className="p-2 border rounded text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{trip.customer_name}</div>
                          <div className="text-gray-600">₪{trip.total}</div>
                        </div>
                        <span className={`px-1 py-0.5 text-xs rounded ${getTripStatusColor(trip.status)}`}>
                          {getTripStatusText(trip.status)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{formatDate(trip.assigned_at)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">لا توجد رحلات سابقة</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-4">مفتاح الخريطة</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">🚗</div>
            <span className="text-sm">سائق متاح</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs">🚗</div>
            <span className="text-sm">سائق مشغول</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs">🚗</div>
            <span className="text-sm">سائق غير متصل</span>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p>• انقر على أي سائق في القائمة أو على الخريطة لعرض تفاصيله</p>
          <p>• يتم تحديث المواقع تلقائياً كل 30 ثانية</p>
          <p>• يمكنك تغيير حالة السائق مباشرة من النافذة المنبثقة</p>
          <p>• استخدم زر "تعيين طلب يدوياً" لتوجيه طلب لسائق محدد</p>
        </div>
      </div>

      {/* Assign Order Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setShowAssignModal(false)}></div>
            <div className="relative bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">تعيين طلب يدوياً لسائق</h2>
                <button onClick={() => setShowAssignModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">اختر السائق</label>
                <select
                  value={assignDriverId || ''}
                  onChange={(e) => setAssignDriverId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">-- اختر سائق --</option>
                  {drivers.map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} - {getStatusText(driver.status)} ({driver.active_trips?.length || 0} طلب نشط){driver.service_area_name ? ` | ${driver.service_area_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const selectedDrv = drivers.find(d => d.id === assignDriverId);
                if (selectedDrv?.service_area_name) {
                  return (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                      يتم عرض الطلبات الخاصة بمنطقة: <strong>{selectedDrv.service_area_name}</strong>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">الطلبات المتاحة ({availableOrders.length})</h3>
                {availableOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">لا توجد طلبات متاحة للتعيين</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {availableOrders.map(order => (
                      <div key={order.id} className="p-3 border rounded-lg flex justify-between items-center">
                        <div>
                          <div className="font-medium">#{order.order_number || order.id.substring(0, 8)}</div>
                          <div className="text-sm text-gray-600">{order.customer_name} - {order.customer_phone || '-'}</div>
                          <div className="text-xs text-gray-500">{order.address || '-'} | ₪{order.total}</div>
                          {order.vendor_name && <div className="text-xs text-gray-500">المتجر: {order.vendor_name}</div>}
                        </div>
                        <button
                          onClick={() => handleAssignOrder(order.id)}
                          disabled={!assignDriverId || assigning}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {assigning ? 'جاري التعيين...' : 'تعيين'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Order Modal */}
      {showTransferModal && transferTrip && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setShowTransferModal(false)}></div>
            <div className="relative bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">نقل الطلب لسائق آخر</h2>
                <button onClick={() => setShowTransferModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">الطلب الحالي:</div>
                <div className="font-medium">{transferTrip.customer_name}</div>
                <div className="text-sm text-gray-500">📍 {transferTrip.delivery_address || '-'} | ₪{transferTrip.total}</div>
                <div className="text-xs text-gray-500 mt-1">السائق الحالي: {selectedDriver?.name}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اختر السائق المستلم</label>
                <select
                  value={transferTargetDriver}
                  onChange={(e) => setTransferTargetDriver(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">-- اختر سائق --</option>
                  {drivers.filter(d => d.id !== selectedDriver?.id).map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} - {getStatusText(driver.status)} ({driver.active_trips?.length || 0} طلب نشط){driver.service_area_name ? ` | ${driver.service_area_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleTransferOrder}
                  disabled={!transferTargetDriver || assigning}
                  className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                >
                  {assigning ? 'جاري النقل...' : 'نقل الطلب'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
