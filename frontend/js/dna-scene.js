export function initDNAScene(containerId, options = {}) {
  const container = typeof containerId === 'string'
    ? document.getElementById(containerId)
    : containerId;

  if (!container) {
    console.error(`Container not found: ${containerId}`);
    return null;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = options.cameraZ || 8;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  const colors = {
    primary: new THREE.Color(options.primaryColor || '#00d4ff'),
    secondary: new THREE.Color(options.secondaryColor || '#8b5cf6'),
    emissive: new THREE.Color(options.emissiveColor || '#00d4ff'),
  };

  const dnaGroup = new THREE.Group();
  scene.add(dnaGroup);

  const helixRadius = options.helixRadius || 1.8;
  const helixHeight = options.helixHeight || 6;
  const numBasePairs = options.numBasePairs || 20;
  const tubeRadius = options.tubeRadius || 0.14;
  const turns = options.turns || 3;

  const strandPositions = [
    { angleOffset: 0, color: colors.primary },
    { angleOffset: Math.PI, color: colors.primary },
  ];

  function createTubePath(angleOffset) {
    const points = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const y = -helixHeight / 2 + t * helixHeight;
      const angle = t * Math.PI * 2 * turns + angleOffset;
      const x = Math.cos(angle) * helixRadius;
      const z = Math.sin(angle) * helixRadius;
      points.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(points);
  }

  const strandMaterial = new THREE.MeshPhysicalMaterial({
    color: colors.primary,
    metalness: options.metalness || 0.7,
    roughness: options.roughness || 0.3,
    emissive: colors.emissive,
    emissiveIntensity: options.emissiveIntensity || 0.2,
    clearcoat: 0.1,
    clearcoatRoughness: 0.3,
  });

  strandPositions.forEach(({ angleOffset }) => {
    const path = createTubePath(angleOffset);
    const tubeGeo = new THREE.TubeGeometry(path, 80, tubeRadius, 8, false);
    const mesh = new THREE.Mesh(tubeGeo, strandMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    dnaGroup.add(mesh);
  });

  const rungMaterial = new THREE.MeshPhysicalMaterial({
    color: colors.secondary,
    metalness: 0.6,
    roughness: 0.4,
    emissive: colors.secondary,
    emissiveIntensity: 0.1,
  });

  const sphereMat1 = new THREE.MeshPhysicalMaterial({
    color: colors.primary,
    metalness: 0.5,
    roughness: 0.4,
    emissive: colors.primary,
    emissiveIntensity: 0.3,
  });

  const sphereMat2 = new THREE.MeshPhysicalMaterial({
    color: colors.secondary,
    metalness: 0.5,
    roughness: 0.4,
    emissive: colors.secondary,
    emissiveIntensity: 0.3,
  });

  for (let i = 0; i < numBasePairs; i++) {
    const t = i / (numBasePairs - 1);
    const y = -helixHeight / 2 + t * helixHeight;
    const angle = t * Math.PI * 2 * turns;

    const x1 = Math.cos(angle) * helixRadius;
    const z1 = Math.sin(angle) * helixRadius;
    const x2 = Math.cos(angle + Math.PI) * helixRadius;
    const z2 = Math.sin(angle + Math.PI) * helixRadius;

    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);

    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, length * 0.85, 6),
      rungMaterial
    );
    rung.position.set(midX, y, midZ);
    rung.rotation.z = -(Math.PI / 2);
    rung.rotation.y = -Math.atan2(dz, dx);
    dnaGroup.add(rung);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      i % 2 === 0 ? sphereMat1 : sphereMat2
    );
    sphere.position.set(x1, y, z1);
    dnaGroup.add(sphere);

    const sphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      i % 2 === 0 ? sphereMat2 : sphereMat1
    );
    sphere2.position.set(x2, y, z2);
    dnaGroup.add(sphere2);
  }

  const starCount = options.starCount || 3000;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starColors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    starPositions[i3] = (Math.random() - 0.5) * 200;
    starPositions[i3 + 1] = (Math.random() - 0.5) * 200;
    starPositions[i3 + 2] = (Math.random() - 0.5) * 100 - 20;
    starSizes[i] = 0.05 + Math.random() * 0.1;

    const tint = Math.random();
    if (tint < 0.6) {
      starColors[i3] = 1; starColors[i3 + 1] = 1; starColors[i3 + 2] = 1;
    } else if (tint < 0.8) {
      starColors[i3] = 0; starColors[i3 + 1] = 0.83; starColors[i3 + 2] = 1;
    } else {
      starColors[i3] = 0.55; starColors[i3 + 1] = 0.36; starColors[i3 + 2] = 0.96;
    }
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const glowRingMat = new THREE.MeshBasicMaterial({
    color: colors.primary,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
  });
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(3, 4, 64),
    glowRingMat
  );
  glowRing.position.y = -helixHeight / 2 - 0.5;
  glowRing.rotation.x = -Math.PI / 2;
  dnaGroup.add(glowRing);

  let scrollProgress = 0;
  function onScroll() {
    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;
  }
  window.addEventListener('scroll', onScroll);

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  let animationId = null;

  function animate() {
    animationId = requestAnimationFrame(animate);

    dnaGroup.rotation.y += 0.003;
    dnaGroup.rotation.y += scrollProgress * 0.02;
    dnaGroup.position.y = Math.sin(Date.now() * 0.0003) * 0.1;

    stars.rotation.y += 0.0002;

    renderer.render(scene, camera);
  }

  animate();

  function dispose() {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  return { scene, camera, renderer, animate, dispose, dnaGroup, stars };
}
