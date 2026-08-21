export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

      const rawText = await request.text();
      let body = {};

      try {
        body = JSON.parse(rawText);
      } catch (e) {
        const params = new URLSearchParams(rawText);
        for (const [key, value] of params.entries()) {
          body[key] = value;
        }
      }

      // 1. تفعيل التجربة المجانية من واجهة البرنامج (Trial)
      if (body.action === "activate_trial") {
        const deviceId = (body.device_id || "").trim().toUpperCase();
        if (!deviceId) {
          return new Response(JSON.stringify({ success: false, message: "Missing Device ID" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const now = new Date();
        now.setHours(now.getHours() + 48);

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
            is_subscribed: false,
            subscription_expires_at: null,
            trial_expires_at: now.toISOString(),
            failed_attempts: 0
          }])
        });

        return new Response(await supabaseRes.text(), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. التحقق الصارم من إشعار الشراء الحقيقي من Gumroad
      const isGumroadSale = body.sale_id && body.seller_id && body.refunded !== "true" && body.refunded !== true;
      const isTestPing = (body.test === "true" || body.test === true) && body.seller_id;

      if (!isGumroadSale && !isTestPing) {
        return new Response(JSON.stringify({ success: false, message: "Ignored: Not a valid paid sale" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // استخراج Device ID من الحقول المخصصة
      let deviceId = "";
      for (const [key, value] of Object.entries(body)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("device") || lowerKey.includes("جهاز")) {
          deviceId = value;
          break;
        }
      }

      if (!deviceId) {
        const regexMatch = rawText.match(/(?:custom_fields%5B|custom_fields\[)(?:Device\+ID|device_id|Device%20ID)[^=]*=([^&]+)/i);
        if (regexMatch && regexMatch[1]) {
          deviceId = decodeURIComponent(regexMatch[1].replace(/\+/g, " "));
        }
      }

      // إذا لم يتوفر كود جهاز (مثل الـ Test Ping العام) نستخدم معرف البيع كمعرف للجهاز
      if (!deviceId) {
        deviceId = `TEST-DEV-${body.sale_id || "PING"}`;
      }

      deviceId = String(deviceId).trim().toUpperCase();

      // تحديد مدة الاشتراك بناءً على نوع المنتج
      const now = new Date();
      const permalink = (body.product_permalink || body.permalink || "").toLowerCase();
      if (permalink.includes("yearly") || permalink.includes("799")) {
        now.setFullYear(now.getFullYear() + 1);
      } else {
        now.setMonth(now.getMonth() + 1);
      }

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
          last_transaction_id: String(body.sale_id || "TEST_PING"),
          failed_attempts: 0
        }])
      });

      const resData = await supabaseRes.text();
      return new Response(JSON.stringify({ success: supabaseRes.ok, device: deviceId, details: resData }), {
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
