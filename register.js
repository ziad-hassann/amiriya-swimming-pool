(function () {
  const get = function (id) { return document.getElementById(id); };
  const form = get("registrationForm"), birth = get("birthDate"), membership = get("membershipType"), submit = get("submitButton"), status = get("formStatus");
  window.setTimeout(function () { get("welcomeScreen").classList.add("welcome-screen--hidden"); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100);
  function updateProgress() {
    const fields = [get("fullName"), get("phone"), get("birthDay"), get("birthMonth"), get("birthYear"), membership, get("subscriptionAmount")];
    const count = [fields[0].value.trim().length >= 3, WebData.validatePhone(fields[1].value).valid, !!(fields[2].value && fields[3].value && fields[4].value), get("age").value !== "", !!membership.value, Number(get("subscriptionAmount").value) > 0].filter(Boolean).length;
    get("progressLabel").textContent = count + " / 6";
    get("progressFill").style.width = count / 6 * 100 + "%";
  }
  const groups = WebData.membershipGroups;
  Object.keys(groups).forEach(function (name) { membership.add(new Option(name, name)); });
  const today = new Date();
  birth.max = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0"); birth.min = "1900-01-01";
  function ageFor(value) {
    const parts = value.split("-").map(Number), now = new Date();
    return now.getFullYear() - parts[0] - (now.getMonth() + 1 < parts[1] || (now.getMonth() + 1 === parts[1] && now.getDate() < parts[2]) ? 1 : 0);
  }
  function groupUrl() { return "https://chat.whatsapp.com/" + groups[membership.value] + "?mode=gi_t"; }
  membership.addEventListener("change", function () { get("groupNotice").classList.toggle("hidden", !membership.value); get("groupLabel").textContent = "جروب " + membership.value; if (membership.value) get("groupLink").href = groupUrl(); });
  const day = get("birthDay"), month = get("birthMonth"), year = get("birthYear");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  months.forEach(function (name, index) { month.add(new Option(name, String(index + 1).padStart(2, "0"))); });
  for (let value = today.getFullYear(); value >= 1900; value--) year.add(new Option(String(value), String(value)));
  function updateDays() {
    const selected = day.value;
    const count = month.value ? new Date(Number(year.value) || today.getFullYear(), Number(month.value), 0).getDate() : 31;
    day.replaceChildren(new Option("Day", ""));
    for (let value = 1; value <= count; value++) day.add(new Option(String(value), String(value).padStart(2, "0")));
    if (Number(selected) <= count) day.value = selected;
  }
  function syncBirth() {
    birth.value = day.value && month.value && year.value ? year.value + "-" + month.value + "-" + day.value : "";
    const check = WebData.parseBirthDate(birth.value);
    get("age").value = check.valid && birth.value <= birth.max ? ageFor(birth.value) : "";
    WebData.clearStatus(status); updateProgress();
  }
  updateDays();
  [day, month, year].forEach(function (select) { select.addEventListener("change", function () { if (select !== day) updateDays(); syncBirth(); }); });
  form.addEventListener("reset", function () { birth.value = ""; });
  form.addEventListener("input", function () { WebData.clearStatus(status); updateProgress(); });
  form.addEventListener("change", updateProgress);
  form.addEventListener("submit", async function (event) {
    event.preventDefault(); if (submit.disabled) return;
    const name = WebData.cleanText(get("fullName").value), phone = WebData.validatePhone(get("phone").value), date = WebData.parseBirthDate(birth.value), amount = Number(get("subscriptionAmount").value);
    let error = "";
    if (name.length < 3 || name.length > 120 || !/^[\u0621-\u063a\u0641-\u064a\u066e-\u06d3\u064b-\u065fA-Za-z\s.'-]+$/.test(name)) error = "اكتب اسم السباح بالكامل بدون أرقام أو رموز غير مناسبة.";
    else if (!phone.valid) error = phone.message;
    else if (!date.valid || date.iso > birth.max) error = "اختر تاريخ ميلاد صحيحًا لا يتجاوز اليوم.";
    else if (!Object.prototype.hasOwnProperty.call(groups, membership.value)) error = "اختر نوع الاشتراك.";
    else if (!Number.isFinite(amount) || amount <= 0) error = "اكتب مبلغ اشتراك أكبر من صفر.";
    if (error) { WebData.setStatus(status, "error", error); return; }
    submit.disabled = true; get("submitSpinner").classList.remove("hidden"); get("submitLabel").textContent = "جاري التسجيل..."; WebData.setStatus(status, "info", "جاري حفظ بيانات السباح...");
    const url = groupUrl();
    try {
      const result = await WebData.createRegistration({ id: WebData.makeId(), full_name: name, normalized_name: WebData.normalizeMemberName(name), phone: phone.normalized, normalized_phone: phone.normalized, birth_date: date.iso, age: ageFor(date.iso), branch: "مركز شباب الأميرية", membership_type: membership.value, subscription_amount: amount, whatsapp_group_url: url, whatsapp_url: WebData.getWhatsappUrl(phone.normalized), created_at: new Date().toISOString() });
      if (result.duplicate) { WebData.setStatus(status, "error", "الاسم ده غير متاح لأنه مستخدم بالفعل. اكتب الاسم الرباعي للسباح لتمييزه. لم يتم إرسال النموذج."); return; }
      get("successName").textContent = "شكرًا لتسجيل السباح " + name + "."; get("successGroupLink").href = url;
      form.classList.add("hidden"); get("successPanel").classList.remove("hidden"); get("successPanel").focus();
    } catch (error) { WebData.setStatus(status, "error", error.message || "تعذر حفظ البيانات. حاول مرة أخرى."); }
    finally { submit.disabled = false; get("submitSpinner").classList.add("hidden"); get("submitLabel").textContent = "إرسال النموذج"; }
  });
  get("newRegistration").addEventListener("click", function () { form.reset(); get("age").value = ""; updateDays(); updateProgress(); WebData.clearStatus(status); get("groupNotice").classList.add("hidden"); get("successPanel").classList.add("hidden"); form.classList.remove("hidden"); get("fullName").focus(); });
})();
