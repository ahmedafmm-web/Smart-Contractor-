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

      // 🎯 روابط ومفاتيح Supabase الجديدة
      const SUPABASE_URL = (env.SUPABASE_URL || "https://lwffkzdkvafyuwrcbzl.supabase.co").trim();
      const SUPABASE_SERVICE_ROLE_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZmZra3pka3ZhZnl1d3JjYnpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM4NDk3NSwiZXhwIjoyMDk5OTYwOTc1fQ.Kg8RxKkkkHI6WAKUg1FDrc9t5hQEG68Hu46p5pHxbvw").trim();

      // قراءة بيانات الطلب (سواء كانت JSON أو Form-Data من Gumroad)
      const contentType = request.headers.get("content-type") || "";
      let body = {};

      if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        for (const [key, value] of formData.entries()) {
          body[key] = value;
        }
      } else {
        try {
          body = await request.json();
        } catch (e) {
          body = {};
        }
      }

      // ----------------------------------------------------
      // 1. استقبال وتفعيل إشعارات الدفع من Gumroad تلقائياً
      // ----------------------------------------------------
      if (body.seller_id || body.product_permalink || body.sale_id) {
        let deviceId = body["custom_fields[Device ID]"] || 
                       body["custom_fields[device_id]"] || 
                       body.device_id || 
                       body.Device_ID || 
                       "";

        if (!deviceId && body.custom_fields) {
          try {
            const customFields = typeof body.custom_fields === "string" ? JSON.parse(body.custom_fields) : body.custom_fields;
            deviceId = customFields["Device ID"] || customFields["device_id"] || customFields["Device ID "] || "";
          } catch (e) {}
        }

        deviceId = String(deviceId).trim().toUpperCase();
        const saleId = body.sale_id || body.order_number || `GUM_${Date.now()}`;
        const permalink = (body.product_permalink || body.permalink || body.product_name || "").toLowerCase();

        if (deviceId) {
          const now = new Date();
          // تحديد الصلاحية: سنة للباقة السنوية، شهر للباقة الشهرية
          if (permalink.includes("yearly") || permalink.includes("799") || permalink.includes("sc-yearly")) {
            now.setFullYear(now.getFullYear() + 1);
          } else {
            now.setMonth(now.getMonth() + 1);
          }

          const subExpiry = now.toISOString();
          const supabaseEndpoint = `${SUPABASE_URL}/rest/v1/users?on_conflict=device_id`;

          await fetch(supabaseEndpoint, {
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
        }

        return new Response(JSON.stringify({ success: true, message: "Gumroad activation processed" }), {
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

        // فحص مسبق لمنع تكرار الفترة التجريبية
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

        if (supabaseRes.ok) {
          return new Response(JSON.stringify({
            success: true,
            message: `✅ تم تفعيل التجربة المجانية بنجاح لمدة 48 ساعة للجهاز: ${deviceId}`,
            trial_expires_at: trialExpiry,
            data: parsedData
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          return new Response(JSON.stringify({
            success: false,
            message: `فشل الحفظ في قاعدة البيانات (${supabaseRes.status})`,
            details: parsedData
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // ----------------------------------------------------
      // 3. التحقق اليدوي المباشر لحسابات InstaPay والتحويلات
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

        // فحص قاعدة البيانات للتأكد من تسجيل العملية مسبقاً
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
