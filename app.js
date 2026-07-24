const i18n = {
    ar: {
        appTitle: "The Smart Contractor",
        setupTitle: "إعدادات النظام أول مرة",
        lblCompName: "اسم الشركة / المهندس",
        lblCompPhone: "رقم التليفون",
        lblCompAddress: "العنوان",
        lblCompLogo: "لوجو الشركة (صورة)",
        btnSaveSetup: "حفظ البيانات والدخول",
        secClientInfo: "بيانات العميل والمشروع",
        lblCustomerName: "اسم العميل",
        lblCustomerPhone: "رقم الهاتف",
        lblMarkup: "نسبة الربح (%)",
        lblContingency: "طوارئ الأسعار (%)",
        lblWaste: "هدر المواد (%)",
        secItems: "بنود الأعمال والمساحات",
        btnAddItem: "بند جديد",
        btnGeneratePDF: "إصدار المقايسة فوراً PDF",
        modalAddTitle: "إضافة بند جديد مخصص",
        lblNewName: "اسم البند (مثال: تركيب سيراميك)",
        lblNewMat: "تكلفة المواد للمتر (م²)",
        lblNewLab: "تكلفة المصنعية للمتر (م²)",
        placeholderArea: "المساحة بالمتر المربع (م²)",
        txtValid: "هذه المقايسة سارية لمدة 3 أيام فقط من تاريخ الإصدار نتيجه تذبذب أسعار السوق.",
        txtPayments: "طريقة الدفع الافتراضية: 50% مقدم تعاقد، 30% عند توريد المواد، 20% عند الاستلام النهائي."
    },
    en: {
        appTitle: "The Smart Contractor",
        setupTitle: "Initial Company Setup",
        lblCompName: "Company / Engineer Name",
        lblCompPhone: "Phone Number",
        lblCompAddress: "Address",
        lblCompLogo: "Company Logo (Image)",
        btnSaveSetup: "Save Data & Enter",
        secClientInfo: "Client & Project Information",
        lblCustomerName: "Client Name",
        lblCustomerPhone: "Phone Number",
        lblMarkup: "Profit Margin (%)",
        lblContingency: "Price Contingency (%)",
        lblWaste: "Material Waste (%)",
        secItems: "Work Items & Areas",
        btnAddItem: "Add Item",
        btnGeneratePDF: "Generate PDF Quotation",
        modalAddTitle: "Add Custom Work Item",
        lblNewName: "Item Name (e.g., Ceramic Tiles)",
        lblNewMat: "Material Cost per m²",
        lblNewLab: "Labor Cost per m²",
        placeholderArea: "Area in Square Meters (m²)",
        txtValid: "This quotation is valid for 3 days only from the date of issue due to market price fluctuations.",
        txtPayments: "Default Payment Terms: 50% Advance, 30% upon Material Delivery, 20% upon Final Handover."
    }
};

const defaultItems = [
    { id: "epoxy", name_ar: "توريد وتركيب أرضيات إيبوكسي", name_en: "Supply & Apply Epoxy Flooring", mat_cost: 250, lab_cost: 80 },
    { id: "painting", name_ar: "أعمال الدهانات والنقاشة المتكاملة", name_en: "Integrated Painting & Decoration", mat_cost: 90, lab_cost: 45 },
    { id: "plastering", name_ar: "أعمال المحارة والياسة الجدارية", name_en: "Wall Plastering Works", mat_cost: 65, lab_cost: 35 }
];

let currentLang = localStorage.getItem('contractor_lang') || 'ar';
let companyData = JSON.parse(localStorage.getItem('contractor_company')) || null;
let customItems = JSON.parse(localStorage.getItem('contractor_custom_items')) || [];

// إعداد ربط Supabase
const SUPABASE_URL = "https://nnglxiwqwwjcsejmtvxb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZ2x4aXdxd3dqY3Nlam10dnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzEwOTcsImV4cCI6MjA5NjYwNzA5N30.crw2NNA7hpOH77_i4mzDqrh0PbPeYlmY7nVCtukDmIQ";

