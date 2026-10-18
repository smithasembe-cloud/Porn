import type { Media } from '@workspace/api-client-react';

export type OfflineSaveResult =
  | { ok: true; offlineImageAvailable: boolean; message: string }
  | { ok: false; reason: string; message: string };

type WorkerReply = OfflineSaveResult;

async function sendToServiceWorker(message: Record<string, unknown>): Promise<WorkerReply> {
  if (!('serviceWorker' in navigator)) {
    return { ok: false, reason: 'unsupported', message: 'Offline saving is not supported in this browser.' };
  }

  try {
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return { ok: false, reason: 'not-installed', message: 'Install Picha Pulse or open it once online before saving offline.' };
    }
    let worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) {
      const readyRegistration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), 8000)),
      ]);
      if (readyRegistration) registration = readyRegistration;
      worker = navigator.serviceWorker.controller || registration.active;
    }
    if (!worker) {
      return { ok: false, reason: 'not-ready', message: 'Install or reopen Picha Pulse before saving offline.' };
    }

    return await new Promise<WorkerReply>((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.close();
        resolve({ ok: false, reason: 'timeout', message: 'Offline saving took too long. Please try again.' });
      }, 15000);

      channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
        window.clearTimeout(timeout);
        channel.port1.close();
        resolve(event.data);
      };

      worker.postMessage(message, [channel.port2]);
    });
  } catch {
    return { ok: false, reason: 'unavailable', message: 'Offline storage is not available right now.' };
  }
}

export async function saveMediaForOffline(media: Media): Promise<OfflineSaveResult> {
  if (!navigator.onLine) {
    return { ok: false, reason: 'offline', message: 'Reconnect to save this moment for offline viewing.' };
  }

  try {
    await navigator.storage?.persist?.();
  } catch {
    // The browser may decline persistent storage; bounded Cache Storage still works.
  }

  return sendToServiceWorker({ type: 'SAVE_MEDIA_FOR_OFFLINE', media });
}

export async function removeMediaFromOffline(id: number): Promise<void> {
  await sendToServiceWorker({ type: 'REMOVE_MEDIA_FROM_OFFLINE', id });
}
