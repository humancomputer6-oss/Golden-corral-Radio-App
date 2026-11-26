import type { RadioTrack } from '../types/radio';

const AUDIO_CACHE_NAME = 'gc-radio-audio-v1';
const DB_NAME = 'gc-radio-offline';
const STORE_NAME = 'tracks';

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineTracks(): Promise<RadioTrack[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as RadioTrack[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveTrackOffline(track: RadioTrack): Promise<boolean> {
  try {
    if ('caches' in window) {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const response = await fetch(track.audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to cache audio (${response.status})`);
      }
      await cache.put(track.audioUrl, response.clone());
    }
    if (typeof indexedDB !== 'undefined') {
      const db = await openOfflineDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(track);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    return true;
  } catch (err) {
    console.error('Offline save failed:', err);
    return false;
  }
}

export async function removeTrackOffline(track: RadioTrack): Promise<void> {
  try {
    if ('caches' in window) {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      await cache.delete(track.audioUrl);
    }
    if (typeof indexedDB !== 'undefined') {
      const db = await openOfflineDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(track.id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch (err) {
    console.error('Offline remove failed:', err);
  }
}

export async function resolvePlayableAudioUrl(track: RadioTrack): Promise<{ url: string; fromOfflineCache: boolean }> {
  if ('caches' in window) {
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const match = await cache.match(track.audioUrl);
      if (match) {
        const blob = await match.blob();
        return { url: URL.createObjectURL(blob), fromOfflineCache: true };
      }
    } catch {
      // Fallback to direct stream URL
    }
  }
  return { url: track.audioUrl, fromOfflineCache: false };
}
