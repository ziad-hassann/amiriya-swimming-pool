(function () {
  const STORAGE_KEY = "amiriya_swimmers_v1";
  const HISTORY_KEY = "amiriya_changes_v1";
  const EDIT_FIELDS = ["full_name", "phone", "birth_date", "membership_type", "subscription_amount"];
  const membershipGroups = {
    "مدارس":"IOIuoY7e1Ur7XYIkISFD9I", "تجهيزي":"DRlTKwtz4PZ2GNO2SGZnb3",
    "ستار 1":"C3M71SNfeu8CQASabKFi6y", "ستار 2":"LF7kDfSUQWpCQddpO9CshT",
    "ستار 3:4":"DAz8HUaOfnbHS1CMG8Zboo", "قطاع بطولة قديم":"CMrvwSqXUQf9t5ij5uIueb",
    "قطاع بطولة جديد":"IBYWZCwqNQNJhD0Z7FuZ53", "قطاع بطولة زعانف":"EFJkfnidbZb5ycpiZGRBOr"
  };

  function editableSnapshot(record) {
    const result = {};
    EDIT_FIELDS.forEach(function (field) { result[field] = String(record[field] == null ? "" : record[field]); });
    return result;
  }

  const arabicDigits = {
    "\u0660": "0",
    "\u0661": "1",
    "\u0662": "2",
    "\u0663": "3",
    "\u0664": "4",
    "\u0665": "5",
    "\u0666": "6",
    "\u0667": "7",
    "\u0668": "8",
    "\u0669": "9",
    "\u06f0": "0",
    "\u06f1": "1",
    "\u06f2": "2",
    "\u06f3": "3",
    "\u06f4": "4",
    "\u06f5": "5",
    "\u06f6": "6",
    "\u06f7": "7",
    "\u06f8": "8",
    "\u06f9": "9"
  };

  function getConfig() {
    return window.WEB_DATA_CONFIG || {};
  }

  function getAppsScriptUrl() {
    return String(getConfig().APPS_SCRIPT_URL || "").trim();
  }

  function hasRemoteApi() {
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(getAppsScriptUrl());
  }

  function canUseLocalPreview() {
    return getConfig().ALLOW_LOCAL_PREVIEW === true &&
      (window.location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname));
  }

  function missingConnection() {
    return Promise.reject(new Error("التسجيل غير متاح حاليًا. يرجى المحاولة بعد تفعيل الاتصال بجدول التسجيل."));
  }

  function apiRequest(params) {
    const apiUrl = getAppsScriptUrl();

    if (!hasRemoteApi()) {
      return Promise.reject(new Error("Apps Script URL is not configured."));
    }

    const url = new URL(apiUrl);
    Object.keys(params || {}).forEach(function (key) {
      url.searchParams.set(key, params[key]);
    });
    url.searchParams.set("_", Date.now());
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 180000);
    return fetch(url.toString(), {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    }).then(function (response) {
      if (!response.ok) throw new Error("Could not connect to Google Sheet.");
      return response.json();
    }).then(function (response) {
      if (!response || response.ok === false) {
        throw new Error((response && response.message) || "Google Sheet request failed.");
      }
      return response;
    }).finally(function () { window.clearTimeout(timeout); });
  }

  function toLatinDigits(value) {
    return String(value || "").replace(/[\u0660-\u0669\u06f0-\u06f9]/g, function (digit) {
      return arabicDigits[digit];
    });
  }

  function cleanText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function normalizeMemberName(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[\u064e\u064b\u064f\u064c\u0650\u064d\u0652\u0651]/g, "");
  }

  function normalizePhone(value) {
    let digits = toLatinDigits(value).replace(/\D/g, "");

    if (digits.startsWith("0020")) {
      digits = "0" + digits.slice(4);
    } else if (digits.startsWith("20")) {
      digits = "0" + digits.slice(2);
    } else if (digits.length === 10 && digits.startsWith("1")) {
      digits = "0" + digits;
    }

    return digits;
  }

  function validatePhone(value) {
    const normalized = normalizePhone(value);

    if (!/^01[0125][0-9]{8}$/.test(normalized)) {
      return {
        valid: false,
        normalized: normalized,
        message: "\u0627\u0643\u062a\u0628 \u0631\u0642\u0645 \u0645\u0648\u0628\u0627\u064a\u0644 \u0645\u0635\u0631\u064a \u0635\u062d\u064a\u062d \u064a\u0628\u062f\u0623 \u0628\u0640 010 \u0623\u0648 011 \u0623\u0648 012 \u0623\u0648 015."
      };
    }

    return { valid: true, normalized: normalized, message: "" };
  }

  function isRealDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function parseBirthDate(value) {
    const normalized = toLatinDigits(value).trim();
    const ymd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let day;
    let month;
    let year;

    if (!ymd) {
      return { valid: false, iso: "", message: "\u0627\u062e\u062a\u0627\u0631 \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u064a\u0644\u0627\u062f \u0628\u0627\u0644\u0643\u0627\u0645\u0644." };
    }

    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);

    if (year < 1900 || year > new Date().getFullYear() || !isRealDate(year, month, day)) {
      return { valid: false, iso: "", message: "\u0627\u062e\u062a\u0627\u0631 \u062a\u0627\u0631\u064a\u062e \u0645\u064a\u0644\u0627\u062f \u0635\u062d\u064a\u062d." };
    }

    return {
      valid: true,
      iso: year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0"),
      message: ""
    };
  }

  function getWhatsappUrl(phone) {
    const normalized = normalizePhone(phone);
    return "https://wa.me/20" + normalized.slice(1);
  }

  function getLocalRegistrations() {
    try {
      const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(records) ? records : [];
    } catch (error) {
      return [];
    }
  }

  function saveLocalRegistrations(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function addLocalRegistration(record) {
    const records = getLocalRegistrations();
    const exists = records.some(function (item) {
      const itemName = item.normalized_name || normalizeMemberName(item.full_name);
      return itemName === record.normalized_name;
    });

    if (exists) {
      return { ok:true, duplicate:true, message:"الاسم ده غير متاح لأنه مستخدم بالفعل. اكتب الاسم الرباعي للسباح لتمييزه. لم يتم إرسال النموذج." };
    }

    records.push(record);
    saveLocalRegistrations(records);
    return { ok: true, duplicate: false, record: record, message: "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0639\u0636\u0648 \u0628\u0646\u062c\u0627\u062d." };
  }

  function createRegistration(record) {
    if (!hasRemoteApi()) {
      if (!canUseLocalPreview()) return missingConnection();
      return Promise.resolve(addLocalRegistration(record));
    }

    return apiRequest({
      action: "register",
      payload: JSON.stringify(record)
    });
  }

  async function listRegistrations(adminPassword) {
    if (!hasRemoteApi()) {
      if (!canUseLocalPreview()) return missingConnection();
      return Promise.resolve(getLocalRegistrations());
    }

    return adminRequest({ action: "list" }, adminPassword).then(function (response) { return response.registrations || []; });
  }

  async function adminRequest(params, adminPassword) {
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(adminPassword || ""));
    const passwordHash = Array.from(new Uint8Array(digest), function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return apiRequest(Object.assign({}, params, { admin_password_hash: passwordHash }));
  }

  async function updateRegistration(patch, expected, adminPassword, operationId) {
    if (hasRemoteApi()) return adminRequest({ action:"update", payload:JSON.stringify(patch), expected:JSON.stringify(expected), operation_id:operationId }, adminPassword);
    if (!canUseLocalPreview()) return missingConnection();
    const records = getLocalRegistrations();
    const index = records.findIndex(function (record) { return record.id === patch.id; });
    if (index < 0) throw new Error("هذا التسجيل غير موجود. حدّث البيانات.");
    const before = records[index];
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const previousOperation = history.find(function (entry) { return entry.id === operationId; });
    if (previousOperation) {
      if (previousOperation.record_id !== before.id) throw new Error("معرف التعديل غير صالح.");
      return {ok:true,record:before,already_applied:true};
    }
    const snapshot = editableSnapshot(before);
    if (EDIT_FIELDS.some(function (key) { return snapshot[key] !== String(expected[key]); })) throw new Error("تم تعديل البيانات بالفعل. أغلق النافذة وحدّث السجلات قبل المحاولة مرة أخرى.");
    const phone = validatePhone(patch.phone), birth = parseBirthDate(patch.birth_date);
    const name = cleanText(patch.full_name), amount = Number(patch.subscription_amount);
    if (name.length < 3 || name.length > 120 || !/^[\u0621-\u063a\u0641-\u064a\u066e-\u06d3\u064b-\u065fA-Za-z\s.'-]+$/.test(name) || !phone.valid || !birth.valid || new Date(birth.iso) > new Date() || !Object.prototype.hasOwnProperty.call(membershipGroups, patch.membership_type) || !Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > .00001) throw new Error("راجع الاسم ورقم ولي الأمر وتاريخ الميلاد ونوع ومبلغ الاشتراك.");
    const now = new Date(), parts = birth.iso.split("-").map(Number);
    const after = Object.assign({}, before, { full_name:name, normalized_name:normalizeMemberName(name), phone:phone.normalized, normalized_phone:phone.normalized, birth_date:birth.iso, membership_type:patch.membership_type, subscription_amount:amount, age:now.getFullYear() - parts[0] - (now.getMonth() + 1 < parts[1] || (now.getMonth() + 1 === parts[1] && now.getDate() < parts[2]) ? 1 : 0), whatsapp_url:getWhatsappUrl(phone.normalized), whatsapp_group_url:"https://chat.whatsapp.com/" + membershipGroups[patch.membership_type] + "?mode=gi_t" });
    if (records.some(function (record, i) { return i !== index && normalizeMemberName(record.full_name) === after.normalized_name; })) throw new Error("الاسم ده غير متاح لأنه مستخدم بالفعل. لم يتم حفظ التعديل.");
    const changes = EDIT_FIELDS.filter(function (key) { return String(before[key]) !== String(after[key]); }).map(function (key) { return { field:key, before:before[key], after:after[key] }; });
    if (!changes.length) return { ok:true, no_changes:true, record:before };
    const entry = { id:operationId, record_id:before.id, changed_at:now.toISOString(), actor:"الإدارة", changes:changes };
    records[index] = after;
    const originalRecords = localStorage.getItem(STORAGE_KEY);
    try { saveLocalRegistrations(records); localStorage.setItem(HISTORY_KEY, JSON.stringify(history.concat(entry))); }
    catch (error) { if (originalRecords === null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, originalRecords); throw error; }
    return { ok:true, record:after };
  }

  async function listHistory(recordId, adminPassword) {
    if (hasRemoteApi()) return adminRequest({action:"history", record_id:recordId || ""},adminPassword).then(function (response) { return response.history || []; });
    if (!canUseLocalPreview()) return missingConnection();
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]").filter(function (entry) { return !recordId || entry.record_id === recordId; }).reverse();
  }

  function warmRemoteApi() {
    if (!hasRemoteApi()) {
      return Promise.resolve();
    }

    return apiRequest({ action: "ping" }).catch(function () {});
  }

  function formatDisplayDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function makeId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }

    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function setStatus(element, type, message) {
    element.className = "status status--" + type;
    element.textContent = message;
    element.classList.remove("hidden");
  }

  function clearStatus(element) {
    element.textContent = "";
    element.className = "status hidden";
  }

  window.WebData = {
    membershipGroups: membershipGroups,
    editableSnapshot: editableSnapshot,
    updateRegistration: updateRegistration,
    listHistory: listHistory,
    hasRemoteApi: hasRemoteApi,
    cleanText: cleanText,
    normalizeMemberName: normalizeMemberName,
    validatePhone: validatePhone,
    parseBirthDate: parseBirthDate,
    getWhatsappUrl: getWhatsappUrl,
    createRegistration: createRegistration,
    listRegistrations: listRegistrations,
    warmRemoteApi: warmRemoteApi,
    formatDisplayDate: formatDisplayDate,
    makeId: makeId,
    setStatus: setStatus,
    clearStatus: clearStatus
  };
})();
