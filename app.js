// ToneMatch AI — PWA (vanilla JS) — stockage local
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const LS = {
  colors: 'tm_my_colors_v1',
  dressing: 'tm_dressing_v1',
  images: 'tm_saved_images_v1',
  settings: 'tm_settings_v1'
};

const state = {
  img: null,
  imgW: 0,
  imgH: 0,
  pos: {x: 0.7, y: 0.4},
  live: {r:0,g:0,b:0,hex:'#000000'},
  A: {locked:false, rgb:null, hex:null},
  B: {locked:false, rgb:null, hex:null},
  toneEnabled: false,
  warm: false,
  sampleSize: 20,
  showLab: true,
  compact: false,

  modal: {open:false, img:null, imgW:0, imgH:0, pos:{x:0.5,y:0.5}, live:null,
          P:null, S:null, Acc:null, detect:false, editingId:null}
};

// -------------------- Utils
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function rgbToHex(r,g,b){
  const to = (n)=> n.toString(16).padStart(2,'0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}
function hexToRgb(hex){
  const h = hex.replace('#','');
  const n = parseInt(h,16);
  return {r:(n>>16)&255, g:(n>>8)&255, b:n&255};
}
function srgbToLinear(c){
  c /= 255;
  return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
}
function linearToSrgb(c){
  const v = c <= 0.0031308 ? 12.92*c : 1.055*Math.pow(c,1/2.4)-0.055;
  return clamp(Math.round(v*255),0,255);
}
// Warm filter: simple color temperature-ish adjustment (not perfect, but usable)
function applyWarm({r,g,b}, intensity=0.18){
  // push towards warm: more red, less blue
  const nr = clamp(Math.round(r*(1+intensity) + 6),0,255);
  const nb = clamp(Math.round(b*(1-intensity) - 6),0,255);
  const ng = clamp(Math.round(g*(1+intensity*0.2)),0,255);
  return {r:nr,g:ng,b:nb};
}

// RGB -> XYZ -> LAB (D65)
function rgbToXyz(r,g,b){
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  // sRGB D65
  const X = R*0.4124564 + G*0.3575761 + B*0.1804375;
  const Y = R*0.2126729 + G*0.7151522 + B*0.0721750;
  const Z = R*0.0193339 + G*0.1191920 + B*0.9503041;
  return {X, Y, Z};
}
function xyzToLab(X,Y,Z){
  // Reference white D65
  const Xn=0.95047, Yn=1.00000, Zn=1.08883;
  const f = (t)=> t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
  const fx = f(X/Xn), fy=f(Y/Yn), fz=f(Z/Zn);
  const L = 116*fy - 16;
  const a = 500*(fx - fy);
  const b = 200*(fy - fz);
  return {L,a,b};
}
function rgbToLab(r,g,b){
  const {X,Y,Z} = rgbToXyz(r,g,b);
  const lab = xyzToLab(X,Y,Z);
  return lab;
}

// ΔE2000 implementation (approx but solid for UI)
function deg2rad(d){return d*Math.PI/180}
function rad2deg(r){return r*180/Math.PI}
function deltaE2000(l1,l2){
  const L1=l1.L,a1=l1.a,b1=l1.b;
  const L2=l2.L,a2=l2.a,b2=l2.b;

  const kL=1,kC=1,kH=1;
  const C1=Math.hypot(a1,b1);
  const C2=Math.hypot(a2,b2);
  const Cb=(C1+C2)/2;
  const G=0.5*(1-Math.sqrt(Math.pow(Cb,7)/(Math.pow(Cb,7)+Math.pow(25,7))));
  const a1p=(1+G)*a1;
  const a2p=(1+G)*a2;
  const C1p=Math.hypot(a1p,b1);
  const C2p=Math.hypot(a2p,b2);
  const h1p=(Math.atan2(b1,a1p)+2*Math.PI)%(2*Math.PI);
  const h2p=(Math.atan2(b2,a2p)+2*Math.PI)%(2*Math.PI);

  const dLp=L2-L1;
  const dCp=C2p-C1p;

  let dhp=h2p-h1p;
  if (C1p*C2p===0) dhp=0;
  else{
    if (dhp>Math.PI) dhp-=2*Math.PI;
    if (dhp<-Math.PI) dhp+=2*Math.PI;
  }
  const dHp=2*Math.sqrt(C1p*C2p)*Math.sin(dhp/2);

  const Lbp=(L1+L2)/2;
  const Cbp=(C1p+C2p)/2;

  let hbp;
  if (C1p*C2p===0) hbp=h1p+h2p;
  else{
    const hsum=h1p+h2p;
    if (Math.abs(h1p-h2p)>Math.PI){
      hbp=(hsum+2*Math.PI)/2;
    }else hbp=hsum/2;
  }

  const T=1
    -0.17*Math.cos(hbp-deg2rad(30))
    +0.24*Math.cos(2*hbp)
    +0.32*Math.cos(3*hbp+deg2rad(6))
    -0.20*Math.cos(4*hbp-deg2rad(63));

  const dRo=30*Math.exp(-Math.pow((rad2deg(hbp)-275)/25,2));
  const Rc=2*Math.sqrt(Math.pow(Cbp,7)/(Math.pow(Cbp,7)+Math.pow(25,7)));
  const Sl=1 + (0.015*Math.pow(Lbp-50,2))/Math.sqrt(20+Math.pow(Lbp-50,2));
  const Sc=1 + 0.045*Cbp;
  const Sh=1 + 0.015*Cbp*T;
  const Rt= -Math.sin(deg2rad(2*dRo))*Rc;

  const dE = Math.sqrt(
    Math.pow(dLp/(kL*Sl),2) +
    Math.pow(dCp/(kC*Sc),2) +
    Math.pow(dHp/(kH*Sh),2) +
    Rt*(dCp/(kC*Sc))*(dHp/(kH*Sh))
  );
  return dE;
}

// Tone score 0-100 from ΔE (smaller ΔE => higher score)
function toneScoreFromDeltaE(de){
  // heuristic: ΔE 0 => 100, ΔE 20 => ~70, ΔE 50 => ~40
  const score = 100 * Math.exp(-de/45);
  return clamp(Math.round(score), 0, 100);
}
function toneLabelFromScore(s){
  if (s>=88) return {txt:'Accord élégant', kind:'good'};
  if (s>=70) return {txt:'Harmonie subtile', kind:'mid'};
  if (s>=55) return {txt:'Différence marquée', kind:'warn'};
  return {txt:'Contraste fort', kind:'bad'};
}

function loadLS(key, fallback){
  try{ const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }catch{ return fallback; }
}
function saveLS(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function formatDate(ts){
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'});
}

// -------------------- Navigation
function showView(id){
  $$('.view').forEach(v=>v.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo({top:0, behavior:'instant'});
  refreshCounts();
  if(id==='#viewMyColors') renderMyColors();
  if(id==='#viewSavedImages') renderSavedImages();
  if(id==='#viewDressing') renderDressing();
}
$$('[data-nav]').forEach(b=>b.addEventListener('click', ()=>showView('#viewHome')));

// -------------------- Canvas / Pipette
const canvas = $('#imgCanvas');
const ctx = canvas.getContext('2d', {willReadFrequently:true});
const crosshair = $('#crosshair');

function fitCanvasToImage(img){
  const stageW = canvas.parentElement.clientWidth;
  const ratio = img.height / img.width;
  const w = Math.max(1, Math.round(stageW));
  const h = Math.max(1, Math.round(w * ratio));
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  drawImage();
}

function drawImage(){
  if(!state.img) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(state.img, 0,0, canvas.width, canvas.height);
  // crosshair position
  const x = state.pos.x * canvas.width;
  const y = state.pos.y * canvas.height;
  crosshair.style.left = `${x}px`;
  crosshair.style.top = `${y}px`;
  sampleAt(x,y);
}

function sampleAt(x,y){
  const size = state.sampleSize;
  const half = Math.floor(size/2);
  const sx = clamp(Math.round(x)-half, 0, canvas.width-1);
  const sy = clamp(Math.round(y)-half, 0, canvas.height-1);
  const sw = clamp(size, 1, canvas.width - sx);
  const sh = clamp(size, 1, canvas.height - sy);

  const data = ctx.getImageData(sx, sy, sw, sh).data;
  let r=0,g=0,b=0, n=0;
  for(let i=0;i<data.length;i+=4){
    r += data[i]; g += data[i+1]; b += data[i+2]; n++;
  }
  r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
  let rgb = {r,g,b};
  if(state.warm) rgb = applyWarm(rgb, 0.18);

  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  state.live = { ...rgb, hex };

  // If A/B not locked, they follow live (preview)
  if(!state.A.locked){ state.A.rgb = rgb; state.A.hex = hex; }
  if(!state.B.locked){ state.B.rgb = rgb; state.B.hex = hex; }

  renderLive();
  renderAB();
  renderTone();
}

function setDragHandlers(stageEl, onMove){
  let dragging=false;
  const getXY = (ev)=>{
    const rect = stageEl.getBoundingClientRect();
    const t = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    const x = clamp(t.clientX - rect.left, 0, rect.width);
    const y = clamp(t.clientY - rect.top, 0, rect.height);
    return {x,y, rect};
  };
  stageEl.addEventListener('pointerdown', (e)=>{ dragging=true; stageEl.setPointerCapture(e.pointerId); const {x,y,rect}=getXY(e); onMove(x,y,rect); });
  stageEl.addEventListener('pointermove', (e)=>{ if(!dragging) return; const {x,y,rect}=getXY(e); onMove(x,y,rect); });
  stageEl.addEventListener('pointerup', ()=> dragging=false);
}

setDragHandlers(canvas, (x,y,rect)=>{
  state.pos.x = x / rect.width;
  state.pos.y = y / rect.height;
  drawImage();
});

// -------------------- UI rendering
function renderLive(){
  $('#liveSwatch').style.background = state.live.hex;
  $('#liveHex').textContent = state.live.hex;
  $('#liveRgb').textContent = `RGB ${state.live.r}, ${state.live.g}, ${state.live.b}`;
  const lab = rgbToLab(state.live.r, state.live.g, state.live.b);
  $('#liveLab').textContent = state.showLab ? `LAB ${lab.L.toFixed(1)}, ${lab.a.toFixed(1)}, ${lab.b.toFixed(1)}` : '';
  $('#liveLab').style.display = state.showLab ? 'block' : 'none';

  // quality (very rough heuristic based on saturation/brightness)
  const v = (state.live.r + state.live.g + state.live.b) / 3;
  const sat = Math.max(state.live.r,state.live.g,state.live.b) - Math.min(state.live.r,state.live.g,state.live.b);
  let q='Good', cls='pill';
  if(sat>80 && v>35 && v<235) q='Excellent';
  else if(v<25 || v>245) q='OK';
  $('#qualityPill').textContent = q;
}

function renderAB(){
  $('#hexA').textContent = state.A.hex ? state.A.hex : '—';
  $('#hexB').textContent = state.B.hex ? state.B.hex : '—';
  $('#colorA').style.background = state.A.hex ?? 'transparent';
  $('#colorB').style.background = state.B.hex ?? 'transparent';

  $('#btnLockA').textContent = state.A.locked ? 'Déverrouiller A' : 'Verrouiller A';
  $('#btnLockB').textContent = state.B.locked ? 'Déverrouiller B' : 'Verrouiller B';

  // Compact UI option
  document.body.classList.toggle('compact', !!state.compact);
}

function renderTone(){
  const on = $('#toggleTone').checked;
  $('#toneDisabled').hidden = on;
  $('#toneEnabled').hidden = !on;
  if(!on) return;

  if(!state.A.hex || !state.B.hex){
    $('#toneScore').textContent = '—%';
    $('#toneLabel').textContent = 'Sélectionnez A et B';
    $('#deltaE').textContent = '—';
    return;
  }
  const labA = rgbToLab(state.A.rgb.r, state.A.rgb.g, state.A.rgb.b);
  const labB = rgbToLab(state.B.rgb.r, state.B.rgb.g, state.B.rgb.b);
  const de = deltaE2000(labA, labB);
  const score = toneScoreFromDeltaE(de);
  const label = toneLabelFromScore(score);

  $('#toneScore').textContent = `${score}%`;
  $('#toneLabel').textContent = label.txt;
  $('#deltaE').textContent = de.toFixed(2);
}

function refreshCounts(){
  const imgs = loadLS(LS.images, []);
  const cols = loadLS(LS.colors, []);
  const dr = loadLS(LS.dressing, []);
  $('#savedImagesCount').textContent = `${imgs.length} image${imgs.length>1?'s':''}`;
  $('#myColorsCount').textContent = `${cols.length} couleur${cols.length>1?'s':''}`;
  $('#dressingCount').textContent = `${dr.length} pièce${dr.length>1?'s':''}`;
}

// -------------------- Actions (Picker)
$('#toggleWarm').addEventListener('change', (e)=>{
  state.warm = e.target.checked;
  $('#lightModeTxt').textContent = state.warm ? 'chaude' : 'neutre';
  drawImage();
});
$('#toggleTone').addEventListener('change', ()=>renderTone());

$('#btnLockA').addEventListener('click', ()=>{
  state.A.locked = !state.A.locked;
  // when locking, keep current A; when unlocking, it will follow live again
  renderAB();
  renderTone();
});
$('#btnLockB').addEventListener('click', ()=>{
  state.B.locked = !state.B.locked;
  renderAB();
  renderTone();
});

$('#btnSwap').addEventListener('click', ()=>{
  const tmp = JSON.parse(JSON.stringify(state.A));
  state.A = JSON.parse(JSON.stringify(state.B));
  state.B = tmp;
  renderAB(); renderTone();
});

$('#btnSaveToMyColors').addEventListener('click', ()=>{
  // Save locked colors if locked, else save current live as one color.
  const now = Date.now();
  const colors = loadLS(LS.colors, []);
  const toAdd = [];
  if(state.A.hex) toAdd.push({hex: state.A.hex, ts: now});
  if(state.B.hex && state.B.hex !== state.A.hex) toAdd.push({hex: state.B.hex, ts: now});
  if(toAdd.length===0) return alert('Aucune couleur à sauvegarder.');
  const merged = [...toAdd, ...colors].slice(0, 200);
  saveLS(LS.colors, merged);
  alert('Ajouté dans Mes couleurs ✅');
  refreshCounts();
});

$('#btnAddToDressing').addEventListener('click', ()=> openDressingModalFromCurrent());

// Change image
$('#btnPickImage').addEventListener('click', ()=>$('#fileInput').click());
$('#btnChangeImage').addEventListener('click', ()=>$('#fileInput').click());
$('#fileInput').addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  await loadImageFromFile(file);
  showView('#viewPicker');
  e.target.value = '';
});

// Load image helper
function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
async function loadImageFromFile(file){
  const url = await fileToDataUrl(file);
  const img = new Image();
  img.crossOrigin='anonymous';
  await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=url; });
  state.img = img;
  state.A.locked=false; state.B.locked=false;
  state.pos = {x:0.72, y:0.45};
  fitCanvasToImage(img);
  drawImage();
  // Save image into "saved images" automatically (so it exists for later)
  const saved = loadLS(LS.images, []);
  saved.unshift({id: crypto.randomUUID(), ts: Date.now(), title: 'Image', dataUrl: url, A:null, B:null});
  saveLS(LS.images, saved.slice(0, 50));
  refreshCounts();
}

