export interface RechargeSchedule {
  type: 'fixed_times';
  times: number[]; // Hours in 0-23 KST
  amount: number;
}

export interface TrackerStatus {
  id: string;
  name: string;
  currentCount: number;
  maxCount: number;
  lastUpdatedAt: number; // Timestamp
  schedule: RechargeSchedule;
}

export interface Character {
  id: string;
  name: string;
  server: string;
  class: string;
  trackers: TrackerStatus[];
}

export interface Account {
  id: string;
  name: string;
  characters: Character[];
}

export const AION2_SERVERS = [
  '시엘 [천]', '네자칸 [천]', '바이젤 [천]', '카이시넬 [천]', '유스티엘 [천]', '아리엘 [천]', '프레기온 [천]', '메스람타에다 [천]', '히타니에 [천]', '나니아 [천]', '타하바타 [천]', '루터스 [천]', '페르노스 [천]', '다미누 [천]', '카사카 [천]', '바카르마 [천]', '챈가룽 [천]', '코치룽 [천]', '이슈타르 [천]', '티아마트 [천]',
  '이스라펠 [마]', '지켈 [마]', '트리니엘 [마]', '루미엘 [마]', '마르쿠탄 [마]', '아스펠 [마]', '에레슈키갈 [마]', '브리트라 [마]', '네몬 [마]', '하달 [마]', '루드라 [마]', '울고른 [마]', '무닌 [마]', '오다르 [마]', '젠카카 [마]', '크로메데 [마]', '콰이링 [마]', '바바룽 [마]', '파프니르 [마]', '인드나흐 [마]'
];

export const AION2_CLASSES = [
  '검성', '수호성', '살성', '궁성', '마도성', '정령성', '호법성', '치유성'
];

export const INITIAL_TRACKERS: Omit<TrackerStatus, 'lastUpdatedAt'>[] = [
  { 
    id: 'conquest', 
    name: '정복티켓', 
    currentCount: 0, 
    maxCount: 21, 
    schedule: { type: 'fixed_times', times: [5, 13, 21], amount: 1 } 
  },
  { 
    id: 'ode', 
    name: '오드에너지', 
    currentCount: 0, 
    maxCount: 840, 
    schedule: { type: 'fixed_times', times: [2, 5, 8, 11, 14, 17, 20, 23], amount: 15 } 
  },
  { 
    id: 'transcendence', 
    name: '초월', 
    currentCount: 0, 
    maxCount: 14, 
    schedule: { type: 'fixed_times', times: [5], amount: 2 } 
  },
  { 
    id: 'nightmare', 
    name: '악몽', 
    currentCount: 0, 
    maxCount: 14, 
    schedule: { type: 'fixed_times', times: [5], amount: 2 } 
  },
  { 
    id: 'shugo', 
    name: '슈고페스타', 
    currentCount: 0, 
    maxCount: 14, 
    schedule: { type: 'fixed_times', times: [5], amount: 4 } 
  },
];
