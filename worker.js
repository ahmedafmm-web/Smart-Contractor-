export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ success: false, message: "Method Not Allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const SUPABASE_URL = "https://lwffkzdkvafyuwrcbzl.supabase.co";
      const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZmZra3pka3ZhZnl1d3JjYnpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM4NDk3NSwiZXhwIjoyMDk5OTYwOTc1fQ.Kg8RxKkkkHI6WAKUg1FDrc9t5hQEG68Hu46p5pHxbvw";

      // معرف البائع الخاص بك للتحقق الصارم من مصدر الطلب
      const VALID_SELLER_ID = "wE74f-9ZMTyzJBxWuOVB8w==";

      const rawText = await request.text();
      const params = new URLSearchParams(rawText);

      // 1. التحقق الصارم من بيانات المعاملة المالية
      const sellerId = params.get("seller_id");
      const saleId = params.get("sale_id");
      const isRefunded = params.get("refunded");
      const isDisputed = params.get("disputed");

      // الرفض الفوري إذا لم تكن عملية بيع رسمية ومؤكدة وغير مسترجعة
      if (
        sellerId !== VALID_SELLER_ID ||
        !saleId ||
        isRefunded === "true" ||
        isDisputed === "true"
      ) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Rejected: Invalid, unverified, or refunded transaction." 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. استخراج Device ID من الحقول المخصصة بدقة
      let deviceId = "";
      for (const [key, value] of params.entries()) {
        const decodedKey = decodeURIComponent(key).toLowerCase();
        if (decodedKey.includes("device") || decodedKey.includes("جهاز")) {
          deviceId = value.trim();
          break;
        }
      }

      if (!deviceId) {
        const regexMatch = rawText.match(/(?:Device(?:%20|\+|_)ID|device_id)=([^&]+)/i);
        if (regexMatch && regexMatch[1]) {
          deviceId = decodeURIComponent(regexMatch[1].replace(/\+/g, " ")).trim();
        }
      }

      // الرفض التام إذا لم يُدخل المشتري كود جهازه
      if (!deviceId) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Rejected: Missing valid Device ID from customer." 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      deviceId = deviceId.toUpperCase();

      // 3. احتساب مدة الاشتراك بناءً على نوع الباقة المشتراة
      const now = new Date();
      const rawLower = rawText.toLowerCase();
      if (rawLower.includes("yearly") || rawLower.includes("799") || rawLower.includes("sc-yearly")) {
        now.setFullYear(now.getFullYear() + 1);
      } else {
        now.setMonth(now.getMonth() + 1);
      }

      // 4. تفعيل الجهاز المؤكد فقط في Supabase
      const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/users?on_conflict=device_id`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify([{
          device_id: deviceId,
          is_subscribed: true,
          subscription_expires_at: now.toISOString(),
          trial_expires_at: null,
          last_transaction_id: String(saleId),
          failed_attempts: 0
        }])
      });

      const responseBody = await supabaseRes.text();

      return new Response(JSON.stringify({
        success: supabaseRes.ok,
        activated_device: deviceId,
        transaction: saleId
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
