interface CachedSummary {
  summary: string;
  timestamp: number;
  docId: string;
  scope: string;
  expiresAt: number;
  userId?: string;
}

interface SummaryCache {
  [key: string]: CachedSummary;
}

class SummaryCacheManager {
  private static instance: SummaryCacheManager;
  private readonly CACHE_KEY = 'ebook_assistant_summaries';
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  private constructor() {}

  static getInstance(): SummaryCacheManager {
    if (!SummaryCacheManager.instance) {
      SummaryCacheManager.instance = new SummaryCacheManager();
    }
    return SummaryCacheManager.instance;
  }

  private getCache(): SummaryCache {
    if (typeof window === 'undefined') return {};
    
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('Failed to parse summary cache:', error);
      return {};
    }
  }

  private saveCache(cache: SummaryCache): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to save summary cache:', error);
    }
  }

  private generateCacheKey(docId: string, scope: string, userId?: string): string {
    const userIdPart = userId ? `_${userId}` : '';
    return `${docId}_${scope}${userIdPart}`;
  }

  private isExpired(cachedItem: CachedSummary): boolean {
    return Date.now() > cachedItem.expiresAt;
  }

  private cleanExpiredEntries(): void {
    const cache = this.getCache();
    const now = Date.now();
    let hasExpiredEntries = false;

    Object.keys(cache).forEach(key => {
      if (this.isExpired(cache[key])) {
        delete cache[key];
        hasExpiredEntries = true;
      }
    });

    if (hasExpiredEntries) {
      this.saveCache(cache);
    }
  }

  getSummary(docId: string, scope: string = 'full', userId?: string): string | null {
    this.cleanExpiredEntries();
    
    const cache = this.getCache();
    const cacheKey = this.generateCacheKey(docId, scope, userId);
    const cachedItem = cache[cacheKey];

    if (!cachedItem || this.isExpired(cachedItem)) {
      return null;
    }

    // Ensure this cache belongs to the current user
    if (userId && cachedItem.userId !== userId) {
      return null;
    }

    return cachedItem.summary;
  }

  setSummary(docId: string, summary: string, scope: string = 'full', userId?: string, ttl?: number): void {
    const cache = this.getCache();
    const cacheKey = this.generateCacheKey(docId, scope, userId);
    const expirationTime = ttl || this.DEFAULT_TTL;

    cache[cacheKey] = {
      summary,
      timestamp: Date.now(),
      docId,
      scope,
      expiresAt: Date.now() + expirationTime,
      userId,
    };

    this.saveCache(cache);
  }

  removeSummary(docId: string, scope: string = 'full', userId?: string): void {
    const cache = this.getCache();
    const cacheKey = this.generateCacheKey(docId, scope, userId);
    
    if (cache[cacheKey]) {
      delete cache[cacheKey];
      this.saveCache(cache);
    }
  }

  removeAllSummariesForDocument(docId: string, userId?: string): void {
    const cache = this.getCache();
    let hasChanges = false;

    Object.keys(cache).forEach(key => {
      const item = cache[key];
      if (item.docId === docId && (!userId || item.userId === userId)) {
        delete cache[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.saveCache(cache);
    }
  }

  clearAllCache(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.CACHE_KEY);
    }
  }

  clearUserCache(userId: string): void {
    const cache = this.getCache();
    let hasChanges = false;

    Object.keys(cache).forEach(key => {
      if (cache[key].userId === userId) {
        delete cache[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.saveCache(cache);
    }
  }

  getCacheStats(userId?: string): {
    totalEntries: number;
    expiredEntries: number;
    cacheSize: string;
    userEntries: number;
  } {
    const cache = this.getCache();
    let entries = Object.values(cache);
    
    // Filter by user if provided
    if (userId) {
      entries = entries.filter(entry => entry.userId === userId);
    }
    
    const expiredEntries = entries.filter(entry => this.isExpired(entry));
    
    let cacheSize = '0 KB';
    if (typeof window !== 'undefined') {
      try {
        const cacheString = localStorage.getItem(this.CACHE_KEY) || '';
        cacheSize = `${(cacheString.length / 1024).toFixed(2)} KB`;
      } catch (error) {
        cacheSize = 'Unknown';
      }
    }

    return {
      totalEntries: Object.values(cache).length,
      userEntries: entries.length,
      expiredEntries: expiredEntries.length,
      cacheSize,
    };
  }

  isCached(docId: string, scope: string = 'full', userId?: string): boolean {
    return this.getSummary(docId, scope, userId) !== null;
  }
}

// Export singleton instance
export const summaryCache = SummaryCacheManager.getInstance();

// Export types for use in other files
export type { CachedSummary, SummaryCache };

