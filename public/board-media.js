// The material and ink share one coordinate system. Camera and playback controls stay outside it.
import {fitBoard} from './group-view.js';

export function boardMedia(base, status, onEnded) {
  const board = document.getElementById('gl-board'), layer = document.getElementById('gl-material-layer');
  const sound = document.getElementById('gl-file-sound');
  let key = '', node = null, current = null, received = 0;
  let soundEnabled = Boolean(board.closest('.gl-simple, .gl-simple-seat'));
  if (soundEnabled) sound.textContent = 'كتم صوت الفيديو';
  function sync() {
    if (!current?.mime.startsWith('video/') || !node?.readyState) return;
    const v = node;
    const at = Math.min(v.duration || Infinity, current.position + (current.playing ? (performance.now() - received) / 1000 : 0));
    if (Math.abs(v.currentTime - at) > (current.playing ? .65 : .12)) v.currentTime = at;
    if (!current.playing) v.pause();
    else if (v.paused && at < v.duration) v.play().catch(() => {
      if (node === v && !v.muted) { v.muted = true; soundEnabled = false; sound.textContent = 'تشغيل صوت الفيديو'; v.play().catch(() => {}); }
    });
  }
  sound.onclick = () => {
    if (!node || node.tagName !== 'VIDEO') return;
    soundEnabled = !soundEnabled; node.muted = !soundEnabled;
    sound.textContent = soundEnabled ? 'كتم صوت الفيديو' : 'تشغيل صوت الفيديو'; sync();
  };
  return {
    position: () => node?.currentTime || 0,
    duration: () => node?.duration || 0,
    update(material, focused) {
      board.classList.toggle('gl-camera-focus', Boolean(focused));
      current = material; received = performance.now();
      const nextKey = material ? material.id + ':' + material.page : '';
      if (key === nextKey) { sync(); return; }
      key = nextKey;
      if (node?.tagName === 'VIDEO') { node.pause(); node.removeAttribute('src'); node.load(); }
      node = null; layer.replaceChildren(); layer.hidden = !material;
      board.classList.toggle('gl-has-material', Boolean(material));
      board.style.removeProperty('--material-ratio');
      sound.hidden = !material?.mime.startsWith('video/');
      fitBoard();
      if (!material) return;
      const video = material.mime.startsWith('video/');
      const item = document.createElement(video ? 'video' : 'img');
      if (video) { item.playsInline = true; item.preload = 'auto'; item.muted = !soundEnabled; }
      else item.alt = 'صفحة المعلم المعروضة';
      item.addEventListener(video ? 'loadedmetadata' : 'load', () => {
        if (item !== node) return;
        const ratio = video ? item.videoWidth / item.videoHeight : item.naturalWidth / item.naturalHeight;
        if (Number.isFinite(ratio) && ratio > 0) board.style.setProperty('--material-ratio', String(ratio));
        fitBoard(); sync();
      });
      if (video) {
        item.addEventListener('canplay', sync);
        item.addEventListener('ended', () => {
          if (node === item && current?.playing) onEnded?.(current,item.currentTime);
        });
      }
      item.onerror = () => { if (node === item) status('تعذر فتح الملف على هذا الجهاز.', true); };
      node = item; layer.append(item);
      item.src = base + '/material?' + new URLSearchParams({id:material.id, page:material.page});
    }
  };
}
