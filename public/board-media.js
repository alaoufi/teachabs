// The material and ink share one coordinate system. Camera and playback controls stay outside it.
import {fitBoard} from './group-view.js';

// Move the same controls between the normal toolbar and the enlarged video view.
function videoLayout(board, sound) {
  const app = board.closest('#gl-app');
  const play = document.getElementById('gl-file-play');
  const anchor = play || document.getElementById('gl-audio');
  const controls = document.createElement('div');
  controls.className = 'gl-video-controls';
  controls.hidden = true;
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'عرض الفيديو');
  const size = document.createElement('button');
  size.type = 'button';
  size.hidden = true;
  size.id = 'gl-video-size';
  size.className = 'gl-mini';
  size.setAttribute('aria-controls', board.id);
  const home = document.createComment('video controls');
  anchor.after(home);
  home.after(controls);
  if (play) controls.append(play);
  controls.append(sound, size);

  const phone = matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 540px)');
  let choice = null;
  function layout() {
    const expanded = !controls.hidden && (choice ?? phone.matches);
    app.classList.toggle('gl-video-expanded', expanded);
    if (expanded && controls.parentNode !== app) app.append(controls);
    if (!expanded && controls.previousSibling !== home) home.after(controls);
    size.textContent = expanded ? 'العودة للسبورة' : 'تكبير الفيديو';
    size.setAttribute('aria-expanded', String(expanded));
  }
  function toggle(expanded) {
    choice = expanded;
    layout();
    size.focus({preventScroll:true});
  }
  size.onclick = () => toggle(!app.classList.contains('gl-video-expanded'));
  app.addEventListener('keydown', event => {
    if (event.key === 'Escape' && app.classList.contains('gl-video-expanded')) {
      event.preventDefault();
      toggle(false);
    }
  });
  phone.addEventListener('change', layout);
  return isVideo => {
    choice = null;
    controls.hidden = size.hidden = !isVideo;
    layout();
  };
}

export function boardMedia(base, status, onEnded) {
  const board = document.getElementById('gl-board'), layer = document.getElementById('gl-material-layer');
  const sound = document.getElementById('gl-file-sound');
  const showVideoControls = videoLayout(board, sound);
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
      const video = material?.mime.startsWith('video/') === true;
      sound.hidden = !video;
      showVideoControls(video);
      fitBoard();
      if (!material) return;
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