function generateDeviceFingerprint() {
    const specs = [
        navigator.userAgent,
        screen.height,
        screen.width,
        screen.colorDepth,
        navigator.hardwareConcurrency || 4,
        new Date().getTimezoneOffset()
    ].join('||');
    
    let hash = 0;
    for (let i = 0; i < specs.length; i++) {
        let char = specs.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return "TSCAM-" + Math.abs(hash).toString(16).toUpperCase();
}

function getDeviceID() {
    return generateDeviceFingerprint();
}

// دالة فحص التفعيل الأساسية عند فتح التطبيق مع مهلة الـ 72 ساعة أوفلاين
async function checkActivation() {
    const fingerprint = getDeviceID();
    const now = new Date();
    
    const idBox = document.getElementById('device-id-box');
    if(idBox) idBox.innerText = fingerprint;

    const cachedExpiry = localStorage.getItem('contractor_subscription_expiry_cache');
    const lastOnlineCheck = localStorage.getItem('contractor_last_online_check');
    let isCacheValid = false;

    if (cachedExpiry && lastOnlineCheck) {
        const expiryDate = new Date(cachedExpiry);
        const lastCheckDate = new Date(lastOnlineCheck);
        
        const hoursSinceLastCheck = (now - lastCheckDate) / (1000 * 60 * 60);

        if (expiryDate > now && hoursSinceLastCheck <= 72) {
            if(document.getElementById('activation-screen')) document.getElementById('activation-screen').classList.add('hidden');
            isCacheValid = true;
        } else if (hoursSinceLastCheck > 72) {
            localStorage.removeItem('contractor_subscription_expiry_cache');
        }
    }

    if (!isCacheValid) {
        showLockScreen("برجاء الاتصال بالإنترنت أو الضغط على زر التوجيه بالأسفل لتجديد التفعيل.");
    }

    try {
        if (!navigator.onLine) {
            throw new Error("OfflineMode");
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?device_id=eq.${fingerprint}`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();

        if (!data || data.length === 0) {
            localStorage.removeItem('contractor_subscription_expiry_cache');
            localStorage.removeItem('contractor_last_online_check');
            showLockScreen("🔒 هذا الجهاز غير مسجل بالسحابة أو تم إلغاء تفعيله.");
            return false;
        }

        const user = data[0];
        let remoteExpiry = null;

        if (user.is_subscribed === true || user.is_subscribed === "true") {
            remoteExpiry = user.subscription_expires_at;
        } else if (user.trial_expires_at) {
            remoteExpiry = user.trial_expires_at;
        }

        if (remoteExpiry && new Date(remoteExpiry) > now) {
            localStorage.setItem('contractor_subscription_expiry_cache', remoteExpiry);
            localStorage.setItem('contractor_last_online_check', now.toISOString());
            if(document.getElementById('activation-screen')) document.getElementById('activation-screen').classList.add('hidden');
            return true;
        } else {
            localStorage.removeItem('contractor_subscription_expiry_cache');
            localStorage.removeItem('contractor_last_online_check');
            showLockScreen("🔒 انتهت صلاحية الاشتراك الحالي. يرجى التجديد للاستمرار.");
            return false;
        }

    } catch (error) {
        console.error("وضع الأوفلاين:", error);
        return isCacheValid;
    }
}

function showLockScreen(msg) {
    const activationScreen = document.getElementById('activation-screen');
    const lockMessage = document.getElementById('lock-message');
    
    if (activationScreen) activationScreen.classList.remove('hidden');
    if (lockMessage) lockMessage.innerText = msg;
}

function updateUILanguage() {
    const lang = currentLang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    if(document.getElementById('lang-toggle-btn')) document.getElementById('lang-toggle-btn').innerText = lang === 'ar' ? '🌐 EN' : '🌐 العربي';
    if(document.getElementById('app-main-title')) document.getElementById('app-main-title').innerText = i18n[lang].appTitle;
    if(document.getElementById('setup-title')) document.getElementById('setup-title').innerText = i18n[lang].setupTitle;
    if(document.getElementById('lbl-comp-name')) document.getElementById('lbl-comp-name').innerText = i18n[lang].lblCompName;
    if(document.getElementById('lbl-comp-phone')) document.getElementById('lbl-comp-phone').innerText = i18n[lang].lblCompPhone;
    if(document.getElementById('lbl-comp-address')) document.getElementById('lbl-comp-address').innerText = i18n[lang].lblCompAddress;
    if(document.getElementById('save-setup-btn')) document.getElementById('save-setup-btn').innerText = i18n[lang].btnSaveSetup;
    if(document.getElementById('sec-client-info')) document.getElementById('sec-client-info').innerText = i18n[lang].secClientInfo;
    if(document.getElementById('lbl-customer-name')) document.getElementById('lbl-customer-name').innerText = i18n[lang].lblCustomerName;
    if(document.getElementById('lbl-customer-phone')) document.getElementById('lbl-customer-phone').innerText = i18n[lang].lblCustomerPhone;
    if(document.getElementById('lbl-markup')) document.getElementById('lbl-markup').innerText = i18n[lang].lblMarkup;
    if(document.getElementById('lbl-contingency')) document.getElementById('lbl-contingency').innerText = i18n[lang].lblContingency;
    if(document.getElementById('lbl-waste')) document.getElementById('lbl-waste').innerText = i18n[lang].lblWaste;
    if(document.getElementById('sec-items')) document.getElementById('sec-items').innerText = i18n[lang].secItems;
    if(document.getElementById('btn-text-add')) document.getElementById('btn-text-add').innerText = i18n[lang].btnAddItem;
    if(document.getElementById('btn-text-pdf')) document.getElementById('btn-text-pdf').innerText = i18n[lang].btnGeneratePDF;
    if(document.getElementById('modal-add-title')) document.getElementById('modal-add-title').innerText = i18n[lang].modalAddTitle;
    if(document.getElementById('lbl-new-name')) document.getElementById('lbl-new-name').innerText = i18n[lang].lblNewName;
    if(document.getElementById('lbl-new-mat')) document.getElementById('lbl-new-mat').innerText = i18n[lang].lblNewMat;
    if(document.getElementById('lbl-new-lab')) document.getElementById('lbl-new-lab').innerText = i18n[lang].lblNewLab;
    
    document.querySelectorAll('.area-input').forEach(input => {
        input.placeholder = i18n[lang].placeholderArea;
    });
}

function renderItems() {
    const container = document.getElementById('dynamic-items-list');
    if(!container) return;
    container.innerHTML = '';
    const allItems = [...defaultItems, ...customItems];
    
    allItems.forEach(item => {
        const itemName = currentLang === 'ar' ? (item.name_ar || item.name) : (item.name_en || item.name);
        const itemHTML = `
            <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm" id="card-${item.id}">
                <div class="flex flex-col md:flex-row justify-between gap-2 mb-3">
                    <input type="text" value="${itemName}" data-type="name" data-id="${item.id}"
                           class="font-bold text-slate-100 text-sm md:text-base bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 outline-none px-1 py-0.5 w-full md:w-auto flex-1">
                    <span class="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded font-semibold self-start md:self-center">
                        ${currentLang === 'ar' ? 'متر مربع' : 'Sqm'}
                    </span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    <div class="md:col-span-2">
                        <input type="number" step="any" data-id="${item.id}" data-type="area" placeholder="${i18n[currentLang].placeholderArea}" 
                               style="font-variant-numeric: tabular-nums; font-family: monospace;"
                               class="area-input w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-indigo-500 font-bold text-center text-slate-100">
                    </div>
                    <div class="grid grid-cols-2 gap-1 text-xs">
                        <div class="flex flex-col">
                            <span class="text-slate-400 text-[10px]">${currentLang === 'ar' ? 'خامات:' : 'Mat:'}</span>
                            <input type="number" step="any" value="${item.mat_cost}" data-type="mat" data-id="${item.id}" style="font-family: monospace;" class="p-1 border border-slate-800 rounded text-center font-semibold bg-slate-950 text-slate-100">
                        </div>
                        <div class="flex flex-col">
                            <span class="text-slate-400 text-[10px]">${currentLang === 'ar' ? 'مصنعية:' : 'Labor:'}</span>
                            <input type="number" step="any" value="${item.lab_cost}" data-type="lab" data-id="${item.id}" style="font-family: monospace;" class="p-1 border border-slate-800 rounded text-center font-semibold bg-slate-950 text-slate-100">
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

window.addEventListener('DOMContentLoaded', async () => {
    updateUILanguage();
    renderItems();

    // 1️⃣ إظهار أو إخفاء شاشة الإعدادات عند فتح الصفحة
    if (!companyData) {
        if(document.getElementById('setup-screen')) document.getElementById('setup-screen').classList.remove('hidden');
    } else {
        const initialRates = JSON.parse(localStorage.getItem('contractor_initial_rates'));
        if (initialRates) {
            if(document.getElementById('markup-rate')) document.getElementById('markup-rate').value = initialRates.markup;
            if(document.getElementById('contingency-rate')) document.getElementById('contingency-rate').value = initialRates.contingency;
            if(document.getElementById('waste-rate')) document.getElementById('waste-rate').value = initialRates.waste;
        }
    }
    
    // 2️⃣ ربط حدث حفظ الإعدادات مع ظهور تنبيه بالحفظ في ذاكرة المتصفح
    const saveSetupBtn = document.getElementById('save-setup-btn');
    if (saveSetupBtn) {
        saveSetupBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('setup-company-name');
            const phoneInput = document.getElementById('setup-company-phone');
            const addressInput = document.getElementById('setup-company-address');
            const logoFileInput = document.getElementById('setup-company-logo');

            const name = nameInput ? nameInput.value.trim() : '';
            const phone = phoneInput ? phoneInput.value.trim() : '';
            const address = addressInput ? addressInput.value.trim() : '';
            const logoFile = logoFileInput && logoFileInput.files ? logoFileInput.files[0] : null;
            
            if (!name || !phone) { 
                alert('الرجاء إدخال البيانات الأساسية (اسم الشركة ورقم التليفون)'); 
                return; 
            }

            saveSetupBtn.disabled = true;
            saveSetupBtn.innerText = "جاري الحفظ...";

            // حفظ النسب الأساسية
            localStorage.setItem('contractor_initial_rates', JSON.stringify({
                markup: document.getElementById('markup-rate') ? document.getElementById('markup-rate').value : "15",
                contingency: document.getElementById('contingency-rate') ? document.getElementById('contingency-rate').value : "5",
                waste: document.getElementById('waste-rate') ? document.getElementById('waste-rate').value : "5"
            }));

            const commitDataToStorage = (logoBase64) => {
                const companyObj = { name, phone, address, logo: logoBase64 };
                
                // كتابة البيانات بشكل صريح ومضمون في ذاكرة المتصفح
                localStorage.setItem('contractor_company', JSON.stringify(companyObj));
                companyData = companyObj;
                
                setTimeout(() => {
                    const setupScreen = document.getElementById('setup-screen');
                    if (setupScreen) setupScreen.classList.add('hidden');
                    saveSetupBtn.disabled = false;
                    saveSetupBtn.innerText = "حفظ البيانات والدخول";

                    // 🔔 إظهار رسالة التنبيه الفورية المطلوب ظهورها
                    alert("✅ تم الحفظ بنجاح في ذاكرة المتصفح!");
                }, 200);
            };

            // معالجة وضغط الصورة فوراً في الذاكرة لحفظها إجبارياً
            if (logoFile) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        const maxDim = 200;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > height) {
                            if (width > maxDim) { height *= maxDim / width; width = maxDim; }
                        } else {
                            if (height > maxDim) { width *= maxDim / height; height = maxDim; }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        const compressedLogo = canvas.toDataURL('image/png', 0.8);
                        commitDataToStorage(compressedLogo);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(logoFile);
            } else {
                commitDataToStorage('');
            }
        });
    }

    // 3️⃣ زر الإعدادات ⚙️ لإعادة التعديل ومسح البيانات المؤقتة
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if(confirm(currentLang === 'ar' ? "هل تريد تعديل بيانات الشركة واللوجو والنسب؟" : "Modify configuration?")) {
                localStorage.removeItem('contractor_company');
                localStorage.removeItem('contractor_initial_rates');
                window.location.reload();
            }
        });
    }

    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            currentLang = currentLang === 'ar' ? 'en' : 'ar';
            localStorage.setItem('contractor_lang', currentLang);
            updateUILanguage();
            renderItems();
        });
    }

    const addBtn = document.getElementById('add-new-item-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            document.getElementById('add-item-modal').classList.remove('hidden');
        });
    }
    
    const closeBtn = document.getElementById('close-modal-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('add-item-modal').classList.add('hidden');
        });
    }

    const saveItemBtn = document.getElementById('save-new-item-btn');
    if (saveItemBtn) {
        saveItemBtn.addEventListener('click', () => {
            const name = document.getElementById('new-item-name').value.trim();
            const mat = parseFloat(document.getElementById('new-item-mat-cost').value);
            const lab = parseFloat(document.getElementById('new-item-lab-cost').value);
            
            if (!name || isNaN(mat) || isNaN(lab)) { alert('بيانات خاطئة'); return; }
            
            customItems.push({ id: "custom_" + Date.now(), name: name, name_ar: name, name_en: name, mat_cost: mat, lab_cost: lab });
            localStorage.setItem('contractor_custom_items', JSON.stringify(customItems));
            document.getElementById('add-item-modal').classList.add('hidden');
            renderItems();
        });
    }

    const pdfBtn = document.getElementById('generate-pdf-btn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            generateQuotationPDF();
        });
    }

    // 4️⃣ تنفيذ الفحص السحابي
    await checkActivation();
});

