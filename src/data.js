// 아버지의 공장 — 밸런스 데이터. 숫자는 여기서만 바꾼다.

export const VERSION = '1.4.0';
export const SAVE_KEY = 'fathers_factory_bolt_v1';

// ---------- 시간 ----------
export const TIME = {
  workStart: 8, workEnd: 18, overtimeEnd: 22, // 시
  realSecPerHour: 6,      // 1배속: 게임 1시간 = 6초 → 하루 60초
  nightRealSec: 1.4,      // 퇴근~출근 연출
  daysPerMonth: 10,       // 한 달 = 근무일 10일 (압축)
  speeds: [1, 2, 4],
  maxStep: 0.05,          // 시뮬 최대 스텝(초)
};

// ---------- 공장 바닥 ----------
export const FLOOR = {
  levels: {
    1: { name: '아버지의 공장', cols: 8,  rows: 11, cost: 0 },
    2: { name: '공장 증축',     cols: 10, rows: 14, cost: 120000000 },
    3: { name: '제2공장 확장',   cols: 12, rows: 18, cost: 350000000 },
  },
  overheadBase: 2500000,      // 월 고정비
  overheadPerTile: 10000,     // 바닥 1칸당 월 고정비
};

// ---------- 물건 (벨트 위를 흐르는 상자 1개 = 1로트) ----------
// raw: 입고구에서 사 오는 원자재 (cost = 상자당 원가). raw 이면서 레시피로도 만들 수 있으면 "사 오거나 직접 만들거나"
// final: 출하 가능한 볼트 (lot = 상자 1개에 든 개수, unitPrice = 개당 기준 단가). mark = 상자에 찍히는 글자
export const ITEMS = {
  bar:    { name: '강봉',            icon: '▮', color: '#B2A389', raw: true, cost: 35000, desc: '선반용. 깎여 나가는 칩이 많아 비싸다' },
  wire:   { name: '선재 코일',        icon: '◎', color: '#7D8A96', raw: true, cost: 15000, desc: '성형용. 거의 안 버려져 싸다' },
  blank:  { name: '헤딩 소재',        icon: '⊤', color: '#8E9AA6' },
  bolt:   { name: '일반 볼트 (4.8)',  icon: '🔩', mark: '4.8', color: '#A9B0B8', final: true, lot: 1000, unitPrice: 90 },
  bolt88: { name: '고강도 볼트 (8.8)', icon: '🔩', mark: '8.8', color: '#4E5862', final: true, lot: 1000, unitPrice: 150 },
};

// ---------- 레시피 ----------
// in: {물건: 상자 수}, out: 물건, time: 초(속도 1.0 기준), defect: 기본 불량률, runCost: 1회당 가스·약품비
// finishing: 후공정 — 처음부터 '주문 있을 때만 가동' (주문 없으면 재료를 안 받아 분배기가 다른 쪽으로 보냄)
export const RECIPES = {
  cut_bolt: { machine: 'lathe',  in: { bar: 1 },   out: 'bolt',   time: 4.0, defect: 0.010 },
  head:     { machine: 'header', in: { wire: 1 },  out: 'blank',  time: 1.0, defect: 0.010 },
  roll:     { machine: 'roll',   in: { blank: 1 }, out: 'bolt',   time: 1.3, defect: 0.008 },
  heat88:   { machine: 'heat',   in: { bolt: 1 },  out: 'bolt88', time: 1.5, defect: 0.006, finishing: true },
};
// 볼트를 만드는 두 가지 길. 키 = 그 길의 첫 레시피
export const ROUTE_NOTES = {
  cut_bolt: { name: '절삭', icon: '⚙️', pros: '싸고 간단 · 잘 안 망가짐', cons: '느림 · 재료비 비쌈' },
  head:     { name: '성형', icon: '🔨', pros: '3배 빠름 · 재료비 쌈', cons: '기계 2대 비쌈 · 금형 교체비' },
};

