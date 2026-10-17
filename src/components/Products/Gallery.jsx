import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import MediaUpload from './MediaUpload';

export default function Gallery({ images = [], onUpdate }) {
  const [error, setError] = useState(null);

  const handleAddImage = ({ base64, preview, file }) => {
    setError(null);
    try {
      onUpdate([...images, { 
        id: uuidv4(), 
        file: base64,
        preview,
        name: file.name,
        size: file.size,
        type: file.type,
        isNew: true 
      }]);
    } catch (err) {
      setError('فشل في إضافة الصورة');
      console.error('Error adding image:', err);
    }
  };

  const handleRemoveImage = (imageId) => {
    onUpdate(images.filter(img => img.id !== imageId));
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((image) => (
          <div key={image.id} className="relative group">
            <img
              src={image.preview || image.url}
              alt={image.name || "Gallery image"}
              className="w-full h-32 object-cover rounded-lg"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/150?text=Image+Error';
              }}
            />
            <button
              onClick={() => handleRemoveImage(image.id)}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      
      <MediaUpload 
        onUpload={handleAddImage} 
        type="image"
        accept={{
          'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
        }}
        maxSize={2 * 1024 * 1024} // 2MB
      />
      
      <p className="text-sm text-gray-500 mt-2">
        يمكنك إضافة حتى 10 صور للمنتج. الحد الأقصى لحجم الصورة 2 ميجابايت.
      </p>
    </div>
  );
}