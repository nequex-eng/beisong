// 第一幕：虹桥汴河。程序化地面、汴河（流动着色器）、石板街、暖阳灯光加雾，
// GLB按manifest的位置、旋转、缩放摆放。加新资产只改manifest，不改这里。
import * as THREE from 'three';

let blobTex = null;

function getBlobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

// 圆形假阴影（低端模式默认，无实时阴影）
export function makeBlobShadow(radius) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: getBlobTexture(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

function makeStoneTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8d8271';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v = 150 + Math.floor(Math.random() * 40);
      g.fillStyle = 'rgb(' + v + ',' + (v - 12) + ',' + (v - 38) + ')';
      g.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRiver() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader:
      'varying vec2 vUv;\n' +
      'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform float uTime;\n' +
      'varying vec2 vUv;\n' +
      'void main(){\n' +
      '  float flow = sin(vUv.x * 90.0 - uTime * 1.6 + sin(vUv.y * 24.0 + uTime * 0.8) * 1.5);\n' +
      '  float band = 0.5 + 0.5 * flow;\n' +
      '  vec3 deep = vec3(0.16, 0.35, 0.38);\n' +
      '  vec3 light = vec3(0.45, 0.68, 0.66);\n' +
      '  vec3 col = mix(deep, light, band * 0.6);\n' +
      '  float edge = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);\n' +
      '  col = mix(vec3(0.85, 0.78, 0.60), col, edge);\n' +
      '  gl_FragColor = vec4(col, 1.0);\n' +
      '}',
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 12), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.06, 0);
  return mesh;
}

export function buildRiverScene(manifest, models) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3dfae);
  scene.fog = new THREE.Fog(0xf3dfae, 60, 160);

  // 暖阳：半球光加一盏斜阳（低端模式不开实时阴影）
  const hemi = new THREE.HemisphereLight(0xfff2d0, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0a0, 1.6);
  sun.position.set(30, 40, 20);
  sun.castShadow = false;
  scene.add(sun);

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 130),
    new THREE.MeshStandardMaterial({ color: 0xcbb98a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // 汴河（沿X轴，宽12）
  const river = makeRiver();
  scene.add(river);

  // 石板街：北岸一条，南岸一条
  const streetMat = new THREE.MeshStandardMaterial({ map: makeStoneTexture(), roughness: 1 });
  const streetN = new THREE.Mesh(new THREE.PlaneGeometry(120, 8), streetMat);
  streetN.rotation.x = -Math.PI / 2;
  streetN.position.set(0, 0.04, 12);
  scene.add(streetN);
  const streetS = new THREE.Mesh(new THREE.PlaneGeometry(120, 8), streetMat);
  streetS.rotation.x = -Math.PI / 2;
  streetS.position.set(0, 0.04, -12);
  scene.add(streetS);

  // 按manifest摆GLB
  const placed = [];
  const riverAssets = (manifest.assets || []).filter((a) => a.scene === 'river');
  for (const asset of riverAssets) {
    const gltf = models.get(asset.id);
    if (!gltf) continue;
    const obj = gltf.scene;
    obj.position.set(asset.position[0], 0, asset.position[1]);
    obj.rotation.y = asset.rotationY || 0;
    obj.scale.setScalar(asset.scale || 1);
    scene.add(obj);
    // 桥跨在河上不加假阴影，其余模型按包围盒加一块
    if (asset.category !== 'bridges') {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const w = Math.max(size.x, 2);
      const d = Math.max(size.z, 2);
      const blob = makeBlobShadow(1);
      blob.scale.set(w / 2, d / 2, 1);
      blob.position.set(center.x, 0.03, center.z);
      scene.add(blob);
    }
    placed.push(asset.id);
  }

  return {
    scene,
    sun,
    placed,
    update(_dt, t) {
      river.material.uniforms.uTime.value = t;
    },
    // 高清模式：开实时阴影（main.js调）
    setShadows(on) {
      sun.castShadow = on;
      if (on) {
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -60;
        sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -60;
        sun.shadow.camera.far = 150;
      }
      scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.isShaderMaterial !== true) {
          o.castShadow = on && o !== ground;
          o.receiveShadow = on;
          o.material.needsUpdate = true;
        }
      });
      ground.castShadow = false;
      ground.receiveShadow = true;
    },
  };
}
