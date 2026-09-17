import fs from 'fs';
import path from 'path';

/**
 * Shared File-Backed & In-Memory Store for Next.js API routes on Vercel
 * Provides global circle persistence so users on different devices
 * can create, invite, join, and view circles seamlessly.
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

const STORE_PATH = path.join(process.env.TEMP || '/tmp', 'rosco_circles_v1.json');

// Global server variable across invocations in the same process
const globalForStore = globalThis as unknown as {
  _serverCirclesStore?: Map<string, ServerCircle>;
};

function loadStore(): Map<string, ServerCircle> {
  if (globalForStore._serverCirclesStore && globalForStore._serverCirclesStore.size > 0) {
    return globalForStore._serverCirclesStore;
  }
  const map = new Map<string, ServerCircle>();
  try {
    if (fs.existsSync(STORE_PATH)) {
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
  globalForStore._serverCirclesStore = map;
  return map;
}

function persistStore(map: Map<string, ServerCircle>) {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(STORE_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Rosco ServerStore] Could not persist disk store:', err);
  }
}

export const circlesMap = loadStore();

export function getAllCircles(): ServerCircle[] {
  const map = loadStore();
  return Array.from(map.values());
}

export function getCircleById(id: string): ServerCircle | undefined {
  const map = loadStore();
  let found = map.get(id);
  if (!found) {
    // try reload from disk in case another process wrote it
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.id) map.set(item.id, item);
          }
        }
        found = map.get(id);
      }
    } catch {}
  }
  return found;
}

export function saveCircle(circle: ServerCircle): ServerCircle {
  const map = loadStore();
  map.set(circle.id, circle);
  persistStore(map);
  return circle;
}
