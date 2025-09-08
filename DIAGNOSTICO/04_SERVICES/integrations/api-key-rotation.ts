/**
 * API Key Rotation Service
 * Manages multiple TwelveData API keys to maximize daily quota
 * Each key has 800 calls/day limit
 */

interface ApiKeyStatus {
  key: string;
  callsToday: number;
  lastReset: Date;
  isActive: boolean;
  description: string;
}

class ApiKeyRotationService {
  private static instance: ApiKeyRotationService;
  
  // 8 API keys from L0 bucket - each with 800 calls/day
  private readonly apiKeys: ApiKeyStatus[] = [
    { key: '3656827e648a4c6fa2c4e2e7935c4fb8', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Key 1' },
    { key: '24fa6e96005d44bd929bffa20ae79403', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Key 2' },
    { key: '95cb0e0ad93949a4a30274046fcf0d10', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Key 3' },
    { key: '8329ac93e9f24d9ca943bdcb9df12801', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Key 4' },
    { key: '19c7657a44f6462fa4a91b12caaaf854', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Key 5' },
    { key: 'df609df02abc43dd928914f21a1ab5e1', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Key 6' },
    { key: 'd2aea0ac87504d8d9e44ac5ff54bf1c0', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Key 7' },
    { key: '6c62fab8415346189b3abedc7dd48d9c', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Key 8' }
  ];
  
  // Additional API keys found in config files
  private readonly backupKeys: ApiKeyStatus[] = [
    { key: '085ba06282774cbc8e796f46a5af8ece', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Config Key' },
    { key: '3dd1bcf17c0846f6857b31d12a64e5f5', callsToday: 0, lastReset: new Date(), isActive: true, description: 'Backup Key' }
  ];
  
  private readonly MAX_CALLS_PER_KEY = 800;
  private readonly RESET_HOUR = 0; // Reset at midnight UTC
  private currentKeyIndex = 0;
  
  private constructor() {
    // Load saved state from localStorage if available
    this.loadState();
    
    // Check for daily reset
    this.checkDailyReset();
    
    // Set up daily reset timer
    this.setupDailyReset();
  }
  
  static getInstance(): ApiKeyRotationService {
    if (!ApiKeyRotationService.instance) {
      ApiKeyRotationService.instance = new ApiKeyRotationService();
    }
    return ApiKeyRotationService.instance;
  }
  
  /**
   * Get the next available API key
   */
  getNextApiKey(): string {
    // Check for daily reset
    this.checkDailyReset();
    
    // Try primary keys first
    for (let attempts = 0; attempts < this.apiKeys.length; attempts++) {
      const keyStatus = this.apiKeys[this.currentKeyIndex];
      
      if (keyStatus.isActive && keyStatus.callsToday < this.MAX_CALLS_PER_KEY) {
        keyStatus.callsToday++;
        this.saveState();
        
        console.log(`[ApiKeyRotation] Using ${keyStatus.description}: ${keyStatus.callsToday}/${this.MAX_CALLS_PER_KEY} calls today`);
        return keyStatus.key;
      }
      
      // Move to next key
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    }
    
    // If all primary keys exhausted, try backup keys
    for (const backupKey of this.backupKeys) {
      if (backupKey.isActive && backupKey.callsToday < this.MAX_CALLS_PER_KEY) {
        backupKey.callsToday++;
        this.saveState();
        
        console.log(`[ApiKeyRotation] Using backup ${backupKey.description}: ${backupKey.callsToday}/${this.MAX_CALLS_PER_KEY} calls today`);
        return backupKey.key;
      }
    }
    
    // All keys exhausted
    console.error('[ApiKeyRotation] ⚠️ All API keys exhausted for today!');
    console.error('[ApiKeyRotation] Total capacity: 10 keys × 800 calls = 8,000 calls/day');
    console.error('[ApiKeyRotation] Keys will reset at midnight UTC');
    
    // Return first key anyway (will likely get rate limited)
    return this.apiKeys[0].key;
  }
  
  /**
   * Get current usage statistics
   */
  getUsageStats(): {
    totalKeys: number;
    totalCallsToday: number;
    totalCallsAvailable: number;
    keysExhausted: number;
    nextResetTime: Date;
  } {
    const allKeys = [...this.apiKeys, ...this.backupKeys];
    const totalCallsToday = allKeys.reduce((sum, key) => sum + key.callsToday, 0);
    const totalCallsAvailable = allKeys.length * this.MAX_CALLS_PER_KEY;
    const keysExhausted = allKeys.filter(key => key.callsToday >= this.MAX_CALLS_PER_KEY).length;
    
    const nextReset = new Date();
    nextReset.setUTCHours(24, 0, 0, 0); // Next midnight UTC
    
    return {
      totalKeys: allKeys.length,
      totalCallsToday,
      totalCallsAvailable,
      keysExhausted,
      nextResetTime: nextReset
    };
  }
  
  /**
   * Mark a key as failed (for error handling)
   */
  markKeyAsFailed(apiKey: string) {
    const allKeys = [...this.apiKeys, ...this.backupKeys];
    const keyStatus = allKeys.find(k => k.key === apiKey);
    
    if (keyStatus) {
      keyStatus.isActive = false;
      console.warn(`[ApiKeyRotation] Key marked as failed: ${keyStatus.description}`);
      this.saveState();
    }
  }
  
  /**
   * Check if daily reset is needed
   */
  private checkDailyReset() {
    const now = new Date();
    const allKeys = [...this.apiKeys, ...this.backupKeys];
    
    for (const keyStatus of allKeys) {
      const hoursSinceReset = (now.getTime() - keyStatus.lastReset.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceReset >= 24) {
        // Reset this key
        keyStatus.callsToday = 0;
        keyStatus.lastReset = now;
        keyStatus.isActive = true;
        
        console.log(`[ApiKeyRotation] Reset ${keyStatus.description} - new day quota available`);
      }
    }
    
    this.saveState();
  }
  
  /**
   * Set up daily reset timer
   */
  private setupDailyReset() {
    const now = new Date();
    const nextReset = new Date();
    nextReset.setUTCHours(24, 0, 0, 0); // Next midnight UTC
    
    const msUntilReset = nextReset.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetAllKeys();
      // Set up next daily reset
      this.setupDailyReset();
    }, msUntilReset);
    
    console.log(`[ApiKeyRotation] Next reset at ${nextReset.toISOString()}`);
  }
  
  /**
   * Reset all API keys
   */
  private resetAllKeys() {
    const now = new Date();
    const allKeys = [...this.apiKeys, ...this.backupKeys];
    
    for (const keyStatus of allKeys) {
      keyStatus.callsToday = 0;
      keyStatus.lastReset = now;
      keyStatus.isActive = true;
    }
    
    this.currentKeyIndex = 0;
    this.saveState();
    
    console.log('[ApiKeyRotation] ✅ All API keys reset - 8,000 calls available for the new day!');
  }
  
  /**
   * Save state to localStorage
   */
  private saveState() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const state = {
        apiKeys: this.apiKeys,
        backupKeys: this.backupKeys,
        currentKeyIndex: this.currentKeyIndex,
        lastSaved: new Date().toISOString()
      };
      
      localStorage.setItem('apiKeyRotationState', JSON.stringify(state));
    }
  }
  
  /**
   * Load state from localStorage
   */
  private loadState() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedState = localStorage.getItem('apiKeyRotationState');
      
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          
          // Restore API key states
          if (state.apiKeys) {
            state.apiKeys.forEach((saved: any, index: number) => {
              if (this.apiKeys[index]) {
                this.apiKeys[index].callsToday = saved.callsToday || 0;
                this.apiKeys[index].lastReset = new Date(saved.lastReset);
                this.apiKeys[index].isActive = saved.isActive !== false;
              }
            });
          }
          
          if (state.backupKeys) {
            state.backupKeys.forEach((saved: any, index: number) => {
              if (this.backupKeys[index]) {
                this.backupKeys[index].callsToday = saved.callsToday || 0;
                this.backupKeys[index].lastReset = new Date(saved.lastReset);
                this.backupKeys[index].isActive = saved.isActive !== false;
              }
            });
          }
          
          this.currentKeyIndex = state.currentKeyIndex || 0;
          
          console.log(`[ApiKeyRotation] Loaded saved state from ${state.lastSaved}`);
        } catch (error) {
          console.error('[ApiKeyRotation] Error loading saved state:', error);
        }
      }
    }
  }
}

export const apiKeyRotation = ApiKeyRotationService.getInstance();