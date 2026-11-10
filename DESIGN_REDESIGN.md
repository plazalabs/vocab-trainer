# 고등 영단어 트레이너 (vocab-trainer) 디자인 재설계서 v2 (DESIGN_REDESIGN.md)

> **문서 버전**: **v2 (전면 개정판)** — v1(웜 모노크롬 에디토리얼·무그림자·무채색) 설계 전면 폐기 및 학생 친화형 학습 앱 디자인 체계 재수립
> **대상 저장소**: `plazalabs/vocab-trainer` (`main` 브랜치)
> **대상 사용자**: **고등학생 수험생** (매일 자발적으로 앱을 열어 수능·내신 필수 영단어와 기출 다의어를 학습하는 학생)
> **핵심 목표**: 화면 구조(4대 뷰·하단 4탭)와 기능·데이터(`data/*.json`, `localStorage` 스키마)는 v1과 100% 동일하게 유지하면서, **"우중충하고 하기 싫게 생겼다"는 판정을 받은 v1의 개발자 도구풍 무채색·무그림자 외관을 걷어내고, 고등학생이 매일 스스로 열고 싶어지는 밝고 경쾌한 학습 앱 시각 체계**를 수치로 고정한다.
>
> **절대 원칙**:
> 1. **참고 레퍼런스 한정**: 실존 학습 앱 3종(**말해보카, 산타토익, 듀오링고**)만 참고하며, 개발자 도구·에디토리얼 레퍼런스는 일절 금지한다.
> 2. **수치 고정**: 밝은 기본 배경, 선명한 포인트 색 3색 체계 및 정오답 피드백 색(Hex·채도·명도 수치), 둥근 모서리(Radius), 부드러운 그림자(Soft Shadow), 절제된 이모지·아이콘 규칙, 6대 화면별 적용안을 모두 숫자와 코드로 못 박는다.
> 3. **판단 유보 분리**: 제시된 설계 범위 밖이거나 코드 수정·운용 정책과 맞물려 단정할 수 없는 항목은 **「7. 유보 항목」**으로 분리한다.

---

## 0. v1 탈락 판정 원인 분석 및 v2 설계 레퍼런스

### 0.1 v1 설계 탈락 판정과 구조적 원인 (청중 부조화)
v1 설계(웜 모노크롬 에디토리얼, 무그림자, 무채색)는 실제 사용자 판정에서 **"우중충하고 하기 싫게 생겼다"**는 평가와 함께 최종 탈락했다. 실패의 근본 원인은 **타깃 청중(고등학생)과 시각 언어(개발자 도구 미감)의 심각한 부조화**다.

1. **개발자 도구·문서 편집기 미감의 오적용**: 고등학생이 매일 짧은 틈을 내어 단어를 외우는 학습 앱에 개발자용 이슈 트래커·클라우드 대시보드 스타일을 이식해 학습 앱 특유의 활력과 성취감을 소멸시켰다.
2. **누렇고 탁한 배경(`#F6F5F0`, `#EFECE6`)과 85% 무채색 강제**: 화면의 85% 이상을 탁한 미색과 회갈색 스톤 톤으로 덮고, 활성 필터·다음 문제 버튼·오답 시작 버튼까지 먹색(`#18181B`)으로 칠해 화면 전체가 침울하고 답답해 보였다.
3. **무그림자(`box-shadow: none`) · 낮은 단일 곡률(`12px` / `4px~8px`)**: 모든 카드의 그림자를 제거하고 모서리를 좁혀, 터치하고 싶은 입체적인 학습 카드가 아니라 딱딱한 흑백 행정 문서 표처럼 느껴지게 만들었다.
4. **이모지 0개 전면 금지로 인한 동기부여 상실**: 연속 학습 스트릭(`🔥`), 레벨·XP(`⚡`), 주간 리그(`🏆`), 정답 축하(`🎉`), 7종 성취 배지까지 모두 단색 선형 아이콘이나 건조한 텍스트로 치환해 학습 지속 동기를 자극하는 보상감을 지워버렸다.

### 0.2 v2 참고 레퍼런스: 실존 학습 앱 3종과 채택 요소
v2는 개발자 도구·에디토리얼 레퍼런스를 전면 배제하고, 실제 고등학생·수험생이 매일 사용하는 **실존 학습 앱 3종(말해보카, 산타토익, 듀오링고)**에서만 설계 원리를 가져온다.

| 참고 학습 앱 | 앱의 핵심 시각 특징 | 본 프로젝트(`vocab-trainer`) v2에 가져오는 요소 |
| :--- | :--- | :--- |
| **말해보카**<br>(Malhaeboca) | - 밝고 맑은 화이트 카드 스테이지와 넉넉한 곡률(`18px~24px`)<br>- 다의어·예문·어휘 뉘앙스를 색채 배지와 소프트 박스로 친근하게 구조화<br>- 문제 풀이 시 보기 버튼 전체가 즉각 물드는 시원한 정오답 피드백 | 1. **밝은 쿨 화이트 바탕(`#F7F9FC`) + 순백색(`#FFFFFF`) 카드 + 부드러운 다층 그림자(`--shadow-sm`, `--shadow-md`)**로 시선이 모이는 경쾌한 학습 카드 구성<br>2. **기출 다의어 카드(`.exam-word-card`)의 친근한 소프트 섹션화**: 인쇄 사전식 흑백 줄글 대신, `'시험에서는 이 뜻'`(블루 틴트 박스 `#F8FAFF`), `'💡 판단 신호'`(앰버 콜아웃 `#FFFBEB`), `'예문 박스'`(소프트 쿨그레이 `#F8FAFC`)로 시각적 앵커 복원<br>3. **4지선다 보기(`.choice-btn`)의 큼직한 터치 영역(`min-height: 52px`, `radius: 14px`)**과 정오답 선택 시 카드 전체가 에메랄드/코랄로 물드는 직관적 피드백 |
| **산타토익**<br>(Santa TOEIC) | - 수험생에게 신뢰감과 집중력을 주는 선명한 **로열 블루(Royal Blue)** 주조색<br>- 학습량·예측 점수·복습 주기를 한눈에 파악하게 해 주는 정밀한 수치 대시보드<br>- 문제 등급(`S급`/`A급`) 및 취약 유형의 명쾌한 컬러 배지 분류 | 1. **선명한 일렉트릭 로열 블루(`#2563EB`)를 앱의 제1 포인트 색(`--brand-primary`)으로 채택**: 메인 시작 CTA 버튼, 활성 필터 알약, 진행률 바, 오늘 복습할 단어 수에 적용하여 수험생 앱다운 깔끔한 추진력 확보<br>2. **고정폭 숫자(`tabular-nums`) 기반의 3열 핵심 지표 카드 & SRS 5단계 현황판**: 복습 대기 단어, 미학습 단어, SRS 단계(`1일→3일→7일→14일`) 수치를 3색 소프트 카드 위에서 또렷하게 대조<br>3. **난이도(`고1`·`고2`·`고3`), 기출 등급(`S급`·`A급`), 오답 유형 배지의 컬러 코드 복원**으로 학습 우선순위 즉시 판별 |
| **듀오링고**<br>(Duolingo) | - 매일 접속을 유도하는 **비비드 앰버/오렌지 스트릭(`🔥`)·XP(`⚡`)·배지 보상 체계**<br>- 정답(선명한 그린)과 오답(선명한 코랄 레드)의 0.1초 직관적 양극단 피드백<br>- 학습 흐름을 방해하지 않으면서 성취감을 극대화하는 절제된 이모지·탄력 모션 | 1. **비비드 텐저린 앰버(`#F59E0B` / `#D97706`)를 제2 포인트 색으로 채택**: 연속 학습일(`🔥`), 레벨·XP 게이지, 주간 연습 리그 상위권, 7종 배지 해금에 적용해 매일 열고 싶은 동기부여 형성<br>2. **한눈에 구분되는 정답(`#10B981` / `#059669` 에메랄드 그린) vs 오답(`#E11D48` 코랄 레드) 피드백 체계** 및 정답 선택 시 가벼운 탄력 팝(`correctPop`) 복원<br>3. **핵심 동기부여 지점(스트릭·레벨·리그·피드백·배지 7종·판단 신호)에 한정된 12종 이모지의 절제된 사용 규칙** 수립 |

---

## ① 색상 팔레트 (Color Palette Specification)

### 1.1 기본 원칙
1. **밝고 맑은 배경(Bright & Airy Surface) 기본화**:
   - v1의 누렇고 어두운 미색 종이(`#F6F5F0`, `#EFECE6`)를 폐기하고, 채광 좋은 스터디 공간처럼 맑고 산뜻한 **브라이트 쿨 화이트(`#F7F9FC`)** 바탕과 **순백색(`#FFFFFF`)** 카드를 기본 배경으로 고정한다.
2. **선명한 포인트 색 3색 체계 고정**:
   - v1의 85% 무채색 원칙과 침울한 저명도 색상을 폐기한다.
   - 고등학생 학습자의 시선을 명확히 이끌고 동기를 부여하는 **3대 포인트 색 체계**를 역할별로 분리 고정한다:
     - **포인트 1 (Primary Action — 산타토익·말해보카식 러닝 블루)**: **일렉트릭 로열 블루 (`#2563EB`)** — 메인 CTA, 활성 탭/필터, 진행률 바, 오늘 복습할 단어 강조.
     - **포인트 2 (Motivation & Exam Highlight — 듀오링고식 에너지 앰버)**: **비비드 텐저린 앰버 (`#F59E0B` / 텍스트 `#D97706`)** — 연속 학습일 스트릭(`🔥`), 레벨·XP 게이지, 기출 `S급` 배지, 판단 신호(`💡`), 해금 배지 강조.
     - **포인트 3 (Mastery & Correct — 듀오링고·말해보카식 성취 그린)**: **바이브런트 민트 에메랄드 (`#10B981` / 고대비 `#059669`)** — 정답 판정, SRS 4단계(14일 장기기억 완성), 기출 출제 비중(`%`), 주간 리그 내 순위 행 강조.
3. **정답 · 오답 피드백 색의 한눈에 구분 원칙 (Instant Visual Polarity)**:
   - 퀴즈 채점 순간 0.1초 만에 정오답이 직관적으로 구분되도록 색상환(Hue) 기준 **에메랄드 그린(`H 160°`)**과 **비비드 코랄 레드(`H 347°`)**로 **173°의 보색에 가까운 극단적 색상 대비**를 형성한다.
   - 단순히 글자색만 바꾸는 것이 아니라 **① 소프트 배경 면(`#ECFDF5` vs `#FFF1F2`) + ② `2px` 솔리드 테두리(`#10B981` vs `#E11D48`) + ③ 보기 번호 키캡 반전 + ④ 외곽 포커스 링(`3px` 글로우)**의 4중 시각 채널을 동시에 전환한다.

### 1.2 선명한 포인트 3색 및 정오답 피드백 색 수치 고정표 (Hex · 채도 · 명도)
채도(Saturation)와 명도(Lightness / Brightness)는 CSS 표준 **HSL(`H`, 채도 `S`, 명도 `L`)**과 그래픽 표준 **HSV/HSB(`H`, 채도 `S`, 명도 `V`)** 두 체계의 수치를 모두 명시하여 해석 오차를 원천 차단한다.

