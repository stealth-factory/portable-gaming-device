/* Web app mode: offline cache, background updates and the install button.
   The service worker is generated at build time by vite-plugin-pwa; this file only talks to it.
   Messages appear on the set's status badge, in the chosen language. */
import { registerSW } from 'virtual:pwa-register';
import { I18N, lang, track, trToast, layoutName } from './core';

const t = (k: string) => I18N[lang][k];

// opened from a home-screen icon rather than a browser tab
const nav = navigator as Navigator & { standalone?: boolean };
if (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || nav.standalone) {
  track('launch_installed', { layout: layoutName() });
}

// install button beside the language switch, when the browser offers it
let deferred: any = null, installBtn: HTMLButtonElement | null = null;
addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault(); deferred = e;
  if (installBtn) { installBtn.hidden = false; return; }
  const right = document.querySelector('.bar-right'), langSeg = document.getElementById('langSeg');
  if (!right || !langSeg) return;
  installBtn = document.createElement('button'); installBtn.type = 'button'; installBtn.className = 'install-btn'; installBtn.textContent = t('install');
  installBtn.onclick = () => {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then((c: any) => track('install_prompt', { outcome: c && c.outcome })).finally(() => { deferred = null; if (installBtn) installBtn.hidden = true; });
  };
  right.insertBefore(installBtn, langSeg);
});
addEventListener('appinstalled', () => { if (installBtn) installBtn.hidden = true; track('app_installed'); });
document.addEventListener('click', e => {   // keep the install label in the chosen language
  if (installBtn && (e.target as Element).closest?.('#langSeg')) setTimeout(() => { if (installBtn) installBtn.textContent = t('install'); }, 0);
});

// no service worker in the self-hosted console (npm run build:console): the site around it owns its offline story
if (import.meta.env.PUBLIC_PGD_CONSOLE_BUILD !== '1' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const updateSW = registerSW({
    immediate: true,   // register now rather than after window load (a slow font request can hold that up)
    // a new version has downloaded: offer a restart rather than cutting a game off mid-level
    onNeedRefresh() {
      trToast(t('update'), { state: 'info', button: t('restart'), onClick: () => { track('update_applied'); updateSW(true); } });
    },
    onOfflineReady() {
      try {
        if (localStorage.getItem('gg-offline')) return;
        localStorage.setItem('gg-offline', '1');
      } catch (_) {}
      trToast(t('ready'), { state: 'on', ms: 5000 });
      track('offline_ready');
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
      addEventListener('online', check);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(() => { if (document.visibilityState === 'visible') check(); }, 30 * 60 * 1000);
    },
  });
}
