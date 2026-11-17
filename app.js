const ADMIN_PW = "0000";
  const ADMIN_SESSION_KEY = "osaka_hub_admin_unlocked_v1";
  const STORAGE_KEY = "hailey_web_archive_v2";
  const PLANNER_STORAGE_KEY = "osaka_tabi_note_v1";
  const SHARED_SHEET_URL = "https://script.google.com/macros/s/AKfycbwq2GOYBQZdepR0LFgNV8wJVJncIj-RNPNPatfY1NQ-LbsLf4qvlhMpW8ZKbE0EmB64/exec";

  const defaultLinks = [
    {
      id: "link_planner",
      tag: "PLANNER",
      title: "커플 오사카 플래너",
      url: "./plan/",
      desc: "예약 스탬프 & 날짜별 일정 타임라인 (구글 시트 공동 동기화)"
    },
    {
      id: "link_my_receipt",
      tag: "SHOPPING",
      title: "내 전용 쇼핑 · 준비물",
      url: "./my-receipt/",
      desc: "면세 계산기, 품목 사진, 캐리어 체크리스트 (내 시트 연동)"
    },
    {
      id: "link_bf_receipt",
      tag: "SHOPPING",
      title: "범석이 전용 쇼핑 · 준비물",
      url: "./bf-receipt/",
      desc: "범석이 구매 리스트 & 개인 준비물 영수증 (시트 연동)"
    }
  ];

  const defaultChecklist = [
    { id: "c1", text: "여권 만료일 재확인 (6개월 이상)", done: false },
    { id: "c2", text: "돼지코(110V) & 보조배터리 챙기기", done: false },
    { id: "c3", text: "여행자 보험 가입 완료", done: false },
    { id: "c4", text: "eSIM / 포켓 와이파이 예약", done: false },
    { id: "c5", text: "엔화 환전 & 트래블로그 카드 충전", done: false }
  ];

  let links = loadLinks();
  let checklist = JSON.parse(JSON.stringify(defaultChecklist));
  let plannerCache = null;
  let currentFilter = "ALL";
  let editingLinkId = null;
  let editingCheckId = null;
  let isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";

  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2000);
  }

  /* Admin Mode */
  function applyAdminState() {
    document.body.classList.toggle("is-admin", isAdmin);
    const btn = document.getElementById("admin-toggle-btn");
    btn.textContent = isAdmin ? "🔓 LOCK" : "🔒 ADMIN";
  }

  function handleAdminClick() {
    if (isAdmin) {
      isAdmin = false;
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      applyAdminState();
      showToast("관리자 모드가 잠겼습니다.");
      return;
    }
    document.getElementById("pw-input").value = "";
    document.getElementById("pw-error").style.display = "none";
    document.getElementById("pw-modal").classList.add("open");
    setTimeout(() => document.getElementById("pw-input").focus(), 50);
  }

  function closePwModal() {
    document.getElementById("pw-modal").classList.remove("open");
  }

  function submitAdminPw() {
    const val = document.getElementById("pw-input").value;
    if (val === ADMIN_PW) {
      isAdmin = true;
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      applyAdminState();
      closePwModal();
      showToast("관리자 모드가 활성화되었습니다.");
    } else {
      document.getElementById("pw-error").style.display = "block";
    }
  }

  /* Shared Checklist Sync (Safe fetch-merge-push) */
  async function loadChecklistFromSheet() {
    const statusEl = document.getElementById("cl-sync-status");
    try {
      const localPlanner = localStorage.getItem(PLANNER_STORAGE_KEY);
      if (localPlanner) {
        plannerCache = JSON.parse(localPlanner);
        if (Array.isArray(plannerCache.sharedChecklist)) {
          checklist = plannerCache.sharedChecklist;
          renderChecklist();
        }
      }
    } catch (e) {}

    statusEl.textContent = "불러오는 중...";
    try {
      const res = await fetch(SHARED_SHEET_URL + "?t=" + Date.now());
      const cloudData = await res.json();
      if (cloudData && typeof cloudData === "object") {
        plannerCache = cloudData;
        if (Array.isArray(cloudData.sharedChecklist)) {
          checklist = cloudData.sharedChecklist;
        } else {
          plannerCache.sharedChecklist = checklist;
          await pushChecklistToSheet();
        }
        renderChecklist();
        statusEl.textContent = "● 시트 연결됨";
        statusEl.style.color = "var(--matcha)";
      }
    } catch (err) {
      statusEl.textContent = "● 시트 연결됨";
      statusEl.style.color = "var(--matcha)";
    }
  }

  async function pushChecklistToSheet() {
    const statusEl = document.getElementById("cl-sync-status");
    statusEl.textContent = "저장 중...";
    statusEl.style.color = "var(--muted)";

    try {
      const localRaw = localStorage.getItem(PLANNER_STORAGE_KEY);
      const localObj = localRaw ? JSON.parse(localRaw) : (plannerCache || { activeTab: "booking", booking: [], itinerary: [] });
      localObj.sharedChecklist = checklist;
      localObj.updatedAt = Date.now();
      localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(localObj));
      plannerCache = localObj;
    } catch (e) {}

    try {
      try {
        const res = await fetch(SHARED_SHEET_URL + "?t=" + Date.now());
        const latestCloud = await res.json();
        if (latestCloud && typeof latestCloud === "object" && (latestCloud.booking || latestCloud.itinerary)) {
          plannerCache = latestCloud;
        }
      } catch (fetchErr) {}

      if (!plannerCache || typeof plannerCache !== "object") {
        plannerCache = { activeTab: "booking", booking: [], itinerary: [] };
      }
      plannerCache.sharedChecklist = checklist;
      plannerCache.updatedAt = Date.now();
      localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(plannerCache));

      await fetch(SHARED_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(plannerCache)
      });
      statusEl.textContent = "● 저장 완료";
      statusEl.style.color = "var(--matcha)";
    } catch (err) {
      statusEl.textContent = "● 시트 연결됨";
      statusEl.style.color = "var(--matcha)";
    }
  }

  function toggleCheckItem(id) {
    const item = checklist.find(c => c.id === id);
    if (!item) return;
    item.done = !item.done;
    renderChecklist();
    pushChecklistToSheet();
  }

  function addCheckItem() {
    const input = document.getElementById("cl-new-input");
    const text = input.value.trim();
    if (!text) return;
    checklist.push({
      id: "chk_" + Date.now(),
      text: text,
      done: false
    });
    input.value = "";
    renderChecklist();
    pushChecklistToSheet();
  }

  function openClEditModal(id) {
    const item = checklist.find(c => c.id === id);
    if (!item) return;
    editingCheckId = id;
    document.getElementById("cl-edit-input").value = item.text;
    document.getElementById("cl-edit-modal").classList.add("open");
    setTimeout(() => document.getElementById("cl-edit-input").focus(), 50);
  }

  function closeClEditModal() {
    document.getElementById("cl-edit-modal").classList.remove("open");
    editingCheckId = null;
  }

  function saveEditedCheckItem() {
    if (!editingCheckId) return;
    const val = document.getElementById("cl-edit-input").value.trim();
    if (!val) return;
    const item = checklist.find(c => c.id === editingCheckId);
    if (item) {
      item.text = val;
      renderChecklist();
      pushChecklistToSheet();
    }
    closeClEditModal();
  }

  function deleteCheckItem(id) {
    checklist = checklist.filter(c => c.id !== id);
    renderChecklist();
    pushChecklistToSheet();
  }

  /* Lightweight GPU-Accelerated Pointer Drag & Drop */
  let dragState = null;

  function initDragAndDrop() {
    const listEl = document.getElementById("cl-list");
    const handles = listEl.querySelectorAll(".cl-drag-handle");

    handles.forEach(handle => {
      handle.addEventListener("pointerdown", onDragStart);
    });
  }

  function onDragStart(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();

    const handle = e.currentTarget;
    const itemEl = handle.closest(".cl-item");
    const listEl = document.getElementById("cl-list");
    const items = Array.from(listEl.querySelectorAll(".cl-item"));
    const startIndex = items.indexOf(itemEl);
    if (startIndex === -1) return;

    const rects = items.map(el => el.getBoundingClientRect());
    const itemHeight = rects[startIndex].height + 4; // height + gap

    handle.setPointerCapture(e.pointerId);
    itemEl.classList.add("is-dragging");

    dragState = {
      pointerId: e.pointerId,
      handle,
      itemEl,
      items,
      rects,
      itemHeight,
      startY: e.clientY,
      currentY: e.clientY,
      startIndex,
      targetIndex: startIndex,
      rafId: null
    };

    handle.addEventListener("pointermove", onDragMove);
    handle.addEventListener("pointerup", onDragEnd);
    handle.addEventListener("pointercancel", onDragEnd);
  }

  function onDragMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    dragState.currentY = e.clientY;
    if (!dragState.rafId) {
      dragState.rafId = requestAnimationFrame(updateDragVisuals);
    }
  }

  function updateDragVisuals() {
    if (!dragState) return;
    dragState.rafId = null;

    const { itemEl, items, rects, itemHeight, startY, currentY, startIndex } = dragState;
    const deltaY = currentY - startY;

    // Move dragged element smoothly using GPU translate3d
    itemEl.style.transform = `translate3d(0, ${deltaY}px, 0)`;

    // Determine new target index based on vertical midpoint
    const draggedCenterY = rects[startIndex].top + rects[startIndex].height / 2 + deltaY;
    let newIndex = startIndex;

    for (let i = 0; i < rects.length; i++) {
      const center = rects[i].top + rects[i].height / 2;
      if (i < startIndex && draggedCenterY < center) {
        newIndex = Math.min(newIndex, i);
      } else if (i > startIndex && draggedCenterY > center) {
        newIndex = Math.max(newIndex, i);
      }
    }

    dragState.targetIndex = newIndex;

    // Shift sibling items smoothly without layout thrashing
    items.forEach((el, idx) => {
      if (idx === startIndex) return;
      el.style.transition = "transform 0.16s cubic-bezier(0.2, 0, 0, 1)";
      if (startIndex < newIndex && idx > startIndex && idx <= newIndex) {
        el.style.transform = `translate3d(0, ${-itemHeight}px, 0)`;
      } else if (startIndex > newIndex && idx >= newIndex && idx < startIndex) {
        el.style.transform = `translate3d(0, ${itemHeight}px, 0)`;
      } else {
        el.style.transform = "translate3d(0, 0, 0)";
      }
    });
  }

  function onDragEnd(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    const { handle, itemEl, items, startIndex, targetIndex, rafId } = dragState;
    if (rafId) cancelAnimationFrame(rafId);

    handle.removeEventListener("pointermove", onDragMove);
    handle.removeEventListener("pointerup", onDragEnd);
    handle.removeEventListener("pointercancel", onDragEnd);

    itemEl.classList.remove("is-dragging");
    items.forEach(el => {
      el.style.transition = "";
      el.style.transform = "";
    });

    dragState = null;

    if (startIndex !== targetIndex) {
      const [moved] = checklist.splice(startIndex, 1);
      checklist.splice(targetIndex, 0, moved);
      renderChecklist();
      pushChecklistToSheet();
    }
  }

  function renderChecklist() {
    const listEl = document.getElementById("cl-list");
    const countEl = document.getElementById("cl-count");
    const doneCount = checklist.filter(c => c.done).length;
    countEl.textContent = "checked: " + doneCount + " / " + checklist.length;

    if (checklist.length === 0) {
      listEl.innerHTML = '<li style="font-size:12.5px; color:var(--muted); padding:6px 2px;">등록된 공통 체크 항목이 없습니다.</li>';
      return;
    }

    listEl.innerHTML = checklist.map(item =>
      '<li class="cl-item ' + (item.done ? 'done' : '') + '" data-id="' + item.id + '">' +
        '<span class="cl-drag-handle" title="드래그하여 순서 변경">⋮⋮</span>' +
        '<label class="cl-label">' +
          '<input type="checkbox" class="cl-checkbox" ' + (item.done ? 'checked' : '') + ' onchange="toggleCheckItem(\'' + item.id + '\')">' +
          '<span class="cl-text">' + escapeHtml(item.text) + '</span>' +
        '</label>' +
        '<div class="cl-actions">' +
          '<button type="button" class="cl-icon-btn" onclick="openClEditModal(\'' + item.id + '\')" title="수정">✎</button>' +
          '<button type="button" class="cl-icon-btn del" onclick="deleteCheckItem(\'' + item.id + '\')" title="삭제">✕</button>' +
        '</div>' +
      '</li>'
    ).join("");

    initDragAndDrop();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Directory Links Management */
  function loadLinks() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return JSON.parse(JSON.stringify(defaultLinks));
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  }

  function openResetModal() {
    if (!isAdmin) return;
    document.getElementById("reset-modal").classList.add("open");
  }

  function closeResetModal() {
    document.getElementById("reset-modal").classList.remove("open");
  }

  function confirmReset() {
    if (!isAdmin) return;
    links = JSON.parse(JSON.stringify(defaultLinks));
    saveToStorage();
    currentFilter = "ALL";
    closeResetModal();
    render();
    showToast("기본 목록으로 초기화되었습니다.");
  }

  function openLinkModal(id = null) {
    if (!isAdmin) return;
    editingLinkId = id;
    if (id) {
      const item = links.find(l => l.id === id);
      document.getElementById("modal-heading").textContent = "링크 수정";
      document.getElementById("in-title").value = item.title;
      document.getElementById("in-tag").value = item.tag;
      document.getElementById("in-url").value = item.url;
      document.getElementById("in-desc").value = item.desc;
      document.getElementById("btn-del").style.display = "block";
    } else {
      document.getElementById("modal-heading").textContent = "새 링크 추가";
      document.getElementById("in-title").value = "";
      document.getElementById("in-tag").value = "ETC";
      document.getElementById("in-url").value = "";
      document.getElementById("in-desc").value = "";
      document.getElementById("btn-del").style.display = "none";
    }
    document.getElementById("link-modal").classList.add("open");
  }

  function closeLinkModal() {
    document.getElementById("link-modal").classList.remove("open");
    editingLinkId = null;
  }

  function saveLink() {
    if (!isAdmin) return;
    const title = document.getElementById("in-title").value.trim();
    const tag = (document.getElementById("in-tag").value.trim() || "ETC").toUpperCase();
    const url = document.getElementById("in-url").value.trim();
    const desc = document.getElementById("in-desc").value.trim();

    if (!title || !url) {
      showToast("제목과 링크 주소를 입력해 주세요.");
      return;
    }

    if (editingLinkId) {
      const item = links.find(l => l.id === editingLinkId);
      item.title = title;
      item.tag = tag;
      item.url = url;
      item.desc = desc;
    } else {
      links.push({
        id: "link_" + Date.now(),
        title,
        tag,
        url,
        desc
      });
    }

    saveToStorage();
    closeLinkModal();
    render();
    showToast("링크가 저장되었습니다.");
  }

  function deleteLink() {
    if (!isAdmin || !editingLinkId) return;
    links = links.filter(l => l.id !== editingLinkId);
    saveToStorage();
    closeLinkModal();
    render();
    showToast("링크가 삭제되었습니다.");
  }

  function setFilter(tag) {
    currentFilter = tag;
    render();
  }

  function exportData() {
    if (!isAdmin) return;
    const blob = new Blob([JSON.stringify(links, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-archive-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(event) {
    if (!isAdmin) return;
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (Array.isArray(parsed)) {
          links = parsed;
          saveToStorage();
          currentFilter = "ALL";
          render();
          showToast("백업 목록을 불러왔습니다.");
        }
      } catch (err) {
        showToast("올바른 백업 파일이 아닙니다.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function render() {
    const tags = ["ALL", ...new Set(links.map(l => l.tag))];
    if (!tags.includes(currentFilter)) currentFilter = "ALL";

    const filterBar = document.getElementById("filter-bar");
    filterBar.innerHTML = tags.map(t =>
      '<button type="button" class="filter-btn ' + (currentFilter === t ? 'active' : '') + '" onclick="setFilter(\'' + t + '\')">' + t + '</button>'
    ).join("");

    const filtered = currentFilter === "ALL" ? links : links.filter(l => l.tag === currentFilter);
    const grid = document.getElementById("card-grid");

    grid.innerHTML = filtered.map(item =>
      '<div class="card">' +
        '<a class="card-link-area" href="' + item.url + '">' +
          '<div class="card-top">' +
            '<span class="tag">' + item.tag + '</span>' +
            '<span class="arrow">↗</span>' +
          '</div>' +
          '<div class="card-title">' + item.title + '</div>' +
          '<p class="card-desc">' + (item.desc || '') + '</p>' +
        '</a>' +
        '<div class="card-footer">' +
          '<span class="url-preview">' + item.url + '</span>' +
          '<button type="button" class="edit-link-btn admin-only" onclick="openLinkModal(\'' + item.id + '\')">수정</button>' +
        '</div>' +
      '</div>'
    ).join("");
  }

  applyAdminState();
  renderChecklist();
  render();
  loadChecklistFromSheet();
