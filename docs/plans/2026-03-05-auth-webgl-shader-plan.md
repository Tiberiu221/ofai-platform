# Auth WebGL Shader Background Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the particle canvas on auth pages (login.ejs, register.ejs) with a WebGL shader producing an animated orange-to-violet chromatic aberration light wave.

**Architecture:** A standalone JS file (`auth-shader.js`) initializes a THREE.js WebGL renderer on the existing `<canvas class="particle-canvas auth-particles">` element. The shader uses the Orange-Violet color scheme (brand orange #fb923c blending into premium violet #a78bfa via chromatic aberration). The particle canvas init code in `main.js` is skipped for auth pages. THREE.js is loaded via CDN only on auth pages.

**Tech Stack:** THREE.js (CDN r160), GLSL fragment shader, EJS templates, vanilla JS

---

### Task 1: Add THREE.js CDN to head.ejs (conditional)

**Files:**
- Modify: `appredueri_backend/src/views/public/partials/head.ejs`

**Step 1: Add conditional THREE.js script**

After the main.css link (line 16), add a conditional block that loads THREE.js only when `useWebGL` is truthy:

```ejs
<% if (typeof useWebGL !== 'undefined' && useWebGL) { %>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r160/three.min.js" defer></script>
<% } %>
```

This ensures THREE.js (~150KB gzipped) only loads on auth pages, not site-wide.

**Step 2: Verify no breakage**

Run: Start server, open homepage (should NOT load three.js), open /login (should load it).

**Step 3: Commit**

```bash
git add appredueri_backend/src/views/public/partials/head.ejs
git commit -m "feat(auth): add conditional THREE.js CDN for WebGL shader"
```

---

### Task 2: Create auth-shader.js

**Files:**
- Create: `appredueri_backend/src/public/js/auth-shader.js`

**Step 1: Write the shader file**

```js
/**
 * Auth Page WebGL Shader Background
 * Orange-to-Violet chromatic aberration light wave.
 * Replaces particle canvas on login/register pages.
 *
 * Requires THREE.js loaded before this script.
 * Targets: <canvas class="particle-canvas auth-particles">
 */
(function initAuthShader() {
  'use strict';

  // Skip on mobile (performance) or if THREE.js missing
  if (window.innerWidth < 768 || typeof THREE === 'undefined') return;

  var canvas = document.querySelector('canvas.auth-particles');
  if (!canvas) return;

  // Prevent particle canvas from also initializing on this element
  canvas.dataset.shaderActive = 'true';

  var scene = new THREE.Scene();
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(new THREE.Color(0x06060a));

  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1);

  var uniforms = {
    resolution: { value: [canvas.clientWidth, canvas.clientHeight] },
    time: { value: 0.0 },
    xScale: { value: 1.0 },
    yScale: { value: 0.3 },
    distortion: { value: 0.08 }
  };

  var vertexShader = [
    'attribute vec3 position;',
    'void main() {',
    '  gl_Position = vec4(position, 1.0);',
    '}'
  ].join('\n');

  var fragmentShader = [
    'precision highp float;',
    'uniform vec2 resolution;',
    'uniform float time;',
    'uniform float xScale;',
    'uniform float yScale;',
    'uniform float distortion;',
    '',
    'void main() {',
    '  vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);',
    '  float d = length(p) * distortion;',
    '  float rx = p.x * (1.0 + d);',
    '  float gx = p.x;',
    '  float bx = p.x * (1.0 - d);',
    '  float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);',
    '  float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);',
    '  float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);',
    '',
    '  // Orange-to-Violet color mapping (OFAI brand + Premium tier)',
    '  gl_FragColor = vec4(',
    '    r * 0.98,',   // orange warm (#fb923c family)
    '    g * 0.35,',   // muted green (orange-violet blend)
    '    b * 0.65,',   // violet-blue (#a78bfa family)
    '    1.0',
    '  );',
    '}'
  ].join('\n');

  // Full-screen quad geometry
  var positions = new Float32Array([
    -1, -1, 0,  1, -1, 0,  -1, 1, 0,
     1, -1, 0, -1,  1, 0,   1, 1, 0
  ]);
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  var material = new THREE.RawShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
    side: THREE.DoubleSide
  });

  var mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Sizing
  function handleResize() {
    var container = canvas.parentElement;
    if (!container) return;
    var rect = container.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    uniforms.resolution.value = [w, h];
  }

  handleResize();

  // Animation loop (slow — ambient, not distracting)
  var animating = true;
  var animationId = null;

  function animate() {
    if (!animating) return;
    uniforms.time.value += 0.005;
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  // IntersectionObserver — pause when off-screen
  var obs = new IntersectionObserver(function(entries) {
    animating = entries[0].isIntersecting;
    if (animating) animate();
    else if (animationId) cancelAnimationFrame(animationId);
  }, { threshold: 0.1 });
  obs.observe(canvas.parentElement || canvas);

  animate();

  window.addEventListener('resize', handleResize);

  // Cleanup on navigation (SPA safety, though OFAI is MPA)
  window._authShaderCleanup = function() {
    animating = false;
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', handleResize);
    obs.disconnect();
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
})();
```

**Step 2: Verify file created**

Run: `ls appredueri_backend/src/public/js/auth-shader.js` — file exists.

**Step 3: Commit**

```bash
git add appredueri_backend/src/public/js/auth-shader.js
git commit -m "feat(auth): add WebGL shader with orange-violet chromatic aberration"
```

---

### Task 3: Skip particle canvas for shader-active canvases

**Files:**
- Modify: `appredueri_backend/src/public/js/main.js` (~line 757)

**Step 1: Add guard in initParticles**

In `initParticles()` function, inside the `forEach` callback, add a check to skip canvases that have the shader active:

Current code (line 757-761):
```js
  document.querySelectorAll('canvas.particle-canvas').forEach(canvas => {
    const container = canvas.parentElement;
    if (!container) return;
    setupParticleCanvas(canvas, container);
  });
```

Change to:
```js
  document.querySelectorAll('canvas.particle-canvas').forEach(canvas => {
    const container = canvas.parentElement;
    if (!container) return;
    // Skip if WebGL shader has claimed this canvas
    if (canvas.dataset.shaderActive === 'true') return;
    setupParticleCanvas(canvas, container);
  });
```

This ensures the particle system doesn't try to get a 2D context on a canvas already used by WebGL (which would fail silently or error).

**Step 2: Verify particles still work on other pages**

Run: Start server, check homepage hero particles — still animating. Check /login — no particles (shader takes over).

**Step 3: Commit**

```bash
git add appredueri_backend/src/public/js/main.js
git commit -m "fix(particles): skip canvases claimed by WebGL shader"
```

---

### Task 4: Wire shader into login.ejs and register.ejs

**Files:**
- Modify: `appredueri_backend/src/views/public/login.ejs`
- Modify: `appredueri_backend/src/views/public/register.ejs`

**Step 1: Add shader script to login.ejs**

After the closing `</script>` tag of the existing inline JS (line 183), before `<%- include('partials/footer') %>`, add:

```ejs
<script src="/js/auth-shader.js?v=<%= typeof cacheBust !== 'undefined' ? cacheBust : '1' %>" defer></script>
```

**Step 2: Add shader script to register.ejs**

Same placement — after the closing `</script>` of inline JS (line 221), before footer include:

```ejs
<script src="/js/auth-shader.js?v=<%= typeof cacheBust !== 'undefined' ? cacheBust : '1' %>" defer></script>
```

**Step 3: Pass `useWebGL: true` from route handlers**

In `appredueri_backend/src/routes/web.js`, find the `res.render('public/login'` call and add `useWebGL: true` to the render options object. Do the same for `res.render('public/register'`.

Search for: `render('public/login'` and `render('public/register'`

Add `useWebGL: true` to each render call's options object.

**Step 4: Verify both pages**

Run: Start server, open /login — should see animated orange-violet light wave behind the auth card. Open /register — same effect. Open / (home) — no shader, particles only.

**Step 5: Commit**

```bash
git add appredueri_backend/src/views/public/login.ejs appredueri_backend/src/views/public/register.ejs appredueri_backend/src/routes/web.js
git commit -m "feat(auth): wire WebGL shader into login and register pages"
```

---

### Task 5: Update auth-page CSS for shader compatibility

**Files:**
- Modify: `appredueri_backend/src/public/css/main.css`

**Step 1: Ensure auth-page has proper stacking context**

The existing `.auth-page` CSS (line 2068) already has `position` implied by flex, but the canvas needs explicit positioning. The `.particle-canvas` (line 4428) already has `position: absolute; inset: 0; z-index: 0;`.

Add a rule to ensure the auth-card stays above the WebGL canvas, and slightly increase the canvas opacity for the shader (it's more subtle than particles):

After the existing `.auth-particles` rule (line 4439), add:

```css
/* WebGL shader canvas — slightly more visible than particle dots */
.auth-particles[data-shader-active="true"] {
  opacity: 0.7;
}
```

And ensure `.auth-card` has z-index:

After `.auth-card` rule (line 2076), add if not already present:

```css
.auth-card {
  position: relative;
  z-index: 1;
}
```

**Step 2: Verify visual layering**

Run: Start server, open /login — card is above shader, shader shows through at 0.7 opacity.

**Step 3: Commit**

```bash
git add appredueri_backend/src/public/css/main.css
git commit -m "style(auth): adjust z-index and opacity for WebGL shader background"
```

---

### Task 6: Visual QA & final commit

**Files:** None new — verification only.

**Step 1: Test login page**

- Open /login in browser
- Verify: animated light wave visible behind form
- Verify: orange center with violet edges (chromatic aberration)
- Verify: animation is slow and ambient (not distracting)
- Verify: form is fully usable (inputs, submit, Google button)

**Step 2: Test register page**

- Open /register — same shader effect
- Verify: all form fields work, GDPR checkbox, Google Sign-In

**Step 3: Test mobile fallback**

- Resize browser to < 768px width
- Verify: no shader (skipped), no console errors
- Verify: auth card still centered and styled

**Step 4: Test other pages unaffected**

- Open / (home) — hero particles work, no shader
- Open /oferte — no shader, no console errors
- Open /business/:id — no shader

**Step 5: Test WebGL not available fallback**

- Temporarily rename auth-shader.js → verify page loads with empty canvas (graceful degradation)

**Step 6: Squash into feature commit**

```bash
git add -A
git commit -m "feat(auth): WebGL shader background with orange-violet chromatic aberration

Replace particle canvas on login/register pages with a THREE.js WebGL
shader producing an animated light wave. Colors blend brand orange
(#fb923c) into premium violet (#a78bfa) via chromatic aberration.

- THREE.js loaded via CDN only on auth pages (conditional in head.ejs)
- Shader pauses when off-screen (IntersectionObserver)
- Skipped on mobile < 768px (performance)
- Particle canvas gracefully skipped when shader is active"
```

---

## Summary

| Task | Files | Risk |
|------|-------|------|
| 1. THREE.js CDN conditional | head.ejs | Zero — conditional, other pages unaffected |
| 2. Create auth-shader.js | new file | Zero — new file, no side effects |
| 3. Skip particles for shader | main.js | Low — one guard clause in forEach |
| 4. Wire into login + register | login.ejs, register.ejs, web.js | Low — adding script tag + render option |
| 5. CSS stacking context | main.css | Zero — additive rules only |
| 6. Visual QA | none | Zero — verification |

**Total: 6 tasks, ~4 files modified + 1 new file**