// ---------- 설비 ----------
// tool: 닳는 공구·금형. life = 몇 상자 찍으면 다 닳나, cost = 교체비, sec = 교체하는 동안 서는 시간(초)
export const MACHINE_TYPES = {
  lathe:  { name: 'CNC 선반', icon: '⚙️', color: '#3F7E8C' },
  header: { name: '헤더',     icon: '🔨', color: '#5B6B7D', tool: { name: '헤더 금형', life: 320, cost: 1800000, sec: 8 } },
  roll:   { name: '전조기',   icon: '🌀', color: '#4F7A6A', tool: { name: '전조 다이스', life: 480, cost: 900000, sec: 6 } },
  heat:   { name: '열처리로', icon: '♨️', color: '#A0553A' },
};
// speed: 처리 속도 배율, wear: 기계 마모 배율, toolLife: 금형 수명 배율, auto: 작업자 불필요
export const MACHINES = {
  lathe_old:  { type: 'lathe',  name: '중고 CNC 선반',        price: 12000000, speed: 0.85, wear: 0.45 },
  lathe_new:  { type: 'lathe',  name: '자동 선반',            price: 45000000, speed: 1.3,  wear: 0.3 },
  header_old: { type: 'header', name: '중고 헤더',            price: 35000000, speed: 0.9,  wear: 1.4, toolLife: 0.8 },
  header_new: { type: 'header', name: '다단 포머',            price: 95000000, speed: 1.6,  wear: 0.8, toolLife: 1.4 },
  roll:       { type: 'roll',   name: '전조기',               price: 26000000, speed: 1.0,  wear: 1.1 },
  roll_auto:  { type: 'roll',   name: '자동 전조기',          price: 70000000, speed: 1.3,  wear: 0.8, auto: true },
  heat:       { type: 'heat',   name: '열처리로',             price: 48000000, speed: 1.0,  wear: 0.7 },
};
// 설비 해금 조건 (null = 처음부터). rep: [거래처 등급, 신뢰], tier: 해금된 거래처 등급, cert: 인증
export const UNLOCKS = {
  types: {
    lathe: null,
    header: { month: 1, hint: '첫 달 결산을 넘기면' },
    roll:   { month: 1, hint: '첫 달 결산을 넘기면' },
    heat:   { tier: 1, hint: '2차 협력사 거래 시작' },
  },
  models: {
    lathe_new:  { tier: 1, hint: '2차 협력사 거래 시작' },
    header_new: { cert: 'iso', hint: 'ISO 9001 인증' },
    roll_auto:  { cert: 'iso', hint: 'ISO 9001 인증' },
  },
  split: null,
};

export const MACHINE_RULES = {
  inBufferMult: 2,            // 재료를 레시피 필요량의 몇 배까지 쌓아 두나
  outBuffer: 2,
  wearPerCraft: 0.22,         // 1회 생산당 상태 감소 × wear
  breakdownBelow: 45,
  breakdownPerCraft: 0.004,   // (기준-상태) × 이 값
  repairSec: 6, repairCostRate: 0.02, repairCond: 75,
  autoRepairAfterSec: 20, autoRepairCostMult: 1.8,
  serviceSec: 10, serviceCostRate: 0.03,
  sellRate: 0.4,
  condSlowBelow: 50,          // 이 아래면 느려짐
};

// 벨트·물류
export const LOGISTICS = {
  beltSpeed: 1.8,             // 칸/초
  beltSpacing: 0.34,          // 같은 칸 안 상자 간격
  beltCost: 30000,
  splitterCost: 400000,
  inputCost: 1500000,
  outputCost: 1500000,
  inputInterval: 0.9,         // 입고구 1로트 배출 간격(초)
  removeRefund: 0.5,
  dumpRate: 0.4,             // 남는 재고 처분 시 단가 비율
  outputBufferLots: 40,       // 주문 없는 재고가 이만큼 넘으면 경고 (출하구는 계속 받는다)
};

// ---------- 직원 ----------
export const WORKERS = {
  surnames: ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권'],
  given: ['민수', '지훈', '성호', '영철', '동현', '재원', '상우', '현석', '태호', '준영', '은지', '수진', '미경', '혜린', '경민', '세영', '용준', '광수'],
  skillFactor: { base: 0.6, per: 0.1 },   // 속도 배율 = base + per × 숙련(1~5)
  defectSkill: { base: 1.6, per: 0.12 },  // 불량 배율 = base − per × 숙련
  growthPerCraft: 0.004,                  // 생산 1회당 숙련 상승 × 재능
  maxSkill: 5,
  wageBase: 2400000, wagePerSkill: 400000,
  otMult: 1.5, hoursPerMonth: 100,        // (한 달 10일 × 10시간)
  moraleOtPerDay: -3, moraleNormalPerDay: 1.5, quitBelow: 25, quitChancePerDay: 0.05,
  bonusRate: 0.5, bonusMorale: 25,
  candidates: 3, hireFee: 300000,
};
export const START_WORKERS = [
  { name: '김반장', age: 61, skill: 4.6, talent: 0.3, wage: 4200000, morale: 75, veteran: true },
  { name: '박씨',   age: 47, skill: 2.6, talent: 0.9, wage: 3000000, morale: 65 },
];

