export function initWindow() {
  const tauri = window.__TAURI__;
  const win = tauri?.window?.getCurrentWindow?.();
  const bind = (id, fn) => document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  if (!win) {
    document.querySelector('.win-controls').style.opacity = '.35';
    return;
  }
  bind('winMin', () => win.minimize());
  bind('winMax', () => win.toggleMaximize());
  bind('winClose', () => win.close());
}
