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

      const SUPABASE_URL = (env.SUPABASE_URL || "https://lwffkzdkvafyuwrcbzl.supabase.co").trim();
      const SUPABASE_SERVICE_ROLE_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZmZra3pka3ZhZnl1d3JjYnpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM4NDk3NSwiZXhwIjoyMDk5OTYwOTc1fQ.Kg8RxKkkkHI6WAKUg1FDrc9t5hQEG68Hu46p5pHxbvw").trim();

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

      // طباعة كامل البيانات في الـ Logs لتراها في Cloudflare
      console.log("--- GUMROAD RAW BODY RECEIVED ---");
      console.log(rawText);
      console.log("--- PARSED BODY KEYS ---", Object.keys(body));

      // 1. استقبال طلبات Gumroad
      const isGumroad = body.seller_id || body.product_permalink || body.sale_id || body.order_number || rawText.includes("seller_id") || rawText.includes("product_permalink");

      if (isGumroad) {
        let deviceId = "";

        // فحص المفاتيح
        for (const [key, value] of Object.entries(body)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("device") || lowerKey.includes("جهاز")) {
            deviceId = value;
            if (deviceId) break;
          }
        }

        // فحص الـ Regex
        if (!deviceId) {
          const match = rawText.match(/custom_fields%5BDevice\+ID%5D=([^&]+)/i) || 
                        rawText.match(/custom_fields\[Device ID\]=([^&]+)/i) ||
                        rawText.match(/Device\+ID=([^&]+)/i) ||
                        rawText.match(/device_id=([^&]+)/i);
          if (match && match[1]) {
            deviceId = decodeURIComponent(match[1].replace(/\+/g, " "));
          }
        }

        const saleId = body.sale_id || body.order_number || `SALE_${Date.now()}`;

        // إذا لم يعثر على كود جهاز، يسجل رقم العملية كمعرف مؤقت بدلاً من التجاهل
        if (!deviceId) {
          deviceId = `GUMROAD-AUTO-${saleId}`;
        }

        deviceId = String(deviceId).trim().toUpperCase();

        const now = new Date();
        const permalink = (body.product_permalink || body.permalink || body.product_name || rawText || "").toLowerCase();

        if (permalink.includes("yearly") || permalink.includes("799") || permalink.includes("sc-yearly")) {
          now.setFullYear(now.getFullYear() + 1);
        } else {
          now.setMonth(now.getMonth() + 1);
        }

        const subExpiry = now.toISOString();
        const supabaseEndpoint = `${SUPABASE_URL}/rest/v1/users?on_conflict=device_id`;

        const supabaseRes = await fetch(supabaseEndpoint, {
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
            subscription_expires_at: subExpiry,
            trial_expires_at: null,
            last_transaction_id: String(saleId)
          }])
        });

        const resData = await supabaseRes.text();
        console.log(`[Supabase Response (${supabaseRes.status})]:`, resData);

        return new Response(JSON.stringify({ 
          success: supabaseRes.ok, 
          saved_device: deviceId, 
          status: supabaseRes.status,
          supabase_response: resData 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. تفعيل التجربة المجانية (48 ساعة)
      if (body.action === "activate_trial") {
        const deviceId = (body.device_id || "").trim().toUpperCase();
        if (!deviceId) {
          return new Response(JSON.stringify({ success: false, message: "يرجى إدخال كود الجهاز." }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const now = new Date();
        now.setHours(now.getHours() + 48);
        const trialExpiry = now.toISOString();

        const supabaseEndpoint = `${SUPABASE_URL}/rest/v1/users?on_conflict=device_id`;
        const supabaseRes = await fetch(supabaseEndpoint, {
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
            trial_expires_at: trialExpiry
          }])
        });

        const resData = await supabaseRes.text();
        return new Response(JSON.stringify({ success: supabaseRes.ok, details: resData }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ success: false, message: "Invalid Action" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      console.log("[Worker Error]:", err.message);
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
