# 고등 영단어 트레이너 (vocab-trainer) 디자인 개편 설계서 (DESIGN_REDESIGN.md)

> **문서 목적**: `plazalabs/vocab-trainer`의 현행 화면 구조(4대 뷰·하단 4탭·단어장/퀴즈/기출/오답노트/리그·배지)와 기능·데이터(`data/*.json`, `localStorage` 스키마)는 그대로 유지하면서, **전형적인 AI 양산형(AI Slop) 외관을 걷어내고 에디토리얼 학습 도구 수준의 시각 체계로 전면 개편**하기 위한 수치 고정형 디자인 명세서다.
>
> **절대 원칙**:
> - 화면 구조, 인터랙션 흐름, 기능, 데이터 구조는 변경하지 않는다.
> - 모든 색상(라이트·다크), 글꼴(한글·영문·숫자 및 크기·굵기), 여백·모서리·그림자 값을 숫자와 코드로 못 박아 임의 해석을 차단한다.
> - 제시 범위 밖이거나 코드·자산 변경 범위와 맞물려 단정할 수 없는 사항은 **「7. 유보 항목」**으로 분리한다.

---

## 0. 진단 및 설계 방향 (Design Rationale & References)

### 0.1 현행 앱이 'AI 양산형(Slop)'으로 보이는 구조적 원인 5가지
현재 코드베이스(`index.html`, `css/style.css`, `js/app.js`)를 전수 조사한 결과, 기능과 정보 구조는 탄탄하나 시각 표현에서 다음 5가지 전형적인 AI 생성 템플릿 징후가 중첩되어 있다.

1. **6색 무지개 팔레트와 보라·파랑 남발**: 한 화면(폭 `720px`) 안에서 에메랄드(`#0F6E56`), 앰버(`#C26A09`), 레드(`#C93535`), **바이올렛 보라(`#6D28D9` / 다크 `#A78BFA`)**, **스카이 블루(`#0E7490` / `#0369A1` / 다크 `#38BDF8`)**가 동시에 등장한다. 특히 다크 모드의 차가운 청회색 배경(`#0F171E`, `#18232C`) 위에 보라색(`#A78BFA`)과 하늘색(`#38BDF8`) 네온 틴트를 올린 조합은 가장 대표적인 AI 대시보드 클리셰다.
2. **파스텔 알약(Tinted Pill) 및 중첩 박스(Box-in-Box) 과잉**: 기출 다의어 카드(`.exam-word-card`) 1장 안에 점선 박스(`.exam-base-meaning`) + 초록 테두리 박스(`.exam-meanings-section`) + 노란 박스(`.exam-word-signal`) + 초록 좌측선 박스(`.word-example-box`)까지 **4개의 서로 다른 박스가 중첩**되어 있다. 홈 히어로 카드(`.hero-card`) 역시 카드 안에 초록 박스·회색 박스·노란 박스가 나란히 들어 있다.
3. **유니코드 컬러 이모지(Emoji) 도배**: 상단 헤더(`🔥`, `⚡`, `🔊`, `🌙`), 섹션 타이틀(`🏆`), 안내문(`💡`, `👆`), 피드백(`🎉`, `⚠️`, `📅`, `⭕`, `❌`, `🏅`), 배지 7종(`🏁`, `🌱`, `🔥`, `⚡`, `👑`, `🧠`, `🎓`)까지 총 **19종의 시스템 이모지**가 UI 아이콘을 대신하고 있다.
4. **`font-weight: 800` 인플레이션과 32종의 파편화된 글자 크기**: `css/style.css` 내 23개 클래스에 `font-weight: 800`이 남발되어 모든 텍스트가 동시에 소리를 지르고 있으며, `0.66rem`(`10.56px`)부터 `2rem`(`32px`)까지 **32개의 불규칙한 `rem` 수치**가 기준 없이 흩어져 있다.
5. **과도한 곡률(`20px`/`14px`)과 모든 카드의 그림자 상시 부양**: 모든 카드에 `14px~20px`의 둥근 모서리와 드롭 섀도(`--shadow-sm`, `--shadow-md`)가 일괄 적용되어 학습 도구 특유의 단단함과 긴장감이 없다.

### 0.2 개편 디자인 방향 및 참고한 실존 앱·디자인 시스템
개편 콘셉트는 **"Editorial Study Sheet & High-Craft Utility (인쇄 사전·학습지 수준의 정제된 타이포그래피와 무채색 중심 유틸리티)"**로 정의하며, 다음 실존 서비스 및 디자인 시스템을 설계 근거로 삼는다.

| 참고 대상 (실존 앱 / 시스템) | 채택한 핵심 설계 원리 | 본 프로젝트(`vocab-trainer`) 적용 방식 |
| :--- | :--- | :--- |
| **Linear** & **Vercel Geist Design System** | - **Border-First, Shadow-Minimal**: 그림자 대신 `1px` 구조선과 표면 명도차로 계층 분리<br>- **Warm Monochrome**: 화면의 85% 이상을 무채색(Paper/Ink/Carbon)으로 유지 | - 일반 카드 그림자(`box-shadow`) 전면 제거, `1px solid` 보더로 통일<br>- 다크 모드를 차가운 네이비(`#0F171E`)에서 따뜻한 카본 블랙(`#121211`)으로 교체<br>- 보라색(`--xp-*`)·파란색(`--sky-*`, `--info-*`) 완전 퇴출 |
| **네이버 어학사전 (Naver Dictionary)** & **EBSi 수능 교재 편집 체제** | - **사전식 다의어 위계**: 중첩 컬러 박스 대신 번호·구분선·들여쓰기·비중 수치로 다의어 정보 정리 | - 기출 다의어 카드(`.exam-word-card`) 내부의 4중 컬러 박스를 해체하고, `1px` 수평 구분선과 좌측 `2px` 인용선만으로 기본 뜻·시험 뜻·판단 신호·예문을 사전처럼 배열 |
| **Mochi Cards** & **RemNote** | - **집중형 학습 스테이지**: 플래시카드·문제 풀이 화면에서 장식 요소를 배제하고 표제어와 예문의 가독성 극대화 | - 퀴즈 스테이지(`.quiz-stage-card`)와 플래시카드(`.flashcard-box`)에서 불필요한 컬러 배지·글로우·바운스 애니메이션 제거 |
| **산타토익 (Santa TOEIC)** & **Toss Design System (TDS)** | - **고정폭 숫자(`tabular-nums`) 기반 학습 지표**: 수험생 대상 앱에 걸맞은 건조하고 신뢰감 있는 수치 표현 (Duolingo식 아동용 원색 배제) | - 복습 대기 수, SRS 단계 수, 리그 순위·XP, 출제 비중(`%`) 등 모든 수치에 숫자 전용 고정폭 폰트(`--font-num`)와 `tabular-nums` 강제 적용 |

---

## ① 색상 팔레트 (Color Palette Specification)

### 1.1 기본 원칙
1. **85% 무채색 원칙**: 전체 화면 면적의 85% 이상은 따뜻한 종이색(Light Paper)과 먹색(Charcoal Ink), 또는 다크 카본(Dark Carbon)으로만 구성한다.
2. **유채색 3종 제한**: 유채색은 오직 **① 브랜드/정답(Deep Forest Green)**, **② 기출/스트릭/강조(Warm Ochre)**, **③ 오답/경고(Brick Crimson)** 3가지만 허용한다.
3. **보라·파랑·하늘색 완전 폐기**: 기존 `--xp-*`(보라), `--sky-*`(청록), `--info-*`(파랑) 계열 색상은 전량 폐기하고 무채색 스톤(`Stone`) 또는 웜 오커(`Ochre`)로 흡수한다.
4. **모든 토큰의 6자리 Hex 고정**: `rgba()` 반투명 색상이 배경과 섞여 탁해지는 현상을 막기 위해 라이트·다크 모든 색상 토큰을 **6자리 불투명 Hex 값(`#RRGGBB`)**으로 고정한다.

### 1.2 라이트 · 다크 색상 토큰 명세표 (Exact Hex Values)

