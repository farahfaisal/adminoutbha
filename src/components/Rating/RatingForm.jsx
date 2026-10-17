import React, { useState } from 'react';
import { toast } from 'react-toastify';
import RatingStars from './RatingStars';
import { addRating } from '../../lib/ratingsApi';

export default function RatingForm({ orderId, fromType, fromId, toType, toId, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!rating) {
      toast.error('الرجاء اختيار تقييم');
      return;
    }

    setLoading(true);
    try {
      await addRating({
        order_id: orderId,
        from_type: fromType,
        from_id: fromId,
        to_type: toType,
        to_id: toId,
        rating,
        comment
      });

      toast.success('تم إرسال التقييم بنجاح');
      onSubmit?.();
      setRating(5);
      setComment('');
    } catch (error) {
      console.error('خطأ في إرسال التقييم:', error);
      toast.error('فشل في إرسال التقييم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">إضافة تقييم</h3>
      
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">التقييم</label>
        <RatingStars
          rating={rating}
          size="lg"
          interactive={true}
          onChange={setRating}
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">تعليق</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          rows="3"
          placeholder="أضف تعليقك هنا (اختياري)"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors ${
          loading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {loading ? 'جاري الإرسال...' : 'إرسال التقييم'}
      </button>
    </form>
  );
}