// -------------------- Saved Images
$('#btnSavedImages').addEventListener('click', ()=>showView('#viewSavedImages'));
function renderSavedImages(){
  const list = $('#savedImagesList');
  list.innerHTML='';
  const items = loadLS(LS.images, []);
  $('#savedImagesEmpty').hidden = items.length>0;
  items.forEach(it=>{
    const el = document.createElement('div');
    el.className='item';
    el.innerHTML = `
      <div class="thumb" style="background-image:url('${it.dataUrl}')"></div>
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(it.title || 'Image')}</div>
        <div class="itemSub">${formatDate(it.ts)}</div>
        <div class="paletteRow">
          ${(it.A?`<span class="pSw" style="background:${it.A}"></span>`:'')}
          ${(it.B?`<span class="pSw" style="background:${it.B}"></span>`:'')}
        </div>
      </div>
      <div class="itemActions">
        <button class="smallBtn" data-open="${it.id}">Ouvrir</button>
        <button class="smallBtn danger" data-del="${it.id}">Supprimer</button>
      </div>
    `;
    list.appendChild(el);
  });

  list.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click', async ()=>{
    const id = b.getAttribute('data-open');
    const items = loadLS(LS.images, []);
    const it = items.find(x=>x.id===id);
    if(!it) return;
    const img = new Image();
    await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=it.dataUrl; });
    state.img=img;
    state.A = {locked: !!it.A, rgb: it.A?hexToRgb(it.A):null, hex: it.A||null};
    state.B = {locked: !!it.B, rgb: it.B?hexToRgb(it.B):null, hex: it.B||null};
    fitCanvasToImage(img);
    drawImage();
    showView('#viewPicker');
  }));

  list.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>{
    const id = b.getAttribute('data-del');
    let items = loadLS(LS.images, []);
    items = items.filter(x=>x.id!==id);
    saveLS(LS.images, items);
    renderSavedImages();
    refreshCounts();
  }));
}