| 분류 | CSS 변수명 (기존 호환) | 라이트 모드 (`#HEX`) | 다크 모드 (`#HEX`) | 대비율 (WCAG) | 적용 대상 및 역할 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **배경 (Surface)** | `--bg-page` | `#F6F5F0` | `#121211` | - | 앱 전체 바탕 (따뜻한 미색 종이 / 웜 카본 블랙) |
| | `--bg-surface` | `#FFFFFF` | `#1A1A18` | - | 기본 카드·스테이지·모달·활성 탭 표면 |
| | `--bg-subtle` | `#EFECE6` | `#242421` | - | 세그먼트 탭 트랙, 보조 버튼, 무채색 태그 배경 |
| | `--bg-muted` | `#E4E0D8` | `#2E2E2A` | - | 비활성 요소, 진행률 바 빈 트랙(`.progress-track`) |
| | `--bg-header-glass` | `#F6F5F0` | `#121211` | - | 상단 고정 헤더 배경 (블러 없이 불투명 솔리드 고정) |
| | `--bg-nav-glass` | `#FFFFFF` | `#1A1A18` | - | 하단 고정 내비게이션 배경 (불투명 솔리드 고정) |
| **텍스트 (Ink)** | `--text-primary` | `#18181B` | `#F4F3EF` | 라이트 `15.4:1`<br>다크 `16.1:1` | 표제어, 헤드라인, 한국어 뜻, 본문 주 텍스트 |
| | `--text-secondary` | `#52525B` | `#A8A69E` | 라이트 `6.8:1`<br>다크 `7.1:1` | 예문 해석, 카드 설명, 판단 신호 본문, 비활성 탭 |
| | `--text-muted` | `#78756E` | `#78766E` | 라이트 `4.5:1`<br>다크 `4.5:1` | 출처, 날짜, SRS 보조 캡션, 힌트 문구 |
| | `--text-on-solid` | `#FFFFFF` | `#121211` | `10.2:1` 이상 | 솔리드 강조 버튼(`.primary-cta-btn`, `.filter-pill.active`) 위 텍스트 |
| **테두리 (Border)** | `--border-subtle` | `#E2DFD7` | `#2A2A26` | - | 모든 카드 기본 외곽선(`1px`), 내부 수평 구분선 |
| | `--border-strong` | `#C8C4BA` | `#3E3E38` | - | 검색창, 드롭다운, 4지선다 선택지(`.choice-btn`), 예문 좌측선 |
| | `--border-focus` | `#18181B` | `#F4F3EF` | - | 검색창 포커스, 선택지 호버 테두리 |
| **주조색 / 정답 (Forest)** | `--brand-primary` | `#165B45` | `#34A87E` | 라이트 `7.9:1`<br>다크 `6.8:1` | 메인 CTA, 정답 판정, SRS 4단계(14일 완성), 출제 비중 수치 |
| | `--brand-primary-hover` | `#0F4433` | `#4BC096` | - | 메인 CTA 호버 상태 |
| | `--brand-soft` | `#EBF3EF` | `#162922` | - | 정답 선택지 배경, 리그 내 순위 행(`.league-row.me`) 배경 |
| | `--brand-border` | `#BBD5C9` | `#24473A` | - | 정답 선택지 및 내 리그 행 테두리 |
| **기출 / 스트릭 / 리워드 (Ochre)** | `--amber-primary` | `#B45309` | `#E59A2E` | 라이트 `5.0:1`<br>다크 `8.4:1` | 기출 S급, 판단 신호 라벨, 문맥 하이라이트, 레벨/XP 게이지 |
| | `--amber-soft` | `#FAF0E1` | `#292014` | - | 기출 S급 배지 배경, 문맥 하이라이트 배경, 해금 배지 아이콘 배경 |
| | `--amber-border` | `#E6C89C` | `#4D391E` | - | 기출 S급 배지·기본 뜻 함정 배지 테두리 |
| **오답 / 경고 (Crimson)** | `--danger-primary` | `#B91C1C` | `#E06C6C` | 라이트 `6.4:1`<br>다크 `5.8:1` | 오답 선택지, 오답 횟수 강조, 기록 초기화 위험 호버 |
| | `--danger-soft` | `#FBEBEB` | `#2B1919` | - | 오답 선택지(`.choice-btn.wrong`) 및 총 오답 횟수 배지 배경 |
| | `--danger-border` | `#E5B8B8` | `#522929` | - | 오답 선택지 및 `'몰라요'` 버튼 테두리 |
| **구 보라/파랑 치환 토큰 (Stone/Ink)** | `--xp-primary` | `#18181B` | `#E59A2E` | - | *(구 `#6D28D9` 보라 폐기)* 레벨·XP 텍스트 및 게이지 채움 |
| | `--xp-soft` | `#EFECE6` | `#242421` | - | *(구 `#F3E8FF` 연보라 폐기)* 레벨 알약·XP 획득 배지 배경 |
| | `--xp-border` | `#C8C4BA` | `#3E3E38` | - | *(구 `#DDD6FE` 보라 보더 폐기)* 레벨 알약·XP 배지 테두리 |
| | `--sky-primary` / `--info-primary` | `#52525B` | `#A8A69E` | - | *(구 `#0E7490`/`#0369A1` 파랑 폐기)* `고1`, `A급`, 기본 오답 배지 텍스트 |
| | `--sky-soft` / `--info-soft` | `#EFECE6` | `#242421` | - | *(구 `#ECFEFF`/`#E0F2FE` 하늘색 폐기)* `고1`, `A급`, 기본 오답 배지 배경 |

### 1.3 금지 색상 및 금지 조합 규칙 (Forbidden Colors & Combinations)

1. **그라데이션 전면 금지**:
   - `linear-gradient()`, `radial-gradient()`, `conic-gradient()`는 배경, 버튼, 프로그레스 바, 텍스트(`background-clip: text`) 등 **어느 요소에도 절대 사용하지 않는다.** 모든 면은 단일 Hex 솔리드 컬러로만 채운다.
2. **보라·바이올렛·인디고 계열 전면 금지**:
   - 금지 코드: `#6D28D9`, `#7C3AED`, `#8B5CF6`, `#A78BFA`, `#F3E8FF`, `#DDD6FE`, `#4F46E5`, `#6366F1` 및 이에 준하는 모든 보라 계열(`hue 240°~300°`).
3. **파랑·스카이·시안 계열 전면 금지**:
   - 금지 코드: `#0369A1`, `#0284C7`, `#0E7490`, `#38BDF8`, `#E0F2FE`, `#ECFEFF`, `#BAE6FD`, `#2563EB`, `#3B82F6` 및 이에 준하는 모든 파랑·청록 계열(`hue 185°~239°`).
4. **다크 모드 청회색(Slate/Navy) 배경 금지**:
   - 금지 코드: 현행 `#0F171E`, `#18232C`, `#21303C`, `#2B3D4B`, `#263542`, `#364958`. 다크 모드는 반드시 푸른 기가 빠진 웜 카본(`#121211`, `#1A1A18`, `#242421`)만 사용한다.
5. **명시적 금지 조합 (Forbidden Pairings)**:
   - **[금지 조합 A — 단일 카드 내 다중 유채색 면 배치 금지]**: 하나의 부모 카드(`.hero-card`, `.word-card`, `.exam-word-card`, `.wrong-banner`) 내부에 `--brand-soft`(초록)와 `--amber-soft`(오커) 또는 `--danger-soft`(적색) 배경 박스를 동시에 2개 이상 배치하는 것을 금지한다.
   - **[금지 조합 B — 다크 모드 유채색 배경 위 백색 텍스트 금지]**: 다크 모드에서 `--brand-primary`(`#34A87E`)나 `--amber-primary`(`#E59A2E`) 솔리드 버튼 위에 흰색(`#FFFFFF`) 글자를 올리면 명도 대비가 깨지므로(`2.8:1` 이하), 다크 모드 솔리드 강조 버튼 위 텍스트는 반드시 `#121211`(`--text-on-solid`)을 사용한다.
   - **[금지 조합 C — 유채색 배경 위 다른 유채색 텍스트 금지]**: 예를 들어 `--amber-soft` 배경 위에 `--brand-primary` 텍스트를 쓰거나, `--danger-soft` 배경 위에 `--amber-primary` 버튼을 중첩하는 행위를 금지한다.

---

## ② 글꼴 체계 (Typography System Specification)

### 2.1 한글 · 영문 · 숫자 3원화 글꼴 지정
학습 앱의 특성상 **① 한국어 UI 및 뜻/해석**, **② 영어 표제어 및 예문**, **③ 통계·순위·퍼센트·간격 숫자**의 시각적 역할이 완전히 다르므로 3개의 폰트 변수를 분리 지정한다.

| 구분 | CSS 변수명 | 지정 폰트 패밀리 (우선순위 순) | 필수 OpenType / CSS 속성 | 적용 대상 |
| :--- | :--- | :--- | :--- | :--- |
| **한글 (Korean)** | `--font-ko` | `"Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif` | `word-break: keep-all;`<br>`overflow-wrap: break-word;` | 앱 타이틀, 섹션 제목, 한국어 뜻(`.word-meaning`), 예문 해석(`.word-example-ko`), 판단 신호 설명, 버튼·탭·필터 라벨 |
| **영문 (English)** | `--font-en` | `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | `font-feature-settings: "cv02" 1, "cv03" 1, "cv04" 1, "cv11" 1;`<br>(영문 `a`, `g`, `I`, `l` 판독성 강화) | 단어장·퀴즈 영단어 표제어(`.word-en`, `.quiz-target-word`), 품사(`.word-pos`), 영어 예문(`.word-example-en`, `.quiz-blank-sentence`), 영어 기출 신호, `BOT` 배지 |
| **숫자 (Numeric)** | `--font-num` | `"JetBrains Mono", "SF Mono", "Roboto Mono", "Pretendard Variable", monospace` | `font-variant-numeric: tabular-nums lining-nums;`<br>`font-feature-settings: "tnum" 1, "zero" 0;` | 홈 3대 지표 숫자(`.stat-value`), SRS 단계별 단어 수(`.srs-stage-count`), 레벨·XP 수치, 리그 순위·주간 XP, 기출 출제 비중(`.exam-meaning-pct`), 퀴즈 진행 번호(`1 / 24`), 보기 번호(`.choice-num`), 오답 횟수, 날짜 |

- **기본 바디 선언 (`body`)**: `font-family: var(--font-ko); font-size: 16px; line-height: 1.5; letter-spacing: -0.015em;`

### 2.2 크기 · 굵기 · 행간 · 자간 8단계 계층표 (px 및 rem 비율 고정)
- **기준값**: `html { font-size: 16px; }` (`1rem = 16px`).
- **굵기(Weight) 제한 규칙**: **`font-weight: 800` (ExtraBold)은 전면 금지**한다. 전체 앱에서 오직 **`400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold)** 4가지만 사용하며, `700`은 영문 표제어와 핵심 대숫자에만 제한적으로 허용한다.
- **최소 크기 하한선**: 모바일 가독성을 해치는 **`12px`(`0.75rem`) 미만의 글자 크기는 전면 금지**한다 (기존 `0.66rem`, `0.68rem`, `0.7rem`, `0.72rem` 모두 폐기).

