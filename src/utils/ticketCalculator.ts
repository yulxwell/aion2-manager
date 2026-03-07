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

  if (tempCount >= tracker.maxCount) {
    return {
      currentCount: tracker.maxCount,
      nextRechargeAt: null,
      remainingMinutes: null,
      limitReachedAt: null
    };
  }

  const { times, amount } = tracker.schedule;

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
