# 게임화(Gamification) 및 디자인 확장 설계서 (DESIGN.md)

> **문서 목적**: `plazalabs/vocab-trainer`의 현재 코드베이스(`index.html`, `js/app.js`, `css/style.css`, `data/*.json`)를 기준으로, 기존 학습 흐름과 `localStorage` 데이터를 훼손하지 않으면서 **XP·레벨, 주간 연습 리그, 배지, 시각/청각 피드백·다크 모드, 상태 저장 확장**을 도입하기 위한 상세 설계를 정의한다.
>
> **고정 제약사항**:
> - 데이터 파일(`data/words.json`, `data/exam-words.json`) 수정 금지
> - 외부 API, 외부 오디오 파일(`.mp3`, `.wav` 등), 백엔드 서버 사용 금지
> - 기존 `localStorage` 사용자 학습 데이터 초기화·파괴 금지
> - 기존 UI 골격(앱쉘·4대 뷰·단어장/퀴즈/SRS/오답노트 구조)을 갈아엎지 않는 범위에서 확장
> - 지시 범위 밖이거나 단정할 수 없는 세부 정책은 본 문서의 **「7. 유보 항목」**에 명시하여 임의 확정을 방지함

---

## 1. 현재 구조 파악 (As-Is 분석)

### 1.1 단어 데이터 및 식별자 구조
| 데이터셋 | 파일 경로 (수정 금지) | 수량 | 런타임 `wordId` 규칙 | 주요 필드 |
| :--- | :--- | :--- | :--- | :--- |
| **기본 단어장** | `data/words.json` | 24개 | 숫자 `1` ~ `24` (`localStorage` 키: `"1"` ~ `"24"`) | `id`, `word`, `pos`, `meaning_ko`, `example_en`, `example_ko`, `level` (`고1` 8개 / `고2` 8개 / `고3` 8개) |
| **기출 다의어** | `data/exam-words.json` | 40개 | 문자열 `"exam-" + word` (예: `"exam-account"`, `isExam: true`) | `word`, `grade` (`S`급 14개 / `A`급 26개), `base_meaning_ko`, `exam_meanings[]`, `signal`, `example_en`, `example_ko`, `source_note`, `context_meaning_index` |

- 전체 학습 가능 어휘 수: **총 64개** (기본 24개 + 기출 40개).

### 1.2 화면(View) 및 퀴즈 모드 구조
- **레이아웃 골격**: `.app-shell` (`max-width: 720px`) 내 상단 고정 헤더(`.app-header`), 4개 메인 섹션(`.view-section`), 하단 4탭 내비게이션(`.bottom-nav`), 토스트 컨테이너(`#toast-container`).
- **4대 메인 뷰**:
  1. `#view-home` (홈): 오늘 복습할 단어 수(`getDueWords()`), 미학습 새 단어 수(`getNewWords()`), 연속 학습일(`state.streak.count`), 퀴즈 3종 바로 시작 카드, SRS 단계별(`0~4단계`) 분포 패널 및 가상 기준일 시뮬레이션(`+1일 경과 테스트`, `기록 초기화`).
  2. `#view-wordbook` (단어장): 기본 단어장(24) / 기출 다의어(40) 탭 분리, 검색창, 난이도/등급/복습대상 필터, `window.speechSynthesis` 기반 단어·예문 TTS 발음 재생.
  3. `#view-quiz` (퀴즈):
     - **기본 퀴즈 3종**: `meaning` (뜻 맞히기 4지선다), `blank` (예문 빈칸 4지선다), `flashcard` (카드 뒤집기 자기판정: `알아요 ○` / `몰라요 ✕`).
     - **기출 모드 2종**: `exam-blank` (기출 예문 빈칸 4지선다), `exam-meaning` (문맥 속 뜻 4지선다, `base_meaning_ko` 기본 뜻 함정 포함).
     - **출제 범위(`scope`)**: `today` (샘플+기출 통합 복습·신규 큐), `all`, `wrong`, 그리고 기출 전용 `S`, `A`.
     - **유효 모드 결정(`getEffectiveQuestionMode`)**: `scope === 'today'` 등 혼합 큐에서는 `flashcard` 모드를 제외하고 단어의 `isExam` 여부에 따라 기본 단어는 `meaning`/`blank`, 기출 단어는 `exam-meaning`/`exam-blank`로 자동 매핑되어 채점·기록됨.
  4. `#view-wrong` (오답노트): 틀린 단어의 누적 오답 횟수 및 틀린 모드 배지(`wrongModes`, `modeCounts`) 표시, 모드별 필터링, 오답 전용 퀴즈 재시작, 개별 단어 암기 완료 제거.

### 1.3 기존 `localStorage` 상태 구조 (`STORAGE_KEYS`)
1. **`vocab_trainer_srs_v1`**: 단어 ID(`String(wordId)`)별 간격반복 상태 맵
   - `{ stage: 0~4, intervalDays: 1|3|7|14, nextReviewDate: "YYYY-MM-DD", lastReviewedDate: "YYYY-MM-DD", lastResult: "correct"|"wrong", lastMode: string, reviewCount: number }`
2. **`vocab_trainer_wrong_v1`**: 단어 ID(`String(wordId)`)별 오답노트 기록 맵
   - `{ wrongCount: number, lastWrongDate: "YYYY-MM-DD", lastWrongMode: string, wrongModes: string[], modeCounts: Record<string, number>, sourceType: "exam"|"sample" }`
3. **`vocab_trainer_streak_v1`**: 연속 학습일 및 가상 기준일 오프셋
   - `{ count: number, lastStudyDate: "YYYY-MM-DD"|null, todayDate: "YYYY-MM-DD"|null, todayStudiedIds: (number|string)[], dayOffset: number }`

