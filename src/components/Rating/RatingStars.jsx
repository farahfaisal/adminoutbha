import React from 'react';

export default function RatingStars({ rating, size = 'md', interactive = false, onChange }) {
  // Ensure rating is a number and between 0-5
  const safeRating = typeof rating === 'number' ? Math.min(Math.max(rating, 0), 5) : 0;
  
  const renderStar = (filled, index) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6'
    };

    return (
      <button
        key={index}
        onClick={() => interactive && onChange?.(index + 1)}
        className={`${interactive ? 'cursor-pointer' : 'cursor-default'}`}
        disabled={!interactive}
        type="button"
      >
        <svg
          className={`${sizeClasses[size] || 'w-5 h-5'} ${
            filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 fill-transparent'
          } transition-colors`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </button>
    );
  };

  return (
    <div className="flex items-center space-x-1">
      {[...Array(5)].map((_, index) => renderStar(index < safeRating, index))}
    </div>
  );
}