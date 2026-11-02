// 아버지의 공장 — 밸런스 데이터. 숫자는 여기서만 바꾼다.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'fathers_factory_save_v1';

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
// raw: 입고구에서 사 오는 원자재 (cost = 로트당 원가)
// final: 출하 가능한 부품 (lot = 상자 1개에 든 개수, unitPrice = 개당 기준 단가)
export const ITEMS = {
  sheet:     { name: '강판',          icon: '▤', color: '#8FA3B5', raw: true, cost: 30000 },
  bar:       { name: '강봉',          icon: '▮', color: '#B2A389', raw: true, cost: 40000 },
  resin:     { name: '수지',          icon: '●', color: '#C9CDE8', raw: true, cost: 8000 },
  panel:     { name: '프레스 패널',   icon: '◧', color: '#6E8CA8' },
  blank_d:   { name: '디스크 소재',   icon: '◎', color: '#8C8072' },
  blank_g:   { name: '기어 소재',     icon: '✲', color: '#A38D63' },
  seat_raw:  { name: '시트 골격',     icon: '⊓', color: '#6B7684' },
  shell:     { name: '도어 쉘',       icon: '▭', color: '#7C8996' },
  shell_p:   { name: '도장 쉘',       icon: '▭', color: '#C2564B' },
  case_b:    { name: '케이스 몸체',   icon: '▣', color: '#6E8F82' },
  case_p:    { name: '도장 케이스',   icon: '▣', color: '#3E8E6E' },
  housing_b: { name: '하우징 소재',   icon: '◍', color: '#8695A8' },
  housing:   { name: '하우징',        icon: '◍', color: '#5E7FA8' },
  bracket:   { name: '브라켓',          icon: '📐', color: '#A7B3BF', final: true, lot: 100, unitPrice: 1100 },
  bolt:      { name: '볼트 세트',       icon: '🔩', color: '#C9BFAD', final: true, lot: 200, unitPrice: 420 },
  clip:      { name: '플라스틱 클립',   icon: '📎', color: '#8DA2D6', final: true, lot: 300, unitPrice: 260 },
  disc:      { name: '브레이크 디스크', icon: '💿', color: '#7B838D', final: true, lot: 10,  unitPrice: 15000, ice: true },
  gear:      { name: '변속기 기어',     icon: '⚙️', color: '#BFA36B', final: true, lot: 10,  unitPrice: 12000, ice: true },
  seat:      { name: '시트 프레임',     icon: '💺', color: '#4F6274', final: true, lot: 4,   unitPrice: 34000 },
  door:      { name: '도어 모듈',       icon: '🚪', color: '#B04A40', final: true, lot: 3,   unitPrice: 90000 },
  battery:   { name: '배터리 케이스',   icon: '🔋', color: '#2F8F68', final: true, lot: 2,   unitPrice: 170000, ev: true },
  motor:     { name: '모터 하우징',     icon: '🧲', color: '#4F6FA0', final: true, lot: 2,   unitPrice: 125000, ev: true },
};