---

## 2. XP · 레벨 시스템 설계

### 2.1 기본 XP 지급 규칙
문제 정답 판정 시점(`recordQuizAnswer`)에 해당 문항의 **유효 모드(`effectiveMode = getEffectiveQuestionMode(quizMode, wordObj)`)**와 단어 구분(`wordObj.isExam`)에 따라 기본 XP(`baseXp`)를 산정한다.

| 문항 유형 | 유효 모드 (`effectiveMode`) | 판정 결과 | 기본 획득 XP (`baseXp`) | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **기본 퀴즈 객관식** | `meaning`, `blank` | 정답 | **+10 XP** | 뼈대 규칙: 정답 +10 XP |
| **기출 모드 객관식** | `exam-blank`, `exam-meaning` | 정답 | **+15 XP** | 뼈대 규칙: 기출 모드 정답 +15 XP |
| **카드 뒤집기 (기본 단어)** | `flashcard` (`!wordObj.isExam`) | `'알아요'` 자기판정 | **+5 XP** | 뼈대 규칙: 자기판정은 절반 ($10 \times 0.5$) |
| **카드 뒤집기 (기출 단어)** | `flashcard` (`wordObj.isExam`) | `'알아요'` 자기판정 | **+7 XP** | 기출 정답(15 XP)의 절반 버림 ($\lfloor 15 \times 0.5 \rfloor = 7$, 단수 처리는 유보 7.1 참조) |
| **모든 모드 오답 / 몰라요** | 전체 모드 | 오답 / `'몰라요'` | **0 XP** | 감점 없음, 세션 연속 정답 콤보 0으로 초기화 |

### 2.2 연속 정답 보너스 (Session Combo Bonus)
- 단일 퀴즈 세션(`state.quiz`) 내에서 오답 없이 연속으로 정답을 맞힌 횟수(`sessionCombo`)를 추적한다.
- 오답 또는 `'몰라요'` 발생 시 `sessionCombo = 0`으로 즉시 초기화되며, 새 퀴즈 세션 시작(`initQuizSession`) 시에도 `0`에서 시작한다.

| 현재 세션 연속 정답 수 (`sessionCombo`) | 객관식 모드 보너스 (`comboBonus`) | 카드 뒤집기(`flashcard`) 보너스 (절반 규칙 적용) |
| :--- | :--- | :--- |
| **1 ~ 2연속** | +0 XP | +0 XP |
| **3 ~ 4연속** | **+2 XP** | **+1 XP** |
| **5 ~ 9연속** | **+4 XP** | **+2 XP** |
| **10연속 이상** | **+6 XP** (상한) | **+3 XP** (상한) |

> **참고**: 카드 뒤집기(`flashcard`) 모드에서 자기판정 연타에 따른 콤보 보너스를 절반(+1/+2/+3 XP) 부여할지, 아니면 객관식 모드에서만 콤보 보너스를 부여할지는 **「7. 유보 항목 (7.2)」**에 기록한다.

### 2.3 같은 문제 반복 파밍 방지 규칙 (Anti-Farming Rule)
전체 어휘 풀(64개)이 고정되어 있으므로, 사용자가 `다시 섞기` 또는 `같은 모드로 한 번 더 학습하기`를 반복 실행해 동일 단어로 무한 XP를 획득하는 것을 방지한다.

1. **일일 단어별 정답 XP 획득 횟수 추적 (`dailyXpGuard`)**:
   - 기준일(`todayStr = getTodayStr()`)별로 각 `wordId`가 **정답으로 XP를 획득한 횟수(`wordCounts[wordId]`)**를 기록한다.
   - 날짜가 변경되면 `wordCounts` 맵은 빈 객체(`{}`)로 자동 초기화된다.
2. **회차별 차등 지급률**:
   - **당일 1회차 정답 (`prevCount === 0`)**: **100% 지급**
     $$\text{earnedXp} = \text{baseXp} + \text{comboBonus}$$
     - 당일 처음 맞힌 단어(오늘의 복습 대상, 신규 단어, 또는 당일 처음 틀린 뒤 오답 복습으로 첫 정답에 성공한 단어 모두 포함)는 정상적으로 전액 지급한다.
   - **당일 2회차 정답 (`prevCount === 1`)**: **기본 XP의 20%만 지급 (콤보 보너스 미적용)**
     $$\text{earnedXp} = \max(1, \lfloor \text{baseXp} \times 0.2 \rfloor)$$
     - 기본 객관식(+10) → **+2 XP**, 기출 객관식(+15) → **+3 XP**, 카드 뒤집기(+5/+7) → **+1 XP**.
   - **당일 3회차 이상 정답 (`prevCount >= 2`)**: **0 XP 지급 (파밍 차단)**
     $$\text{earnedXp} = 0$$
     - 학습 자체와 SRS/오답노트 검증은 허용하되 XP는 `0 XP`로 처리하며, 피드백 슬롯에 `"오늘 이미 충분한 XP를 획득한 단어입니다 (+0 XP)"` 안내 문구를 표시한다.
3. **카드 뒤집기(`flashcard`) 무확인 광클 방지**:
   - 카드를 뒤집어 뜻을 확인하기 전(`state.quiz.flipped === false`)에는 `'알아요 ○'` / `'몰라요 ✕'` 버튼 클릭 시 바로 채점하지 않고 카드를 먼저 뒤집거나, 뒤집기 전 판정 버튼을 비활성화(`disabled`)하여 내용을 보지 않고 `'알아요'`만 연타하는 파밍을 차단한다.

