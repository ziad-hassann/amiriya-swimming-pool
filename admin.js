(function () {
  const loginPanel = document.getElementById("loginPanel");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("adminPassword");
  const loginStatus = document.getElementById("loginStatus");
  const dashboard = document.getElementById("dashboard");
  const dashboardStatus = document.getElementById("dashboardStatus");
  const totalCount = document.getElementById("totalCount");
  const branchesCount = document.getElementById("branchesCount");
  const visibleCount = document.getElementById("visibleCount");
  const visibleLabel = document.getElementById("visibleLabel");
  const selectedCount = document.getElementById("selectedCount");
  const branchTabs = document.getElementById("branchTabs");
  const recordsBody = document.getElementById("recordsBody");
  const emptyState = document.getElementById("emptyState");
  const refreshButton = document.getElementById("refreshButton");
  const selectVisibleButton = document.getElementById("selectVisibleButton");
  const clearSelectionButton = document.getElementById("clearSelectionButton");
  const exportButton = document.getElementById("exportButton");
  const selectVisibleToggle = document.getElementById("selectVisibleToggle");

  let records = [];
  let activeBranch = "all";
  let currentAdminPassword = "";
  let selectedIds = new Set();
  let currentPage = 1;
  const pageSize = 25;
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const localMode = !WebData.hasRemoteApi();
  const editDialog = document.getElementById("editDialog");
  const historyDialog = document.getElementById("historyDialog");
  let editingRecord = null;
  let expectedSnapshot = null;
  let operationId = "";
  let saving = false;
  let historyRequest = 0;
  const deleteDialog = document.getElementById("deleteDialog");
  const trashDialog = document.getElementById("trashDialog");
  let deletionTargets = [];
  let deleting = false;
  let restoring = false;
  Object.keys(WebData.membershipGroups).forEach(function (name) { document.getElementById("editMembership").add(new Option(name,name)); });
  if (localMode) {
    document.getElementById("loginDescription").textContent = "أدخل كلمة سر الإدارة";
  }

  async function validateLocalPassword(password) {
    const expected = String((window.AMIRIYA_ADMIN_CONFIG || {}).LOCAL_PASSWORD_SHA256 || "");
    if (!expected) throw new Error("لم يتم تعيين كلمة سر الإدارة بعد.");
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest), function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return hash === expected;
  }

  window.setTimeout(WebData.warmRemoteApi, 800);

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function groupByBranch(list) {
    return list.reduce(function (groups, record) {
      const branch = record.membership_type || "بدون نوع اشتراك";
      groups[branch] = groups[branch] || [];
      groups[branch].push(record);
      return groups;
    }, {});
  }

  function getBranchNames(grouped) {
    return Object.keys(grouped).sort(function (a, b) {
      return a.localeCompare(b, "ar");
    });
  }

  function getVisibleRecords(grouped) {
    const query = WebData.normalizeMemberName(searchInput.value);
    const list = activeBranch === "all" ? records : grouped[activeBranch] || [];
    return list.filter(function (record) {
      return !query || WebData.normalizeMemberName(record.full_name).includes(query) || String(record.phone || "").includes(query);
    }).slice().sort(function (a, b) {
      if (sortSelect.value === "name") return String(a.full_name).localeCompare(String(b.full_name), "ar");
      if (sortSelect.value === "amount") return Number(b.subscription_amount || 0) - Number(a.subscription_amount || 0);
      const difference = new Date(b.created_at) - new Date(a.created_at);
      return sortSelect.value === "oldest" ? -difference : difference;
    });
  }

  function getRecordKey(record) {
    if (record.id) {
      return String(record.id);
    }

    return [
      record.normalized_phone || record.phone || "",
      record.normalized_name || record.full_name || "",
      record.created_at || ""
    ].join("|");
  }

  function getSelectedRecords() {
    return records.filter(function (record) {
      return selectedIds.has(getRecordKey(record));
    });
  }

  function syncSelectedIds() {
    const currentIds = new Set(records.map(getRecordKey));

    selectedIds.forEach(function (id) {
      if (!currentIds.has(id)) {
        selectedIds.delete(id);
      }
    });
  }

  function createBranchButton(label, count, value) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = value === activeBranch ? "branch-tab branch-tab--active" : "branch-tab";
    button.textContent = label + " ";

    const countTag = document.createElement("span");
    countTag.textContent = count;
    button.appendChild(countTag);

    button.addEventListener("click", function () {
      activeBranch = value;
      currentPage = 1;
      render();
    });

    return button;
  }

  function renderTabs(grouped, branches) {
    branchTabs.innerHTML = "";
    branchTabs.appendChild(createBranchButton("\u0627\u0644\u0643\u0644", records.length, "all"));

    branches.forEach(function (branch) {
      branchTabs.appendChild(createBranchButton(branch, grouped[branch].length, branch));
    });
  }

  function renderTable(list) {
    recordsBody.innerHTML = "";
    emptyState.classList.toggle("hidden", list.length > 0);

    list.forEach(function (record) {
      const row = document.createElement("tr");
      const recordKey = getRecordKey(record);
      row.classList.toggle("selected", selectedIds.has(recordKey));

      row.innerHTML =
        '<td class="select-cell"><input class="select-checkbox record-select" type="checkbox" data-record-id="' + escapeHtml(recordKey) + '" aria-label="\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u062a\u0633\u062c\u064a\u0644"' + (selectedIds.has(recordKey) ? " checked" : "") + "></td>" +
        "<td>" + escapeHtml(record.full_name) + "</td>" +
        "<td>" + escapeHtml(record.phone) + "</td>" +
        "<td>" + escapeHtml(record.birth_date) + "</td>" +
        "<td>" + escapeHtml(record.age == null ? "" : String(record.age)) + "</td>" +
        '<td><span class="membership-badge">' + escapeHtml(record.membership_type) + "</span></td>" +
        "<td>" + escapeHtml(record.subscription_amount == null ? "" : String(record.subscription_amount)) + "</td>" +
        '<td><a class="whatsapp-link" href="' + escapeHtml(WebData.getWhatsappUrl(record.phone)) + '" target="_blank" rel="noopener noreferrer">فتح واتساب ↗</a></td>' +
        "<td>" + escapeHtml(WebData.formatDisplayDate(record.created_at)) + "</td>" +
        '<td><div class="row-actions"><button class="button icon-button" type="button" data-edit="' + escapeHtml(record.id) + '" title="تعديل بيانات السباح" aria-label="تعديل بيانات السباح"><i data-lucide="pencil"></i></button><button class="button icon-button" type="button" data-history="' + escapeHtml(record.id) + '" title="سجل تعديلات السباح" aria-label="سجل تعديلات السباح"><i data-lucide="history"></i></button></div></td>';

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button icon-button button--danger";
      deleteButton.dataset.delete = record.id;
      deleteButton.title = "حذف السباح";
      deleteButton.setAttribute("aria-label", "حذف السباح");
      deleteButton.innerHTML = '<i data-lucide="trash-2"></i>';
      row.querySelector(".row-actions").appendChild(deleteButton);
      recordsBody.appendChild(row);
    });
    if (window.lucide) window.lucide.createIcons({ attrs:{width:16,height:16,'stroke-width':1.8} });
  }

  function updateSelectionControls(visibleRecords) {
    const visibleIds = visibleRecords.map(getRecordKey);
    const selectedVisibleCount = visibleIds.filter(function (id) {
      return selectedIds.has(id);
    }).length;

    selectedCount.textContent = selectedIds.size;
    selectVisibleButton.disabled = visibleIds.length === 0;
    clearSelectionButton.disabled = selectedIds.size === 0;
    exportButton.disabled = selectedIds.size === 0;
    document.getElementById("deleteSelectedButton").disabled = selectedIds.size === 0 || deleting;
    document.getElementById("deleteAllButton").disabled = records.length === 0 || deleting;
    selectVisibleToggle.disabled = visibleIds.length === 0;
    selectVisibleToggle.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
    selectVisibleToggle.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  }

  function render() {
    const grouped = groupByBranch(records);
    const branches = getBranchNames(grouped);
    const visibleRecords = getVisibleRecords(grouped);

    totalCount.textContent = records.length;
    document.getElementById("totalAmount").textContent = new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 }).format(records.reduce(function (sum, record) { return sum + (Number(record.subscription_amount) || 0); }, 0));
    branchesCount.textContent = branches.length;
    visibleCount.textContent = visibleRecords.length;
    visibleLabel.textContent = activeBranch === "all" ? "\u0627\u0644\u0645\u0639\u0631\u0648\u0636 \u0627\u0644\u0622\u0646" : activeBranch;

    renderTabs(grouped, branches);
    const pages = Math.max(1, Math.ceil(visibleRecords.length / pageSize));
    currentPage = Math.min(currentPage, pages);
    renderTable(visibleRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize));
    document.getElementById("pageLabel").textContent = visibleRecords.length ? "صفحة " + currentPage + " من " + pages + " · " + visibleRecords.length + " تسجيل" : "لا توجد نتائج";
    document.getElementById("prevPage").disabled = currentPage <= 1;
    document.getElementById("nextPage").disabled = currentPage >= pages;
    document.getElementById("exportVisibleButton").disabled = !visibleRecords.length;
    updateSelectionControls(visibleRecords);
  }

  async function loadRecords() {
    WebData.setStatus(dashboardStatus, "info", "\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062f\u0627\u062a\u0627...");
    refreshButton.disabled = true;

    try {
      records = (await WebData.listRegistrations(currentAdminPassword)).sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      syncSelectedIds();
      if (activeBranch !== "all" && !records.some(function (record) { return record.membership_type === activeBranch; })) activeBranch = "all";

      render();
      WebData.setStatus(dashboardStatus, "success", "\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062f\u0627\u062a\u0627 \u0628\u0646\u062c\u0627\u062d.");
      document.getElementById("lastUpdated").textContent = (localMode ? "معاينة محلية · " : "") + "آخر تحديث " + new Intl.DateTimeFormat("ar-EG", { hour: "2-digit", minute: "2-digit" }).format(new Date());
      return true;
    } catch (error) {
      WebData.setStatus(dashboardStatus, "error", error.message || "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062f\u0627\u062a\u0627.");
      WebData.setStatus(loginStatus, "error", error.message || "تعذر الاتصال. حاول مرة أخرى.");
      return false;
    } finally {
      refreshButton.disabled = false;
    }
  }

  function toSheetRows(list) {
    return list.map(function (record) {
      return {
        "اسم السباح": record.full_name,
        "رقم ولي الأمر": record.phone,
        "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u064a\u0644\u0627\u062f": record.birth_date,
        "السن": record.age,
        "مبلغ الاشتراك (جنيه)": Number(record.subscription_amount) || 0,
        "جروب الاشتراك": record.whatsapp_group_url,
        "نوع الاشتراك": record.membership_type,
        "\u0648\u0627\u062a\u0633\u0627\u0628": record.whatsapp_url,
        "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u062c\u064a\u0644": WebData.formatDisplayDate(record.created_at)
      };
    });
  }

  function buildSheet(list) {
    const sheet = XLSX.utils.json_to_sheet(toSheetRows(list));
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");

    for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
      const phoneCell = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
      if (phoneCell) {
        phoneCell.t = "s";
        phoneCell.z = "@";
      }
    }

    sheet["!cols"] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 16 },
      { wch: 10 },
      { wch: 18 },
      { wch: 60 },
      { wch: 26 },
      { wch: 35 },
      { wch: 18 }
    ];

    return sheet;
  }

  function safeSheetName(name) {
    return String(name || "\u0641\u0631\u0639").replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "\u0641\u0631\u0639";
  }

  function exportExcel(sourceRecords) {
    if (!window.XLSX) {
      WebData.setStatus(dashboardStatus, "error", "\u0645\u0644\u0641 \u0645\u0643\u062a\u0628\u0629 Excel \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f.");
      return;
    }

    const selectedRecords = Array.isArray(sourceRecords) ? sourceRecords : getSelectedRecords();

    if (!selectedRecords.length) {
      WebData.setStatus(dashboardStatus, "error", "\u0627\u062e\u062a\u0627\u0631 \u062a\u0633\u062c\u064a\u0644 \u0648\u0627\u062d\u062f \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0642\u0628\u0644 \u0627\u0644\u062a\u062d\u0645\u064a\u0644.");
      return;
    }

    const grouped = groupByBranch(selectedRecords);
    const branches = getBranchNames(grouped);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, buildSheet(selectedRecords), "\u0643\u0644 \u0627\u0644\u0645\u062d\u062f\u062f");

    branches.forEach(function (branch) {
      XLSX.utils.book_append_sheet(workbook, buildSheet(grouped[branch]), safeSheetName(branch));
    });

    XLSX.writeFile(workbook, "amiriya-swimmers.xlsx", {
      bookType: "xlsx",
      cellStyles: true
    });
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!passwordInput.value.trim()) {
      WebData.setStatus(loginStatus, "error", "\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d\u0629.");
      return;
    }

    currentAdminPassword = passwordInput.value.trim();
    const button = document.getElementById("loginButton");
    if (button.disabled) return;
    button.disabled = true;
    WebData.clearStatus(loginStatus);
    try {
      if (localMode && !(await validateLocalPassword(currentAdminPassword))) {
        currentAdminPassword = "";
        WebData.setStatus(loginStatus, "error", "كلمة السر غير صحيحة.");
        return;
      }
      const loaded = await loadRecords();
      if (loaded) { loginPanel.classList.add("hidden"); dashboard.classList.remove("hidden"); passwordInput.value = ""; }
    } catch (error) {
      currentAdminPassword = "";
      WebData.setStatus(loginStatus, "error", error.message || "تعذر التحقق من كلمة السر.");
    } finally { button.disabled = false; }
  });

  refreshButton.addEventListener("click", loadRecords);
  selectVisibleButton.addEventListener("click", function () {
    const grouped = groupByBranch(records);

    getVisibleRecords(grouped).forEach(function (record) {
      selectedIds.add(getRecordKey(record));
    });

    render();
  });
  clearSelectionButton.addEventListener("click", function () {
    selectedIds.clear();
    render();
  });
  selectVisibleToggle.addEventListener("change", function () {
    const grouped = groupByBranch(records);
    const visibleRecords = getVisibleRecords(grouped);

    visibleRecords.forEach(function (record) {
      const recordKey = getRecordKey(record);

      if (selectVisibleToggle.checked) {
        selectedIds.add(recordKey);
      } else {
        selectedIds.delete(recordKey);
      }
    });

    render();
  });
  recordsBody.addEventListener("change", function (event) {
    const target = event.target;

    if (!target.classList.contains("record-select")) {
      return;
    }

    if (target.checked) {
      selectedIds.add(target.dataset.recordId);
    } else {
      selectedIds.delete(target.dataset.recordId);
    }

    render();
  });
  exportButton.addEventListener("click", function () { exportExcel(); });
  recordsBody.addEventListener("click", function (event) {
    const remove = event.target.closest("[data-delete]");
    if (remove) { askDelete(records.filter(function (record) { return record.id === remove.dataset.delete; })); return; }
    const edit = event.target.closest("[data-edit]");
    const history = event.target.closest("[data-history]");
    if (history) { openHistory(history.dataset.history); return; }
    if (!edit) return;
    editingRecord = records.find(function (record) { return record.id === edit.dataset.edit; });
    if (!editingRecord) return;
    expectedSnapshot = WebData.editableSnapshot(editingRecord);
    operationId = WebData.makeId();
    document.getElementById("editRecordName").textContent = editingRecord.full_name;
    document.getElementById("editName").value = editingRecord.full_name;
    document.getElementById("editPhone").value = editingRecord.phone;
    document.getElementById("editBirth").value = editingRecord.birth_date;
    const now = new Date();
    document.getElementById("editBirth").max = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0") + "-" + String(now.getDate()).padStart(2,"0");
    document.getElementById("editMembership").value = editingRecord.membership_type;
    document.getElementById("editAmount").value = editingRecord.subscription_amount;
    WebData.clearStatus(document.getElementById("editStatus"));
    editDialog.showModal();
  });
  function closeEdit() { if (!saving) editDialog.close(); }
  document.getElementById("closeEdit").addEventListener("click",closeEdit);
  document.getElementById("cancelEdit").addEventListener("click",closeEdit);
  document.getElementById("editForm").addEventListener("input",function () { if (!saving) operationId = WebData.makeId(); });
  editDialog.addEventListener("cancel",function (event) { if (saving) event.preventDefault(); });
  document.getElementById("editForm").addEventListener("submit",async function (event) {
    event.preventDefault();
    if (saving || !editingRecord) return;
    saving = true;
    const button = document.getElementById("saveEdit"), status = document.getElementById("editStatus");
    button.disabled = true;
    document.getElementById("closeEdit").disabled = true;
    document.getElementById("cancelEdit").disabled = true;
    document.querySelectorAll("#editForm input, #editForm select").forEach(function (field) { field.disabled = true; });
    WebData.setStatus(status,"info","جاري حفظ التعديلات...");
    try {
      const result = await WebData.updateRegistration({ id:editingRecord.id, full_name:document.getElementById("editName").value, phone:document.getElementById("editPhone").value, birth_date:document.getElementById("editBirth").value, membership_type:document.getElementById("editMembership").value, subscription_amount:Number(document.getElementById("editAmount").value) },expectedSnapshot,currentAdminPassword,operationId);
      const index = records.findIndex(function (record) { return record.id === editingRecord.id; });
      if (index >= 0) records[index] = result.record;
      if (activeBranch !== "all" && !records.some(function (record) { return record.membership_type === activeBranch; })) activeBranch = "all";
      render(); editDialog.close();
      WebData.setStatus(dashboardStatus,"success",result.no_changes ? "لم تتغير البيانات." : "تم حفظ بيانات السباح وإضافة التعديل إلى السجل.");
    } catch (error) { WebData.setStatus(status,"error",error.message || "تعذر حفظ التعديل. حاول مرة أخرى."); }
    finally { saving = false; button.disabled = false; document.getElementById("closeEdit").disabled = false; document.getElementById("cancelEdit").disabled = false; document.querySelectorAll("#editForm input, #editForm select").forEach(function (field) { field.disabled = false; }); }
  });
  const historyLabels = {full_name:"اسم السباح",phone:"رقم ولي الأمر",birth_date:"تاريخ الميلاد",membership_type:"نوع الاشتراك",subscription_amount:"مبلغ الاشتراك",record_status:"حالة التسجيل"};
  async function openHistory(recordId) {
    const request = ++historyRequest;
    const content = document.getElementById("historyContent");
    const record = records.find(function (item) { return item.id === recordId; });
    document.getElementById("historyTitle").textContent = record ? "سجل تعديلات " + record.full_name : "سجل التعديلات";
    content.textContent = "جاري تحميل السجل...";
    historyDialog.showModal();
    try {
      const entries = await WebData.listHistory(recordId,currentAdminPassword);
      if (request !== historyRequest || !historyDialog.open) return;
      while (content.firstChild) content.removeChild(content.firstChild);
      if (!entries.length) { content.textContent = "لا توجد تعديلات مسجلة حتى الآن."; return; }
      entries.forEach(function (entry) {
        const item = document.createElement("section");
        item.className = "history-entry";
        const swimmer = records.find(function (record) { return record.id === entry.record_id; }) || {full_name:entry.record_name || entry.record_id};
        const stamp = new Intl.DateTimeFormat("ar-EG",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Cairo"}).format(new Date(entry.changed_at));
        item.innerHTML = '<div class="history-meta"><strong>' + escapeHtml(swimmer ? swimmer.full_name : entry.record_id) + '</strong><span>' + escapeHtml(stamp) + ' · ' + escapeHtml(entry.actor) + '</span></div><div class="history-columns"><span>البيان</span><span>قبل التعديل</span><span>بعد التعديل</span></div>' + entry.changes.map(function (change) { return '<div class="history-change"><strong>' + escapeHtml(historyLabels[change.field] || change.field) + '</strong><span>' + escapeHtml(String(change.before == null ? "" : change.before)) + '</span><span>' + escapeHtml(String(change.after == null ? "" : change.after)) + '</span></div>'; }).join("");
        content.appendChild(item);
      });
    } catch (error) { if (request === historyRequest) content.textContent = error.message || "تعذر تحميل السجل."; }
  }
  document.getElementById("allHistoryButton").addEventListener("click",function () { openHistory(""); });
  document.getElementById("closeHistory").addEventListener("click",function () { historyDialog.close(); });
  function askDelete(list) {
    if (deleting || !list.length) return;
    deletionTargets = list.map(function (record) { return {record:Object.assign({},record),operation:WebData.makeId()}; });
    document.getElementById("deleteDescription").textContent = list.length === 1 ? "هل تريد حذف السباح «" + list[0].full_name + "»؟" : "هل تريد حذف " + list.length + " تسجيلات؟";
    WebData.clearStatus(document.getElementById("deleteStatus"));
    deleteDialog.showModal();
  }
  function closeDelete() { if (!deleting) deleteDialog.close(); }
  document.getElementById("deleteSelectedButton").addEventListener("click",function () { askDelete(getSelectedRecords()); });
  document.getElementById("deleteAllButton").addEventListener("click",function () { askDelete(records); });
  document.getElementById("closeDelete").addEventListener("click",closeDelete);
  document.getElementById("cancelDelete").addEventListener("click",closeDelete);
  deleteDialog.addEventListener("cancel",function (event) { if (deleting) event.preventDefault(); });
  document.getElementById("confirmDelete").addEventListener("click",async function () {
    if (deleting || !deletionTargets.length) return;
    deleting = true;
    ["confirmDelete","closeDelete","cancelDelete"].forEach(function (id) { document.getElementById(id).disabled = true; });
    const status = document.getElementById("deleteStatus");
    let completed = 0;
    try {
      while (deletionTargets.length) {
        WebData.setStatus(status,"info","جاري الحذف... " + completed + " / " + (completed + deletionTargets.length));
        const target = deletionTargets[0];
        await WebData.deleteRegistration(target.record,currentAdminPassword,target.operation);
        records = records.filter(function (record) { return record.id !== target.record.id; });
        selectedIds.delete(target.record.id);
        deletionTargets.shift(); completed++;
      }
      activeBranch = "all"; currentPage = 1; render(); deleteDialog.close();
      WebData.setStatus(dashboardStatus,"success","تم نقل " + completed + " تسجيلات إلى المحذوفات.");
    } catch (error) {
      render();
      WebData.setStatus(status,"error","تم حذف " + completed + " تسجيلات. " + (error.message || "تعذر إكمال الحذف."));
    } finally {
      deleting = false;
      ["confirmDelete","closeDelete","cancelDelete"].forEach(function (id) { document.getElementById(id).disabled = false; });
      updateSelectionControls(getVisibleRecords(groupByBranch(records)));
    }
  });
  async function loadTrash() {
    const content = document.getElementById("trashContent"), status = document.getElementById("trashStatus");
    content.textContent = "جاري تحميل المحذوفات...";
    WebData.clearStatus(status);
    try {
      const items = await WebData.listTrash(currentAdminPassword);
      content.innerHTML = "";
      if (!items.length) content.textContent = "لا توجد تسجيلات محذوفة.";
      items.forEach(function (record) {
        const row = document.createElement("div"); row.className = "trash-row";
        row.innerHTML = '<div><strong>' + escapeHtml(record.full_name) + '</strong><small>' + escapeHtml(record.membership_type) + ' · ' + escapeHtml(WebData.formatDisplayDate(record.deleted_at)) + '</small></div>';
        const button = document.createElement("button"); button.type = "button"; button.className = "button";
        button.innerHTML = '<i data-lucide="rotate-ccw"></i>استرجاع';
        button.addEventListener("click",async function () {
          if (restoring) return;
          restoring = true; button.disabled = true;
          document.getElementById("closeTrash").disabled = true;
          WebData.setStatus(status,"info","جاري استرجاع التسجيل...");
          try {
            await WebData.restoreRegistration(record.id,currentAdminPassword,WebData.makeId());
            await loadRecords(); await loadTrash();
            WebData.setStatus(status,"success","تم استرجاع السباح بنجاح.");
          } catch (error) { WebData.setStatus(status,"error",error.message || "تعذر الاسترجاع."); }
          finally { restoring = false; button.disabled = false; document.getElementById("closeTrash").disabled = false; }
        });
        row.appendChild(button); content.appendChild(row);
      });
      if (window.lucide) window.lucide.createIcons({attrs:{width:16,height:16}});
    } catch (error) { content.textContent = ""; WebData.setStatus(status,"error",error.message || "تعذر تحميل المحذوفات."); }
  }
  document.getElementById("trashButton").addEventListener("click",function () { trashDialog.showModal(); loadTrash(); });
  document.getElementById("closeTrash").addEventListener("click",function () { if (!restoring) trashDialog.close(); });
  trashDialog.addEventListener("cancel",function (event) { if (restoring) event.preventDefault(); });
  document.getElementById("exportVisibleButton").addEventListener("click", function () { exportExcel(getVisibleRecords(groupByBranch(records))); });
  searchInput.addEventListener("input", function () { currentPage = 1; render(); });
  sortSelect.addEventListener("change", function () { currentPage = 1; render(); });
  document.getElementById("prevPage").addEventListener("click", function () { currentPage--; render(); });
  document.getElementById("nextPage").addEventListener("click", function () { currentPage++; render(); });
  document.getElementById("logoutButton").addEventListener("click", function () {
    records = []; selectedIds.clear(); currentAdminPassword = ""; activeBranch = "all"; currentPage = 1; searchInput.value = "";
    render(); WebData.clearStatus(loginStatus); WebData.clearStatus(dashboardStatus);
    dashboard.classList.add("hidden"); loginPanel.classList.remove("hidden");
  });
})();
