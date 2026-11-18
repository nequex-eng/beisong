// 玩家：走动、跟随相机。WASD加方向键、触屏摇杆都汇到input向量（main.js填）。
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeBlobShadow } from './scene-river.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  // 简易人物：青布衣圆柱身体、头、帽
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 0.9, 12),
    new THREE.MeshStandardMaterial({ color: 0x2e6f6a, roughness: 0.9 }),
  );
  body.position.y = 0.75;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8c39a, roughness: 0.8 }),
  );
  head.position.y = 1.45;
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.25, 16),
    new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }),
  );
  hat.position.y = 1.68;
  group.add(body, head, hat);
  group.add(makeBlobShadow(0.9));
  group.position.set(0, 0, 12);
  scene.add(group);

  return {
    group,
    pos: group.position,
    update(dt, input, now) {
      const len = Math.hypot(input.x, input.z);
      if (len > 0.01) {
        const nx = input.x / Math.max(1, len);
        const nz = input.z / Math.max(1, len);
        group.position.x += nx * CONFIG.playerSpeed * dt;
        group.position.z += nz * CONFIG.playerSpeed * dt;
        group.rotation.y = Math.atan2(nx, nz);
        body.position.y = 0.75 + Math.abs(Math.sin(now * 0.012)) * 0.05;
      }
      const b = CONFIG.playerBounds;
      group.position.x = Math.min(b.maxX, Math.max(b.minX, group.position.x));
      group.position.z = Math.min(b.maxZ, Math.max(b.minZ, group.position.z));
    },
  };
}