### 2.4 레벨 곡선 (Level Curve)
하루 15~30단어를 학습하는 학생(일일 약 150~350 XP 획득)이 **첫날 즉시 레벨업(Lv.1 → Lv.2)**을 경험하고, 이후 점진적으로 목표 의식을 갖도록 **등차 증가형 구간 요구량** 공식을 적용한다.

- **레벨 $L$ ($L \ge 1$)에서 다음 레벨($L+1$) 진급에 필요한 구간 XP**:
  $$\Delta \text{XP}(L) = 100 + 50 \times (L - 1)$$
- **레벨 $L$ 도달을 위한 누적 총 XP (`totalXp`) 임계치**:
  $$\text{RequiredTotalXP}(L) = \sum_{k=1}^{L-1} \bigl(100 + 50(k - 1)\bigr) = 25(L - 1)(L + 2)$$

| 레벨 (`level`) | 달성 누적 XP (`RequiredTotalXP`) | 다음 레벨까지 필요 XP ($\Delta \text{XP}$) | 예상 달성 시점 (일평균 200~300 XP 기준) |
| :--- | :--- | :--- | :--- |
| **Lv. 1** | 0 XP | 100 XP | 최초 진입 (1세션 완주 시 Lv.2 진급) |
| **Lv. 2** | 100 XP | 150 XP | 1일차 |
| **Lv. 3** | 250 XP | 200 XP | 1~2일차 |
| **Lv. 4** | 450 XP | 250 XP | 2~3일차 |
| **Lv. 5** | 700 XP | 300 XP | 3~4일차 |
| **Lv. 6** | 1,000 XP | 350 XP | 4~5일차 |
| **Lv. 7** | 1,350 XP | 400 XP | 1주차 주말 |
| **Lv. 8** | 1,750 XP | 450 XP | 2주차 초반 |
| **Lv. 9** | 2,200 XP | 500 XP | 2주차 중반 |
| **Lv. 10** | 2,700 XP | 550 XP | 2주차 후반 |
| **Lv. 15** | 6,300 XP | 800 XP | 약 3~4주차 |
| **Lv. 20** | 10,450 XP | 1,050 XP | 장기 학습자 |

### 2.5 레벨 및 레벨업 표시 방식
1. **상단 헤더(`.header-badges`)**:
   - 기존 `#header-streak-badge` 옆에 `#header-level-badge` 알약을 추가하여 `⚡ Lv.3 · 310 XP` 형태로 상시 표시한다.
2. **홈 화면 히어로 카드(`.hero-card`)**:
   - 상단 브리핑 영역과 하단 시작 버튼 사이에 컴팩트한 **레벨 프로그레스 바**(`Lv.3` · `현재 구간 60 / 200 XP (30%)`)를 표시한다.
3. **문제 정답 시 인라인 XP 피드백**:
   - `.quiz-feedback` 상단 헤더 우측에 이번 문제로 획득한 XP 배지(`+15 XP` + `3연속 보너스 +2 XP`)를 표시한다.
4. **레벨업 연출 (Level-Up Feedback)**:
   - 정답 처리 후 `newLevel > prevLevel`이면:
     - 즉시 Web Audio API 레벨업 팡파르(`playLevelUpSfx()`)를 재생한다.
     - 상단 헤더의 `#header-level-badge`에 펄스 강조 애니메이션을 적용하고, 축하 토스트(`🎉 레벨 업! Lv.${newLevel} 달성!`)를 띄운다.
     - 퀴즈 세션 결과 요약 화면(`renderQuizSummary`) 상단에 **레벨업 축하 배너 카드**(`Lv.${prevLevel} → Lv.${newLevel}`)를 노출하여 문제 풀이 흐름을 끊지 않으면서 성취감을 전달한다.

---

## 3. 주간 연습 리그 설계

### 3.1 주간 운영 규칙 (월~일 주간 XP 순위)
- **집계 단위**: 매주 **월요일 00:00 ~ 일요일 23:59** (로컬 날짜 기준) 동안 획득한 **주간 XP(`weekly.xp`)**로 순위를 산정한다.
- **주간 식별자(`weekId`) 산출**:
  - 기준 날짜 `todayStr = getTodayStr()` (`YYYY-MM-DD`)로부터 요일 인덱스 `dayIndex = (dateObj.getDay() + 6) % 7` (`0` = 월요일, `1` = 화요일, ..., `6` = 일요일)을 계산한다.
  - 해당 주의 월요일 날짜 문자열 `weekId = addDays(todayStr, -dayIndex)`를 주간 키로 사용한다.
- **주간 리셋**:
  - 앱 로드 또는 XP 획득 시 `gamification.weekly.weekId !== currentWeekId`이면 `gamification.weekly = { weekId: currentWeekId, xp: 0 }`으로 주간 XP만 초기화한다 (`totalXp` 및 `level`은 유지).

### 3.2 참가자 구성 및 실제 사용자 오인 방지 원칙
- **참가 인원**: **봇(BOT) 9명 + 사용자 1명 = 총 10명**.
- **오인 방지 필수 UI 규칙**:
  1. 섹션 타이틀에 반드시 **"연습 리그"**를 명시한다 (표기: `🏆 주간 연습 리그`).
  2. 리그 카드 상단에 고정 캡션을 노출한다: *"연습 리그는 실제 다른 사용자와의 경쟁이 아니며, 학습 페이스 유지를 위해 고정 규칙으로 동작하는 AI 연습 봇 9명과 주간 XP를 비교하는 화면입니다."*
  3. 모든 봇 항목에는 이름 앞에 `[봇]` 또는 `BOT` 배지를 부착하고, 사람 실명·학교명·아바타 사진·실시간 접속 표시(초록불 등)를 일절 사용하지 않는다.
  4. 사용자 행은 `나 (학습자)`로 표기하고 강조 배경색(`--brand-soft`)으로 구분한다.

