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
        const migrated = migrateClinicProducts20261123();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        render();
        if (migrated) await saveData(true);
        else setSyncUI("online", "구글 시트 연결됨 (최신 상태)");
      } else {
        await saveData(true);
      }
    } catch (err) {
      setSyncUI("error", "시트 연결 확인 필요");
    }
  }


  const newClinicProducts20261123 = [{"id":"clinic_4571609416784","name":"클리닉 마이넘버 카드 케이스 (의사 우사기)","price":550,"qty":1,"memo":"상품번호 4571609416784","img":"https://chiikawamarket.jp/cdn/shop/files/4571609416784_1.jpg?v=1794294140&width=600","checked":false},{"id":"clinic_4571609416753","name":"클리닉 약수첩 & 진찰권 커버 (간호사 친구들)","price":1100,"qty":1,"memo":"상품번호 4571609416753","img":"https://chiikawamarket.jp/cdn/shop/files/4571609416753_1.jpg?v=1794294274&width=600","checked":false},{"id":"clinic_4571609416357","name":"클리닉 백전백승 부적","price":990,"qty":1,"memo":"상품번호 4571609416357","img":"https://chiikawamarket.jp/cdn/shop/files/4571609416357_1.jpg?v=1794361532&width=600","checked":false}];
  const newClinicImageMap20261123 = {"clinic_4571609416784":"https://chiikawamarket.jp/cdn/shop/files/4571609416784_1.jpg?v=1794294140&width=600","clinic_4571609416753":"https://chiikawamarket.jp/cdn/shop/files/4571609416753_1.jpg?v=1794294274&width=600","clinic_4571609416357":"https://chiikawamarket.jp/cdn/shop/files/4571609416357_1.jpg?v=1794361532&width=600"};
  const clinicPoster20261123 = { name: "클리닉 · 포스터 (가끔은 쉬자)", price: 660, img: "https://chiikawamarket.jp/cdn/shop/files/4571609416913.jpg?v=1794363092&width=416" };
  function updateClinicPoster20261123() {
    let changed = false;
    (appData.shopping || []).forEach(cat => {
      (cat.items || []).forEach(item => {
        if (/클리닉/.test(String(item.name || "")) && /포스터/.test(String(item.name || ""))) {
          for (const [key, value] of Object.entries(clinicPoster20261123)) {
            if (item[key] !== value) { item[key] = value; changed = true; }
          }
        }
      });
    });
    return changed;
  }
  function migrateClinicProducts20261123() {
    if (!Array.isArray(appData.shopping)) return false;
    let changed = false;
    appData.shopping.forEach(cat => {
      (cat.items || []).forEach(item => {
        const renamed = String(item.name || "").replace(/치이카와\s*클리닉/g, "클리닉").replace(/의사\s*시사/g, "간호사 시사");
        if (renamed !== item.name) { item.name = renamed; changed = true; }
      });
    });
    changed = updateClinicPoster20261123() || changed;
    if (appData.clinicProducts20261123Added) return changed;
    let hobby = appData.shopping.find(cat => /취미/.test(cat.name || cat.title || ""));
    if (!hobby) {
      hobby = { id: "cat_clinic_hobby_20261123", name: "취미", items: [] };
      appData.shopping.push(hobby);
      changed = true;
    }
    for (const item of newClinicProducts20261123) {
      const sku = item.id.replace("clinic_", "");
      if (!appData.shopping.some(cat => (cat.items || []).some(existing =>
        existing.id === item.id || String(existing.memo || "").includes(sku)
      ))) {
        hobby.items.push({ ...item });
        changed = true;
      }
    }
    appData.clinicProducts20261123Added = true;
    return true;
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
    if (item && (clinicImageFor(item) || item.img)) {
      previewTarget = { catId, itemId };
      document.getElementById("preview-img-el").src = clinicImageFor(item) || item.img;
      document.getElementById("preview-title-el").textContent = displayItemName(item);
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


  function setProductFetchStatus(message) {
    document.getElementById("product-fetch-status").textContent = message;
  }
  async function getShopifyProductData(rawUrl) {
    const parsed = new URL(rawUrl);
    if (!/^https:$/.test(parsed.protocol) || !/^(www\\.)?chiikawamarket\\.jp$/.test(parsed.hostname)) {
      throw new Error("현재 자동 불러오기는 치이카와 마켓 상품 링크를 지원하긔.");
    }
    const match = parsed.pathname.match(/\\/products\\/([^/]+)/);
    if (!match) throw new Error("상품 상세 페이지 링크를 입력해주긔.");
    const productUrl = parsed.origin + "/products/" + encodeURIComponent(decodeURIComponent(match[1])) + ".js";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      let data;
      try {
        const response = await fetch(productUrl, {signal:controller.signal});
        if (!response.ok) throw new Error("상품 응답 오류");
        data = await response.json();
      } catch (directError) {
        // GitHub Pages에서 외부 쇼핑몰의 CORS 정책이 허용되지 않는 경우의 공개 URL 프록시.
        const proxy = "https://api.allorigins.win/raw?url=" + encodeURIComponent(productUrl);
        const response = await fetch(proxy, {signal:controller.signal});
        if (!response.ok) throw new Error("상품 정보 요청 실패");
        data = await response.json();
      }
      if (!data || !data.title || !Array.isArray(data.variants)) throw new Error("상품 응답 형식이 올바르지 않긔.");
      const variant = data.variants.find(x => x.available) || data.variants[0];
      const price = Number(variant && variant.price);
      const img = typeof data.featured_image === "string" ? data.featured_image :
        typeof data.featured_image?.src === "string" ? data.featured_image.src :
        Array.isArray(data.images) ? (typeof data.images[0] === "string" ? data.images[0] : data.images[0]?.src) : "";
      return {
        name: String(data.title).replace(/치이카와\\s*클리닉/g, "클리닉"),
        price: Number.isFinite(price) ? Math.round(price / 100) : null,
        img: typeof img === "string" && img ? (img.startsWith("//") ? "https:" + img : img) : "",
        url: parsed.origin + parsed.pathname
      };
    } finally { clearTimeout(timer); }
  }
  async function fetchProductFromUrl() {
    const rawUrl = document.getElementById("edit-product-url").value.trim();
    if (!rawUrl) { setProductFetchStatus("먼저 상품 링크를 입력해주긔."); return; }
    const btn = document.getElementById("fetch-product-btn");
    btn.disabled = true;
    btn.textContent = "불러오는 중";
    setProductFetchStatus("공식 상품 정보를 조회하고 있긔.");
    try {
      const data = await getShopifyProductData(rawUrl);
      document.getElementById("edit-name").value = data.name;
      if (data.price !== null) document.getElementById("edit-price").value = data.price;
      if (data.img) document.getElementById("edit-img").value = data.img;
      setProductFetchStatus("상품명·가격" + (data.img ? "·이미지" : "") + "를 불러왔긔. 확인 후 저장해주긔.");
    } catch (error) {
      setProductFetchStatus("자동 불러오기 실패: " + (error.message || "사이트의 외부 접근 제한") + " 기존 칸에서 직접 등록할 수 있긔.");
    } finally {
      btn.disabled = false;
      btn.textContent = "정보 불러오기";
    }
  }

  function openModal(catId, itemId = null) {
    editingTarget = { catId, itemId };
    const isShopping = appData.activeTab === "shopping";
    document.getElementById("product-url-group").style.display = isShopping ? "block" : "none";
    setProductFetchStatus("");
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
      document.getElementById("edit-product-url").value = item.url || "";
      document.getElementById("edit-name").value = displayItemName(item);
      document.getElementById("edit-price").value = item.price || "";
      document.getElementById("edit-qty").value = item.qty || 1;
      document.getElementById("edit-memo").value = item.memo || "";
      document.getElementById("edit-img").value = item.img || clinicImageFor(item) || "";
      document.getElementById("modal-del-btn").style.display = "block";
    } else {
      document.getElementById("modal-title").textContent = "새 품목 추가";
      document.getElementById("edit-product-url").value = "";
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
    const url = document.getElementById("edit-product-url").value.trim();

    const cat = appData[appData.activeTab].find(c => c.id === editingTarget.catId);
    if (editingTarget.itemId) {
      const item = cat.items.find(i => i.id === editingTarget.itemId);
      item.name = name;
      item.price = price;
      item.qty = qty;
      item.memo = memo;
      item.img = img;
      item.url = url;
    } else {
      cat.items.push({
        id: "item_" + Date.now(),
        name,
        price,
        qty,
        memo,
        img,
        url,
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


  // 치이카와 공식몰의 상품 이미지 URL (이미지 파일 업로드 불필요).
  const clinicImageBase = "https://chiikawamarket.jp/cdn/shop/files/";
  const clinicImageRules = [{"type":"간호사","char":"치이카와","file":"4571609408697_1.jpg"},{"type":"간호사","char":"하치와레","file":"4571609408703_1.jpg"},{"type":"간호사","char":"우사기","file":"4571609408710_1.jpg"},{"type":"간호사","char":"모몽가","file":"4571609408727_1.jpg"},{"type":"간호사","char":"쿠리만쥬","file":"4571609408734_1.jpg"},{"type":"간호사","char":"시사","file":"4571609408741_1.jpg"},{"type":"간호사","char":"랏코","file":"4571609408758_1.jpg"},{"type":"간호사","char":"카니","file":"4571609408765_1.jpg"},{"type":"간호사","char":"카부토무시","file":"4571609408772_1.jpg"},{"type":"간호사","char":"오데","file":"4571609408789_1.jpg"},{"type":"간호사","char":"갑옷","file":"4571609408796_1.jpg"},{"type":"간호사","char":"그 녀석","file":"4571609408802_1.jpg"},{"type":"의사","char":"우사기","file":"4571609408819_1.jpg"},{"type":"의사","char":"랏코","file":"4571609408826_1.jpg"},{"type":"장기","char":"치이카와","file":"4571609412793_1.jpg"},{"type":"장기","char":"하치와레","file":"4571609412809_1.jpg"},{"type":"장기","char":"우사기","file":"4571609412816_1.jpg"},{"type":"비즈","char":"치이카와","file":"4571609412762.jpg"},{"type":"비즈","char":"하치와레","file":"4571609412779.jpg"},{"type":"비즈","char":"우사기","file":"4571609412786.jpg"},{"type":"파우치","char":"치이카와","file":"4571609416265_1.jpg"},{"type":"파우치","char":"하치와레","file":"4571609416272_1.jpg"},{"type":"파우치","char":"우사기","file":"4571609416289_1_68771769-a71b-49f2-8869-7fd12dabe7e4.jpg"}];
  const clinicOtherImages = [{"keyword":"바이러스","file":"4571609409847_0_f9ce02dc-e1ce-40a4-bb8d-3e56e5a9622e.jpg"},{"keyword":"고블린","file":"4571609409830_0.jpg"},{"keyword":"미니 케이스","file":"4571609416135_1.jpg"},{"keyword":"포스터","file":"4571609416289_1.jpg"},{"keyword":"마시멜로","file":"4571609417170_1.jpg"},{"keyword":"엑스레이","file":"4571609415176_1.jpg"},{"keyword":"약봉투","file":"4571609415183_1_2c86b885-f892-4b61-9c47-280d65611897.jpg"},{"keyword":"멀티 케이스","file":"4571609416234_1.jpg"},{"keyword":"시력검사","file":"4571609416227_1.jpg"}];
  function clinicImageFor(item) {
    if (/클리닉/.test(String(item.name || "")) && /포스터/.test(String(item.name || ""))) return clinicPoster20261123.img;
    const skuImage = newClinicImageMap20261123[item.id];
    if (skuImage) return skuImage;
    const name = String(item.name || "");
    if (!/클리닉|clinic/i.test(name)) return "";
    const normalized = name.replace(/의사\s*시사/g, "간호사 시사").replace(/치이카와\s*클리닉/gi, "클리닉").replace(/ちいかわ\s*クリニック/g, "클리닉");
    const aliases = {
      "하치와레":["하치와레","가르마"], "우사기":["우사기","토끼"],
      "모몽가":["모몽가","하늘다람쥐"], "쿠리만쥬":["쿠리만쥬","밤만쥬"],
      "랏코":["랏코","해달"], "카니":["카니","헌책방"],
      "카부토무시":["카부토무시","풍뎅이","딱정벌레"],
      "갑옷":["갑옷","갑옷상"], "그 녀석":["그 녀석","그아이","그 아이"]
    };
    const has = char => (aliases[char] || [char]).some(alias => normalized.includes(alias));
    const kind = /비즈|스트랩/.test(normalized) ? "비즈" :
      /장기|심장|위\b|폐\b|자기/.test(normalized) ? "장기" :
      /파우치|약이 되어/.test(normalized) && !/약봉투|엑스레이/.test(normalized) ? "파우치" :
      /의사/.test(normalized) ? "의사" : "간호사";
    const match = clinicImageRules.find(x => x.type === kind && has(x.char));
    if (match) return clinicImageBase + match.file + "?width=533";
    const other = clinicOtherImages.find(x => normalized.includes(x.keyword));
    return other ? clinicImageBase + other.file + "?width=533" : "";
  }
  function displayItemName(item) {
    return String(item.name || "").replace(/의사\s*시사/g, "간호사 시사");
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
      catDiv.dataset.catId = cat.id;

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
          const effectiveImg = clinicImageFor(item) || item.img;
          const thumbHtml = effectiveImg ? `<img src="${effectiveImg}" alt="" loading="lazy" onerror="this.style.display=\'none\'">` : `+📷`;
          itemsHtml += `
            <div class="item-row ${item.checked ? "checked" : ""}">
              <button type="button" class="item-drag-handle" aria-label="항목 드래그해서 이동" title="길게 잡아 이동">⠿</button>
              <input type="checkbox" class="item-check" ${item.checked ? "checked" : ""} onchange="toggleItem('${cat.id}', '${item.id}')">
              <div class="item-thumb ${effectiveImg ? "has-img" : ""}" onclick="handleThumbClick('${cat.id}', '${item.id}')">${thumbHtml}</div>
              <div class="item-info">
                <div class="item-name" onclick="toggleItem('${cat.id}', '${item.id}')" style="cursor:pointer;">${displayItemName(item)}${qtyBadgeHtml}</div>
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
              <button type="button" class="item-drag-handle" aria-label="항목 드래그해서 이동" title="길게 잡아 이동">⠿</button>
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
      // Attach identifiers in DOM properties so image/price/checkbox state remains untouched.
      catDiv.querySelectorAll(".item-row").forEach((row, i) => {
        row.dataset.itemId = cat.items[i].id;
      });
      container.appendChild(catDiv);
    });

    if (isShopping) {
      document.getElementById("checked-total-jpy").textContent = `¥${checkedJpy.toLocaleString()} (${toKrw(checkedJpy).toLocaleString()}원)`;
      document.getElementById("grand-total-jpy").textContent = `¥${grandJpy.toLocaleString()}`;
      document.getElementById("grand-total-krw").textContent = `≈ ${toKrw(grandJpy).toLocaleString()}원`;
    }
  }


  /* Pointer-based sortable list. Dedicated handles protect checkboxes and edit actions.
     Works with mouse or touch, including moving items to empty or other categories.
     A move only changes the current tab's arrays; saveData keeps cloud sync as before. */
  (() => {
    const container = document.getElementById("list-container");
    let dragging = null;
    let ignoreClickUntil = 0;
    const getCats = () => appData[appData.activeTab];

    function findDestination(x, y) {
      const element = document.elementFromPoint(x, y);
      if (!element) return null;
      const catEl = element.closest(".category");
      if (!catEl || !container.contains(catEl)) return null;
      const row = element.closest(".item-row");
      if (row && catEl.contains(row)) {
        const rect = row.getBoundingClientRect();
        return {catId: catEl.dataset.catId, itemId: row.dataset.itemId, after: y > rect.top + rect.height / 2, catEl, row};
      }
      // Dropping on a category header or an empty category appends to that category.
      return {catId: catEl.dataset.catId, itemId: null, after: true, catEl, row: null};
    }

    function resetHighlight() {
      container.querySelectorAll(".drop-before,.drop-after,.drop-category").forEach(el => el.classList.remove("drop-before","drop-after","drop-category"));
    }
    function showDestination(dest) {
      resetHighlight();
      if (dest) {
        if (dest.row) dest.row.classList.add(dest.after ? "drop-after" : "drop-before");
        else dest.catEl.classList.add("drop-category");
      }
    }
    function moveItem(fromCatId, itemId, dest) {
      if (!dest) return;
      const cats = getCats();
      const source = cats.find(c => String(c.id) === fromCatId);
      const target = cats.find(c => String(c.id) === dest.catId);
      if (!source || !target) return;
      const from = source.items.findIndex(i => String(i.id) === itemId);
      if (from < 0) return;
      let to = dest.itemId === null ? target.items.length : target.items.findIndex(i => String(i.id) === dest.itemId) + (dest.after ? 1 : 0);
      if (to < 0) to = target.items.length;
      if (source === target && to > from) to--;
      if (source === target && to === from) return;
      const [item] = source.items.splice(from, 1);
      target.items.splice(to, 0, item);
      saveData(true);
      render();
    }
    function cleanup() {
      if (!dragging) return;
      if (dragging.ghost) dragging.ghost.remove();
      dragging.row.classList.remove("item-moving");
      dragging.handle.classList.remove("dragging");
      resetHighlight();
      document.body.classList.remove("is-sorting");
      dragging = null;
    }
    container.addEventListener("click", event => {
      if (Date.now() < ignoreClickUntil && event.target.closest(".item-drag-handle")) {
        event.preventDefault(); event.stopPropagation();
      }
    }, true);
    container.addEventListener("pointerdown", event => {
      const handle = event.target.closest(".item-drag-handle");
      if (!handle || !container.contains(handle) || dragging || (event.pointerType === "mouse" && event.button !== 0)) return;
      const row = handle.closest(".item-row");
      const category = handle.closest(".category");
      if (!row || !category) return;
      const rect = row.getBoundingClientRect();
      dragging = {
        pointerId: event.pointerId, handle, row,
        catId: category.dataset.catId, itemId: row.dataset.itemId,
        originX: event.clientX, originY: event.clientY,
        width: rect.width, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
        ghost: null, destination: null
      };
      handle.setPointerCapture(event.pointerId);
    });
    container.addEventListener("pointermove", event => {
      const d = dragging;
      if (!d || d.pointerId !== event.pointerId) return;
      if (!d.ghost) {
        if (Math.hypot(event.clientX - d.originX, event.clientY - d.originY) < 6) return;
        const ghost = d.row.cloneNode(true);
        ghost.classList.add("drag-ghost");
        ghost.style.width = d.width + "px";
        document.body.appendChild(ghost);
        d.ghost = ghost;
        d.row.classList.add("item-moving");
        d.handle.classList.add("dragging");
        document.body.classList.add("is-sorting");
      }
      event.preventDefault();
      d.ghost.style.left = (event.clientX - d.offsetX) + "px";
      d.ghost.style.top = (event.clientY - d.offsetY) + "px";
      const dest = findDestination(event.clientX, event.clientY);
      d.destination = dest;
      showDestination(dest);
      const margin = 48;
      if (event.clientY < margin) window.scrollBy(0, -13);
      else if (event.clientY > window.innerHeight - margin) window.scrollBy(0, 13);
    }, {passive:false});
    const finish = (event, cancelled) => {
      const d = dragging;
      if (!d || d.pointerId !== event.pointerId) return;
      const wasMoved = Boolean(d.ghost);
      const fromCatId = d.catId;
      const itemId = d.itemId;
      const dest = cancelled ? null : findDestination(event.clientX, event.clientY) || d.destination;
      cleanup();
      try {d.handle.releasePointerCapture(event.pointerId)} catch (_) {}
      if (wasMoved) {
        ignoreClickUntil = Date.now() + 350;
        if (dest) moveItem(fromCatId, itemId, dest);
      }
    };
    container.addEventListener("pointerup", e => finish(e, false));
    container.addEventListener("pointercancel", e => finish(e, true));
    window.addEventListener("blur", () => cleanup());
  })();

  if (migrateClinicProducts20261123()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }
  render();
  if (getSheetUrl()) {
    syncFromSheet();
  }
