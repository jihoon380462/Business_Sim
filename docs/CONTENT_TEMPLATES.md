# 콘텐츠 추가 양식

`docs/SYSTEMS.md`의 틀에 콘텐츠를 넣을 때 쓰는 빈 양식. 기획 방이 이 양식대로 채워 `REQUESTS.md`에 올리면 개발 방은 해당 JSON에 행을 추가한다. **코드 수정이 필요하면 양식이 아니라 틀을 고쳐야 한다** — 그 경우 SYSTEMS.md 개정부터.

금액은 원 단위 정수, 확률은 0~1, 스탯은 0~100, 기간은 개월.

---

## A. 활동 (`activities.json`)
```json
{
  "id": "",
  "slot": "main | leisure | exec",
  "name": "", "emoji": "", "icon": "icon_act_<id>.png",
  "unlock": { "stage": 0, "stat": {}, "career": {}, "business": null, "cert": null },
  "cost": 0,
  "income": { "base": 0, "statKey": "speech | stamina | skill | management | knowledge" },
  "condition": 0,
  "statGain": { },
  "careerTag": "",
  "businessEffect": "none | operate | delegate",
  "description": "한 줄"
}
```
체크: 같은 슬롯 안에서 역할이 겹치지 않나(수입형 / 성장형 / 회복형 / 관계형 중 하나가 분명한가).

## B. 사업체 타입 (`businesses.json`)
```json
{
  "id": "", "industry": "food | retail | it | manufacturing | realestate", "stage": 0,
  "name": "", "subtitle": "", "icon": "icon_biz_<id>.png",
  "openCost": 0, "revenueMin": 0, "revenueMax": 0, "fixedCost": 0, "promoCost": 0,
  "qualityGrades": { "1": { "costRate": 0.2, "repDelta": -2 }, "2": {}, "3": {} },
  "upgradeCosts": { "2": 0, "3": 0 },
  "seasonMult": { "spring": 1, "summer": 1, "autumn": 1, "winter": 1 },
  "staffModel": { "wage": 0, "revenueMult": 1.25, "maxStaff": 1, "managerUnlock": false },
  "operate": { "ownerRequired": true, "delegateMult": 0.7 },
  "statHooks": { "revenue": "skill", "cost": "management", "extra": null },
  "unlock": { "stage": 0, "requiresBusiness": null, "capital": 0, "career": {}, "cert": null },
  "upgradeTo": null
}
```
체크: 같은 단계의 다른 업종과 **개업비·월 순익 자릿수**가 같은가(SYSTEMS 10절). `extra`가 새 키면 코드 1함수 필요 → REQUESTS에 명시.

## C. 인물 (`characters.json`)
```json
{
  "id": "", "name": "", "gender": "f | m",
  "role": "romance | partner | staff | rival | mentor",
  "appearStage": 0,
  "appearCondition": "활동·업종·이벤트 조건식",
  "portraitSet": "char_<id>_{expr}.png",
  "personality": ["", "", ""],
  "moneyValue": "한 줄 (돈을 어떻게 보는가)",
  "job": "", "ageOffset": 0,
  "hooks": {
    "businessEffect": [ { "type": "loanLimit | staffRecommend | supplierDiscount | stockTip | reputation", "value": 0, "fromStage": "lover" } ],
    "eventIds": [],
    "endingTag": ""
  },
  "lines": { "greet": "", "friend": "", "like": "", "lover": "" }
}
```
체크: 연애 대상 4인은 **돈에 대한 가치관이 서로 달라야** 한다(절약/과시/무관심/투자). 직업이 사업 진행과 한 군데는 얽히는가.

## D. 이벤트 (`events.json`)
```json
{
  "id": "", "kind": "notice | choice | chain | world",
  "category": "life | stock | business | relation | world",
  "title": "", "emoji": "", "text": "",
  "trigger": { "chance": 0, "cooldown": 0, "stage": [0,1,2], "condition": "" },
  "choices": [
    { "id": "", "label": "", "effects": [], "followUp": { "eventId": "", "delay": 1 } }
  ],
  "effects": [ { "target": "money | condition | stat | reputation | affinity | stockShock | worldMult", "key": "", "value": 0, "duration": 0 } ]
}
```
체크: 선택형은 선택지 사이에 **진짜 트레이드오프**가 있나(한쪽이 항상 옳으면 통보형으로 바꾼다). 세계 이벤트는 `duration` 필수.

## E. 자격·경력 효과 (`certs.json`)
```json
{
  "id": "", "name": "",
  "acquire": { "stat": {}, "career": {}, "cost": 0, "examEventId": null },
  "effects": [ { "type": "unlockBusiness | revenueMult | costMult | reputationStart", "key": "", "value": 0 } ],
  "description": ""
}
```

## F. 주식 종목 (`stocks.json`)
```json
{ "id": "", "name": "", "sector": "food | it | construction | bio | ent", "type": "stable | volatile | junk",
  "startPrice": 0, "monthlyVolatility": 0, "drift": 0, "dividendRate": 0 }
```
체크: 섹터별 안정/변동/잡주 비율 유지. 잡주는 상폐 대상.

## G. 대출 상품 (`loans.json`)
```json
{ "id": "", "name": "", "unlockStage": 1, "limitBase": 0, "monthlyRate": 0.025, "step": 500000, "requiresBusiness": true, "requiresCorp": false }
```

## H. 부동산 (`realestate.json`, V3)
```json
{ "id": "", "name": "", "price": 0, "rentPerMonth": 0, "valueDrift": 0, "vacancyRate": 0, "unlockStage": 3, "usableAsSite": true }
```

## I. 엔딩 (`endings.json`)
```json
{ "id": "", "title": "", "match": { "asset": "A | B | C | D | F | any", "relation": "single | lover | married | divorced | any", "reputation": "respected | normal | infamous | any" },
  "priority": 0, "special": "bankrupt | overwork | null", "text": "", "illustration": "ending_<id>.png" }
```
체크: `any`가 많을수록 priority 낮게. 특수 엔딩은 priority 최상.

## J. 단계 (`stages.json`)
```json
{ "stage": 0, "title": "", "enter": { "business": null, "netWorth": 0, "stat": {} },
  "unlocks": { "features": [], "businessStage": 0, "slots": ["main", "leisure"] },
  "livingCost": 600000, "theme": "light | dark", "background": "bg_<>.png", "outfit": "outfit_<>" }
```

---

## 제출 규칙
- 한 REQ에 한 종류(활동만, 이벤트만). 섞지 않는다.
- 새 아이콘·포트레이트가 필요하면 파일명을 양식에 먼저 적고, 주문서는 그 파일명으로 `art/orders/`에 따로.
- 수치는 초안임을 전제로 하되 **같은 단계의 기존 행과 자릿수를 맞춰** 적는다. 봇 시뮬 결과로 조정.