| 구분 | 역할 및 적용처 | 토큰명 | 라이트 모드 `#HEX` | HSL (색상 `H` · 채도 `S` · 명도 `L`) | HSV/HSB (색상 `H` · 채도 `S` · 명도 `V`) | 다크 모드 `#HEX` (HSL 수치) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **포인트 1**<br>(Primary Action) | 메인 CTA 버튼, 활성 필터, 진행률 바, 오늘 복습 수, 기출 `A급` | `--brand-primary` | **`#2563EB`** | `H 221°` · **채도 `83%`** · **명도 `53%`** | `H 221°` · **채도 `84%`** · **명도 `92%`** | `#3B82F6`<br>(`H 217°`, `S 91%`, `L 60%`) |
| | 메인 CTA 호버/프레스 | `--brand-primary-hover` | **`#1D4ED8`** | `H 224°` · **채도 `76%`** · **명도 `48%`** | `H 224°` · **채도 `87%`** · **명도 `85%`** | `#60A5FA`<br>(`H 213°`, `S 94%`, `L 68%`) |
| **포인트 2**<br>(Motivation & Exam) | 레벨 게이지 바, 판단 신호 보더, 배지 아이콘 포인트 | `--amber-accent` | **`#F59E0B`** | `H 38°` · **채도 `92%`** · **명도 `50%`** | `H 38°` · **채도 `96%`** · **명도 `96%`** | `#FBBF24`<br>(`H 43°`, `S 96%`, `L 56%`) |
| | 스트릭 숫자, 기출 `S급` 텍스트, XP 텍스트 (고대비 가독성) | `--amber-primary` | **`#D97706`** | `H 32°` · **채도 `95%`** · **명도 `44%`** | `H 32°` · **채도 `97%`** · **명도 `85%`** | `#FBBF24`<br>(`H 43°`, `S 96%`, `L 56%`) |
| **포인트 3 & 정답 피드백**<br>(Mastery & Correct) | 정답 선택지 보더/키캡, `'알아요'` 버튼, SRS 완성 포인트 | `--success-accent` | **`#10B981`** | `H 160°` · **채도 `84%`** · **명도 `39%`** | `H 160°` · **채도 `91%`** · **명도 `73%`** | `#34D399`<br>(`H 158°`, `S 64%`, `L 52%`) |
| | 정답 텍스트, 출제 비중(`%`), SRS 4단계 숫자, 내 리그 XP | `--success-primary` | **`#059669`** | `H 161°` · **채도 `94%`** · **명도 `30%`** | `H 161°` · **채도 `97%`** · **명도 `59%`** | `#34D399`<br>(`H 158°`, `S 64%`, `L 52%`) |
| **오답 피드백**<br>(Wrong & Alert) | 오답 선택지 보더/키캡/텍스트, `'몰라요'` 버튼, 오답 횟수 배지 | `--danger-primary` | **`#E11D48`** | `H 347°` · **채도 `77%`** · **명도 `50%`** | `H 347°` · **채도 `87%`** · **명도 `88%`** | `#FB7185`<br>(`H 351°`, `S 95%`, `L 71%`) |

### 1.3 정답 vs 오답 피드백 시각 대비 명세 (한눈에 구분되는 4중 채널)

| 비교 채널 | 기본 상태 (선택 전 `.choice-btn`) | **정답 판정 상태 (`.choice-btn.correct` / `.quiz-feedback.correct`)** | **오답 판정 상태 (`.choice-btn.wrong` / `.quiz-feedback.wrong`)** |
| :--- | :--- | :--- | :--- |
| **① 배경 면 (Surface)** | `#FFFFFF` (순백색) | **`#ECFDF5`** (`H 152°, S 81%, L 96%` — 민트 그린 소프트) | **`#FFF1F2`** (`H 356°, S 100%, L 97%` — 코랄 핑크 소프트) |
| **② 외곽선 (Border)** | `1.5px solid #CBD5E1` | **`2px solid #10B981`** (`H 160°, S 84%, L 39%`) | **`2px solid #E11D48`** (`H 347°, S 77%, L 50%`) |
| **③ 텍스트 및 번호 키캡** | 텍스트 `#0F172A`<br>키캡 `#F1F5F9` / `#475569` | 텍스트 **`#065F46`** (`weight 600`)<br>키캡 배경 **`#10B981`**, 글자 **`#FFFFFF`** | 텍스트 **`#9F1239`** (`weight 600`)<br>키캡 배경 **`#E11D48`**, 글자 **`#FFFFFF`** |
| **④ 포커스 링 & 모션** | `box-shadow: var(--shadow-xs)` | **`0 0 0 3px rgba(16, 185, 129, 0.18)`**<br>+ `correctPop` (`scale(1.02)` 탄력 팝) | **`0 0 0 3px rgba(225, 29, 72, 0.16)`**<br>+ `wrongShake` (`±6px` 좌우 진동) |

### 1.4 전체 CSS 색상 토큰 명세표 (라이트 기본 · 다크 보조)

| 분류 | CSS 변수명 (기존 호환 + 확장) | 라이트 모드 (기본) | 라이트 채도·명도 (HSL) | 다크 모드 (보조) | 적용 대상 및 역할 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **배경 (Surface)** | `--bg-page` | **`#F7F9FC`** | `H 216°, S 33%, L 98%` | `#0F172A` | 앱 전체 바탕 (맑고 밝은 쿨 화이트 / 다크 딥 슬레이트) |
| | `--bg-surface` | **`#FFFFFF`** | `H 0°, S 0%, L 100%` | `#1E293B` | 모든 카드·스테이지·모달·활성 세그먼트 표면 |
| | `--bg-subtle` | **`#F1F5F9`** | `H 210°, S 40%, L 96%` | `#273549` | 세그먼트 탭 트랙, 보조 버튼, 기본 태그·예문 배경 |
| | `--bg-muted` | **`#E2E8F0`** | `H 214°, S 32%, L 91%` | `#334155` | 진행률 바 빈 트랙(`.progress-track`), 비활성 구분 |
| | `--bg-tint-blue` | **`#F8FAFF`** | `H 223°, S 100%, L 99%` | `#172554` | 히어로 카드 은은한 상하단 틴트, 기출 시험 뜻 섹션 배경 |
| | `--bg-header-glass` | **`rgba(255, 255, 255, 0.88)`** | 백색 `88%` + `blur(12px)` | `rgba(15, 23, 42, 0.88)` | 상단 고정 헤더 글래스 배경 |
| | `--bg-nav-glass` | **`rgba(255, 255, 255, 0.92)`** | 백색 `92%` + `blur(12px)` | `rgba(30, 41, 59, 0.92)` | 하단 고정 내비게이션 글래스 배경 |
| **텍스트 (Typography)** | `--text-primary` | **`#0F172A`** | `H 222°, S 47%, L 11%` | `#F8FAFC` | 표제어, 헤드라인, 대표 한국어 뜻, 본문 주 텍스트 (대비 `17.4:1`) |
| | `--text-secondary` | **`#475569`** | `H 215°, S 19%, L 35%` | `#CBD5E1` | 예문 해석, 카드 설명, 판단 신호 본문, 비활성 탭 (대비 `7.2:1`) |
| | `--text-muted` | **`#64748B`** | `H 215°, S 16%, L 47%` | `#94A3B8` | 출처, 날짜, SRS 보조 캡션, 가이드 문구 (대비 `4.6:1`) |
| | `--text-on-solid` | **`#FFFFFF`** | `H 0°, S 0%, L 100%` | `#0F172A` | 솔리드 강조 버튼 위 텍스트 |
| **테두리 (Border)** | `--border-subtle` | **`#E2E8F0`** | `H 214°, S 32%, L 91%` | `#334155` | 모든 카드 기본 외곽선(`1px`), 내부 구분선 |
| | `--border-strong` | **`#CBD5E1`** | `H 213°, S 27%, L 84%` | `#475569` | 검색창, 드롭다운, 4지선다 보기(`.choice-btn`) 기본 테두리 |
| | `--border-focus` | **`#2563EB`** | `H 221°, S 83%, L 53%` | `#60A5FA` | 검색창 포커스, 선택지 호버 테두리 (로열 블루) |
| **포인트 1: 주조색 (Royal Blue)** | `--brand-primary` | **`#2563EB`** | `H 221°, S 83%, L 53%` | `#3B82F6` | 메인 CTA, 활성 필터, 진행률 바, 오늘 복습 수, `고2`/`A급` |
| | `--brand-primary-hover` | **`#1D4ED8`** | `H 224°, S 76%, L 48%` | `#60A5FA` | 메인 CTA 호버 상태 |
| | `--brand-soft` | **`#EFF6FF`** | `H 214°, S 100%, L 97%` | `#1E3A8A` | 복습 통계 박스, 레벨 알약, `고2`/`A급` 배지, 모드 배지 배경 |
| | `--brand-border` | **`#BFDBFE`** | `H 213°, S 97%, L 87%` | `#2563EB` | 블루 소프트 카드 및 배지 테두리 |
| **포인트 2: 동기부여 (Amber)** | `--amber-accent` | **`#F59E0B`** | `H 38°, S 92%, L 50%` | `#FBBF24` | 레벨 프로그레스 바 채움, 판단 신호 좌측 보더(`3px`) |
| | `--amber-primary` | **`#D97706`** | `H 32°, S 95%, L 44%` | `#FBBF24` | 스트릭, 기출 `S급`, `고3`, XP 획득 배지, 해금 배지 텍스트 |
| | `--amber-soft` | **`#FFFBEB`** | `H 48°, S 100%, L 96%` | `#451A03` | 스트릭 박스, `S급` 배지, 판단 신호 콜아웃, 해금 배지 배경 |
| | `--amber-border` | **`#FDE68A`** | `H 48°, S 97%, L 77%` | `#92400E` | 앰버 소프트 박스 및 해금 배지 테두리 |
| **포인트 3 & 정답 (Emerald)** | `--success-accent` | **`#10B981`** | `H 160°, S 84%, L 39%` | `#34D399` | 정답 선택지 보더(`2px`), 정답 번호 키캡, `'알아요'` 버튼 배경 |
| | `--success-primary` | **`#059669`** | `H 161°, S 94%, L 30%` | `#34D399` | 정답 헤더, 출제 비중(`%`), SRS 4단계 숫자, `고1` 배지, 내 리그 XP |
| | `--success-soft` | **`#ECFDF5`** | `H 152°, S 81%, L 96%` | `#064E3B` | 정답 선택지·피드백 배경, 내 리그 행(`.league-row.me`), `고1` 배지 배경 |
| | `--success-border` | **`#A7F3D0`** | `H 152°, S 76%, L 80%` | `#059669` | 정답 피드백 패널 및 내 리그 행 테두리 |
| **오답 / 경고 (Coral Red)** | `--danger-primary` | **`#E11D48`** | `H 347°, S 77%, L 50%` | `#FB7185` | 오답 선택지 보더/텍스트, `'몰라요'` 텍스트, 오답 횟수 배지 |
| | `--danger-soft` | **`#FFF1F2`** | `H 356°, S 100%, L 97%` | `#4C0519` | 오답 선택지·피드백 배경, 오답 횟수 배지 배경, `'몰라요'` 버튼 배경 |
| | `--danger-border` | **`#FECDD3`** | `H 353°, S 96%, L 90%` | `#9F1239` | 오답 배너·배지·버튼 테두리 |
| **호환 매핑 토큰** | `--xp-primary` | **`#2563EB`** | `H 221°, S 83%, L 53%` | `#60A5FA` | 레벨·XP 강조 텍스트 (로열 블루로 통합) |
| | `--xp-soft` / `--xp-border` | **`#EFF6FF`** / **`#BFDBFE`** | - | `#1E3A8A` / `#2563EB` | 레벨 알약 배경 및 테두리 |
| | `--sky-primary` / `--info-primary` | **`#2563EB`** | `H 221°, S 83%, L 53%` | `#60A5FA` | 기본 모드 오답 배지, `A급` 등 정보성 강조 |
| | `--sky-soft` / `--info-soft` | **`#EFF6FF`** | `H 214°, S 100%, L 97%` | `#1E3A8A` | 기본 모드 오답 배지 배경 |