### 3.3 날짜 시드 기반 고정 의사난수(Deterministic PRNG) 규칙
서버 없이도 **모든 기기·모든 브라우저에서 동일한 날짜에 100% 같은 봇 점수표**가 나오도록, `localStorage`에 봇 점수를 임의 생성해 저장하지 않고 **날짜 문자열(`YYYY-MM-DD`)과 `botId`만을 입력으로 받는 순수 결정론적 함수**로 산출한다.

#### (1) 고정 봇 9명 명세 (`PRACTICE_BOTS`)
사용자의 학습량 수준에 맞춰 단계별로 추월의 재미를 느낄 수 있도록 9명의 일일 획득 XP 범위(`[minDaily, maxDaily]`)를 계단식으로 고정한다.

| `botId` | 화면 표시 이름 | 배지 | 일일 XP 증가 범위 (`minDaily ~ maxDaily`) | 주간 예상 총점 (일요일 기준) |
| :--- | :--- | :--- | :--- | :--- |
| `bot-1` | 연습봇 알파 | `BOT` | `15 ~ 35 XP` | 약 175 XP |
| `bot-2` | 연습봇 베타 | `BOT` | `30 ~ 60 XP` | 약 315 XP |
| `bot-3` | 연습봇 감마 | `BOT` | `45 ~ 85 XP` | 약 455 XP |
| `bot-4` | 연습봇 델타 | `BOT` | `65 ~ 110 XP` | 약 610 XP |
| `bot-5` | 연습봇 엡실론 | `BOT` | `85 ~ 140 XP` | 약 785 XP |
| `bot-6` | 연습봇 제타 | `BOT` | `110 ~ 170 XP` | 약 980 XP |
| `bot-7` | 연습봇 에타 | `BOT` | `140 ~ 210 XP` | 약 1,225 XP |
| `bot-8` | 연습봇 세타 | `BOT` | `175 ~ 255 XP` | 약 1,505 XP |
| `bot-9` | 연습봇 오메가 | `BOT` | `215 ~ 310 XP` | 약 1,835 XP |

#### (2) 시드 해시 및 의사난수 산출 공식
1. **문자열 시드 해시 (32-bit FNV-1a)**:
   - 입력 문자열: `seedKey = "${dateYMD}:${botId}"` (예: `"2026-11-08:bot-5"`)
   ```js
   function hashSeed(seedKey) {
     let h = 2166136261 >>> 0;
     for (let i = 0; i < seedKey.length; i++) {
       h ^= seedKey.charCodeAt(i);
       h = Math.imul(h, 16777619) >>> 0;
     }
     return h >>> 0;
   }
   ```
2. **고정 의사난수 생성기 (Mulberry32)**:
   ```js
   function seededRandom01(seedUint32) {
     let t = (seedUint32 + 0x6D2B79F5) >>> 0;
     t = Math.imul(t ^ (t >>> 15), t | 1);
     t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
     return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0, 1) 부동소수점
   }
   ```
3. **특정 날짜(`dateYMD`)의 봇 일일 XP 증가량**:
   ```js
   function getBotDailyXp(bot, dateYMD) {
     const r = seededRandom01(hashSeed(`${dateYMD}:${bot.botId}`));
     const span = bot.maxDaily - bot.minDaily + 1;
     const raw = bot.minDaily + Math.floor(r * span);
     return Math.round(raw / 5) * 5; // 5 XP 단위로 정규화
   }
   ```
4. **주간 누적 XP 합산 (월요일 ~ 기준일)**:
   - 해당 주의 월요일(`d = 0`)부터 기준일 요일(`d = dayIndex`, 월=0 ~ 일=6)까지 각 날짜의 일일 XP를 합산한다:
     $$\text{BotWeeklyXP}(\text{bot}, \text{todayStr}) = \sum_{d=0}^{\text{dayIndex}} \text{getBotDailyXp}\bigl(\text{bot},\ \text{addDays}(\text{weekId}, d)\bigr)$$
   - 이 공식은 순수 날짜 문자열(`YYYY-MM-DD`)에만 의존하므로, 같은 날짜에 접속한 모든 기기에서 오차 없이 **동일한 봇 점수표**를 생성한다.
5. **순위 정렬 규칙**:
   - `weeklyXp` 내림차순 정렬.
   - 동점 발생 시: **사용자(`isUser: true`)를 봇보다 상위 순위로 우선 배치**하고, 봇끼리 동점일 경우 `botId` 사전순(`bot-1` → `bot-9`)으로 결정론적 정렬을 유지한다.

---

## 4. 배지 시스템 설계 (총 7종)

### 4.1 배지 목록 및 달성 조건 (6~8개 범위 내 7종 확정)
기존 `state.srs`, `state.streak`, `state.words`, `state.examWords`를 **읽기 전용으로 참조**하고, 배지 획득 기록만 신규 저장소에 분리 저장하여 기존 데이터와 충돌하지 않게 설계한다.

