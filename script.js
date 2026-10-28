(() => {
  const $ = id => document.getElementById(id);
  const el = {
    app: $('app'), stage: $('stage'), drop: $('drop'), file: $('file'),
    before: $('before'), after: $('after'), fname: $('fname'),
    radius: $('radius'), radiusNum: $('radiusNum'), maxRadius: $('maxRadius'),
    margin: $('margin'), marginNum: $('marginNum'),
    color: $('color'), hex: $('hex'), hexErr: $('hexErr'), colorRow: $('colorRow'),
    download: $('download'), replace: $('replace'),
    outInfo: $('outInfo'), outInfo2: $('outInfo2'), srcInfo: $('srcInfo'),
    rbOn: $('rbOn'), rb: $('rb'), swatch: $('swatch'), autoPick: $('autoPick'),
    tol: $('tol'), tolNum: $('tolNum'), soft: $('soft'), softNum: $('softNum'),
    contig: $('contig'), rbStatus: $('rbStatus'),
    cropWrap: $('cropWrap'), cropBox: $('cropBox'), sel: $('sel'), cc: $('cc'),
    cropBtn: $('cropBtn'), cropReset: $('cropReset'), cropRatio: $('cropRatio'),
    cropApply: $('cropApply'), cropCancel: $('cropCancel'), cropInfo: $('cropInfo')
  };
  const ctx = el.after.getContext('2d');

  const state = {
    img: null, name: 'image', radius: 40, margin: 0, solid: false, color: '#ffffff',
    rb: false, key: null, tol: 20, soft: 8, contig: true, src: null, cut: null,
    origUrl: null, cropActive: false, crop: null
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ---------- Loading an image ---------- */
  function loadFile(file) {
    if (!file || !/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      alert('Unsupported file. Choose a PNG, JPG or WEBP image.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.img = img;
      state.src = null; state.cut = null; state.key = null; // reset background-removal cache
      state.origUrl = url; exitCrop(); el.cropBtn.disabled = false; el.cropReset.hidden = true;
      if (state.rb) autoKey();
      state.name = file.name.replace(/\.[^.]+$/, '') || 'image';
      el.before.src = url; // keep URL alive for the preview
      el.fname.textContent = file.name;
      el.srcInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
      el.stage.classList.add('has-img');
      el.download.disabled = false;
      syncLimits();
      render();
    };
    img.onerror = () => alert('That image could not be read. Try a different file.');
    img.src = url;
  }

  /* Radius can't usefully exceed half the shorter side; margin is capped to keep the canvas sane. */
  function maxRadius() { return state.img ? Math.floor(Math.min(state.img.naturalWidth, state.img.naturalHeight) / 2) : 200; }
  function syncLimits() {
    const mr = maxRadius();
    el.radius.max = mr; el.radiusNum.max = mr;
    const mm = state.img ? Math.floor(Math.max(state.img.naturalWidth, state.img.naturalHeight) / 2) : 200;
    el.margin.max = mm; el.marginNum.max = mm;
    setRadius(state.radius, false); setMargin(state.margin, false);
  }

  /* ---------- Drawing ---------- */
  // Rounded-rect path using arcTo (works in every browser).
  function roundedPath(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  let raf = 0;
  function render() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }

  function draw() {
    const img = state.img; if (!img) return;
    const w = img.naturalWidth, h = img.naturalHeight, m = state.margin;
    el.after.width = w + m * 2;
    el.after.height = h + m * 2;
    ctx.clearRect(0, 0, el.after.width, el.after.height);

    if (state.solid) {                       // background fill outside the corners
      ctx.fillStyle = state.color;
      ctx.fillRect(0, 0, el.after.width, el.after.height);
    }
    ctx.save();
    roundedPath(ctx, m, m, w, h, state.radius);
    ctx.clip();                              // everything drawn next is cut to the rounded shape
    ctx.drawImage(state.rb && state.cut ? state.cut : img, m, m, w, h);
    ctx.restore();

    const dims = `${el.after.width} × ${el.after.height}`;
    el.outInfo2.textContent = dims;
    el.outInfo.textContent = `Output: ${dims} px, PNG${state.solid ? '' : ' with transparency'}`;
  }

  /* ---------- Control wiring ---------- */
  function setRadius(v, redraw = true) {
    v = clamp(Math.round(Number(v) || 0), 0, maxRadius());
    state.radius = v; el.radius.value = v; el.radiusNum.value = v;
    if (redraw) render();
  }
  function setMargin(v, redraw = true) {
    const max = Number(el.margin.max) || 200;
    v = clamp(Math.round(Number(v) || 0), 0, max);
    state.margin = v; el.margin.value = v; el.marginNum.value = v;
    if (redraw) render();
  }
  el.radius.addEventListener('input', e => setRadius(e.target.value));
  el.radiusNum.addEventListener('input', e => setRadius(e.target.value));
  el.margin.addEventListener('input', e => setMargin(e.target.value));
  el.marginNum.addEventListener('input', e => setMargin(e.target.value));
  el.maxRadius.addEventListener('click', () => setRadius(maxRadius()));

  document.querySelectorAll('input[name=bg]').forEach(r => r.addEventListener('change', () => {
    state.solid = r.value === 'solid' && r.checked ? true : (r.checked ? false : state.solid);
    el.colorRow.classList.toggle('off', !state.solid);
    render();
  }));

  // Accepts #rgb or #rrggbb, and also "rgb(r, g, b)" typed by hand.
  function parseColor(str) {
    str = str.trim();
    let m = str.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      return '#' + h.toLowerCase();
    }
    m = str.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (m && [1, 2, 3].every(i => +m[i] <= 255)) {
      return '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('');
    }
    return null;
  }
  el.color.addEventListener('input', e => {
    state.color = e.target.value; el.hex.value = e.target.value; el.hexErr.textContent = ''; render();
  });
  el.hex.addEventListener('input', e => {
    const c = parseColor(e.target.value);
    if (c) { state.color = c; el.color.value = c; el.hexErr.textContent = ''; render(); }
    else el.hexErr.textContent = 'Enter a HEX value like #1a2b3c or rgb(26, 43, 60).';
  });
  el.hex.addEventListener('blur', () => { el.hex.value = state.color; el.hexErr.textContent = ''; });

  /* ---------- Upload: click, drag-and-drop, paste ---------- */
  const pick = () => el.file.click();
  el.drop.addEventListener('click', pick);
  el.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  el.replace.addEventListener('click', pick);
  el.file.addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });

  ['dragenter', 'dragover'].forEach(t => el.stage.addEventListener(t, e => { e.preventDefault(); el.drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => el.stage.addEventListener(t, e => { e.preventDefault(); el.drop.classList.remove('over'); }));
  el.stage.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
  document.addEventListener('paste', e => {
    const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
    if (f) loadFile(f);
  });

  /* ---------- Crop ---------- */
  // The crop box lives in the original image's pixel coordinates; the overlay shows it as percentages.
  let cropRatio = 0, drag = null; // cropRatio = width / height, or 0 for free

  function paintCrop() {
    const W = state.img.naturalWidth, H = state.img.naturalHeight, c = state.crop;
    el.sel.style.left = (c.x / W * 100) + '%';
    el.sel.style.top = (c.y / H * 100) + '%';
    el.sel.style.width = (c.w / W * 100) + '%';
    el.sel.style.height = (c.h / H * 100) + '%';
    el.cropInfo.textContent = `${Math.round(c.w)} × ${Math.round(c.h)} px`;
  }

  // Shrink the current box to the chosen ratio, keeping its center.
  function fitRatio() {
    const c = state.crop;
    let w = c.w, h = w / cropRatio;
    if (h > c.h) { h = c.h; w = h * cropRatio; }
    state.crop = { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h };
  }

  function moveRect(s, dx, dy) {
    const W = state.img.naturalWidth, H = state.img.naturalHeight;
    return { x: clamp(s.x + dx, 0, W - s.w), y: clamp(s.y + dy, 0, H - s.h), w: s.w, h: s.h };
  }

  // hd = handle name such as 'nw', 'e', 's'. s = the box when the drag started.
  function resizeRect(hd, s, dx, dy) {
    const W = state.img.naturalWidth, H = state.img.naturalHeight, MIN = 16, r = cropRatio;
    const hasW = hd.includes('w'), hasE = hd.includes('e'), hasN = hd.includes('n'), hasS = hd.includes('s');
    let L = s.x, T = s.y, R = s.x + s.w, B = s.y + s.h;
    if (hasW) L = clamp(L + dx, 0, R - MIN);
    if (hasE) R = clamp(R + dx, L + MIN, W);
    if (hasN) T = clamp(T + dy, 0, B - MIN);
    if (hasS) B = clamp(B + dy, T + MIN, H);
    if (!r) return { x: L, y: T, w: R - L, h: B - T };

    // Locked ratio: size follows the dragged edge(s); the opposite edge (or the center) stays put.
    const hasX = hasW || hasE, hasY = hasN || hasS;
    let w = R - L, h = B - T;
    if (hasX && hasY) { w = Math.max(w, h * r); h = w / r; }
    else if (hasX) h = w / r;
    else w = h * r;
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const maxW = hasW ? s.x + s.w : hasE ? W - s.x : 2 * Math.min(cx, W - cx);
    const maxH = hasN ? s.y + s.h : hasS ? H - s.y : 2 * Math.min(cy, H - cy);
    const k = Math.min(1, maxW / w, maxH / h);
    w *= k; h *= k;
    if (w < MIN || h < MIN) return s;
    return {
      x: hasW ? s.x + s.w - w : hasE ? s.x : cx - w / 2,
      y: hasN ? s.y + s.h - h : hasS ? s.y : cy - h / 2,
      w, h
    };
  }

  function enterCrop() {
    if (!state.img) return;
    const W = state.img.naturalWidth, H = state.img.naturalHeight;
    state.cropActive = true;
    state.crop = { x: W * .1, y: H * .1, w: W * .8, h: H * .8 };
    if (cropRatio) fitRatio();
    el.cropBox.hidden = false; el.cc.classList.add('on'); el.cropBtn.hidden = true;
    paintCrop();
  }
  function exitCrop() {
    state.cropActive = false; drag = null;
    el.cropBox.hidden = true; el.cc.classList.remove('on'); el.cropBtn.hidden = false;
    el.cropInfo.textContent = '';
  }

  // Swap the working image (cropped version or the original) and refresh everything that depends on it.
  function swapImage(url, cropped) {
    const img = new Image();
    img.onload = () => {
      state.img = img; state.src = null; state.cut = null; state.key = null;
      el.before.src = url;
      el.srcInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
      exitCrop();
      el.cropReset.hidden = !cropped;
      if (state.rb) autoKey();
      syncLimits(); render();
    };
    img.onerror = () => alert('Could not apply the crop. Try a smaller selection.');
    img.src = url;
  }

  function applyCrop() {
    const W = state.img.naturalWidth, H = state.img.naturalHeight, s = state.crop;
    const x = clamp(Math.round(s.x), 0, W - 1), y = clamp(Math.round(s.y), 0, H - 1);
    const w = clamp(Math.round(s.w), 1, W - x), h = clamp(Math.round(s.h), 1, H - y);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(state.img, x, y, w, h, 0, 0, w, h);
    c.toBlob(blob => {
      if (!blob) { alert('Crop failed. The image may be too large for this browser.'); return; }
      swapImage(URL.createObjectURL(blob), true);
    }, 'image/png');
  }

  el.cropBtn.addEventListener('click', enterCrop);
  el.cropApply.addEventListener('click', applyCrop);
  el.cropCancel.addEventListener('click', exitCrop);
  el.cropReset.addEventListener('click', () => { if (state.origUrl) swapImage(state.origUrl, false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.cropActive) exitCrop(); });
  el.cropRatio.addEventListener('change', () => {
    const v = el.cropRatio.value;
    cropRatio = v === 'free' ? 0 : v.split(':').map(Number).reduce((a, b) => a / b);
    if (cropRatio && state.crop) fitRatio();
    if (state.cropActive) paintCrop();
  });

  // Drag the box to move it, or a handle to resize it (mouse, touch and pen).
  el.cropBox.addEventListener('pointerdown', e => {
    if (!state.cropActive) return;
    const handle = e.target.dataset.h;
    if (!handle && e.target !== el.sel) return;
    e.preventDefault();
    el.cropBox.setPointerCapture(e.pointerId);
    const r = el.cropWrap.getBoundingClientRect();
    drag = { mode: handle || 'move', x: e.clientX, y: e.clientY, s: { ...state.crop }, k: state.img.naturalWidth / r.width };
  });
  el.cropBox.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) * drag.k, dy = (e.clientY - drag.y) * drag.k;
    state.crop = drag.mode === 'move' ? moveRect(drag.s, dx, dy) : resizeRect(drag.mode, drag.s, dx, dy);
    paintCrop();
  });
  ['pointerup', 'pointercancel'].forEach(t => el.cropBox.addEventListener(t, () => { drag = null; }));

  /* ---------- Remove background (color-key, runs fully in the browser) ---------- */
  let rbTimer = 0;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // Read the original pixels once per image.
  function getSrc() {
    if (state.src) return state.src;
    const c = document.createElement('canvas');
    c.width = state.img.naturalWidth; c.height = state.img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(state.img, 0, 0);
    state.src = x.getImageData(0, 0, c.width, c.height);
    return state.src;
  }

  function setKey(rgb) {
    state.key = rgb;
    el.swatch.style.background = `rgb(${rgb.join(',')})`;
    scheduleCut();
  }

  // Guess the background: of the four corner pixels, take the one most similar to the others.
  function autoKey() {
    const s = getSrc(), w = s.width, h = s.height, d = s.data;
    const px = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const pts = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
    let best = pts[0], bestSum = Infinity;
    for (const p of pts) {
      const sum = pts.reduce((t, q) => t + dist(p, q), 0);
      if (sum < bestSum) { bestSum = sum; best = p; }
    }
    setKey(best);
  }

  function computeCut() {
    rbTimer = 0;
    if (!state.img || !state.rb || !state.key) return;
    const s = getSrc(), w = s.width, h = s.height, src = s.data, n = w * h;
    const key = state.key;
    const tol = state.tol * 2.2, soft = state.soft, limit = tol + soft, lim2 = limit * limit;
    const out = new ImageData(new Uint8ClampedArray(src), w, h);
    const o = out.data;

    const d2 = i => { const j = i * 4, a = src[j] - key[0], b = src[j + 1] - key[1], c = src[j + 2] - key[2]; return a * a + b * b + c * c; };
    const inRange = i => src[i * 4 + 3] < 10 || d2(i) <= lim2;

    // Turn a matching pixel transparent; pixels inside the softness band become partly transparent
    // and have the background color subtracted so no colored halo is left on the edge.
    function kill(i) {
      const j = i * 4;
      if (src[j + 3] < 10) return;
      const d = Math.sqrt(d2(i));
      const a = d <= tol ? 0 : (d - tol) / soft;
      o[j + 3] = Math.min(o[j + 3], Math.round(a * 255));
      if (a > 0 && a < 1) for (let c = 0; c < 3; c++) o[j + c] = (src[j + c] - (1 - a) * key[c]) / a;
    }

    if (state.contig) {
      // Flood fill inward from the border so only background connected to the edges is removed.
      const seen = new Uint8Array(n), q = new Int32Array(n);
      let head = 0, tail = 0;
      const push = i => { if (!seen[i] && inRange(i)) { seen[i] = 1; q[tail++] = i; } };
      for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (head < tail) {
        const i = q[head++], x = i % w, y = (i / w) | 0;
        kill(i);
        if (x > 0) push(i - 1);
        if (x < w - 1) push(i + 1);
        if (y > 0) push(i - w);
        if (y < h - 1) push(i + w);
      }
    } else {
      for (let i = 0; i < n; i++) if (inRange(i)) kill(i); // remove this color everywhere
    }

    const c = state.cut || document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').putImageData(out, 0, 0);
    state.cut = c;
    el.rbStatus.textContent = 'Works best on plain, evenly lit backgrounds.';
    render();
  }

  // Debounce so dragging a slider on a large image stays responsive.
  function scheduleCut() {
    if (!state.rb || !state.img || !state.key) return;
    el.rbStatus.textContent = 'Processing…';
    clearTimeout(rbTimer);
    rbTimer = setTimeout(computeCut, 150);
  }
  function flushRb() { if (rbTimer) { clearTimeout(rbTimer); computeCut(); } }

  el.rbOn.addEventListener('change', () => {
    state.rb = el.rbOn.checked;
    el.rb.classList.toggle('on', state.rb);
    el.stage.classList.toggle('picking', state.rb);
    if (state.rb && state.img) { state.key ? scheduleCut() : autoKey(); } else render();
  });
  function bindPair(range, num, prop, max) {
    const set = v => {
      v = clamp(Math.round(Number(v) || 0), 0, max);
      state[prop] = v; range.value = v; num.value = v;
      scheduleCut();
    };
    range.addEventListener('input', e => set(e.target.value));
    num.addEventListener('input', e => set(e.target.value));
  }
  bindPair(el.tol, el.tolNum, 'tol', 100);
  bindPair(el.soft, el.softNum, 'soft', 40);
  el.contig.addEventListener('change', () => { state.contig = el.contig.checked; scheduleCut(); });
  el.autoPick.addEventListener('click', () => { if (state.img) autoKey(); });

  // Click the original image to choose the color to remove.
  el.before.addEventListener('click', e => {
    if (!state.rb || !state.img) return;
    const r = el.before.getBoundingClientRect(), s = getSrc();
    const x = clamp(Math.floor((e.clientX - r.left) / r.width * s.width), 0, s.width - 1);
    const y = clamp(Math.floor((e.clientY - r.top) / r.height * s.height), 0, s.height - 1);
    const i = (y * s.width + x) * 4;
    setKey([s.data[i], s.data[i + 1], s.data[i + 2]]);
  });

  /* ---------- Export ---------- */
  el.download.addEventListener('click', () => {
    if (!state.img) return;
    flushRb(); // finish any pending background removal
    draw(); // make sure the canvas reflects the latest settings at full resolution
    el.after.toBlob(blob => {
      if (!blob) { alert('Export failed. The image may be too large for this browser.'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${state.name}-rounded.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  });
})();