---

## ② 글꼴 체계 (Typography System Specification — v1 유지)

v1에서 수립한 **한글(`Pretendard`) · 영문(`Inter`) · 숫자(`JetBrains Mono`) 3원화 체계**와 **`tabular-nums` 고정폭 숫자 원칙**, **8단계 크기 스케일(`12px~28px`)**은 학습 앱의 가독성과 수치 정밀도를 높이는 검증된 자산이므로 v2에서도 그대로 유지한다.

### 2.1 한글 · 영문 · 숫자 3원화 글꼴 지정

| 구분 | CSS 변수명 | 지정 폰트 패밀리 (우선순위 순) | 필수 OpenType / CSS 속성 | 적용 대상 |
| :--- | :--- | :--- | :--- | :--- |
| **한글 (Korean)** | `--font-ko` | `"Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif` | `word-break: keep-all;`<br>`overflow-wrap: break-word;` | 앱 타이틀, 섹션 제목, 한국어 뜻(`.word-meaning`), 예문 해석(`.word-example-ko`), 판단 신호 설명, 버튼·탭·필터 라벨 |
| **영문 (English)** | `--font-en` | `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | `font-feature-settings: "cv02" 1, "cv03" 1, "cv04" 1, "cv11" 1;`<br>(영문 `a`, `g`, `I`, `l` 판독성 강화) | 단어장·퀴즈 영단어 표제어(`.word-en`, `.quiz-target-word`), 품사(`.word-pos`), 영어 예문(`.word-example-en`, `.quiz-blank-sentence`), 선택지 영단어(`.choice-word`), `BOT` 배지 |
| **숫자 (Numeric)** | `--font-num` | `"JetBrains Mono", "SF Mono", "Roboto Mono", "Pretendard Variable", monospace` | `font-variant-numeric: tabular-nums lining-nums;`<br>`font-feature-settings: "tnum" 1, "zero" 0;` | 홈 3대 지표 숫자(`.stat-value`), SRS 단계별 단어 수(`.srs-stage-count`), 레벨·XP 수치, 리그 순위·주간 XP, 기출 출제 비중(`.exam-meaning-pct`), 퀴즈 진행 번호(`1 / 24`), 보기 번호(`.choice-num`), 오답 횟수, 날짜 |

### 2.2 크기 · 굵기 · 행간 · 자간 8단계 계층표 (px 및 rem 고정)
- **기준값**: `html { font-size: 16px; }` (`1rem = 16px`).
- **굵기(Weight) 규칙**: `400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold) 4단계를 사용한다 (`font-weight: 800` 남발 금지 유지).
- **최소 크기 하한선**: 모바일 수험생 가독성을 위해 **`12px`(`0.75rem`) 미만의 초소형 폰트 사용 금지**를 유지한다.

| 계층 코드 | 역할 (Role) | 크기 (`px`) | 비율 (`rem`) | 굵기 (`font-weight`) | 행간 (`line-height`) | 자간 (`letter-spacing`) | 적용 폰트 | 매핑 대상 셀렉터 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Type-1** | **Quiz Headword**<br>(퀴즈 출제 영단어) | `28px` | `1.750rem` | `700` | `1.20` | `-0.025em` | `--font-en` | `.quiz-target-word` (기본/기출/플래시카드 공통 단일 크기 고정) |
| **Type-2** | **Hero Stat Number**<br>(홈/요약 핵심 대숫자) | `24px` | `1.500rem` | `700` | `1.15` | `-0.030em` | `--font-num` | `.stat-value` (`#stat-due-count`, `#stat-new-count`, `#stat-streak-count`) |
| **Type-3** | **Card Headword & Headline**<br>(단어장 표제어 · 히어로 제목) | `20px` | `1.250rem` | 영문 `700`<br>한글 `700` | `1.30` | `-0.020em` | `--font-en`<br>`--font-ko` | `.word-en`, `.hero-headline`, `.flashcard-meaning` |
| **Type-4** | **Section Title & Meaning**<br>(섹션 제목 · 대표 한국어 뜻) | `16px` | `1.000rem` | `600`~`700` | `1.45` | `-0.015em` | `--font-ko` | `.brand-title`, `.section-title`, `.word-meaning`, `.wrong-banner-title`, `.empty-title`, `.primary-cta-btn`, `.srs-stage-count`(`--font-num`, `700`) |
| **Type-5** | **Primary Reading & Action**<br>(영어 예문 · 선택지 · 버튼) | `15px` | `0.9375rem` | 예문 `400`<br>보기 `500`<br>강조 `600` | `1.55` | 영문 `-0.005em`<br>한글 `-0.015em` | `--font-en`<br>`--font-ko` | `.quiz-blank-sentence`, `.word-example-en`, `.choice-btn`, `.next-question-btn`, `.judge-btn`, `.mode-card-title`(`600`), `.exam-meaning-ko`(`600`) |
| **Type-6** | **Secondary Body**<br>(예문 해석 · 신호 설명 · 입력창) | `14px` | `0.875rem` | `400`<br>(강조 `500`) | `1.55` | `-0.010em` | `--font-ko` | `.word-example-ko`, `.quiz-blank-ko`, `.exam-word-signal-body`, `.exam-base-text`, `.search-input`, `.league-row`, `.league-summary`, `.wrong-banner-desc`, `.empty-desc` |
| **Type-7** | **UI Control & Meta**<br>(탭 · 필터 알약 · 진행 헤더) | `13px` | `0.8125rem` | 기본 `500`<br>활성 `600` | `1.40` | `-0.005em` | `--font-ko`<br>`--font-num` | `.dataset-tab-btn`, `.quiz-tab-btn`, `.filter-pill`, `.scope-select`, `.quiz-progress-header`, `.mode-card-desc`(`400`), `.exam-meaning-sig`, `.speak-btn`, `.mini-btn`, `.wrong-start-btn`, `.toast-msg`, `.badge-name`(`600`), `.choice-num`(`700`) |
| **Type-8** | **Micro Tag & Caption**<br>(품사 · 등급 · 출처 · 하단 탭) | `12px` | `0.750rem` | 기본 `500`<br>배지 `600`~`700` | `1.35` | 한글 `0em`<br>영문 `+0.04em` | `--font-ko`<br>`--font-en`<br>`--font-num` | `.word-pos`, `.level-badge`, `.grade-badge`, `.source-badge`, `.srs-tag`, `.wrong-mode-badge`, `.exam-meaning-pct`, `.bot-badge`, `.streak-pill`, `.level-pill`, `.nav-item`, `.section-caption`, `.hero-date-label`, `.badge-sub` |

---

## ③ 여백 · 모서리 · 그림자 규칙 (Spacing, Rounded Radius & Soft Shadow)

### 3.1 여백(Spacing) 규칙 — `4px` 기본 그리드 유지
v1에서 정립한 **7개 간격 토큰(`4px` 배수)**과 컨테이너 치수를 그대로 유지한다.

| 토큰명 | 수치 (`px`) | 비율 (`rem`) | 고정 사용처 |
| :--- | :--- | :--- | :--- |
| `--space-1` | `4px` | `0.25rem` | 세그먼트 탭 트랙 내부 패딩(`padding: 4px`), 인라인 아이콘-텍스트 간격 |
| `--space-2` | `8px` | `0.50rem` | 필터 알약 간격(`gap: 8px`), 헤더 배지 간격 |
| `--space-3` | `12px` | `0.75rem` | 단어 카드 리스트 간격(`.word-list { gap: 12px }`), 4지선다 보기 간격(`gap: 10px~12px`), 카드 내부 블록 간격 |
| `--space-4` | `16px` | `1.00rem` | 앱 좌우 기본 여백(`16px`), 일반 카드 내부 패딩(`16px~18px`) |
| `--space-5` | `20px` | `1.25rem` | 히어로·퀴즈 스테이지 카드 내부 패딩(`20px~24px`) |
| `--space-6` | `24px` | `1.50rem` | 홈 화면 섹션 헤더 상단 여백(`margin-top: 24px`) |
| `--space-8` | `32px` | `2.00rem` | 빈 상태 카드(`.empty-state`) 상하 패딩(`padding: 32px 20px`), 메인 영역 하단 여백 |

- **레이아웃 컨테이너 고정 치수**:
  - `.app-shell`: `max-width: 720px`, `padding-bottom: 80px`
  - `.app-header`: 높이 `60px` (`padding: 0 16px`)
  - `.main-content`: `padding: 20px 16px 32px`
  - `.bottom-nav-inner`: 높이 `64px`, 4열 균등 그리드(`grid-template-columns: repeat(4, 1fr)`)

### 3.2 모서리 반경(Border Radius) 규칙 — v1 단일·각진 반경 폐기, 둥근 다단계 곡률 도입
v1의 각지고 딱딱한 반경(`4px`, `6px`, `8px`, 단일 카드 `12px`)을 전면 폐기하고, 말해보카·듀오링고처럼 손끝에 부드럽고 친근하게 감기는 **6단계 라운드 모서리 체계(`8px ~ 24px` 및 `9999px`)**를 수치로 고정한다.

| 토큰명 | 수치 (`px`) | v1 수치 (폐기) | 적용 대상 컴포넌트 |
| :--- | :--- | :--- | :--- |
| **`--radius-xs`** | **`8px`** | *(구 `4px` 폐기)* | 인라인 마이크로 배지·태그: `.word-pos`, `.level-badge`, `.grade-badge`, `.exam-base-tag`, `.exam-meaning-pct`, `.srs-tag`, `.wrong-count-badge`, `.wrong-mode-badge`, `.bot-badge`, `.trap-pill` |
| **`--radius-sm`** | **`10px`** | *(구 `6px` 폐기)* | 소형 컨트롤·내부 셀·키캡: `.dataset-tab-btn`, `.quiz-tab-btn`, `.mini-btn`, `.speak-btn`, `.wrong-start-btn`, `.srs-stage-item`, `.league-row`, `.choice-num` (`28px×28px` 라운드 키캡), `.brand-logo` |
| **`--radius-md`** | **`14px`** | *(구 `8px` 폐기)* | 주요 입력창·선택지·액션 버튼·내부 소프트 박스: `.search-input`, `.scope-select`, `.wordbook-dataset-tabs`, `.quiz-tabs`, `.primary-cta-btn`, `.choice-btn`, `.judge-btn`, `.next-question-btn`, `.quiz-feedback`, `.exam-meanings-section`, `.exam-word-signal`(`0 12px 12px 0`), `.word-example-box`(`0 12px 12px 0`), `.badge-icon`(`12px`) |
| **`--radius-lg`** | **`18px`** | *(구 `12px` 폐기)* | 일반 카드 컨테이너 및 홈 3열 통계 서브카드: `.word-card`, `.exam-word-card`, `.mode-card`, `.srs-panel`, `.toolbar-card`, `.quiz-config-bar`, `.wrong-banner`, `.league-card`, `.badge-item`, `.empty-state`, `.stat-box`(`16px`) |
| **`--radius-xl`** | **`24px`** | *(신설)* | 최상위 집중 스테이지 카드: `.hero-card` (홈 히어로 카드), `.quiz-stage-card` (퀴즈 문제 스테이지), `.flashcard-box` (플래시카드) |
| **`--radius-pill`** | **`9999px`** | *(제한 해제)* | 알약형·원형 컴포넌트: `.filter-pill`, `.streak-pill`, `.level-pill`, `#home-date-badge.hero-date-label`, `.xp-gain-pill`, `.icon-toggle-btn` (`36px×36px` 원형), `.progress-track`/`.progress-fill`, `.level-progress-track`/`.level-progress-fill`, `.nav-badge`, `.toast-msg` |

