import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/** 原创几何工作室，不依赖外站模型、贴图或业务数据。 */
export function createStudio(container, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
    // 按需渲染保留最后一帧，避免浏览器整页截图重合成时清空三维画面。
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4.5, 4.5, 4.5, -4.5, 0.1, 60);
  camera.position.set(8, 6.3, 10);
  camera.lookAt(0, 1.4, 0);
  const room = new THREE.Group();
  scene.add(room);
  const geometries = new Set();
  const materials = new Map();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitSphere = new THREE.SphereGeometry(1, 14, 10);
  geometries.add(unitBox);
  geometries.add(unitSphere);

  const palette = {
    floor: "#e4d8be",
    wall: "#e2ded0",
    back: "#cbdcd8",
    trim: "#f5f1df",
    wood: "#bb9263",
    woodLight: "#d3b488",
    frame: "#596964",
    screen: "#d5e8ea",
    paper: "#f7f4e9",
    chair: "#8ea594",
    metal: "#626f64",
    leaf: "#748a58",
    terracotta: "#be8d6c",
    rug: "#d2d7be",
    book: "#9babaa",
    accent: "#e3b85d",
  };
  function material(color, basic = false) {
    const key = `${color}:${basic}`;
    if (!materials.has(key))
      materials.set(
        key,
        basic
          ? new THREE.MeshBasicMaterial({ color })
          : new THREE.MeshStandardMaterial({
              color,
              roughness: 0.84,
              metalness: 0,
            }),
      );
    return materials.get(key);
  }
  function mesh(
    geometry,
    color,
    position,
    scale,
    parent = room,
    basic = false,
  ) {
    const object = new THREE.Mesh(geometry, material(color, basic));
    object.position.set(...position);
    if (scale) object.scale.set(...scale);
    object.castShadow = !basic;
    object.receiveShadow = !basic;
    parent.add(object);
    return object;
  }
  function box(
    size,
    position,
    color,
    parent = room,
    rounded = false,
    basic = false,
  ) {
    if (!rounded) return mesh(unitBox, color, position, size, parent, basic);
    const geometry = new RoundedBoxGeometry(
      ...size,
      2,
      Math.min(...size) * 0.23,
    );
    geometries.add(geometry);
    return mesh(geometry, color, position, null, parent, basic);
  }
  function cylinder(top, bottom, height, position, color, parent = room) {
    const geometry = new THREE.CylinderGeometry(top, bottom, height, 20);
    geometries.add(geometry);
    return mesh(geometry, color, position, null, parent);
  }
  function sphere(scale, position, color, parent = room) {
    return mesh(unitSphere, color, position, scale, parent);
  }
  function rod(from, to, radius, color, parent = room) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const middle = a.clone().add(b).multiplyScalar(0.5);
    const object = cylinder(
      radius,
      radius,
      a.distanceTo(b),
      middle.toArray(),
      color,
      parent,
    );
    object.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.sub(a).normalize(),
    );
    return object;
  }

  // 房间壳与地板：对外敞开两面，保留完整工作室轮廓。
  box([6.05, 0.22, 4.95], [0, -0.12, 0], palette.floor, room, true);
  box([0.16, 3.65, 4.95], [-2.98, 1.72, 0], palette.wall);
  box([6.05, 3.65, 0.16], [0, 1.72, -2.42], palette.back);
  box([0.05, 0.15, 4.85], [-2.88, 0.08, 0], palette.trim);
  box([5.9, 0.15, 0.05], [0, 0.08, -2.3], palette.trim);
  for (let index = 0; index < 9; index += 1) {
    box([5.84, 0.005, 0.009], [0, 0.001, -2.13 + index * 0.53], "#d1c5ae");
  }
  // 窗口以嵌入的浅蓝色玻璃、格栅与褶皱窗帘构成。
  box([0.06, 2.03, 2.3], [-2.87, 2.13, -0.28], "#b9d5df", room, false, true);
  for (const z of [-1.46, 0.9])
    box([0.15, 2.2, 0.1], [-2.78, 2.13, z], palette.trim);
  for (const y of [1.08, 3.18])
    box([0.15, 0.1, 2.47], [-2.78, y, -0.28], palette.trim);
  box([0.15, 2.12, 0.055], [-2.75, 2.13, -0.28], palette.trim);
  box([0.15, 0.055, 2.38], [-2.75, 2.17, -0.28], palette.trim);
  box([0.45, 0.12, 2.65], [-2.69, 1.03, -0.28], palette.trim, room, true);
  rod([-2.69, 3.3, -1.76], [-2.69, 3.3, 1.2], 0.026, palette.wood);
  for (const start of [-1.75, 0.83]) {
    for (let index = 0; index < 4; index += 1)
      cylinder(
        0.083,
        0.1,
        2.22,
        [-2.63, 2.12, start + index * 0.105],
        index % 2 ? "#d8cbb0" : "#e8ddc2",
      );
  }
  // 地毯和细线纹理。
  box([2.6, 0.018, 2.05], [0.57, 0.018, 0.55], palette.rug, room, true);
  for (const x of [-0.59, 1.73])
    box([0.023, 0.003, 1.84], [x, 0.029, 0.55], "#b9c3aa");

  // 桌子、抽屉柜与独立支脚。
  box([3.75, 0.14, 1.28], [0.55, 1.4, -1.4], palette.woodLight, room, true);
  for (const x of [-1.13, 2.23])
    for (const z of [-1.89, -0.91])
      box([0.075, 1.35, 0.075], [x, 0.68, z], palette.wood);
  box([0.8, 1.27, 1.05], [1.91, 0.65, -1.41], "#d2c7b1", room, true);
  for (let index = 0; index < 3; index += 1) {
    box(
      [0.69, 0.32, 0.022],
      [1.91, 0.27 + index * 0.38, -0.872],
      "#e5dbc9",
      room,
      true,
    );
    box([0.2, 0.032, 0.035], [1.91, 0.29 + index * 0.38, -0.848], "#b5a78e");
  }

  function monitor(width, x, tilt) {
    const group = new THREE.Group();
    group.position.set(x, 1.46, -1.62);
    group.rotation.y = tilt;
    room.add(group);
    box([0.46, 0.055, 0.28], [0, 0.028, 0], palette.frame, group, true);
    box([0.07, 0.29, 0.06], [0, 0.18, -0.05], palette.frame, group);
    box([width, 0.86, 0.075], [0, 0.69, 0], palette.frame, group, true);
    box(
      [width - 0.07, 0.78, 0.01],
      [0, 0.7, 0.044],
      palette.screen,
      group,
      false,
      true,
    );
    box(
      [width - 0.08, 0.12, 0.012],
      [0, 1.025, 0.055],
      "#eff5ee",
      group,
      false,
      true,
    );
    box(
      [0.17, 0.58, 0.012],
      [-width / 2 + 0.14, 0.68, 0.055],
      "#b2c9c7",
      group,
      false,
      true,
    );
    for (let index = 0; index < 4; index += 1)
      box(
        [0.09, 0.021, 0.016],
        [-width / 2 + 0.14, 0.85 - index * 0.1, 0.065],
        "#eaf1e9",
        group,
        false,
        true,
      );
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const cardWidth = (width - 0.39) / 3;
        const xPos = -width / 2 + 0.3 + cardWidth * (col + 0.5);
        box(
          [cardWidth - 0.035, 0.235, 0.013],
          [xPos, 0.52 + row * 0.29, 0.065],
          "#f8f8ed",
          group,
          false,
          true,
        );
        box(
          [cardWidth - 0.065, 0.13, 0.014],
          [xPos, 0.55 + row * 0.29, 0.075],
          ["#a7beab", "#d8cba5", "#b1c9cf"][(row + col) % 3],
          group,
          false,
          true,
        );
        box(
          [cardWidth * 0.55, 0.016, 0.014],
          [xPos, 0.46 + row * 0.29, 0.075],
          "#d1dacf",
          group,
          false,
          true,
        );
      }
    }
  }
  monitor(1.55, -0.03, 0.1);
  monitor(1.12, 1.36, -0.13);
  box([0.95, 0.045, 0.32], [0.24, 1.5, -1.02], "#eae4d3", room, true);
  for (let row = 0; row < 3; row += 1)
    for (let col = 0; col < 11; col += 1)
      box(
        [0.058, 0.012, 0.058],
        [-0.15 + col * 0.078, 1.529, -1.115 + row * 0.089],
        "#fbf7ed",
      );
  sphere([0.075, 0.028, 0.11], [0.98, 1.5, -1.02], palette.paper);
  // 台灯与一杯咖啡。
  cylinder(0.14, 0.17, 0.045, [-1.08, 1.5, -1.6], palette.trim);
  rod([-1.08, 1.52, -1.6], [-1.08, 2.07, -1.6], 0.023, palette.wood);
  rod([-1.08, 2.07, -1.6], [-0.84, 2.32, -1.6], 0.023, palette.wood);
  const lamp = cylinder(0.065, 0.16, 0.22, [-0.8, 2.26, -1.6], "#eee3c6");
  lamp.rotation.z = 0.35;
  cylinder(0.095, 0.075, 0.16, [-0.98, 1.55, -0.98], palette.paper);
  cylinder(0.077, 0.077, 0.004, [-0.98, 1.633, -0.98], "#70583d");
  const handleGeometry = new THREE.TorusGeometry(0.058, 0.016, 8, 14);
  geometries.add(handleGeometry);
  const handle = mesh(handleGeometry, palette.paper, [-0.88, 1.55, -0.98]);
  handle.rotation.y = Math.PI / 2;

  // 五爪办公椅，扶手与靠背均独立建模。
  const chair = new THREE.Group();
  chair.position.set(0.27, 0, 0.22);
  chair.rotation.y = -0.28;
  room.add(chair);
  cylinder(0.055, 0.055, 0.47, [0, 0.33, 0], palette.metal, chair);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index * Math.PI * 2) / 5;
    const x = Math.sin(angle) * 0.45;
    const z = Math.cos(angle) * 0.45;
    rod([0, 0.16, 0], [x, 0.09, z], 0.032, palette.metal, chair);
    sphere([0.063, 0.073, 0.061], [x, 0.074, z], "#566159", chair);
  }
  box([0.88, 0.15, 0.8], [0, 0.64, 0], palette.chair, chair, true);
  box([0.12, 0.55, 0.09], [0, 0.91, 0.35], palette.metal, chair, true);
  const chairBack = box(
    [0.84, 0.85, 0.13],
    [0, 1.15, 0.36],
    palette.chair,
    chair,
    true,
  );
  chairBack.rotation.x = 0.12;
  for (const side of [-1, 1]) {
    rod(
      [side * 0.41, 0.65, 0.04],
      [side * 0.45, 0.92, 0.1],
      0.025,
      palette.metal,
      chair,
    );
    box(
      [0.095, 0.065, 0.4],
      [side * 0.45, 0.94, 0.04],
      palette.chair,
      chair,
      true,
    );
  }

  // 绿植：叶片以椭球体构成，保持柔和、轻量的黏土模型质感。
  function plant(position, scale = 1) {
    const group = new THREE.Group();
    group.position.set(...position);
    group.scale.setScalar(scale);
    room.add(group);
    cylinder(0.25, 0.18, 0.38, [0, 0.19, 0], palette.terracotta, group);
    cylinder(0.22, 0.22, 0.015, [0, 0.385, 0], "#665c45", group);
    rod([0, 0.39, 0], [0, 1.24, 0], 0.022, "#708355", group);
    for (let index = 0; index < 9; index += 1) {
      const angle = index * 2.4;
      const height = 0.6 + index * 0.075;
      const x = Math.sin(angle) * (0.31 - index * 0.014);
      const z = Math.cos(angle) * (0.31 - index * 0.014);
      rod(
        [0, height - 0.1, 0],
        [x, height + 0.03, z],
        0.009,
        palette.leaf,
        group,
      );
      const leaf = sphere(
        [0.11, 0.032, 0.24],
        [x, height + 0.045, z],
        index % 2 ? "#92a374" : "#738b5d",
        group,
      );
      leaf.rotation.set(-0.4, -angle, Math.sin(angle) * 0.25);
    }
  }
  plant([-2.19, 0.02, 1.39]);
  plant([2.15, 1.48, -1.62], 0.38);

  // 墙面画框与陈列架。
  box([1.11, 1.22, 0.07], [0.5, 2.82, -2.28], palette.wood);
  box([0.98, 1.09, 0.018], [0.5, 2.82, -2.23], palette.paper);
  const artCircle = cylinder(
    0.22,
    0.22,
    0.015,
    [0.39, 3.0, -2.2],
    palette.accent,
  );
  artCircle.rotation.x = Math.PI / 2;
  box([0.49, 0.32, 0.024], [0.59, 2.62, -2.2], "#a1b5aa", room, true);
  box([1.07, 0.07, 0.37], [2.12, 2.65, -2.16], palette.woodLight, room, true);
  for (let index = 0; index < 5; index += 1) {
    const book = box(
      [0.105, 0.36 + (index % 3) * 0.06, 0.21],
      [1.77 + index * 0.12, 2.87, -2.12],
      ["#9bafa8", "#e0c79d", "#dddccc", "#8b9991", "#d0b291"][index],
    );
    book.rotation.z = index === 4 ? -0.15 : 0;
  }
  cylinder(0.085, 0.055, 0.22, [2.4, 2.8, -2.12], palette.trim);
  // 地面书本点缀。
  const books = new THREE.Group();
  books.position.set(-1.1, 0, 1.65);
  books.rotation.y = -0.28;
  room.add(books);
  box([0.62, 0.09, 0.45], [0, 0.06, 0], palette.book, books, true);
  box(
    [0.55, 0.07, 0.4],
    [0.03, 0.145, 0],
    palette.paper,
    books,
    true,
  ).rotation.y = 0.16;

  scene.add(new THREE.HemisphereLight("#f7fbff", "#c0b798", 2.5));
  const sun = new THREE.DirectionalLight("#fff1cf", 3.8);
  sun.position.set(-0.8, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -5,
    right: 5,
    top: 5,
    bottom: -5,
    near: 0.5,
    far: 20,
  });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#ddeeff", 1.4);
  fill.position.set(5, 3, 1);
  scene.add(fill);

  let active = true;
  let disposed = false;
  let frame = 0;
  let targetRotation = 0;
  let targetTilt = 0;
  let lastTime = performance.now();
  let dragStart = null;
  let dragRotation = 0;
  const abort = new AbortController();
  const listenerOptions = { signal: abort.signal };

  function draw(time) {
    frame = 0;
    if (disposed || !active || document.hidden) return;
    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    const blend = reducedMotion ? 1 : 1 - Math.exp(-7 * delta);
    room.rotation.y += (targetRotation - room.rotation.y) * blend;
    room.rotation.x += (targetTilt - room.rotation.x) * blend;
    renderer.render(scene, camera);
    const moving =
      Math.abs(targetRotation - room.rotation.y) +
        Math.abs(targetTilt - room.rotation.x) >
      0.0002;
    if (moving && !reducedMotion) frame = requestAnimationFrame(draw);
  }
  function requestDraw() {
    // 浏览器截取整页时可能暂时改变视口；输入和尺寸变化以当前矩形复核可见性。
    const bounds = container.getBoundingClientRect();
    active = bounds.bottom > 0 && bounds.top < window.innerHeight
      && bounds.right > 0 && bounds.left < window.innerWidth;
    if (!frame && !disposed && active && !document.hidden) {
      lastTime = performance.now() - 16;
      frame = requestAnimationFrame(draw);
    }
  }
  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const verticalSpan = Math.max(6.8, 8.8 / aspect);
    camera.left = (-verticalSpan * aspect) / 2;
    camera.right = (verticalSpan * aspect) / 2;
    camera.top = verticalSpan / 2;
    camera.bottom = -verticalSpan / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    // setSize 会清空画布，不能仅等待此前可能被离屏观察器暂停的动画帧。
    if (!disposed && !document.hidden) renderer.render(scene, camera);
    requestDraw();
  }
  container.addEventListener(
    "pointermove",
    (event) => {
      if (reducedMotion) return;
      const bounds = container.getBoundingClientRect();
      if (dragStart !== null) {
        targetRotation = THREE.MathUtils.clamp(
          dragRotation + (event.clientX - dragStart) / bounds.width,
          -0.55,
          0.55,
        );
      } else if (event.pointerType === "mouse") {
        targetRotation =
          ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.28;
        targetTilt =
          ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.05;
      }
      requestDraw();
    },
    listenerOptions,
  );
  container.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || reducedMotion) return;
      dragStart = event.clientX;
      dragRotation = room.rotation.y;
      container.setPointerCapture(event.pointerId);
    },
    listenerOptions,
  );
  function endDrag() {
    dragStart = null;
  }
  container.addEventListener("pointerup", endDrag, listenerOptions);
  container.addEventListener("pointercancel", endDrag, listenerOptions);
  container.addEventListener("lostpointercapture", endDrag, listenerOptions);
  container.addEventListener(
    "pointerleave",
    () => {
      if (dragStart === null) {
        targetRotation = 0;
        targetTilt = 0;
        requestDraw();
      }
    },
    listenerOptions,
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) requestDraw();
    },
    listenerOptions,
  );
  renderer.domElement.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      container.dataset.ready = "false";
      renderer.domElement.style.display = "none";
      document.querySelector("#studio-hint").textContent =
        "图形上下文中断，已切换静态预览";
    },
    listenerOptions,
  );
  renderer.domElement.addEventListener(
    "webglcontextrestored",
    () => {
      container.dataset.ready = "true";
      renderer.domElement.style.display = "";
      document.querySelector("#studio-hint").textContent =
        "轻轻移动鼠标 · 拖动探索工作室";
      requestDraw();
    },
    listenerOptions,
  );
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (active) requestDraw();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  visibilityObserver.observe(container);
  resize();
  renderer.render(scene, camera);
  container.dataset.ready = "true";

  return {
    reset() {
      targetRotation = 0;
      targetTilt = 0;
      requestDraw();
    },
    setReducedMotion(value) {
      reducedMotion = value;
      if (value) {
        targetRotation = 0;
        targetTilt = 0;
      }
      requestDraw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((entry) => entry.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