| 배지 ID (`badgeId`) | 배지 이름 | 아이콘 | 달성 조건 (판정 기준) | 참조 데이터 소스 |
| :--- | :--- | :--- | :--- | :--- |
| `first_clear` | **첫 완주** | `🏁` | 아무 퀴즈 모드에서든 1개 세션을 끝까지 완료 (`completedSessions >= 1`) | `gamification.stats.completedSessions` |
| `streak_3` | **3일 연속 학습** | `🌱` | 연속 학습일 3일 이상 달성 (`state.streak.count >= 3`) | `vocab_trainer_streak_v1` |
| `streak_7` | **7일 연속** | `🔥` | 연속 학습일 7일 이상 달성 (`state.streak.count >= 7`) | `vocab_trainer_streak_v1` |
| `combo_10` | **10연속 정답** | `⚡` | 단일 퀴즈 세션 내 10문제 연속 정답 달성 (`maxCombo >= 10`) | `gamification.stats.maxCombo` |
| `exam_s_all` | **기출 S급 전파** | `👑` | 기출 다의어 `S`급 14개 단어 모두 SRS `stage >= 1` 이상 달성 (14개 전원 최소 1회 정답 돌파) | `vocab_trainer_srs_v1` + `exam-words.json` (`grade === "S"`) |
| `srs_stage4_10` | **장기 기억 마스터** | `🧠` | SRS 최고 단계인 4단계(`14일 완성`, `stage === 4`) 도달 단어 10개 이상 달성 | `vocab_trainer_srs_v1` (`stage >= 4`) |
| `all_64_learned` | **64단어 전수 학습** | `🎓` | 기본 단어 24개 + 기출 다의어 40개(총 64개) 모두 최소 1회 이상 학습(`state.srs[id]` 존재) | `vocab_trainer_srs_v1` (전체 64개 키 존재 여부) |

### 4.2 배지 판정 및 보존 규칙
1. **충돌 없는 단방향 해금 (One-Way Unlock)**:
   - 배지 조건 검사는 ① 앱 초기 구동 시(`initApp`), ② 각 문제 답변 기록 직후(`recordQuizAnswer`), ③ 퀴즈 세션 완료 시(`renderQuizSummary`) 실행한다.
   - 한 번 해금된 배지는 `gamification.badges[badgeId] = { unlockedAt: todayStr }`로 기록되며, 이후 스트릭이 끊기거나(`streak.count === 0`) 단어를 틀려 SRS `stage`가 `0`으로 내려가더라도 **이미 획득한 배지는 박탈되지 않는다**.
2. **기존 사용자 소급 해금**:
   - 이미 학습 기록을 보유한 기존 사용자가 업데이트 후 앱을 열면, `initApp` 시점의 조건 검사에서 기존 `srs`·`streak` 데이터만으로 조건을 충족한 배지가 즉시 자동 해금된다.
3. **UI 표시**:
   - 홈 화면(`#view-home`) 하단에 **배지 컬렉션 그리드(7칸)**를 배치하여 해금된 배지는 컬러 아이콘 + 획득 일자(`MM월 DD일 획득`)로, 미해금 배지는 반투명 실루엣(`grayscale(1)`, `opacity: 0.48`) + 달성 조건 안내로 표시한다.
   - 신규 배지 해금 순간에는 `playBadgeSfx()` 효과음과 함께 상단/하단 토스트 알림(`🏅 새 배지 획득: [배지 이름]`)을 노출한다.

---

## 5. 디자인 · 애니메이션 · 효과음 · 다크 모드 설계

### 5.1 기존 UI 구조를 갈아엎지 않는 레이아웃 확장
- **4대 뷰 및 하단 4탭 유지**:
  - 기존 `#view-home`, `#view-wordbook`, `#view-quiz`, `#view-wrong` 구조와 하단 내비게이션 4탭을 그대로 유지한다 (5번째 탭 신설 여부는 유보 7.6 참조).
- **홈 화면(`#view-home`) 내 자연스러운 카드 적층**:
  1. `.hero-card` (기존 브리핑 + 상단/하단에 레벨 & XP 진행바 추가)
  2. `퀴즈 3종 바로 시작` (기존 유지)
  3. `간격반복(SRS) 복습 단계 현황` (기존 유지)
  4. **`주간 연습 리그` 카드 (신규 섹션)**: 현재 내 주간 순위·XP 및 10명 순위표(봇 9 + 나) 표시
  5. **`학습 배지 컬렉션` 카드 (신규 섹션)**: 7개 배지 달성 현황 그리드 표시
- **상단 헤더(`.app-header`) 컨트롤 확장**:
  - `.header-badges` 영역에 레벨 알약(`#header-level-badge`), 효과음 토글 버튼(`#btn-toggle-sound`, `🔊/🔇`), 다크 모드 토글 버튼(`#btn-toggle-theme`, `🌙/☀️`)을 컴팩트한 원형/알약 아이콘 버튼으로 배치한다.

### 5.2 카드 · 색 체계 및 다크 모드 토큰 설계
기존 `:root` CSS 변수를 100% 보존하면서, 누락되어 있던 `--sky-*` 변수와 게이미피케이션 전용 `--xp-*` 변수, 글래스 배경 변수를 추가하고 `html[data-theme="dark"]` 셀렉터로 다크 모드를 오버라이드한다.