| 계층 코드 | 역할 (Role) | 크기 (`px`) | 비율 (`rem`) | 굵기 (`font-weight`) | 행간 (`line-height`) | 자간 (`letter-spacing`) | 적용 폰트 | 매핑 대상 셀렉터 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Type-1** | **Quiz Headword**<br>(퀴즈 출제 영단어) | `28px` | `1.750rem` | `700` | `1.20` (`33.6px`) | `-0.025em` | `--font-en` | `.quiz-target-word` (기본/기출/플래시카드 공통 단일 크기 고정) |
| **Type-2** | **Hero Stat Number**<br>(홈/요약 핵심 대숫자) | `24px` | `1.500rem` | `700` | `1.15` (`27.6px`) | `-0.030em` | `--font-num` | `.stat-value` (`#stat-due-count`, `#stat-new-count`, `#stat-streak-count`) |
| **Type-3** | **Card Headword & Headline**<br>(단어장 표제어 · 히어로 제목) | `20px` | `1.250rem` | 영문 `700`<br>한글 `600` | `1.30` (`26.0px`) | `-0.020em` | `--font-en`<br>`--font-ko` | `.word-en`, `.hero-headline`, `.flashcard-meaning` |
| **Type-4** | **Section Title & Meaning**<br>(섹션 제목 · 대표 한국어 뜻) | `16px` | `1.000rem` | `600` | `1.45` (`23.2px`) | `-0.015em` | `--font-ko` | `.brand-title`, `.section-title`, `.word-meaning`, `.wrong-banner-title`, `.empty-title`, `.srs-stage-count`(`--font-num`, `700`) |
| **Type-5** | **Primary Reading & Action**<br>(영어 예문 · 선택지 · 주 버튼) | `15px` | `0.9375rem` | 예문 `400`<br>버튼/보기 `500`<br>주요뜻 `600` | `1.55` (`23.25px`) | 영문 `-0.005em`<br>한글 `-0.015em` | `--font-en`<br>`--font-ko` | `.quiz-blank-sentence`, `.word-example-en`, `.choice-btn`, `.primary-cta-btn`, `.next-question-btn`, `.judge-btn`, `.mode-card-title`(`600`), `.exam-meaning-ko`(`600`) |
| **Type-6** | **Secondary Body**<br>(예문 해석 · 신호 설명 · 입력창) | `14px` | `0.875rem` | `400`<br>(강조 `500`) | `1.55` (`21.7px`) | `-0.010em` | `--font-ko` | `.word-example-ko`, `.quiz-blank-ko`, `.exam-word-signal-body`, `.exam-base-text`, `.search-input`, `.league-row`, `.league-summary`, `.wrong-banner-desc`, `.empty-desc` |
| **Type-7** | **UI Control & Meta**<br>(탭 · 필터 알약 · 진행 헤더) | `13px` | `0.8125rem` | 기본 `500`<br>활성 `600` | `1.40` (`18.2px`) | `-0.005em` | `--font-ko`<br>`--font-num` | `.dataset-tab-btn`, `.quiz-tab-btn`, `.filter-pill`, `.scope-select`, `.quiz-progress-header`, `.mode-card-desc`(`400`), `.exam-meaning-sig`, `.speak-btn`, `.mini-btn`, `.wrong-start-btn`, `.toast-msg`, `.badge-name`(`600`) |
| **Type-8** | **Micro Tag & Caption**<br>(품사 · 등급 · 출처 · 하단 탭) | `12px` | `0.750rem` | 기본 `500`<br>태그 `600` | `1.35` (`16.2px`) | 한글 `0em`<br>영문 대문자 `+0.04em` | `--font-ko`<br>`--font-en`<br>`--font-num` | `.word-pos`, `.level-badge`, `.grade-badge`, `.source-badge`, `.srs-tag`, `.wrong-mode-badge`, `.exam-meaning-pct`, `.bot-badge`, `.streak-pill`, `.level-pill`, `.nav-item`, `.section-caption`, `.hero-date-label`, `.badge-sub` |

---

## ③ 여백 · 모서리 · 그림자 규칙 (Spacing, Radius & Shadow Rules)

### 3.1 여백(Spacing) 규칙 — `4px` 기본 그리드 고정
`3px`, `5px`, `6px`, `7px`, `9px`, `10px`, `11px`, `13px`, `14px`, `15px`, `18px`, `22px`, `26px` 등 비정규 수치를 전면 폐기하고 아래 **7개 간격 토큰(`4px` 배수)**만 사용한다.

| 토큰명 | 수치 (`px`) | 비율 (`rem`) | 고정 사용처 |
| :--- | :--- | :--- | :--- |
| `--space-1` | `4px` | `0.25rem` | 세그먼트 탭 트랙 내부 패딩(`padding: 4px`), 라벨과 보조 캡션 사이 미세 상하 간격 |
| `--space-2` | `8px` | `0.50rem` | 필터 알약 간격(`gap: 8px`), 4지선다 선택지 간격(`gap: 8px`), 헤더 배지 간격, 배지 그리드 간격 |
| `--space-3` | `12px` | `0.75rem` | 단어 카드 리스트 간격(`.word-list { gap: 12px }`), 퀴즈 모드 카드 간격, 카드 내부 블록 간 상하 간격 |
| `--space-4` | `16px` | `1.00rem` | 앱 좌우 기본 여백(`.main-content` 좌우 `16px`), 일반 카드 내부 패딩(`padding: 16px`: `.word-card`, `.mode-card`, `.srs-panel`, `.league-card`, `.wrong-banner`) |
| `--space-5` | `20px` | `1.25rem` | 주요 스테이지 카드 내부 패딩(`padding: 20px`: `.hero-card`, `.quiz-stage-card`, `.flashcard-box`) |
| `--space-6` | `24px` | `1.50rem` | 홈 화면 섹션 헤더 상단 여백(`.section-header { margin-top: 24px; margin-bottom: 12px; }`) |
| `--space-8` | `32px` | `2.00rem` | 빈 상태 카드(`.empty-state`) 상하 패딩(`padding: 32px 20px`), 메인 영역 하단 여백 |

- **레이아웃 컨테이너 고정 치수**:
  - `.app-shell`: `max-width: 720px`, `padding-bottom: 76px`
  - `.app-header`: 높이 `56px` (`padding: 0 16px`), `border-bottom: 1px solid var(--border-subtle)`
  - `.main-content`: `padding: 20px 16px 32px`
  - `.bottom-nav-inner`: 높이 `60px`, 4열 균등 그리드(`grid-template-columns: repeat(4, 1fr)`)

### 3.2 모서리 반경(Border Radius) 규칙
기존의 부풀어 보이는 `20px`·`14px` 반경을 축소하여 단정하고 날렵한 학습 도구 인상을 확립한다.

| 토큰명 | 수치 (`px`) | 적용 대상 컴포넌트 |
| :--- | :--- | :--- |
| `--radius-xs` | `4px` | 인라인 마이크로 태그: `.word-pos`, `.level-badge`, `.grade-badge`, `.source-badge`, `.exam-base-tag`, `.exam-meaning-pct`, `.wrong-mode-badge`, `.bot-badge`, `.trap-pill`, `.choice-num` (기존 원형 `50%` 폐기 후 `4px` 사각 키캡화) |
| `--radius-sm` | `6px` | 소형 컨트롤 및 내부 콜아웃: `.dataset-tab-btn`, `.quiz-tab-btn`, `.mini-btn`, `.wrong-start-btn`, `.icon-toggle-btn` (기존 `50%` 원형 폐기), `.league-row`, `.exam-word-signal` |
| `--radius-md` | `8px` | 주요 입력창 및 액션 버튼: `.search-input`, `.scope-select`, `.wordbook-dataset-tabs`, `.quiz-tabs`, `.primary-cta-btn`, `.choice-btn`, `.judge-btn`, `.next-question-btn`, `.quiz-feedback`, `.brand-logo` |
| `--radius-lg` | `12px` | **모든 카드 컨테이너의 단일 반경 (기존 `14px`/`20px` 통합)**: `.hero-card`, `.mode-card`, `.srs-panel`, `.toolbar-card`, `.word-card`, `.exam-word-card`, `.quiz-config-bar`, `.quiz-stage-card`, `.flashcard-box`, `.wrong-banner`, `.league-card`, `.badge-item`, `.empty-state` |
| `--radius-pill` | `9999px` | **엄격 제한 허용 (5곳만)**: `.filter-pill`, `.progress-track`/`.progress-fill`, `.level-progress-track`/`.level-progress-fill`, 상단 헤더 `.streak-pill`/`.level-pill`, `.toast-msg` (및 `.nav-badge`) |

### 3.3 테두리(Border) 및 그림자(Shadow) 규칙
1. **테두리 두께 고정**:
   - 모든 카드·태그·구분선의 기본 테두리는 **`1px solid var(--border-subtle)`** 로 통일한다.
   - 입력창(`.search-input`, `.scope-select`), 4지선다 보기(`.choice-btn`), 플래시카드(`.flashcard-box`), 보조 버튼(`.mini-btn`)은 **`1px solid var(--border-strong)`** 을 사용한다 (기존 `1.5px`, `2px` 혼용 폐지).
   - 예문 인용선(`.word-example-box`) 및 판단 신호 콜아웃(`.exam-word-signal`)의 좌측 강조선은 **`border-left: 2px solid`** 로 고정한다 (기존 `3px` 축소).
2. **그림자(Box Shadow) 값 고정**:
   - **일반 카드 그림자 `none` 원칙**: `.word-card`, `.exam-word-card`, `.mode-card`, `.srs-panel`, `.toolbar-card`, `.quiz-config-bar`, `.wrong-banner`, `.league-card`, `.badge-item`에는 **기본 그림자를 일절 넣지 않는다(`box-shadow: none`)**.
   - 허용되는 그림자 토큰 3종:

| 토큰명 | 라이트 모드 CSS 값 | 다크 모드 CSS 값 | 허용 대상 |
| :--- | :--- | :--- | :--- |
| `--shadow-none` | `none` | `none` | 모든 리스트 카드, 패널, 버튼 기본값 |
| `--shadow-xs` | `0 1px 2px rgba(24, 24, 27, 0.06)` | `0 1px 2px rgba(0, 0, 0, 0.35)` | 세그먼트 컨트롤 내 활성 탭(`.dataset-tab-btn.active`, `.quiz-tab-btn.active`) |
| `--shadow-sm` | `0 2px 6px rgba(24, 24, 27, 0.04), 0 1px 2px rgba(24, 24, 27, 0.03)` | `0 2px 8px rgba(0, 0, 0, 0.45)` | 화면당 단 1개의 최상위 포커스 스테이지(`.hero-card`, `.quiz-stage-card`) |
| `--shadow-float` | `0 8px 20px rgba(24, 24, 27, 0.14)` | `0 8px 24px rgba(0, 0, 0, 0.65)` | 화면 하단 플로팅 토스트 알림(`.toast-msg`) 전용 |

---

## ④ 화면별 적용안 (Screen-by-Screen Redesign Plan)

화면 구조와 DOM 기능은 그대로 유지하되, **공통 쉘 + 6대 화면 영역(홈 · 단어장 · 퀴즈 · 기출 · 오답노트 · 리그/배지)** 각각에서 무엇이 어떻게 달라지는지 구체적 수치로 정의한다.

### 4.0 공통 앱 쉘 (상단 헤더 `.app-header` · 하단 탭 `.bottom-nav` · 토스트 `.toast-msg`)

