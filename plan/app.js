const STORAGE_KEY = "osaka_tabi_note_v1";
  const SHEET_URL_KEY = "osaka_tabi_sheet_url_v1";
  const DEFAULT_SHEET_URL = "https://script.google.com/macros/s/AKfycbwq2GOYBQZdepR0LFgNV8wJVJncIj-RNPNPatfY1NQ-LbsLf4qvlhMpW8ZKbE0EmB64/exec";

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

  function loadLocalData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return JSON.parse(JSON.stringify(initialData));
  }

  function getSheetUrl() {
    return localStorage.getItem(SHEET_URL_KEY) || DEFAULT_SHEET_URL;
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

  function resetAllData() {
    if (!confirm("모든 데이터를 초기 예시 상태로 되돌리시겠습니까?")) return;
    appData = JSON.parse(JSON.stringify(initialData));
    saveData(true);
    render();
  }

  function switchTab(tab) {
    appData.activeTab = tab;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    render();
  }

  function addGroup() {
    const isBooking = appData.activeTab === "booking";
    const title = prompt(
      isBooking
        ? "새 예약 카테고리 이름을 입력하세요:\n예: 🎟️ 교통패스 & 티켓"
        : "새 일정 날짜 그룹을 입력하세요:\n예: 📅 Day 2 · 우메다 & 나카자키초"
    );
    if (!title || !title.trim()) return;
    appData[appData.activeTab].push({
      id: "group_" + Date.now(),
      title: title.trim(),
      items: []
    });
    saveData(true);
    render();
  }

  function editGroup(groupId) {
    const groups = appData[appData.activeTab];
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const next = prompt("그룹 이름을 수정하세요:", group.title);
    if (!next || !next.trim()) return;
    group.title = next.trim();
    saveData(true);
    render();
  }

  function deleteGroup(groupId) {
    const groups = appData[appData.activeTab];
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (!confirm("[" + group.title + "] 그룹과 포함된 항목을 모두 삭제할까요?")) return;
    appData[appData.activeTab] = groups.filter(g => g.id !== groupId);
    saveData(true);
    render();
  }

  function openModal(groupId = null, itemId = null) {
    editingTarget = { groupId, itemId };
    const groups = appData[appData.activeTab];

    if (groups.length === 0) {
      alert("먼저 '+ 새 그룹'을 만들어 주세요!");
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

  function saveItem() {
    const title = document.getElementById("edit-title").value.trim();
    if (!title) {
      alert("이름을 입력해 주세요.");
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

    if (!isBooking) {
      if (!targetGroup.manualOrder) targetGroup.items.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
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

  function openSyncModal() {
    document.getElementById("sheet-url-input").value = getSheetUrl();
    document.getElementById("sync-modal").classList.add("open");
  }

  function closeSyncModal() {
    document.getElementById("sync-modal").classList.remove("open");
  }

  function copyAppsScript() {
    const code = document.getElementById("apps-script-code").textContent;
    navigator.clipboard.writeText(code).then(() => {
      alert("Apps Script 코드가 복사되었습니다!");
    });
  }

  function saveSheetUrl() {
    const val = document.getElementById("sheet-url-input").value.trim();
    if (!val.startsWith("https://script.google.com/")) {
      alert("올바른 Google Apps Script 웹 앱 URL(https://script.google.com/.../exec)을 입력해 주세요.");
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
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.booking && parsed.itinerary) {
          appData = parsed;
          saveData(true);
          render();
          alert("백업 데이터를 불러왔습니다!");
        } else {
          alert("올바른 백업 파일 형식이 아닙니다.");
        }
      } catch(err) {
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }


  // Timeline presentation only; never changes the shared itinerary.
  const collapsedDays = new Set();
  function escapeTimeline(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function timelineCategory(title) {
    const t = String(title || "");
    const tag = t.match(/^\s*\[([^\]]+)\]\s*/);
    const label = tag ? tag[1] : "";
    let kind = "other", name = label;
    if (/이동|출발|도착|공항|라피트|체크아웃|복귀/.test(label || t)) {kind="move";name=name||"이동";}
    else if (/예약/.test(label || t)) {kind="reserve";name=name||"예약";}
    else if (/굿즈|쇼핑|아존|인형/.test(label || t)) {kind="shop";name=name||"쇼핑";}
    else if (/스시|라멘|몬자|야키니쿠|저녁|점심|식사|타코야끼/.test(label || t)) {kind="food";name=name||"식사";}
    return {kind,name,title:tag?t.slice(tag[0].length):t};
  }
  function renderTimelineDay(group, index) {
    const section=document.createElement("section");
    section.className="itinerary-day";
    section.dataset.groupId=String(group.id);
    const sorted=group.manualOrder ? [...group.items] : [...group.items].sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99"));
    const heading=document.createElement("div");
    heading.className="day-heading";
    const toggle=document.createElement("button");
    toggle.type="button";toggle.className="day-toggle";
    const dayLabel=String(group.title||"").replace(/^📅\s*/u,"");
    toggle.innerHTML='<span class="day-number">DAY '+String(index+1).padStart(2,"0")+'.</span><span class="day-name">'+escapeTimeline(dayLabel)+'</span><span class="day-total">'+sorted.filter(x=>x.completed).length+'/'+sorted.length+'</span><span class="day-chevron" aria-hidden="true">⌄</span>';
    const controls=document.createElement("div");controls.className="day-controls";
    for(const [label,description,action] of [["✎","그룹명 수정",()=>editGroup(group.id)],["＋","항목 추가",()=>openModal(group.id)],["×","그룹 삭제",()=>deleteGroup(group.id)]]) {
      const b=document.createElement("button");b.type="button";b.textContent=label;b.title=description;b.setAttribute("aria-label",description);b.addEventListener("click",action);controls.appendChild(b);
    }
    heading.append(toggle,controls);section.appendChild(heading);
    const list=document.createElement("div");list.className="route-timeline";
    const apply=()=>{const closed=collapsedDays.has(group.id);list.hidden=closed;toggle.setAttribute("aria-expanded",String(!closed));section.classList.toggle("is-collapsed",closed);};
    toggle.addEventListener("click",()=>{if(collapsedDays.has(group.id))collapsedDays.delete(group.id);else collapsedDays.add(group.id);apply();});
    for(const item of sorted) {
      const cat=timelineCategory(item.title);
      const row=document.createElement("div");row.className="route-row route-"+cat.kind+(item.completed?" completed":"");
      row.dataset.itemId=String(item.id);
      const time=document.createElement("span");time.className="route-time";time.textContent=item.time||"—";
      const dot=document.createElement("span");dot.className="route-dot";dot.setAttribute("aria-hidden","true");
      const body=document.createElement("div");body.className="route-body";
      const top=document.createElement("div");top.className="route-title-line";
      if(cat.name){const label=document.createElement("span");label.className="route-category";label.textContent=cat.name;top.appendChild(label);}
      const title=document.createElement("span");title.className="route-title";title.textContent=cat.title;top.appendChild(title);
      const handle=document.createElement("button");handle.type="button";handle.className="planner-drag-handle";handle.textContent="⠿";
      handle.title="잡아서 일정 이동";handle.setAttribute("aria-label",cat.title+" 순서 또는 날짜 이동");
      body.prepend(handle);body.appendChild(top);
      if(item.memo){
        const memo=document.createElement("div");memo.className="route-memo";
        const parts=String(item.memo).split(/(https?:\/\/[^\s]+)/g);
        for(const part of parts){if(/^https?:\/\//.test(part)){const a=document.createElement("a");a.href=part;a.target="_blank";a.rel="noopener noreferrer";a.textContent=/maps\.app\.goo\.gl|google\.[^/]+\/maps|maps\.google/.test(part)?"지도 ↗":"링크 ↗";memo.appendChild(a);}else memo.appendChild(document.createTextNode(part));}
        body.appendChild(memo);
      }
      const actions=document.createElement("div");actions.className="route-actions";
      const check=document.createElement("input");check.type="checkbox";check.className="item-check";check.checked=!!item.completed;check.setAttribute("aria-label",cat.title+" 완료");check.addEventListener("change",()=>toggleItemCheck(group.id,item.id));
      const edit=document.createElement("button");edit.type="button";edit.className="tl-edit-btn";edit.textContent="✎";edit.title="일정 수정";edit.setAttribute("aria-label",cat.title+" 수정");edit.addEventListener("click",()=>openModal(group.id,item.id));actions.append(check,edit);
      row.append(time,dot,body,actions);list.appendChild(row);
    }
    if(!sorted.length){const empty=document.createElement("p");empty.className="route-empty";empty.textContent="등록된 일정이 없습니다.";list.appendChild(empty);}
    section.appendChild(list);apply();return section;
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

    if (!isBooking) { groups.forEach((group,index) => container.appendChild(renderTimelineDay(group,index))); return; }

    groups.forEach(group => {
      const gDiv = document.createElement("div");
      gDiv.className = "group-section";
      gDiv.dataset.groupId = String(group.id);

      let itemsHtml = "";
      if (isBooking) {
        group.items.forEach(item => {
          const stamp = getStampInfo(item.status);
          itemsHtml +=
            '<div class="item-card ' + (item.completed ? 'completed' : '') + '">' +
              '<button type="button" class="planner-drag-handle" title="잡아서 예약 이동" aria-label="예약 항목 순서 또는 그룹 이동">⠿</button>' +
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
      gDiv.querySelectorAll(".item-card").forEach((row,i)=>{row.dataset.itemId=String(group.items[i].id)});
      container.appendChild(gDiv);
    });
  }


  /* Sort booking cards and itinerary rows on mouse/touch with a dedicated handle.
     The destination can be any group/day in the active tab, including empty days.
     Existing reservations, time labels, completion state and cloud data are preserved. */
  (() => {
    const container=document.getElementById("list-container");
    let drag=null;
    const groups=()=>appData[appData.activeTab];
    const ordered=group=> appData.activeTab==="itinerary" && !group.manualOrder
      ? [...group.items].sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99"))
      : [...group.items];
    const rowSelector=".item-card,.route-row";
    const groupSelector=".group-section,.itinerary-day";
    function targetAt(x,y){
      const el=document.elementFromPoint(x,y);
      const grp=el&&el.closest(groupSelector);
      if(!grp || !container.contains(grp))return null;
      const row=el.closest(rowSelector);
      if(row && grp.contains(row)){
        const r=row.getBoundingClientRect();
        return {groupId:grp.dataset.groupId,itemId:row.dataset.itemId,after:y>r.top+r.height/2,row,grp};
      }
      return {groupId:grp.dataset.groupId,itemId:null,after:true,row:null,grp};
    }
    function indicators(target){
      container.querySelectorAll(".planner-drop-before,.planner-drop-after,.planner-drop-group")
        .forEach(el=>el.classList.remove("planner-drop-before","planner-drop-after","planner-drop-group"));
      if(!target)return;
      if(target.row)target.row.classList.add(target.after?"planner-drop-after":"planner-drop-before");
      else target.grp.classList.add("planner-drop-group");
    }
    function move(fromGroupId,itemId,dest){
      if(!dest)return;
      const items=groups();
      const source=items.find(g=>String(g.id)===fromGroupId);
      const target=items.find(g=>String(g.id)===dest.groupId);
      if(!source||!target)return;
      const srcList=ordered(source),dstList=source===target?srcList:ordered(target);
      const from=srcList.findIndex(i=>String(i.id)===itemId);
      if(from<0)return;
      let to=dest.itemId==null?dstList.length:dstList.findIndex(i=>String(i.id)===dest.itemId)+(dest.after?1:0);
      if(to<0)to=dstList.length;
      if(source===target&&to>from)to--;
      if(source===target&&from===to)return;
      const [item]=srcList.splice(from,1);
      dstList.splice(to,0,item);
      source.items=srcList;
      target.items=dstList;
      if(appData.activeTab==="itinerary"){source.manualOrder=true;target.manualOrder=true;}
      saveData(true);
      render();
    }
    function cleanup(){
      if(!drag)return;
      drag.ghost?.remove();
      drag.row.classList.remove("planner-moving");
      indicators(null);
      document.body.classList.remove("planner-sorting");
      drag=null;
    }
    container.addEventListener("pointerdown",e=>{
      const handle=e.target.closest(".planner-drag-handle");
      if(!handle||!container.contains(handle)||drag||(e.pointerType==="mouse"&&e.button!==0))return;
      const row=handle.closest(rowSelector),grp=handle.closest(groupSelector);
      if(!row||!grp)return;
      const rect=row.getBoundingClientRect();
      drag={id:e.pointerId,handle,row,groupId:grp.dataset.groupId,itemId:row.dataset.itemId,
        startX:e.clientX,startY:e.clientY,dx:e.clientX-rect.left,dy:e.clientY-rect.top,
        width:rect.width,ghost:null,dest:null};
      handle.setPointerCapture(e.pointerId);
    });
    container.addEventListener("pointermove",e=>{
      const d=drag;
      if(!d||e.pointerId!==d.id)return;
      if(!d.ghost){
        if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<6)return;
        const ghost=d.row.cloneNode(true);
        ghost.classList.add("planner-drag-ghost");
        ghost.style.width=d.width+"px";
        ghost.setAttribute("aria-hidden","true");
        document.body.appendChild(ghost);
        d.ghost=ghost;
        d.row.classList.add("planner-moving");
        document.body.classList.add("planner-sorting");
      }
      e.preventDefault();
      d.ghost.style.left=(e.clientX-d.dx)+"px";
      d.ghost.style.top=(e.clientY-d.dy)+"px";
      d.dest=targetAt(e.clientX,e.clientY);
      indicators(d.dest);
      const edge=50;
      if(e.clientY<edge)window.scrollBy(0,-12);
      else if(e.clientY>innerHeight-edge)window.scrollBy(0,12);
    },{passive:false});
    function finish(e,cancel){
      const d=drag;
      if(!d||d.id!==e.pointerId)return;
      const moved=!!d.ghost,fromGroup=d.groupId,item=d.itemId;
      const dest=cancel?null:(targetAt(e.clientX,e.clientY)||d.dest);
      cleanup();
      try{d.handle.releasePointerCapture(e.pointerId)}catch(_){}
      if(moved&&dest)move(fromGroup,item,dest);
    }
    container.addEventListener("pointerup",e=>finish(e,false));
    container.addEventListener("pointercancel",e=>finish(e,true));
    window.addEventListener("blur",cleanup);
  })();

  render();
  if (getSheetUrl()) {
    syncFromSheet();
  }
