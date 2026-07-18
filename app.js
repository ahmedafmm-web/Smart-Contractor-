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

const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_KEY = "YOUR_ANON_KEY";

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

async function checkActivation() {
    const fingerprint = getDeviceID();
    const now = new Date();
    
    const idBox = document.getElementById('device-id-box');
    if(idBox) idBox.innerText = fingerprint;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?device_id=eq.${fingerprint}`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();

        if (data.length === 0) {
            await registerNewTrialUser(fingerprint);
            document.getElementById('activation-screen').classList.add('hidden');
            return true;
        }

        const user = data[0];

        if (user.status === 'monthly' || user.status === 'yearly') {
            if (new Date(user.expiry_date) > now) {
                document.getElementById('activation-screen').classList.add('hidden');
                return true;
            } else {
                showLockScreen("💡 انتهت مدة اشتراكك الحالي. يرجى التجديد للاستمرار في استخدام الأداة والحفاظ على حساباتك.");
                return false;
            }
        }

        if (user.status === 'trial') {
            const trialEnd = new Date(user.trial_start);
            trialEnd.setHours(trialEnd.getHours() + 48);

            if (now < trialEnd) {
                document.getElementById('activation-screen').classList.add('hidden');
                return true;
            } else {
                showLockScreen("🔒 انتهت الفترة التجريبية المجانية (48 ساعة). اشترك الآن لفتح الأداة فوراً وتفعيل النظام.");
                return false;
            }
        }

        showLockScreen("🔒 الوصول محدود. يرجى الاشتراك لتفعيل النظام.");
        return false;

    } catch (error) {
        console.error("جاري العمل بنظام الأوفلاين الاحتياطي:", error);
        const localStatus = localStorage.getItem('contractor_offline_verified');
        if (localStatus === 'true') {
            document.getElementById('activation-screen').classList.add('hidden');
            return true;
        }
        showLockScreen("🌐 يرجى الاتصال بالإنترنت للمرة الأولى لتأكيد حالة اشتراكك.");
        return false;
    }
}

function showLockScreen(msg) {
    document.getElementById('activation-screen').classList.remove('hidden');
    document.getElementById('lock-message').innerText = msg;
}

async function registerNewTrialUser(deviceId) {
    const now = new Date().toISOString();
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/users`, {
            method: "POST",
            headers: { 
                "apikey": SUPABASE_KEY, 
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ device_id: deviceId, trial_start: now, status: "trial" })
        });
        localStorage.setItem('contractor_offline_verified', 'true');
    } catch(e) { console.error(e); }
}

function startPaymobPayment(planType) {
    console.log("جاري تجهيز فاتورة Paymob للباقة:", planType);
}

(function selfDefending() {
    const initialConfig = checkActivation.toString().length;
    setInterval(() => {
        if (checkActivation.toString().length !== initialConfig || checkActivation.toString().includes('return true; //bypass')) {
            document.body.innerHTML = "<div style='color:red; text-align:center; margin-top:20%; font-size:24px; font-family:sans-serif;'>نسخة غير مصرح بها / تم اكتشاف تعديل في ملفات الأمان الرقمية</div>";
            localStorage.clear();
        }
    }, 3000);
})();

function updateUILanguage() {
    const lang = currentLang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    document.getElementById('lang-toggle-btn').innerText = lang === 'ar' ? '🌐 EN' : '🌐 العربي';
    document.getElementById('app-main-title').innerText = i18n[lang].appTitle;
    document.getElementById('setup-title').innerText = i18n[lang].setupTitle;
    document.getElementById('lbl-comp-name').innerText = i18n[lang].lblCompName;
    document.getElementById('lbl-comp-phone').innerText = i18n[lang].lblCompPhone;
    document.getElementById('lbl-comp-address').innerText = i18n[lang].lblCompAddress;
    document.getElementById('save-setup-btn').innerText = i18n[lang].btnSaveSetup;
    document.getElementById('sec-client-info').innerText = i18n[lang].secClientInfo;
    document.getElementById('lbl-customer-name').innerText = i18n[lang].lblCustomerName;
    document.getElementById('lbl-customer-phone').innerText = i18n[lang].lblCustomerPhone;
    document.getElementById('lbl-markup').innerText = i18n[lang].lblMarkup;
    document.getElementById('lbl-contingency').innerText = i18n[lang].lblContingency;
    document.getElementById('lbl-waste').innerText = i18n[lang].lblWaste;
    document.getElementById('sec-items').innerText = i18n[lang].secItems;
    document.getElementById('btn-text-add').innerText = i18n[lang].btnAddItem;
    document.getElementById('btn-text-pdf').innerText = i18n[lang].btnGeneratePDF;
    document.getElementById('modal-add-title').innerText = i18n[lang].modalAddTitle;
    document.getElementById('lbl-new-name').innerText = i18n[lang].lblNewName;
    document.getElementById('lbl-new-mat').innerText = i18n[lang].lblNewMat;
    document.getElementById('lbl-new-lab').innerText = i18n[lang].lblNewLab;
    
    document.querySelectorAll('.area-input').forEach(input => {
        input.placeholder = i18n[lang].placeholderArea;
    });
}

