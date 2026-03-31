// ============================================
// IN-MEMORY CACHE SERVICE
// ============================================
// Centralized cache with dedup, groups, lazy expiry.
// API designed to be swappable with Redis later.

const MAX_ENTRIES = 5000;
const EVICT_BATCH = 500;

class CacheService {
  constructor() {
    this._store = new Map();     // key → { value, expiresAt, groups[] }
    this._inflight = new Map();  // key → Promise (dedup concurrent fetches)
    this._groups = new Map();    // groupName → Set<key>
    this._hits = 0;
    this._misses = 0;

    // Dev stats log every 5 min
    if (process.env.NODE_ENV !== 'production') {
      this._statsInterval = setInterval(() => {
        const s = this.stats();
        if (s.size > 0) {
          console.log(`[Cache] hits=${s.hits} misses=${s.misses} ratio=${s.ratio} size=${s.size}`);
        }
      }, 5 * 60 * 1000);
      if (this._statsInterval.unref) this._statsInterval.unref();
    }
  }

  /**
   * Get a cached value (returns undefined if missing or expired)
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) {
      this._misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this._delete(key);
      this._misses++;
      return undefined;
    }
    this._hits++;
    return entry.value;
  }

  /**
   * Store a value with TTL and optional group membership
   */
  set(key, value, ttlMs, groups = []) {
    // Memory safety: evict oldest entries if at capacity
    if (this._store.size >= MAX_ENTRIES && !this._store.has(key)) {
      this._evictOldest();
    }

    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      groups,
    });

    // Register key in each group
    for (const group of groups) {
      if (!this._groups.has(group)) {
        this._groups.set(group, new Set());
      }
      this._groups.get(group).add(key);
    }
  }

  /**
   * Delete a specific key
   */
  del(key) {
    return this._delete(key);
  }

  /**
   * Invalidate all keys belonging to a group
   * Returns number of keys deleted
   */
  invalidateGroup(groupName) {
    const keys = this._groups.get(groupName);
    if (!keys || keys.size === 0) return 0;

    let count = 0;
    for (const key of keys) {
      if (this._store.delete(key)) count++;
      // Also remove from _inflight so fresh fetches start
      this._inflight.delete(key);
    }
    this._groups.delete(groupName);
    return count;
  }

  /**
   * Get-or-fetch with dedup: if key is cached return it,
   * otherwise call fetchFn and cache the result.
   * Concurrent callers share the same in-flight promise.
   */
  async cached(key, ttlMs, fetchFn, opts = {}) {
    const { groups = [] } = opts;

    // Check cache first
    const hit = this.get(key);
    if (hit !== undefined) return hit;

    // Dedup: return in-flight promise if one exists
    if (this._inflight.has(key)) return this._inflight.get(key);

    // Fetch, cache, and return
    const promise = fetchFn()
      .then((value) => {
        this.set(key, value, ttlMs, groups);
        return value;
      })
      .finally(() => {
        this._inflight.delete(key);
      });

    this._inflight.set(key, promise);
    return promise;
  }

  /**
   * Cache stats for monitoring
   */
  stats() {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      ratio: total > 0 ? `${Math.round((this._hits / total) * 100)}%` : '0%',
      size: this._store.size,
    };
  }

  // --- Internal helpers ---

  _delete(key) {
    const entry = this._store.get(key);
    if (!entry) return false;

    // Remove from group sets
    for (const group of entry.groups) {
      const groupSet = this._groups.get(group);
      if (groupSet) {
        groupSet.delete(key);
        if (groupSet.size === 0) this._groups.delete(group);
      }
    }

    this._store.delete(key);
    return true;
  }

  _evictOldest() {
    const now = Date.now();
    // First pass: evict expired entries
    let evicted = 0;
    for (const [key, entry] of this._store) {
      if (evicted >= EVICT_BATCH) break;
      if (now > entry.expiresAt) {
        this._delete(key);
        evicted++;
      }
    }
    // If not enough evicted, remove oldest by insertion order
    if (evicted < EVICT_BATCH) {
      const iter = this._store.keys();
      for (let i = evicted; i < EVICT_BATCH; i++) {
        const { value: key, done } = iter.next();
        if (done) break;
        this._delete(key);
      }
    }
  }
}

const cache = new CacheService();

module.exports = cache;
module.exports.CacheService = CacheService;