| 토큰 분류 | CSS 변수명 | 라이트 모드 (`:root`) | 다크 모드 (`html[data-theme="dark"]`) | 용도 |
| :--- | :--- | :--- | :--- | :--- |
| **배경 (Background)** | `--bg-page` | `#F8F7F4` | `#0F171E` | 전체 페이지 배경 |
| | `--bg-surface` | `#FFFFFF` | `#18232C` | 카드·모달·표면 배경 |
| | `--bg-subtle` | `#F1EFEA` | `#21303C` | 보조 버튼·태그 배경 |
| | `--bg-muted` | `#E6E3DC` | `#2B3D4B` | 비활성·트랙 배경 |
| | `--bg-header-glass` | `rgba(248, 247, 244, 0.92)` | `rgba(15, 23, 30, 0.90)` | 상단 헤더 블러 배경 |
| | `--bg-nav-glass` | `rgba(255, 255, 255, 0.96)` | `rgba(24, 35, 44, 0.94)` | 하단 내비게이션 블러 배경 |
| **텍스트 (Text)** | `--text-primary` | `#14212B` | `#F1F5F9` | 본문·제목 주 텍스트 |
| | `--text-secondary` | `#4A5864` | `#CBD5E1` | 보조 설명 텍스트 |
| | `--text-muted` | `#768490` | `#8FA1B3` | 캡션·힌트 텍스트 |
| **브랜드/정답 (Brand)** | `--brand-primary` | `#0F6E56` | `#14B88A` | 메인 CTA, 정답, SRS 완료 |
| | `--brand-soft` | `#E6F4F0` | `rgba(20, 184, 138, 0.15)` | 정답 배경, 내 리그 행 강조 |
| | `--brand-border` | `#B8E1D6` | `rgba(20, 184, 138, 0.38)` | 브랜드 테두리 |
| **기출/스트릭 (Amber)** | `--amber-primary` | `#C26A09` | `#F59E0B` | 스트릭, 기출 모드, S급 배지 |
| | `--amber-soft` | `#FEF3C7` | `rgba(245, 158, 11, 0.15)` | 스트릭/기출 소프트 배경 |
| | `--amber-border` | `#F6D58E` | `rgba(245, 158, 11, 0.38)` | 스트릭/기출 테두리 |
| **오답/경고 (Danger)** | `--danger-primary` | `#C93535` | `#F87171` | 오답 표시, 오답노트 강조 |
| | `--danger-soft` | `#FDF0F0` | `rgba(248, 113, 113, 0.15)` | 오답 소프트 배경 |
| | `--danger-border` | `#F3C2C2` | `rgba(248, 113, 113, 0.38)` | 오답 테두리 |
| **XP/레벨/리그 (XP)** | `--xp-primary` | `#6D28D9` | `#A78BFA` | 레벨 배지, XP 게이지, 리그 포인트 |
| | `--xp-soft` | `#F3E8FF` | `rgba(167, 139, 250, 0.16)` | XP 배지·레벨업 카드 배경 |
| | `--xp-border` | `#DDD6FE` | `rgba(167, 139, 250, 0.38)` | XP 테두리 |
| **기본오답/보조 (Sky)** | `--sky-primary` | `#0E7490` | `#38BDF8` | 기존 `.wrong-mode-badge.basic-mode` 보완 |
| | `--sky-soft` | `#ECFEFF` | `rgba(56, 189, 248, 0.15)` | 기존 `.wrong-mode-badge.basic-mode` 보완 |
| **테두리 (Border)** | `--border-subtle` | `#E4E1DA` | `#263542` | 카드 기본 외곽선 |
| | `--border-strong` | `#CFCBC1` | `#364958` | 입력창·선택지 외곽선 |

- **하드코딩 색상 치환 대상 (`css/style.css`)**:
  - `.app-header` 배경 → `var(--bg-header-glass)`
  - `.bottom-nav` 배경 → `var(--bg-nav-glass)`
  - `.word-card.speaking` 배경(`#FCFDFD`) → `var(--brand-soft)`
  - `.exam-meanings-section` 배경(`#F9FCFB`) → `var(--bg-page)`
  - `.quiz-tabs.exam-quiz-tabs` 배경(`#FDF9EE`) → `var(--amber-soft)`

### 5.3 정답 / 오답 / 인터랙션 애니메이션 설계
1. **정답 애니메이션 (`@keyframes correctPop`)**:
   - 정답 선택지(`.choice-btn.correct`): `0.28s cubic-bezier(0.22, 1, 0.36, 1)` 동안 `scale(1) → scale(1.025) → scale(1)` + 그린 글로우(`0 0 0 3px var(--brand-soft)`).
   - 빈칸 슬롯(`.blank-slot`): 정답 공개 시 `translateY(3px) → 0`으로 부드럽게 채워지는 `.filled` 트랜지션.
   - XP 획득 배지(`.xp-gain-pill`): `translateY(6px)`에서 `0`으로 떠오르며 페이드인(`0.22s ease-out`).
2. **오답 애니메이션 (`@keyframes wrongShake`)**:
   - 사용자가 선택한 오답 버튼(`.choice-btn.wrong`): `0.34s ease-in-out` 동안 좌우 진동(`0 → -6px → 6px → -4px → 4px → 0`).
3. **배지 해금 & 레벨업 팝 (`@keyframes badgeUnlockPop`)**:
   - `scale(0.75) → scale(1.06) → scale(1)` (`0.35s cubic-bezier(0.34, 1.56, 0.64, 1)`).
4. **접근성 대응 (`@media (prefers-reduced-motion: reduce)`)**:
   - 모든 흔들림(`wrongShake`) 및 스케일 애니메이션을 비활성화(`animation: none !important; transition: none !important;`)하고 색상 피드백만 즉시 표시한다.

### 5.4 효과음 설계 (Web Audio API, 외부 오디오 파일 없음)
- **구현 방식**: 오디오 파일 요청 없이 `window.AudioContext || window.webkitAudioContext`의 `OscillatorNode`와 `GainNode`만으로 실시간 합성한다.
- **초기화 및 TTS 공존 원칙**:
  - 브라우저 자동재생 정책 준수를 위해 첫 사용자 클릭 시점에 `AudioContext`를 지연 생성(`lazy-init`)하고 `ctx.state === 'suspended'`이면 `ctx.resume()`을 호출한다.
  - 단어장/퀴즈의 `window.speechSynthesis` 영어 발음과 간섭하지 않도록 모든 효과음은 **60ms ~ 320ms 이내의 짧은 엔벨로프**로 설계하고, 피크 게인을 `0.15` 이하로 제한한다.
  - `prefs.soundEnabled === false`일 때는 Web Audio 효과음만 음소거하며, 사용자가 직접 누르는 `🔊 발음` / `🔊 예문 듣기` TTS는 정상 작동한다.