// ---------- 레시피 ----------
// in: {물건: 로트 수}, out: 물건, time: 초(1배속, 속도 1.0 기준), defect: 기본 불량률
export const RECIPES = {
  panel:     { machine: 'press',    in: { sheet: 1 },                 out: 'panel',     time: 2.0, defect: 0.012 },
  bolt:      { machine: 'lathe',    in: { bar: 1 },                   out: 'bolt',      time: 1.6, defect: 0.012 },
  blank_d:   { machine: 'lathe',    in: { bar: 1 },                   out: 'blank_d',   time: 3.0, defect: 0.012 },
  blank_g:   { machine: 'lathe',    in: { bar: 1 },                   out: 'blank_g',   time: 2.6, defect: 0.014 },
  housing_b: { machine: 'lathe',    in: { bar: 2 },                   out: 'housing_b', time: 4.0, defect: 0.015, ev: true },
  bracket:   { machine: 'weld',     in: { panel: 1 },                 out: 'bracket',   time: 2.4, defect: 0.015 },
  seat_raw:  { machine: 'weld',     in: { panel: 2 },                 out: 'seat_raw',  time: 3.2, defect: 0.016 },
  shell:     { machine: 'weld',     in: { panel: 2 },                 out: 'shell',     time: 3.0, defect: 0.016 },
  case_b:    { machine: 'weld',     in: { panel: 3 },                 out: 'case_b',    time: 4.0, defect: 0.018, ev: true },
  disc:      { machine: 'heat',     in: { blank_d: 1 },               out: 'disc',      time: 3.2, defect: 0.012 },
  gear:      { machine: 'heat',     in: { blank_g: 1 },               out: 'gear',      time: 2.8, defect: 0.014 },
  housing:   { machine: 'heat',     in: { housing_b: 1 },             out: 'housing',   time: 3.5, defect: 0.012, ev: true },
  clip:      { machine: 'mold',     in: { resin: 1 },                 out: 'clip',      time: 1.2, defect: 0.015 },
  seat:      { machine: 'paint',    in: { seat_raw: 1 },              out: 'seat',      time: 2.8, defect: 0.012 },
  shell_p:   { machine: 'paint',    in: { shell: 1 },                 out: 'shell_p',   time: 2.6, defect: 0.012 },
  case_p:    { machine: 'paint',    in: { case_b: 1 },                out: 'case_p',    time: 3.0, defect: 0.012, ev: true },
  door:      { machine: 'assembly', in: { shell_p: 1, bolt: 1 },      out: 'door',      time: 4.5, defect: 0.015 },
  battery:   { machine: 'assembly', in: { case_p: 1, clip: 2 },       out: 'battery',   time: 5.0, defect: 0.018, ev: true },
  motor:     { machine: 'assembly', in: { housing: 1, bolt: 1 },      out: 'motor',     time: 4.2, defect: 0.015, ev: true },
};

// ---------- 설비 ----------
export const MACHINE_TYPES = {
  press:    { name: '프레스',   icon: '🔨', color: '#5B7083' },
  lathe:    { name: 'CNC 선반', icon: '⚙️', color: '#3F7E8C' },
  weld:     { name: '용접기',   icon: '🔥', color: '#8A6A4A' },
  heat:     { name: '열처리로', icon: '♨️', color: '#A0553A' },
  mold:     { name: '사출기',   icon: '🧪', color: '#5865A0' },
  paint:    { name: '도장 부스', icon: '🎨', color: '#5E8A5A' },
  assembly: { name: '조립대',   icon: '🔧', color: '#8E7A40' },
};
// speed: 처리 속도 배율, wear: 마모 배율, auto: 작업자 불필요
export const MACHINES = {
  press_old:  { type: 'press',    name: '중고 프레스',    price: 8000000,   speed: 0.85, wear: 1.6 },
  press_new:  { type: 'press',    name: '서보 프레스',    price: 35000000,  speed: 1.35, wear: 0.7 },
  lathe_old:  { type: 'lathe',    name: '중고 CNC 선반',  price: 12000000,  speed: 0.85, wear: 1.5 },
  lathe_new:  { type: 'lathe',    name: '5축 CNC',        price: 55000000,  speed: 1.4,  wear: 0.7 },
  weld_old:   { type: 'weld',     name: '수동 용접기',    price: 5000000,   speed: 0.8,  wear: 1.4 },
  weld_robot: { type: 'weld',     name: '용접 로봇',      price: 80000000,  speed: 1.7,  wear: 0.6, auto: true },
  heat:       { type: 'heat',     name: '열처리로',       price: 40000000,  speed: 1.0,  wear: 0.9 },
  mold:       { type: 'mold',     name: '사출 성형기',    price: 28000000,  speed: 1.0,  wear: 1.0 },
  paint:      { type: 'paint',    name: '도장 부스',      price: 60000000,  speed: 1.0,  wear: 0.9 },
  assembly:   { type: 'assembly', name: '조립대',         price: 25000000,  speed: 1.0,  wear: 0.7 },
  assembly_robot: { type: 'assembly', name: '협동 로봇 조립', price: 140000000, speed: 1.6, wear: 0.6, auto: true },
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
  outputBufferLots: 6,        // 주문량보다 이만큼 더 받으면 출하구가 받기를 멈춤(라인이 멈춤)
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
  1: { name: '2차 협력사',  pay: 'nextMonth', penaltyPerDay: 0.04, startRep: 30, need: { rep: [0, 60] } },
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
  parts: { 0: ['bracket', 'bolt', 'clip'], 1: ['bracket', 'bolt', 'clip', 'disc', 'gear'], 2: ['disc', 'gear', 'seat', 'battery', 'motor'], 3: ['seat', 'door', 'battery', 'motor'] },
  refLotsPerDay: 22,                 // 기준: 기계 한 줄이 하루에 만드는 로트 수 (레시피 시간으로 보정)
  daysOfWork: { 0: [2, 5], 1: [3, 6], 2: [4, 8], 3: [5, 10] },
  slack: [1.5, 2.2],                 // 납기 = 생산일 × slack
  priceJitter: 0.1,
  tierPriceMult: { 0: 1.0, 1: 1.08, 2: 1.15, 3: 1.25 },
  expireDays: [2, 4],
  repOnTime: 5, repLate: -6, repCancel: -20,
  cancelAfterLateDays: 5, cancelFeeRate: 0.1,
  producibleBias: 0.65,              // 지금 생산 가능한 부품 쪽으로 쏠리는 비율
};
export const REGULAR = { client: '대성산업', item: 'bracket', lots: 70, unitPrice: 1050, dueDays: 8, tier: 0 };