| 요소 | 현재 (As-Is) | 개편 후 (To-Be) |
| :--- | :--- | :--- |
| **상단 헤더 (`.app-header`)** | `padding: 12px 18px`, 반투명 블러(`rgba(248,247,244,0.92)`), 로고 `34px`(`radius: 10px`), 부제목(`.brand-subtitle`) 상시 노출 | 높이 `56px`(`padding: 0 16px`), 솔리드 배경(`#F6F5F0` / `#121211`), 로고 `28px × 28px`(`radius: 6px`, `box-shadow: none`), `.brand-subtitle`은 모바일 헤더 복잡도 감소를 위해 `display: none` 처리 (`min-width: 560px` 이상에서만 `12px` `--text-muted` 노출) |
| **헤더 상태 배지 (`.streak-pill`, `.level-pill`)** | 스트릭은 노란 알약(`🔥 0일 연속`), 레벨은 보라 알약(`⚡ Lv.1 · 0 XP`), `font-weight: 700` | 이모지(`🔥`, `⚡`) 삭제. 두 배지 모두 **동일한 무채색 칩**(`background: var(--bg-subtle)`, `border: 1px solid var(--border-subtle)`, `color: var(--text-primary)`, `padding: 4px 10px`, `border-radius: 9999px`, `12px`, `--font-num`, `weight 600`)으로 통일 |
| **헤더 토글 버튼 (`#btn-toggle-sound`, `#btn-toggle-theme`)** | `32px × 32px` 원형(`border-radius: 50%`), 내부 `🔊`/`🔇`, `🌙`/`☀️` 컬러 이모지 | `32px × 32px` 각진 버튼(`border-radius: 6px`), `background: var(--bg-surface)`, `border: 1px solid var(--border-subtle)`, 내부 `16px × 16px` (`stroke-width: 1.75`) 단색 선형 SVG 아이콘 |
| **하단 내비게이션 (`.bottom-nav`)** | 높이 `64px`, 아이콘 `22px`, 활성 탭 초록색(`--brand-primary`) + `weight 800` | 높이 `60px`, 솔리드 배경(`#FFFFFF` / `#1A1A18`), 아이콘 `20px × 20px` (비활성 `stroke-width: 1.75`, 활성 `2.25`), 비활성 `color: var(--text-muted)`(`weight 500`), 활성 `color: var(--text-primary)`(`#18181B` / `#F4F3EF`, `weight 600`) + 상단 `2px` 인디케이터 바(`var(--brand-primary)`) |
| **토스트 (`.toast-msg`)** | `rgba(20, 33, 43, 0.94)`, `border-radius: 9999px`, 앞머리에 `🔊`, `🏅`, `🎉`, `📅` 이모지 부착 | 라이트 `#18181B`(텍스트 `#F4F3EF`) / 다크 `#F4F3EF`(텍스트 `#121211`), `border-radius: 8px`, `padding: 10px 16px`, `13px` / `weight 500`, `--shadow-float`, 이모지 전면 제거 |

---

### 4.1 [화면 1] 홈 화면 (`#view-home`)

1. **히어로 브리핑 카드 (`.hero-card`)**:
   - **외곽**: `background: var(--bg-surface)`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px` (기존 `20px` 축소), `padding: 20px`, `box-shadow: var(--shadow-sm)`.
   - **기준일 라벨 (`#home-date-badge.hero-date-label`)**: 헤드라인 위의 초록색 비스킷 알약(`background: var(--brand-soft)`, `border-radius: 9999px`)을 폐기하고, `background: transparent`, `padding: 0`, `font-size: 12px`, `font-weight: 500`, `color: var(--text-muted)`, `font-family: var(--font-num)` 텍스트 라벨로 변경한다.
   - **헤드라인 (`#home-greeting-title.hero-headline`)**: `20px` (`1.25rem`), `font-weight: 600` (기존 `1.35rem`, `800` 축소), `color: var(--text-primary)`, `margin-bottom: 16px`.
   - **3열 핵심 지표 그리드 (`.hero-stats-grid` > `.stat-box`)**:
     - **현재 문제점**: 1번 칸은 초록 박스(`.highlight-due`), 2번 칸은 회색 박스, 3번 칸은 노란 박스(`.highlight-streak`)로 한 카드 안에 3색 박스가 중첩되어 있다.
     - **개편 명세**: 3개의 개별 유채색 박스 테두리와 배경색을 모두 제거한다. `.hero-stats-grid` 전체를 `border-top: 1px solid var(--border-subtle)`, `border-bottom: 1px solid var(--border-subtle)`, `padding: 12px 0`, `gap: 0`의 **단일 수평 데이터 스트립**으로 묶고, 2·3번째 `.stat-box` 좌측에만 `border-left: 1px solid var(--border-subtle)` 세로 구분선을 넣는다.
     - 각 `.stat-box`는 `background: transparent`, `border: none`, `border-radius: 0`, `padding: 4px 12px`, `text-align: left`로 정렬한다.
     - `.stat-label`: `12px`, `weight 500`, `color: var(--text-muted)`.
     - `.stat-value`: `24px`, `weight 700`, `--font-num` (`tabular-nums`). **`#stat-due-count`(오늘 복습할 단어)만 `color: var(--brand-primary)`(`#165B45` / `#34A87E`)로 강조**하고, `#stat-new-count`와 `#stat-streak-count`는 `color: var(--text-primary)`(`#18181B` / `#F4F3EF`)로 통일한다.
     - `.stat-sub`: `12px`, `weight 400`, `color: var(--text-secondary)`.
   - **메인 시작 버튼 (`#btn-hero-start.primary-cta-btn`)**:
     - 높이 `48px` (`padding: 12px 16px`), `border-radius: 8px` (기존 `14px` 축소), `background: var(--brand-primary)` (`#165B45` / 다크 `#34A87E`), `color: var(--text-on-solid)` (`#FFFFFF` / 다크 `#121211`), `font-size: 15px`, `font-weight: 600`.
     - **초록색 글로우 그림자(`0 4px 12px rgba(15, 110, 86, 0.22)`) 완전 제거 (`box-shadow: none`)**.
2. **퀴즈 3종 바로 시작 (`.quiz-mode-grid` > `.mode-card`)**:
   - 각 `.mode-card`: `background: var(--bg-surface)`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px`, `padding: 16px`, `box-shadow: none`.
   - 호버 효과: 기존의 위로 떠오르는 `transform: translateY(-2px)`와 그림자 확장을 제거하고, `border-color: var(--border-focus)`(`#18181B` / `#F4F3EF`) 및 `background: var(--bg-subtle)` 색상 전환만 적용한다.
   - `.mode-badge`: `border-radius: 4px`, `padding: 2px 6px`, `12px`, `weight 500`, `background: var(--bg-subtle)`, `color: var(--text-secondary)`.
   - `.mode-card-title`: `15px`, `weight 600`, `color: var(--text-primary)`.
   - `.mode-card-desc`: `13px`, `weight 400`, `color: var(--text-secondary)`, `line-height: 1.45`.
3. **간격반복(SRS) 복습 단계 현황 (`.srs-panel`)**:
   - 외곽: `border-radius: 12px`, `padding: 16px`, `border: 1px solid var(--border-subtle)`, `box-shadow: none`.
   - 5단계 그리드(`.srs-stages-grid` > `.srs-stage-item`): 각 셀 `background: var(--bg-page)`, `border: 1px solid var(--border-subtle)`, `border-radius: 6px`, `padding: 10px 4px`.
   - `.srs-stage-interval`: `12px`, `weight 500`, `color: var(--text-muted)`.
   - `.srs-stage-count`: `16px`, `weight 700`, `--font-num` (`tabular-nums`). 기존에는 5칸 모두 초록색(`var(--brand-primary)`)이었으나, **0단계(`#srs-count-0`)는 `var(--text-secondary)`, 1~3단계는 `var(--text-primary)`, 최고 단계인 4단계(`#srs-count-4`, 14일 완성)만 `var(--brand-primary)`**로 위계를 분리한다.
   - 하단 시뮬레이션 바(`.srs-helper-bar`): 점선(`1px dashed`)을 실선(`1px solid var(--border-subtle)`)으로 바꾸고, `#sim-date-display`에 `--font-num`(`12px`)을 적용한다.

---

### 4.2 [화면 2] 단어장 화면 (`#view-wordbook` — 기본 단어장 24종)

1. **상단 검색 · 필터 툴바 (`.toolbar-card`)**:
   - `border-radius: 12px`, `padding: 12px`, `border: 1px solid var(--border-subtle)`, `background: var(--bg-surface)`, `box-shadow: none`, `margin-bottom: 12px`.
   - **데이터셋 탭 (`.wordbook-dataset-tabs`)**: `background: var(--bg-subtle)`, `padding: 4px`, `border-radius: 8px`, `gap: 4px`. `.dataset-tab-btn`은 `padding: 8px 12px`, `border-radius: 6px`, `13px`, `weight 500`, `color: var(--text-secondary)`. 활성 탭(`.active`)은 `background: var(--bg-surface)`, `color: var(--text-primary)` (기존 초록색 텍스트 대신 먹색 `weight 600`), `box-shadow: var(--shadow-xs)`.
   - **검색창 (`.search-input`)**: 높이 `40px` (`padding: 8px 12px`), `border-radius: 8px`, `border: 1px solid var(--border-strong)`, `background: var(--bg-page)`, `font-size: 14px`. 포커스 시 `outline: none; border-color: var(--border-focus); background: var(--bg-surface);`.
   - **필터 알약 (`.filter-pill`)**: `padding: 5px 12px`, `border-radius: 9999px`, `13px`, `weight 500`, `background: var(--bg-page)`, `border: 1px solid var(--border-subtle)`, `color: var(--text-secondary)`.
     - **활성 필터 (`.filter-pill.active`)**: 기존의 초록색(`--brand-primary`) 배경 대신 **먹색 반전(`background: var(--text-primary)`, `border-color: var(--text-primary)`, `color: var(--text-on-solid)`)**을 적용하여 아래 단어 카드의 초록/오커 포인트와 색상이 겹치지 않게 한다.
     - `.filter-pill.exam-filter-jump`: `border-color: var(--amber-border)`, `background: var(--amber-soft)`, `color: var(--amber-primary)`, `weight 600`.
   - **가이드 문구 (`#wordbook-guide-text`)**: 인라인 스타일 및 `💡` 이모지를 제거하고 `font-size: 12px; color: var(--text-muted); margin-bottom: 12px;`로 고정한다.
