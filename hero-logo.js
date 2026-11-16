/* Chrome, extruded LinkedAI chain-link logo that turns slowly on its vertical axis. */
(async function () {
const holder = document.getElementById('hero-logo3d');
if (!holder) return;
const THREE = await import('three');
const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
{
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.01).texture;

  const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
  camera.position.set(0, 0.7, 10.5);
  camera.lookAt(0, 0, 0);

  // a rounded "pill" outline, optionally with a pill-shaped hole
  const pill = (w, h) => {
    const r = h / 2, s = new THREE.Shape(), x = w / 2 - r;
    s.moveTo(-x, -r); s.lineTo(x, -r); s.absarc(x, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-x, r); s.absarc(-x, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    return s;
  };
  const ring = () => {
    const s = pill(3.3, 2.0);
    const hole = pill(2.3, 1.06);
    s.holes.push(new THREE.Path(hole.getPoints(48).reverse()));
    return s;
  };
  // boxy: deep extrusion with a small, tight bevel
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 48
  }).center();

  const chrome = (tint) => new THREE.MeshPhysicalMaterial({
    color: tint, metalness: 1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6
  });

  const logo = new THREE.Group();
  const left = new THREE.Mesh(extrude(ring(), 0.55), chrome(0x38b6ff));
  left.position.x = -1.58;
  const right = new THREE.Mesh(extrude(ring(), 0.55), chrome(0x2f5cff));
  right.position.x = 1.58;
  const bar = new THREE.Mesh(extrude(pill(2.7, 0.44), 0.75), chrome(0xa6eeff));
  logo.add(left, right, bar);
  scene.add(logo);

  // cool blue rim light so the chrome picks up the brand colour on its edges
  const rim = new THREE.DirectionalLight(0x5cc6ff, 2.2); rim.position.set(-6, 3, -4); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0x3d6bff, 1.6); rim2.position.set(6, -2, -3); scene.add(rim2);

  function size() {
    const w = holder.clientWidth, h = holder.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  let visible = true, last = performance.now(), angle = 0.5;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) { last = performance.now(); requestAnimationFrame(tick); } }).observe(holder);
  function tick(t) {
    if (!visible) return;
    const dt = Math.min(64, t - last); last = t;
    if (!reduce) angle += dt * 0.0006;
    logo.rotation.y = angle;
    logo.rotation.x = 0.12 * Math.sin(angle * 0.5);
    renderer.render(scene, camera);
    if (!reduce) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  holder.classList.add('ready');
}
})();
