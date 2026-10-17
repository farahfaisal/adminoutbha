import React from 'react';
import { useNavigate } from 'react-router-dom';

function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-sm hover:shadow-md group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">رجوع</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">سياسة الخصوصية</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 px-8 py-12 text-white">
            <div className="max-w-4xl mx-auto text-center">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold mb-4">التزامنا بحماية خصوصيتك</h2>
              <p className="text-xl text-blue-100">نحن نقدر ثقتك ونلتزم بحماية معلوماتك الشخصية</p>
            </div>
          </div>

          <div className="px-8 py-12 space-y-8">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">مقدمة</h3>
                  <p className="text-gray-700 leading-relaxed">
                    نحن في منصتنا نلتزم بحماية خصوصيتك وأمان معلوماتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية المعلومات التي نحصل عليها عند استخدامك لخدماتنا. باستخدامك لمنصتنا، فإنك توافق على الممارسات الموضحة في هذه السياسة.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">المعلومات التي نجمعها</h3>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">1</span>
                        معلومات الحساب
                      </h4>
                      <p className="text-gray-700 mr-8">الاسم، البريد الإلكتروني، رقم الهاتف، وكلمة المرور المشفرة.</p>
                    </div>
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">2</span>
                        معلومات الطلبات
                      </h4>
                      <p className="text-gray-700 mr-8">تفاصيل الطلبات، عنوان التوصيل، تفضيلات الدفع، وسجل المعاملات.</p>
                    </div>
                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-6 h-6 bg-violet-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">3</span>
                        معلومات الموقع
                      </h4>
                      <p className="text-gray-700 mr-8">موقع التوصيل لتحسين الخدمة وتتبع الطلبات.</p>
                    </div>
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">4</span>
                        معلومات الجهاز والاستخدام
                      </h4>
                      <p className="text-gray-700 mr-8">نوع الجهاز، نظام التشغيل، عنوان IP، وسلوك الاستخدام لتحسين الخدمة.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">كيفية استخدام المعلومات</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-gray-700">معالجة وتنفيذ طلباتك وتوصيلها</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-gray-700">التواصل معك بشأن طلباتك والعروض الترويجية</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-gray-700">تحسين خدماتنا وتجربة المستخدم</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-gray-700">منع الاحتيال وضمان أمان المنصة</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-gray-700">الامتثال للمتطلبات القانونية والتنظيمية</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">مشاركة المعلومات</h3>
                  <div className="space-y-3">
                    <p className="text-gray-700 mb-3">نحن لا نبيع معلوماتك الشخصية. قد نشارك معلوماتك فقط في الحالات التالية:</p>
                    <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                      <svg className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">مع المتاجر والسائقين</p>
                        <p className="text-gray-600 text-sm">لتنفيذ وتوصيل طلباتك بنجاح</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                      <svg className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">مع مقدمي الخدمات الموثوقين</p>
                        <p className="text-gray-600 text-sm">مثل معالجات الدفع وخدمات الاستضافة (تحت اتفاقيات سرية)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                      <svg className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">للامتثال القانوني</p>
                        <p className="text-gray-600 text-sm">عند الضرورة للامتثال للقانون أو حماية حقوقنا</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">حماية المعلومات</h3>
                  <div className="space-y-3">
                    <p className="text-gray-700 mb-3">نتخذ تدابير أمنية صارمة لحماية معلوماتك:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="text-gray-700 text-sm">تشفير SSL/TLS</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="text-gray-700 text-sm">تشفير كلمات المرور</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="text-gray-700 text-sm">خوادم آمنة</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="text-gray-700 text-sm">مراقبة مستمرة</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="text-gray-700 text-sm">وصول محدود للبيانات</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="text-gray-700 text-sm">نسخ احتياطي منتظم</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">حقوقك</h3>
                  <div className="space-y-3">
                    <p className="text-gray-700 mb-3">لديك الحق في:</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-xl border border-pink-100">
                        <svg className="w-5 h-5 text-pink-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <p className="text-gray-700">الوصول إلى معلوماتك الشخصية ومراجعتها</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-xl border border-pink-100">
                        <svg className="w-5 h-5 text-pink-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <p className="text-gray-700">تصحيح أو تحديث معلوماتك</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-xl border border-pink-100">
                        <svg className="w-5 h-5 text-pink-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <p className="text-gray-700">حذف حسابك ومعلوماتك الشخصية</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-xl border border-pink-100">
                        <svg className="w-5 h-5 text-pink-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        <p className="text-gray-700">الاعتراض على معالجة معلوماتك</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-xl border border-pink-100">
                        <svg className="w-5 h-5 text-pink-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        <p className="text-gray-700">تنزيل نسخة من بياناتك</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">الاحتفاظ بالبيانات</h3>
                  <p className="text-gray-700">
                    نحتفظ بمعلوماتك الشخصية طالما كان حسابك نشطاً أو حسب الحاجة لتقديم خدماتنا. قد نحتفظ ببعض المعلومات للوفاء بالتزاماتنا القانونية، أو حل النزاعات، أو إنفاذ اتفاقياتنا. عند حذف حسابك، سنقوم بحذف أو إخفاء هوية معلوماتك الشخصية، ما لم يكن من الضروري الاحتفاظ بها لأسباب قانونية.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">التغييرات على سياسة الخصوصية</h3>
                  <p className="text-gray-700">
                    قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر. سنقوم بإشعارك بأي تغييرات جوهرية من خلال نشر السياسة الجديدة على هذه الصفحة وتحديث تاريخ "آخر تحديث". نشجعك على مراجعة هذه السياسة بشكل دوري للبقاء على اطلاع بكيفية حماية معلوماتك.
                  </p>
                  <div className="mt-4 p-4 bg-cyan-50 rounded-xl border border-cyan-200">
                    <p className="text-sm text-cyan-900 flex items-center gap-2">
                      <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-semibold">آخر تحديث:</span>
                      <span>ديسمبر 2024</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 rounded-2xl p-8 shadow-lg text-white">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-3">تواصل معنا</h3>
                  <p className="text-blue-100 mb-4">
                    إذا كانت لديك أي أسئلة أو مخاوف بشأن سياسة الخصوصية هذه أو ممارساتنا الخاصة بالبيانات، يرجى الاتصال بنا:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">privacy@example.com</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="font-medium">+970 XXX XXX XXX</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600 text-sm">
            بمتابعة استخدام خدماتنا، فإنك توافق على سياسة الخصوصية هذه
          </p>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
