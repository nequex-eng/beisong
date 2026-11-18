// 启动、渲染循环、30帧封顶、输入汇总（键盘加摇杆）、交互检测
import * as THREE from 'three';
import { CONFIG, initFromManifest } from './config.js';
import { loadManifest, loadSceneModels } from './loader.js';
import { buildRiverScene } from './scene-river.js';
import { createPlayer } from './player.js';
import { createStallOwner } from './npc.js';
import { Economy } from './economy.js';
import { createUI } from './ui.js';
import { getDailyPrices } from './net.js';

const input = { x: 0, z: 0 };
const keys = new Set();
const joy = { active: false, x: 0, z: 0 };

let renderer = null;
let riverScene = null;
let hdOn = false;

function setLoading(text, pct) {
  const t = document.querySelector('#loading .load-text');
  const bar = document.querySelector('#loading .load-bar');
  if (t) t.textContent = text;
  if (bar) bar.style.width = Math.round(pct) + '%';
}

function hideLoading() {
  const l = document.getElementById('loading');
  if (l) l.style.display = 'none';
}

function showFatal(msg) {
  setLoading(msg, 100);
}

async function init() {
  setLoading('读清单…', 5);
  const manifest = await loadManifest();
  initFromManifest(manifest);

  const economy = new Economy();
  economy.setPrices(await getDailyPrices(1));

  setLoading('加载场景模型…', 10);
  const { models, failed } = await loadSceneModels(manifest, 'river', (done, total) => {
    setLoading('加载模型' + done + '/' + total, 10 + (80 * done) / total);
  });

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(CONFIG.pixelRatioLow);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('app').appendChild(renderer.domElement);

  riverScene = buildRiverScene(manifest, models);
  const scene = riverScene.scene;
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);

  const player = createPlayer(scene);
  const npc = createStallOwner(scene, { position: [24, -6], name: '茶馆摊主' });

  // 调试钩子（不影响玩法）：控制台可用window.__beisong看场景和模型
  window.__beisong = {
    scene, models, player, npc, economy, riverScene,
    measure() {
      const out = {};
      for (const [id, gltf] of models) {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        out[id] = {
          x: +size.x.toFixed(2),
          y: +size.y.toFixed(2),
          z: +size.z.toFixed(2),
          pos: gltf.scene.position.toArray().map((v) => +v.toFixed(1)),
        };
      }
      return out;
    },
  };

  // ---- 界面回调 ----
  const ui = createUI({
    economy,
    onTalk() {
      ui.showTrade(npc.talk());
    },
    onBuy(id, qty) {
      if (!economy.hasAP()) {
        ui.toast('行动点用完了，打烊睡觉恢复');
        return;
      }
      if (!economy.useAP()) return;
      const r = economy.buy(id, qty, economy.buyPrice(id));
      ui.toast(r.message);
      if (economy.isWin()) {
        ui.showEnd(true);
        return;
      }
      ui.showTrade(npc.talk());
    },
    onSell(id, qty) {
      if (!economy.hasAP()) {
        ui.toast('行动点用完了，打烊睡觉恢复');
        return;
      }
      if (!economy.useAP()) return;
      const r = economy.sell(id, qty, economy.sellPrice(id));
      ui.toast(r.message);
      if (economy.isWin()) {
        ui.showEnd(true);
        return;
      }
      ui.showTrade(npc.talk());
    },
    onHaggle(kind, id, qty) {
      const r = economy.startHaggle(kind, id, qty);
      if (!r.ok) {
        ui.toast(r.message);
        return;
      }
      ui.showHaggle(r.haggle);
    },
    onHaggleOffer(factor) {
      const r = economy.haggleOffer(factor);
      ui.toast(r.message);
      if (!r.ok) return;
      if (r.accepted || r.collapsed) {
        ui.hidePanels();
        ui.updateHUD();
        if (economy.isWin()) ui.showEnd(true);
      } else if (economy.haggle) {
        ui.updateHaggle(economy.haggle);
      }
    },
    onCancelHaggle() {
      economy.cancelHaggle();
    },
    async onSleep() {
      const summary = economy.endDay();
      const isLast = economy.isGameOver();
      ui.showSettlement(summary, isLast);
    },
    async onNextDay() {
      if (economy.isWin()) {
        ui.showEnd(true);
        return;
      }
      if (economy.isGameOver()) {
        ui.showEnd(false);
        return;
      }
      economy.setPrices(await getDailyPrices(economy.day));
      ui.hidePanels();
      ui.updateHUD();
      ui.toast('第' + economy.day + '天，行市刷新了');
    },
    onToggleHD() {
      hdOn = !hdOn;
      renderer.setPixelRatio(hdOn ? Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatioHighCap) : CONFIG.pixelRatioLow);
      riverScene.setShadows(hdOn);
      return hdOn;
    },
    onRestart() {
      window.location.reload();
    },
  });

  ui.updateHUD();
  if (failed.length) ui.showLoadErrors(failed);

  // ---- 输入 ----
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') {
      tryInteract();
      return;
    }
    if (e.code === 'Escape') {
      ui.hidePanels();
      return;
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  const joyEl = document.getElementById('joystick');
  const stickEl = document.getElementById('stick');
  let joyPointer = null;
  function joyMove(e) {
    const rect = joyEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = 40;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    stickEl.style.left = 40 + dx + 'px';
    stickEl.style.top = 40 + dy + 'px';
    joy.x = dx / max;
    joy.z = dy / max;
  }
  joyEl.addEventListener('pointerdown', (e) => {
    joyPointer = e.pointerId;
    joy.active = true;
    joyEl.setPointerCapture(e.pointerId);
    joyMove(e);
  });
  joyEl.addEventListener('pointermove', (e) => {
    if (joy.active && e.pointerId === joyPointer) joyMove(e);
  });
  function joyEnd(e) {
    if (e.pointerId !== joyPointer) return;
    joy.active = false;
    joy.x = 0;
    joy.z = 0;
    stickEl.style.left = '40px';
    stickEl.style.top = '40px';
  }
  joyEl.addEventListener('pointerup', joyEnd);
  joyEl.addEventListener('pointercancel', joyEnd);

  function readKeyboard() {
    let x = 0;
    let z = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
    return { x, z };
  }

  function tryInteract() {
    if (ui.isAnyPanelOpen()) return;
    const d = Math.hypot(player.pos.x - npc.pos.x, player.pos.z - npc.pos.z);
    if (d < CONFIG.interactDistance) ui.showTrade(npc.talk());
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- 渲染循环：30帧封顶 ----
  const clock = new THREE.Clock();
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < CONFIG.frameIntervalMs) return;
    const dt = Math.min(0.1, clock.getDelta());
    last = now;
    if (joy.active) {
      input.x = joy.x;
      input.z = joy.z;
    } else {
      const k = readKeyboard();
      input.x = k.x;
      input.z = k.z;
    }
    player.update(dt, input, now);
    npc.update(now / 1000);
    riverScene.update(dt, now / 1000);
    camera.position.set(
      player.pos.x + CONFIG.cameraOffset.x,
      CONFIG.cameraOffset.y,
      player.pos.z + CONFIG.cameraOffset.z,
    );
    camera.lookAt(player.pos.x, 0, player.pos.z);
    // 靠近摊主显示交谈提示
    const d = Math.hypot(player.pos.x - npc.pos.x, player.pos.z - npc.pos.z);
    if (d < CONFIG.interactDistance && !ui.isAnyPanelOpen()) {
      ui.setPrompt('按E和茶馆摊主说话');
    } else {
      ui.setPrompt(null);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  setLoading('进汴京…', 100);
  hideLoading();
}

init().catch((err) => {
  console.error(err);
  showFatal('加载失败：' + (err && err.message ? err.message : err) + '，请用python3 -m http.server打开');
});