// -------------------- My Colors (band aesthetic)
$('#btnMyColors').addEventListener('click', ()=>showView('#viewMyColors'));
function renderMyColors(){
  const band = $('#myColorsBand');
  band.innerHTML='';
  const colors = loadLS(LS.colors, []);
  $('#myColorsEmpty').hidden = colors.length>0;
  colors.forEach((c, idx)=>{
    const el = document.createElement('div');
    el.className='bandItem';
    el.style.background = `linear-gradient(90deg, ${c.hex} 0%, rgba(255,255,255,.03) 55%)`;
    el.innerHTML = `
      <div class="bandLeft">
        <div class="bandSw" style="background:${c.hex}"></div>
        <div class="bandTxt">
          <div class="mono">${c.hex}</div>
          <div class="muted">${formatDate(c.ts)}</div>
        </div>
      </div>
      <button class="ghost dangerTxt" data-del-color="${idx}">Supprimer</button>
    `;
    band.appendChild(el);
  });

  band.querySelectorAll('[data-del-color]').forEach(btn=>btn.addEventListener('click', ()=>{
    const i = parseInt(btn.getAttribute('data-del-color'),10);
    const colors = loadLS(LS.colors, []);
    colors.splice(i,1);
    saveLS(LS.colors, colors);
    renderMyColors();
    refreshCounts();
  }));
}