function renderItems() {
    const container = document.getElementById('dynamic-items-list');
    container.innerHTML = '';
    const allItems = [...defaultItems, ...customItems];
    
    allItems.forEach(item => {
        const itemName = currentLang === 'ar' ? (item.name_ar || item.name) : (item.name_en || item.name);
        const itemHTML = `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm" id="card-${item.id}">
                <div class="flex flex-col md:flex-row justify-between gap-2 mb-3">
                    <input type="text" value="${itemName}" data-type="name" data-id="${item.id}"
                           class="font-bold text-gray-800 text-sm md:text-base bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1 py-0.5 w-full md:w-auto flex-1">
                    <span class="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded font-semibold self-start md:self-center">
                        ${currentLang === 'ar' ? 'متر مربع' : 'Sqm'}
                    </span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    <div class="md:col-span-2">
                        <input type="number" step="any" data-id="${item.id}" data-type="area" placeholder="${i18n[currentLang].placeholderArea}" 
                               style="font-variant-numeric: tabular-nums; font-family: monospace;"
                               class="area-input w-full p-2.5 bg-gray-50 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-center">
                    </div>
                    <div class="grid grid-cols-2 gap-1 text-xs">
                        <div class="flex flex-col">
                            <span class="text-gray-400 text-[10px]">${currentLang === 'ar' ? 'خامات:' : 'Mat:'}</span>
                            <input type="number" step="any" value="${item.mat_cost}" data-type="mat" data-id="${item.id}" style="font-family: monospace;" class="p-1 border rounded text-center font-semibold bg-gray-50">
                        </div>
                        <div class="flex flex-col">
                            <span class="text-gray-400 text-[10px]">${currentLang === 'ar' ? 'مصنعية:' : 'Labor:'}</span>
                            <input type="number" step="any" value="${item.lab_cost}" data-type="lab" data-id="${item.id}" style="font-family: monospace;" class="p-1 border rounded text-center font-semibold bg-gray-50">
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

window.addEventListener('DOMContentLoaded', async () => {
    const isAllowed = await checkActivation();
    if (!isAllowed) {
        return;
    }
    
    if (!companyData) {
        document.getElementById('setup-screen').classList.remove('hidden');
    } else {
        const initialRates = JSON.parse(localStorage.getItem('contractor_initial_rates'));
        if (initialRates) {
            document.getElementById('markup-rate').value = initialRates.markup;
            document.getElementById('contingency-rate').value = initialRates.contingency;
            document.getElementById('waste-rate').value = initialRates.waste;
        }
    }
    
    document.getElementById('save-setup-btn').addEventListener('click', () => {
        const name = document.getElementById('setup-company-name').value.trim();
        const phone = document.getElementById('setup-company-phone').value.trim();
        const address = document.getElementById('setup-company-address').value.trim();
        const logoFile = document.getElementById('setup-company-logo').files[0];
        
        if (!name || !phone) { alert('الرجاء إدخال البيانات الأساسية'); return; }
        
        localStorage.setItem('contractor_initial_rates', JSON.stringify({
            markup: document.getElementById('markup-rate').value || "15",
            contingency: document.getElementById('contingency-rate').value || "5",
            waste: document.getElementById('waste-rate').value || "5"
        }));
        
        const save = (logoBase64 = '') => {
            localStorage.setItem('contractor_company', JSON.stringify({ name, phone, address, logo: logoBase64 }));
            window.location.reload();
        };
        
        if (logoFile) {
            const reader = new FileReader();
            reader.onloadend = () => save(reader.result);
            reader.readAsDataURL(logoFile);
        } else { save(); }
    });

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'ar' ? 'en' : 'ar';
        localStorage.setItem('contractor_lang', currentLang);
        updateUILanguage();
        renderItems();
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
        if(confirm(currentLang === 'ar' ? "هل تريد تعديل بيانات الشركة واللوجو والنسب؟" : "Modify configuration?")) {
            localStorage.removeItem('contractor_company');
            localStorage.removeItem('contractor_initial_rates');
            window.location.reload();
        }
    });

    document.getElementById('add-new-item-btn').addEventListener('click', () => {
        document.getElementById('add-item-modal').classList.remove('hidden');
    });
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('add-item-modal').classList.add('hidden');
    });

    document.getElementById('save-new-item-btn').addEventListener('click', () => {
        const name = document.getElementById('new-item-name').value.trim();
        const mat = parseFloat(document.getElementById('new-item-mat-cost').value);
        const lab = parseFloat(document.getElementById('new-item-lab-cost').value);
        
        if (!name || isNaN(mat) || isNaN(lab)) { alert('بيانات خاطئة'); return; }
        
        customItems.push({ id: "custom_" + Date.now(), name: name, name_ar: name, name_en: name, mat_cost: mat, lab_cost: lab });
        localStorage.setItem('contractor_custom_items', JSON.stringify(customItems));
        document.getElementById('add-item-modal').classList.add('hidden');
        renderItems();
    });

    document.getElementById('generate-pdf-btn').addEventListener('click', () => {
        generateQuotationPDF();
    });

    updateUILanguage();
    renderItems();
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
 
