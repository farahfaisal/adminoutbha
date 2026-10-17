import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  variant_id?: string;
  variant_name?: string;
  addons?: Array<{
    id: string;
    name: string;
    price: number;
    quantity?: number;
  }>;
}

interface OrderRequest {
  customer_name: string;
  customer_phone: string;
  customer_id?: string;
  vendor_id: string;
  service_area_id: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method?: string;
  wallet_amount?: number;
  coupon_discount?: number;
  points_discount?: number;
  points_applied?: number;
  notes?: string;
  delivery_instructions?: string;
  is_scheduled?: boolean;
  scheduled_time?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const orderData: OrderRequest = await req.json();

    let calculatedSubtotal = 0;
    for (const item of orderData.items) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("price")
        .eq("id", item.product_id)
        .maybeSingle();

      if (productError || !product) {
        return new Response(
          JSON.stringify({ error: `المنتج ${item.product_name} غير موجود` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const actualPrice = parseFloat(product.price.toString());
      item.price = actualPrice;

      const baseTotal = actualPrice * item.quantity;

      let addonsTotal = 0;
      if (item.addons && item.addons.length > 0) {
        for (const addon of item.addons) {
          const { data: addonData, error: addonError } = await supabase
            .from("product_addons")
            .select("price")
            .eq("id", addon.id)
            .maybeSingle();

          if (addonError || !addonData) {
            return new Response(
              JSON.stringify({ error: `الإضافة ${addon.name} غير موجودة` }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          const actualAddonPrice = parseFloat(addonData.price.toString());
          addon.price = actualAddonPrice;

          const addonQuantity = addon.quantity || 1;
          addonsTotal += actualAddonPrice * addonQuantity;
        }
      }

      const itemTotal = baseTotal + addonsTotal;
      calculatedSubtotal += itemTotal;
    }

    orderData.subtotal = calculatedSubtotal;
    const walletAmount = orderData.wallet_amount || 0;
    orderData.total = Math.max(0, calculatedSubtotal + orderData.delivery_fee - walletAmount);

    if (!orderData.customer_name || !orderData.customer_phone) {
      return new Response(
        JSON.stringify({ error: "اسم الزبون ورقم الهاتف مطلوبان" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!orderData.vendor_id) {
      return new Response(
        JSON.stringify({ error: "معرف المتجر مطلوب" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!orderData.service_area_id) {
      return new Response(
        JSON.stringify({ error: "منطقة الخدمة مطلوبة" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!orderData.items || orderData.items.length === 0) {
      return new Response(
        JSON.stringify({ error: "يجب إضافة منتج واحد على الأقل" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: serviceArea, error: serviceAreaError } = await supabase
      .from("service_areas")
      .select("id, name, is_active")
      .eq("id", orderData.service_area_id)
      .maybeSingle();

    if (serviceAreaError || !serviceArea) {
      return new Response(
        JSON.stringify({ error: "منطقة الخدمة غير موجودة" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!serviceArea.is_active) {
      return new Response(
        JSON.stringify({ error: "منطقة الخدمة غير نشطة حالياً" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, name, is_active, estimated_delivery_time")
      .eq("id", orderData.vendor_id)
      .maybeSingle();

    if (vendorError || !vendor) {
      return new Response(
        JSON.stringify({ error: "المتجر غير موجود" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!vendor.is_active) {
      return new Response(
        JSON.stringify({ error: "المتجر غير نشط حالياً" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: vendorServiceArea, error: vendorServiceAreaError } = await supabase
      .from("vendor_service_areas")
      .select("*")
      .eq("vendor_id", orderData.vendor_id)
      .eq("service_area_id", orderData.service_area_id)
      .maybeSingle();

    if (vendorServiceAreaError || !vendorServiceArea) {
      return new Response(
        JSON.stringify({ error: "المتجر لا يقدم خدمة التوصيل لهذه المنطقة" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const orderNumber = `ORD-${timestamp}-${random}`;

    let finalDeliveryFee = orderData.delivery_fee;
    let deliveryDiscount = 0;
    let appliedOfferId = null;
    let appliedOfferTitle = null;

    if (orderData.latitude && orderData.longitude) {
      const { data: deliveryResult, error: deliveryError } = await supabase
        .rpc("calculate_delivery_fee_with_offers", {
          p_vendor_id: orderData.vendor_id,
          p_customer_lat: orderData.latitude,
          p_customer_lng: orderData.longitude,
          p_subtotal: orderData.subtotal,
        });

      if (!deliveryError && deliveryResult) {
        finalDeliveryFee = deliveryResult.final_delivery_fee || orderData.delivery_fee;
        deliveryDiscount = deliveryResult.discount || 0;
        appliedOfferId = deliveryResult.offer_id;
        appliedOfferTitle = deliveryResult.offer_title;
      }
    }

    const pointsApplied = orderData.points_applied || 0;
    const pointsDiscount = pointsApplied * 0.01; // 100 نقطة = 1 شيكل

    const order = {
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      vendor_id: orderData.vendor_id,
      vendor_name: vendor.name,
      service_area_id: orderData.service_area_id,
      address: orderData.address,
      city: orderData.city,
      latitude: orderData.latitude || null,
      longitude: orderData.longitude || null,
      items_data: orderData.items,
      subtotal: orderData.subtotal,
      delivery_fee: finalDeliveryFee,
      total: Math.max(0, orderData.subtotal + finalDeliveryFee - (orderData.wallet_amount || 0) - pointsDiscount),
      payment_method: orderData.payment_method || "cash",
      wallet_amount: orderData.wallet_amount || 0,
      coupon_discount: orderData.coupon_discount || 0,
      points_discount: pointsDiscount,
      points_applied: pointsApplied,
      notes: orderData.notes || null,
      delivery_instructions: orderData.delivery_instructions || null,
      is_scheduled: orderData.is_scheduled || false,
      scheduled_time: orderData.scheduled_time || null,
      order_number: orderNumber,
      status: "pending",
      preparation_time: vendor.estimated_delivery_time || 20,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedOrder, error: insertError } = await supabase
      .from("orders")
      .insert(order)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting order:", insertError);
      return new Response(
        JSON.stringify({ error: "فشل في إنشاء الطلب", details: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // خصم النقاط من حساب العميل إذا تم استخدامها
    if (pointsApplied > 0 && orderData.customer_id) {
      const { data: pointsAccount } = await supabase
        .from("points_accounts")
        .select("id, balance, total_spent")
        .eq("customer_id", orderData.customer_id)
        .maybeSingle();

      if (pointsAccount && pointsAccount.balance >= pointsApplied) {
        await supabase
          .from("points_accounts")
          .update({
            balance: pointsAccount.balance - pointsApplied,
            total_spent: (pointsAccount.total_spent || 0) + pointsApplied,
            last_activity: new Date().toISOString(),
          })
          .eq("id", pointsAccount.id);

        await supabase.from("points_transactions").insert({
          account_id: pointsAccount.id,
          order_id: insertedOrder.id,
          amount: pointsApplied,
          type: "spend",
          description: `استخدام نقاط على الطلب #${orderNumber}`,
        });
      }
    }

    const orderItems = orderData.items.map((item) => {
      // حساب total لكل منتج: (السعر × الكمية) + مجموع الإضافات
      const baseTotal = item.price * item.quantity;

      let addonsTotal = 0;
      if (item.addons && item.addons.length > 0) {
        for (const addon of item.addons) {
          const addonQuantity = addon.quantity || 1;
          addonsTotal += addon.price * addonQuantity;
        }
      }

      const itemTotal = baseTotal + addonsTotal;

      return {
        order_id: insertedOrder.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        variant_id: item.variant_id || null,
        variant_name: item.variant_name || null,
        addons_data: item.addons || [],
        total: itemTotal,  // إضافة المبلغ الإجمالي المحسوب
        vendor_id: orderData.vendor_id,
        vendor_name: vendor.name,
      };
    });

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Error inserting order items:", itemsError);
      await supabase.from("orders").delete().eq("id", insertedOrder.id);
      return new Response(
        JSON.stringify({ error: "فشل في إضافة عناصر الطلب", details: itemsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "تم إنشاء الطلب بنجاح",
        order: insertedOrder,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing order:", error);
    return new Response(
      JSON.stringify({ error: "حدث خطأ في معالجة الطلب", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});