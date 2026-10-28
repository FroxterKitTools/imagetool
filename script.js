(() => {
  const $ = id => document.getElementById(id);
  const el = {
    app: $('app'), stage: $('stage'), drop: $('drop'), file: $('file'),
    before: $('before'), after: $('after'), fname: $('fname'),
    radius: $('radius'), radiusNum: $('radiusNum'), maxRadius: $('maxRadius'),
    margin: $('margin'), marginNum: $('marginNum'),
    color: $('color'), hex: $('hex'), hexErr: $('hexErr'), colorRow: $('colorRow'),
    download: $('download'), replace: $('replace'),
    outInfo: $('outInfo'), outInfo2: $('outInfo2'), srcInfo: $('srcInfo')
  };
  const ctx = el.after.getContext('2d');

  const state = { img: null, name: 'image', radius: 40, margin: 0, solid: false, color: '#ffffff' };
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
    ctx.drawImage(img, m, m, w, h);
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

  /* ---------- Export ---------- */
  el.download.addEventListener('click', () => {
    if (!state.img) return;
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