// ---------- 거래처 · 주문 ----------
export const TIERS = {
  0: { name: '3차 협력사',  pay: 'cash',      penaltyPerDay: 0.03, startRep: 50 },
  1: { name: '2차 협력사',  pay: 'nextMonth', penaltyPerDay: 0.04, startRep: 30, need: { rep: [0, 70] } },
  2: { name: '1차 협력사',  pay: 'nextMonth', penaltyPerDay: 0.05, startRep: 30, need: { cert: 'iso' } },
  3: { name: '완성차 직납', pay: 'nextMonth', penaltyPerDay: 0.06, startRep: 30, need: { cert: 'iatf', rep: [2, 60] } },
};
export const CLIENTS = {
  0: ['동진금속', '삼우정밀', '한빛테크', '신흥산업', '우성공업', '대명기공'],
  1: ['세화오토', '태광모빌리티', '진성부품', '경원산업'],
  2: ['한국모듈', '대한시트', '현성오토텍'],
  3: ['한양자동차', '미래모터스'],
};
export const OFFERS = {
  boardMax: 6,
  dailyChance: { 0: 0.5, 1: 0.4, 2: 0.35, 3: 0.3 },
  parts: { 0: ['bolt'], 1: ['bolt', 'bolt88'], 2: ['bolt', 'bolt88'], 3: ['bolt88'] },
  lotsPerDay: { 0: 14, 1: 20, 2: 28, 3: 36 }, // 주문 크기 기준: 하루치 상자 수 (× 생산일 수)
  daysOfWork: { 0: [2, 5], 1: [3, 6], 2: [4, 8], 3: [5, 10] },
  slack: [1.5, 2.2],                 // 납기 = 생산일 × slack
  priceJitter: 0.1,
  tierPriceMult: { 0: 1.0, 1: 1.08, 2: 1.15, 3: 1.25 },
  expireDays: [2, 4],
  repOnTime: 3, repLate: -6, repCancel: -20,
  cancelAfterLateDays: 5, cancelFeeRate: 0.1,
  producibleBias: 0.65,              // 지금 생산 가능한 부품 쪽으로 쏠리는 비율
};
export const REGULAR = { client: '대성산업', item: 'bolt', lots: 70, unitPrice: 85, dueDays: 8, tier: 0 };

// ---------- 인증 · 연구 · 전환 ----------
export const CERTS = {
  iso:  { name: 'ISO 9001',   icon: '📜', cost: 30000000,  maxDefect: 0.03,  need: null,  desc: '1차 협력사 거래 · 다단 포머·자동 전조기' },
  iatf: { name: 'IATF 16949', icon: '🏅', cost: 100000000, maxDefect: 0.018, need: 'iso', desc: '완성차 직납 가능' },
};
export const RESEARCH = {};

// ---------- 돈 ----------
export const FINANCE = {
  startCash: 30000000,
  startLoan: 100000000,
  monthlyInterest: 0.005,
  loanStep: 10000000,
  baseLimit: 200000000,
  assetLimitRate: 0.5,
};

