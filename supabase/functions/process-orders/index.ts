import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settingsRow, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError) throw settingsError;

    const settings = settingsRow?.settings;
    const autoProcessingEnabled = settings?.orders?.autoProcessing === true;

    if (!autoProcessingEnabled) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "المعالجة التلقائية معطلة. يرجى تفعيلها من الإعدادات.",
          autoProcessing: false,
          processedCount: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;
    const errors: any[] = [];

    // ==============================
    // 1. الطلبات العادية
    // ==============================
    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    for (const order of pendingOrders || []) {
      try {
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "waiting-for-driver", updated_at: new Date().toISOString() })
          .eq("id", order.id);

        if (updateError) { errors.push({ type: "order", id: order.id, error: updateError.message }); continue; }

        await supabase.from("driver_waiting_list").insert({
          order_id: order.id,
          vendor_id: order.vendor_id,
          total: order.total,
          status: "pending",
          created_at: new Date().toISOString()
        });

        processedCount++;
      } catch (e) {
        errors.push({ type: "order", id: order.id, error: String(e) });
      }
    }

    // ==============================
    // 2. طلبات الطرود
    // ==============================
    const { data: pendingParcels } = await supabase
      .from("parcel_orders")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    for (const parcel of pendingParcels || []) {
      try {
        const { error: updateError } = await supabase
          .from("parcel_orders")
          .update({ status: "waiting-for-driver", updated_at: new Date().toISOString() })
          .eq("id", parcel.id);

        if (updateError) { errors.push({ type: "parcel", id: parcel.id, error: updateError.message }); continue; }

        await supabase.from("driver_waiting_list").insert({
          parcel_order_id: parcel.id,
          vendor_id: null,
          total: parcel.delivery_fee,
          status: "pending",
          created_at: new Date().toISOString(),
          geocoded_latitude: parcel.sender_latitude,
          geocoded_longitude: parcel.sender_longitude
        });

        processedCount++;
      } catch (e) {
        errors.push({ type: "parcel", id: parcel.id, error: String(e) });
      }
    }

    // ==============================
    // 3. طلبات الكابتن
    // ==============================
    const { data: pendingCaptain } = await supabase
      .from("captain_orders")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    for (const captain of pendingCaptain || []) {
      try {
        const { error: updateError } = await supabase
          .from("captain_orders")
          .update({ status: "waiting-for-driver", updated_at: new Date().toISOString() })
          .eq("id", captain.id);

        if (updateError) { errors.push({ type: "captain", id: captain.id, error: updateError.message }); continue; }

        await supabase.from("driver_waiting_list").insert({
          captain_order_id: captain.id,
          vendor_id: null,
          total: captain.total,
          status: "pending",
          created_at: new Date().toISOString(),
          geocoded_latitude: captain.pickup_latitude,
          geocoded_longitude: captain.pickup_longitude
        });

        processedCount++;
      } catch (e) {
        errors.push({ type: "captain", id: captain.id, error: String(e) });
      }
    }

    const totalPending = (pendingOrders?.length || 0) + (pendingParcels?.length || 0) + (pendingCaptain?.length || 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `تمت معالجة ${processedCount} من أصل ${totalPending} طلب`,
        autoProcessing: true,
        processedCount,
        totalOrders: totalPending,
        breakdown: {
          orders: pendingOrders?.length || 0,
          parcels: pendingParcels?.length || 0,
          captain: pendingCaptain?.length || 0
        },
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || String(error), autoProcessing: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
