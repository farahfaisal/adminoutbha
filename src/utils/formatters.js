import dayjs from 'dayjs';
import 'dayjs/locale/ar'; // استدعاء اللغة العربية

// Use Gregorian calendar with English locale for dates
dayjs.locale('en');

/**
 * Format file size in bytes to a human-readable string
 * @param {number} bytes
 * @returns {string}
 */
export const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Format date to a readable Gregorian date
 * @param {string|Date} date
 * @returns {string}
 */
export const formatDate = (date) => {
  if (!date) return '';
  // Format as Gregorian date with English format
  return dayjs(date).format('YYYY/MM/DD');
};

/**
 * Format time to a human-readable string (hh:mm)
 * @param {string|Date} date
 * @returns {string}
 */
export const formatTime = (date) => {
  if (!date) return '';
  return dayjs(date).format('HH:mm');
};

/**
 * Format datetime to a human-readable string (YYYY/MM/DD HH:mm)
 * @param {string|Date} date
 * @returns {string}
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  // Format as Gregorian date and time
  return dayjs(date).format('YYYY/MM/DD HH:mm');
};

/**
 * Format currency
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export const formatCurrency = (amount, currency = 'ILS') => {
  if (amount == null) return '';
  const symbols = {
    ILS: '₪',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  const symbol = symbols[currency] || '₪';
  return `${symbol}${parseFloat(amount).toFixed(2)}`;
};

/**
 * Get Hijri month name from month number
 * @param {number} month - Month number (1-12)
 * @returns {string} - Hijri month name in Arabic
 */
export const getHijriMonthName = (month) => {
  const hijriMonths = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  
  // Check if month is valid (1-12)
  if (month >= 1 && month <= 12) {
    return hijriMonths[month - 1];
  }
  
  // Return empty string for invalid month
  return '';
};