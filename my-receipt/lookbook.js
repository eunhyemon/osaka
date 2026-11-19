/* Four private-on-this-device outfit slots. Never sync to receipt data or Sheets. */
(() => {
  const key = "osaka_lookbook_local_v1";
  const panel = document.getElementById("lookbook-panel");
  const grid = document.getElementById("lookbook-grid");
  let images = {};
  try { images = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (_) {}
  function store(next) {
    try { localStorage.setItem(key, JSON.stringify(next)); images = next; draw(); }
    catch (_) { alert("사진을 저장하지 못했어요. 더 작은 이미지로 다시 시도해 주세요."); }
  }
  function draw() {
    grid.replaceChildren();
    for (let day = 1; day <= 4; day++) {
      const card = document.createElement("article");
      card.className = "lookbook-day";
      const heading = document.createElement("div");
      heading.className = "lookbook-day-heading";
      heading.textContent = "DAY 0" + day;
      const label = document.createElement("label");
      label.className = "lookbook-photo";
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*"; input.className = "lookbook-file";
      input.setAttribute("aria-label", "DAY " + day + " 코디 사진 등록");
      if (typeof images[day] === "string" && images[day].startsWith("data:image/jpeg;base64,")) {
        const img = document.createElement("img");
        img.src = images[day]; img.alt = "DAY " + day + " 코디";
        label.appendChild(img);
      } else {
        const placeholder = document.createElement("span");
        placeholder.textContent = "+ 코디 이미지 등록";
        label.appendChild(placeholder);
      }
      label.appendChild(input);
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          store({...images, [day]: canvas.toDataURL("image/jpeg", .82)});
        } catch (_) { alert("사진을 읽을 수 없어요. JPG 또는 PNG로 다시 시도해 주세요."); }
        finally { URL.revokeObjectURL(url); input.value = ""; }
      });
      card.append(heading, label);
      if (images[day]) {
        const actions = document.createElement("div");
        actions.className = "lookbook-actions";
        const change = document.createElement("button");
        change.type = "button"; change.className = "small-action-btn"; change.textContent = "사진 변경";
        change.onclick = () => input.click();
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "small-action-btn"; remove.textContent = "삭제";
        remove.onclick = () => { if (confirm("DAY " + day + " 코디 사진을 삭제할까요?")) { const next = {...images}; delete next[day]; store(next); } };
        actions.append(change, remove); card.appendChild(actions);
      }
      grid.appendChild(card);
    }
    document.getElementById("count-lookbook").textContent = Object.keys(images).filter(k => ["1","2","3","4"].includes(k)).length;
  }
  window.renderLookbook = draw;
  draw();
})();
