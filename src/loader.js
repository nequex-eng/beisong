// 读manifest、加载GLB（含gzip解压）、单个失败重试一次
import { GLTFLoader } from '../vendor/GLTFLoader.js';

export async function loadManifest(url = './assets/manifest.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('清单加载失败：' + res.status);
  return res.json();
}

// 加载指定场景的全部模型，逐个加载方便报进度；
// 单个失败重试一次，再失败就跳过该模型，游戏继续玩
export async function loadSceneModels(manifest, sceneId, onProgress) {
  const scene = (manifest.scenes || []).find((s) => s.id === sceneId);
  const ids = scene ? scene.assets || [] : [];
  const byId = new Map((manifest.assets || []).map((a) => [a.id, a]));
  const loader = new GLTFLoader();
  const models = new Map();
  const failed = [];
  let done = 0;
  for (const id of ids) {
    const asset = byId.get(id);
    if (!asset) {
      failed.push({ id, name: id, error: '清单里没有这条记录' });
    } else {
      try {
        const gltf = await loadOne(loader, asset);
        models.set(id, gltf);
      } catch (err) {
        failed.push({ id, name: asset.name || id, error: String(err && err.message ? err.message : err) });
      }
    }
    done++;
    if (onProgress) onProgress(done, ids.length, id);
  }
  return { models, failed };
}

async function loadOne(loader, asset, retried = false) {
  try {
    let buf = await fetchArrayBuffer(asset.url);
    if (asset.encoding === 'gzip') buf = await gunzip(buf);
    return await new Promise((resolve, reject) => {
      loader.parse(buf, dirOf(asset.url), resolve, reject);
    });
  } catch (err) {
    if (!retried) return loadOne(loader, asset, true);
    throw err;
  }
}

async function fetchArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('下载失败：' + res.status);
  return res.arrayBuffer();
}

async function gunzip(buf) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('浏览器不支持gzip解压');
  }
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

function dirOf(url) {
  const i = url.lastIndexOf('/');
  return i >= 0 ? url.slice(0, i + 1) : '';
}
