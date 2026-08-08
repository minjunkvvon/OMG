// Shared rotating-Moon scene. Used by the homepage hub and every subpage,
// so the celestial background is identical site-wide.
import * as THREE from 'three';

export function initMoonScene(canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 9);
  camera.rotation.z = -0.14;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const textureLoader = new THREE.TextureLoader();
  const moonTexture = textureLoader.load('assets/moon.jpg');
  moonTexture.colorSpace = THREE.SRGBColorSpace;
  moonTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const bumpTexture = textureLoader.load('assets/moon_bump.jpg');

  const MOON_R = 20;
  const moonGeometry = new THREE.SphereGeometry(MOON_R, 200, 200);
  const moonMaterial = new THREE.MeshStandardMaterial({
    map: moonTexture,
    bumpMap: bumpTexture,
    bumpScale: 1.1,
    roughness: 1.0,
    metalness: 0,
    color: 0x9a9a9a
  });
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  moon.position.set(2, -(MOON_R + 1.6), 0);
  moon.rotation.z = 0.12;
  moon.rotation.y = 2.4;
  scene.add(moon);

  const sun = new THREE.DirectionalLight(0xfff4e6, 3.4);
  sun.position.set(-5, -0.5, 5);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x0a0d12, 0.35));

  // Stars
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 3200;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  function starColor(out, i) {
    const t = Math.random();
    let r, g, b;
    if (t < 0.10)      { r = 0.74; g = 0.81; b = 1.00; }
    else if (t < 0.30) { r = 0.88; g = 0.92; b = 1.00; }
    else if (t < 0.72) { r = 1.00; g = 0.99; b = 0.96; }
    else if (t < 0.90) { r = 1.00; g = 0.94; b = 0.84; }
    else               { r = 1.00; g = 0.85; b = 0.70; }
    out[i*3] = r; out[i*3+1] = g; out[i*3+2] = b;
  }
  for (let i = 0; i < starCount; i++) {
    const r = 60 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i*3+2] = r * Math.cos(phi);
    const mag = Math.pow(Math.random(), 4);
    const brightness = 0.12 + mag * 0.88;
    starColor(starColors, i);
    starColors[i*3]   *= brightness;
    starColors[i*3+1] *= brightness;
    starColors[i*3+2] *= brightness;
    starSizes[i] = 1.0 + mag * mag * 4.5;
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  starGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  const starMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float aSize; varying vec3 vColor; uniform float uPixelRatio;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float core = smoothstep(0.5, 0.0, r);
        float glow = pow(core, 2.2);
        gl_FragColor = vec4(vColor * (0.35 + glow), glow);
      }`,
    vertexColors: true
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // Satellite + trail
  const orbitCenter = new THREE.Vector3(-0.4, -1.4, -1);
  const ORBIT_RX = 6.6, ORBIT_RY = 2.2, ORBIT_RZ = 7.0, ORBIT_ROLL = -0.22;
  const cosR = Math.cos(ORBIT_ROLL), sinR = Math.sin(ORBIT_ROLL);
  function orbitPoint(angle, out) {
    let lx = Math.cos(angle) * ORBIT_RX;
    let ly = Math.sin(angle) * ORBIT_RY;
    const lz = Math.sin(angle) * ORBIT_RZ;
    const rx = lx * cosR - ly * sinR;
    const ry = lx * sinR + ly * cosR;
    out.set(orbitCenter.x + rx, orbitCenter.y + ry, orbitCenter.z + lz);
    return out;
  }
  function makeGlowTexture() {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(0.18,'rgba(225,238,255,0.85)');
    g.addColorStop(0.45,'rgba(150,190,255,0.25)');
    g.addColorStop(1,'rgba(150,190,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const satMaterial = new THREE.SpriteMaterial({ map: makeGlowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true });
  const satellite = new THREE.Sprite(satMaterial);
  satellite.scale.set(0.34, 0.34, 0.34);
  scene.add(satellite);

  const TRAIL_LEN = 26;
  const trailGeometry = new THREE.BufferGeometry();
  const trailPositions = new Float32Array(TRAIL_LEN * 3);
  const trailColors = new Float32Array(TRAIL_LEN * 3);
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
  const trailMaterial = new THREE.PointsMaterial({ size: 0.09, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const trail = new THREE.Points(trailGeometry, trailMaterial);
  scene.add(trail);

  let satAngle = 0;
  const ORBIT_SPEED = 0.0034, TRAIL_STEP = 0.010;
  const _p = new THREE.Vector3();
  for (let i = 0; i < TRAIL_LEN; i++) {
    orbitPoint(satAngle - i * TRAIL_STEP, _p);
    trailPositions[i*3] = _p.x; trailPositions[i*3+1] = _p.y; trailPositions[i*3+2] = _p.z;
    const t = 1 - i / TRAIL_LEN; const b = t * t * 0.7;
    trailColors[i*3] = b * 0.8; trailColors[i*3+1] = b * 0.88; trailColors[i*3+2] = b;
  }
  trailGeometry.attributes.position.needsUpdate = true;
  trailGeometry.attributes.color.needsUpdate = true;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    if (!reduceMotion) {
      moon.rotation.y += 0.0006;
      stars.rotation.y += 0.00008;
      satAngle += ORBIT_SPEED;
      orbitPoint(satAngle, _p);
      satellite.position.copy(_p);
      for (let i = TRAIL_LEN - 1; i > 0; i--) {
        trailPositions[i*3]   = trailPositions[(i-1)*3];
        trailPositions[i*3+1] = trailPositions[(i-1)*3+1];
        trailPositions[i*3+2] = trailPositions[(i-1)*3+2];
      }
      trailPositions[0] = _p.x; trailPositions[1] = _p.y; trailPositions[2] = _p.z;
      trailGeometry.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  animate();
}
