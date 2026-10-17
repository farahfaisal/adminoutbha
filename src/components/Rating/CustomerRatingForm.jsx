import React, { useState } from 'react';
import { toast } from 'react-toastify';
import RatingStars from './RatingStars';
import { addRating } from '../../lib/ratingsApi';

export default function CustomerRatingForm({ orderId, driverId, customerId, onComplete }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate that driverId is provided
    if (!driverId) {
      toast.error('لا يمكن إرسال التقييم: معرف السائق مفقود');
      return;
    }

    // Validate that customerId is provided
    if (!customerId) {
      toast.error('لا يمكن إرسال التقييم: معرف الزبون مفقود');
      return;
    }

    setLoading(true);
    try {
      // Submit rating to database
      await addRating({
        order_id: orderId,
        from_type: 'driver',
        from_id: driverId,
        to_type: 'customer',
        to_id: customerId,
        rating,
        comment
      });
      
      toast.success('تم إرسال تقييم الزبون بنجاح');
      setSubmitted(true);
      onComplete?.();
    } catch (error) {
      console.error('خطأ في إرسال التقييم:', error);
      toast.error('فشل في إرسال تقييم الزبون');
    } finally {
      setLoading(false);
    }
  };

  // Don't render the form if required props are missing
  if (!driverId || !customerId) {
    return (
      <div className="bg-yellow-50 p-4 rounded-lg text-center">
        <div className="text-yellow-600 text-xl mb-2">⚠️</div>
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">لا يمكن عرض نموذج التقييم</h3>
        <p className="text-yellow-700">
          {!driverId && !customerId ? 'معرف السائق والزبون مفقودان' : 
           !driverId ? 'معرف السائق مفقود' : 'معرف الزبون مفقود'}
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="bg-green-50 p-4 rounded-lg text-center">
        <div className="text-green-600 text-xl mb-2">✓</div>
        <h3 className="text-lg font-semibold text-green-800 mb-2">تم إرسال التقييم بنجاح</h3>
        <p className="text-green-700">شكراً لك على تقييم الزبون</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">تقييم الزبون</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">التقييم</label>
          <div className="flex justify-center">
            <RatingStars
              rating={rating}
              size="lg"
              interactive={true}
              onChange={setRating}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">ملاحظات (اختياري)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            rows="3"
            placeholder="أضف ملاحظاتك حول الزبون هنا..."
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
    </div>
  );
}