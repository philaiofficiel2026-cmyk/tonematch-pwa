/* ToneMatch AI — App.js (simple, iPhone friendly)
   - Home screen + Camera/Import
   - Eyedropper touch+drag
   - Lock A / Lock B (keeps locked colors)
   - Save A/B into "Mes couleurs"
   - "Mes couleurs" shows premium bands + delete
*/

(function () {
  const STORAGE_COLORS = "tonematch_colors_v2";

  // ---------- Helpers ----------
  const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const rgbToHex = (r, g, b) =>
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

  const loadStore = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_COLORS) || "[]");
    } catch {
      return [];
    }
  };
  const saveStore = (arr) => localStorage.setItem(STORAGE_COLORS, JSON.stringify(arr));

  // ---------- Base Styles (inject) ----------
  const style = document.createElement("style");
  style.textContent = `
    :root{
      --bg:#0B0B10;
      --card:rgba(255,255,255,.06);
      --card2:rgba(255,255,255,.08);
      --stroke:rgba(255,255,255,.10);
      --text:#F3F3F7;
      --muted:rgba(243,243,247,.65);
      --accent:#B100FF;
      --accent2:#FF00B8;
      --danger:#C83A3A;
      --radius:18px;
      --radius2:22px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, Arial, sans-serif;
    }
    body{
      margin:0;
      background: radial-gradient(1200px 600px at 30% -10%, rgba(177,0,255,.25), transparent 60%),
                  radial-gradient(900px 500px at 80% 10%, rgba(255,0,184,.18), transparent 60%),
                  var(--bg);
      color:var(--text);
      min-height:100vh;
    }
    .tm_topbar{
      position:sticky; top:0; z-index:10;
      padding:14px 14px 10px;
      backdrop-filter: blur(14px);
      background: linear-gradient(to bottom, rgba(11,11,16,.85), rgba(11,11,16,.35));
      border-bottom:1px solid rgba(255,255,255,.06);
    }
    .tm_brand{display:flex; align-items:center; gap:10px;}
    .tm_dot{
      width:12px;height:12px;border-radius:999px;
      background: linear-gradient(135deg, var(--accent2), var(--accent));
      box-shadow: 0 0 18px rgba(177,0,255,.55);
    }
    .tm_title{font-weight:800; letter-spacing:.2px; font-size:18px}
    .tm_title span{color:rgba(243,243,247,.75); font-weight:700}
    .tm_shell{max-width:720px;margin:0 auto;padding:14px;display:flex;flex-direction:column;gap:14px;}
    .tm_card{
      border:1px solid rgba(255,255,255,.08);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.035));
      border-radius: var(--radius2);
      padding:16px;
      box-shadow: 0 14px 50px rgba(0,0,0,.35);
    }
    .tm_h1{margin:0 0 6px; font-size:24px; font-weight:900;}
    .tm_p{margin:0 0 12px; color:var(--muted); line-height:1.35;}
    .tm_actions{display:flex; flex-direction:column; gap:10px;}
    .tm_btn{
      border:1px solid rgba(255,255,255,.10);
      border-radius: 16px;
      padding:14px 14px;
      font-size:16px;
      font-weight:800;
      color:var(--text);
      background: rgba(255,255,255,.06);
      display:flex; align-items:center; justify-content:center;
      gap:10px;
      cursor:pointer;
    }
    .tm_btnPrimary{
      border:none;
      background: linear-gradient(90deg, var(--accent2), var(--accent));
      box-shadow: 0 10px 30px rgba(177,0,255,.25);
    }
    .tm_btnDanger{
      border:none;
      background: rgba(200,58,58,.18);
      color:#FFD8D8;
    }
    .tm_btnSmall{
      padding:10px 12px;
      font-size:14px;
      border-radius:14px;
    }
    .tm_row{display:flex; gap:10px; flex-wrap:wrap}
    .tm_row > *{flex:1}
    .tm_hidden{display:none !important;}

    .tm_previewWrap{
      position:relative;
      border-radius: 18px;
      border:1px solid rgba(255,255,255,.10);
      overflow:hidden;
      background: rgba(0,0,0,.25);
      height: 320px;
    }
    .tm_previewWrap img{
      width:100%;height:100%;
      object-fit: contain;
      display:block;
    }
    .tm_crosshair{
      position:absolute;
      width:44px;height:44px;
      border-radius:999px;
      border:2px solid rgba(255,255,255,.95);
      box-shadow: 0 0 0 8px rgba(0,0,0,.25);
      transform: translate(-50%,-50%);
      pointer-events:none;
    }
    .tm_crosshair:after{
      content:"";
      position:absolute;left:50%;top:50%;
      width:6px;height:6px;border-radius:999px;
      background: rgba(255,255,255,.95);
      transform: translate(-50%,-50%);
    }

    .tm_abBar{
      border-radius:18px;
      overflow:hidden;
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.05);
    }
    .tm_abHalf{
      height:58px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 12px;
      font-weight:900;
      letter-spacing:.3px;
      color: rgba(0,0,0,.72);
      text-shadow: 0 1px 0 rgba(255,255,255,.35);
    }
    .tm_abHalf span{
      display:flex; align-items:center; gap:8px;
      background: rgba(0,0,0,.25);
      color: rgba(255,255,255,.92);
      padding:6px 10px;
      border-radius:999px;
      font-size:13px;
      font-weight:900;
    }
    .tm_abHalf b{
      background: rgba(0,0,0,.22);
      color: rgba(255,255,255,.92);
      padding:6px 10px;
      border-radius:999px;
      font-size:13px;
      font-weight:900;
    }

    .tm_locks{display:flex; gap:10px; margin-top:12px;}
    .tm_locks button{
      flex:1;
      padding:12px 10px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.06);
      color:var(--text);
      font-weight:900;
      cursor:pointer;
    }
    .tm_locks button.tm_locked{
      border:none;
      background: linear-gradient(90deg, rgba(255,0,184,.22), rgba(177,0,255,.18));
    }

    .tm_sectionTitle{margin:0 0 10px; font-size:18px; font-weight:900;}
    .tm_list{display:flex; flex-direction:column; gap:10px;}
    .tm_colorRow{
      display:flex; gap:10px; align-items:stretch;
      border:1px solid rgba(255,255,255,.08);
      border-radius:18px;
      overflow:hidden;
      background: rgba(255,255,255,.04);
    }
    .tm_band{
      width:40%;
      display:flex;
      flex-direction:column;
    }
    .tm_band .half{flex:1}
    .tm_meta{
      flex:1;
      padding:12px 12px;
      display:flex;
      flex-direction:column;
      justify-content:center;
      gap:6px;
    }
    .tm_meta .line{display:flex; justify-content:space-between; color:rgba(243,243,247,.9); font-weight:900}
    .tm_meta .date{color:var(--muted); font-size:12px; font-weight:800}
    .tm_colorRow .del{
      width:92px;
      border:none;
      background: rgba(200,58,58,.18);
      color:#FFD8D8;
      font-weight:900;
      cursor:pointer;
    }
  `;
  document.head.appendChild(style);

  // ---------- Replace page content (simple app) ----------
  document.body.innerHTML = "";

  const topbar = el("div", "tm_topbar");
  const brand = el("div", "tm_brand");
  const dot = el("div", "tm_dot");
  const title = el("div", "tm_title");
  title.innerHTML = `ToneMatch <span>AI</span>`;
  brand.append(dot, title);
  topbar.append(brand);

  const shell = el("div", "tm_shell");

  // Home
  const home = el("div", "tm_card");
  const h1 = el("div", "tm_h1");
  h1.textContent = "Identifiez vos couleurs";
  const p = el("div", "tm_p");
  p.textContent = "Prenez une photo ou importez une image. Touchez / glissez pour prélever. Verrouillez A et B puis sauvegardez dans Mes couleurs.";
  const actions = el("div", "tm_actions");

  const btnPick = el("button", "tm_btn tm_btnPrimary");
  btnPick.textContent = "📸 Prendre / importer une image";

  const btnColors = el("button", "tm_btn");
  btnColors.textContent = "🎨 Mes couleurs";

  actions.append(btnPick, btnColors);
  home.append(h1, p, actions);

  // Workspace
  const workspace = el("div", "tm_card tm_hidden");

  const previewWrap = el("div", "tm_previewWrap");
  const img = el("img");
  img.alt = "Image";
  const cross = el("div", "tm_crosshair");
  previewWrap.append(img, cross);

  const abBar = el("div", "tm_abBar");
  const halfA = el("div", "tm_abHalf");
  const halfB = el("div", "tm_abHalf");
  halfA.style.background = "rgba(255,255,255,.06)";
  halfB.style.background = "rgba(255,255,255,.06)";
  const tagA = el("span");
  const tagB = el("span");
  const valA = el("b");
  const valB = el("b");
  tagA.textContent = "🔒 A";
  tagB.textContent = "🔒 B";
  valA.textContent = "—";
  valB.textContent = "—";
  halfA.append(tagA, valA);
  halfB.append(tagB, valB);
  abBar.append(halfA, halfB);

  const locks = el("div", "tm_locks");
  const btnLockA = el("button");
  const btnLockB = el("button");
  btnLockA.textContent = "🔓 Verrouiller A";
  btnLockB.textContent = "🔓 Verrouiller B";
  locks.append(btnLockA, btnLockB);

  const rowBottom = el("div", "tm_row");
  const btnSave = el("button", "tm_btn tm_btnPrimary");
  btnSave.textContent = "💾 Sauvegarder dans Mes couleurs";
  const btnBack = el("button", "tm_btn tm_btnSmall");
  btnBack.textContent = "← Retour";
  rowBottom.append(btnSave, btnBack);

  workspace.append(previewWrap, abBar, locks, rowBottom);

  // Colors Panel
  const colorsPanel = el("div", "tm_card tm_hidden");
  const colorsTitle = el("div", "tm_sectionTitle");
  colorsTitle.textContent = "Mes couleurs";
  const list = el("div", "tm_list");
  const btnCloseColors = el("button", "tm_btn tm_btnSmall");
  btnCloseColors.textContent = "✕ Fermer";
  colorsPanel.append(colorsTitle, list, btnCloseColors);

  shell.append(home, workspace, colorsPanel);
  document.body.append(topbar, shell);

  // Hidden file input for iPhone camera/gallery
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.setAttribute("capture", "environment");
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  // Canvas for sampling
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // State
  let imgLoaded = false;
  let liveHex = "#000000";
  let lockedA = null;
  let lockedB = null;

  const setLive = (hex) => {
    liveHex = hex;
  };

  const setLocked = (which, hex) => {
    if (which === "A") {
      lockedA = hex;
      valA.textContent = hex;
      halfA.style.background = hex;
      btnLockA.textContent = "🔒 A verrouillé (déverrouiller)";
      btnLockA.classList.add("tm_locked");
    } else {
      lockedB = hex;
      valB.textContent = hex;
      halfB.style.background = hex;
      btnLockB.textContent = "🔒 B verrouillé (déverrouiller)";
      btnLockB.classList.add("tm_locked");
    }
  };

  const resetLocks = () => {
    lockedA = null;
    lockedB = null;
    valA.textContent = "—";
    valB.textContent = "—";
    halfA.style.background = "rgba(255,255,255,.06)";
    halfB.style.background = "rgba(255,255,255,.06)";
    btnLockA.textContent = "🔓 Verrouiller A";
    btnLockB.textContent = "🔓 Verrouiller B";
    btnLockA.classList.remove("tm_locked");
    btnLockB.classList.remove("tm_locked");
  };

  const sampleAt = (clientX, clientY) => {
    if (!imgLoaded) return;

    const rect = img.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width - 1);
    const y = clamp(clientY - rect.top, 0, rect.height - 1);

    cross.style.left = `${(x / rect.width) * 100}%`;
    cross.style.top = `${(y / rect.height) * 100}%`;

    const cx = Math.floor((x / rect.width) * canvas.width);
    const cy = Math.floor((y / rect.height) * canvas.height);

    const data = ctx.getImageData(cx, cy, 1, 1).data;
    const hex = rgbToHex(data[0], data[1], data[2]);
    setLive(hex);

    // Premium behavior:
    // - If A not locked, show live color on A half
    // - If B not locked, show live color on B half
    if (!lockedA) {
      halfA.style.background = hex;
      valA.textContent = hex;
      tagA.textContent = "A (live)";
    } else {
      tagA.textContent = "🔒 A";
    }

    if (!lockedB) {
      halfB.style.background = hex;
      valB.textContent = hex;
      tagB.textContent = "B (live)";
    } else {
      tagB.textContent = "🔒 B";
    }
  };

  const loadImageFromFile = (file) => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      imgLoaded = true;
      resetLocks();

      workspace.classList.remove("tm_hidden");
      home.classList.add("tm_hidden");
      colorsPanel.classList.add("tm_hidden");

      // Sample center
      requestAnimationFrame(() => {
        const rect = img.getBoundingClientRect();
        sampleAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
      });
    };
    img.src = url;
  };

  // Touch & drag on image
  let dragging = false;

  const onDown = (e) => {
    dragging = true;
    const t = e.touches ? e.touches[0] : e;
    sampleAt(t.clientX, t.clientY);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    sampleAt(t.clientX, t.clientY);
  };
  const onUp = () => (dragging = false);

  previewWrap.addEventListener("touchstart", onDown, { passive: true });
  previewWrap.addEventListener("touchmove", onMove, { passive: true });
  previewWrap.addEventListener("touchend", onUp, { passive: true });
  previewWrap.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);

  // Buttons
  btnPick.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    loadImageFromFile(file);
    fileInput.value = "";
  });

  btnBack.addEventListener("click", () => {
    home.classList.remove("tm_hidden");
    workspace.classList.add("tm_hidden");
    colorsPanel.classList.add("tm_hidden");
  });

  btnColors.addEventListener("click", () => {
    renderColors();
    colorsPanel.classList.remove("tm_hidden");
    home.classList.add("tm_hidden");
    workspace.classList.add("tm_hidden");
  });

  btnCloseColors.addEventListener("click", () => {
    home.classList.remove("tm_hidden");
    colorsPanel.classList.add("tm_hidden");
  });

  btnLockA.addEventListener("click", () => {
    if (!imgLoaded) return;
    if (lockedA) {
      lockedA = null;
      btnLockA.textContent = "🔓 Verrouiller A";
      btnLockA.classList.remove("tm_locked");
    } else {
      setLocked("A", liveHex);
    }
  });

  btnLockB.addEventListener("click", () => {
    if (!imgLoaded) return;
    if (lockedB) {
      lockedB = null;
      btnLockB.textContent = "🔓 Verrouiller B";
      btnLockB.classList.remove("tm_locked");
    } else {
      setLocked("B", liveHex);
    }
  });

  btnSave.addEventListener("click", () => {
    // Save what is locked. If nothing locked, save current live into A.
    const a = lockedA || valA.textContent !== "—" ? valA.textContent : null;
    const b = lockedB || valB.textContent !== "—" ? valB.textContent : null;

    // Normalize: if both are live and equal and nothing locked, store only A
    const now = new Date();
    const date = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

    const item = {
      a: a && a.startsWith("#") ? a : null,
      b: b && b.startsWith("#") ? b : null,
      date
    };

    const arr = loadStore();
    arr.unshift(item);
    saveStore(arr);

    // Open Mes couleurs after save
    renderColors();
    colorsPanel.classList.remove("tm_hidden");
    workspace.classList.add("tm_hidden");
  });

  function renderColors() {
    const items = loadStore();
    list.innerHTML = "";

    if (!items.length) {
      const empty = el("div", "tm_p");
      empty.textContent = "Aucune couleur sauvegardée pour le moment.";
      list.appendChild(empty);
      return;
    }

    items.forEach((it, idx) => {
      const row = el("div", "tm_colorRow");

      const band = el("div", "tm_band");
      const half1 = el("div", "half");
      const half2 = el("div", "half");
      half1.style.background = it.a || "rgba(255,255,255,.06)";
      half2.style.background = it.b || "rgba(255,255,255,.06)";
      band.append(half1, half2);

      const meta = el("div", "tm_meta");
      const lineA = el("div", "line");
      lineA.innerHTML = `<span>A</span><span>${it.a || "—"}</span>`;
      const lineB = el("div", "line");
      lineB.innerHTML = `<span>B</span><span>${it.b || "—"}</span>`;
      const date = el("div", "date");
      date.textContent = it.date || "";
      meta.append(lineA, lineB, date);

      const del = el("button", "del");
      del.textContent = "Supprimer";
      del.addEventListener("click", () => {
        const arr = loadStore();
        arr.splice(idx, 1);
        saveStore(arr);
        renderColors();
      });

      row.append(band, meta, del);
      list.appendChild(row);
    });
  }

  // iOS PWA hint: allow install (optional) via Add to Home Screen
  // Nothing else needed.
})();