2. **기본 단어 카드 (`.word-card`)**:
   - **외곽**: `background: var(--bg-surface)`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px`, `padding: 16px`, `box-shadow: none`. 호버 시 그림자 없이 `border-color: var(--border-strong)`. 발음 재생 중(`.word-card.speaking`)에는 카드 전체를 초록색으로 물들이는 대신 `border-color: var(--brand-primary)`와 발음 버튼 반전만 적용한다.
   - **상단 행 (`.word-card-top`)**:
     - `.word-en`: `20px` (`1.25rem`), `weight 700`, `--font-en`, `color: var(--text-primary)`.
     - `.word-pos` (품사): 초록색 배경(`--brand-soft`)을 버리고 `font-family: var(--font-en)`, `12px`, `weight 500`, `color: var(--text-muted)`, `background: var(--bg-subtle)`, `padding: 2px 6px`, `border-radius: 4px`.
     - `.level-badge` (`고1`, `고2`, `고3`): **파랑(`--info-soft`)·초록(`--brand-soft`)·노랑(`--amber-soft`) 3색 분기를 전면 폐기**하고, 3개 난이도 모두 단일 무채색 스톤 태그(`background: var(--bg-subtle)`, `border: 1px solid var(--border-subtle)`, `color: var(--text-secondary)`, `12px`, `weight 500`, `padding: 2px 6px`, `border-radius: 4px`)로 통일한다.
     - `.speak-btn` (`발음` 버튼): `🔊` 이모지를 `14px × 14px` Volume 선형 SVG로 교체, `border-radius: 6px` (알약형 `9999px` 폐기), `padding: 5px 10px`, `13px`, `weight 500`, `background: var(--bg-subtle)`, `border: 1px solid var(--border-subtle)`, `color: var(--text-primary)`.
   - **대표 뜻 (`.word-meaning`)**: `16px`, `weight 600`, `color: var(--text-primary)`, `margin: 8px 0 12px`.
   - **예문 영역 (`.word-example-box`)**:
     - 내부 회색 박스 배경(`background: var(--bg-page)`)과 초록색 두꺼운 보더(`3px solid var(--brand-primary)`)를 버리고, **`background: transparent`, `border-left: 2px solid var(--border-strong)`, `border-radius: 0`, `padding: 2px 0 2px 12px`, `margin-bottom: 12px`** 의 에디토리얼 인용선 스타일로 변경한다.
     - `.word-example-en`: `15px`, `weight 400`, `line-height: 1.55`, `--font-en`, `color: var(--text-primary)`.
     - `.word-example-ko`: `14px`, `weight 400`, `line-height: 1.5`, `--font-ko`, `color: var(--text-secondary)`.
   - **하단 푸터 (`.word-card-footer`)**:
     - `border-top: 1px solid var(--border-subtle)`, `padding-top: 10px`, `margin-top: 4px`.
     - `.srs-tag`: `border-radius: 4px`, `padding: 2px 8px`, `12px`, `weight 500`, `--font-num`.
       - 미학습 기본: `background: var(--bg-subtle)`, `color: var(--text-muted)`
       - `.srs-tag.scheduled` (복습 예정): `background: var(--bg-subtle)`, `color: var(--text-secondary)` (불필요한 초록 배경 제거)
       - `.srs-tag.due` (오늘 복습 대상): `background: var(--amber-soft)`, `color: var(--amber-primary)`, `border: 1px solid var(--amber-border)`, `weight 600`

---

### 4.3 [화면 3] 퀴즈 화면 (`#view-quiz` — 기본 3종 · 피드백 · 결과 요약)

1. **퀴즈 설정 바 (`.quiz-config-bar`)**:
   - `border-radius: 12px`, `padding: 12px`, `border: 1px solid var(--border-subtle)`, `background: var(--bg-surface)`, `box-shadow: none`.
   - `.quiz-group-caption`: `12px`, `weight 500`, `color: var(--text-muted)`, `margin-bottom: 4px`.
   - `.quiz-tabs` 및 `.quiz-tabs.exam-quiz-tabs`: 두 탭 그룹 모두 트랙 배경을 **`background: var(--bg-subtle)`, `border: none`, `border-radius: 8px`, `padding: 4px`** 로 통일한다 (기출 탭 트랙의 노란색 배경 `#FDF9EE` 폐기).
   - `.quiz-tab-btn.active`: `background: var(--bg-surface)`, `color: var(--text-primary)`, `weight 600`, `border-radius: 6px`, `box-shadow: var(--shadow-xs)`. 기출 탭 활성 버튼(`.exam-tab-btn.active`)만 텍스트 색상을 `color: var(--amber-primary)`로 구분한다.
   - `.scope-select`: 높이 `36px` (`padding: 6px 10px`), `border-radius: 8px`, `border: 1px solid var(--border-strong)`, `background: var(--bg-page)`, `13px`, `weight 500`.
2. **진행 상태 바 (`.quiz-progress-header` & `.progress-track`)**:
   - `.quiz-progress-header`: `13px`, `weight 500`, `--font-num` (`tabular-nums`), `color: var(--text-secondary)`, `margin-bottom: 8px`.
   - `.progress-track`: 높이 **`4px`** (기존 `7px` 축소), `background: var(--bg-muted)`, `border-radius: 9999px`, `margin-bottom: 16px`.
   - `.progress-fill`: `background: var(--brand-primary)`.
3. **문제 스테이지 카드 (`.quiz-stage-card`)**:
   - `background: var(--bg-surface)`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px` (기존 `20px` 축소), `padding: 20px`, `box-shadow: var(--shadow-sm)`.
   - `.quiz-question-box`: `padding: 16px 4px 20px`, `text-align: center`.
   - `.quiz-target-word`: **`28px` (`1.75rem`), `weight 700`, `--font-en`, `letter-spacing: -0.025em`, `color: var(--text-primary)`** (기본 뜻 맞히기·기출 문맥 뜻·플래시카드 모든 모드에서 `28px` 단일 크기로 고정; `js/app.js`의 `style="font-size: 1.65rem"` 인라인 예외 제거).
   - `.quiz-blank-sentence`: `15px` (`0.9375rem`), `weight 500`, `line-height: 1.6`, `--font-en`, `color: var(--text-primary)`, `margin-bottom: 12px`.
   - `.blank-slot`: `min-width: 96px`, `padding: 0 6px`, `border-bottom: 2px solid var(--text-primary)` (정답 채점 전에는 먹색 밑줄, 채점 후 `.filled` 상태에서 `color: var(--brand-primary)`, `border-bottom-color: var(--brand-primary)`, `weight 700`).
   - `.quiz-blank-ko`: 회색 박스 배경(`background: var(--bg-page)`)을 제거하고 `background: transparent`, `padding: 0`, `font-size: 14px`, `color: var(--text-secondary)`로 깔끔하게 표시한다.
4. **4지선다 보기 버튼 (`.choices-grid` > `.choice-btn`)**:
   - `.choices-grid`: `gap: 8px` (기존 `10px`).
   - `.choice-btn`: 최소 높이 `48px`, `padding: 12px 16px`, `border-radius: 8px` (기존 `14px` 축소), `border: 1px solid var(--border-strong)`, `background: var(--bg-surface)`, `font-size: 15px`, `font-weight: 500`, `color: var(--text-primary)`, `gap: 12px`.
   - `.choice-num` (보기 번호 `1~4`): `24px × 24px`, **`border-radius: 4px`** (기존 원형 `50%` 폐기 → 키보드 키캡 형태), `background: var(--bg-subtle)`, `border: 1px solid var(--border-subtle)`, `font-size: 12px`, `font-weight: 600`, `--font-num`, `color: var(--text-secondary)`.
   - `.choice-btn:hover:not(:disabled)`: `border-color: var(--border-focus)`, `background: var(--bg-subtle)`.
   - `.choice-btn.correct` (정답): `border-color: var(--brand-primary)`, `background: var(--brand-soft)`, `color: var(--brand-primary)`, `font-weight: 600`. `.choice-num`은 `background: var(--brand-primary)`, `border-color: var(--brand-primary)`, `color: var(--text-on-solid)`. **(기존 `box-shadow: 0 0 0 3px var(--brand-soft)` 글로우 링과 `correctPop` 스케일 바운스 애니메이션 완전 제거)**.
   - `.choice-btn.wrong` (오답): `border-color: var(--danger-primary)`, `background: var(--danger-soft)`, `color: var(--danger-primary)`. `.choice-num`은 `background: var(--danger-primary)`, `border-color: var(--danger-primary)`, `color: #FFFFFF`.
5. **카드 뒤집기 모드 (`.flashcard-box` & `.self-judge-row`)**:
   - `.flashcard-box`: `min-height: 220px`, `border-radius: 12px`, `border: 1px solid var(--border-strong)` (기존 `2px` 축소), `background: var(--bg-page)`, `padding: 24px 20px`. 뒤집힌 상태(`.flipped`)에서는 `background: var(--bg-surface)`, `border-color: var(--border-focus)`.
   - `.flashcard-hint`: `👆` 이모지 제거, `13px`, `color: var(--text-muted)`.
   - `.flashcard-meaning`: `20px`, `weight 600`, `color: var(--text-primary)` (기존 초록색 텍스트에서 주 텍스트 색상으로 변경하여 긴 한국어 뜻의 가독성 향상).
   - `.judge-btn`: `border-radius: 8px`, `padding: 12px 16px`, `font-size: 15px`, `font-weight: 600`.
     - `.judge-btn.unknown` (`몰라요 ✕`): `background: var(--bg-surface)`, `border: 1px solid var(--danger-border)`, `color: var(--danger-primary)`.
     - `.judge-btn.known` (`알아요 ○`): `background: var(--brand-primary)`, `border: 1px solid var(--brand-primary)`, `color: var(--text-on-solid)`.
6. **정오답 피드백 패널 (`.quiz-feedback`) 및 결과 요약 (`renderQuizSummary`)**:
   - `.quiz-feedback`: `margin-top: 16px`, `padding: 16px`, `border-radius: 8px`, `background: var(--bg-subtle)`, `border: 1px solid var(--border-subtle)`.
   - `.feedback-header`: `15px`, `weight 600`, `🎉` 이모지 제거.
   - `.xp-gain-pill`: 보라색 배경(`--xp-soft`)을 버리고 `background: var(--bg-surface)`, `border: 1px solid var(--border-strong)`, `color: var(--text-primary)`, `border-radius: 4px`, `padding: 2px 8px`, `12px`, `weight 600`, `--font-num`.
   - `.next-question-btn`: `height: 44px`, `padding: 10px 16px`, `border-radius: 8px`, `background: var(--text-primary)`, `color: var(--text-on-solid)`, `15px`, `weight 600`.
   - 결과 요약 화면의 단어 리스트 컨테이너: `border: 1px solid var(--border-subtle)`, `border-radius: 8px`, `padding: 8px 12px`, 각 행 높이 `36px`, 수치 및 간격(`+3일`)은 `--font-num` 적용.

---

### 4.4 [화면 4] 기출 화면 (`data/exam-words.json` — 기출 다의어 카드 & 기출 모드 2종)

> **핵심 개편 목표**: 카드 1장 안에 4개의 박스가 중첩된 현행 `.exam-word-card`의 '박스 안의 박스(Box-in-Box)' 구조를 완전히 해체하고, **네이버 어학사전·수능 해설지 스타일의 평면 에디토리얼 레이아웃**으로 재설계한다.

