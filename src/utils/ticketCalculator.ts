import type { TrackerStatus } from '../types/game';

/**
 * 현재 시간을 기준으로 충전된 수량을 계산합니다.
 */
export function calculateCurrentStatus(tracker: TrackerStatus, nowOverride?: number): {
  currentCount: number;
  nextRechargeAt: number | null;
  remainingMinutes: number | null;
  limitReachedAt: number | null;
} {
  const now = nowOverride || Date.now();
  let tempCount = tracker.currentCount;
  let lastUpdate = tracker.lastUpdatedAt;

  const { type, times, amount, resetDay, resetHour } = tracker.schedule;

  if (type === 'weekly_reset' && resetDay !== undefined && resetHour !== undefined) {
    // Check if the current time has passed the reset time since the last update
    const lastUpdateDate = new Date(lastUpdate);
    const nowDate = new Date(now);

    // Find the most recent reset time before 'now'
    const lastResetDate = new Date(now);
    lastResetDate.setHours(resetHour, 0, 0, 0);
    
    let daysToSubtract = lastResetDate.getDay() - resetDay;
    if (daysToSubtract < 0) {
      daysToSubtract += 7;
    }
    
    // If today is the reset day but we haven't reached the reset hour yet, the last reset was a week ago
    if (daysToSubtract === 0 && nowDate.getHours() < resetHour) {
      daysToSubtract = 7;
    }

    lastResetDate.setDate(lastResetDate.getDate() - daysToSubtract);

    // If the last update was before the most recent reset time, set count to 0
    if (lastUpdateDate.getTime() < lastResetDate.getTime()) {
      tempCount = 0;
    } else {
      tempCount = tracker.currentCount;
    }

    // Calculate next recharge (next reset time)
    const nextResetDate = new Date(lastResetDate);
    nextResetDate.setDate(nextResetDate.getDate() + 7);

    return {
      currentCount: tempCount,
      nextRechargeAt: nextResetDate.getTime(),
      remainingMinutes: Math.ceil((nextResetDate.getTime() - now) / (1000 * 60)),
      limitReachedAt: null
    };
  }

  if (type === 'daily_reset' && resetHour !== undefined) {
    const lastUpdateDate = new Date(lastUpdate);
    const nowDate = new Date(now);

    const lastResetDate = new Date(now);
    lastResetDate.setHours(resetHour, 0, 0, 0);

    if (nowDate.getHours() < resetHour) {
      lastResetDate.setDate(lastResetDate.getDate() - 1);
    }

    if (lastUpdateDate.getTime() < lastResetDate.getTime()) {
      tempCount = 0;
    }

    const nextResetDate = new Date(lastResetDate);
    nextResetDate.setDate(nextResetDate.getDate() + 1);

    return {
      currentCount: tempCount,
      nextRechargeAt: nextResetDate.getTime(),
      remainingMinutes: Math.ceil((nextResetDate.getTime() - now) / (1000 * 60)),
      limitReachedAt: null
    };
  }

  if (tempCount >= tracker.maxCount) {
    return {
      currentCount: tracker.maxCount,
      nextRechargeAt: null,
      remainingMinutes: null,
      limitReachedAt: null
    };
  }

  // 안전장치: 너무 오래된 데이터일 경우 루프 방지
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  if (lastUpdate < thirtyDaysAgo) {
    lastUpdate = thirtyDaysAgo;
  }

  let currentSimTime = new Date(lastUpdate);
  currentSimTime.setMinutes(0, 0, 0);
  currentSimTime.setHours(currentSimTime.getHours() + 1);

  while (currentSimTime.getTime() <= now && tempCount < tracker.maxCount) {
    if (times.includes(currentSimTime.getHours())) {
      tempCount = Math.min(tracker.maxCount, tempCount + amount);
    }
    if (tempCount >= tracker.maxCount) break;
    currentSimTime.setHours(currentSimTime.getHours() + 1);
  }

  let nextRechargeAt: number | null = null;
  let remainingMinutes: number | null = null;
  let limitReachedAt: number | null = null;

  if (tempCount < tracker.maxCount) {
    // 다음 충전 시점 탐색
    let searchTime = new Date(now);
    searchTime.setMinutes(0, 0, 0);
    
    // 향후 충분히 긴 시간(예: 60일) 내의 충전 시점 탐색
    let foundNext = false;
    let simCount = tempCount;
    
    for (let i = 1; i <= 24 * 60; i++) {
      const testTime = new Date(searchTime.getTime() + i * 60 * 60 * 1000);
      if (times.includes(testTime.getHours())) {
        if (!foundNext) {
          nextRechargeAt = testTime.getTime();
          remainingMinutes = Math.ceil((nextRechargeAt - now) / (1000 * 60));
          foundNext = true;
        }
        
        simCount = Math.min(tracker.maxCount, simCount + amount);
        if (simCount >= tracker.maxCount) {
          limitReachedAt = testTime.getTime();
          break;
        }
      }
    }
  }

  return {
    currentCount: tempCount,
    nextRechargeAt,
    remainingMinutes,
    limitReachedAt
  };
}
