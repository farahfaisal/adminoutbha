import React from 'react';
import RatingStars from './RatingStars';

export const RatingSummary = ({ rating, count }) => {
  return (
    <div className="flex items-center space-x-2">
      <RatingStars rating={rating} size="md" />
      <div className="text-sm text-gray-500">
        ({rating.toFixed(1)}) من {count} تقييم
      </div>
    </div>
  );
}