1. **기출 다의어 카드 (`.exam-word-card`) 계층별 개편 명세**:

| 카드 내부 구역 | 현재 (As-Is: 4중 중첩 박스) | 개편 후 (To-Be: 무박스 사전식 편집 구조) |
| :--- | :--- | :--- |
| **카드 외곽 (`.exam-word-card`)** | `border-radius: 14px`, `padding: 16px`, `box-shadow: var(--shadow-sm)` | `border-radius: 12px`, `padding: 16px`, `border: 1px solid var(--border-subtle)`, `background: var(--bg-surface)`, **`box-shadow: none`** |
| **상단 배지 행 (`.word-title-group`)** | `S급`(노랑), `A급`(파랑 `#BAE6FD`), `출처`(회색), `오답 배지`(노랑/하늘)가 각기 다른 색으로 나열 | - `.word-en`: `20px`, `weight 700`, `--font-en`<br>- `.grade-S`: `background: var(--amber-soft)`, `color: var(--amber-primary)`, `border: 1px solid var(--amber-border)`, `border-radius: 4px`, `12px`, `weight 600`<br>- **`.grade-A` (파란색 폐기)**: `background: var(--bg-subtle)`, `color: var(--text-secondary)`, `border: 1px solid var(--border-subtle)`, `border-radius: 4px`, `12px`, `weight 600`<br>- `.source-badge`: `background: transparent`, `padding: 0 4px`, `color: var(--text-muted)`, `12px`, `--font-num` |
| **① 기본 뜻 (`.exam-base-meaning`)** | `background: var(--bg-page)`, `border: 1px dashed var(--border-strong)`, `border-radius: 8px`, `padding: 6px 10px` (점선 박스) | **외곽 점선 테두리와 배경 박스를 완전 제거** (`background: transparent; border: none; padding: 4px 0 8px; margin: 0; border-bottom: 1px solid var(--border-subtle);`).<br>- `.exam-base-tag`: `12px`, `weight 500`, `color: var(--text-muted)`, `background: var(--bg-subtle)`, `padding: 1px 6px`, `border-radius: 4px`<br>- `.exam-base-text`: `14px`, `weight 400`, `color: var(--text-secondary)` |
| **② 시험 출제 뜻 목록 (`.exam-meanings-section`)** | `border: 1px solid var(--brand-border)`, `background: var(--bg-page)`, `border-radius: 8px`, `padding: 10px 12px` (초록 테두리 박스) | **초록색 외곽 테두리와 박스 배경을 완전 제거** (`background: transparent; border: none; border-radius: 0; padding: 12px 0; margin: 0; border-bottom: 1px solid var(--border-subtle);`).<br>- `.exam-meanings-title` (`시험에서는 이 뜻`): `12px`, `weight 600`, `color: var(--brand-primary)`, `margin-bottom: 8px`<br>- `.exam-meaning-item`: `padding: 6px 0`, 항목 간 구분선 `border-bottom: 1px solid var(--border-subtle)` (`rgba(15,110,86,0.1)` 제거)<br>- `.exam-meaning-ko`: `15px`, `weight 600`, `color: var(--text-primary)`<br>- `.exam-meaning-pct` (출제 비중 `%`): 알약(`9999px`) 테두리를 버리고 `border-radius: 4px`, `padding: 1px 6px`, `background: var(--brand-soft)`, `border: none`, `color: var(--brand-primary)`, `12px`, `weight 600`, `--font-num` (`tabular-nums`)<br>- `.exam-meaning-sig`: `13px`, `weight 400`, `color: var(--text-secondary)` |
| **③ 판단 신호 (`.exam-word-signal`)** | `background: var(--amber-soft)`, `border: 1px solid var(--amber-border)`, `border-radius: 8px`, `padding: 8px 11px`, `💡 판단 신호` | **노란색 전면 박스 배경과 4면 테두리를 제거**하고, 좌측 보더 콜아웃으로 전환 (`background: var(--bg-subtle); border: none; border-left: 2px solid var(--amber-primary); border-radius: 0 6px 6px 0; padding: 8px 12px; margin: 12px 0;`).<br>- `.exam-word-signal-label`: `💡` 이모지 삭제, `12px`, `weight 600`, `color: var(--amber-primary)`, `margin-bottom: 2px`<br>- `.exam-word-signal-body`: `14px`, `weight 400`, `line-height: 1.55`, `color: var(--text-primary)` |
| **④ 기출 예문 (`.exam-example-box`)** | `background: var(--bg-page)`, `border-left: 3px solid var(--brand-primary)` | `background: transparent`, `border-left: 2px solid var(--border-strong)`, `padding: 2px 0 2px 12px`, `border-radius: 0`, `margin-bottom: 12px`.<br>- `.exam-example-source`: `12px`, `weight 500`, `--font-num`, `color: var(--text-muted)` |

2. **기출 퀴즈 모드 2종 (`exam-blank`, `exam-meaning`)**:
   - 문맥 하이라이트 단어(`mark.exam-highlight-word`): 하단 2px 밑줄(`border-bottom: 2px solid var(--amber-primary)`)을 제거하고 `background: var(--amber-soft)`, `color: var(--amber-primary)`, `padding: 1px 6px`, `border-radius: 4px`, `font-weight: 600`만 유지하여 영문 문장 베이스라인이 깨지지 않게 한다.
   - 기본 뜻 함정 배지(`.trap-pill`): `border-radius: 4px` (`9999px` 폐기), `padding: 2px 6px`, `12px`, `weight 500`, `background: var(--amber-soft)`, `color: var(--amber-primary)`, `border: 1px solid var(--amber-border)`.

---

### 4.5 [화면 5] 오답노트 화면 (`#view-wrong`)

1. **오답노트 상단 복습 배너 (`.wrong-banner`)**:
   - **현재 문제점**: 배너 전체가 붉은 파스텔(`--danger-soft`)로 칠해져 있고, 그 안에 빨간색·흰색·주황색 버튼 5개가 빽빽하게 들어서 있어 경고창 같은 피로감을 준다.
   - **개편 명세**:
     - `.wrong-banner`: **`background: var(--bg-surface)` (`#FFFFFF` / `#1A1A18`), `border: 1px solid var(--border-subtle)`, `border-left: 3px solid var(--danger-primary)`**, `border-radius: 12px`, `padding: 16px`, `margin-bottom: 16px`, `box-shadow: none`.
     - `.wrong-banner-title`: `16px`, `weight 600`, `color: var(--text-primary)` (기존 `color: var(--danger-primary)`, `weight 800` 해제).
     - `.wrong-banner-desc`: `14px`, `weight 400`, `color: var(--text-secondary)`, `margin-bottom: 12px`.
     - **오답 퀴즈 시작 버튼 5종 (`.wrong-start-btn`)**:
       - 빨강(`--danger-primary`)·주황(`--amber-primary`) 원색 솔리드 배경을 모두 걷어낸다.
       - 대표 시작 버튼 2개(`#btn-wrong-quiz-exam-blank`, `#btn-wrong-quiz-meaning`)는 **`background: var(--text-primary)`, `color: var(--text-on-solid)`, `border: 1px solid var(--text-primary)`** 로 지정한다.
       - 나머지 보조 시작 버튼 3개(`.secondary`, `.exam-btn-secondary`)는 **`background: var(--bg-subtle)`, `color: var(--text-primary)`, `border: 1px solid var(--border-strong)`** 으로 통일한다.
       - 모든 `.wrong-start-btn`의 치수는 `padding: 8px 12px`, `border-radius: 6px`, `font-size: 13px`, `font-weight: 500`, 숫자 괄호(`(N)`)는 `--font-num`을 적용한다.
2. **오답 단어 카드 내 배지 정리 (`.wrong-mode-badge`)**:
   - **현재 문제점**: 한 단어 카드 상단에 `총 오답 3회`(빨강), `기출 · 예문 빈칸 오답`(노랑), `기본 · 뜻 맞히기 오답`(하늘색 `--sky-soft`) 등 다채색 알약이 동시에 달린다.
   - **개편 명세**:
     - **유채색은 `총 오답 N회` 배지 단 1개에만 허용**한다 (`background: var(--danger-soft)`, `color: var(--danger-primary)`, `border: 1px solid var(--danger-border)`, `border-radius: 4px`, `12px`, `weight 600`, `--font-num`).
     - 어떤 모드에서 틀렸는지 나타내는 **`.wrong-mode-badge` (`.exam-mode`, `.basic-mode` 공통)는 모두 무채색 스톤 태그**(`background: var(--bg-subtle)`, `color: var(--text-secondary)`, `border: 1px solid var(--border-subtle)`, `border-radius: 4px`, `padding: 2px 6px`, `12px`, `weight 500`)로 통일한다.
3. **빈 상태 카드 (`.empty-state`)**:
   - `background: var(--bg-surface)`, `border: 1px solid var(--border-subtle)` (기존 `1px dashed` 점선 제거), `border-radius: 12px`, `padding: 32px 20px`, `box-shadow: none`.
   - 내부 액션 버튼(`#btn-wrong-go-exam-quiz` 등)에 인라인 스타일로 들어가 있던 `background: var(--amber-primary)`를 제거하고 보조 버튼(`background: var(--bg-subtle)`, `color: var(--text-primary)`, `border: 1px solid var(--border-strong)`)으로 차분하게 정렬한다.

---

### 4.6 [화면 6] 리그 / 배지 영역 (`#home-level-progress` · `#home-league-card` · `#home-badge-grid`)

> **핵심 개편 목표**: 게이미피케이션 영역 전반에 칠해져 있던 **보라색(`#6D28D9` / `#A78BFA`)과 대형 컬러 이모지(`1.8rem`)를 100% 제거**하고, 수험생용 학습 기록장다운 절제된 스코어보드·스탬프 컬렉션으로 개편한다.

1. **히어로 카드 내 레벨 진행 바 (`#home-level-progress.level-progress`)**:
   - `margin: 12px 0 16px`.
   - `.level-progress-head`: `12px`, `weight 500`, `--font-num` (`tabular-nums`), `color: var(--text-secondary)`.
   - `.level-progress-head strong` (`Lv.N`): 보라색(`--xp-primary`) 대신 **`color: var(--text-primary)` (`#18181B` / `#F4F3EF`), `font-size: 13px`, `font-weight: 700`**.
   - `.level-progress-track`: 높이 **`6px`** (기존 `8px` 축소), `border-radius: 9999px`, `background: var(--bg-muted)`.
   - `.level-progress-fill`: 보라색 대신 **`background: var(--amber-primary)` (`#B45309` / 다크 `#E59A2E`)** 단색으로 채운다.
