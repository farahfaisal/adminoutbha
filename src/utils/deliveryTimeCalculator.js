const EARTH_RADIUS_KM = 6371;

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

export function calculateEstimatedDeliveryTime(
  vendorLat,
  vendorLng,
  customerLat,
  customerLng,
  options = {}
) {
  if (!vendorLat || !vendorLng || !customerLat || !customerLng) {
    return null;
  }

  const {
    averageSpeedKmh = 30,
    preparationTimeMinutes = 15,
    bufferTimeMinutes = 5
  } = options;

  const distanceKm = calculateDistance(
    vendorLat,
    vendorLng,
    customerLat,
    customerLng
  );

  const travelTimeMinutes = (distanceKm / averageSpeedKmh) * 60;

  const totalTimeMinutes = Math.ceil(
    preparationTimeMinutes + travelTimeMinutes + bufferTimeMinutes
  );

  return {
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    travelTimeMinutes: Math.ceil(travelTimeMinutes),
    preparationTimeMinutes,
    bufferTimeMinutes,
    totalTimeMinutes,
    estimatedDeliveryTime: formatDeliveryTime(totalTimeMinutes)
  };
}

function formatDeliveryTime(minutes) {
  if (minutes < 60) {
    return `${minutes} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return hours === 1 ? 'ساعة واحدة' : `${hours} ساعات`;
  }

  return `${hours} ساعة و ${remainingMinutes} دقيقة`;
}

export function getDeliveryTimeRange(totalMinutes) {
  const minTime = totalMinutes;
  const maxTime = totalMinutes + 10;

  return {
    min: formatDeliveryTime(minTime),
    max: formatDeliveryTime(maxTime),
    range: `${formatDeliveryTime(minTime)} - ${formatDeliveryTime(maxTime)}`
  };
}

export function canDeliver(vendorLat, vendorLng, customerLat, customerLng, maxRadiusKm) {
  if (!vendorLat || !vendorLng || !customerLat || !customerLng) {
    return false;
  }

  const distanceKm = calculateDistance(
    vendorLat,
    vendorLng,
    customerLat,
    customerLng
  );

  return distanceKm <= maxRadiusKm;
}