### 3.3 부드러운 그림자(Soft Shadow) 규칙 — v1 무그림자(`box-shadow: none`) 원칙 폐기
v1의 일반 카드 무그림자 강제 규칙을 폐기한다. 밝은 배경(`#F7F9FC`) 위에서 순백색 카드(`#FFFFFF`)가 탁하지 않고 맑게 떠오르도록 **블루-슬레이트 틴트(`rgb(15, 23, 42)`) 기반의 저밀도 확산형 소프트 섀도 5종**을 수치로 고정한다.

| 토큰명 | 라이트 모드 CSS 값 (기본) | 다크 모드 CSS 값 (보조) | 적용 대상 컴포넌트 |
| :--- | :--- | :--- | :--- |
| **`--shadow-xs`** | `0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)` | `0 1px 3px rgba(0, 0, 0, 0.35)` | 세그먼트 활성 탭(`.dataset-tab-btn.active`, `.quiz-tab-btn.active`), 4지선다 보기(`.choice-btn` 기본), `.wrong-start-btn` |
| **`--shadow-sm`** | `0 4px 14px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04)` | `0 4px 14px rgba(0, 0, 0, 0.40)` | **모든 일반 카드 기본 그림자**: `.word-card`, `.exam-word-card`, `.mode-card`, `.srs-panel`, `.toolbar-card`, `.quiz-config-bar`, `.wrong-banner`, `.league-card`, `.badge-item.unlocked` |
| **`--shadow-md`** | `0 10px 26px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04)` | `0 10px 28px rgba(0, 0, 0, 0.50)` | **최상위 포커스 스테이지 및 카드 호버**: `.hero-card`, `.quiz-stage-card`, `.flashcard-box`, `.mode-card:hover`, `.word-card:hover` |
| **`--shadow-cta`** | `0 6px 16px -2px rgba(37, 99, 235, 0.28), 0 2px 6px -1px rgba(37, 99, 235, 0.16)` | `0 6px 18px rgba(59, 130, 246, 0.35)` | 홈/요약 메인 시작 버튼(`.primary-cta-btn`) 전용 블루 소프트 글로우 |
| **`--shadow-float`** | `0 12px 28px -4px rgba(15, 23, 42, 0.16), 0 4px 12px -2px rgba(15, 23, 42, 0.08)` | `0 12px 32px rgba(0, 0, 0, 0.65)` | 화면 하단 플로팅 토스트 알림(`.toast-msg`) |

---

## ④ 이모지 · 아이콘의 절제된 사용 규칙 (Restrained Emoji & Icon Policy)

### 4.1 기본 원칙 — v1 이모지 전면 금지 폐기 및 동기부여 중심 허용
- v1의 "유니코드 이모지 0개 전면 금지(Zero-Emoji Policy)"를 **폐기**한다.
- 듀오링고·말해보카처럼 고등학생 학습자의 습관 형성과 성취감을 자극하는 **동기부여·보상·핵심 힌트 지점**에는 친근한 컬러 이모지를 전략적으로 사용하고, **오디오·테마·내비게이션 등 기능 제어 UI**에는 깔끔한 선형 SVG 아이콘을 사용하는 **역할 분리(Dual System)** 규칙을 확립한다.

### 4.2 수량 및 밀도 수치 제한 규칙 (Quantitative Caps)
이모지가 무분별하게 남발되어 학습 화면이 산만해지는 것(v0의 문제)을 막기 위해 아래 4가지 수량 상한을 숫자로 못 박는다.

1. **앱 전체 허용 이모지 종류 상한: 총 `12종` 고정**:
   - 앱 전체에서 허용하는 유니코드 이모지는 아래 **12종**(`🔥`, `⚡`, `🏆`, `🎉`, `💡`, `🏁`, `🌱`, `👑`, `🧠`, `🎓`, `✨`, `🎯`)으로 엄격히 제한한다.
2. **한 화면(Viewport) 동시 노출 개수 상한: 일반 학습 화면 최대 `4개` (홈 배지 그리드 제외)**:
   - 상단 헤더 고정 배지 **`2개`**(`🔥` 스트릭 1개 + `⚡` 레벨 1개) + 본문 뷰포트 내 동시 노출 **최대 `2개`** = 한 화면에서 동시에 보이는 이모지는 **최대 `4개` 이하**로 제한한다.
   - 예외: 홈 화면 하단 `#home-badge-grid`(학습 배지 컬렉션 7종)는 업적 쇼케이스 영역이므로 슬롯당 1개씩 총 `7개`의 배지 심볼 이모지 노출을 허용한다.
3. **단일 컴포넌트(버튼·배지·타이틀·토스트)당 개수 상한: 최대 `1개`**:
   - 어떤 배지, 섹션 제목, 피드백 헤더, 토스트 메시지에서도 이모지는 앞머리에 **단 `1개`만** 배치하며, `🎉🔥`, `🏆✨`처럼 2개 이상의 이모지를 연속 나열하는 것을 금지한다.
4. **단어장·퀴즈 본문 독해 영역 보호 규칙 (`0~1개` 제한)**:
   - 기본 단어 카드(`.word-card`) 내부: 이모지 **`0개`** (영단어·뜻·예문 독해에 100% 집중).
   - 기출 다의어 카드(`.exam-word-card`) 내부: 카드 1장당 이모지 **최대 `1개`** (오직 `.exam-word-signal-label`의 `💡 판단 신호` 라벨에만 1개 허용).
   - 4지선다 보기 버튼(`.choice-btn`) 및 영어 예문(`.quiz-blank-sentence`): 이모지 **`0개`**.

### 4.3 이모지 톤앤매너(Tone & Manner) 및 치수 규격
1. **허용 톤 (Warm & Encouraging Symbol Tone)**:
   - **열정·에너지·성장·성취·학습 힌트를 상징하는 비인물 오브젝트 심볼**만 허용한다 (`🔥` 불꽃, `⚡` 번개, `🏆` 트로피, `🎉` 파티 포퍼, `💡` 전구, `🏁` 체커 플래그, `🌱` 새싹, `👑` 왕관, `🧠` 브레인, `🎓` 학사모, `✨` 반짝임, `🎯` 과녁).
2. **금지 톤 (Forbidden Emoji Tone)**:
   - **인물 표정·제스처 이모지 금지**: `😭`, `😢`, `😡`, `😱`, `💀`, `🤡`, `👆`, `👉`, `👍` 등 감정 과잉이나 조롱으로 느껴질 수 있는 표정·손가락 이모지는 일절 사용하지 않는다.
   - **UI 제어 및 판정 기호 이모지 금지**: `🔊`, `🔇`, `🌙`, `☀️`, `📅`, `⭕`, `❌`, `⚠️`는 브라우저/OS마다 형태가 달라 UI 정합성을 해치므로 이모지로 쓰지 않고 **선형 SVG 아이콘** 또는 **타이포 기호(`○`, `✕`, `✓`, `[기본 뜻 함정 주의]`)**로 표기한다.
3. **크기 및 간격 수치**:
   - **인라인 칩·라벨 이모지** (`🔥`, `⚡`, `💡`): 폰트 크기 **`13px`** (`0.8125rem`), 텍스트와 간격 **`gap: 4px`**, `line-height: 1`.
   - **섹션 타이틀·피드백·배너 이모지** (`🏆`, `🎉`, `✨`, `🎯`): 폰트 크기 **`16px~18px`** (`1.0rem~1.125rem`), 텍스트와 간격 **`gap: 6px`**.
   - **배지 컬렉션 심볼 이모지** (`🏁`, `🌱`, `🔥`, `⚡`, `👑`, `🧠`, `🎓`): **`40px × 40px`** 라운드 스퀘어(`border-radius: 12px`) 프레임 중앙에 폰트 크기 **`22px`** (`1.375rem`), `line-height: 1`로 배치.

### 4.4 위치별 이모지(12종) 및 선형 SVG 아이콘 상세 매핑표

| 구분 | 기호 / 아이콘 | 배치 위치 (DOM 셀렉터) | 컴포넌트당 개수 | 크기 및 스타일 수치 |
| :--- | :--- | :--- | :--- | :--- |
| **허용 이모지 1** | `🔥` | 상단 헤더 스트릭 배지 (`#header-streak-badge`) | `1개` | `13px`, `🔥 3일 연속`, 배경 `#FFFBEB`, 텍스트 `#D97706` |
| **허용 이모지 2** | `⚡` | 상단 헤더 레벨 배지 (`#header-level-badge`) | `1개` | `13px`, `⚡ Lv.3 · 310 XP`, 배경 `#EFF6FF`, 텍스트 `#2563EB` |
| **허용 이모지 3** | `🏆` | 홈 주간 연습 리그 섹션 제목 (`.section-title`) 및 배지 획득 토스트 | `1개` | 섹션 제목 `16px` (`🏆 주간 연습 리그`), 토스트 `15px` (`🏆 새 배지 획득: ...`) |
| **허용 이모지 4** | `🎉` | 퀴즈 정답 피드백 헤더 (`.feedback-header.correct`), 레벨업 배너 (`.levelup-banner`), 레벨업 토스트 | `1개` | `16px`, `🎉 정답입니다!`, `🎉 레벨 업! Lv.N 달성!` |
| **허용 이모지 5** | `💡` | 기출 다의어 카드 및 피드백의 판단 신호 라벨 (`.exam-word-signal-label`) | `1개` | `13px`, `💡 판단 신호`, 컬러 `#D97706` |
| **허용 이모지 6~12**<br>(7종 성취 배지) | `🏁` `🌱` `🔥` `⚡`<br>`👑` `🧠` `🎓` | 홈 배지 컬렉션 그리드 (`#home-badge-grid .badge-icon`) | 슬롯당 `1개`<br>(총 7슬롯) | `40px×40px`(`radius: 12px`) 프레임 내 `22px` 이모지.<br>- 해금(`.unlocked`): 원색 노출, 프레임 `#FEF3C7`<br>- 미해금(`.locked`): `filter: grayscale(1); opacity: 0.35;`, 프레임 `#F1F5F9` |
| **허용 보조 이모지** | `✨` / `🎯` | 모든 복습 완료 빈 상태(`.empty-state`) 타이틀 또는 세션 완주 요약(`renderQuizSummary`) 헤드라인 | 화면당 최대 `1개` | `18px`, `✨ 오늘 예정된 모든 복습을 마쳤습니다!`, `🎯 학습 세션 완료!` |
| **선형 SVG 유지 1** | Volume / Off SVG | `#btn-toggle-sound`, `.speak-btn`, `[data-action="speak-sentence"]`, `#btn-quiz-speak` | 버튼당 `1개` | 헤더 토글 `18px×18px`, 발음/예문 버튼 `14px×14px` (`stroke-width: 1.75`) |
| **선형 SVG 유지 2** | Moon / Sun SVG | `#btn-toggle-theme` (다크 모드 전환 버튼) | `1개` | `18px×18px` (`stroke-width: 1.75`) |
| **선형 SVG 유지 3** | 하단 4탭 SVG | `.bottom-nav .nav-item svg` (홈·단어장·퀴즈·오답노트) | 탭당 `1개` | `22px×22px` (비활성 `stroke-width: 1.75`, 활성 `2.25`, 컬러 `#2563EB`) |

---

## ⑤ 화면별 적용안 (Screen-by-Screen Specification)

화면 구조와 DOM 기능은 v1과 동일하게 유지하되, **공통 앱 쉘 + 6대 화면(홈 · 단어장 · 퀴즈 · 기출 · 오답노트 · 리그/배지)**의 모든 시각 속성을 v2 수치로 못 박는다.

### 5.0 공통 앱 쉘 (상단 헤더 `.app-header` · 하단 탭 `.bottom-nav` · 토스트 `.toast-msg`)

