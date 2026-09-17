import fs from 'fs';
import path from 'path';

/**
 * Shared File-Backed Store for Next.js API routes
 * Provides persistent circle storage across processes, worker threads, and reloads.
 */

export interface ServerCircle {
  id: string;
  name: string;
  organizer_id: string;
  contribution_amount: number;
  currency: string;
  frequency: string;
  min_members: number;
  max_members: number;
  status: string;
  payout_order: string[] | null;
  start_date: string | null;
  created_at: string;
  organizer?: any;
  memberships?: any[];
  rounds?: any[];
}

const PRIMARY_DATA_DIR = path.join(process.cwd(), '.rosco_data');
const STORE_PATH = (() => {
  try {
    if (!fs.existsSync(PRIMARY_DATA_DIR)) {
      fs.mkdirSync(PRIMARY_DATA_DIR, { recursive: true });
    }
    return path.join(PRIMARY_DATA_DIR, 'circles.json');
  } catch {
    return path.join(process.env.TEMP || '/tmp', 'rosco_circles_v1.json');
  }
})();

const globalForStore = globalThis as unknown as {
  _serverCirclesStore?: Map<string, ServerCircle>;
  _serverStoreLastMtime?: number;
};

function readDiskStore(): Map<string, ServerCircle> {
  const map = new Map<string, ServerCircle>();
  try {
    if (fs.existsSync(STORE_PATH)) {
      const stat = fs.statSync(STORE_PATH);
      globalForStore._serverStoreLastMtime = stat.mtimeMs;
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.id) map.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.warn('[Rosco ServerStore] Could not read disk store:', err);
  }
  return map;
}

function loadStore(): Map<string, ServerCircle> {
  // Always check if disk file exists and check if modified
  let shouldReload = !globalForStore._serverCirclesStore;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const stat = fs.statSync(STORE_PATH);
      if (stat.mtimeMs !== globalForStore._serverStoreLastMtime) {
        shouldReload = true;
      }
    }
  } catch {}

  if (shouldReload) {
    globalForStore._serverCirclesStore = readDiskStore();
  }

  return globalForStore._serverCirclesStore || new Map();
}

function persistStore(map: Map<string, ServerCircle>) {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const list = Array.from(map.values());
    fs.writeFileSync(STORE_PATH, JSON.stringify(list, null, 2), 'utf-8');
    try {
      const stat = fs.statSync(STORE_PATH);
      globalForStore._serverStoreLastMtime = stat.mtimeMs;
    } catch {}
  } catch (err) {
    console.warn('[Rosco ServerStore] Could not persist disk store:', err);
  }
}

export function getAllCircles(): ServerCircle[] {
  const map = loadStore();
  return Array.from(map.values());
}

export function getCircleById(id: string): ServerCircle | undefined {
  const map = loadStore();
  let found = map.get(id);
  if (!found) {
    // Force reload from disk in case another process just wrote it
    const refreshed = readDiskStore();
    globalForStore._serverCirclesStore = refreshed;
    found = refreshed.get(id);
  }
  return found;
}

export function saveCircle(circle: ServerCircle): ServerCircle {
  const map = loadStore();
  map.set(circle.id, circle);
  persistStore(map);
  return circle;
}

export function deleteCircleById(id: string): boolean {
  const map = loadStore();
  const deleted = map.delete(id);
  if (deleted) {
    persistStore(map);
  }
  return deleted;
}

export function clearAllCircles(): void {
  const map = loadStore();
  map.clear();
  try {
    if (fs.existsSync(STORE_PATH)) {
      fs.unlinkSync(STORE_PATH);
    }
    globalForStore._serverStoreLastMtime = 0;
  } catch (err) {
    console.warn('[Rosco ServerStore] Could not delete disk store:', err);
  }
}