// -------------------- Dressing
$('#btnDressing').addEventListener('click', ()=>showView('#viewDressing'));
$('#btnAddDressingItem').addEventListener('click', ()=>$('#fileInputDressing').click());
$('#fileInputDressing').addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  const dataUrl = await fileToDataUrl(file);
  openDressingModal(dataUrl, null);
  e.target.value='';
});

function renderDressing(){
  const list = $('#dressingList');
  list.innerHTML='';
  const items = loadLS(LS.dressing, []);
  $('#dressingEmpty').hidden = items.length>0;
  items.forEach(it=>{
    const el = document.createElement('div');
    el.className='item';
    el.innerHTML = `
      <div class="thumb" style="background-image:url('${it.dataUrl}')"></div>
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(it.title || 'Article')}</div>
        <div class="itemSub">${formatDate(it.ts)}</div>
        <div class="paletteRow">
          ${(it.P && it.useP)?`<span class="pSw" style="background:${it.P}"></span>`:''}
          ${(it.S && it.useS)?`<span class="pSw" style="background:${it.S}"></span>`:''}
          ${(it.Acc && it.useA)?`<span class="pSw" style="background:${it.Acc}"></span>`:''}
        </div>
      </div>
      <div class="itemActions">
        <button class="smallBtn" data-edit="${it.id}">Ouvrir</button>
        <button class="smallBtn danger" data-del="${it.id}">Supprimer</button>
      </div>
    `;
    list.appendChild(el);
  });

  list.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ()=>{
    const id = b.getAttribute('data-edit');
    const items = loadLS(LS.dressing, []);
    const it = items.find(x=>x.id===id);
    if(!it) return;
    openDressingModal(it.dataUrl, it);
  }));

  list.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>{
    const id = b.getAttribute('data-del');
    let items = loadLS(LS.dressing, []);
    items = items.filter(x=>x.id!==id);
    saveLS(LS.dressing, items);
    renderDressing();
    refreshCounts();
  }));
}