| 요소 | v1 설계 (폐기) | **v2 적용안 (수치 고정)** |
| :--- | :--- | :--- |
| **상단 헤더 (`.app-header`)** | 높이 `56px`, 불투명 미색(`#F6F5F0`), 블러 제거 | 높이 **`60px`** (`padding: 0 16px`), 반투명 화이트 글래스(`background: rgba(255, 255, 255, 0.88)`, `backdrop-filter: blur(12px)`), 하단 보더 `1px solid #E2E8F0`. 로고(`.brand-logo`)는 `32px × 32px`, `border-radius: 10px` (`--radius-sm`). |
| **스트릭 배지 (`#header-streak-badge.streak-pill`)** | 이모지 제거, 회갈색 무채색 칩(`#EFECE6`) | **`🔥 N일 연속`** — `background: #FFFBEB` (`--amber-soft`), `border: 1px solid #FDE68A` (`--amber-border`), `color: #D97706` (`--amber-primary`), `border-radius: 9999px`, `padding: 5px 10px`, `font-size: 12px`, `font-weight: 700`, `--font-num`, `gap: 4px`. |
| **레벨 배지 (`#header-level-badge.level-pill`)** | 이모지 제거, 회갈색 무채색 칩(`#EFECE6`) | **`⚡ Lv.N · N XP`** — `background: #EFF6FF` (`--brand-soft`), `border: 1px solid #BFDBFE` (`--brand-border`), `color: #2563EB` (`--brand-primary`), `border-radius: 9999px`, `padding: 5px 10px`, `font-size: 12px`, `font-weight: 700`, `--font-num`, `gap: 4px`. |
| **헤더 토글 버튼 (`.icon-toggle-btn`)** | `32px × 32px` 각진 사각형(`radius: 6px`) | **`36px × 36px` 원형(`border-radius: 9999px`)**, `background: #F1F5F9`, `border: 1px solid #E2E8F0`, `color: #475569`, 내부 `18px × 18px` 선형 SVG. 호버 시 `background: #E2E8F0`, `color: #0F172A`. |
| **하단 내비게이션 (`.bottom-nav`)** | 높이 `60px`, 활성 탭 먹색(`#18181B`) + 상단 초록 직선 | 높이 **`64px`**, `background: rgba(255, 255, 255, 0.92)`, `backdrop-filter: blur(12px)`, `border-top: 1px solid #E2E8F0`. 아이콘 `22px × 22px`. 비활성 탭 `color: #64748B`(`weight 500`), **활성 탭(`.nav-item.active`)은 `color: #2563EB`(`--brand-primary`, `weight 700`)** + 상단 중앙 알약 인디케이터(`width: 28px`, `height: 3px`, `border-radius: 9999px`, `background: #2563EB`). |
| **토스트 알림 (`.toast-msg`)** | `border-radius: 8px`, 이모지 전면 금지 | `border-radius: 9999px` (`--radius-pill`), `padding: 10px 18px`, `background: #0F172A` (다크 `#F8FAFC`), `color: #FFFFFF` (다크 `#0F172A`), `font-size: 13px`, `font-weight: 600`, `box-shadow: var(--shadow-float)`. 레벨업(`🎉`)·배지 해금(`🏆`) 토스트 시 앞머리 이모지 1개 허용. |

---

### 5.1 [화면 1] 홈 화면 (`#view-home`)

1. **히어로 브리핑 카드 (`.hero-card`)**:
   - **외곽**: `background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFF 100%)` (다크 `#1E293B`), `border: 1px solid #DBEAFE` (다크 `#334155`), **`border-radius: 24px` (`--radius-xl`)**, `padding: 22px 20px`, **`box-shadow: var(--shadow-md)`**.
   - **기준일 배지 (`#home-date-badge.hero-date-label`)**:
     - `display: inline-flex`, `padding: 4px 10px`, `border-radius: 9999px`, `background: #EFF6FF` (`--brand-soft`), `border: 1px solid #BFDBFE`, `color: #2563EB`, `font-size: 12px`, `font-weight: 600`, `--font-num`, `margin-bottom: 8px`.
   - **헤드라인 (`#home-greeting-title.hero-headline`)**:
     - `font-size: 20px` (`1.25rem`), `font-weight: 700`, `color: #0F172A`, `line-height: 1.3`, `margin-bottom: 16px`.
   - **3열 핵심 지표 그리드 (`.hero-stats-grid` > `.stat-box`)**:
     - v1의 무배경 흑백 수평 스트립을 폐기하고, 산타토익·말해보카 스타일의 **3열 개별 라운드 소프트 카드(`grid-template-columns: repeat(3, 1fr)`, `gap: 10px`, `margin-bottom: 16px`)**로 구성한다.
     - 공통 `.stat-box`: **`border-radius: 16px`**, `padding: 12px 10px`, `text-align: center`.
     - **① 오늘 복습할 단어 (`.stat-box.highlight-due`)**: `background: #EFF6FF` (`--brand-soft`), `border: 1px solid #BFDBFE` (`--brand-border`). 숫자 `#stat-due-count`는 `24px`, `weight 700`, `--font-num`, **`color: #2563EB` (`--brand-primary`)**.
     - **② 미학습 새 단어 (`.stat-box`)**: `background: #F8FAFC`, `border: 1px solid #E2E8F0`. 숫자 `#stat-new-count`는 `24px`, `weight 700`, `--font-num`, **`color: #0F172A` (`--text-primary`)**.
     - **③ 연속 학습일 (`.stat-box.highlight-streak`)**: `background: #FFFBEB` (`--amber-soft`), `border: 1px solid #FDE68A` (`--amber-border`). 숫자 `#stat-streak-count`는 `24px`, `weight 700`, `--font-num`, **`color: #D97706` (`--amber-primary`)**.
     - `.stat-label`: `12px`, `weight 600`, `color: #475569`, `margin-bottom: 4px`.
     - `.stat-sub`: `12px`, `weight 500`, `color: #64748B`, `margin-top: 2px`.
   - **메인 시작 버튼 (`#btn-hero-start.primary-cta-btn`)**:
     - 높이 **`52px`** (`padding: 14px 18px`), **`border-radius: 14px` (`--radius-md`)**, **`background: #2563EB` (`--brand-primary`)**, `color: #FFFFFF`, `font-size: 16px`, `font-weight: 600`, **`box-shadow: var(--shadow-cta)`** (`0 6px 16px -2px rgba(37, 99, 235, 0.28)`).
     - 호버/액티브: `background: #1D4ED8`, `transform: translateY(-1px)`.
2. **퀴즈 3종 바로 시작 (`.quiz-mode-grid` > `.mode-card`)**:
   - 각 `.mode-card`: `background: #FFFFFF`, `border: 1px solid #E2E8F0`, **`border-radius: 18px` (`--radius-lg`)**, `padding: 16px`, **`box-shadow: var(--shadow-sm)`**, `gap: 8px`.
   - 호버 효과: `transform: translateY(-2px)`, `border-color: #93C5FD`, `box-shadow: var(--shadow-md)`.
   - `.mode-badge`: `border-radius: 8px` (`--radius-xs`), `padding: 3px 8px`, `12px`, `weight 600`, `background: #EFF6FF`, `color: #2563EB`.
   - `.mode-card-title`: `15px`, `weight 700`, `color: #0F172A`.
   - `.mode-card-desc`: `13px`, `weight 400`, `color: #475569`, `line-height: 1.45`.
3. **간격반복(SRS) 복습 단계 현황 (`.srs-panel`)**:
   - 외곽: `background: #FFFFFF`, `border: 1px solid #E2E8F0`, **`border-radius: 18px` (`--radius-lg`)**, `padding: 16px`, **`box-shadow: var(--shadow-sm)`**.
   - 5단계 그리드(`.srs-stages-grid` > `.srs-stage-item`): `gap: 8px`, 각 셀 **`border-radius: 10px` (`--radius-sm`)**, `padding: 10px 4px`, `background: #F8FAFC`, `border: 1px solid #E2E8F0`.
     - **0단계 (`#srs-count-0`, 미학습/재출제)**: 숫자 `16px`, `weight 700`, `--font-num`, `color: #64748B`.
     - **1~3단계 (`#srs-count-1~3`, 1일·3일·7일 간격)**: 숫자 `16px`, `weight 700`, `--font-num`, **`color: #2563EB` (`--brand-primary`)**.
     - **4단계 (`#srs-count-4`, 14일 완성)**: 셀 배경 `background: #ECFDF5` (`--success-soft`), `border-color: #A7F3D0`, 숫자 **`color: #059669` (`--success-primary`)**.

---

### 5.2 [화면 2] 단어장 화면 (`#view-wordbook` — 기본 단어장 24종)

1. **상단 검색 · 필터 툴바 (`.toolbar-card`)**:
   - 외곽: `background: #FFFFFF`, `border: 1px solid #E2E8F0`, **`border-radius: 18px` (`--radius-lg`)**, `padding: 14px`, **`box-shadow: var(--shadow-sm)`**, `margin-bottom: 12px`.
   - **데이터셋 탭 (`.wordbook-dataset-tabs`)**: `background: #F1F5F9`, `padding: 4px`, **`border-radius: 14px` (`--radius-md`)**, `gap: 4px`.
     - `.dataset-tab-btn`: `padding: 8px 12px`, **`border-radius: 10px` (`--radius-sm`)**, `13px`, `weight 600`, `color: #475569`.
     - `.dataset-tab-btn.active`: `background: #FFFFFF`, **`color: #2563EB` (`--brand-primary`)**, `box-shadow: var(--shadow-xs)`.
   - **검색창 (`.search-input`)**: 높이 **`44px`** (`padding: 10px 14px`), **`border-radius: 14px` (`--radius-md`)**, `border: 1px solid #CBD5E1`, `background: #F8FAFC`, `font-size: 14px`. 포커스 시 `border-color: #2563EB`, `background: #FFFFFF`, `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14)`.
   - **필터 알약 (`.filter-pill`)**: `padding: 6px 14px`, **`border-radius: 9999px` (`--radius-pill`)**, `13px`, `weight 500`, `background: #F8FAFC`, `border: 1px solid #E2E8F0`, `color: #475569`.
     - **활성 필터 (`.filter-pill.active`)**: v1의 침울한 먹색(`#18181B`) 반전을 폐기하고 **`background: #2563EB` (`--brand-primary`), `border-color: #2563EB`, `color: #FFFFFF`, `font-weight: 600`** 으로 고정한다.
     - `.filter-pill.exam-filter-jump`: `background: #FFFBEB`, `border-color: #FDE68A`, `color: #D97706`, `weight 600`.
