// ============================================================
// MIDA PWA Manager - da includere in tutte le pagine
// Gestisce: registrazione SW, richiesta permesso, subscription push
// ============================================================

const MIDA_PWA = (() => {

  // Chiave pubblica VAPID (generata per questo progetto)
  const VAPID_PUBLIC_KEY = 'BOy2BLW9gCSUrtIhss4Jj4oSGzlVU8xoIjleBR1Vry8Rc7RRrXmXNweczWkR1b7xdDLLjvoqVNYuna_q1fW_X8g';

  const SUPABASE_URL = 'https://pvnymhvuextryeoxgave.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mG0p-MG7h1Qik-Yn4EUV6g_buzm2plv';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  // Recupera AM corrente da sessionStorage
  function getCurrentAM() {
    try {
      const user = JSON.parse(sessionStorage.getItem('midaUser') || '{}');
      return user.username || null; // es: giancarlo.novara
    } catch { return null; }
  }

  // Converti username in chiave AM (stesso schema della pipeline)
  function usernameToAmKey(username) {
    const map = {
      'laura.pieralisi': 'laura_pieralisi',
      'pierpaolo.griva': 'pierpaolo_griva',
      'susanna.gansin': 'susanna_gansin',
      'sara.reggiani': 'sara_reggiani',
      'nathalie.ospina': 'nathalie_ospina',
      'daniele.dal.pozzo': 'daniele_dal_pozzo',
      'daniele.de.felice': 'daniele_de_felice'
    };
    return map[username] || username.replace(/\./g, '_');
  }

  // Salva subscription in Supabase
  async function saveSubscription(subscription, amKey) {
    const body = {
      am_key: amKey,
      endpoint: subscription.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
      auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
      updated_at: new Date().toISOString()
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[PWA] Errore salvataggio subscription:', err);
    } else {
      console.log('[PWA] Subscription salvata per AM:', amKey);
    }
  }

  // Registra Service Worker
  async function registerSW() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Worker non supportato');
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.register('/mida-sales/sw.js', { scope: '/mida-sales/' });
      console.log('[PWA] Service Worker registrato:', reg.scope);
      return reg;
    } catch (err) {
      console.error('[PWA] Registrazione SW fallita:', err);
      return null;
    }
  }

  // Chiedi permesso notifiche e crea subscription push
  async function subscribePush(reg) {
    if (!('PushManager' in window)) {
      console.warn('[PWA] Push non supportato su questo browser');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[PWA] Permesso notifiche negato');
      return null;
    }

    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('[PWA] Push subscription creata');
      return sub;
    } catch (err) {
      console.error('[PWA] Errore subscription push:', err);
      return null;
    }
  }

  // Mostra banner "Installa app" su mobile
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div style="
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
        background: #2d2654; color: white; padding: 14px 20px;
        display: flex; align-items: center; gap: 12px;
        box-shadow: 0 -4px 16px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      ">
        <span style="font-size:28px">📱</span>
        <div style="flex:1">
          <div style="font-weight:600; font-size:14px">Installa MIDA Sales</div>
          <div style="font-size:12px; opacity:0.8">Aggiungi alla schermata home per accesso rapido</div>
        </div>
        <button id="pwa-install-btn" style="
          background: #bc6c8e; border: none; color: white; padding: 8px 16px;
          border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;
        ">Installa</button>
        <button id="pwa-dismiss-btn" style="
          background: transparent; border: none; color: white; font-size: 20px;
          cursor: pointer; padding: 4px 8px; opacity: 0.7;
        ">✕</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        console.log('[PWA] Install result:', result.outcome);
        deferredPrompt = null;
      }
      banner.remove();
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      banner.remove();
      sessionStorage.setItem('pwa-banner-dismissed', '1');
    });
  }

  // Init principale - chiamato all'avvio di ogni pagina
  async function init() {
    const reg = await registerSW();
    if (!reg) return;

    // Controlla se l'utente è loggato
    const username = getCurrentAM();
    if (!username) return; // Non loggato, non chiedere notifiche

    const amKey = usernameToAmKey(username);

    // Controlla se già sottoscritto
    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      console.log('[PWA] Subscription push già attiva per', amKey);
      // Aggiorna comunque il record (potrebbe essere scaduto)
      await saveSubscription(existingSub, amKey);
      return;
    }

    // Prima visita: mostra richiesta permesso dopo 3 secondi
    setTimeout(async () => {
      const sub = await subscribePush(reg);
      if (sub) await saveSubscription(sub, amKey);
    }, 3000);
  }

  return { init, subscribePush, registerSW, getCurrentAM };
})();

// Auto-init quando la pagina è pronta
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MIDA_PWA.init());
} else {
  MIDA_PWA.init();
}