// -------------------- Settings
$('#btnSettings').addEventListener('click', ()=>showView('#viewSettings'));
$('#sampleSize').addEventListener('input', (e)=>{
  state.sampleSize = parseInt(e.target.value,10);
  $('#sampleSizeLbl').textContent = state.sampleSize;
  saveSettings();
  if(state.img) drawImage();
});
$('#toggleLab').addEventListener('change', (e)=>{
  state.showLab = e.target.checked;
  saveSettings();
  renderLive();
});
$('#toggleCompact').addEventListener('change', (e)=>{
  state.compact = e.target.checked;
  saveSettings();
  renderAB();
});
$('#btnResetAll').addEventListener('click', ()=>{
  if(!confirm('Tout effacer ?')) return;
  localStorage.removeItem(LS.colors);
  localStorage.removeItem(LS.dressing);
  localStorage.removeItem(LS.images);
  refreshCounts();
  alert('Réinitialisé ✅');
  showView('#viewHome');
});

function loadSettings(){
  const s = loadLS(LS.settings, null);
  if(!s) return;
  state.sampleSize = s.sampleSize ?? state.sampleSize;
  state.showLab = s.showLab ?? state.showLab;
  state.compact = s.compact ?? state.compact;
  $('#sampleSize').value = state.sampleSize;
  $('#sampleSizeLbl').textContent = state.sampleSize;
  $('#toggleLab').checked = !!state.showLab;
  $('#toggleCompact').checked = !!state.compact;
}
function saveSettings(){
  saveLS(LS.settings, {sampleSize: state.sampleSize, showLab: state.showLab, compact: state.compact});
}

