import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ReferralCodeCard, ReferralHistory } from '../ReferralSystem';

export default function UserReferralPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [referralCode, setReferralCode] = useState(null);
  const [referralLink, setReferralLink] = useState(null);
  const [referralStats, setReferralStats] = useState({
    total_referrals: 0,
    completed_referrals: 0,
    total_points: 0
  });
  const [referrals, setReferrals] = useState([]);
  const [customerData, setCustomerData] = useState(null);

  useEffect(() => {
    if (user) {
      fetchReferralData();
    }
  }, [user]);

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      
      // First get the customer data for this user
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, name, phone, email, referral_code')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (customerError) {
        console.error('Error fetching customer data:', customerError);
      } else if (customerData) {
        setCustomerData(customerData);
        
        // If customer has a referral code, get it
        if (customerData.referral_code) {
          const { data: codeData, error: codeError } = await supabase
            .from('referral_codes')
            .select('code, referral_link')
            .eq('id', customerData.referral_code)
            .maybeSingle();
          
          if (!codeError && codeData) {
            setReferralCode(codeData.code);
            setReferralLink(codeData.referral_link);
          }
        }
      }
      
      // Try to get referral code directly
      if (!referralCode) {
        const { data: referralCodeData, error: referralCodeError } = await supabase
          .rpc('get_user_referral_code', { p_user_id: user.id });
        
        if (!referralCodeError && referralCodeData) {
          setReferralCode(referralCodeData);
          // Generate a default referral link if not available
          setReferralLink(`https://ben-edek.com/signup?ref=${referralCodeData}`);
        }
      }
      
      // Get user referral stats
      const { data: statsData, error: statsError } = await supabase.rpc(
        'get_user_referral_stats',
        { p_user_id: user.id }
      );
      
      if (statsError) {
        console.error('Error fetching referral stats:', statsError);
      } else if (statsData) {
        setReferralStats({
          total_referrals: statsData.total_referrals || 0,
          completed_referrals: statsData.completed_referrals || 0,
          total_points: statsData.total_points || 0
        });
        
        // If we got a referral code from stats but not from earlier methods
        if (statsData.active_code && !referralCode) {
          setReferralCode(statsData.active_code);
        }
        
        // If we got a referral link from stats
        if (statsData.referral_link) {
          setReferralLink(statsData.referral_link);
        }
      }
      
      // If we still don't have a referral code, create one
      if (!referralCode) {
        try {
          const { data: newCodeData, error: newCodeError } = await supabase.rpc(
            'create_user_referral_code',
            { 
              p_user_id: user.id,
              p_type: 'user',
              p_points_reward: 100,
              p_points_referrer: 50,
              p_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            }
          );
          
          if (newCodeError) {
            console.error('Error creating referral code:', newCodeError);
          } else if (newCodeData && newCodeData.success) {
            setReferralCode(newCodeData.code);
            setReferralLink(newCodeData.referral_link || `https://ben-edek.com/signup?ref=${newCodeData.code}`);
          }
        } catch (error) {
          console.error('Error creating referral code:', error);
        }
      }
      
      // Get referrals
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          *,
          referred:referred_id(
            id,
            email
          ),
          code:code_id(
            code,
            type
          )
        `)
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });
      
      if (referralsError) {
        console.error('Error fetching referrals:', referralsError);
        // Continue with empty array if there's an error
        setReferrals([]);
      } else {
        // Transform referrals data
        const transformedReferrals = (referralsData || []).map(referral => {
          // Try to get user info from referred user
          let userName = 'مستخدم جديد';
          let userEmail = null;
          let userPhone = null;
          
          if (referral.referred) {
            // Try to extract name from email (username part)
            if (referral.referred.email) {
              userEmail = referral.referred.email;
              userName = referral.referred.email.split('@')[0] || 'مستخدم جديد';
            }
            
            // Try to get more info from custom_users table
            supabase
              .from('custom_users')
              .select('name, phone')
              .eq('id', referral.referred.id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  if (data.name) userName = data.name;
                  if (data.phone) userPhone = data.phone;
                }
              })
              .catch(err => console.error('Error fetching user details:', err));
          }
          
          return {
            id: referral.id,
            user_name: userName,
            user_email: userEmail,
            user_phone: userPhone,
            status: referral.status,
            points: referral.status === 'completed' ? 50 : 0,
            created_at: referral.created_at,
            code_type: referral.code?.type || 'user'
          };
        });
        
        setReferrals(transformedReferrals);
      }
    } catch (error) {
      console.error('Error fetching referral data:', error);
      setError('فشل في تحميل بيانات الإحالة');
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = () => {
    return referralLink || `https://ben-edek.com/signup?ref=${referralCode}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-800">
        <h3 className="text-lg font-semibold mb-2">خطأ</h3>
        <p>{error}</p>
        <button 
          onClick={fetchReferralData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">نظام الإحالة</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {referralCode ? (
            <ReferralCodeCard 
              code={referralCode} 
              stats={referralStats} 
              shareUrl={getShareUrl()} 
              customerInfo={customerData}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <p className="text-gray-500">لا يوجد كود إحالة نشط</p>
              <button
                onClick={fetchReferralData}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                إنشاء كود إحالة
              </button>
            </div>
          )}
        </div>
        
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">إحصائيات الإحالة</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">إجمالي الإحالات</span>
                <span className="font-semibold">{referralStats.total_referrals}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">الإحالات المكتملة</span>
                <span className="font-semibold">{referralStats.completed_referrals}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">النقاط المكتسبة</span>
                <span className="font-semibold text-green-600">{referralStats.total_points}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">معدل التحويل</span>
                <span className="font-semibold">
                  {referralStats.total_referrals > 0 
                    ? `${Math.round((referralStats.completed_referrals / referralStats.total_referrals) * 100)}%` 
                    : '0%'}
                </span>
              </div>
            </div>
          </div>
          
          {customerData && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">معلومات العميل</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">الاسم:</span>
                  <span>{customerData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">الهاتف:</span>
                  <span>{customerData.phone}</span>
                </div>
                {customerData.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">البريد الإلكتروني:</span>
                    <span>{customerData.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8">
        <ReferralHistory referrals={referrals} />
      </div>
    </div>
  );
}