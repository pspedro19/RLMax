/**
 * Trading hours utilities for USDCOP market
 * Market hours: Monday-Friday, 8:00 AM - 12:55 PM Colombia Time (COT)
 */

export interface TradingSession {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  timezone: string;
  days: number[]; // 0 = Sunday, 6 = Saturday
}

// USDCOP trading session configuration
export const USDCOP_SESSION: TradingSession = {
  start: '08:00',
  end: '12:55',
  timezone: 'America/Bogota', // Colombia Time (COT)
  days: [1, 2, 3, 4, 5] // Monday to Friday
};

/**
 * Check if a given timestamp is within trading hours
 */
export function isWithinTradingHours(timestamp: Date): boolean {
  // Convert to Colombia time
  const colombiaTime = new Date(timestamp.toLocaleString("en-US", { timeZone: USDCOP_SESSION.timezone }));
  
  const day = colombiaTime.getDay();
  const hours = colombiaTime.getHours();
  const minutes = colombiaTime.getMinutes();
  
  // Check if it's a trading day
  if (!USDCOP_SESSION.days.includes(day)) {
    return false;
  }
  
  // Parse session times
  const [startHour, startMinute] = USDCOP_SESSION.start.split(':').map(Number);
  const [endHour, endMinute] = USDCOP_SESSION.end.split(':').map(Number);
  
  // Convert current time to minutes since midnight
  const currentMinutes = hours * 60 + minutes;
  const sessionStart = startHour * 60 + startMinute;
  const sessionEnd = endHour * 60 + endMinute;
  
  return currentMinutes >= sessionStart && currentMinutes <= sessionEnd;
}

/**
 * Get next trading session start time from a given timestamp
 */
export function getNextTradingSession(from: Date): Date {
  const colombiaTime = new Date(from.toLocaleString("en-US", { timeZone: USDCOP_SESSION.timezone }));
  const [startHour, startMinute] = USDCOP_SESSION.start.split(':').map(Number);
  
  // Start from next day if after trading hours
  let nextSession = new Date(colombiaTime);
  const currentMinutes = colombiaTime.getHours() * 60 + colombiaTime.getMinutes();
  const sessionStart = startHour * 60 + startMinute;
  
  if (currentMinutes >= sessionStart) {
    nextSession.setDate(nextSession.getDate() + 1);
  }
  
  // Set to session start time
  nextSession.setHours(startHour, startMinute, 0, 0);
  
  // Find next trading day
  while (!USDCOP_SESSION.days.includes(nextSession.getDay())) {
    nextSession.setDate(nextSession.getDate() + 1);
  }
  
  return nextSession;
}

/**
 * Filter data points to only include those within trading hours
 */
export function filterTradingHours<T extends { datetime: string }>(data: T[]): T[] {
  return data.filter(point => isWithinTradingHours(new Date(point.datetime)));
}

/**
 * Get trading session info for display
 */
export function getTradingSessionInfo(): {
  isOpen: boolean;
  nextOpen?: Date;
  timeToOpen?: number; // milliseconds
  currentSession?: string;
} {
  const now = new Date();
  const isOpen = isWithinTradingHours(now);
  
  if (isOpen) {
    return {
      isOpen: true,
      currentSession: `${USDCOP_SESSION.start} - ${USDCOP_SESSION.end} COT`
    };
  }
  
  const nextOpen = getNextTradingSession(now);
  return {
    isOpen: false,
    nextOpen,
    timeToOpen: nextOpen.getTime() - now.getTime(),
    currentSession: 'Market Closed'
  };
}

/**
 * Format time until next session
 */
export function formatTimeToOpen(milliseconds: number): string {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  return `${hours}h ${minutes}m`;
}