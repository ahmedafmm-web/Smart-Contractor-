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

      // قراءة الطلب كنص خام أولاً
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

      // ----------------------------------------------------
      // 1. معالجة إشعار Gumroad واستخراج كود الجهاز بكل الطرق الممكنة
      // ----------------------------------------------------
      const isGumroad = body.seller_id || body.product_permalink || body.sale_id || body.order_number || rawText.includes("seller_id") || rawText.includes("product_permalink");

      if (isGumroad) {
        let deviceId = "";

        // أ) البحث داخل المفاتيح المقروءة
        for (const [key, value] of Object.entries(body)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("device") || lowerKey.includes("جهاز")) {
            deviceId = value;
            if (deviceId) break;
          }
        }

        // ب) فحص url_params إن وجد
        if (!deviceId && body.url_params) {
          try {
            const urlParams = typeof body.url_params === "string" ? new URLSearchParams(body.url_params) : new URLSearchParams(JSON.stringify(body.url_params));
            deviceId = urlParams.get("Device ID") || urlParams.get("device_id") || urlParams.get("device") || "";
          } catch (e) {}
        }

        // ج) استخراج مباشر بالـ Regex من النص الخام المشفر القادم من Gumroad
        if (!deviceId) {
          const regexes = [
            /custom_fields%5BDevice\+ID%5D=([^&]+)/i,
            /custom_fields%5Bdevice_id%5D=([^&]+)/i,
            /custom_fields\[Device ID\]=([^&]+)/i,
            /custom_fields\[device_id\]=([^&]+)/i,
            /Device\+ID=([^&]+)/i,
            /device_id=([^&]+)/i,
            /Device%20ID=([^&]+)/i
          ];

          for (const reg of regexes) {
            const match = rawText.match(reg);
            if (match && match[1]) {
              deviceId = decodeURIComponent(match[1].replace(/\+/g, " "));
              break;
            }
          }
        }

        deviceId = String(deviceId || "").trim().toUpperCase();

        if (deviceId) {
          const now = new Date();
          const permalink = (body.product_permalink || body.permalink || body.product_name || rawText || "").toLowerCase();

          if (permalink.includes("yearly") || permalink.includes("799") || permalink.includes("sc-yearly")) {
            now.setFullYear(now.getFullYear() + 1);
          } else {
            now.setMonth(now.getMonth() + 1);
          }

          const subExpiry = now.toISOString();
          const saleId = body.sale_id || body.order_number || `GUM_${Date.now()}`;

          // الإرسال لقاعدة البيانات Supabase
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
          console.log(`[Supabase Insert Success] Device: ${deviceId}`, resData);

          return new Response(JSON.stringify({ 
            success: supabaseRes.ok, 
            detected_device: deviceId, 
            supabase_response: resData 
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        console.log("[Gumroad Warning] No Device ID found in payload keys:", Object.keys(body));
        return new Response(JSON.stringify({ 
          success: false, 
          message: "No device ID detected in Gumroad payload", 
          raw_keys_received: Object.keys(body) 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ----------------------------------------------------
      // 2. تفعيل التجربة المجانية (48 ساعة)
      // ----------------------------------------------------
      if (body.action === "activate_trial") {
        const deviceId = (body.device_id || "").trim().toUpperCase();
        if (!deviceId) {
          return new Response(JSON.stringify({
            success: false,
            message: "يرجى إدخال كود الجهاز لتفعيل التجربة."
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?device_id=eq.${encodeURIComponent(deviceId)}&select=*`, {
          method: "GET",
          headers: {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json"
          }
        });

        if (checkRes.ok) {
          const existingUsers = await checkRes.json();
          if (existingUsers && existingUsers.length > 0 && existingUsers[0].trial_expires_at) {
            return new Response(JSON.stringify({
              success: false,
              already_used: true,
              message: "⚠️ لقد تم استخدام الفترة التجريبية لهذا الجهاز من قبل!",
              trial_expires_at: existingUsers[0].trial_expires_at
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
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

        const resText = await supabaseRes.text();
        let parsedData;
        try { parsedData = JSON.parse(resText); } catch (e) { parsedData = resText; }

        return new Response(JSON.stringify({
          success: supabaseRes.ok,
          message: `✅ تم تفعيل التجربة المجانية بنجاح لمدة 48 ساعة للجهاز: ${deviceId}`,
          trial_expires_at: trialExpiry,
          data: parsedData
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ----------------------------------------------------
      // 3. التحقق اليدوي المباشر
      // ----------------------------------------------------
      if (body.action === "verify_payment") {
        const { transaction_id, device_id } = body;
        const cleanTxId = String(transaction_id || "").replace(/\D/g, '').trim();
        const cleanDeviceId = String(device_id || "").trim().toUpperCase();

        if (!cleanTxId || !cleanDeviceId) {
          return new Response(JSON.stringify({
            success: false,
            message: "يرجى إدخال رقم العملية وكود الجهاز بشكل صحيح."
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const checkTxRes = await fetch(`${SUPABASE_URL}/rest/v1/users?last_transaction_id=eq.${encodeURIComponent(cleanTxId)}&select=*`, {
          method: "GET",
          headers: {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json"
          }
        });

        if (checkTxRes.ok) {
          const matchingUsers = await checkTxRes.json();
          if (matchingUsers && matchingUsers.length > 0) {
            const user = matchingUsers[0];
            return new Response(JSON.stringify({
              success: true,
              message: "✅ تم التحقق من الاشتراك وهو نشط حالياً.",
              expires_at: user.subscription_expires_at
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }

        return new Response(JSON.stringify({
          success: false,
          message: "⚠️ العملية قيد المراجعة أو غير مسجلة بعد، يرجى التواصل عبر الواتساب لتأكيد الإيصال."
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: false, message: "Invalid Action" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        message: `خطأ بالسيرفر: ${err.message}`
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
};
 
