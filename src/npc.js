// 摊主：茶馆摊主占位人物（程序化简易人物：圆柱身体加布衣颜色）。
// 第三批角色GLB到了，直接调loadCharacterGLB换掉占位人物，接口已留好。
import * as THREE from 'three';
import { makeBlobShadow } from './scene-river.js';

const LINES = [
  '客官，汴河边上就数我这茶香，来一盏？',
  '今儿行市不错，丝绸茶叶都好卖。',
  '砍价归砍价，别砍得我连房租都交不起啊。',
  '声望高了，我给你便宜些，熟客嘛。',
  '天黑就打烊，房租40文，可别忘了。',
];

export function createStallOwner(scene, opts) {
  const position = (opts && opts.position) || [24, -6];
  const name = (opts && opts.name) || '茶馆摊主';
  const group = new THREE.Group();
  // 赭色布衣身体、头、方巾帽
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.46, 0.95, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.9 }),
  );
  body.position.y = 0.78;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8c39a, roughness: 0.8 }),
  );
  head.position.y = 1.5;
  const hat = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.12, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x3e4a5a, roughness: 1 }),
  );
  hat.position.y = 1.74;
  group.add(body, head, hat);
  group.add(makeBlobShadow(0.95));
  group.position.set(position[0], 0, position[1]);
  group.rotation.y = Math.PI;
  scene.add(group);

  return {
    group,
    name,
    pos: group.position,
    talk() {
      return LINES[Math.floor(Math.random() * LINES.length)];
    },
    update(t) {
      body.position.y = 0.78 + Math.sin(t * 1.8) * 0.02;
    },
  };
}

// 以后换GLB角色：传角色GLB的url，返回加载好的group（调用方替换占位人物即可）
export async function loadCharacterGLB(url) {
  const { GLTFLoader } = await import('../vendor/GLTFLoader.js');
  const loader = new GLTFLoader();
  const res = await fetch(url);
  if (!res.ok) throw new Error('角色加载失败：' + res.status);
  const buf = await res.arrayBuffer();
  return new Promise((resolve, reject) => {
    loader.parse(buf, '', (gltf) => resolve(gltf.scene), reject);
  });
}
