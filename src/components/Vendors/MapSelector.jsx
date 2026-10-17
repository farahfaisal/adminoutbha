import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { toast } from 'react-toastify';
import { Navigation, MapPin } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const currentLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapController({ center, currentLocation }) {
  const map = useMap();

  useEffect(() => {
    if (currentLocation) {
      map.setView(currentLocation, 15);
    } else if (center) {
      map.setView(center, 10);
    }
  }, [map, center, currentLocation]);

  return null;
}

function DraggableMarker({ position, onPositionChange }) {
  return (
    <Marker
      position={position}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const position = marker.getLatLng();
          onPositionChange(position.lat, position.lng);
        },
      }}
    />
  );
}

export default function MapSelector({ initialLat, initialLng, onLocationSelect }) {
  const defaultLat = initialLat || 31.5017;
  const defaultLng = initialLng || 34.4668;
  const [position, setPosition] = useState([defaultLat, defaultLng]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error('المتصفح الخاص بك لا يدعم تحديد الموقع');
      setLocationError('المتصفح لا يدعم تحديد الموقع');
      return;
    }

    setIsGettingLocation(true);
    toast.info('جارٍ الحصول على موقعك الحالي...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = [latitude, longitude];
        setCurrentLocation(newLocation);
        setPosition(newLocation);
        setLocationError(null);
        setIsGettingLocation(false);
        toast.success('تم تحديد موقعك الحالي بنجاح');

        if (onLocationSelect) {
          onLocationSelect(latitude, longitude);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        let errorMessage = 'فشل في الحصول على الموقع';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'تم رفض الإذن للوصول إلى الموقع. يرجى السماح بالوصول إلى الموقع في إعدادات المتصفح.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'معلومات الموقع غير متوفرة';
            break;
          case error.TIMEOUT:
            errorMessage = 'انتهت مهلة طلب الموقع';
            break;
          default:
            errorMessage = 'حدث خطأ غير معروف';
        }

        setLocationError(errorMessage);
        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const handleMapClick = (e) => {
    const newPosition = [e.latlng.lat, e.latlng.lng];
    setPosition(newPosition);
    onLocationSelect(e.latlng.lat, e.latlng.lng);
  };

  const handlePositionChange = (lat, lng) => {
    const newPosition = [lat, lng];
    setPosition(newPosition);
    onLocationSelect(lat, lng);
  };

  const handleUseCurrentLocation = () => {
    if (currentLocation) {
      setPosition(currentLocation);
      onLocationSelect(currentLocation[0], currentLocation[1]);
      toast.success('تم استخدام موقعك الحالي');
    } else {
      requestLocation();
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isGettingLocation}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <Navigation className="w-4 h-4" />
          {isGettingLocation ? 'جارٍ تحديد الموقع...' : 'استخدم موقعي الحالي'}
        </button>

        {currentLocation && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">تم تحديد موقعك</span>
          </div>
        )}

        {locationError && (
          <div className="w-full p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {locationError}
          </div>
        )}
      </div>

      <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-300">
        <MapContainer
          center={position}
          zoom={currentLocation ? 15 : 10}
          style={{ height: '100%', width: '100%' }}
          onClick={handleMapClick}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController center={position} currentLocation={currentLocation} />

          <DraggableMarker
            position={position}
            onPositionChange={handlePositionChange}
          />

          {currentLocation && currentLocation !== position && (
            <>
              <Marker position={currentLocation} icon={currentLocationIcon} />
              <Circle
                center={currentLocation}
                radius={100}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.1
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <p className="text-sm text-gray-600 text-right">
        اسحب العلامة أو انقر على الخريطة لتحديد الموقع
      </p>
    </div>
  );
}