// -------------------- Dressing Modal with optional detection
const modal = $('#modal');
const modalCanvas = $('#modalCanvas');
const mctx = modalCanvas.getContext('2d', {willReadFrequently:true});
const modalCrosshair = $('#modalCrosshair');

function openDressingModalFromCurrent(){
  if(!state.img) return alert('Chargez une image d’abord.');
  // Use current image as dataURL
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  openDressingModal(dataUrl, null);
}
function openDressingModal(dataUrl, existing){
  modal.hidden = false;
  state.modal.open = true;
  state.modal.editingId = existing?.id ?? null;
  $('#itemName').value = existing?.title ?? '';
  $('#toggleDetect').checked = false;
  state.modal.detect = false;

  state.modal.P = existing?.P ?? null;
  state.modal.S = existing?.S ?? null;
  state.modal.Acc = existing?.Acc ?? null;
  $('#useP').checked = existing?.useP ?? true;
  $('#useS').checked = existing?.useS ?? true;
  $('#useA').checked = existing?.useA ?? true;
  renderTriDots();

  // load image
  const img = new Image();
  img.onload = ()=>{
    state.modal.img = img;
    const stageW = modalCanvas.parentElement.clientWidth;
    const ratio = img.height / img.width;
    const w = Math.max(1, Math.round(stageW));
    const h = Math.max(1, Math.round(w * ratio));
    modalCanvas.width = w;
    modalCanvas.height = h;
    mctx.drawImage(img, 0,0,w,h);
    // set default crosshair center
    state.modal.pos = {x:0.6,y:0.5};
    drawModal();
  };
  img.src = dataUrl;
  state.modal.dataUrl = dataUrl;
}

