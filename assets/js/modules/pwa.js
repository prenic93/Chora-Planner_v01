import { showToast } from './ui.js';

const installPrompt = document.getElementById('installPrompt');
const offlineIndicator = document.getElementById('offlineIndicator');

let deferredPrompt;

export function initPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installPrompt.classList.remove('hidden');
    });

    document.getElementById('installBtn').addEventListener('click', () => {
        installPrompt.classList.add('hidden');
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
            deferredPrompt = null;
        });
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                // Check for updates
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('Nuova versione disponibile! Ricarica per aggiornare.', 'warning');
                            document.getElementById('refreshBtn').onclick = () => {
                                installingWorker.postMessage({ type: 'SKIP_WAITING' });
                            };
                        }
                    };
                };
            }).catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });

            let refreshing;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                window.location.reload();
                refreshing = true;
            });
        });
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
}

function updateOnlineStatus() {
    if (navigator.onLine) {
        offlineIndicator.classList.add('hidden');
    } else {
        offlineIndicator.classList.remove('hidden');
    }
}