2. **기본 단어 카드 (`.word-card`)**:
   - **외곽**: `background: #FFFFFF`, `border: 1px solid #E2E8F0`, **`border-radius: 18px` (`--radius-lg`)**, `padding: 16px`, **`box-shadow: var(--shadow-sm)`**. 호버 시 `border-color: #93C5FD`, `box-shadow: var(--shadow-md)`.
   - **발음 재생 중 (`.word-card.speaking`)**: `border-color: #2563EB`, `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14)`, `.speak-btn` 배경 `#2563EB`, 텍스트 `#FFFFFF`.
   - **상단 행 (`.word-card-top`)**:
     - `.word-en`: `20px`, `weight 700`, `--font-en`, `color: #0F172A`.
     - `.word-pos` (품사): `12px`, `weight 600`, `--font-en`, `color: #475569`, `background: #F1F5F9`, `padding: 2px 8px`, **`border-radius: 8px` (`--radius-xs`)**.
     - **난이도 배지 (`.level-badge` — 3색 소프트 태그 복원)**: 공통 `12px`, `weight 600`, `padding: 2px 8px`, **`border-radius: 8px` (`--radius-xs`)**.
       - `.level-고1` (기초): `background: #ECFDF5` (`--success-soft`), `color: #059669` (`--success-primary`), `border: 1px solid #A7F3D0`.
       - `.level-고2` (핵심): `background: #EFF6FF` (`--brand-soft`), `color: #2563EB` (`--brand-primary`), `border: 1px solid #BFDBFE`.
       - `.level-고3` (심화): `background: #FFFBEB` (`--amber-soft`), `color: #D97706` (`--amber-primary`), `border: 1px solid #FDE68A`.
     - `.speak-btn` (`발음` 버튼): `14px × 14px` Volume 선형 SVG 유지, **`border-radius: 10px` (`--radius-sm`)**, `padding: 6px 10px`, `13px`, `weight 600`, `background: #F1F5F9`, `border: 1px solid #E2E8F0`, `color: #1E293B`.
   - **대표 뜻 (`.word-meaning`)**: `16px`, `weight 600`, `color: #0F172A`, `margin: 8px 0 12px`.
   - **예문 영역 (`.word-example-box`)**:
     - v1의 무배경 흑백 인용선을 폐기하고, **`background: #F8FAFC`, `border-left: 3px solid #2563EB`, `border-radius: 0 12px 12px 0`, `padding: 10px 14px`, `margin-bottom: 12px`** 로 예문 블록의 시각적 집중도를 높인다.
   - **하단 푸터 (`.word-card-footer`)**:
     - `.srs-tag`: **`border-radius: 8px` (`--radius-xs`)**, `padding: 3px 8px`, `12px`, `weight 600`, `--font-num`.
       - 미학습 기본: `background: #F1F5F9`, `color: #64748B`.
       - `.srs-tag.scheduled` (복습 예정): `background: #ECFDF5`, `color: #059669`, `border: 1px solid #A7F3D0`.
       - `.srs-tag.due` (오늘 복습 대상): `background: #FFFBEB`, `color: #D97706`, `border: 1px solid #FDE68A`.

---

### 5.3 [화면 3] 퀴즈 화면 (`#view-quiz` — 기본 3종 · 피드백 · 결과 요약)

1. **퀴즈 설정 바 (`.quiz-config-bar`)**:
   - 외곽: `background: #FFFFFF`, `border: 1px solid #E2E8F0`, **`border-radius: 18px` (`--radius-lg`)**, `padding: 14px`, **`box-shadow: var(--shadow-sm)`**, `margin-bottom: 14px`.
   - `.quiz-tabs`: `background: #F1F5F9`, **`border-radius: 14px` (`--radius-md`)**, `padding: 4px`, `gap: 4px`.
   - `.quiz-tab-btn.active`: `background: #FFFFFF`, **`color: #2563EB` (`--brand-primary`)**, `weight 600`, **`border-radius: 10px` (`--radius-sm`)**, `box-shadow: var(--shadow-xs)`.
   - `.quiz-tabs.exam-quiz-tabs`: 트랙 배경 `background: #FFFBEB` (`--amber-soft`), 활성 탭(`.exam-tab-btn.active`)은 `background: #FFFFFF`, **`color: #D97706` (`--amber-primary`)**, `box-shadow: var(--shadow-xs)`.
   - `.scope-select`: 높이 **`38px`**, **`border-radius: 12px`**, `border: 1px solid #CBD5E1`, `background: #F8FAFC`, `13px`, `weight 500`.
2. **진행 상태 바 (`.quiz-progress-header` & `.progress-track`)**:
   - `.quiz-progress-header`: `13px`, `weight 600`, `--font-num` (`tabular-nums`), `color: #475569`, `margin-bottom: 8px`.
   - `.progress-track`: 높이 **`8px`** (v1의 얇은 `4px`에서 듀오링고식 도톰한 게이지로 확대), `background: #E2E8F0`, `border-radius: 9999px`, `margin-bottom: 16px`.
   - `.progress-fill`: **`background: #2563EB` (`--brand-primary`)**, `border-radius: 9999px`.
3. **문제 스테이지 카드 (`.quiz-stage-card`)**:
   - 외곽: `background: #FFFFFF`, `border: 1px solid #E2E8F0`, **`border-radius: 24px` (`--radius-xl`)**, `padding: 24px 20px`, **`box-shadow: var(--shadow-md)`**.
   - `.quiz-target-word`: **`28px` (`1.75rem`)**, `weight 700`, `--font-en`, `color: #0F172A`.
   - `.quiz-blank-sentence`: `15px`, `weight 500`, `line-height: 1.6`, `--font-en`, `color: #0F172A`, `margin-bottom: 12px`.
   - `.blank-slot`: `min-width: 96px`, `padding: 0 6px`, `border-bottom: 2px solid #2563EB`. 채점 후 `.filled` 상태에서 **`color: #059669` (`--success-primary`), `border-bottom-color: #10B981`, `weight 700`**.
   - `.quiz-blank-ko`: `background: #F8FAFC`, `border-radius: 10px`, `padding: 6px 12px`, `font-size: 14px`, `color: #475569`.
4. **4지선다 보기 버튼 (`.choices-grid` > `.choice-btn`)**:
   - `.choices-grid`: `gap: 10px`.
   - `.choice-btn` (기본): 최소 높이 **`52px`**, `padding: 12px 16px`, **`border-radius: 14px` (`--radius-md`)**, `border: 1.5px solid #CBD5E1`, `background: #FFFFFF`, **`box-shadow: var(--shadow-xs)`**, `font-size: 15px`, `font-weight: 500`, `color: #0F172A`, `gap: 12px`.
   - `.choice-num` (보기 번호 `1~4`): **`28px × 28px`**, **`border-radius: 10px` (`--radius-sm`)**, `background: #F1F5F9`, `border: 1px solid #E2E8F0`, `font-size: 13px`, `font-weight: 700`, `--font-num`, `color: #475569`.
   - 호버(`.choice-btn:hover:not(:disabled)`): `border-color: #2563EB`, `background: #EFF6FF`, `transform: translateY(-1px)`.
   - **정답 판정 (`.choice-btn.correct`)**:
     - `background: #ECFDF5` (`--success-soft`), `border: 2px solid #10B981` (`--success-accent`), `color: #065F46`, `font-weight: 600`, **`box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18)`**, 애니메이션 `@keyframes correctPop` (`0.24s ease-out`, `scale(1.02)`).
     - `.choice-num`: `background: #10B981`, `border-color: #10B981`, `color: #FFFFFF`.
   - **오답 판정 (`.choice-btn.wrong`)**:
     - `background: #FFF1F2` (`--danger-soft`), `border: 2px solid #E11D48` (`--danger-primary`), `color: #9F1239`, `font-weight: 600`, **`box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.16)`**, 애니메이션 `@keyframes wrongShake` (`0.34s ease-in-out`).
     - `.choice-num`: `background: #E11D48`, `border-color: #E11D48`, `color: #FFFFFF`.
5. **카드 뒤집기 모드 (`.flashcard-box` & `.self-judge-row`)**:
   - `.flashcard-box`: `min-height: 220px`, **`border-radius: 24px` (`--radius-xl`)**, `border: 1.5px solid #CBD5E1`, `background: #F8FAFC`, `padding: 24px 20px`, `box-shadow: var(--shadow-sm)`. 뒤집힌 상태(`.flipped`)는 `background: #FFFFFF`, `border-color: #2563EB`, `box-shadow: var(--shadow-md)`.
   - `.judge-btn`: **`border-radius: 14px` (`--radius-md`)**, `padding: 12px 16px`, `font-size: 15px`, `font-weight: 600`.
     - `.judge-btn.unknown` (`몰라요 ✕`): `background: #FFF1F2`, `border: 1.5px solid #FECDD3`, `color: #E11D48`.
     - `.judge-btn.known` (`알아요 ○`): **`background: #10B981` (`--success-accent`), `border: 1.5px solid #059669`, `color: #FFFFFF`**.
6. **정오답 피드백 패널 (`.quiz-feedback`) 및 다음 문제 버튼 (`.next-question-btn`)**:
   - `.quiz-feedback`: `margin-top: 16px`, `padding: 16px`, **`border-radius: 14px` (`--radius-md`)**.
     - 정답 피드백 시: `background: #ECFDF5`, `border: 1px solid #A7F3D0`, `.feedback-header.correct`는 `color: #059669` (`🎉 정답입니다!` — `🎉` 이모지 1개 허용).
     - 오답 피드백 시: `background: #FFF1F2`, `border: 1px solid #FECDD3`, `.feedback-header.wrong`은 `color: #E11D48` (`오답입니다 · 다시 확인해 보세요`).
   - `.xp-gain-pill`: `background: #FFFBEB`, `border: 1px solid #FDE68A`, `color: #D97706`, **`border-radius: 9999px`**, `padding: 3px 10px`, `12px`, `weight 700`, `--font-num`.
   - `.next-question-btn`: v1의 먹색(`#18181B`) 버튼을 폐기하고, 높이 **`48px`**, **`border-radius: 14px` (`--radius-md`)**, **`background: #2563EB` (`--brand-primary`), `color: #FFFFFF`**, `15px`, `weight 600`으로 고정한다.

---

### 5.4 [화면 4] 기출 화면 (`data/exam-words.json` — 기출 다의어 카드 & 기출 모드 2종)

> **핵심 설계 목표**: v1처럼 모든 배경 박스를 없애 흑백 인쇄 사전처럼 만들지도 않고, v0처럼 4중 원색 테두리를 어지럽게 겹치지도 않는 **말해보카식 '소프트 컬러 블록(Soft Tinted Section)' 구조**로 다의어 학습 가독성을 극대화한다.

1. **기출 다의어 카드 (`.exam-word-card`) 구역별 수치 명세**:

| 카드 내부 구역 | v1 설계 (폐기: 흑백 무박스 줄글) | **v2 적용안 (말해보카·산타토익식 소프트 블록 구조)** |
| :--- | :--- | :--- |
| **카드 외곽 (`.exam-word-card`)** | `radius: 12px`, `box-shadow: none` | `background: #FFFFFF`, `border: 1px solid #E2E8F0`, **`border-radius: 18px` (`--radius-lg`)**, `padding: 18px 16px`, **`box-shadow: var(--shadow-sm)`** |
| **상단 등급 배지 (`.grade-badge`)** | `S급` 오커, `A급` 무채색 회색 | 공통 `border-radius: 8px` (`--radius-xs`), `padding: 2px 8px`, `12px`, `weight 700`.<br>- **`.grade-S` (최빈출)**: `background: #FFFBEB`, `color: #D97706`, `border: 1px solid #FDE68A`<br>- **`.grade-A` (빈출)**: `background: #EFF6FF`, `color: #2563EB`, `border: 1px solid #BFDBFE` |
| **① 기본 뜻 (`.exam-base-meaning`)** | 무배경 + 하단 실선 | `padding: 6px 0 10px`, `border-bottom: 1px solid #F1F5F9`.<br>- `.exam-base-tag`: `background: #F1F5F9`, `color: #64748B`, `border-radius: 8px`, `padding: 2px 8px`, `12px`, `weight 600`<br>- `.exam-base-text`: `14px`, `color: #475569` |
| **② 시험 출제 뜻 섹션 (`.exam-meanings-section`)** | 배경·테두리 완전 제거 (식별성 저하) | **소프트 블루 틴트 박스**: `background: #F8FAFF` (`--bg-tint-blue`), `border: 1px solid #DBEAFE`, **`border-radius: 14px` (`--radius-md`)**, `padding: 12px 14px`, `margin: 10px 0`.<br>- `.exam-meanings-title` (`시험에서는 이 뜻`): `12px`, `weight 700`, `color: #2563EB`, `margin-bottom: 8px`<br>- `.exam-meaning-ko`: `15px`, `weight 600`, `color: #0F172A`<br>- `.exam-meaning-pct` (출제 비중 `%`): `background: #ECFDF5` (`--success-soft`), `color: #059669` (`--success-primary`), `border: 1px solid #A7F3D0`, **`border-radius: 8px`**, `padding: 2px 8px`, `12px`, `weight 700`, `--font-num` (`tabular-nums`)<br>- `.exam-meaning-sig`: `13px`, `color: #475569` |
| **③ 판단 신호 (`.exam-word-signal`)** | 회색 배경 + `💡` 이모지 삭제 | **앰버 소프트 콜아웃**: `background: #FFFBEB` (`--amber-soft`), `border-left: 3px solid #F59E0B` (`--amber-accent`), **`border-radius: 0 12px 12px 0`**, `padding: 10px 14px`, `margin: 10px 0`.<br>- `.exam-word-signal-label`: **`💡 판단 신호`** (`💡` 이모지 1개 복원), `12px`, `weight 700`, `color: #D97706`, `margin-bottom: 2px`<br>- `.exam-word-signal-body`: `14px`, `line-height: 1.55`, `color: #0F172A` |
| **④ 기출 예문 (`.exam-example-box`)** | 무배경 + 회색 `2px` 선 | `background: #F8FAFC`, `border-left: 3px solid #94A3B8`, **`border-radius: 0 12px 12px 0`**, `padding: 10px 14px`, `margin-bottom: 12px`.<br>- `.exam-example-source`: `12px`, `weight 500`, `--font-num`, `color: #64748B` |