| 효과음 함수 | 트리거 시점 | 파형 (`type`) | 주파수 시퀀스 (Hz) | 지속 시간 | 엔벨로프 특징 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `playCorrectSfx(combo)` | 객관식 정답 | `triangle` | 기본: `523.25 (C5)` → `659.25 (E5)`<br>3연속+: `587.33 (D5)` → `783.99 (G5)` | `200ms` (`80ms` + `120ms`) | 경쾌한 장3도/완전4도 상승 2음 차임 |
| `playWrongSfx()` | 객관식 오답 / `'몰라요'` | `sawtooth` (저역 필터) 또는 `triangle` | `185.00 (F#3)` → `146.83 (D3)` | `220ms` (`100ms` + `120ms`) | 부담스럽지 않은 낮은 하강 2음 |
| `playJudgeKnownSfx()` | 카드 뒤집기 `'알아요'` | `sine` | `659.25 (E5)` 단음 | `120ms` | 짧고 부드러운 확인 벨 |
| `playLevelUpSfx()` | 레벨 상승 달성 시 | `triangle` | `523.25 (C5)` → `659.25 (E5)` → `783.99 (G5)` → `1046.50 (C6)` | `360ms` (`70ms`×3 + `150ms`) | 4음 상승 아르페지오 팡파르 |
| `playBadgeSfx()` | 신규 배지 해금 시 | `sine` | `880.00 (A5)` + `1318.51 (E6)` 화음 | `260ms` | 맑은 벨 화음 서스테인 |

---

## 6. 상태 저장 설계 (`localStorage` 호환 확장)

### 6.1 저장 키 분리 원칙 (기존 데이터 초기화 절대 금지)
기존 3개 키(`vocab_trainer_srs_v1`, `vocab_trainer_wrong_v1`, `vocab_trainer_streak_v1`)의 이름과 내부 JSON 구조는 **단 하나의 필드도 삭제하거나 타입을 변경하지 않고 그대로 유지**한다. 게임화 및 디자인 설정은 별도의 신규 키 2개에 분리 저장한다.

| 구분 | `localStorage` 키 이름 | 상태 | 역할 및 설명 |
| :--- | :--- | :--- | :--- |
| **기존 키 (유지)** | `vocab_trainer_srs_v1` | 불변 유지 | 단어별 SRS 복습 단계(`stage`), 주기(`intervalDays`), 예정일(`nextReviewDate`) |
| **기존 키 (유지)** | `vocab_trainer_wrong_v1` | 불변 유지 | 오답 단어별 누적 횟수(`wrongCount`), 모드별 오답 기록(`wrongModes`, `modeCounts`) |
| **기존 키 (유지)** | `vocab_trainer_streak_v1` | 불변 유지 | 연속 학습일(`count`), 최근 학습일(`lastStudyDate`), 가상 날짜 오프셋(`dayOffset`) |
| **신규 키 (추가)** | `vocab_trainer_gamification_v1` | 신규 추가 | 누적 XP(`totalXp`), 레벨(`level`), 주간 연습 리그 XP(`weekly`), 일일 반복 파밍 방지 카운터(`dailyXpGuard`), 획득 배지(`badges`), 세션 누적 통계(`stats`) |
| **신규 키 (추가)** | `vocab_trainer_prefs_v1` | 신규 추가 | 다크 모드 설정(`theme`), 효과음 ON/OFF(`soundEnabled`) |

### 6.2 신규 키 상세 스키마

#### (1) `vocab_trainer_gamification_v1`
```json
{
  "version": 1,
  "totalXp": 0,
  "level": 1,
  "weekly": {
    "weekId": "2026-11-02",
    "xp": 0
  },
  "dailyXpGuard": {
    "date": "2026-11-08",
    "wordCounts": {
      "1": 1,
      "exam-account": 2
    }
  },
  "badges": {
    "first_clear": { "unlockedAt": "2026-11-08" },
    "streak_3": { "unlockedAt": "2026-11-08" }
  },
  "stats": {
    "completedSessions": 0,
    "maxCombo": 0,
    "totalCorrectAnswers": 0
  }
}
```

#### (2) `vocab_trainer_prefs_v1`
```json
{
  "version": 1,
  "theme": "system",
  "soundEnabled": true
}
```

### 6.3 기존 사용자 데이터 무손실 로드 및 방어 로직
1. **초기 로드 (`loadStateFromStorage`)**:
   - 기존 `SRS`, `WRONG`, `STREAK` 로드 로직은 현재 코드와 동일하게 수행한다.
   - `vocab_trainer_gamification_v1`이나 `vocab_trainer_prefs_v1`이 없거나 JSON 파싱에 실패하더라도, 해당 신규 상태만 안전한 기본값으로 초기화하며 기존 학습 기록(`srs`, `wrongNote`, `streak`)은 절대 건드리지 않는다.
2. **날짜/주간 정규화 (`normalizeGamificationForToday`)**:
   - `dailyXpGuard.date !== getTodayStr()`이면 `dailyXpGuard = { date: getTodayStr(), wordCounts: {} }`로 일일 파밍 카운터만 리셋한다.
   - `weekly.weekId !== getCurrentWeekMondayStr()`이면 `weekly = { weekId: getCurrentWeekMondayStr(), xp: 0 }`으로 주간 리그 점수만 리셋한다.
