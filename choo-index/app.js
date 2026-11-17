const STORAGE_KEY = "osaka_tabi_note_v1";
  const SHEET_URL_KEY = "osaka_tabi_sheet_url_v1";

  const initialData = {
    activeTab: "booking",
    updatedAt: Date.now(),
    booking: [
      { id: "g1", title: "✈️ 항공 & 숙소", items: [
        { id: "i1", title: "항공권 예매 (인천-간사이)", date: "2026-11-30", status: "결제완료", memo: "수하물 및 좌석 확인", completed: true },
        { id: "i2", title: "난바 호텔 숙박", date: "2026-11-30", status: "예약완료", memo: "체크인 15:00", completed: false }
      ]},
      { id: "g1_2", title: "🎟️ 패스 & 맛집 예약", items: [
        { id: "i2_1", title: "라피트 특급열차 티켓", date: "2026-11-30", status: "예약완료", memo: "간사이공항 → 난바역 QR코드", completed: false },
        { id: "i2_2", title: "우메다 야키니쿠 예약", date: "2026-12-01", status: "미예약", memo: "19:00 디너 예약 예정", completed: false }
      ]}
    ],
    itinerary: [
      { id: "g2", title: "📅 Day 1 · 난바 & 도톤보리", items: [
        { id: "i3", title: "호텔 짐 보관 & 체크인 수속", time: "12:30", memo: "난바역 도보 5분", completed: false },
        { id: "i4", title: "도톤보리 & 신사이바시 쇼핑", time: "14:00", memo: "https://maps.google.com/?q=Dotonbori", completed: false },
        { id: "i5", title: "저녁 식사 (오코노미야키)", time: "18:30", memo: "웨이팅 확인 후 입장", completed: false }
      ]}
    ]
  };

  let appData = loadLocalData();
  let editingTarget = null;

  /* Custom UI Dialog Helpers */
  function showDialog({ title = "안내", message = "", mode = "alert", defaultValue = "" }) {
    return new Promise((resolve) => {
      const modal = document.getElementById("dialog-modal");
      const titleEl = document.getElementById("dialog-title");
      const msgEl = document.getElementById("dialog-message");
      const inputWrap = document.getElementById("dialog-input-wrap");
      const inputEl = document.getElementById("dialog-input");
      const cancelBtn = document.getElementById("dialog-cancel-btn");
      const okBtn = document.getElementById("dialog-ok-btn");

      titleEl.textContent = title;
      msgEl.textContent = message;

      if (mode === "prompt") {
        inputWrap.style.display = "block";
        inputEl.value = defaultValue;
      } else {
        inputWrap.style.display = "none";
      }

      cancelBtn.style.display = mode === "alert" ? "none" : "block";
      modal.classList.add("open");
      if (mode === "prompt") setTimeout(() => inputEl.focus(), 50);

      const cleanup = () => {
        modal.classList.remove("open");
        okBtn.onclick = null;
        cancelBtn.onclick = null;
      };

      okBtn.onclick = () => {
        const val = inputEl.value;
        cleanup();
        resolve(mode === "prompt" ? val : true);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(mode === "prompt" ? null : false);
      };
    });
  }

  function loadLocalData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return JSON.parse(JSON.stringify(initialData));
  }

  function getSheetUrl() {
    return localStorage.getItem(SHEET_URL_KEY) || "";
  }

  function setSyncUI(state, text) {
    const dot = document.getElementById("sync-dot");
    const label = document.getElementById("sync-status-text");
    const refreshBtn = document.getElementById("manual-sync-btn");
    dot.className = "sync-dot " + state;
    label.textContent = text;
    refreshBtn.style.display = getSheetUrl() ? "inline-block" : "none";
  }

  async function saveData(pushToCloud = true) {
    appData.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));

    const url = getSheetUrl();
    if (!url || !pushToCloud) return;

    setSyncUI("syncing", "구글 시트 저장 중...");
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(appData)
      });
      setSyncUI("online", "구글 시트 동기화 완료");
    } catch (err) {
      setSyncUI("error", "동기화 오류 (로컬 저장됨)");
    }
  }

  async function syncFromSheet() {
    const url = getSheetUrl();
    if (!url) {
      setSyncUI("", "로컬 저장 모드 (시트 미연결)");
      return;
    }

    setSyncUI("syncing", "시트에서 불러오는 중...");
    try {
      const res = await fetch(url + "?t=" + Date.now());
      const cloudData = await res.json();
      if (cloudData && cloudData.booking && cloudData.itinerary) {
        const currentTab = appData.activeTab;
        appData = cloudData;
        appData.activeTab = currentTab;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        render();
        setSyncUI("online", "구글 시트 연결됨 (최신 상태)");
      } else {
        await saveData(true);
      }
    } catch (err) {
      setSyncUI("error", "시트 연결 확인 필요");
    }
  }

  async function resetAllData() {
    const ok = await showDialog({
      title: "데이터 초기화",
      message: "모든 데이터를 초기 예시 상태로 되돌리시겠습니까?",
      mode: "confirm"
    });
    if (!ok) return;
    appData = JSON.parse(JSON.stringify(initialData));
    saveData(true);
    render();
  }

  function switchTab(tab) {
    appData.activeTab = tab;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    render();
  }

  async function addGroup() {
    const isBooking = appData.activeTab === "booking";
    const title = await showDialog({
      title: "새 그룹 추가",
      message: isBooking
        ? "새 예약 카테고리 이름을 입력하세요:\n예: 🎟️ 교통패스 & 티켓"
        : "새 일정 날짜 그룹을 입력하세요:\n예: 📅 Day 2 · 우메다 & 나카자키초",
      mode: "prompt"
    });
    if (!title || !title.trim()) return;
    appData[appData.activeTab].push({
      id: "group_" + Date.now(),
      title: title.trim(),
      items: []
    });
    saveData(true);
    render();
  }

  async function editGroup(groupId) {
    const groups = appData[appData.activeTab];
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const next = await showDialog({
      title: "그룹 이름 수정",
      message: "그룹 이름을 수정하세요:",
      mode: "prompt",
      defaultValue: group.title
    });
    if (!next || !next.trim()) return;
    group.title = next.trim();
    saveData(true);
    render();
  }

  async function deleteGroup(groupId) {
    const groups = appData[appData.activeTab];
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const ok = await showDialog({
      title: "그룹 삭제",
      message: "[" + group.title + "] 그룹과 포함된 항목을 모두 삭제할까요?",
      mode: "confirm"
    });
    if (!ok) return;
    appData[appData.activeTab] = groups.filter(g => g.id !== groupId);
    saveData(true);
    render();
  }

  async function openModal(groupId = null, itemId = null) {
    editingTarget = { groupId, itemId };
    const groups = appData[appData.activeTab];

    if (groups.length === 0) {
      await showDialog({ message: "먼저 '+ 새 그룹'을 만들어 주세요!" });
      return;
    }

    const selectEl = document.getElementById("edit-group-select");
    selectEl.innerHTML = groups.map(g => '<option value="' + g.id + '">' + g.title + '</option>').join("");
    if (groupId) selectEl.value = groupId;

    const isBooking = appData.activeTab === "booking";
    document.getElementById("modal-title").textContent = itemId
      ? (isBooking ? "예약 항목 수정" : "일정 수정")
      : (isBooking ? "새 예약 항목 추가" : "새 일정 추가");

    document.getElementById("title-label").textContent = isBooking
      ? "예약 항목 이름 (예: 항공권 예매, 숙소 체크인)"
      : "장소 / 활동 이름 (예: 도톤보리 글리코상, 카페 방문)";

    document.getElementById("date-group").style.display = isBooking ? "block" : "none";
    document.getElementById("status-group").style.display = isBooking ? "block" : "none";
    document.getElementById("time-group").style.display = isBooking ? "none" : "block";

    if (itemId) {
      const g = groups.find(gr => gr.id === (groupId || selectEl.value));
      const item = g.items.find(i => i.id === itemId);
      document.getElementById("edit-title").value = item.title;
      document.getElementById("edit-date").value = item.date || "";
      document.getElementById("edit-status").value = item.status || "미예약";
      document.getElementById("edit-time").value = item.time || "";
      document.getElementById("edit-memo").value = item.memo || "";
      document.getElementById("modal-del-btn").style.display = "block";
    } else {
      document.getElementById("edit-title").value = "";
      document.getElementById("edit-date").value = new Date().toISOString().slice(0, 10);
      document.getElementById("edit-status").value = "미예약";
      document.getElementById("edit-time").value = "12:00";
      document.getElementById("edit-memo").value = "";
      document.getElementById("modal-del-btn").style.display = "none";
    }

    document.getElementById("planner-modal").classList.add("open");
  }

  function closeModal() {
    document.getElementById("planner-modal").classList.remove("open");
    editingTarget = null;
  }

  async function saveItem() {
    const title = document.getElementById("edit-title").value.trim();
    if (!title) {
      await showDialog({ message: "이름을 입력해 주세요." });
      return;
    }
    const isBooking = appData.activeTab === "booking";
    const groupId = document.getElementById("edit-group-select").value;
    const date = document.getElementById("edit-date").value;
    const status = document.getElementById("edit-status").value;
    const time = document.getElementById("edit-time").value;
    const memo = document.getElementById("edit-memo").value.trim();

    const groups = appData[appData.activeTab];
    const targetGroup = groups.find(g => g.id === groupId);

    if (editingTarget && editingTarget.itemId) {
      let origGroup = groups.find(g => g.id === editingTarget.groupId);
      let item = origGroup.items.find(i => i.id === editingTarget.itemId);
      item.title = title;
      if (isBooking) {
        item.date = date;
        item.status = status;
      } else {
        item.time = time;
      }
      item.memo = memo;

      if (editingTarget.groupId !== groupId) {
        origGroup.items = origGroup.items.filter(i => i.id !== editingTarget.itemId);
        targetGroup.items.push(item);
      }
    } else {
      const newItem = {
        id: "item_" + Date.now(),
        title,
        memo,
        completed: false
      };
      if (isBooking) {
        newItem.date = date;
        newItem.status = status;
      } else {
        newItem.time = time;
      }
      targetGroup.items.push(newItem);
    }

    // 일정 탭의 경우 시간순 자동 정렬
    if (!isBooking) {
      targetGroup.items.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    }

    saveData(true);
    closeModal();
    render();
  }

  function deleteCurrentItem() {
    if (!editingTarget || !editingTarget.itemId) return;
    const groups = appData[appData.activeTab];
    const group = groups.find(g => g.id === editingTarget.groupId);
    group.items = group.items.filter(i => i.id !== editingTarget.itemId);
    saveData(true);
    closeModal();
    render();
  }

  function toggleItemCheck(groupId, itemId) {
    const groups = appData[appData.activeTab];
    const group = groups.find(g => g.id === groupId);
    const item = group.items.find(i => i.id === itemId);
    item.completed = !item.completed;
    saveData(true);
    render();
  }

  function cycleStatus(groupId, itemId) {
    const groups = appData.booking;
    const group = groups.find(g => g.id === groupId);
    const item = group.items.find(i => i.id === itemId);
    const states = ["미예약", "예약완료", "결제완료"];
    let idx = states.indexOf(item.status);
    item.status = states[(idx + 1) % states.length];
    saveData(true);
    render();
  }

  function getStampInfo(status) {
    switch (status) {
      case "예약완료":
        return { jp: "予約済", kr: "예약완료", cls: "booked" };
      case "결제완료":
        return { jp: "支払済", kr: "결제완료", cls: "done" };
      default:
        return { jp: "未予約", kr: "미예약", cls: "wait" };
    }
  }

  function linkify(text) {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">지도/링크 열기 ↗</a>');
  }

  /* Sync Modal Functions */
  function openSyncModal() {
    document.getElementById("sheet-url-input").value = getSheetUrl();
    document.getElementById("sync-modal").classList.add("open");
  }

  function closeSyncModal() {
    document.getElementById("sync-modal").classList.remove("open");
  }

  async function copyAppsScript() {
    const code = document.getElementById("apps-script-code").textContent;
    const textarea = document.createElement("textarea");
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    await showDialog({ message: "Apps Script 코드가 복사되었습니다!" });
  }

  async function saveSheetUrl() {
    const val = document.getElementById("sheet-url-input").value.trim();
    if (!val.startsWith("https://script.google.com/")) {
      await showDialog({ message: "올바른 Google Apps Script 웹 앱 URL(https://script.google.com/.../exec)을 입력해 주세요." });
      return;
    }
    localStorage.setItem(SHEET_URL_KEY, val);
    closeSyncModal();
    syncFromSheet();
  }

  function disconnectSheet() {
    localStorage.removeItem(SHEET_URL_KEY);
    document.getElementById("sheet-url-input").value = "";
    setSyncUI("", "로컬 저장 모드 (시트 미연결)");
    closeSyncModal();
  }

  /* JSON Backup */
  function exportBackup() {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "osaka-tabi-note-" + new Date().toISOString().slice(0,10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.booking && parsed.itinerary) {
          appData = parsed;
          saveData(true);
          render();
          await showDialog({ message: "백업 데이터를 불러왔습니다!" });
        } else {
          await showDialog({ message: "올바른 백업 파일 형식이 아닙니다." });
        }
      } catch(err) {
        await showDialog({ message: "파일을 읽는 중 오류가 발생했습니다." });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function render() {
    const isBooking = appData.activeTab === "booking";
    document.getElementById("tab-booking").classList.toggle("active", isBooking);
    document.getElementById("tab-itinerary").classList.toggle("active", !isBooking);

    const bCount = appData.booking.reduce((acc, g) => acc + g.items.length, 0);
    const iCount = appData.itinerary.reduce((acc, g) => acc + g.items.length, 0);
    document.getElementById("count-booking").textContent = bCount;
    document.getElementById("count-itinerary").textContent = iCount;

    const groups = appData[appData.activeTab];
    const container = document.getElementById("list-container");
    container.innerHTML = "";

    if (groups.length === 0) {
      container.innerHTML = '<div class="empty-state">등록된 그룹이 없습니다.<br>상단의 <strong>[+ 새 그룹]</strong>을 눌러 시작해 보세요.</div>';
      return;
    }

    groups.forEach(group => {
      const gDiv = document.createElement("div");
      gDiv.className = "group-section";

      let itemsHtml = "";
      if (isBooking) {
        group.items.forEach(item => {
          const stamp = getStampInfo(item.status);
          itemsHtml +=
            '<div class="item-card ' + (item.completed ? 'completed' : '') + '">' +
              '<div class="item-main">' +
                '<div class="item-top-row">' +
                  '<input type="checkbox" class="item-check" ' + (item.completed ? 'checked' : '') + ' onchange="toggleItemCheck(\'' + group.id + '\', \'' + item.id + '\')">' +
                  '<div class="item-title">' + item.title + '</div>' +
                '</div>' +
                (item.date ? '<div class="item-details"><span>🗓️ ' + item.date + '</span></div>' : '') +
                (item.memo ? '<div class="item-memo">' + linkify(item.memo) + '</div>' : '') +
                '<div class="item-controls">' +
                  '<button type="button" class="item-sub-btn" onclick="openModal(\'' + group.id + '\', \'' + item.id + '\')">수정/삭제</button>' +
                '</div>' +
              '</div>' +
              '<div class="circle-stamp ' + stamp.cls + '" onclick="cycleStatus(\'' + group.id + '\', \'' + item.id + '\')" title="클릭하면 도장이 바뀝니다">' +
                '<span class="stamp-jp">' + stamp.jp + '</span>' +
                '<span class="stamp-kr">' + stamp.kr + '</span>' +
              '</div>' +
            '</div>';
        });
      } else {
        // ITINERARY: Clean Timeline Layout without Stamps
        const sortedItems = [...group.items].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
        if (sortedItems.length > 0) {
          itemsHtml += '<div class="timeline-list">';
          sortedItems.forEach(item => {
            itemsHtml +=
              '<div class="tl-item ' + (item.completed ? 'completed' : '') + '">' +
                '<div class="tl-dot"></div>' +
                '<div class="tl-card">' +
                  '<div class="tl-top">' +
                    '<div class="tl-title-group">' +
                      '<input type="checkbox" class="item-check" ' + (item.completed ? 'checked' : '') + ' onchange="toggleItemCheck(\'' + group.id + '\', \'' + item.id + '\')">' +
                      (item.time ? '<span class="tl-time-badge">' + item.time + '</span>' : '') +
                      '<div class="tl-title">' + item.title + '</div>' +
                    '</div>' +
                    '<button type="button" class="tl-edit-btn" onclick="openModal(\'' + group.id + '\', \'' + item.id + '\')" title="일정 수정">✎</button>' +
                  '</div>' +
                  (item.memo ? '<div class="tl-memo">' + linkify(item.memo) + '</div>' : '') +
                '</div>' +
              '</div>';
          });
          itemsHtml += '</div>';
        }
      }

      gDiv.innerHTML =
        '<div class="group-header">' +
          '<div class="group-title-wrap">' +
            '<span class="group-title">' + group.title + '</span>' +
            '<button type="button" class="icon-btn" onclick="editGroup(\'' + group.id + '\')" title="그룹명 수정">✎</button>' +
            '<button type="button" class="icon-btn del" onclick="deleteGroup(\'' + group.id + '\')" title="그룹 삭제">✕</button>' +
          '</div>' +
          '<div class="group-actions">' +
            '<button type="button" class="small-action-btn" onclick="openModal(\'' + group.id + '\')">+ 항목</button>' +
          '</div>' +
        '</div>' +
        (itemsHtml || '<div style="font-size:12px; color:#888; padding:8px 4px;">등록된 항목이 없습니다.</div>');
      container.appendChild(gDiv);
    });
  }

  // Initialize
  render();
  if (getSheetUrl()) {
    syncFromSheet();
  }