// ---------- 월초 소식 ----------
export const NEWS_CHANCE = 0.7;
export const NEWS = [
  { id: 'steel_up',   icon: '📈', title: '철강값 급등',       text: '이번 달 원자재비가 20% 오른다.', rawMult: 1.2, weight: 3 },
  { id: 'steel_down', icon: '📉', title: '철강값 안정',       text: '이번 달 원자재비가 12% 내린다.', rawMult: 0.88, weight: 3 },
  { id: 'boom',       icon: '🚗', title: '신차 출시 붐',      text: '이번 달 주문이 쏟아진다.', offerMult: 1.6, weight: 2 },
  { id: 'slump',      icon: '🥶', title: '자동차 판매 부진',  text: '이번 달은 주문이 뜸하다.', offerMult: 0.6, weight: 2 },
  { id: 'subsidy',    icon: '🏛️', title: '스마트공장 지원사업', text: '이번 달 자동 설비 구입 시 40% 정부 지원.', robotDiscount: 0.4, weight: 1, minMonth: 5 },
  { id: 'poach',      icon: '🕵️', title: '경쟁사 스카우트',   text: '옆 공장에서 우리 숙련공을 데려가려 한다.', kind: 'poach', weight: 1, minMonth: 4 },
  { id: 'bankrupt',   icon: '💥', title: '거래처 부도',       text: '외상값을 받을 거래처 하나가 부도났다. 받을 돈의 절반을 떼였다.', kind: 'bankrupt', weight: 1, minMonth: 6 },
  { id: 'die_short',  icon: '🧰', title: '금형강 품귀',       text: '이번 달 금형·다이스 교체비가 50% 오른다.', toolMult: 1.5, weight: 2, minMonth: 2 },
  { id: 'safety',     icon: '⛑️', title: '산업안전 점검',     text: '노동청 안전 점검이 나왔다.', kind: 'safety', fine: 5000000, weight: 1, minMonth: 3 },
];
export const STORY = { veteranRetireMonth: 14, advisorWageRate: 0.5, advisorGrowthBoost: 2.0, severance: 30000000 };

export const ACHIEVEMENTS = {
  first_profit: { icon: '📗', name: '첫 흑자' },
  forming:      { icon: '🌀', name: '성형 라인 가동' },
  high_str:     { icon: '♨️', name: '고강도 볼트 출하' },
  tier1:        { icon: '🤝', name: '2차 협력사 첫 납품' },
  iso:          { icon: '📜', name: 'ISO 9001 인증' },
  robot:        { icon: '🤖', name: '첫 자동 설비' },
  staff10:      { icon: '👷', name: '직원 10명' },
  tier2:        { icon: '🚙', name: '1차 협력사 첫 납품' },
  iatf:         { icon: '🏅', name: 'IATF 16949 인증' },
  tier3:        { icon: '🏆', name: '완성차 직납' },
  debt_free:    { icon: '🕊️', name: '빚 청산' },
};

// ---------- 할 일 (초반 안내 퀘스트) ----------
// check 는 sim.js 의 questDone 에서 id 로 판정
export const QUESTS = [
  { id: 'accept',  icon: '📋', title: '주문 받아 오기', reward: 0,
    text: '아버지 단골 주문만으로는 매달 적자예요.\n📋 수주 → 새 주문에서 [수락]을 누르세요.' },
  { id: 'split',   icon: '🔀', title: '선반 한 대 더', reward: 3000000,
    text: '선반이 느려서 강봉이 앞에 밀려 있어요.\n선반 왼쪽 벨트를 🔀 분배기로 바꾸고, 아래로 벨트 → ⚙️ 선반 → 벨트로 출하구까지 이어 주세요.' },
  { id: 'ship',    icon: '🚚', title: '첫 출하', reward: 0,
    text: '주문 상자가 다 모이면 퇴근할 때 트럭이 실어 가요. ▶▶ 를 눌러 기다려 보세요.' },
  { id: 'month',   icon: '💰', title: '첫 월말 버티기', reward: 0,
    text: '10일마다 월급·유지비·이자가 나가요. 선반만으로는 매달 조금씩 적자예요.\n첫 달을 넘기면 빠른 성형 설비가 풀려요.' },
  { id: 'forming', icon: '🌀', title: '성형 라인 깔기', reward: 5000000,
    text: '선재 코일 → 🔨 헤더 → 🌀 전조기 → 출하구.\n선반보다 3배 빠르고 재료도 싸요. 대신 기계가 비싸서(경영 → 대출) 금형값이 나가요.\n새 기계엔 사람도 필요해요 (👷 직원).' },
  { id: 'heat',    icon: '♨️', title: '고강도 볼트', reward: 0,
    text: '신뢰 70이면 ♨️ 열처리로가 풀려요. 볼트를 넣으면 고강도 볼트(값 1.7배)가 나와요.\n전조기 뒤 벨트 한 칸을 🔀 분배기로 바꾸고 옆에 열처리로 → 벨트 → 출하구.\n고강도 주문이 없으면 열처리로는 알아서 쉬어요.' },
  { id: 'iso',     icon: '📜', title: 'ISO 9001 인증', reward: 0,
    text: '🏢 경영 → 인증. 지난달 불량 3% 이하 + 3,000만원.\n불량이 많으면 기계를 눌러 🔧 정비하세요.' },
];
