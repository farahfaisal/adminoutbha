import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { toast } from 'react-toastify';

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

export default function AddressMapModal({ isOpen, onClose, address, latitude, longitude }) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const lat = parseFloat(latitude) || 31.5017;
  const lng = parseFloat(longitude) || 34.4668;
  const position = [lat, lng];

  useEffect(() => {
    if (isOpen) {
      requestCurrentLocation();
    }
  }, [isOpen]);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation([latitude, longitude]);
        setIsGettingLocation(false);
      },
      (error) => {
        setIsGettingLocation(false);
        console.log('Could not get location:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  const getGoogleMapsLink = () => {
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const openDirections = () => {
    if (currentLocation && latitude && longitude) {
      const directionsUrl = `https://www.google.com/maps/dir/${currentLocation[0]},${currentLocation[1]}/${latitude},${longitude}`;
      window.open(directionsUrl, '_blank');
    } else {
      window.open(getGoogleMapsLink(), '_blank');
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 text-right shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-blue-600" />
                  موقع العنوان
                </Dialog.Title>

                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      {address}
                    </p>
                    {latitude && longitude && (
                      <p className="text-xs text-gray-500 mt-1">
                        الإحداثيات: {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
                      </p>
                    )}
                  </div>

                  {isGettingLocation && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg">
                      <Navigation className="w-4 h-4 animate-pulse" />
                      <span className="text-sm">جارٍ تحديد موقعك الحالي...</span>
                    </div>
                  )}

                  {currentLocation && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                      <Navigation className="w-4 h-4" />
                      <span className="text-sm">تم تحديد موقعك الحالي (العلامة الزرقاء)</span>
                    </div>
                  )}

                  <div className="w-full h-96 rounded-lg overflow-hidden border-2 border-gray-200 shadow-lg">
                    <MapContainer
                      center={position}
                      zoom={14}
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={true}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      <Marker position={position} />

                      {currentLocation && (
                        <>
                          <Marker position={currentLocation} icon={currentLocationIcon} />
                          <Circle
                            center={currentLocation}
                            radius={50}
                            pathOptions={{
                              color: '#3b82f6',
                              fillColor: '#3b82f6',
                              fillOpacity: 0.2
                            }}
                          />
                        </>
                      )}
                    </MapContainer>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={openDirections}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      {currentLocation ? 'احصل على الاتجاهات' : 'فتح في خرائط Google'}
                    </button>

                    <a
                      href={getGoogleMapsLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      فتح في نافذة جديدة
                    </a>

                    <button
                      type="button"
                      onClick={requestCurrentLocation}
                      disabled={isGettingLocation}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      {isGettingLocation ? 'جارٍ التحديد...' : 'تحديث موقعي'}
                    </button>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <button
                    type="button"
                    className="w-full sm:w-auto px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    onClick={onClose}
                  >
                    إغلاق
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}