// core 공개 API 모음. ui 는 이 모듈만 import 한다.
export { setData, getData, D, findActivity, activitiesBySlot, findStock, findBusinessType } from './data.js';
export { createInitialState, serialize, deserialize, clone, pushLog, setGender, STATE_VERSION } from './state.js';
export { advanceMonth, yearOf, monthOf, seasonOf, turnLabel, ageAt } from './time.js';
export {
  wageMult, skillRevenueMult, fixedCostMult, loanRateMult, maxCondition, isLowCondition, rumorDetailLevel,
} from './stats.js';
export {
  setActivity, setStudyTarget, setDelegate, canChooseMain, canDelegate, expectedIncome, ownerOperates,
} from './jobs.js';
export { borrow, repay, loanAvailable, loanUnlocked, netWorth, effectiveLoanRate, monthlyInterest } from './economy.js';
export { buyStock, sellStock, buyCost, sellProceeds, maxBuyQty, portfolio, monthlyChangePct, isDelisted } from './stocks.js';
export {
  canOpen, openBusiness, setPolicy, renameBusiness, upgradeCost, upgradeIngredients,
  canHire, hireStaff, fireStaff, businessType, operationMode, fixedCostOf,
} from './business.js';
export { resolveEvent, rumorBanner } from './events.js';
export { dismissReport, buildReport } from './goal.js';
