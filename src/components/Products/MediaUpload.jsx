import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { uploadFile, BUCKETS } from '../../lib/supabaseStorage';

export default function MediaUpload({
  onUpload,
  type = 'image',
  accept,
  maxSize = 5242880,
  preview = null,
  bucket = BUCKETS.GENERAL,
  folder = '',
  storeInSupabase = true
}) {
  const [previewUrl, setPreviewUrl] = useState(preview);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPreviewUrl(preview);
  }, [preview]);

  const acceptedTypes = {
    image: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
    video: { 'video/*': ['.mp4', '.webm'] }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    setError(null);
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);

    try {
      if (storeInSupabase) {
        const { url, path } = await uploadFile(file, bucket, folder);
        setPreviewUrl(url);
        onUpload({
          file,
          preview: url,
          path,
          bucket,
          isSupabaseFile: true
        });
      } else {
        toast.error('يجب تفعيل storeInSupabase لتخزين الصورة');
      }
    } catch (uploadError) {
      console.error('Error uploading to Supabase:', uploadError);
      const errorMessage = uploadError.message || 'فشل رفع الملف إلى Supabase';
      toast.error(errorMessage);
      setError(errorMessage);
      onUpload({
        file: null,
        preview: null,
        isSupabaseFile: false
      });
    }

    setUploading(false);
  }, [onUpload, bucket, folder, storeInSupabase]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept || acceptedTypes[type],
    maxSize,
    multiple: false,
    onDropRejected: (rejectedFiles) => {
      const code = rejectedFiles[0]?.errors[0]?.code;
      if (code === 'file-too-large') {
        setError(`حجم الملف كبير جدًا. الحد الأقصى هو ${Math.round(maxSize / 1024 / 1024)} ميجابايت`);
      } else if (code === 'file-invalid-type') {
        setError('نوع الملف غير مدعوم');
      } else {
        setError('الملف غير صالح');
      }
    }
  });

  const handleRemove = () => {
    setPreviewUrl(null);
    onUpload({ file: null, preview: null });
  };

  const handleImageError = (e) => {
    setError('فشل في تحميل الصورة');
    e.target.onerror = null;
    e.target.src = 'https://placehold.co/200x200/e2e8f0/64748b?text=Image+Not+Found';
  };

  const handleVideoError = (e) => {
    setError('فشل في تحميل الفيديو');
    e.target.onerror = null;
    const parent = e.target.parentNode;
    if (parent) {
      parent.innerHTML = '<div class="h-48 flex items-center justify-center bg-gray-200 text-gray-500">فشل تحميل الفيديو</div>';
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}
      
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'
        } ${uploading ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} disabled={uploading} />

        {previewUrl ? (
          <div className="relative">
            {type === 'image' ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-48 mx-auto rounded"
                onError={handleImageError}
              />
            ) : (
              <video
                src={previewUrl}
                className="max-h-48 mx-auto rounded"
                controls
                onError={handleVideoError}
              />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white">تغيير {type === 'image' ? 'الصورة' : 'الفيديو'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="text-sm text-gray-600">
              {uploading ? (
                <p>جاري رفع الملف...</p>
              ) : isDragActive ? (
                <p>أفلت الملف هنا ...</p>
              ) : (
                <>
                  <p>اسحب وأفلت {type === 'image' ? 'الصورة' : 'الفيديو'} هنا، أو</p>
                  <p className="text-blue-600">اضغط للاختيار</p>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {type === 'image' ? 'PNG, JPG, GIF, WEBP' : 'MP4, WebM'} حتى {Math.round(maxSize / 1024 / 1024)} ميجابايت
            </p>
          </div>
        )}
      </div>

      {previewUrl && (
        <div className="flex justify-center">
          <button onClick={handleRemove} className="text-red-600 hover:text-red-800 text-sm">
            إزالة {type === 'image' ? 'الصورة' : 'الفيديو'}
          </button>
        </div>
      )}

      {storeInSupabase && (
        <p className="text-xs text-gray-500 text-center">سيتم تخزين الملف في Supabase Storage</p>
      )}
    </div>
  );
}