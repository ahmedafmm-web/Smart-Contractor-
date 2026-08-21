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
        placeholderArea: "الكمية / المساحة",
        placeholderDesc: "التوصيف الفني للبند (اختياري)...",
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
        placeholderArea: "Quantity / Area",
        placeholderDesc: "Technical Item Description (Optional)...",
        txtValid: "This quotation is valid for 3 days only from the date of issue due to market price fluctuations.",
        txtPayments: "Default Payment Terms: 50% Advance, 30% upon Material Delivery, 20% upon Final Handover."
    }
};

const defaultItems = [
    { id: "epoxy", name_ar: "توريد وتركيب أرضيات إيبوكسي", name_en: "Supply & Apply Epoxy Flooring", mat_cost: 250, lab_cost: 80, unit: "m2" },
    { id: "painting", name_ar: "أعمال الدهانات والنقاشة المتكاملة", name_en: "Integrated Painting & Decoration", mat_cost: 90, lab_cost: 45, unit: "m2" },
    { id: "plastering", name_ar: "أعمال المحارة والياسة الجدارية", name_en: "Wall Plastering Works", mat_cost: 65, lab_cost: 35, unit: "m2" }
];

let currentLang = localStorage.getItem('contractor_lang') || 'ar';
let companyData = JSON.parse(localStorage.getItem('contractor_company')) || null;
let customItems = JSON.parse(localStorage.getItem('contractor_custom_items')) || [];

let itemDetailsCache = JSON.parse(localStorage.getItem('contractor_items_details')) || {};
let activeInputValues = {}; 
let cloudSavedQuotations = [];
let targetDeleteRowId = null;

const SUPABASE_URL = "https://nnglxiwqwwjcsejmtvxb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZ2x4aXdxd3dqY3Nlam10dnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzEwOTcsImV4cCI6MjA5NjYwNzA5N30.crw2NNA7hpOH77_i4mzDqrh0PbPeYlmY7nVCtukDmIQ";