2. **주간 연습 리그 카드 (`#home-league-card.league-card`)**:
   - **섹션 헤더**: `🏆 주간 연습 리그`에서 `🏆` 이모지를 삭제하고 `주간 연습 리그` 텍스트만 남긴다.
   - **카드 외곽**: `background: var(--bg-surface)`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px`, `padding: 16px`, `box-shadow: none`.
   - **고지 캡션 (`.league-caption`)**: `12px`, `line-height: 1.45`, `color: var(--text-muted)`, `padding-bottom: 12px`, `margin-bottom: 12px`, `border-bottom: 1px solid var(--border-subtle)`.
   - **내 순위 요약 (`.league-summary`)**: `14px`, `color: var(--text-secondary)`, `margin-bottom: 12px`. 강조 수치(`strong`)는 보라색을 버리고 `color: var(--text-primary)`, `font-weight: 700`, `--font-num` (`tabular-nums`)을 적용한다.
   - **10인 순위표 (`.league-list` > `.league-row`)**:
     - `.league-list`: `gap: 2px`.
     - `.league-row`: 높이 `36px`, `padding: 6px 10px`, `border-radius: 6px`, `font-size: 14px`, `border: 1px solid transparent`. 짝수 행이나 구분선 없이 깔끔한 테이블 행으로 정렬한다.
     - `.league-row.me` (사용자 본인 행): `background: var(--brand-soft)` (`#EBF3EF` / `#162922`), `border: 1px solid var(--brand-border)` (`#BBD5C9` / `#24473A`), `font-weight: 600` (기존 `800` 축소).
     - `.league-rank`: `width: 24px`, `text-align: right`, `padding-right: 4px`, `13px`, `weight 600`, `--font-num` (`tabular-nums`), `color: var(--text-muted)` (1~3위 및 내 행은 `color: var(--text-primary)`).
     - `.bot-badge` (`BOT`): 알약(`9999px`)을 버리고 **`border-radius: 4px`, `padding: 1px 5px`, `font-size: 12px`, `font-weight: 600`, `--font-en`, `letter-spacing: 0.04em`, `background: var(--bg-subtle)`, `border: 1px solid var(--border-subtle)`, `color: var(--text-muted)`**.
     - `.league-xp`: 보라색(`--xp-primary`)을 버리고 **`color: var(--text-secondary)` (내 행 `.league-row.me .league-xp`만 `color: var(--brand-primary)`, `weight 700`)**, `13px`, `weight 600`, `--font-num` (`tabular-nums`).
3. **학습 배지 컬렉션 (`#home-badge-grid.badge-grid`)**:
   - **그리드 레이아웃**: 기존의 어정쩡한 `repeat(auto-fill, minmax(104px, 1fr))`을 버리고, 모바일 기본 **2열(`grid-template-columns: repeat(2, 1fr)`)**, `min-width: 560px` 이상에서 **4열(`grid-template-columns: repeat(4, 1fr)`)**, `gap: 8px`로 고정한다.
   - **배지 카드 (`.badge-item`)**:
     - `border-radius: 12px`, `padding: 12px`, `box-shadow: none`, `display: flex`, `flex-direction: column`, `align-items: flex-start`, `text-align: left`, `gap: 6px` (기존 중앙 정렬 이모지 타일에서 좌측 정렬 에디토리얼 스탬프 카드로 전환).
     - **아이콘 컨테이너 (`.badge-icon`)**: `1.8rem`(`28.8px`) 컬러 이모지를 폐기하고, **`32px × 32px` 정사각형(`border-radius: 8px`) 프레임 내부에 `18px × 18px` (`stroke-width: 1.75`) 단색 선형 SVG 아이콘**을 중앙 배치한다.
     - **해금 상태 (`.badge-item.unlocked`)**:
       - 카드 전체를 노란색(`--amber-soft`)으로 칠하던 방식을 폐기하고, **카드 배경은 `var(--bg-surface)`(`#FFFFFF` / `#1A1A18`), 카드 테두리는 `1px solid var(--border-strong)`** 으로 유지한다.
       - 대신 `.badge-icon` 프레임만 **`background: var(--amber-soft)`, `border: 1px solid var(--amber-border)`, `color: var(--amber-primary)`** 로 점등하여 품위 있게 강조한다.
       - `.badge-name`: `13px`, `weight 600`, `color: var(--text-primary)`.
       - `.badge-sub` (획득일): `12px`, `weight 500`, `--font-num`, `color: var(--amber-primary)`.
     - **미해금 상태 (`.badge-item.locked`)**:
       - 기존의 `filter: grayscale(1); opacity: 0.48;` (이모지 흑백 필터)를 폐기한다.
       - 카드 배경 `var(--bg-page)`, 카드 테두리 `1px dashed var(--border-subtle)`, `.badge-icon` 프레임은 `background: var(--bg-subtle)`, `border: 1px solid var(--border-subtle)`, `color: var(--text-muted)`.
       - `.badge-name`: `13px`, `weight 500`, `color: var(--text-muted)`.
       - `.badge-sub` (달성 조건): `12px`, `weight 400`, `color: var(--text-muted)`.
4. **레벨업 배너 (`.levelup-banner`)**:
   - 보라색 배경을 버리고 `background: var(--amber-soft)`, `border: 1px solid var(--amber-border)`, `color: var(--amber-primary)`, `border-radius: 8px`, `padding: 10px 12px`, `14px`, `weight 600`으로 변경한다 (`🎉` 이모지 제거).

---

## ⑤ 아이콘 · 이모지 사용 규칙 (Icon & Emoji Policy)

### 5.1 유니코드 이모지 전면 금지 (Zero-Emoji Policy)
- **규칙**: HTML 정적 마크업(`index.html`)과 JS 동적 렌더링 템플릿(`js/app.js`), 토스트 메시지 전체에서 **유니코드 이모지(Emoji) 사용을 0개로 금지**한다.
- **허용되는 텍스트 기호**: 플래시카드 판정 버튼과 완료 버튼에 쓰인 단색 기하 기호(`→`, `○`, `✕`, `✓`)만 폰트 글리프로 허용한다.

### 5.2 SVG 아이콘 수치 규격
모든 아이콘은 인라인 `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` 규격을 따르며 아래 3가지 치수만 허용한다.

| 아이콘 등급 | 크기 (`width × height`) | 선 굵기 (`stroke-width`) | 색상 규칙 | 사용처 |
| :--- | :--- | :--- | :--- | :--- |
| **Icon-SM** | `14px × 14px` | `1.75` | `currentColor` 상속 | `.speak-btn` (단어 발음), `[data-action="speak-sentence"]` (예문 듣기), `#btn-quiz-speak` |
| **Icon-MD** | `16px × 16px`<br>(배지 심볼 `18px × 18px`) | `1.75` | `currentColor` 상속 | `#btn-toggle-sound`, `#btn-toggle-theme`, `.badge-icon` 내부 7종 배지 심볼 |
| **Icon-LG** | `20px × 20px` | 비활성 `1.75`<br>활성 `2.25` | `currentColor` 상속 | 하단 내비게이션 4탭(`.nav-item svg`) |

### 5.3 현행 이모지 19종 전수 처리 매핑표

| 현행 이모지 | 등장 위치 (`index.html` / `js/app.js`) | 개편 처리 방식 (삭제 또는 SVG 치환) |
| :--- | :--- | :--- |
| `🔥` | `#header-streak-badge` (`0일 연속`) | **이모지 삭제** — 텍스트 `0일 연속` (`--font-num`) 단독 표기 |
| `⚡` | `#header-level-badge` (`Lv.1 · 0 XP`) | **이모지 삭제** — 텍스트 `Lv.1 · 0 XP` (`--font-num`) 단독 표기 |
| `🔊` / `🔇` | `#btn-toggle-sound`, `.speak-btn`, 예문 듣기, 발음 토스트 | 버튼 내에서는 **`16px` / `14px` 스피커 선형 SVG**로 치환, 토스트 메시지에서는 **삭제** |
| `🌙` / `☀️` | `#btn-toggle-theme` | **`16px × 16px` Moon / Sun 선형 SVG**로 치환 |
| `🏆` | `index.html` 섹션 제목 (`🏆 주간 연습 리그`) | **이모지 삭제** (`주간 연습 리그` 텍스트만 표기) |
| `💡` | `#wordbook-guide-text`, `.exam-word-signal-label`, 퀴즈 피드백 | **이모지 전량 삭제** (`판단 신호` 텍스트 라벨 + 좌측 `2px` 보더로 대체) |
| `👆` | `.flashcard-hint` (`👆 카드를 클릭하여...`) | **이모지 삭제** (`카드를 눌러 뜻과 예문을 확인하세요`) |
| `🎉` | 퀴즈 정답 피드백(`정답입니다! 🎉`), 레벨업 배너/토스트 | **이모지 전량 삭제** (`정답입니다`, `레벨 업 · Lv.N 달성`) |
| `⚠️` | 기출 기본 뜻 함정 오답 피드백 문구 | **이모지 삭제** (`[기본 뜻 함정 주의]` 텍스트 머릿말로 대체) |
| `📅` | 퀴즈 피드백(`📅 간격반복(SRS):`), `+1일` 시뮬레이션 토스트 | **이모지 전량 삭제** |
| `⭕` / `❌` | 플래시카드 판정 토스트 (`⭕ '알아요' 판정`, `❌ '몰라요' 판정`) | **이모지 삭제** (`'알아요' 판정`, `'몰라요' 판정`) |
| `🏅` | 배지 획득 토스트 (`🏅 새 배지 획득:`) | **이모지 삭제** (`새 배지 획득:`) |
| `🏁` | 배지 1 `first_clear` (`첫 완주`) | `32px` 프레임 내 **`18px` Flag 선형 SVG** (`stroke-width: 1.75`) |
| `🌱` | 배지 2 `streak_3` (`3일 연속 학습`) | `32px` 프레임 내 **`18px` Sprout 선형 SVG** (`stroke-width: 1.75`) |
| `🔥` | 배지 3 `streak_7` (`7일 연속`) | `32px` 프레임 내 **`18px` Flame 선형 SVG** (`stroke-width: 1.75`) |
| `⚡` | 배지 4 `combo_10` (`10연속 정답`) | `32px` 프레임 내 **`18px` Zap 선형 SVG** (`stroke-width: 1.75`) |
| `👑` | 배지 5 `exam_s_all` (`기출 S급 전파`) | `32px` 프레임 내 **`18px` Award/Crown 선형 SVG** (`stroke-width: 1.75`) |
| `🧠` | 배지 6 `srs_stage4_10` (`장기 기억 마스터`) | `32px` 프레임 내 **`18px` Layers/BookmarkCheck 선형 SVG** (`stroke-width: 1.75`) |
| `🎓` | 배지 7 `all_64_learned` (`64단어 전수 학습`) | `32px` 프레임 내 **`18px` GraduationCap/CheckCircle 선형 SVG** (`stroke-width: 1.75`) |

