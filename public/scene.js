/* IntellectGrid — a small native WebGL sculpture, drawn from mathematics. */
(() => {
  'use strict';

  const canvas = document.querySelector('#sculpture');
  const stage = document.querySelector('#sculpture-stage');
  if (!canvas || !stage) return;
  const TAU = Math.PI * 2;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)').matches;
  const laneCount = mobile ? 24 : 32;
  const segments = mobile ? 200 : 300;
  const crossSections = 4;
  const shapeNames = ['knot', 'orbit', 'lattice'];
  const state = {
    shape: 'knot', weights: [1, 0, 0], target: [1, 0, 0],
    paused: reducedMotion.matches, tension: 0, tensionTarget: 0,
    yaw: -.4, pitch: -.27, velocityX: 0, velocityY: 0,
    pointerX: 0, pointerY: 0, smoothX: 0, smoothY: 0,
    hold: 0, heldAt: 0, dragging: false, distance: 0, activePointer: null,
    burstTime: -1, time: 0, frame: 0, userAnimation: false,
  };
  let width = 1, height = 1, visible = true, frameRequest = null, previousTime = 0;
  let lastX = 0, lastY = 0;
  let renderer = null, contextLost = false;
  const normalize = a => {
    const magnitude = Math.hypot(a[0], a[1], a[2]) || 1;
    return a.map(value => value / magnitude);
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const rotateX = (p, angle) => [p[0], p[1] * Math.cos(angle) - p[2] * Math.sin(angle), p[1] * Math.sin(angle) + p[2] * Math.cos(angle)];
  const rotateY = (p, angle) => [p[0] * Math.cos(angle) + p[2] * Math.sin(angle), p[1], -p[0] * Math.sin(angle) + p[2] * Math.cos(angle)];

  function knotCenter(t) {
    const radius = 1.07 + .37 * Math.cos(3 * t);
    return [radius * Math.cos(2 * t), .58 * Math.sin(3 * t), radius * Math.sin(2 * t)];
  }

  /* Every form shares the same ribbon topology; only its coordinates change. */
  function point(shape, u, v, lane) {
    const t = u * TAU, phase = lane / laneCount * TAU;
    if (shape === 0) {
      const center = knotCenter(t), next = knotCenter(t + .0001);
      const tangent = normalize(next.map((value, i) => value - center[i]));
      const radial = [Math.cos(2 * t), 0, Math.sin(2 * t)];
      const dot = radial.reduce((sum, value, i) => sum + value * tangent[i], 0);
      const normal = normalize(radial.map((value, i) => value - tangent[i] * dot));
      const binormal = cross(tangent, normal);
      const angle = phase + 2 * t + .25 * Math.sin(3 * t) + v * TAU / laneCount * .425;
      const radius = .29 + .012 * Math.cos(v * Math.PI / 2);
      return center.map((value, i) => value + radius * (Math.cos(angle) * normal[i] + Math.sin(angle) * binormal[i]));
    }
    if (shape === 1) {
      const perBand = laneCount / 4, band = Math.floor(lane / perBand), withinBand = lane % perBand;
      const ribbonRadius = 1.12 + (withinBand - (perBand - 1) / 2) * .061 + v * .025;
      const p = [ribbonRadius * Math.cos(t), ribbonRadius * Math.sin(t), .028 * Math.cos(v * Math.PI / 2) + .025 * Math.sin(3 * t + band)];
      return rotateY(rotateX(p, .31 + band * .79), -.32 + band * .61);
    }
    const vertical = lane % 2 === 1;
    const line = (Math.floor(lane / 2) / (laneCount / 2 - 1) - .5) * 2.54;
    const along = (u - .5) * 3.05, across = line + v * .033;
    const z = .26 * Math.sin(u * TAU * 1.5 + line * 1.2) + .10 * Math.cos(line * 3.4) + (vertical ? .045 : -.045) + .015 * Math.cos(v * Math.PI / 2);
    return vertical ? [across, along, z] : [along, across, z];
  }

  function surfaceNormal(shape, u, v, lane) {
    const a = point(shape, u + .0001, v, lane), b = point(shape, u - .0001, v, lane);
    const c = point(shape, u, v + .001, lane), d = point(shape, u, v - .001, lane);
    return normalize(cross(a.map((value, i) => value - b[i]), c.map((value, i) => value - d[i])));
  }

  function makeGeometry() {
    const count = laneCount * (segments + 1) * (crossSections + 1);
    const positions = [0, 1, 2].map(() => new Float32Array(count * 3));
    const normals = [0, 1, 2].map(() => new Float32Array(count * 3));
    const information = new Float32Array(count * 3);
    const indices = new Uint16Array(laneCount * segments * crossSections * 6);
    let vertex = 0, index = 0;
    for (let lane = 0; lane < laneCount; lane++) {
      for (let step = 0; step <= segments; step++) {
        const u = step / segments;
        for (let crossStep = 0; crossStep <= crossSections; crossStep++) {
          const v = crossStep / crossSections * 2 - 1;
          for (let shape = 0; shape < 3; shape++) {
            positions[shape].set(point(shape, u, v, lane), vertex * 3);
            normals[shape].set(surfaceNormal(shape, u, v, lane), vertex * 3);
          }
          information.set([u, v, lane / laneCount], vertex * 3);
          if (step < segments && crossStep < crossSections) {
            const a = vertex, b = vertex + crossSections + 1;
            indices.set([a, b, a + 1, a + 1, b, b + 1], index); index += 6;
          }
          vertex++;
        }
      }
    }
    return { positions, normals, information, indices };
  }

  function rotationMatrix() {
    const x = state.pitch + state.smoothY * .065, y = state.yaw + state.smoothX * .09, z = -.17;
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    return new Float32Array([
      cy * cz, cy * sz, -sy,
      sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy,
      cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy,
    ]);
  }

  function dispersion() {
    const pulse = state.burstTime >= 0 ? Math.sin(Math.min(1, state.burstTime / 2.15) * Math.PI) ** 1.35 : 0;
    return Math.max(state.tension * .76, state.hold * .95, pulse * 1.35);
  }

  function setupWebGL(gl) {
    const vertexSource = `
      precision highp float;
      attribute vec3 aKnot;
      attribute vec3 aOrbit;
      attribute vec3 aLattice;
      attribute vec3 aNormalKnot;
      attribute vec3 aNormalOrbit;
      attribute vec3 aNormalLattice;
      attribute vec3 aInfo;
      uniform vec3 uWeights;
      uniform mat3 uRotation;
      uniform mat4 uProjection;
      uniform float uTime;
      uniform float uDisperse;
      uniform float uScale;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vInfo;
      void main() {
        vec3 p = aKnot * uWeights.x + aOrbit * uWeights.y + aLattice * uWeights.z;
        vec3 n = normalize(aNormalKnot * uWeights.x + aNormalOrbit * uWeights.y + aNormalLattice * uWeights.z + vec3(.00001));
        float angle = aInfo.z * 6.283185;
        vec3 peel = vec3(cos(angle * 3.0), sin(angle * 2.0 + 1.0), sin(angle * 5.0 + .4));
        p += peel * uDisperse * (.4 + .35 * sin(aInfo.x * 3.14159));
        p += n * sin(aInfo.x * 18.84955 + uTime * .65 + angle) * .004;
        p = uRotation * p * uScale / (1.0 + uDisperse * .20);
        vec3 viewPosition = p + vec3(0.0, 0.0, -5.75);
        vNormal = uRotation * n;
        vView = -viewPosition;
        vInfo = aInfo;
        gl_Position = uProjection * vec4(viewPosition, 1.0);
      }
    `;
    const fragmentSource = `
      precision highp float;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vInfo;
      void main() {
        vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 view = normalize(vView);
        vec3 reflection = reflect(-view, n);
        vec3 key = normalize(vec3(-.65, 1.0, 1.3));
        float diffuse = max(0.0, dot(n, key));
        float broadLight = exp(-pow((reflection.y - .48) * 3.8, 2.0));
        float stripLight = exp(-pow((reflection.x + .53) * 8.0, 2.0));
        float topLight = exp(-pow((reflection.y - .91) * 12.0, 2.0));
        float specular = pow(max(0.0, dot(reflect(-key, n), view)), 70.0);
        float fresnel = pow(1.0 - abs(dot(n, view)), 3.0);
        float edge = smoothstep(.75, 1.0, abs(vInfo.y));
        vec3 color = vec3(.006, .0075, .009) + diffuse * vec3(.012, .013, .014);
        color += broadLight * vec3(.23, .235, .23) + stripLight * vec3(.31, .32, .315);
        color += topLight * .23 + specular * .65 + fresnel * .035 + edge * .012;
        color += vec3(.10, .016, .006) * pow(max(0.0, dot(n, normalize(vec3(-.8, -.9, .8)))), 5.0);
        float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5;
        color = pow(color, vec3(.454545)) + grain * .004;
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    function shader(type, source) {
      const compiled = gl.createShader(type);
      gl.shaderSource(compiled, source); gl.compileShader(compiled);
      if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(compiled));
      return compiled;
    }
    function program(vertex, fragment) {
      const linked = gl.createProgram();
      const vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(linked, vs); gl.attachShader(linked, fs); gl.linkProgram(linked);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(linked));
      return linked;
    }
    const sculptureProgram = program(vertexSource, fragmentSource);
    const shadowProgram = program(`
      attribute vec2 aPosition;
      varying vec2 vPosition;
      void main() { vPosition = aPosition; gl_Position = vec4(aPosition, .99, 1.0); }
    `, `
      precision mediump float;
      varying vec2 vPosition;
      void main() {
        vec2 p = (vPosition - vec2(0.0, -.77)) * vec2(1.6, 22.0);
        float shade = exp(-dot(p, p) * 1.8) * .14;
        gl_FragColor = vec4(.20, .19, .16, shade);
      }
    `);
    const geometry = makeGeometry(), attributes = [];
    gl.useProgram(sculptureProgram);
    const names = ['aKnot', 'aOrbit', 'aLattice', 'aNormalKnot', 'aNormalOrbit', 'aNormalLattice', 'aInfo'];
    const arrays = [...geometry.positions, ...geometry.normals, geometry.information];
    names.forEach((name, i) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, arrays[i], gl.STATIC_DRAW);
      attributes.push({ buffer, location: gl.getAttribLocation(sculptureProgram, name) });
    });
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
    const shadowBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shadowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const shadowPosition = gl.getAttribLocation(shadowProgram, 'aPosition');
    const uniforms = Object.fromEntries(['uWeights', 'uRotation', 'uProjection', 'uTime', 'uDisperse', 'uScale'].map(name => [name, gl.getUniformLocation(sculptureProgram, name)]));
    canvas.dataset.renderer = 'webgl';
    return {
      draw() {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(shadowProgram);
        attributes.forEach(attribute => gl.disableVertexAttribArray(attribute.location));
        gl.bindBuffer(gl.ARRAY_BUFFER, shadowBuffer); gl.enableVertexAttribArray(shadowPosition);
        gl.vertexAttribPointer(shadowPosition, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(shadowPosition); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
        gl.useProgram(sculptureProgram);
        attributes.forEach(attribute => {
          gl.bindBuffer(gl.ARRAY_BUFFER, attribute.buffer); gl.enableVertexAttribArray(attribute.location);
          gl.vertexAttribPointer(attribute.location, 3, gl.FLOAT, false, 0, 0);
        });
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        const aspect = width / height, f = 1 / Math.tan(39 * Math.PI / 360), near = .1, far = 30;
        const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
        gl.uniform3fv(uniforms.uWeights, state.weights);
        gl.uniformMatrix3fv(uniforms.uRotation, false, rotationMatrix());
        gl.uniformMatrix4fv(uniforms.uProjection, false, projection);
        gl.uniform1f(uniforms.uTime, state.time); gl.uniform1f(uniforms.uDisperse, dispersion());
        gl.uniform1f(uniforms.uScale, Math.min(1.02, aspect * 1.02));
        gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
      },
    };
  }

  function setupCanvas2D() {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;
    canvas.dataset.renderer = 'canvas';
    return {
      draw() {
        const dpr = canvas.width / width;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
        const matrix = rotationMatrix(), scale = Math.min(width, height) * .225, pieces = [];
        for (let lane = 0; lane < laneCount; lane++) {
          const points = []; let depth = 0;
          for (let step = 0; step <= 180; step++) {
            const u = step / 180, p = [0, 0, 0];
            for (let shape = 0; shape < 3; shape++) {
              const form = point(shape, u, 0, lane);
              for (let k = 0; k < 3; k++) p[k] += form[k] * state.weights[shape];
            }
            const angle = lane / laneCount * TAU;
            p[0] += Math.cos(angle * 3) * dispersion() * .65;
            p[1] += Math.sin(angle * 2 + 1) * dispersion() * .65;
            p[2] += Math.sin(angle * 5 + .4) * dispersion() * .65;
            const rotated = [matrix[0] * p[0] + matrix[3] * p[1] + matrix[6] * p[2], matrix[1] * p[0] + matrix[4] * p[1] + matrix[7] * p[2], matrix[2] * p[0] + matrix[5] * p[1] + matrix[8] * p[2]];
            const perspective = 5.75 / (5.75 - rotated[2]);
            points.push([width / 2 + rotated[0] * scale * perspective, height / 2 - rotated[1] * scale * perspective]); depth += rotated[2];
          }
          pieces.push({ points, depth });
        }
        pieces.sort((a, b) => a.depth - b.depth);
        pieces.forEach(piece => {
          const gradient = ctx.createLinearGradient(width * .2, height * .2, width * .8, height * .8);
          gradient.addColorStop(0, '#171918'); gradient.addColorStop(.35, '#898b84'); gradient.addColorStop(.49, '#292c2a'); gradient.addColorStop(.7, '#101211'); gradient.addColorStop(1, '#5d5f59');
          ctx.beginPath(); piece.points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
          ctx.strokeStyle = gradient; ctx.lineWidth = Math.max(1, scale * .018); ctx.stroke();
        });
      },
    };
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.6 : 2);
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    draw(); requestFrame();
  }
  function draw() {
    if (!renderer || contextLost) return;
    renderer.draw(); state.frame++;
    if (state.frame === 1 || state.frame % 90 === 0) canvas.dataset.frames = String(state.frame);
  }
  function requestFrame() {
    if (frameRequest === null && visible && !document.hidden && !contextLost) frameRequest = requestAnimationFrame(tick);
  }
  function tick(now) {
    frameRequest = null;
    if (!visible || document.hidden || contextLost) { previousTime = 0; return; }
    const dt = previousTime ? Math.min(.05, (now - previousTime) / 1000) : 1 / 60;
    if (previousTime && now - previousTime < (mobile ? 1000 / 45 : 1000 / 60) - .5) { requestFrame(); return; }
    previousTime = now;
    /* Pause freezes the current frame. A later direct action may still respond. */
    if (state.paused && !state.userAnimation && !state.dragging) { draw(); previousTime = 0; return; }
    let unsettled = false;
    const ease = 1 - Math.exp(-dt * 5.2);
    for (let i = 0; i < 3; i++) {
      state.weights[i] += (state.target[i] - state.weights[i]) * ease;
      if (Math.abs(state.target[i] - state.weights[i]) > .0001) unsettled = true;
      else state.weights[i] = state.target[i];
    }
    state.tension += (state.tensionTarget - state.tension) * ease;
    if (Math.abs(state.tensionTarget - state.tension) > .0001) unsettled = true;
    state.smoothX += (state.pointerX - state.smoothX) * ease;
    state.smoothY += (state.pointerY - state.smoothY) * ease;
    if (Math.abs(state.pointerX - state.smoothX) + Math.abs(state.pointerY - state.smoothY) > .001) unsettled = true;
    const holding = state.dragging && state.distance < 12 && now - state.heldAt > 350;
    state.hold += ((holding ? 1 : 0) - state.hold) * ease;
    if (state.hold > .001 || holding) unsettled = true;
    if (state.burstTime >= 0) { state.burstTime += dt; if (state.burstTime > 2.15) state.burstTime = -1; unsettled = true; }
    if (!state.dragging) {
      state.yaw += state.velocityX * dt * 60;
      state.pitch = Math.max(-1.1, Math.min(1.1, state.pitch + state.velocityY * dt * 60));
      const drag = Math.pow(.94, dt * 60);
      state.velocityX *= drag; state.velocityY *= drag;
      if (Math.abs(state.velocityX) + Math.abs(state.velocityY) > .00003) unsettled = true;
    }
    if (!state.paused) { state.yaw += dt * .085; state.time += dt; }
    draw();
    if (!state.paused || state.dragging || unsettled) requestFrame();
    else { previousTime = 0; state.userAnimation = false; }
  }
  function announce() {
    canvas.dataset.shape = state.shape; canvas.dataset.paused = String(state.paused);
    window.dispatchEvent(new CustomEvent('sculpture:state', { detail: { shape: state.shape, paused: state.paused, tension: state.tensionTarget, yaw: state.yaw, pitch: state.pitch } }));
  }

  window.IntellectSculpture = Object.freeze({
    setShape(name) {
      const index = shapeNames.indexOf(name);
      if (index < 0) return;
      state.shape = name; state.target = shapeNames.map((_, i) => i === index ? 1 : 0);
      if (reducedMotion.matches) state.weights = [...state.target];
      state.userAnimation = !reducedMotion.matches;
      announce(); requestFrame();
    },
    setTension(value) {
      const number = Number(value); if (!Number.isFinite(number)) return;
      state.tensionTarget = Math.max(0, Math.min(1, number));
      if (reducedMotion.matches) state.tension = state.tensionTarget;
      state.userAnimation = !reducedMotion.matches;
      requestFrame();
    },
    burst() { state.burstTime = 0; state.userAnimation = true; requestFrame(); },
    rotate(deltaX, deltaY = 0) {
      const dx = Number(deltaX), dy = Number(deltaY);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      state.yaw += dx;
      state.pitch = Math.max(-1.1, Math.min(1.1, state.pitch + dy));
      state.velocityX = state.velocityY = 0;
      announce(); requestFrame();
    },
    setPaused(value) {
      state.paused = Boolean(value);
      if (state.paused) { state.velocityX = state.velocityY = 0; state.userAnimation = false; }
      announce(); requestFrame();
    },
    reset() {
      state.yaw = -.4; state.pitch = -.27; state.velocityX = state.velocityY = 0;
      state.tensionTarget = 0; state.burstTime = -1; this.setShape('knot');
    },
    getState() { return { shape: state.shape, paused: state.paused, tension: state.tensionTarget, yaw: state.yaw, pitch: state.pitch, renderer: canvas.dataset.renderer }; },
    capture() { draw(); return canvas.toDataURL('image/png'); },
  });

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    state.activePointer = event.pointerId; state.userAnimation = true;
    state.dragging = true; state.heldAt = performance.now(); state.distance = 0;
    state.velocityX = state.velocityY = 0; lastX = event.clientX; lastY = event.clientY;
    stage.dataset.dragging = 'true'; requestFrame();
  });
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    if (!reducedMotion.matches) {
      state.pointerX = (event.clientX - rect.left) / rect.width * 2 - 1;
      state.pointerY = (event.clientY - rect.top) / rect.height * 2 - 1;
      state.userAnimation = true;
    }
    if (state.dragging) {
      const dx = event.clientX - lastX, dy = event.clientY - lastY;
      state.distance += Math.hypot(dx, dy); state.velocityX = dx * .0045; state.velocityY = dy * .0045;
      state.yaw += state.velocityX; state.pitch = Math.max(-1.1, Math.min(1.1, state.pitch + state.velocityY));
      if (reducedMotion.matches) state.velocityX = state.velocityY = 0;
      lastX = event.clientX; lastY = event.clientY;
    }
    requestFrame();
  });
  function release(event) {
    if (!state.dragging) return;
    state.dragging = false; state.activePointer = null; state.userAnimation = true; stage.dataset.dragging = 'false';
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup' && state.distance < 8 && performance.now() - state.heldAt < 300) window.IntellectSculpture.burst();
    requestFrame();
  }
  function abortPointer() {
    const pointer = state.activePointer;
    state.dragging = false; state.activePointer = null; state.hold = 0;
    state.velocityX = state.velocityY = 0; state.userAnimation = false;
    state.pointerX = state.smoothX; state.pointerY = state.smoothY;
    stage.dataset.dragging = 'false';
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  }
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('pointerleave', () => {
    state.pointerX = state.pointerY = 0;
    if (reducedMotion.matches) state.smoothX = state.smoothY = 0;
    else state.userAnimation = true;
    requestFrame();
  });
  window.addEventListener('blur', abortPointer);
  window.addEventListener('focus', requestFrame);
  document.addEventListener('visibilitychange', () => { previousTime = 0; if (document.hidden) abortPointer(); else requestFrame(); });
  reducedMotion.addEventListener('change', event => {
    state.paused = event.matches;
    if (event.matches) {
      abortPointer(); state.weights = [...state.target]; state.tension = state.tensionTarget;
      state.pointerX = state.pointerY = state.smoothX = state.smoothY = 0;
      state.burstTime = -1;
    }
    announce(); requestFrame();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; previousTime = 0; if (visible) requestFrame(); }, { threshold: .01 }).observe(stage);
  }
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); contextLost = true; canvas.dataset.renderer = 'restoring'; });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    try { renderer = setupWebGL(canvas.getContext('webgl')); resize(); requestFrame(); }
    catch { canvas.dataset.renderer = 'unavailable'; }
  });
  try {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: 'low-power' });
    renderer = gl ? setupWebGL(gl) : setupCanvas2D();
  } catch { renderer = null; canvas.dataset.renderer = 'unavailable'; }
  new ResizeObserver(resize).observe(stage);
  announce(); resize(); stage.dataset.ready = 'true';
})();