2. **기출 퀴즈 모드 2종 (`exam-blank`, `exam-meaning`)**:
   - 문맥 하이라이트 단어(`mark.exam-highlight-word`): `background: #FEF3C7`, `color: #D97706`, `padding: 2px 8px`, **`border-radius: 8px`**, `font-weight: 700`.
   - 기본 뜻 함정 배지(`.trap-pill`): **`border-radius: 8px` (`--radius-xs`)**, `padding: 2px 8px`, `12px`, `weight 600`, `background: #FFFBEB`, `color: #D97706`, `border: 1px solid #FDE68A`.

---

### 5.5 [화면 5] 오답노트 화면 (`#view-wrong`)

1. **오답노트 상단 복습 배너 (`.wrong-banner`)**:
   - 외곽: `background: #FFFFFF`, `border: 1px solid #FECDD3` (`--danger-border`), **`border-left: 4px solid #E11D48` (`--danger-primary`)**, **`border-radius: 18px` (`--radius-lg`)**, `padding: 18px`, `margin-bottom: 16px`, **`box-shadow: var(--shadow-sm)`**.
   - `.wrong-banner-title`: `16px`, `weight 700`, `color: #0F172A`, `margin-bottom: 4px`.
   - `.wrong-banner-desc`: `14px`, `weight 400`, `color: #475569`, `margin-bottom: 14px`.
   - **오답 퀴즈 시작 버튼 5종 (`.wrong-start-btn`)**:
     - v1의 먹색(`#18181B`) 버튼을 폐기한다.
     - 대표 시작 버튼 2개(`#btn-wrong-quiz-exam-blank`, `#btn-wrong-quiz-meaning`): **`background: #2563EB` (`--brand-primary`), `color: #FFFFFF`, `border: 1px solid #2563EB`**, **`border-radius: 10px` (`--radius-sm`)**, `padding: 9px 14px`, `font-size: 13px`, `font-weight: 600`, `box-shadow: var(--shadow-xs)`. 호버 시 `background: #1D4ED8`.
     - 보조 시작 버튼 3개(`.secondary`, `.exam-btn-secondary`): `background: #F8FAFC`, `color: #1E293B`, `border: 1px solid #CBD5E1`, **`border-radius: 10px`**, `padding: 9px 14px`, `font-size: 13px`, `font-weight: 500`. 호버 시 `background: #EFF6FF`, `border-color: #93C5FD`, `color: #2563EB`.
2. **오답 단어 카드 내 배지 (`.wrong-count-badge` & `.wrong-mode-badge`)**:
   - `.wrong-count-badge` (`총 오답 N회`): `background: #FFF1F2` (`--danger-soft`), `color: #E11D48` (`--danger-primary`), `border: 1px solid #FECDD3`, **`border-radius: 8px` (`--radius-xs`)**, `padding: 2px 8px`, `12px`, `weight 700`, `--font-num`.
   - `.wrong-mode-badge.exam-mode` (기출 오답): `background: #FFFBEB` (`--amber-soft`), `color: #D97706` (`--amber-primary`), `border: 1px solid #FDE68A`, **`border-radius: 8px`**, `padding: 2px 8px`, `12px`, `weight 600`.
   - `.wrong-mode-badge.basic-mode` (기본 오답): `background: #EFF6FF` (`--brand-soft`), `color: #2563EB` (`--brand-primary`), `border: 1px solid #BFDBFE`, **`border-radius: 8px`**, `padding: 2px 8px`, `12px`, `weight 600`.
3. **빈 상태 카드 (`.empty-state`)**:
   - `background: #FFFFFF`, `border: 1px solid #E2E8F0`, **`border-radius: 18px` (`--radius-lg`)**, `padding: 32px 20px`, **`box-shadow: var(--shadow-sm)`**.

---

### 5.6 [화면 6] 리그 / 배지 영역 (`#home-level-progress` · `#home-league-card` · `#home-badge-grid`)

1. **히어로 카드 내 레벨 진행 바 (`#home-level-progress.level-progress`)**:
   - `margin: 14px 0 18px`.
   - `.level-progress-head`: `12px`, `weight 600`, `--font-num` (`tabular-nums`), `color: #475569`, `margin-bottom: 6px`.
   - `.level-progress-head strong` (`Lv.N`): **`color: #2563EB` (`--brand-primary`), `font-size: 13px`, `font-weight: 700`**.
   - `.level-progress-track`: 높이 **`8px`** (v1 `6px`에서 확대), `border-radius: 9999px`, `background: #E2E8F0`.
   - `.level-progress-fill`: **`background: #F59E0B` (`--amber-accent`)**, `border-radius: 9999px`.
2. **주간 연습 리그 카드 (`#home-league-card.league-card`)**:
   - **섹션 헤더**: **`🏆 주간 연습 리그`** (`🏆` 이모지 1개 복원, `16px`, `weight 700`).
   - **카드 외곽**: `background: #FFFFFF`, `border: 1px solid #E2E8F0`, **`border-radius: 18px` (`--radius-lg`)**, `padding: 18px 16px`, **`box-shadow: var(--shadow-sm)`**.
   - **내 순위 요약 (`.league-summary`)**: `14px`, `color: #475569`, 강조 수치(`strong`)는 **`color: #2563EB` (`--brand-primary`), `font-weight: 700`, `--font-num`**.
   - **10인 순위표 (`.league-list` > `.league-row`)**:
     - `.league-list`: `gap: 4px`.
     - `.league-row`: 높이 **`40px`**, `padding: 6px 12px`, **`border-radius: 10px` (`--radius-sm`)**, `font-size: 14px`, `border: 1px solid transparent`.
     - **1~3위 `.league-rank`**: **`color: #D97706` (`--amber-primary`), `font-weight: 700`**, `--font-num` (4~10위는 `color: #64748B`, `weight 600`).
     - **`.league-row.me` (사용자 본인 행)**: **`background: #ECFDF5` (`--success-soft`), `border: 1.5px solid #34D399`**, `font-weight: 600`.
     - `.bot-badge` (`BOT`): **`border-radius: 8px` (`--radius-xs`)**, `padding: 2px 6px`, `12px`, `weight 600`, `--font-en`, `background: #F1F5F9`, `border: 1px solid #E2E8F0`, `color: #64748B`.
     - `.league-xp`: 기본 `color: #475569`, 내 행(`.league-row.me .league-xp`)은 **`color: #059669` (`--success-primary`), `font-weight: 700`**, `--font-num`.
3. **학습 배지 컬렉션 (`#home-badge-grid.badge-grid`)**:
   - **그리드 레이아웃**: 모바일 **2열(`grid-template-columns: repeat(2, 1fr)`)**, `min-width: 560px` 이상 **4열(`grid-template-columns: repeat(4, 1fr)`)**, `gap: 10px`.
   - **배지 카드 (`.badge-item`)**: **`border-radius: 18px` (`--radius-lg`)**, `padding: 14px`, `display: flex`, `flex-direction: column`, `align-items: flex-start`, `gap: 8px`.
   - **아이콘 프레임 (`.badge-icon`)**: **`40px × 40px`**, **`border-radius: 12px`**, 내부 중앙에 **7종 성취 이모지(`🏁`, `🌱`, `🔥`, `⚡`, `👑`, `🧠`, `🎓`, 폰트 크기 `22px`)** 배치.
   - **해금 상태 (`.badge-item.unlocked`)**:
     - 카드 외곽: `background: #FFFFFF`, `border: 1.5px solid #FDE68A` (`--amber-border`), **`box-shadow: var(--shadow-sm)`**.
     - `.badge-icon`: `background: #FEF3C7`, `border: 1px solid #FDE68A`, 이모지 원색 100% 노출.
     - `.badge-name`: `13px`, `weight 700`, `color: #0F172A`.
     - `.badge-sub` (획득일): `12px`, `weight 600`, `--font-num`, **`color: #D97706` (`--amber-primary`)**.
   - **미해금 상태 (`.badge-item.locked`)**:
     - 카드 외곽: `background: #F8FAFC`, `border: 1px dashed #CBD5E1`, `box-shadow: none`.
     - `.badge-icon`: `background: #F1F5F9`, `border: 1px solid #E2E8F0`, 내부 이모지에 **`filter: grayscale(1); opacity: 0.35;`** 적용.
     - `.badge-name` / `.badge-sub`: `color: #64748B`.
4. **레벨업 축하 배너 (`.levelup-banner`)**:
   - `background: #FFFBEB`, `border: 1.5px solid #FDE68A`, `color: #D97706`, **`border-radius: 14px` (`--radius-md`)**, `padding: 12px 16px`, `14px`, `weight 700` (`🎉 레벨 업! Lv.N 달성` — `🎉` 이모지 1개 허용).

---

## ⑥ v1에서 버릴 것과 v1에서 유지할 것 (v1 Discard vs. Keep Lists)

### 6.1 v1에서 버릴 것 목록 (What to Discard from v1 — 12개 항목 전면 폐기)

1. **[폐기 1] 개발자 도구 · 에디토리얼 레퍼런스 일체**:
   - v1이 근거로 삼았던 개발자 도구 및 인쇄 사전/유틸리티 레퍼런스와 "Editorial Study Sheet" 콘셉트를 전량 폐기한다 (v2는 오직 **말해보카 · 산타토익 · 듀오링고** 3종만 참고).
2. **[폐기 2] 85% 무채색 강제 원칙 및 누런 미색 종이(`#F6F5F0` / `#EFECE6`) 배경**:
   - 화면을 우중충하고 칙칙하게 만든 따뜻한 종이색(`#F6F5F0`), 회갈색(`#EFECE6`, `#E4E0D8`) 배경 토큰을 전량 폐기하고 맑은 브라이트 쿨 화이트(`#F7F9FC`)와 순백색(`#FFFFFF`)으로 교체한다.