---

## ⑥ 지금 룩에서 버릴 것 목록 (The Kill List)

현재 코드베이스에서 즉시 폐기해야 할 시각 요소와 CSS/마크업 패턴을 항목별로 못 박는다.

### 6.1 색상 및 배경에서 버릴 것
1. **보라색(`--xp-*`) 값 일체**: `:root`의 `#6D28D9`, `#F3E8FF`, `#DDD6FE` 및 `html[data-theme="dark"]`의 `#A78BFA`, `rgba(167, 139, 250, 0.16)`, `rgba(167, 139, 250, 0.38)`.
2. **파란색·하늘색(`--sky-*`, `--info-*`) 값 일체**: `#0E7490`, `#ECFEFF`, `#0369A1`, `#E0F2FE`, `#38BDF8`, `rgba(56, 189, 248, 0.15)`, 그리고 `css/style.css` 678행 `.grade-A`에 하드코딩된 `#BAE6FD`, 1364행 `.wrong-mode-badge.basic-mode`의 `rgba(14, 116, 144, 0.25)`.
3. **다크 모드 청회색(Slate Blue) 배경 6종**: `#0F171E`, `#18232C`, `#21303C`, `#2B3D4B`, `#263542`, `#364958`.
4. **홈 히어로 카드 3열 통계 박스의 신호등 배색**: `.stat-box.highlight-due`(초록 면)와 `.stat-box.highlight-streak`(노란 면)의 배경색·테두리색 채우기.
5. **난이도 배지(`.level-고1`, `.level-고2`, `.level-고3`)의 3색 분기**: 고1(파랑), 고2(초록), 고3(노랑)으로 나뉜 배경·글자색.
6. **오답노트 상단 배너(`.wrong-banner`)의 전면 붉은 배경(`--danger-soft`)** 및 빨강·주황 솔리드 버튼 5개 나열.
7. **퀴즈 기출 탭(`.quiz-tabs.exam-quiz-tabs`)의 노란색 트랙 배경(`--amber-soft`)** 및 활성 탭의 노란 솔리드 배경(`--amber-primary`).
8. **단어 카드 발음 재생 중(`.word-card.speaking`) 카드 전체가 초록색(`--brand-soft`)으로 바뀌는 배경 효과**.
9. **배지 해금 카드(`.badge-item.unlocked`) 전체가 노란색(`--amber-soft`)으로 채워지는 배경 효과**.

### 6.2 박스 중첩 및 테두리에서 버릴 것
10. **홈 히어로 헤드라인 상단의 초록 알약 배지(`.hero-date-label`)**: 헤드라인 바로 위에 떠 있는 파스텔 알약 디자인.
11. **기출 다의어 카드(`.exam-word-card`) 내부의 4중 중첩 박스**:
    - `.exam-base-meaning`의 `border: 1px dashed var(--border-strong)` 및 `background: var(--bg-page)`
    - `.exam-meanings-section`의 `border: 1px solid var(--brand-border)` 및 `background: var(--bg-page)`
    - `.exam-word-signal`의 4면 테두리(`1px solid var(--amber-border)`) 및 노란 박스 배경(`--amber-soft`)
    - `.word-example-box`의 박스 배경(`background: var(--bg-page)`) 및 `3px` 초록 보더
12. **퀴즈 빈칸 해석(`.quiz-blank-ko`)의 회색 배경 박스(`background: var(--bg-page)`)**.
13. **오답노트 및 단어장 빈 상태(`.empty-state`)의 점선 테두리(`1px dashed var(--border-strong)`)**와 홈 SRS 하단 바(`.srs-helper-bar`)의 점선 테두리(`1px dashed var(--border-subtle)`).
14. **두꺼운 테두리(`1.5px`, `2px`) 혼용**: `.choice-btn`(`1.5px`), `.judge-btn`(`1.5px`), `.flashcard-box`(`2px`)를 모두 `1px`로 평탄화.

### 6.3 타이포그래피·모서리·그림자·애니메이션에서 버릴 것
15. **`font-weight: 800` (ExtraBold) 23곳 전량**: `css/style.css` 전체에서 `800` 굵기 완전 삭제.
16. **`12px`(`0.75rem`) 미만의 초소형 폰트 크기 6종**: `0.66rem`(`.bot-badge`), `0.68rem`(`.nav-badge`), `0.7rem`(`.badge-sub`), `0.72rem`(`.stat-sub`, `.mode-badge`, `.srs-stage-interval`, `.level-badge`, `.source-badge`, `.exam-base-tag`, `.quiz-group-caption`, `.trap-pill`, `.judge-sub`, `.wrong-mode-badge`), `0.73rem`(`.exam-word-signal-label`), `0.74rem`(`.brand-subtitle`, `.grade-badge`, `.exam-example-source`, `.nav-item`, `.xp-combo-text`).
17. **과도한 카드 모서리 반경 `--radius-lg: 20px`, `--radius-md: 14px`**.
18. **소형 태그·번호의 원형/알약 반경(`50%`, `9999px`) 남발**: `.choice-num`(`50%`), `.icon-toggle-btn`(`50%`), `.speak-btn`(`9999px`), `.exam-meaning-pct`(`9999px`), `.srs-tag`(`9999px`), `.trap-pill`(`9999px`), `.wrong-mode-badge`(`9999px`), `.xp-gain-pill`(`9999px`), `.bot-badge`(`9999px`).
19. **일반 카드의 상시 그림자(`--shadow-sm`) 및 메인 CTA 버튼의 초록 네온 그림자(`0 4px 12px rgba(15, 110, 86, 0.22)`)**.
20. **과장된 모션 및 글로우 이펙트**:
    - `.mode-card:hover`의 `transform: translateY(-2px)` 부양 효과
    - `.choice-btn.correct`의 `box-shadow: 0 0 0 3px var(--brand-soft)` 글로우 및 `@keyframes correctPop` (`scale(1.025)`)
    - `@keyframes badgeUnlockPop`의 스프링 오버슈트(`cubic-bezier(0.34, 1.56, 0.64, 1)`, `scale(0.75) → scale(1.06)`)
    - `.app-header` 및 `.bottom-nav`의 `backdrop-filter: blur(10px)` 반투명 유리 효과
21. **유니코드 컬러 이모지 19종 및 미해금 배지의 `filter: grayscale(1)` 처리**.

---

## 7. 유보 항목 (Open Decisions — 범위 밖 단정 보류)

제시된 설계 범위 밖이거나, 기존 명세서(`SPEC.md`, `DESIGN.md`)의 기술 제약과 맞물려 임의로 단정할 수 없는 항목은 아래 5가지로 분리하여 유보한다.

1. **[유보 7.1] 웹폰트(`Pretendard`, `Inter`, `JetBrains Mono`)의 에셋 로드 방식**
   - **판단 보류 사유**: `SPEC.md` 2절("외부 API 사용 금지")과 `sw.js` 오프라인 정적 캐시 구조상, 외부 폰트 CDN(`<link href="https://cdn.jsdelivr.net/...">`) 연결이 허용되는지, 혹은 저장소 내 로컬 `.woff2` 서브셋 파일 추가가 허용되는지 확정되지 않았다. 실제 코드 적용 시 로컬 `.woff2` 번들링 여부와 시스템 폰트 폴백 단독 운영 여부를 결정해야 한다.
2. **[유보 7.2] 이모지 19종 제거 및 SVG 치환 시 `index.html` · `js/app.js` 마크업 수정 범위**
   - **판단 보류 사유**: 현행 이모지(`🔥`, `⚡`, `🔊`, `🌙`, `🏆`, `💡`, `🎉`, 배지 아이콘 7종 등)와 인라인 `style="..."` 속성은 `css/style.css`가 아니라 `index.html`과 `js/app.js` 내부 문자열에 하드코딩되어 있다. 구현 단계에서 `css/style.css`만 수정할지, 아니면 기능·구조 불변 전제하에 `index.html` 및 `js/app.js` 내 이모지/인라인 스타일까지 함께 정리할지 유보한다.
3. **[유보 7.3] PWA 매니페스트(`manifest.json`) 및 앱 아이콘(`icons/*`) 색상 동기화 여부**
   - **판단 보류 사유**: 현재 `manifest.json`의 `background_color: "#F8F7F4"`, `theme_color: "#0F6E56"`, `index.html`의 `<meta name="theme-color">`, `icons/icon.svg` 및 PNG 아이콘(`icon-192.png`, `icon-512.png`)은 구 팔레트 값을 사용하고 있다. 개편 팔레트(`#F6F5F0`, `#165B45`, `#18181B`) 적용 시 아이콘 바이너리와 매니페스트 파일까지 수정 대상에 포함할지 유보한다.
4. **[유보 7.4] 홈 화면 주간 연습 리그(10행) 및 배지 컬렉션(7종)의 접기/펼치기(Accordion) 축약 여부**
   - **판단 보류 사유**: 홈 화면(`#view-home`) 하단에 10명 전체 순위표와 7개 배지 그리드가 모두 펼쳐져 있어 모바일 세로 스크롤이 길어진다. 화면 구조를 그대로 두는 본 설계 원칙에 따라 두 섹션의 상시 노출 구조는 유지했으나, 추후 구현 시 리그 표를 '내 순위 전후 3행 요약 + 전체 보기 토글'로 축약할지 여부는 유보한다.
5. **[유보 7.5] 간격반복 시뮬레이션 컨트롤(`.srs-helper-bar`: `+1일 경과 테스트`, `기록 초기화`)의 상시 노출 유지 여부**
   - **판단 보류 사유**: 해당 버튼들은 프로토타입 기능 검증용 개발 도구 성격이 강해 실제 학습 화면의 몰입도를 낮출 수 있으나, `README.md`에 명시된 주요 시뮬레이션 기능이다. 따라서 본 설계에서는 삭제하지 않고 무채색 소형 버튼으로 시각적 비중만 낮추었으며, 이를 별도 설정 모달이나 푸터로 이동할지 여부는 유보한다.
