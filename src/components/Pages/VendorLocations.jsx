import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { toast } from 'react-toastify';
import { getVendors, updateVendor } from '../../lib/vendorsApi';
import { MapPin, Navigation, Save, Search, AlertCircle, Check, Store } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom]);

  return null;
}

function DraggableMarker({ position, onPositionChange, icon }) {
  const [markerPosition, setMarkerPosition] = useState(position);

  useEffect(() => {
    setMarkerPosition(position);
  }, [position]);

  return (
    <Marker
      position={markerPosition}
      icon={icon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          setMarkerPosition([pos.lat, pos.lng]);
          onPositionChange(pos.lat, pos.lng);
        },
      }}
    />
  );
}

export default function VendorLocations() {
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNoLocation, setFilterNoLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState([31.5017, 34.4668]); // Gaza default
  const [mapZoom, setMapZoom] = useState(12);
  const [tempLocation, setTempLocation] = useState(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const data = await getVendors();
      setVendors(data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('فشل في تحميل المتاجر');
    } finally {
      setLoading(false);
    }
  };

  const handleVendorSelect = (vendor) => {
    setSelectedVendor(vendor);

    if (vendor.latitude && vendor.longitude) {
      const position = [vendor.latitude, vendor.longitude];
      setMapCenter(position);
      setMapZoom(15);
      setTempLocation(position);
    } else {
      setTempLocation(null);
    }
  };

  const handleMapClick = (e) => {
    if (!selectedVendor) {
      toast.warning('يرجى اختيار متجر أولاً');
      return;
    }

    const { lat, lng } = e.latlng;
    setTempLocation([lat, lng]);
  };

  const handleMarkerDrag = (lat, lng) => {
    setTempLocation([lat, lng]);
  };

  const handleSaveLocation = async () => {
    if (!selectedVendor || !tempLocation) {
      toast.warning('يرجى تحديد موقع على الخريطة');
      return;
    }

    try {
      setSaving(true);

      await updateVendor(selectedVendor.id, {
        ...selectedVendor,
        latitude: tempLocation[0],
        longitude: tempLocation[1]
      });

      setVendors(vendors.map(v =>
        v.id === selectedVendor.id
          ? { ...v, latitude: tempLocation[0], longitude: tempLocation[1] }
          : v
      ));

      setSelectedVendor({
        ...selectedVendor,
        latitude: tempLocation[0],
        longitude: tempLocation[1]
      });

      toast.success('تم حفظ موقع المتجر بنجاح');
    } catch (error) {
      console.error('Error saving vendor location:', error);
      toast.error('فشل في حفظ موقع المتجر');
    } finally {
      setSaving(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!selectedVendor) {
      toast.warning('يرجى اختيار متجر أولاً');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('المتصفح الخاص بك لا يدعم تحديد الموقع');
      return;
    }

    toast.info('جارٍ الحصول على موقعك الحالي...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = [latitude, longitude];
        setTempLocation(newLocation);
        setMapCenter(newLocation);
        setMapZoom(15);
        toast.success('تم تحديد موقعك الحالي');
      },
      (error) => {
        let errorMessage = 'فشل في الحصول على الموقع';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'تم رفض الإذن للوصول إلى الموقع';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'معلومات الموقع غير متوفرة';
            break;
          case error.TIMEOUT:
            errorMessage = 'انتهت مهلة طلب الموقع';
            break;
        }

        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vendor.address?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = !filterNoLocation || (!vendor.latitude || !vendor.longitude);

    return matchesSearch && matchesFilter;
  });

  const vendorsWithoutLocation = vendors.filter(v => !v.latitude || !v.longitude).length;
  const vendorsWithLocation = vendors.filter(v => v.latitude && v.longitude).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-7 h-7 text-blue-600" />
              إدارة مواقع المتاجر
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              حدد موقع كل متجر على الخريطة لحساب رسوم التوصيل بدقة
            </p>
          </div>

          <div className="flex gap-4 text-sm">
            <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="w-4 h-4" />
                <span className="font-semibold">{vendorsWithLocation}</span>
              </div>
              <div className="text-xs text-green-600">محدد</div>
            </div>

            <div className="bg-red-50 px-4 py-2 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="font-semibold">{vendorsWithoutLocation}</span>
              </div>
              <div className="text-xs text-red-600">غير محدد</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/3 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="ابحث عن متجر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterNoLocation}
                onChange={(e) => setFilterNoLocation(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">عرض المتاجر بدون موقع فقط</span>
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredVendors.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Store className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>لا توجد متاجر</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredVendors.map((vendor) => {
                  const hasLocation = vendor.latitude && vendor.longitude;
                  const isSelected = selectedVendor?.id === vendor.id;

                  return (
                    <div
                      key={vendor.id}
                      onClick={() => handleVendorSelect(vendor)}
                      className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                        isSelected ? 'bg-blue-50 border-r-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {vendor.logo_url ? (
                          <img
                            src={vendor.logo_url}
                            alt={vendor.store_name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                            <Store className="w-6 h-6 text-gray-400" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {vendor.store_name}
                          </h3>
                          <p className="text-sm text-gray-600 truncate">
                            {vendor.address || 'لا يوجد عنوان'}
                          </p>

                          <div className="flex items-center gap-2 mt-1">
                            {hasLocation ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                <Check className="w-3 h-3" />
                                محدد
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">
                                <AlertCircle className="w-3 h-3" />
                                غير محدد
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative">
          {selectedVendor && (
            <div className="absolute top-4 right-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedVendor.logo_url ? (
                    <img
                      src={selectedVendor.logo_url}
                      alt={selectedVendor.store_name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                      <Store className="w-6 h-6 text-gray-400" />
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedVendor.store_name}</h3>
                    <p className="text-sm text-gray-600">{selectedVendor.address}</p>
                    {tempLocation && (
                      <p className="text-xs text-gray-500 mt-1">
                        {tempLocation[0].toFixed(6)}, {tempLocation[1].toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleUseCurrentLocation}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    موقعي
                  </button>

                  <button
                    onClick={handleSaveLocation}
                    disabled={!tempLocation || saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'جارٍ الحفظ...' : 'حفظ الموقع'}
                  </button>
                </div>
              </div>

              <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">📍 كيفية تحديد الموقع:</p>
                <ul className="text-xs space-y-1">
                  <li>• انقر على الخريطة لتحديد الموقع</li>
                  <li>• اسحب العلامة لتعديل الموقع</li>
                  <li>• أو استخدم زر "موقعي" لاستخدام موقعك الحالي</li>
                </ul>
              </div>
            </div>
          )}

          {!selectedVendor && (
            <div className="absolute inset-0 flex items-center justify-center z-[1000] bg-white bg-opacity-90">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  اختر متجراً من القائمة
                </h3>
                <p className="text-gray-600">
                  اختر متجراً لتحديد موقعه على الخريطة
                </p>
              </div>
            </div>
          )}

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
            onClick={handleMapClick}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController center={mapCenter} zoom={mapZoom} />

            {vendors.map((vendor) => {
              if (!vendor.latitude || !vendor.longitude) return null;

              const isSelected = selectedVendor?.id === vendor.id;
              const position = [vendor.latitude, vendor.longitude];

              if (isSelected && tempLocation) {
                return null;
              }

              return (
                <Marker
                  key={vendor.id}
                  position={position}
                  icon={greenIcon}
                >
                  <Popup>
                    <div className="text-right">
                      <h3 className="font-semibold">{vendor.store_name}</h3>
                      <p className="text-sm text-gray-600">{vendor.address}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {selectedVendor && tempLocation && (
              <DraggableMarker
                position={tempLocation}
                onPositionChange={handleMarkerDrag}
                icon={blueIcon}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
