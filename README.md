# Business_Sim

세로 모바일 **주 단위 턴제 사업 경영 시뮬레이션**. 20세·100만원으로 시작해 알바와 주식으로 종잣돈을 모으고, 노점에서 대기업까지 키운다.

1차 버전은 순수 HTML/JS 웹 프로토타입이다. 재미가 확인되면 Unity 이식을 검토한다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/GDD.md](docs/GDD.md) | 전체 비전 — 무엇을 느끼게 할 것인가 |
| [docs/SYSTEMS.md](docs/SYSTEMS.md) | **시스템 뼈대** — 부품과 데이터 틀, 콘텐츠 슬롯 현황 |
| [docs/CONTENT_TEMPLATES.md](docs/CONTENT_TEMPLATES.md) | 콘텐츠 추가 양식 (활동·업종·인물·이벤트…) |
| [docs/SCOPE_V1.md](docs/SCOPE_V1.md) | 1차 개발 범위 — 이것만 만든다 |
| [docs/HANDOFF_V1.md](docs/HANDOFF_V1.md) | 개발 담당 착수 지시서 |
| [docs/UI_SPEC_V1.md](docs/UI_SPEC_V1.md) | V1 화면 명세 (레퍼런스: `art/reference/`) |
| [docs/REPO_STRUCTURE.md](docs/REPO_STRUCTURE.md) | 폴더 구조, 담당 구획, 코드 규칙 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 결정 기록 |
| [docs/REQUESTS.md](docs/REQUESTS.md) | 기획 ↔ 개발 소통 |
| [art/STYLE_GUIDE.md](art/STYLE_GUIDE.md) | 아트 스타일 가이드 (GPT용) |
| [art/ORDER_TEMPLATE.md](art/ORDER_TEMPLATE.md) | 아트 주문서 양식 |

## 작업 방식

- **기획**: Claude(기획 방) → `docs/`, `art/`
- **개발**: Claude(개발 방) → `src/`, `tests/`, `index.html`
- **아트**: GPT → 주문서 기반, 결과물은 `art/review/` → 검수 후 `assets/img/`
- 두 Claude 방은 서로 보지 못하므로 `docs/REQUESTS.md`로만 소통한다.

## 실행

`index.html`을 브라우저에서 열면 된다. 빌드 없음. (V1 개발 후)
