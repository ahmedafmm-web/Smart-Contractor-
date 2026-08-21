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
        return new Response(JSON.stringify({ success: false }), { status: 405, headers: corsHeaders });
      }

      const SUPABASE_URL = "https://lwffkzdkvafyuwrcbzl.supabase.co";
      const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZmZra3pka3ZhZnl1d3JjYnpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM4NDk3NSwiZXhwIjoyMDk5OTYwOTc1fQ.Kg8RxKkkkHI6WAKUg1FDrc9t5hQEG68Hu46p5pHxbvw";

      const rawText = await request.text();
      const params = new URLSearchParams(rawText);

      // استخراج sale_id
      const saleId = params.get("sale_id");
      const isRefunded = params.get("refunded");

      if (!saleId || isRefunded === "true") {
        return new Response(JSON.stringify({ success: false, message: "Ignored: No valid sale" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // استخراج Device ID الدقيق من صيغة Gumroad الرسمية: custom_fields[Device ID]
      let deviceId = "";

      // 1. فحص مباشر من الـ params
      for (const [key, value] of params.entries()) {
        if (key.toLowerCase().includes("device") || key.includes("custom_fields")) {
          if (value && value.trim()) {
            deviceId = value.trim();
            break;
          }
        }
      }

      // 2. فحص عبر Regex من النص الأصلي المشفر
      if (!deviceId) {
        const match = rawText.match(/custom_fields(?:%5B|\[)(?:Device(?:\+|\%20|_)ID|device_id)(?:%5D|\])=([^&]+)/i) ||
                      rawText.match(/(?:Device(?:\+|\%20|_)ID|device_id)=([^&]+)/i);
        if (match && match[1]) {
          deviceId = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
        }
      }

      if (!deviceId) {
        return new Response(JSON.stringify({ success: false, message: "Missing device_id" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      deviceId = deviceId.toUpperCase();

      // تحديد المدة بناءً على نوع الخطة (سنة أو شهر)
      const now = new Date();
      const rawLower = rawText.toLowerCase();
      if (rawLower.includes("yearly") || rawLower.includes("799") || rawLower.includes("sc-yearly")) {
        now.setFullYear(now.getFullYear() + 1);
      } else {
        now.setMonth(now.getMonth() + 1);
      }

      // التحديث والتفعيل في Supabase
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

      const resText = await supabaseRes.text();

      return new Response(JSON.stringify({
        success: supabaseRes.ok,
        device: deviceId,
        supabase: resText
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
