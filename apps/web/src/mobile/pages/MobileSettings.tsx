import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { flushQueue, getQueueSize } from '../offlineQueue';
import { useTheme } from '../../contexts/ThemeContext';

function canShare() {
  return typeof navigator !== 'undefined' && !!(navigator as any).share;
}

function canPush() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

function canWebAuthn() {
  return typeof window !== 'undefined' && !!(window as any).PublicKeyCredential && !!navigator.credentials;
}

export default function MobileSettings() {
  const { theme, toggle } = useTheme();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [installPromptAvailable, setInstallPromptAvailable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [queueSize, setQueueSize] = useState(() => getQueueSize());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setQueueSize(getQueueSize()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallPromptAvailable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstallPromptAvailable(false);
  };

  return (
    <div>
      <div className="m-page-title">
        <h1>Settings</h1>
      </div>

      <div className="m-card" style={{ marginBottom: 12 }}>
        <div className="m-card-title">Status</div>
        <div style={{ color: online ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
          {online ? 'Online' : 'Offline'}
        </div>
        <p className="m-card-description">
          Offline mode uses caching and will queue some actions while you're disconnected (we'll wire full sync next).
        </p>
        <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
          Queued actions: <b>{queueSize}</b>
        </div>
        <button
          className="m-btn primary"
          disabled={!online || syncing || queueSize === 0}
          onClick={async () => {
            setSyncing(true);
            setSyncMsg(null);
            try {
              const result = await flushQueue(async (req) => {
                await apiClient.request({
                  method: req.method,
                  url: req.url,
                  data: req.body,
                });
              });
              setSyncMsg(`Synced: ${result.sent}, Failed: ${result.failed}`);
            } catch (e: any) {
              setSyncMsg(e?.message || 'Sync failed');
            } finally {
              setSyncing(false);
              setQueueSize(getQueueSize());
            }
          }}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {syncMsg && (
          <div style={{ fontSize: 13, paddingTop: 10, color: 'var(--text-muted)' }}>{syncMsg}</div>
        )}
      </div>

      <div className="m-card" style={{ marginBottom: 12 }}>
        <div className="m-card-title">Install</div>
        <p className="m-card-description">
          Add Aegis to your home screen for an app-like experience.
        </p>
        <button className="m-btn primary" disabled={!installPromptAvailable} onClick={triggerInstall}>
          {installPromptAvailable ? 'Install app' : 'Install not available'}
        </button>
      </div>

      <div className="m-card" style={{ marginBottom: 12 }}>
        <div className="m-card-title">Theme</div>
        <p className="m-card-description">
          Current: <b>{theme}</b>
        </p>
        <button className="m-btn" onClick={toggle}>
          Toggle light/dark
        </button>
      </div>

      <div className="m-card">
        <div className="m-card-title">Sharing</div>
        <p className="m-card-description">
          Share documents via the native share sheet (when supported).
        </p>
        <button
          className="m-btn"
          disabled={!canShare()}
          onClick={async () => {
            try {
              await (navigator as any).share({
                title: 'Aegis AI',
                text: 'Open Aegis AI mobile web',
                url: window.location.origin + '/m',
              });
            } catch {
              // ignore
            }
          }}
        >
          {canShare() ? 'Test share sheet' : 'Share not supported'}
        </button>
      </div>

      <div className="m-card" style={{ marginTop: 12 }}>
        <div className="m-card-title">Notifications (Push)</div>
        <p className="m-card-description">
          Enable push notifications for critical risk changes and reminders.
        </p>
        <button
          className="m-btn"
          disabled={!canPush()}
          onClick={async () => {
            try {
              const perm = await Notification.requestPermission();
              if (perm !== 'granted') {
                setSyncMsg('Notifications permission not granted');
                return;
              }

              // Push subscriptions require a VAPID public key; if not configured,
              // we still support local notifications as a baseline.
              const vapidPublicKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
              if (!vapidPublicKey) {
                setSyncMsg('Local notifications enabled (push server key not configured)');
                new Notification('Aegis AI', { body: 'Notifications are enabled on this device.' });
                return;
              }

              const reg = await navigator.serviceWorker.ready;
              const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey,
              });

              await apiClient.post('/api/mobile/push/subscribe', { subscription: sub });
              setSyncMsg('Push enabled');
            } catch (e: any) {
              setSyncMsg(e?.message || 'Failed to enable push');
            }
          }}
        >
          {canPush() ? 'Enable push' : 'Push not supported'}
        </button>
      </div>

      <div className="m-card" style={{ marginTop: 12 }}>
        <div className="m-card-title">Biometric (WebAuthn)</div>
        <p className="m-card-description">
          Enable Face ID / Touch ID / fingerprint where supported by your browser.
        </p>
        <button
          className="m-btn"
          disabled={!canWebAuthn()}
          onClick={async () => {
            try {
              const challengeResp = await apiClient.post('/api/mobile/webauthn/challenge', {});
              const challenge = challengeResp.data?.challenge as string | undefined;
              if (!challenge) throw new Error('Missing challenge');

              // Minimal demo request; production needs rpId, user id, etc.
              await navigator.credentials.create({
                publicKey: {
                  challenge: Uint8Array.from(atob(challenge.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
                  rp: { name: 'Aegis AI' },
                  user: {
                    id: new Uint8Array([1, 2, 3, 4]),
                    name: 'user',
                    displayName: 'User',
                  },
                  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
                  timeout: 60000,
                  authenticatorSelection: { userVerification: 'preferred' },
                } as any,
              });

              await apiClient.post('/api/mobile/webauthn/verify', {});
              setSyncMsg('Biometric enabled');
            } catch (e: any) {
              setSyncMsg(e?.message || 'Failed to enable biometric');
            }
          }}
        >
          {canWebAuthn() ? 'Enable biometrics' : 'Biometrics not supported'}
        </button>
      </div>
    </div>
  );
}