function closeModal(){
  modal.hidden = true;
  state.modal.open = false;
}
$('#modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });

function drawModal(){
  if(!state.modal.img) return;
  mctx.clearRect(0,0,modalCanvas.width,modalCanvas.height);
  mctx.drawImage(state.modal.img, 0,0, modalCanvas.width, modalCanvas.height);
  const x = state.modal.pos.x * modalCanvas.width;
  const y = state.modal.pos.y * modalCanvas.height;
  modalCrosshair.style.left = `${x}px`;
  modalCrosshair.style.top = `${y}px`;
  if(state.modal.detect) sampleModalAt(x,y);
}

function sampleModalAt(x,y){
  const size = state.sampleSize;
  const half = Math.floor(size/2);
  const sx = clamp(Math.round(x)-half, 0, modalCanvas.width-1);
  const sy = clamp(Math.round(y)-half, 0, modalCanvas.height-1);
  const sw = clamp(size, 1, modalCanvas.width - sx);
  const sh = clamp(size, 1, modalCanvas.height - sy);
  const data = mctx.getImageData(sx, sy, sw, sh).data;
  let r=0,g=0,b=0,n=0;
  for(let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++; }
  r=Math.round(r/n); g=Math.round(g/n); b=Math.round(b/n);
  state.modal.live = {r,g,b, hex: rgbToHex(r,g,b)};
}

setDragHandlers(modalCanvas, (x,y,rect)=>{
  state.modal.pos.x = x / rect.width;
  state.modal.pos.y = y / rect.height;
  drawModal();
});

$('#toggleDetect').addEventListener('change', (e)=>{
  state.modal.detect = e.target.checked;
  $('#modalStage').style.opacity = state.modal.detect ? '1' : '0.65';
  drawModal();
});

function setTri(which){
  if(!state.modal.detect || !state.modal.live){
    alert('Activez “Détection couleur” puis touchez l’image.');
    return;
  }
  const hex = state.modal.live.hex;
  if(which==='P') state.modal.P = hex;
  if(which==='S') state.modal.S = hex;
  if(which==='A') state.modal.Acc = hex;
  renderTriDots();
}
$('#btnSetPrimary').addEventListener('click', ()=>setTri('P'));
$('#btnSetSecondary').addEventListener('click', ()=>setTri('S'));
$('#btnSetAccent').addEventListener('click', ()=>setTri('A'));

function renderTriDots(){
  $('#dotP').style.background = state.modal.P ?? 'transparent';
  $('#dotS').style.background = state.modal.S ?? 'transparent';
  $('#dotA').style.background = state.modal.Acc ?? 'transparent';
}
$('#rmP').addEventListener('click', ()=>{ state.modal.P=null; renderTriDots(); });
$('#rmS').addEventListener('click', ()=>{ state.modal.S=null; renderTriDots(); });
$('#rmA').addEventListener('click', ()=>{ state.modal.Acc=null; renderTriDots(); });

$('#btnSaveDressing').addEventListener('click', ()=>{
  const title = $('#itemName').value.trim() || 'Article';
  const now = Date.now();
  const items = loadLS(LS.dressing, []);
  const obj = {
    id: state.modal.editingId ?? crypto.randomUUID(),
    ts: state.modal.editingId ? (items.find(x=>x.id===state.modal.editingId)?.ts ?? now) : now,
    title,
    dataUrl: state.modal.dataUrl,
    P: state.modal.P,
    S: state.modal.S,
    Acc: state.modal.Acc,
    useP: $('#useP').checked,
    useS: $('#useS').checked,
    useA: $('#useA').checked
  };
  const idx = items.findIndex(x=>x.id===obj.id);
  if(idx>=0) items[idx]=obj;
  else items.unshift(obj);
  saveLS(LS.dressing, items.slice(0, 120));
  closeModal();
  alert('Dressing sauvegardé ✅');
  refreshCounts();
});

// -------------------- Install prompt (PWA)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#installBtn').hidden = true;
});

// -------------------- Boot
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

$('#year').textContent = new Date().getFullYear();

loadSettings();
refreshCounts();

// Register service worker
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}

// Home buttons
$('#btnDressing').addEventListener('click', ()=>showView('#viewDressing'));

// Start blank: show home
showView('#viewHome');
