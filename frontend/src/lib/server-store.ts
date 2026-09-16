/**
 * Shared In-Memory / File Store for Next.js API routes on Vercel
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

// Global server variable across invocations
const globalForStore = globalThis as unknown as {
  _serverCirclesStore?: Map<string, ServerCircle>;
};

export const circlesMap = globalForStore._serverCirclesStore ?? new Map<string, ServerCircle>();
globalForStore._serverCirclesStore = circlesMap;

export function getAllCircles(): ServerCircle[] {
  return Array.from(circlesMap.values());
}

export function getCircleById(id: string): ServerCircle | undefined {
  return circlesMap.get(id);
}

export function saveCircle(circle: ServerCircle): ServerCircle {
  circlesMap.set(circle.id, circle);
  return circle;
}
