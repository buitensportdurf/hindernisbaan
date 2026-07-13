const PROBE = 'durf:__probe__';

export function isLocalStorageAvailable(): boolean {
  try {
    localStorage.setItem(PROBE, '1');
    localStorage.removeItem(PROBE);
    return true;
  } catch {
    return false;
  }
}

export function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeKey(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* best effort */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* best effort */
  }
}
