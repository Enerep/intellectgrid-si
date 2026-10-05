/* A small, dependency-free 3D renderer using the native Canvas 2D API. */
(() => {
  'use strict';
  const canvas = document.querySelector('#scene');
  const wrap = document.querySelector('#scene-wrap');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const globe = window.SITE_CONFIG.scene === 'globe';
  const accent = globe ? [179, 220, 243] : [212, 239, 155];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('#motion-toggle');
  let width = 1, height = 1, radius = 1, cx = 0, cy = 0;
  let rotation = globe ? -0.28 : 0.3, tilt = globe ? 0.12 : 0.2;
  let pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
  let paused = reduced.matches, visible = true, frame = 0, lastTime = 0, elapsed = 0;
  let dragging = false, lastPointerX = 0, lastPointerY = 0;
  const rgba = alpha => `rgba(${accent.join(',')},${alpha})`;
  const TAU = Math.PI * 2;
  let seed = 8347;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const nodes = [], edges = [], stars = [];

  for (let i = 0; i < 115; i++) stars.push({ x: random(), y: random(), size: random() * 1.05 + .15, alpha: random() * .35 + .08 });
  if (!globe) {
    for (let i = 0; i < 225; i++) {
      const y = 1 - (i / 224) * 2;
      const r = Math.sqrt(1 - y * y);
      const angle = i * 2.39996323;
      const jitter = .97 + random() * .06;
      nodes.push({ x: Math.cos(angle) * r * jitter, y: y * jitter, z: Math.sin(angle) * r * jitter, size: random() * 1.1 + .6, phase: random() * TAU });
    }
    for (let i = 0; i < 38; i++) {
      const angle = random() * TAU, y = random() * 1.6 - .8, r = Math.sqrt(1 - y * y) * (.35 + random() * .45);
      nodes.push({ x: Math.cos(angle) * r, y, z: Math.sin(angle) * r, size: random() + .4, phase: random() * TAU });
    }
    nodes.forEach((a, i) => {
      nodes.forEach((b, j) => {
        if (i >= j) return;
        const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (distance < .35) edges.push({ a: i, b: j, phase: random(), packet: random() > .94 });
      });
    });
  }
  const land = globe && window.GLOBE_DATA ? window.GLOBE_DATA.points : [];
  const coast = globe && window.GLOBE_DATA ? window.GLOBE_DATA.coast : [];

  function project(point, angle = rotation + smoothX * .12, pitch = tilt + smoothY * .08) {
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const x = point.x * cos + point.z * sin;
    const z = -point.x * sin + point.z * cos;
    const y = point.y * Math.cos(pitch) - z * Math.sin(pitch);
    const zz = point.y * Math.sin(pitch) + z * Math.cos(pitch);
    const perspective = globe ? 1 : 3.8 / (3.8 - zz);
    return { x: cx + x * radius * perspective, y: cy - y * radius * perspective, z: zz, scale: perspective };
  }

  function resize() {
    const rect = wrap.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = width * .53; cy = height * (globe ? .5 : .48);
    radius = Math.min(width * (globe ? .355 : .34), height * (globe ? .36 : .35));
    draw();
  }

  function drawStars() {
    stars.forEach(star => {
      ctx.fillStyle = rgba(star.alpha * (globe ? .75 : .35));
      ctx.beginPath(); ctx.arc(star.x * width, star.y * height, star.size, 0, TAU); ctx.fill();
    });
  }

  function drawNetwork() {
    const halo = ctx.createRadialGradient(cx, cy, radius * .05, cx, cy, radius * 1.65);
    halo.addColorStop(0, 'rgba(128,162,84,.07)'); halo.addColorStop(.45, 'rgba(94,125,48,.035)'); halo.addColorStop(1, 'rgba(94,125,48,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
    const projected = nodes.map(point => project(point));
    edges.forEach(edge => {
      const a = projected[edge.a], b = projected[edge.b];
      const depth = (a.z + b.z + 2) / 4;
      ctx.strokeStyle = rgba(.015 + depth * .19); ctx.lineWidth = .5 + depth * .15;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (edge.packet && depth > .55) {
        const t = (elapsed * .13 + edge.phase) % 1;
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        ctx.fillStyle = rgba(.5 * depth); ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill();
      }
    });
    projected.forEach((point, i) => {
      const depth = (point.z + 1) / 2;
      const pulse = Math.sin(elapsed * .8 + nodes[i].phase) * .12 + .88;
      const size = nodes[i].size * point.scale;
      ctx.fillStyle = rgba((.13 + depth * .65) * pulse);
      ctx.beginPath(); ctx.arc(point.x, point.y, size, 0, TAU); ctx.fill();
      if (depth > .83 && i % 8 === 0) {
        const light = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 12);
        light.addColorStop(0, rgba(.15)); light.addColorStop(1, rgba(0));
        ctx.fillStyle = light; ctx.beginPath(); ctx.arc(point.x, point.y, 12, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f5ffe5'; ctx.beginPath(); ctx.arc(point.x, point.y, 1.1, 0, TAU); ctx.fill();
      }
    });
    ctx.strokeStyle = rgba(.09); ctx.lineWidth = .7;
    [1.12, 1.2].forEach(scale => {
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const angle = (i / 160) * TAU;
        const point = project({ x: Math.cos(angle) * scale, y: Math.sin(angle) * .12, z: Math.sin(angle) * scale }, rotation * .7, -.4);
        if (!i) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    });
  }

  function latLon(lat, lon) {
    const phi = lat * Math.PI / 180, theta = lon * Math.PI / 180;
    return { x: Math.cos(phi) * Math.sin(theta), y: Math.sin(phi), z: Math.cos(phi) * Math.cos(theta) };
  }

  function drawGlobe() {
    const atmosphere = ctx.createRadialGradient(cx, cy, radius * .7, cx, cy, radius * 1.45);
    atmosphere.addColorStop(0, 'rgba(36,107,145,.025)'); atmosphere.addColorStop(.45, 'rgba(48,128,169,.05)'); atmosphere.addColorStop(.64, 'rgba(62,140,182,.025)'); atmosphere.addColorStop(1, 'rgba(21,67,101,0)');
    ctx.fillStyle = atmosphere; ctx.fillRect(0, 0, width, height);
    const sphere = ctx.createRadialGradient(cx - radius * .35, cy - radius * .4, radius * .02, cx, cy, radius * 1.02);
    sphere.addColorStop(0, '#0b202e'); sphere.addColorStop(.6, '#0a1924'); sphere.addColorStop(1, '#09131c');
    ctx.fillStyle = sphere; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.clip();
    // Latitude / longitude arcs are clipped at the front hemisphere.
    ctx.lineWidth = .55;
    function line(points) {
      ctx.beginPath(); let started = false;
      points.forEach(vector => {
        const p = project(vector);
        if (p.z < -.015) { started = false; return; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(129,183,213,.075)';
    for (let lat = -60; lat <= 60; lat += 20) {
      const points = []; for (let lon = -180; lon <= 180; lon += 3) points.push(latLon(lat, lon)); line(points);
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const points = []; for (let lat = -90; lat <= 90; lat += 3) points.push(latLon(lat, lon)); line(points);
    }
    // Accurate land points and coastlines, derived from public-domain Natural Earth data.
    for (let i = 0; i < land.length; i += 3) {
      const point = project({ x: land[i], y: land[i + 1], z: land[i + 2] });
      if (point.z < .015) continue;
      const brightness = .15 + Math.pow(point.z, .65) * .72;
      ctx.fillStyle = rgba(brightness);
      ctx.beginPath(); ctx.arc(point.x, point.y, radius > 180 ? 1.03 : .8, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(172,218,240,.19)'; ctx.lineWidth = .55;
    coast.forEach(outline => {
      ctx.beginPath(); let started = false;
      for (let i = 0; i < outline.length; i += 3) {
        const point = project({ x: outline[i], y: outline[i + 1], z: outline[i + 2] });
        if (point.z < .03) { started = false; continue; }
        if (!started) { ctx.moveTo(point.x, point.y); started = true; } else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    });
    const shine = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    shine.addColorStop(0, 'rgba(175,214,236,.045)'); shine.addColorStop(.6, 'rgba(5,10,15,0)'); shine.addColorStop(1, 'rgba(0,4,10,.4)');
    ctx.fillStyle = shine; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(137,204,240,.17)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(137,204,240,.06)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, radius * 1.015, 0, TAU); ctx.stroke();
    // A small warm beacon contrasts with the cool surface.
    const beacon = project(latLon(46, 14));
    if (beacon.z > .1) {
      const glow = ctx.createRadialGradient(beacon.x, beacon.y, 0, beacon.x, beacon.y, 14);
      glow.addColorStop(0, 'rgba(240,185,121,.32)'); glow.addColorStop(1, 'rgba(240,185,121,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(beacon.x, beacon.y, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f0bb85'; ctx.beginPath(); ctx.arc(beacon.x, beacon.y, 2, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(240,185,121,.45)'; ctx.lineWidth = .65; ctx.beginPath(); ctx.arc(beacon.x, beacon.y, 5, 0, TAU); ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawStars();
    if (globe) drawGlobe(); else drawNetwork();
  }
  function tick(now) {
    frame = 0;
    if (paused || !visible || document.hidden) return;
    if (now - lastTime >= 1000 / 30) {
      const delta = lastTime ? Math.min((now - lastTime) / 1000, .06) : .033;
      elapsed += delta;
      if (!dragging) rotation += delta * (globe ? .045 : .065);
      smoothX += (pointerX - smoothX) * .045; smoothY += (pointerY - smoothY) * .045;
      draw(); lastTime = now;
    }
    frame = requestAnimationFrame(tick);
  }
  function start() { if (!frame && !paused && visible && !document.hidden) { lastTime = 0; frame = requestAnimationFrame(tick); } }
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  function updateToggle() {
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    document.querySelector('#scene-hint').textContent = globe ? 'Drag to rotate' : paused ? 'Motion paused' : 'Move to explore';
  }
  toggle.addEventListener('click', () => { paused = !paused; updateToggle(); if (paused) stop(); else start(); });
  reduced.addEventListener('change', event => { paused = event.matches; updateToggle(); if (paused) { stop(); draw(); } else start(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; if (visible) start(); else stop();
  }, { threshold: 0 }).observe(wrap);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(wrap);
  else window.addEventListener('resize', resize);

  wrap.addEventListener('pointermove', event => {
    const rect = wrap.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / width - .5) * 2;
    pointerY = ((event.clientY - rect.top) / height - .5) * 2;
    if (globe && dragging) {
      rotation += (event.clientX - lastPointerX) * .006;
      tilt = Math.max(-.7, Math.min(.7, tilt + (event.clientY - lastPointerY) * .004));
      lastPointerX = event.clientX; lastPointerY = event.clientY; draw();
    } else if (paused && !reduced.matches && event.pointerType === 'mouse') { smoothX = pointerX; smoothY = pointerY; draw(); }
  });
  wrap.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  if (globe) {
    canvas.style.touchAction = 'pan-y';
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      dragging = true; lastPointerX = event.clientX; lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
    });
    const endDrag = () => { dragging = false; canvas.style.cursor = 'grab'; };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);
    document.querySelectorAll('[data-rotate]').forEach(button => button.addEventListener('click', () => {
      rotation += Number(button.dataset.rotate) * .3; draw();
    }));
  }
  updateToggle(); resize(); start();
})();