function generateDeviceFingerprint() {
    const specs = [
        navigator.userAgent, screen.height, screen.width,
        screen.colorDepth, navigator.hardwareConcurrency || 4,
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

function compressAndBase64(file, callback) {
    if (!file) { callback(''); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxDim = 180;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxDim) { height *= maxDim / width; width = maxDim; }
            } else {
                if (height > maxDim) { width *= maxDim / height; height = maxDim; }
            }
            canvas.width = width; canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function snapshotCurrentInputs() {
    const allItems = [...defaultItems, ...customItems];
    allItems.forEach(item => {
        const areaInput = document.querySelector(`input[data-type="area"][data-id="${item.id}"]`);
        const nameInput = document.querySelector(`input[data-type="name"][data-id="${item.id}"]`);
        const descInput = document.querySelector(`textarea[data-type="desc"][data-id="${item.id}"]`);
        const unitSelect = document.querySelector(`select[data-type="unit"][data-id="${item.id}"]`);
        const matInput = document.querySelector(`input[data-type="mat"][data-id="${item.id}"]`);
        const labInput = document.querySelector(`input[data-type="lab"][data-id="${item.id}"]`);

        if (!activeInputValues[item.id]) activeInputValues[item.id] = {};

        if (areaInput) activeInputValues[item.id].area = areaInput.value;
        if (nameInput) activeInputValues[item.id].name = nameInput.value;
        if (descInput) activeInputValues[item.id].desc = descInput.value;
        if (unitSelect) activeInputValues[item.id].unit = unitSelect.value;
        if (matInput) activeInputValues[item.id].mat = matInput.value;
        if (labInput) activeInputValues[item.id].lab = labInput.value;
    });
}

function getUnitLabel(unitKey) {
    const unitsMap = {
        'm2': currentLang === 'ar' ? 'متر مسطح (م²)' : 'Sqm (m²)',
        'm3': currentLang === 'ar' ? 'متر مكعب (م³)' : 'Cbm (m³)',
        'm': currentLang === 'ar' ? 'متر طولي (م)' : 'Linear (m)',
        'ls': currentLang === 'ar' ? 'مقطوعية (L.S)' : 'Lump Sum (L.S)',
        'pcs': currentLang === 'ar' ? 'بالعدد (عدد)' : 'Pieces (Pcs)',
        'weight': currentLang === 'ar' ? 'بالوزن (كجم/طن)' : 'Weight (Kg/Ton)'
    };
    return unitsMap[unitKey] || unitsMap['m2'];
}

function renderItems(skipSnapshot = false) {
    const container = document.getElementById('dynamic-items-list');
    if (!container) return;
    
    if (!skipSnapshot) {
        snapshotCurrentInputs();
    }
    
    container.innerHTML = '';
    const allItems = [...defaultItems, ...customItems];

    allItems.forEach(item => {
        const cached = itemDetailsCache[item.id] || {};
        const activeVals = activeInputValues[item.id] || {};

        const itemName = activeVals.name !== undefined && activeVals.name !== '' ? activeVals.name : (cached.name || (currentLang === 'ar' ? (item.name_ar || item.name) : (item.name_en || item.name)));
        const itemImg = cached.img || item.img || '';
        const itemDesc = activeVals.desc !== undefined ? activeVals.desc : (cached.desc || '');
        const itemUnit = activeVals.unit || cached.unit || item.unit || 'm2';
        const itemArea = activeVals.area !== undefined ? activeVals.area : '';
        const itemMat = activeVals.mat !== undefined && activeVals.mat !== '' ? activeVals.mat : item.mat_cost;
        const itemLab = activeVals.lab !== undefined && activeVals.lab !== '' ? activeVals.lab : item.lab_cost;

        const itemHTML = `
            <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative group" id="card-${item.id}">
                <button onclick="deleteWorkItem('${item.id}')" title="حذف هذا البند" class="absolute top-3 left-3 text-slate-500 hover:text-red-400 p-1.5 transition text-xs">
                    <i class="fas fa-trash-alt"></i>
                </button>

                <div class="flex flex-col md:flex-row justify-between gap-2 mb-2 items-center pl-6">
                    <div class="flex items-center gap-3 w-full md:w-auto flex-1">
                        <div class="relative w-11 h-11 rounded-lg border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0 group">
                            <img id="img-preview-${item.id}" src="${itemImg}" class="${itemImg ? '' : 'hidden'} w-full h-full object-cover">
                            <i id="img-icon-${item.id}" class="fas fa-image text-slate-600 text-base ${itemImg ? 'hidden' : ''}"></i>
                            <label for="file-input-${item.id}" class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition text-white text-xs">
                                <i class="fas fa-camera"></i>
                            </label>
                            <input type="file" id="file-input-${item.id}" accept="image/*" class="hidden" onchange="handleItemImageUpload('${item.id}', this)">
                        </div>

                        <input type="text" value="${itemName}" data-type="name" data-id="${item.id}" onchange="saveItemDetail('${item.id}', 'name', this.value)"
                               class="font-bold text-slate-100 text-sm md:text-base bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 outline-none px-1 py-0.5 w-full flex-1">
                    </div>

                    <select data-type="unit" data-id="${item.id}" onchange="saveItemDetail('${item.id}', 'unit', this.value)" class="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded font-semibold outline-none focus:border-indigo-500 cursor-pointer">
                        <option value="m2" ${itemUnit === 'm2' ? 'selected' : ''}>متر مسطح (م²)</option>
                        <option value="m3" ${itemUnit === 'm3' ? 'selected' : ''}>متر مكعب (م³)</option>
                        <option value="m" ${itemUnit === 'm' ? 'selected' : ''}>متر طولي (م)</option>
                        <option value="ls" ${itemUnit === 'ls' ? 'selected' : ''}>مقطوعية (L.S)</option>
                        <option value="pcs" ${itemUnit === 'pcs' ? 'selected' : ''}>بالعدد (عدد)</option>
                        <option value="weight" ${itemUnit === 'weight' ? 'selected' : ''}>بالوزن (كجم/طن)</option>
                    </select>
                </div>

                <div class="mb-3">
                    <textarea data-type="desc" data-id="${item.id}" onchange="saveItemDetail('${item.id}', 'desc', this.value)" placeholder="${i18n[currentLang].placeholderDesc}" rows="1" class="w-full p-2 bg-slate-950 border border-slate-800/80 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-300 resize-none">${itemDesc}</textarea>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    <div class="md:col-span-2">
                        <input type="number" step="any" value="${itemArea}" data-id="${item.id}" data-type="area" placeholder="${i18n[currentLang].placeholderArea}" 
                               style="font-variant-numeric: tabular-nums; font-family: monospace;"
                               class="area-input w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-indigo-500 font-bold text-center text-slate-100">
                    </div>
                    <div class="grid grid-cols-2 gap-1 text-xs">
                        <div class="flex flex-col">
                            <span class="text-slate-400 text-[10px]">${currentLang === 'ar' ? 'خامات:' : 'Mat:'}</span>
                            <input type="number" step="any" value="${itemMat}" data-type="mat" data-id="${item.id}" style="font-family: monospace;" class="p-1 border border-slate-800 rounded text-center font-semibold bg-slate-950 text-slate-100">
                        </div>
                        <div class="flex flex-col">
                            <span class="text-slate-400 text-[10px]">${currentLang === 'ar' ? 'مصنعية:' : 'Labor:'}</span>
                            <input type="number" step="any" value="${itemLab}" data-type="lab" data-id="${item.id}" style="font-family: monospace;" class="p-1 border border-slate-800 rounded text-center font-semibold bg-slate-950 text-slate-100">
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

function saveItemDetail(itemId, key, value) {
    if (!itemDetailsCache[itemId]) itemDetailsCache[itemId] = {};
    itemDetailsCache[itemId][key] = value;
    localStorage.setItem('contractor_items_details', JSON.stringify(itemDetailsCache));
}

function handleItemImageUpload(itemId, inputElement) {
    const file = inputElement.files ? inputElement.files[0] : null;
    if (!file) return;

    compressAndBase64(file, (base64Img) => {
        if (!itemDetailsCache[itemId]) itemDetailsCache[itemId] = {};
        itemDetailsCache[itemId].img = base64Img;
        localStorage.setItem('contractor_items_details', JSON.stringify(itemDetailsCache));

        const previewImg = document.getElementById(`img-preview-${itemId}`);
        const icon = document.getElementById(`img-icon-${itemId}`);
        if (previewImg) { previewImg.src = base64Img; previewImg.classList.remove('hidden'); }
        if (icon) icon.classList.add('hidden');
    });
}

function deleteWorkItem(itemId) {
    if (!confirm('هل أنت تأكد من حذف هذا البند من المقايسة؟')) return;
    
    customItems = customItems.filter(item => item.id !== itemId);
    localStorage.setItem('contractor_custom_items', JSON.stringify(customItems));
    
    delete activeInputValues[itemId];
    delete itemDetailsCache[itemId];
    localStorage.setItem('contractor_items_details', JSON.stringify(itemDetailsCache));
    
    renderItems();
}

function toggleInlineAddCard(show) {
    const card = document.getElementById('inline-add-container');
    if (!card) return;
    if (show) {
        card.classList.remove('hidden');
        document.getElementById('inline-item-name').focus();
    } else {
        card.classList.add('hidden');
    }
}

function commitInlineNewItem() {
    const name = document.getElementById('inline-item-name').value.trim();
    const unit = document.getElementById('inline-item-unit').value;
    const desc = document.getElementById('inline-item-desc').value.trim();
    const mat = parseFloat(document.getElementById('inline-item-mat').value) || 0;
    const lab = parseFloat(document.getElementById('inline-item-lab').value) || 0;

    if (!name) { alert('برجاء كتابة اسم البند'); return; }

    const newItemId = "custom_" + Date.now();
    const newItem = { id: newItemId, name: name, name_ar: name, name_en: name, mat_cost: mat, lab_cost: lab, unit: unit };

    customItems.push(newItem);
    localStorage.setItem('contractor_custom_items', JSON.stringify(customItems));

    if (!itemDetailsCache[newItemId]) itemDetailsCache[newItemId] = {};
    itemDetailsCache[newItemId] = { name: name, desc: desc, unit: unit };
    localStorage.setItem('contractor_items_details', JSON.stringify(itemDetailsCache));

    document.getElementById('inline-item-name').value = '';
    document.getElementById('inline-item-desc').value = '';
    document.getElementById('inline-item-mat').value = '';
    document.getElementById('inline-item-lab').value = '';
    toggleInlineAddCard(false);

    renderItems();
}

// ☁️ 1. رفع وحفظ المقايسة بالكامل على سحابة Supabase
async function saveCurrentQuotationToCloud() {
    const clientName = document.getElementById('client-name').value.trim();
    if (!clientName) { alert('برجاء كتابة اسم العميل أولاً لحفظ المقايسة باسمه بالسحابة!'); return; }

    const btn = document.getElementById('save-current-q-btn');
    btn.disabled = true;
    btn.innerText = "جاري الحفظ بالسحابة...";

    snapshotCurrentInputs();

    const deviceId = getDeviceID();
    const qDataObj = {
        clientName: clientName,
        clientPhone: document.getElementById('client-phone').value.trim(),
        currency: document.getElementById('projectCurrency') ? document.getElementById('projectCurrency').value : 'AED',
        markup: document.getElementById('markup-rate').value,
        contingency: document.getElementById('contingency-rate').value,
        waste: document.getElementById('waste-rate').value,
        inputs: activeInputValues,
        customItems: customItems,
        itemDetailsCache: itemDetailsCache
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/quotations`, {
            method: 'POST',
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            body: JSON.stringify({
                device_id: deviceId,
                client_name: clientName,
                client_phone: qDataObj.clientPhone,
                quotation_data: qDataObj
            })
        });

        if (response.ok) {
            alert(`✅ تم حفظ مقايسة (${clientName}) بنجاح بالسحابة!`);
            fetchCloudQuotations();
        } else {
            throw new Error("فشل الحفظ في Supabase");
        }
    } catch (err) {
        console.error(err);
        alert("❌ خطأ: لم نتمكن من الحفظ بالسحابة، تحقّق من الاتصال بالإنترنت والجدول.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> <span>حفظ سحابي للمقايسة الحالية</span>`;
    }
}

// ☁️ 2. جلب وتنزيل أرشيف جميع المقايسات السحابية الخاصة بهذا الجهاز
async function fetchCloudQuotations() {
    const listContainer = document.getElementById('saved-quotations-list');
    if (!listContainer) return;

    const deviceId = getDeviceID();
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/quotations?device_id=eq.${deviceId}&order=created_at.desc`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();

        if (data && data.length > 0) {
            cloudSavedQuotations = data;
            renderCloudQuotationsUI();
        } else {
            listContainer.innerHTML = `<p id="no-saved-q-msg" class="text-xs text-slate-500 italic">لا توجد مقايسات محفوظة بالسحابة لهذا الجهاز بعد.</p>`;
        }
    } catch (err) {
        console.error(err);
        listContainer.innerHTML = `<p class="text-xs text-red-400">عفواً، فشل تحميل الأرشيف السحابي.</p>`;
    }
}

// 🎯 دعم الضغطة الطويلة (Long Press) للحذف
function renderCloudQuotationsUI() {
    const listContainer = document.getElementById('saved-quotations-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    cloudSavedQuotations.forEach(row => {
        const dateStr = new Date(row.created_at).toLocaleDateString('ar-EG');
        const btn = document.createElement('button');
        btn.className = "shrink-0 bg-slate-950 border border-indigo-500/30 hover:border-indigo-400 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 select-none relative group cursor-pointer";
        btn.innerHTML = `<i class="fas fa-cloud text-indigo-400"></i><span>${row.client_name} (${dateStr})</span>`;

        let pressTimer = null;

        btn.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                openDeleteCloudModal(row.id, row.client_name);
            }, 650);
        }, { passive: true });

        btn.addEventListener('touchend', () => { clearTimeout(pressTimer); });
        btn.addEventListener('touchmove', () => { clearTimeout(pressTimer); });

        btn.addEventListener('mousedown', () => {
            pressTimer = setTimeout(() => {
                openDeleteCloudModal(row.id, row.client_name);
            }, 650);
        });

        btn.addEventListener('mouseup', () => { clearTimeout(pressTimer); });
        btn.addEventListener('mouseleave', () => { clearTimeout(pressTimer); });

        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openDeleteCloudModal(row.id, row.client_name);
        });

        btn.addEventListener('click', () => {
            loadSavedQuotationFromCloud(row.id);
        });

        listContainer.appendChild(btn);
    });
}

// 🗑️ فتح نافذة الحذف المخصصة
function openDeleteCloudModal(rowId, clientName) {
    targetDeleteRowId = rowId;
    const modal = document.getElementById('delete-cloud-modal');
    const msg = document.getElementById('delete-modal-msg');
    
    if (modal && msg) {
        msg.innerText = `هل أنت تأكد من حذف المقايسة السحابية الخاصة بالعميل (${clientName}) نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`;
        modal.classList.remove('hidden');
    }
}

function closeDeleteCloudModal() {
    targetDeleteRowId = null;
    const modal = document.getElementById('delete-cloud-modal');
    if (modal) modal.classList.add('hidden');
}

// 🗑️ تنفيذ دالة الحذف النهائي من Supabase
async function executeDeleteCloudQuotation() {
    if (!targetDeleteRowId) return;

    const confirmBtn = document.getElementById('confirm-delete-cloud-btn');
    confirmBtn.disabled = true;
    confirmBtn.innerText = "جاري الحذف...";

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/quotations?id=eq.${targetDeleteRowId}`, {
            method: 'DELETE',
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`
            }
        });

        if (response.ok) {
            closeDeleteCloudModal();
            fetchCloudQuotations();
            alert("✅ تم حذف المقايسة بنجاح من الأرشيف السحابي!");
        } else {
            throw new Error("فشل الحذف من السحابة");
        }
    } catch (err) {
        console.error(err);
        alert("❌ خطأ: تعذر حذف المقايسة السحابية، تحقق من الاتصال بالإنترنت.");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerText = "تأكيد الحذف";
    }
}

// ☁️ 3. استرجاع وتحميل المقايسة السحابية كاملة
function loadSavedQuotationFromCloud(rowId) {
    const record = cloudSavedQuotations.find(r => r.id === rowId);
    if (!record || !record.quotation_data) return;

    const q = record.quotation_data;
    if (confirm(`هل تريد استرجاع المقايسة السحابية للعميل (${record.client_name}) بالكامل؟`)) {
        
        document.getElementById('client-name').value = q.clientName || record.client_name || '';
        document.getElementById('client-phone').value = q.clientPhone || record.client_phone || '';
        
        if (q.currency && document.getElementById('projectCurrency')) {
            document.getElementById('projectCurrency').value = q.currency;
        }

        if (q.markup !== undefined) document.getElementById('markup-rate').value = q.markup;
        if (q.contingency !== undefined) document.getElementById('contingency-rate').value = q.contingency;
        if (q.waste !== undefined) document.getElementById('waste-rate').value = q.waste;

        if (q.customItems && Array.isArray(q.customItems)) {
            customItems = q.customItems;
            localStorage.setItem('contractor_custom_items', JSON.stringify(customItems));
        }

        if (q.itemDetailsCache) {
            itemDetailsCache = q.itemDetailsCache;
            localStorage.setItem('contractor_items_details', JSON.stringify(itemDetailsCache));
        }

        activeInputValues = q.inputs || {};

        renderItems(true);

        Object.keys(activeInputValues).forEach(itemId => {
            const vals = activeInputValues[itemId];
            if (!vals) return;

            const areaInput = document.querySelector(`input[data-type="area"][data-id="${itemId}"]`);
            const nameInput = document.querySelector(`input[data-type="name"][data-id="${itemId}"]`);
            const descInput = document.querySelector(`textarea[data-type="desc"][data-id="${itemId}"]`);
            const unitSelect = document.querySelector(`select[data-type="unit"][data-id="${itemId}"]`);
            const matInput = document.querySelector(`input[data-type="mat"][data-id="${itemId}"]`);
            const labInput = document.querySelector(`input[data-type="lab"][data-id="${itemId}"]`);

            if (areaInput && vals.area !== undefined) areaInput.value = vals.area;
            if (nameInput && vals.name !== undefined) nameInput.value = vals.name;
            if (descInput && vals.desc !== undefined) descInput.value = vals.desc;
            if (unitSelect && vals.unit !== undefined) unitSelect.value = vals.unit;
            if (matInput && vals.mat !== undefined) matInput.value = vals.mat;
            if (labInput && vals.lab !== undefined) labInput.value = vals.lab;
        });

        alert(`✅ تم استرجاع كافة أرقام ومساحات مقايسة (${record.client_name}) بنجاح!`);
    }
}

// 🔒 دالة التحقق اليدوي المحدثة (مؤمنة بالكامل - قراءة فقط دون تجديد تجارب منتهية)
async function checkSubscriptionManually() {
    const fingerprint = getDeviceID();
    const now = new Date();
    
    const btn = document.getElementById('manual-verify-btn');
    const btnText = document.getElementById('verify-btn-text');
    const btnIcon = document.getElementById('verify-btn-icon');
    const lockMsg = document.getElementById('lock-message');
    const expiryBox = document.getElementById('expiry-display-box');
    const expiryDateText = document.getElementById('expiry-date-text');

    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-80');
    }
    if (btnText) btnText.innerText = "جاري مطابقة بيانات السيرفر...";
    if (btnIcon) btnIcon.innerText = "⏳";

    try {
        if (!navigator.onLine) {
            throw new Error("NoInternetManual");
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?device_id=eq.${fingerprint}`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();

        // 1. الجهاز غير موجود بالسحابة
        if (!data || data.length === 0) {
            localStorage.removeItem('contractor_subscription_expiry_cache');
            localStorage.removeItem('contractor_last_online_check');
            if (lockMsg) lockMsg.innerText = "⚠️ هذا الجهاز غير مسجل بالسحابة أو تم حذفه. يرجى الاشتراك لتفعيل الأداة.";
            if (expiryBox) expiryBox.classList.add('hidden');
            if (btnText) btnText.innerText = "فشل التحقق (الجهاز غير مسجل)";
            if (btnIcon) btnIcon.innerText = "❌";
            if (btn) {
                btn.style.background = "#ef4444";
                btn.disabled = false;
                btn.classList.remove('opacity-80');
            }
            return;
        }

        const user = data[0];
        let isAccessGranted = false;
        let expiryDateFormatted = "";
        let rawExpiryString = null;

        // 2. فحص الاشتراك المدفوع
        if (user.is_subscribed === true || user.is_subscribed === "true") {
            if (user.subscription_expires_at && new Date(user.subscription_expires_at) > now) {
                isAccessGranted = true;
                rawExpiryString = user.subscription_expires_at;
                const subExpiry = new Date(user.subscription_expires_at);
                expiryDateFormatted = "اشتراكك المدفوع ينتهي في: " + subExpiry.toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
            }
        }
        // 3. فحص التجربة المجانية (فقط إذا كانت سارية ولم تنتهِ)
        else if (user.trial_expires_at) {
            const trialExpiry = new Date(user.trial_expires_at);
            if (now < trialExpiry) {
                isAccessGranted = true;
                rawExpiryString = user.trial_expires_at;
                expiryDateFormatted = "الفترة التجريبية تنتهي في: " + trialExpiry.toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
            }
        }

        // 4. في حالة القبول والتفعيل الساري
        if (isAccessGranted && rawExpiryString) {
            localStorage.setItem('contractor_subscription_expiry_cache', rawExpiryString);
            localStorage.setItem('contractor_last_online_check', now.toISOString());
            handleOnlineStatus();

            if (expiryBox && expiryDateText) {
                expiryDateText.innerText = expiryDateFormatted;
                expiryBox.classList.remove('hidden');
            }

            if (btnText) btnText.innerText = "تم التحقق والفتح بنجاح";
            if (btnIcon) btnIcon.innerText = "✓";
            if (btn) btn.style.background = "#10b981";

            setTimeout(() => {
                const actScreen = document.getElementById('activation-screen');
                if (actScreen) actScreen.classList.add('hidden');
                window.location.reload(); 
            }, 1200);
        } 
        // 5. في حالة انتهاء الاشتراك أو انتهاء التجربة
        else {
            localStorage.removeItem('contractor_subscription_expiry_cache');
            localStorage.removeItem('contractor_last_online_check');

            if (expiryBox) expiryBox.classList.add('hidden');
            if (lockMsg) lockMsg.innerText = "🔒 انتهت فترة صلاحية هذا الجهاز. يرجى تجديد الاشتراك لفتح الأداة فوراً.";
            if (btnText) btnText.innerText = "فشل التحقق (الاشتراك منتهي)";
            if (btnIcon) btnIcon.innerText = "❌";
            if (btn) {
                btn.style.background = "#ef4444";
                btn.disabled = false;
                btn.classList.remove('opacity-80');
            }
        }

    } catch (error) {
        console.error(error);
        if (btnText) btnText.innerText = "خطأ في الاتصال بالإنترنت";
        if (btnIcon) btnIcon.innerText = "🌐";
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-80');
        }
        alert("❌ تعذر الاتصال بالسيرفر، يرجى التأكد من توفر اتصال بالإنترنت للتحقق من التفعيل.");
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
    
    document.querySelectorAll('.area-input').forEach(input => {
        input.placeholder = i18n[lang].placeholderArea;
    });
}

// ==========================================
// 🛡️ نظام الفحص الحي المباشر والحماية من السحابة (48 ساعة أوفلاين)
// ==========================================

const OFFLINE_LIMIT_MS = 48 * 60 * 60 * 1000; // 48 ساعة بالميللي ثانية

async function initSubscriptionGuard() {
    if (navigator.onLine) {
        try {
            const fingerprint = getDeviceID();
            const now = new Date();

            const response = await fetch(`${SUPABASE_URL}/rest/v1/users?device_id=eq.${fingerprint}`, {
                headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
            });
            const data = await response.json();

            if (!data || data.length === 0) {
                localStorage.removeItem('contractor_subscription_expiry_cache');
                localStorage.removeItem('contractor_last_online_check');
                showLockScreen("⚠️ تم إلغاء تفعيل هذا الجهاز من السحابة. يرجى التواصل مع الدعم أو التجديد.");
                return;
            }

            const user = data[0];
            let isAccessGranted = false;
            let rawExpiryString = null;

            if (user.is_subscribed === true || user.is_subscribed === "true") {
                if (user.subscription_expires_at && new Date(user.subscription_expires_at) > now) {
                    isAccessGranted = true;
                    rawExpiryString = user.subscription_expires_at;
                }
            } else if (user.trial_expires_at && new Date(user.trial_expires_at) > now) {
                isAccessGranted = true;
                rawExpiryString = user.trial_expires_at;
            }

            if (!isAccessGranted) {
                localStorage.removeItem('contractor_subscription_expiry_cache');
                localStorage.removeItem('contractor_last_online_check');
                showLockScreen("🔒 انتهت فترة اشتراكك أو تجريبتك المجانية بالسحابة. يرجى التجديد للتفعيل.");
                return;
            }

            localStorage.setItem('contractor_subscription_expiry_cache', rawExpiryString);
            localStorage.setItem('contractor_last_online_check', now.toISOString());
            handleOnlineStatus();

        } catch (err) {
            console.warn("تعذر الفحص الحي، الاعتماد على الفحص المحلي:", err);
            verifyLocalCacheGuard();
        }
    } else {
        verifyLocalCacheGuard();
    }

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
}

function verifyLocalCacheGuard() {
    const expiryDateStr = localStorage.getItem('contractor_subscription_expiry_cache');
    
    if (!expiryDateStr) {
        showLockScreen("لم يتم تفعيل التطبيق بعد. يرجى الاتصال بالإنترنت والاشتراك أولاً.");
        return;
    }

    const expiryDate = new Date(expiryDateStr);
    const now = new Date();

    if (now > expiryDate) {
        showLockScreen("انتهت مدة اشتراكك المعتمدة. يرجى الاتصال بالإنترنت للتجديد.");
        return;
    }

    checkOfflineGracePeriod();
}

function handleOfflineStatus() {
    if (!localStorage.getItem('sc_offline_start_time')) {
        localStorage.setItem('sc_offline_start_time', new Date().getTime().toString());
    }
    checkOfflineGracePeriod();
}

function handleOnlineStatus() {
    localStorage.removeItem('sc_offline_start_time');
    const banner = document.getElementById('offlineTimerBanner');
    if (banner) banner.remove();
}

function checkOfflineGracePeriod() {
    if (!navigator.onLine) {
        let offlineStart = localStorage.getItem('sc_offline_start_time');
        
        if (!offlineStart) {
            offlineStart = new Date().getTime().toString();
            localStorage.setItem('sc_offline_start_time', offlineStart);
        }

        const elapsed = new Date().getTime() - parseInt(offlineStart, 10);
        const remainingMs = OFFLINE_LIMIT_MS - elapsed;

        if (remainingMs <= 0) {
            showLockScreen("⚠️ انتهت مهلة العمل بدون إنترنت (48 ساعة). يرجى الاتصال بالإنترنت للتحقق من التفعيل.");
        } else {
            showOfflineBanner(remainingMs);
        }
    } else {
        handleOnlineStatus();
    }
}

function showOfflineBanner(remainingMs) {
    let banner = document.getElementById('offlineTimerBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offlineTimerBanner';
        banner.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%;
            background: #b45309; color: #ffffff; text-align: center;
            padding: 6px 12px; font-size: 12px; font-weight: bold;
            z-index: 9999; display: flex; align-items: center;
            justify-content: center; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            font-family: system-ui, sans-serif;
        `;
        document.body.prepend(banner);
    }

    const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutesLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    banner.innerHTML = `
        <span>📡 وضع أوفلاين: متبقي <b>${hoursLeft} ساعة و ${minutesLeft} دقيقة</b> للاتصال بالنت والتحقق</span>
    `;
}

function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('opacity-0')) {
        splash.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        setTimeout(() => {
            if (splash) splash.remove();
        }, 700);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    updateUILanguage();
    renderItems();
    fetchCloudQuotations();

    await initSubscriptionGuard();
    setInterval(() => {
        if (!navigator.onLine) checkOfflineGracePeriod();
    }, 60000);

    hideSplashScreen();

    const confirmDeleteBtn = document.getElementById('confirm-delete-cloud-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', executeDeleteCloudQuotation);
    }

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

            localStorage.setItem('contractor_initial_rates', JSON.stringify({
                markup: document.getElementById('markup-rate') ? document.getElementById('markup-rate').value : "15",
                contingency: document.getElementById('contingency-rate') ? document.getElementById('contingency-rate').value : "5",
                waste: document.getElementById('waste-rate') ? document.getElementById('waste-rate').value : "5"
            }));

            const commitDataToStorage = (logoBase64) => {
                const companyObj = { name, phone, address, logo: logoBase64 };
                localStorage.setItem('contractor_company', JSON.stringify(companyObj));
                companyData = companyObj;
                
                setTimeout(() => {
                    const setupScreen = document.getElementById('setup-screen');
                    if (setupScreen) setupScreen.classList.add('hidden');
                    saveSetupBtn.disabled = false;
                    saveSetupBtn.innerText = "حفظ البيانات والدخول";
                    alert("✅ تم الحفظ بنجاح في ذاكرة المتصفح!");
                }, 200);
            };

            if (logoFile) {
                compressAndBase64(logoFile, (compressedLogo) => {
                    commitDataToStorage(compressedLogo);
                });
            } else {
                commitDataToStorage('');
            }
        });
    }

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

    const pdfBtn = document.getElementById('generate-pdf-btn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            generateQuotationPDF();
        });
    }
});

function generateQuotationPDF() {
    const clientNameInput = document.getElementById('client-name');
    const cName = clientNameInput && clientNameInput.value.trim() ? clientNameInput.value.trim() : (currentLang === 'ar' ? 'عميل كريم' : 'Valued Client');
    
    const clientPhoneInput = document.getElementById('client-phone');
    const cPhone = clientPhoneInput && clientPhoneInput.value.trim() ? clientPhoneInput.value.trim() : '---';
    
    const currencySelect = document.getElementById('projectCurrency');
    const currentCurrency = currencySelect ? currencySelect.value : 'AED';

    const markup = parseFloat(document.getElementById('markup-rate').value) / 100;
    const contingency = parseFloat(document.getElementById('contingency-rate').value) / 100;
    const waste = parseFloat(document.getElementById('waste-rate').value) / 100;
    
    const allItems = [...defaultItems, ...customItems];
    let rowsHTML = '';
    let grandTotal = 0;
    
    allItems.forEach(item => {
        const areaInput = document.querySelector(`input[data-type="area"][data-id="${item.id}"]`);
        const nameInput = document.querySelector(`input[data-type="name"][data-id="${item.id}"]`);
        const descInput = document.querySelector(`textarea[data-type="desc"][data-id="${item.id}"]`);
        const unitSelect = document.querySelector(`select[data-type="unit"][data-id="${item.id}"]`);
        const matInput = document.querySelector(`input[data-type="mat"][data-id="${item.id}"]`);
        const labInput = document.querySelector(`input[data-type="lab"][data-id="${item.id}"]`);

        const area = areaInput ? parseFloat(areaInput.value) : 0;
        const currentItemName = nameInput ? nameInput.value.trim() : (currentLang === 'ar' ? item.name_ar : item.name_en);
        const currentItemDesc = descInput ? descInput.value.trim() : '';
        const currentUnit = unitSelect ? unitSelect.value : (item.unit || 'm2');
        const currentMatCost = matInput ? parseFloat(matInput.value) : item.mat_cost;
        const currentLabCost = labInput ? parseFloat(labInput.value) : item.lab_cost;

        const cached = itemDetailsCache[item.id] || {};
        const itemImg = cached.img || item.img || '';
        
        if (!isNaN(area) && area > 0) {
            const totalMaterialCost = area * currentMatCost * (1 + waste);
            const totalLaborCost = area * currentLabCost;
            const baseCost = totalMaterialCost + totalLaborCost;
            const finalPrice = baseCost * (1 + markup + contingency);
            
            grandTotal += finalPrice;
            
            rowsHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px; text-align: start; vertical-align: middle;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${itemImg ? `<img src="${itemImg}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; shrink: 0;">` : ''}
                            <div>
                                <span style="font-weight: 700; display: block; font-size: 14px; color: #0f172a;">${currentItemName}</span>
                                ${currentItemDesc ? `<span style="font-size: 11px; color: #64748b; font-weight: 500; display: block; margin-top: 2px;">${currentItemDesc}</span>` : ''}
                            </div>
                        </div>
                    </td>
                    <td style="padding: 12px; text-align: center; font-family: 'Courier New', monospace; vertical-align: middle; font-weight: 700;">
                        ${area.toLocaleString('en-US')} <br><span style="font-size: 10px; color: #475569; font-family: 'Cairo', sans-serif;">${getUnitLabel(currentUnit)}</span>
                    </td>
                    <td style="padding: 12px; text-align: center; font-family: 'Courier New', monospace; vertical-align: middle;">${(finalPrice / area).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span style="font-size: 10px; color: #64748b;">${currentCurrency}</span></td>
                    <td style="padding: 12px; text-align: center; font-weight: bold; color: #1e3a8a; font-family: 'Courier New', monospace; vertical-align: middle;">${finalPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span style="font-size: 10px; color: #1e3a8a;">${currentCurrency}</span></td>
                </tr>
            `;
        }
    });
    
    if (grandTotal === 0) {
        alert(currentLang === 'ar' ? 'برجاء إدخال كمية/مساحة بند واحد على الأقل!' : 'Please enter quantity/area for at least one item!');
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
                            <th style="padding: 12px; text-align: start;">${currentLang === 'ar' ? 'البيان والتوصيف الفني' : 'Description & Specs'}</th>
                            <th style="padding: 12px; text-align: center;">${currentLang === 'ar' ? 'الكمية/الوحدة' : 'Qty / Unit'}</th>
                            <th style="padding: 12px; text-align: center;">${currentLang === 'ar' ? 'سعر الفئة التقريبي' : 'Unit Price'}</th>
                            <th style="padding: 12px; text-align: center;">${currentLang === 'ar' ? 'إجمالي البند' : 'Total Price'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                </table>
                
                <div style="font-size: 18px; color: #15803d; font-weight: bold; background: #f0fdf4; padding: 15px; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center; margin-bottom: 40px; font-family: 'Courier New', monospace;">
                    ${currentLang === 'ar' ? 'الإجمالي العام للمقايسة:' : 'Grand Total Amount:'} ${grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currentCurrency}
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

setTimeout(hideSplashScreen, 2000);
window.addEventListener('load', hideSplashScreen);
