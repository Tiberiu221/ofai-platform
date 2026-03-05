/**
 * Auth Page WebGL Shader Background
 * Single orange glow wave matching OFAI brand #fb923c.
 * Replaces particle canvas on login/register pages.
 *
 * Requires THREE.js loaded before this script.
 * Targets: <canvas class="particle-canvas auth-particles" data-shader="true">
 */
(function initAuthShader() {
  'use strict';

  // Skip on mobile (performance) or if THREE.js missing
  if (window.innerWidth < 768 || typeof THREE === 'undefined') return;

  var canvas = document.querySelector('canvas.auth-particles[data-shader="true"]');
  if (!canvas) return;

  var container = canvas.parentElement;
  if (!container) return;

  var scene = new THREE.Scene();
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(new THREE.Color(0x000000));

  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1);

  var uniforms = {
    resolution: { value: [canvas.clientWidth, canvas.clientHeight] },
    time: { value: 0.0 },
    xScale: { value: 1.0 },
    yScale: { value: 0.35 }
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
    '',
    'void main() {',
    '  vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);',
    '',
    '  // Single orange glow wave — OFAI brand #fb923c',
    '  float wave = 0.08 / abs(p.y + sin((p.x + time) * xScale) * yScale);',
    '  wave = min(wave, 1.5);',
    '',
    '  // Pure orange: rgb(251, 146, 60) = (0.98, 0.57, 0.24)',
    '  gl_FragColor = vec4(',
    '    wave * 0.98,',
    '    wave * 0.57,',
    '    wave * 0.24,',
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

  // Sizing — use container dimensions
  function handleResize() {
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
  obs.observe(container);

  animate();

  window.addEventListener('resize', handleResize);
})();
