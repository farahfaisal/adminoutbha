import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WorkingHours {
  [key: string]: {
    enabled: boolean;
    open: string | null;
    close: string | null;
  };
}

interface Holiday {
  date: string;
  name: string;
  type: string;
}

interface Vendor {
  id: string;
  store_name: string;
  status: string;
  working_hours: WorkingHours;
  holidays: Holiday[];
  auto_status_change: boolean;
  timezone: string;
}

function getDayName(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

function isHoliday(date: Date, holidays: Holiday[]): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return holidays.some(holiday => holiday.date === dateStr);
}

function shouldBeOpen(vendor: Vendor): boolean {
  try {
    // إذا كان التغيير التلقائي معطل، لا نغير الحالة
    if (!vendor.auto_status_change) {
      return vendor.status === 'active';
    }

    const now = new Date();
    const dayName = getDayName(now);

    // فحص إذا كان اليوم عطلة
    if (isHoliday(now, vendor.holidays || [])) {
      return false;
    }

    const daySchedule = vendor.working_hours[dayName];
    
    // إذا كان اليوم معطل
    if (!daySchedule || !daySchedule.enabled) {
      return false;
    }

    // فحص الوقت الحالي
    const currentTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: vendor.timezone || 'Asia/Gaza',
      hour: '2-digit',
      minute: '2-digit'
    });

    const openTime = daySchedule.open;
    const closeTime = daySchedule.close;

    if (!openTime || !closeTime) {
      return false;
    }

    // مقارنة الأوقات
    return currentTime >= openTime && currentTime < closeTime;
  } catch (error) {
    console.error('Error checking if vendor should be open:', error);
    return vendor.status === 'active';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // جلب جميع البائعين الذين لديهم تفعيل التغيير التلقائي
    const { data: vendors, error: fetchError } = await supabase
      .from('vendors')
      .select('id, store_name, status, working_hours, holidays, auto_status_change, timezone')
      .eq('auto_status_change', true);

    if (fetchError) {
      throw fetchError;
    }

    const updates: { id: string; name: string; oldStatus: string; newStatus: string }[] = [];
    const errors: { id: string; name: string; error: string }[] = [];

    // تحديث حالة كل بائع
    for (const vendor of vendors || []) {
      try {
        const shouldOpen = shouldBeOpen(vendor as Vendor);
        const newStatus = shouldOpen ? 'active' : 'inactive';

        // تحديث فقط إذا كانت الحالة مختلفة
        if (vendor.status !== newStatus) {
          const { error: updateError } = await supabase
            .from('vendors')
            .update({ status: newStatus })
            .eq('id', vendor.id);

          if (updateError) {
            errors.push({
              id: vendor.id,
              name: vendor.store_name,
              error: updateError.message
            });
          } else {
            updates.push({
              id: vendor.id,
              name: vendor.store_name,
              oldStatus: vendor.status,
              newStatus
            });
          }
        }
      } catch (error) {
        errors.push({
          id: vendor.id,
          name: vendor.store_name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `تم فحص ${vendors?.length || 0} متجر`,
        updates,
        errors,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error in update-vendor-status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
