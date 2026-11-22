import { icon } from './icons.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SPEEDS = [1, 1.25, 1.5, 0.75];
const fmt = (t) => (isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '–:––');
let current = null;

export function audioSlot(a) {
  return `<div class="audio" data-src="${esc(a.src)}" data-title="${esc(a.title || 'Audio')}"></div>`;
}

export function audioSay(src, title = 'Écouter') {
  return `<button class="say" data-src="${esc(src)}" title="${esc(title)}"></button>`;
}

export function stopAudio() {
  if (current) { current.pause(); current = null; }
}

export function hydrateAudio(root) {
  root.querySelectorAll('.say[data-src]').forEach((b) => {
    b.innerHTML = icon('volume');
    let a = null;
    b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!a) {
        a = new Audio(b.dataset.src);
        a.addEventListener('playing', () => b.classList.add('playing'));
        a.addEventListener('pause', () => b.classList.remove('playing'));
        a.addEventListener('ended', () => b.classList.remove('playing'));
        a.addEventListener('error', () => { b.classList.add('err'); b.title = 'Audio introuvable'; });
      }
      if (current && current !== a) current.pause();
      current = a;
      a.currentTime = 0;
      a.play().catch(() => b.classList.add('err'));
    });
  });
  root.querySelectorAll('.audio[data-src]').forEach((slot) => {
    const el = document.createElement('div');
    el.className = 'player';
    el.innerHTML = `
      <button class="pl-play" title="Lecture">${icon('play')}</button>
      <div class="pl-main">
        <div class="pl-top"><span class="pl-title">${esc(slot.dataset.title || 'Audio')}</span><span class="pl-time">0:00 / –:––</span></div>
        <div class="pl-track"><div class="pl-fill"></div><div class="pl-knob"></div></div>
      </div>
      <button class="pl-btn pl-back" title="Reculer de 10 s">${icon('back10')}</button>
      <button class="pl-btn pl-speed" title="Vitesse">1×</button>`;
    slot.replaceWith(el);

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = slot.dataset.src;
    const $ = (s) => el.querySelector(s);
    const play = $('.pl-play'), time = $('.pl-time'), fill = $('.pl-fill'), knob = $('.pl-knob'), track = $('.pl-track');
    let si = 0;

    const paint = () => {
      const p = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      fill.style.width = p + '%';
      knob.style.left = p + '%';
      time.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
    };
    const setIcon = () => {
      play.innerHTML = icon(audio.paused ? 'play' : 'pause');
      el.classList.toggle('playing', !audio.paused);
    };

    play.onclick = () => {
      if (audio.paused) {
        if (current && current !== audio) current.pause();
        current = audio;
        audio.play().catch(() => el.classList.add('err'));
      } else audio.pause();
    };
    $('.pl-back').onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 10); paint(); };
    $('.pl-speed').onclick = (e) => {
      si = (si + 1) % SPEEDS.length;
      audio.playbackRate = SPEEDS[si];
      e.currentTarget.textContent = String(SPEEDS[si]).replace('.', ',') + '×';
    };

    const seek = (ev) => {
      if (!audio.duration) return;
      const r = track.getBoundingClientRect();
      audio.currentTime = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * audio.duration;
      paint();
    };
    track.addEventListener('pointerdown', (ev) => {
      seek(ev);
      track.setPointerCapture(ev.pointerId);
      track.onpointermove = seek;
      track.onpointerup = () => (track.onpointermove = null);
    });

    audio.addEventListener('timeupdate', paint);
    audio.addEventListener('loadedmetadata', paint);
    audio.addEventListener('play', setIcon);
    audio.addEventListener('pause', setIcon);
    audio.addEventListener('ended', () => { audio.currentTime = 0; paint(); setIcon(); });
    audio.addEventListener('error', () => {
      el.classList.add('err');
      time.textContent = 'Fichier introuvable';
      play.disabled = true;
    });
  });
}
