const STORAGE_KEY = "osaka_receipt_hailey_v1";
  const SHEET_URL_KEY = "osaka_receipt_hailey_sheet_url_v1";
  const DEFAULT_SHEET_URL = "https://script.google.com/macros/s/AKfycbwCMWcQ8UcxnzMUdFiNhvzxMaoEnOTJyK9XMUERqGTiY3rFDwpVK_YFEKFGZep5DI_K/exec";

  const initialData = {
    rate: 905,
    activeTab: "shopping",
    shopping: [],
    packing: []
  };

  let appData = loadData();
  let editingTarget = null;
  let previewTarget = null;

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));

    const url = getSheetUrl();
    if (!url || !pushToCloud) return;

    const payload = JSON.stringify(appData);
    if (payload.length > 48000) {
      setSyncUI("error", "사진 용량 초과 (URL 사진으로 변경 권장)");
      return;
    }

    setSyncUI("syncing", "구글 시트 저장 중...");
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: payload
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
      if (cloudData && Array.isArray(cloudData.shopping) && Array.isArray(cloudData.packing)) {
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
    if (!confirm("등록된 모든 카테고리와 항목을 비우시겠습니까?")) return;
    appData.shopping = [];
    appData.packing = [];
    saveData(true);
    render();
  }

  function updateRate(val) {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      appData.rate = num;
      saveData(true);
      render();
    }
  }

  async function fetchWithTimeout(url, ms = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchLiveRate() {
    const btn = document.getElementById("fetch-rate-btn");
    btn.disabled = true;
    btn.textContent = "조회중...";

    const providers = [
      async () => {
        const data = await fetchWithTimeout("https://open.er-api.com/v6/latest/JPY");
        if (data && data.rates && data.rates.KRW) return data.rates.KRW * 100;
        throw new Error("err");
      },
      async () => {
        const data = await fetchWithTimeout("https://api.frankfurter.app/latest?from=JPY&to=KRW");
        if (data && data.rates && data.rates.KRW) return data.rates.KRW * 100;
        throw new Error("err");
      },
      async () => {
        const data = await fetchWithTimeout("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/jpy.json");
        if (data && data.jpy && data.jpy.krw) return data.jpy.krw * 100;
        throw new Error("err");
      }
    ];

    let rate100 = null;
    for (const fetchFn of providers) {
      try {
        const val = await fetchFn();
        if (typeof val === "number" && !isNaN(val) && val > 0) {
          rate100 = Math.round(val * 10) / 10;
          break;
        }
      } catch (e) {}
    }

    if (rate100 !== null) {
      appData.rate = rate100;
      document.getElementById("rate-input").value = rate100;
      saveData(true);
      render();
      btn.textContent = "✓ 적용완료";
      setTimeout(() => {
        btn.textContent = "↻ 실시간 환율";
        btn.disabled = false;
      }, 1200);
    } else {
      alert("실시간 환율 서버에 연결할 수 없습니다. 숫자 칸을 눌러 직접 입력해 주세요.");
      btn.textContent = "↻ 실시간 환율";
      btn.disabled = false;
    }
  }

  function switchTab(tab) {
    appData.activeTab = tab;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    render();
  }

  function toggleTabAll() {
    const cats = appData[appData.activeTab];
    const allItems = cats.flatMap(c => c.items);
    if (allItems.length === 0) return;
    const allChecked = allItems.every(i => i.checked);
    cats.forEach(c => c.items.forEach(i => i.checked = !allChecked));
    saveData(true);
    render();
  }

  function toggleCategoryAll(catId) {
    const cat = appData[appData.activeTab].find(c => c.id === catId);
    if (!cat || cat.items.length === 0) return;
    const allChecked = cat.items.every(i => i.checked);
    cat.items.forEach(i => i.checked = !allChecked);
    saveData(true);
    render();
  }

  function toggleItem(catId, itemId) {
    const cat = appData[appData.activeTab].find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    item.checked = !item.checked;
    saveData(true);
    render();
  }

  function changeItemQty(catId, itemId, delta) {
    const cat = appData[appData.activeTab].find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    const nextQty = (item.qty || 1) + delta;
    if (nextQty < 1) return;
    item.qty = nextQty;
    saveData(true);
    render();
  }

  function addCategory() {
    const title = prompt("새 카테고리 이름을 입력하세요 (예: 마트, 돈키호테, 필수 준비물):");
    if (!title || !title.trim()) return;
    appData[appData.activeTab].push({
      id: "cat_" + Date.now(),
      title: title.trim(),
      items: []
    });
    saveData(true);
    render();
  }

  function editCategory(catId) {
    const cat = appData[appData.activeTab].find(c => c.id === catId);
    if (!cat) return;
    const nextTitle = prompt("카테고리 이름을 수정하세요:", cat.title);
    if (!nextTitle || !nextTitle.trim()) return;
    cat.title = nextTitle.trim();
    saveData(true);
    render();
  }

  function deleteCategory(catId) {
    const cat = appData[appData.activeTab].find(c => c.id === catId);
    if (!cat) return;
    const msg = cat.items.length > 0
      ? `[${cat.title}] 카테고리와 안의 품목 ${cat.items.length}개를 모두 삭제할까요?`
      : `[${cat.title}] 카테고리를 삭제할까요?`;
    if (!confirm(msg)) return;
    appData[appData.activeTab] = appData[appData.activeTab].filter(c => c.id !== catId);
    saveData(true);
    render();
  }

  function handleThumbClick(catId, itemId) {
    const cat = appData[appData.activeTab].find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    if (item && item.img) {
      previewTarget = { catId, itemId };
      document.getElementById("preview-img-el").src = item.img;
      document.getElementById("preview-title-el").textContent = item.name;
      document.getElementById("img-preview-modal").classList.add("open");
    } else {
      openModal(catId, itemId);
    }
  }

  function closeImgPreview() {
    document.getElementById("img-preview-modal").classList.remove("open");
    previewTarget = null;
  }

  function editFromPreview() {
    if (!previewTarget) return;
    const { catId, itemId } = previewTarget;
    closeImgPreview();
    openModal(catId, itemId);
  }

  function openModal(catId, itemId = null) {
    editingTarget = { catId, itemId };
    const isShopping = appData.activeTab === "shopping";
    document.getElementById("price-group").style.display = isShopping ? "block" : "none";
    document.getElementById("img-group").style.display = isShopping ? "block" : "none";
    document.getElementById("price-qty-row").style.gridTemplateColumns = isShopping ? "2fr 1fr" : "1fr";
    document.getElementById("memo-label").textContent = isShopping
      ? "메모 (옵션, 색상, 매장 위치 등)"
      : "메모 (체크사항, 보관 위치 등)";
    document.getElementById("edit-memo").placeholder = isShopping
      ? "예: 빨간 뚜껑 / 냉장 코너"
      : "예: 기내 반입 / 캐리어 앞주머니";

    if (itemId) {
      const cat = appData[appData.activeTab].find(c => c.id === catId);
      const item = cat.items.find(i => i.id === itemId);
      document.getElementById("modal-title").textContent = "품목 수정";
      document.getElementById("edit-name").value = item.name;
      document.getElementById("edit-price").value = item.price || "";
      document.getElementById("edit-qty").value = item.qty || 1;
      document.getElementById("edit-memo").value = item.memo || "";
      document.getElementById("edit-img").value = item.img || "";
      document.getElementById("modal-del-btn").style.display = "block";
    } else {
      document.getElementById("modal-title").textContent = "새 품목 추가";
      document.getElementById("edit-name").value = "";
      document.getElementById("edit-price").value = "";
      document.getElementById("edit-qty").value = 1;
      document.getElementById("edit-memo").value = "";
      document.getElementById("edit-img").value = "";
      document.getElementById("modal-del-btn").style.display = "none";
    }
    document.getElementById("item-modal").classList.add("open");
  }

  function closeModal() {
    document.getElementById("item-modal").classList.remove("open");
    editingTarget = null;
  }

  function saveItem() {
    const name = document.getElementById("edit-name").value.trim();
    if (!name) {
      alert("품목명을 입력해 주세요.");
      return;
    }
    const price = parseInt(document.getElementById("edit-price").value, 10) || 0;
    const qty = Math.max(1, parseInt(document.getElementById("edit-qty").value, 10) || 1);
    const memo = document.getElementById("edit-memo").value.trim();
    const img = document.getElementById("edit-img").value.trim();

    const cat = appData[appData.activeTab].find(c => c.id === editingTarget.catId);
    if (editingTarget.itemId) {
      const item = cat.items.find(i => i.id === editingTarget.itemId);
      item.name = name;
      item.price = price;
      item.qty = qty;
      item.memo = memo;
      item.img = img;
    } else {
      cat.items.push({
        id: "item_" + Date.now(),
        name,
        price,
        qty,
        memo,
        img,
        checked: false
      });
    }
    saveData(true);
    closeModal();
    render();
  }

  function deleteCurrentItem() {
    if (!editingTarget || !editingTarget.itemId) return;
    const cat = appData[appData.activeTab].find(c => c.id === editingTarget.catId);
    cat.items = cat.items.filter(i => i.id !== editingTarget.itemId);
    saveData(true);
    closeModal();
    render();
  }

  function searchGoogleImage() {
    const q = document.getElementById("edit-name").value.trim();
    if (!q) {
      alert("먼저 품목명을 입력해 주세요!");
      return;
    }
    window.open("https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(q), "_blank");
  }

  function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");
        const maxSize = 240;
        let w = img.width, h = img.height;
        if (w > h && w > maxSize) { h *= maxSize / w; w = maxSize; }
        else if (h > maxSize) { w *= maxSize / h; h = maxSize; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        document.getElementById("edit-img").value = canvas.toDataURL("image/jpeg", 0.72);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* Sync Modal */
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

  /* Backup & Restore */
  function exportBackup() {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `osaka-receipt-backup-${dateStr}.json`;
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
        if (parsed.shopping && parsed.packing) {
          appData = parsed;
          saveData(true);
          render();
          alert("백업 데이터를 성공적으로 불러왔습니다!");
        } else {
          alert("올바른 백업 파일이 아닙니다.");
        }
      } catch (err) {
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function toKrw(jpy) {
    return Math.round((jpy / 100) * appData.rate);
  }

  function render() {
    document.getElementById("rate-input").value = appData.rate;
    const isShopping = appData.activeTab === "shopping";

    document.getElementById("tab-shopping").classList.toggle("active", isShopping);
    document.getElementById("tab-packing").classList.toggle("active", !isShopping);
    document.getElementById("rate-box").style.display = isShopping ? "flex" : "none";
    document.getElementById("total-section").style.display = isShopping ? "block" : "none";

    const shopCount = appData.shopping.reduce((acc, c) => acc + c.items.length, 0);
    const packCount = appData.packing.reduce((acc, c) => acc + c.items.length, 0);
    document.getElementById("count-shopping").textContent = shopCount;
    document.getElementById("count-packing").textContent = packCount;

    const cats = appData[appData.activeTab];
    const allItems = cats.flatMap(c => c.items);
    const allChecked = allItems.length > 0 && allItems.every(i => i.checked);
    document.getElementById("global-check-btn").textContent = allChecked
      ? (isShopping ? "☐ 쇼핑 리스트 전체 해제" : "☐ 준비물 전체 해제")
      : (isShopping ? "☑ 쇼핑 리스트 전체 선택" : "☑ 준비물 전체 선택");

    const container = document.getElementById("list-container");
    container.innerHTML = "";

    if (cats.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          등록된 카테고리가 없습니다.<br>
          상단의 <strong>[+ 카테고리]</strong> 버튼을 눌러 항목을 추가해 보세요.
        </div>
      `;
    }

    let grandJpy = 0;
    let checkedJpy = 0;

    cats.forEach(cat => {
      const catAllChecked = cat.items.length > 0 && cat.items.every(i => i.checked);
      let catJpy = 0;

      const catDiv = document.createElement("div");
      catDiv.className = "category";

      let itemsHtml = "";
      cat.items.forEach(item => {
        const unitPrice = item.price || 0;
        const qty = item.qty || 1;
        const lineJpy = unitPrice * qty;

        catJpy += lineJpy;
        grandJpy += lineJpy;
        if (item.checked) checkedJpy += lineJpy;

        const qtyBadgeHtml = qty > 1 ? `<span class="qty-badge">x${qty}</span>` : "";

        if (isShopping) {
          const thumbHtml = item.img ? `<img src="${item.img}" alt="">` : `+📷`;
          itemsHtml += `
            <div class="item-row ${item.checked ? "checked" : ""}">
              <input type="checkbox" class="item-check" ${item.checked ? "checked" : ""} onchange="toggleItem('${cat.id}', '${item.id}')">
              <div class="item-thumb ${item.img ? "has-img" : ""}" onclick="handleThumbClick('${cat.id}', '${item.id}')">${thumbHtml}</div>
              <div class="item-info">
                <div class="item-name" onclick="toggleItem('${cat.id}', '${item.id}')" style="cursor:pointer;">${item.name}${qtyBadgeHtml}</div>
                ${item.memo ? `<div class="item-memo">${item.memo}</div>` : ""}
                <div class="qty-stepper" onclick="event.stopPropagation()">
                  <button type="button" class="qty-step-btn" onclick="changeItemQty('${cat.id}', '${item.id}', -1)">-</button>
                  <span class="qty-step-val">${qty}개</span>
                  <button type="button" class="qty-step-btn" onclick="changeItemQty('${cat.id}', '${item.id}', 1)">+</button>
                </div>
              </div>
              <div class="item-price-box">
                <div class="price-jpy">¥${lineJpy.toLocaleString()}</div>
                ${qty > 1 ? `<div class="price-unit-sub">¥${unitPrice.toLocaleString()}×${qty}</div>` : ""}
                <div class="price-krw">${toKrw(lineJpy).toLocaleString()}원</div>
              </div>
              <button class="item-edit-btn" onclick="openModal('${cat.id}', '${item.id}')">✎</button>
            </div>
          `;
        } else {
          itemsHtml += `
            <div class="item-row packing-row ${item.checked ? "checked" : ""}">
              <input type="checkbox" class="item-check" ${item.checked ? "checked" : ""} onchange="toggleItem('${cat.id}', '${item.id}')">
              <div class="item-info" onclick="toggleItem('${cat.id}', '${item.id}')" style="cursor:pointer;">
                <div class="item-name">${item.name}${qtyBadgeHtml}</div>
                ${item.memo ? `<div class="item-memo">${item.memo}</div>` : ""}
              </div>
              <button class="item-edit-btn" onclick="openModal('${cat.id}', '${item.id}')">✎</button>
            </div>
          `;
        }
      });

      let footerHtml = "";
      if (isShopping) {
        const isTaxFree = catJpy >= 5500;
        const diff = 5500 - catJpy;
        footerHtml = `
          <div class="cat-footer">
            <span class="tax-badge ${isTaxFree ? "ok" : "yet"}">
              ${isTaxFree ? "✓ 면세 가능 (5,500¥↑)" : `면세까지 ¥${diff.toLocaleString()} 남음`}
            </span>
            <span>소계: <strong>¥${catJpy.toLocaleString()}</strong> (${toKrw(catJpy).toLocaleString()}원)</span>
          </div>
        `;
      }

      catDiv.innerHTML = `
        <div class="cat-header">
          <div class="cat-title-wrap">
            <span class="cat-title">[ ${cat.title} ]</span>
            <button class="cat-icon-btn" title="카테고리 이름 수정" onclick="editCategory('${cat.id}')">✎</button>
            <button class="cat-icon-btn del" title="카테고리 삭제" onclick="deleteCategory('${cat.id}')">✕</button>
          </div>
          <div class="cat-actions">
            <button class="cat-check-btn" onclick="toggleCategoryAll('${cat.id}')">${catAllChecked ? "전체해제" : "전체선택"}</button>
            <button class="cat-add-btn" onclick="openModal('${cat.id}')">+ 추가</button>
          </div>
        </div>
        ${itemsHtml || `<div style="font-size:12px; color:#888; padding:8px 4px;">항목이 없습니다. '+ 추가'를 눌러 등록하세요.</div>`}
        ${footerHtml}
      `;
      container.appendChild(catDiv);
    });

    if (isShopping) {
      document.getElementById("checked-total-jpy").textContent = `¥${checkedJpy.toLocaleString()} (${toKrw(checkedJpy).toLocaleString()}원)`;
      document.getElementById("grand-total-jpy").textContent = `¥${grandJpy.toLocaleString()}`;
      document.getElementById("grand-total-krw").textContent = `≈ ${toKrw(grandJpy).toLocaleString()}원`;
    }
  }

  render();
  if (getSheetUrl()) {
    syncFromSheet();
  }