3. **기존 사용자 배지 자동 동기화 (`evaluateBadges`)**:
   - 앱 시작 시 기존 `state.srs`와 `state.streak`를 스캔하여 `streak_3`, `streak_7`, `exam_s_all`, `srs_stage4_10`, `all_64_learned` 조건이 이미 충족되어 있다면 즉시 해금 기록을 추가하고 저장한다.

---

## 7. 유보 항목 (확정 보류 및 추가 결정 필요 사항)

지시 범위에서 명시적으로 고정되지 않았거나 정책 선택에 따라 달라질 수 있는 아래 항목들은 임의로 단정하지 않고 **유보(Open Decisions)**로 기록한다.

1. **[유보 7.1] 기출 다의어를 카드 뒤집기(`flashcard`) 모드로 풀이할 때의 절반 XP 단수 처리**
   - **배경**: `scope === 'today'`(오늘 복습 통합 큐)에서 `flashcard` 모드를 선택하면 기출 다의어(`isExam: true`, 기본 정답 15 XP)도 카드 뒤집기로 출제된다. 이때 15 XP의 절반인 `7.5 XP`에 대해 ① 소수점 버림(`+7 XP`, 본 설계 기본안), ② 소수점 반올림(`+8 XP`), ③ 카드 뒤집기는 단어 종류 불문 `+5 XP` 일괄 적용 중 어느 방식으로 확정할지 유보.
2. **[유보 7.2] 카드 뒤집기(`flashcard`) 자기판정 모드에서의 연속 정답 보너스 인정 여부**
   - **배경**: 카드 뒤집기는 사용자가 스스로 `'알아요'`를 누르는 자기판정 방식이므로, 객관식과 동일하게 연속 정답 보너스(절반인 `+1 / +2 / +3 XP`)를 지급할지, 아니면 연속 정답 보너스는 객관식 4지선다(`meaning`, `blank`, `exam-blank`, `exam-meaning`)에만 한정할지 유보.
3. **[유보 7.3] 기존 학습 기록(`vocab_trainer_srs_v1`) 보유 사용자의 초기 누적 XP 소급 부여 여부**
   - **배경**: 게임화 업데이트 이전에 이미 단어를 학습해 둔 기존 사용자의 경우, 배지는 즉시 소급 해금하되 누적 XP(`totalXp`)는 `0 XP (Lv.1)`에서 출발시킬지(본 설계 기본안), 아니면 기존 `state.srs`의 학습 단어 수·복습 횟수(`reviewCount`)에 비례하여 초기 보정 XP를 소급 지급할지 유보.
4. **[유보 7.4] 연습 리그 봇의 '당일' 일일 XP 반영 시점 (일자별 일괄 반영 vs 시각 비례 반영)**
   - **배경**: 모든 기기에서 동일한 순위표가 나오도록 본 설계는 해당 날짜(`YYYY-MM-DD`)의 봇 일일 XP를 일 단위로 일괄 합산하는 방식을 채택했다. 만약 하루 중 시간 경과(예: 오전에는 30%, 밤에는 100%)에 따라 봇 점수가 조금씩 오르는 연출을 원할 경우 기기별 조회 시각에 따라 표가 달라질 수 있으므로, 일 단위 고정 합산 유지 여부를 유보.
5. **[유보 7.5] 홈 화면 `+1일 경과 테스트`(`dayOffset`) 시뮬레이션과 연습 리그·일일 파밍 제한의 연동 여부**
   - **배경**: 현재 앱은 `getTodayStr()`을 통해 가상 기준일(`dayOffset`)을 SRS와 스트릭에 반영하고 있다. 연습 리그의 주간 날짜 계산 및 일일 반복 파밍 제한(`dailyXpGuard.date`)도 테스트 편의를 위해 `getTodayStr()`(시뮬레이션 날짜 포함)을 따를지, 아니면 실제 시스템 날짜(`new Date()`)만 참조할지 유보.
6. **[유보 7.6] 연습 리그 및 배지 화면의 내비게이션 배치 (홈 화면 섹션 통합 vs 하단 5번째 탭 추가)**
   - **배경**: 기존 UI 구조를 갈아엎지 않는 원칙에 따라 본 설계는 기존 하단 4탭(`홈 / 단어장 / 퀴즈 3종 / 오답노트`)을 유지하고 홈 화면 내 카드로 연습 리그와 배지를 배치했다. 추후 이를 별도의 5번째 하단 탭(`리그·배지`)이나 헤더 모달로 분리할지 여부는 유보.
7. **[유보 7.7] 홈 화면 `기록 초기화`(`#btn-reset-storage`) 클릭 시 게임화 데이터 초기화 범위**
   - **배경**: `기록 초기화` 버튼 실행 시 기존 `srs`, `wrongNote`, `streak`와 함께 `vocab_trainer_gamification_v1`(레벨·XP·배지)도 일괄 초기화할지(본 설계 기본안), 혹은 획득한 배지·레벨은 별도 확인 후 유지/초기화를 선택하게 할지 유보 (단, 다크 모드·효과음 설정인 `vocab_trainer_prefs_v1`은 초기화에서 제외).
8. **[유보 7.8] 최고 레벨 상한선(Level Cap) 및 주간 연습 리그 종료 보상 유무**
   - **배경**: 레벨 곡선의 최대 상한(예: Lv.20 또는 Lv.50 캡) 존재 여부와, 일요일 종료 후 주간 연습 리그 상위권(예: 1~3위) 달성 시 추가 보너스 XP나 전용 배지를 지급할지 여부는 지시 범위 밖이므로 유보.