// ---------- 인증 · 연구 · 전환 ----------
export const CERTS = {
  iso:  { name: 'ISO 9001',   icon: '📜', cost: 30000000,  maxDefect: 0.03,  need: null,  desc: '1차 협력사 거래 가능' },
  iatf: { name: 'IATF 16949', icon: '🏅', cost: 100000000, maxDefect: 0.018, need: 'iso', desc: '완성차 직납 가능' },
};
export const RESEARCH = {
  ev: { name: '전기차 부품 개발', icon: '⚡', cost: 150000000, days: 20, need: 'iso', desc: '배터리 케이스·모터 하우징 레시피 해금' },
};
export const TRANSITION = { startYear: 3, iceDecline: 0.2, evBoost: 0.3 };

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
  { id: 'subsidy',    icon: '🏛️', title: '스마트공장 지원사업', text: '이번 달 로봇 구입 시 40% 정부 지원.', robotDiscount: 0.4, weight: 1, minMonth: 5 },
  { id: 'poach',      icon: '🕵️', title: '경쟁사 스카우트',   text: '옆 공장에서 우리 숙련공을 데려가려 한다.', kind: 'poach', weight: 1, minMonth: 4 },
  { id: 'bankrupt',   icon: '💥', title: '거래처 부도',       text: '외상값을 받을 거래처 하나가 부도났다. 받을 돈의 절반을 떼였다.', kind: 'bankrupt', weight: 1, minMonth: 6 },
  { id: 'safety',     icon: '⛑️', title: '산업안전 점검',     text: '노동청 안전 점검이 나왔다.', kind: 'safety', fine: 5000000, weight: 1, minMonth: 3 },
];
export const STORY = { veteranRetireMonth: 14, advisorWageRate: 0.5, advisorGrowthBoost: 2.0, severance: 30000000 };

export const ACHIEVEMENTS = {
  first_profit: { icon: '📗', name: '첫 흑자' },
  second_line:  { icon: '🏭', name: '두 번째 제품 출하' },
  tier1:        { icon: '🤝', name: '2차 협력사 첫 납품' },
  iso:          { icon: '📜', name: 'ISO 9001 인증' },
  robot:        { icon: '🤖', name: '첫 로봇 도입' },
  staff10:      { icon: '👷', name: '직원 10명' },
  tier2:        { icon: '🚙', name: '1차 협력사 첫 납품' },
  iatf:         { icon: '🏅', name: 'IATF 16949 인증' },
  ev:           { icon: '⚡', name: '전기차 부품 개발' },
  tier3:        { icon: '🏆', name: '완성차 직납' },
  debt_free:    { icon: '🕊️', name: '빚 청산' },
};
