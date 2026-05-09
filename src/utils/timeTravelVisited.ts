/**
 * Minimalna lista odwiedzonych scen (tylko klucze) — bez treści czatu.
 * Zob. docs/TRUST_PRIVACY_BASELINE.md
 */

const STORAGE_KEY = 'historychat_tt_visited_scenes_v1';
const MAX_KEYS = 200;

export function sceneKey(year: string, location: string): string {
  const y = parseInt(year, 10);
  if (Number.isNaN(y)) return '';
  const loc = location
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
  return `${y}|${loc}`;
}

export function hasVisitedScene(year: string, location: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  const k = sceneKey(year, location);
  if (!k) return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return false;
    return arr.some((x) => x === k);
  } catch {
    return false;
  }
}

export function markSceneVisited(year: string, location: string): void {
  if (typeof localStorage === 'undefined') return;
  const k = sceneKey(year, location);
  if (!k) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: string[] = [];
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed.filter((x): x is string => typeof x === 'string');
      }
    }
    if (!list.includes(k)) {
      list.push(k);
      if (list.length > MAX_KEYS) {
        list = list.slice(-MAX_KEYS);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode */
  }
}