3. **[폐기 3] 침울한 저명도 포인트 색(`#165B45` 딥 포레스트 · `#B45309` 웜 오커 · `#B91C1C` 브릭 크림슨)**:
   - 채도와 명도가 낮아 화면을 무겁게 가라앉히던 v1의 3색 코드를 폐기하고, 선명한 로열 블루(`#2563EB`) · 텐저린 앰버(`#F59E0B`/`#D97706`) · 민트 에메랄드(`#10B981`/`#059669`) · 코랄 레드(`#E11D48`)로 교체한다.
4. **[폐기 4] 파란색(`Blue`) · 하늘색(`Sky`) 전면 금지 규칙**:
   - 학습 앱의 핵심 신뢰·집중 색상인 블루 계열(`hue 185°~239°`)을 금지했던 v1 1.3절 규칙을 폐기한다.
5. **[폐기 5] 먹색(`#18181B`) 솔리드 버튼 및 먹색 활성 필터 알약**:
   - `.filter-pill.active`, `.next-question-btn`, `.wrong-start-btn`을 검정색(`#18181B`)으로 칠해 터미널처럼 보이게 한 배색을 폐기하고 로열 블루(`#2563EB`)로 교체한다.
6. **[폐기 6] 일반 카드 무그림자(`box-shadow: none`) 강제 원칙 및 메인 CTA 그림자 제거 규칙**:
   - 모든 카드를 평면 종이처럼 눌러버린 무그림자 원칙을 폐기하고, 5단계 소프트 그림자(`--shadow-xs` ~ `--shadow-float`)를 허용한다.
7. **[폐기 7] 단일 카드 모서리 반경(`--radius-lg: 12px`) 및 각진 소형 반경(`4px`, `6px`, `8px`)**:
   - 경직된 인상을 주던 낮은 곡률을 폐기하고 `8px`(`xs`), `10px`(`sm`), `14px`(`md`), `18px`(`lg`), `24px`(`xl`), `9999px`(`pill`)의 둥근 다단계 곡률로 교체한다.
8. **[폐기 8] 유니코드 이모지 0개 전면 금지(Zero-Emoji Policy) 및 7종 배지의 단색 선형 SVG 치환**:
   - 스트릭(`🔥`), 레벨(`⚡`), 리그(`🏆`), 정답 축하(`🎉`), 판단 신호(`💡`), 7종 성취 배지(`🏁`~`🎓`)까지 이모지를 모두 삭제했던 규칙을 폐기하고, 12종 동기부여 이모지를 절제된 수량 규칙하에 복원한다.
9. **[폐기 9] 홈 히어로 3열 핵심 지표(`.hero-stats-grid`)의 무배경 흑백 수평 스트립화**:
   - 3개 지표 박스의 배경과 테두리를 모두 지우고 세로선(`1px`)으로만 나눴던 v1 4.1절 규칙을 폐기하고, 블루·화이트·앰버 3열 라운드 소프트 카드(`border-radius: 16px`)로 복원한다.
10. **[폐기 10] 기출 다의어 카드(`.exam-word-card`) 및 예문 박스(`.word-example-box`)의 전면 무박스·무배경화**:
    - `'시험에서는 이 뜻'`과 `'예문'`의 배경 면을 완전히 제거했던 v1 규칙을 폐기하고, 말해보카식 소프트 블루 틴트 박스(`#F8FAFF`)와 쿨그레이 인용 박스(`#F8FAFC`)를 적용한다.
11. **[폐기 11] 난이도 배지(`고1`·`고2`·`고3`), 기출 `A급` 배지, 오답 모드 배지(`.wrong-mode-badge`)의 회색 무채색 단일화**:
    - 모든 분류 배지를 회갈색(`#EFECE6`) 하나로 통일해 정보 판별력을 떨어뜨린 규칙을 폐기하고, 의미별 소프트 컬러 배지(그린·블루·앰버)로 구분한다.
12. **[폐기 12] 정답 선택지(`.choice-btn.correct`)의 포커스 글로우 링 및 탄력 팝 모션(`correctPop`) 금지, 상하단 바 블러(`backdrop-filter`) 금지**:
    - 정답 타격감과 앱의 입체감을 죽였던 모션·블러 금지 규칙을 폐기한다.

---

### 6.2 v1에서 유지할 것 목록 (What to Keep from v1 — 10개 항목 승계)

1. **[유지 1] 화면 구조(4대 뷰 · 하단 4탭) 및 기능 · `localStorage` 데이터 스키마 불변 원칙**:
   - `#view-home`, `#view-wordbook`, `#view-quiz`, `#view-wrong`의 화면 구조, 인터랙션 흐름, 64개 단어 데이터(`data/*.json`), `localStorage` 5개 키 구조는 단 하나도 바꾸지 않고 그대로 유지한다.
2. **[유지 2] 한글(`Pretendard`) · 영문(`Inter`) · 숫자(`JetBrains Mono`) 글꼴 3원화 체계**:
   - 한국어 UI/뜻, 영어 표제어/예문, 학습 통계 숫자의 폰트 패밀리를 분리한 3원화 체계와 영문 가독성 OpenType 속성(`cv02`, `cv03`, `cv04`, `cv11`)을 그대로 유지한다.
3. **[유지 3] 모든 숫자의 고정폭(`tabular-nums lining-nums`) 강제 적용 규칙**:
   - 복습 대기 수, SRS 단계별 단어 수, 레벨·XP, 리그 순위·점수, 출제 비중(`%`), 보기 번호 등 모든 숫자에 고정폭 숫자 속성을 강제하는 규칙(산타토익식 데이터 정밀성)을 유지한다.
4. **[유지 4] 8단계 타이포그래피 크기 계층(`Type-1` `28px` ~ `Type-8` `12px`) 및 `12px` 미만 초소형 글자 금지 · `font-weight: 800` 남발 금지**:
   - 무질서한 `rem` 수치를 정리한 8단계 타이포 스케일과 모바일 가독성 하한선(`12px` 이상)을 그대로 유지한다.
5. **[유지 5] 퀴즈 출제 영단어(`.quiz-target-word`)의 전 모드 `28px`(`1.75rem`) 단일 크기 고정**:
   - 기본 뜻 맞히기, 기출 문맥 속 뜻, 카드 뒤집기 모드 모두에서 출제 영단어를 `28px` Bold로 일관되게 고정하는 규칙을 유지한다.
6. **[유지 6] `4px` 기본 간격 그리드(`--space-1: 4px` ~ `--space-8: 32px`) 및 앱 쉘 최대 폭(`max-width: 720px`)**:
   - 비정규 여백을 배제한 `4px` 배수 간격 토큰 체계를 그대로 유지한다.
7. **[유지 7] AI 대시보드풍 보라색(`#6D28D9` / `#A78BFA`) 네온 클리셰 배제**:
   - 전형적인 AI 생성 템플릿 인상을 주던 보라색 계열 폐기는 유지하되, v1처럼 침울한 먹색(`#18181B`)으로 죽이지 않고 선명한 로열 블루(`#2563EB`)와 텐저린 앰버(`#F59E0B`)로 대체한다.
8. **[유지 8] 기능 제어 UI(발음 스피커, 효과음 ON/OFF, 다크 모드 달/해, 하단 내비게이션 4탭)의 선형 SVG 아이콘 사용**:
   - 동기부여·보상 영역에는 이모지(12종)를 복원하되, 시스템/오디오/내비게이션 제어 버튼은 깔끔한 단색 선형 SVG 아이콘을 그대로 유지한다.
9. **[유지 9] 배지 컬렉션(`#home-badge-grid`)의 반응형 2열(모바일) / 4열(`min-width: 560px`) 정형 그리드**:
   - `auto-fill`로 인해 카드 폭이 어정쩡하게 깨지는 현상을 막는 2열/4열 정형 그리드 배치를 그대로 유지한다.
10. **[유지 10] 접근성 모션 감소(`@media (prefers-reduced-motion: reduce)`) 보호 규칙**:
    - 시스템에서 애니메이션 감소를 설정한 사용자를 위해 흔들림·팝 모션을 비활성화하는 접근성 규칙을 그대로 유지한다.

---

## 7. 유보 항목 (Open Decisions — 제시 범위 밖 단정 보류)

제시된 v2 설계 지침 범위 밖이거나, 향후 실제 코드 반영 단계에서 결정해야 하는 사항은 임의로 단정하지 않고 아래 5가지로 분리하여 **유보**한다.

1. **[유보 7.1] 실제 코드 파일(`css/style.css`, `index.html`, `js/app.js`, `manifest.json`, `icons/icon.svg`)로의 v2 반영 시점 및 수정 범위**
   - **판단 보류 사유**: 본 작업은 `DESIGN_REDESIGN.md`를 v2로 전면 개정하는 설계 전용 작업이며 코드 파일 수정이 엄격히 금지되어 있다. 현재 저장소 코드(`HEAD e1534d9`)에는 v1 CSS와 v1 마크업(이모지 제거 및 SVG 치환본)이 적용되어 있으므로, 후속 구현 작업에서 `css/style.css` 스타일시트만 먼저 교체할지, 아니면 `index.html` · `js/app.js` 내 12종 동기부여 이모지 복원 및 `manifest.json` / `icons/icon.svg`의 테마 색상(`#2563EB`, `#F7F9FC`) 동기화까지 일괄 수행할지는 후속 구현 단계로 유보한다.
2. **[유보 7.2] 초기 진입 시 테마 기본값 정책 (`'light'` 고정 vs 기존 `'system'` 연동 유지)**
   - **판단 보류 사유**: v2 설계 지침은 "밝은 배경을 기본으로 하고"라고 규정하고 있으나, 현재 `index.html`의 초기 테마 스크립트는 `localStorage` 설정이 없을 때 `'system'`(`prefers-color-scheme: dark` 감지)으로 동작한다. 후속 코드 반영 시 OS 다크 모드 설정과 무관하게 최초 진입 기본값을 라이트 모드(`'light'`)로 고정할지, 아니면 기존 `'system'` 감지 로직은 그대로 두고 라이트 모드 팔레트를 기본 설계 표준으로 삼을지는 코드 동작 정책에 해당하므로 유보한다.
3. **[유보 7.3] 웹폰트(`Pretendard`, `Inter`, `JetBrains Mono`)의 외부 CDN 유지 vs 로컬 `.woff2` 번들링 여부**
   - **판단 보류 사유**: `SPEC.md` 2절("외부 API 사용 금지") 및 `sw.js` 오프라인 정적 캐시 구조와 현재 `index.html`에 연결된 외부 웹폰트 CDN(`cdn.jsdelivr.net`, `fonts.googleapis.com`) 간의 정책적 허용 범위는 본 시각 설계 범위 밖이므로 유보한다.
4. **[유보 7.4] 홈 화면 주간 연습 리그(10행) 및 배지 컬렉션(7종)의 접기/펼치기(Accordion) 축약 여부**
   - **판단 보류 사유**: 화면 구조와 기능을 v1과 동일하게 유지하는 지침에 따라 두 섹션의 상시 노출 구조는 그대로 유지했다. 추후 모바일 세로 스크롤 길이를 줄이기 위해 주간 연습 리그 표를 '내 순위 중심 3행 요약 + 전체 펼치기'로 축약할지 여부는 화면 구조·인터랙션 변경에 해당하므로 유보한다.
5. **[유보 7.5] 간격반복 시뮬레이션 바(`.srs-helper-bar`: `+1일 경과 테스트`, `기록 초기화`)의 노출 위치 유지 여부**
   - **판단 보류 사유**: 해당 컨트롤은 프로토타입 검증용 시뮬레이션 기능(`README.md` 명시 기능)이나 실제 고등학생 학습 화면에서는 테스트 도구처럼 보일 수 있다. 화면 구조 유지 원칙에 따라 현 위치를 그대로 유지하되, 추후 별도 설정 모달이나 하단 푸터로 이동할지 여부는 유보한다.