function generateQuotationPDF() {
    const clientNameInput = document.getElementById('client-name');
    const cName = clientNameInput && clientNameInput.value.trim() ? clientNameInput.value.trim() : (currentLang === 'ar' ? 'عميل كريم' : 'Valued Client');
    
    const clientPhoneInput = document.getElementById('client-phone');
    const cPhone = clientPhoneInput && clientPhoneInput.value.trim() ? clientPhoneInput.value.trim() : '---';
    
    const markup = parseFloat(document.getElementById('markup-rate').value) / 100;
    const contingency = parseFloat(document.getElementById('contingency-rate').value) / 100;
    const waste = parseFloat(document.getElementById('waste-rate').value) / 100;
    
    const allItems = [...defaultItems, ...customItems];
    let rowsHTML = '';
    let grandTotal = 0;
    
    allItems.forEach(item => {
        const areaInput = document.querySelector(`input[data-type="area"][data-id="${item.id}"]`);
        const nameInput = document.querySelector(`input[data-type="name"][data-id="${item.id}"]`);
        const matInput = document.querySelector(`input[data-type="mat"][data-id="${item.id}"]`);
        const labInput = document.querySelector(`input[data-type="lab"][data-id="${item.id}"]`);

        const area = areaInput ? parseFloat(areaInput.value) : 0;
        const currentItemName = nameInput ? nameInput.value.trim() : (currentLang === 'ar' ? item.name_ar : item.name_en);
        const currentMatCost = matInput ? parseFloat(matInput.value) : item.mat_cost;
        const currentLabCost = labInput ? parseFloat(labInput.value) : item.lab_cost;
        
        if (!isNaN(area) && area > 0) {
            const totalMaterialCost = area * currentMatCost * (1 + waste);
            const totalLaborCost = area * currentLabCost;
            const baseCost = totalMaterialCost + totalLaborCost;
            const finalPrice = baseCost * (1 + markup + contingency);
            
            grandTotal += finalPrice;
            
            rowsHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px; text-align: start;">${currentItemName}</td>
                    <td style="padding: 12px; text-align: center; font-family: 'Courier New', monospace;">${area.toLocaleString('en-US')} M²</td>
                    <td style="padding: 12px; text-align: center; font-family: 'Courier New', monospace;">${(finalPrice / area).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td style="padding: 12px; text-align: center; font-weight: bold; color: #1e3a8a; font-family: 'Courier New', monospace;">${finalPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
            `;
        }
    });
    
    if (grandTotal === 0) {
        alert(currentLang === 'ar' ? 'برجاء إدخال مساحة بند واحد على الأقل!' : 'Please enter area for at least one item!');
        return;
    }

    const direction = currentLang === 'ar' ? 'rtl' : 'ltr';
    const printWindow = window.open('', '_blank');
    
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = new Date().toLocaleDateString('ar-EG', dateOptions);
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="${currentLang}" dir="${direction}">
        <head>
            <meta charset="UTF-8">
            <title>${cName}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
                body { font-family: 'Cairo', sans-serif; background-color: #ffffff; padding: 20px; margin: 0; }
                @media print {
                    @page { size: auto; margin: 0mm !important; }
                    html, body { margin: 0mm !important; padding: 0mm !important; }
                    body { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div style="padding: 20px; background-color: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
                    <div>
                        <h2 style="margin: 0; color: #1e3a8a; font-size: 22px;">${companyData ? companyData.name : 'The Smart Contractor'}</h2>
                        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">${companyData ? companyData.phone : ''} | ${companyData ? companyData.address : ''}</p>
                    </div>
                    <div>
                        ${companyData && companyData.logo ? `<img src="${companyData.logo}" style="max-height: 70px;">` : ''}
                    </div>
                </div>
                
                <h3 style="text-align: center; color: #1e3a8a; font-size: 24px; margin-bottom: 25px;">${currentLang === 'ar' ? 'مقايسة أعمال تشطيبات وهندسة' : 'Engineering Work Quotation'}</h3>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px; line-height: 1.6; font-size: 14px;">
                    <strong>${currentLang === 'ar' ? 'موجه إلى السيد / السيدة:' : 'Client Name:'}</strong> ${cName}<br>
                    <strong>${currentLang === 'ar' ? 'رقم الهاتف:' : 'Phone Number:'}</strong> ${cPhone}<br>
                    <strong>${currentLang === 'ar' ? 'تاريخ الإصدار:' : 'Date of Issue:'}</strong> ${formattedDate}<br>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #1e3a8a; color: white;">
                            <th style="padding: 12px; text-align: start;">${currentLang === 'ar' ? 'البيان والبند' : 'Description / Item'}</th>
                            <th style="padding: 12px; text-align: center;">${currentLang === 'ar' ? 'الكمية/المساحة' : 'Quantity / Area'}</th>
                            <th style="padding: 12px; text-align: center;">${currentLang === 'ar' ? 'سعر الفئة التقريبي' : 'Unit Price'}</th>
                            <th style="padding: 12px; text-align: center;">${currentLang === 'ar' ? 'إجمالي البند' : 'Total Price'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                </table>
                
                <div style="font-size: 18px; color: #15803d; font-weight: bold; background: #f0fdf4; padding: 15px; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center; margin-bottom: 40px; font-family: 'Courier New', monospace;">
                    ${currentLang === 'ar' ? 'الإجمالي العام للمقايسة:' : 'Grand Total Amount:'} ${grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} EGP
                </div>
                
                <div style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; line-height: 1.8;">
                    <p style="text-align: center; margin-top: 15px; font-size: 13px; color: #334155; font-weight: 600; letter-spacing: 0.5px;">The Smart Contractor By Ahmed Mohamed &copy; 2026</p>
                </div>
            </div>
            <script>
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 500);
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// دالة التحقق اليدوي عند الضغط على الزرار (تحدث مهلة الـ 72 ساعة)
async function checkSubscriptionManually() {
    const fingerprint = getDeviceID();
    const now = new Date();
    
    const btn = document.getElementById('manual-verify-btn');
    const btnText = document.getElementById('verify-btn-text');
    const btnIcon = document.getElementById('verify-btn-icon');
    const lockMsg = document.getElementById('lock-message');
    const expiryBox = document.getElementById('expiry-display-box');
    const expiryDateText = document.getElementById('expiry-date-text');

    btn.disabled = true;
    btnText.innerText = "جاري فحص السحابة والتواريخ...";
    btnIcon.innerText = "⏳";
    btn.classList.add('opacity-80');

    try {
        if (!navigator.onLine) {
            throw new Error("NoInternetManual");
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?device_id=eq.${fingerprint}`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();

        if (!data || data.length === 0) {
            lockMsg.innerText = "⚠️ هذا الجهاز غير مسجل بالسحابة أو لم يتم تفعيله بعد. يرجى الانتقال لصفحة الاشتراكات.";
            if (expiryBox) expiryBox.classList.add('hidden');
            btnText.innerText = "فشل التحقق (غير مفعل)";
            btnIcon.innerText = "❌";
            btn.style.background = "#ef4444"; 
            btn.disabled = false;
            btn.classList.remove('opacity-80');
            return;
        }

        const user = data[0];
        let isAccessGranted = false;
        let expiryDateFormatted = "";
        let rawExpiryString = null;

        if (user.is_subscribed === true || user.is_subscribed === "true") {
            if (user.subscription_expires_at && new Date(user.subscription_expires_at) > now) {
                isAccessGranted = true;
                rawExpiryString = user.subscription_expires_at;
                const subExpiry = new Date(user.subscription_expires_at);
                expiryDateFormatted = "اشتراكك المدفوع ينتهي في: " + subExpiry.toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
            } else {
                lockMsg.innerText = "💡 انتهت مدة اشتراكك الحالي. يرجى التجديد للاستمرار في استخدام الأداة.";
                localStorage.removeItem('contractor_subscription_expiry_cache');
                localStorage.removeItem('contractor_last_online_check');
            }
        }
        else if (user.trial_expires_at) {
            const trialExpiry = new Date(user.trial_expires_at);
            if (now < trialExpiry) {
                isAccessGranted = true;
                rawExpiryString = user.trial_expires_at;
                expiryDateFormatted = "الفترة التجريبية تنتهي في: " + trialExpiry.toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
            } else {
                lockMsg.innerText = "🔒 انتهت الفترة التجريبية المجانية (48 ساعة). اشترك الآن لفتح الأداة فوراً.";
                localStorage.removeItem('contractor_subscription_expiry_cache');
                localStorage.removeItem('contractor_last_online_check');
            }
        }

        if (isAccessGranted) {
            localStorage.setItem('contractor_subscription_expiry_cache', rawExpiryString);
            localStorage.setItem('contractor_last_online_check', now.toISOString());

            if (expiryBox && expiryDateText) {
                expiryDateText.innerText = expiryDateFormatted;
                expiryBox.classList.remove('hidden');
            }

            btnText.innerText = "تم التحقق والفتح بنجاح";
            btnIcon.innerText = "✓";
            btn.style.background = "#10b981"; 

            setTimeout(() => {
                const actScreen = document.getElementById('activation-screen');
                if (actScreen) actScreen.classList.add('hidden');
                window.location.reload(); 
            }, 1800);
        } else {
            if (expiryBox) expiryBox.classList.add('hidden');
            btnText.innerText = "فشل التحقق (الاشتراك منتهي)";
            btnIcon.innerText = "❌";
            btn.style.background = "#ef4444"; 
            btn.disabled = false;
            btn.classList.remove('opacity-80');
        }

    } catch (error) {
        console.error(error);
        btnText.innerText = "لا يوجد إنترنت! فشل التفعيل";
        btnIcon.innerText = "🌐";
        btn.disabled = false;
        btn.classList.remove('opacity-80');
        alert("❌ خطأ: يجب توفير اتصال فعال بالإنترنت للتحقق وتنشيط الأداة من قاعدة البيانات السحابية!");
    }
}
