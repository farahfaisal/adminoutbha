import React, { useState, useEffect } from 'react';
import RatingStars from './RatingStars';
import { getRatingsByType } from '../../lib/ratingsApi';

export const RatingsList = ({ type, id }) => {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRatings();
  }, [type, id]);

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const data = await getRatingsByType(type, id);
      setRatings(data);
      setError(null);
    } catch (error) {
      console.error('خطأ في جلب التقييمات:', error);
      setError('فشل في تحميل التقييمات');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-800 p-4 rounded-lg">
        <p>{error}</p>
        <button
          onClick={fetchRatings}
          className="mt-2 text-sm text-red-600 hover:text-red-800"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (ratings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        لا توجد تقييمات بعد
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ratings.map((rating) => (
        <div key={rating.id} className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-medium">{rating.from_name}</p>
              <p className="text-gray-500 text-sm">
                {new Date(rating.created_at).toLocaleDateString('ar-SA')}
              </p>
            </div>
            <RatingStars rating={rating.rating} size="sm" />
          </div>
          {rating.comment && (
            <p className="text-gray-700 mt-2">{rating.comment}</p>
          )}
        </div>
      ))}
    </div>
  );
}