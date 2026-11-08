# 수능·고등 영단어 트레이너 (vocab-trainer)

고등 필수 영어 어휘 24개를 **단어장 · 3종 퀴즈 · 오답노트 · 간격반복(Spaced Repetition)** 방식으로 학습할 수 있는 서버리스 바닐라 HTML/CSS/JS 기반 **PWA(설치형 웹앱)** 프로토타입입니다.

---

## 주요 기능

1. **홈 화면**
   - **오늘 복습할 단어 수**, 미학습 새 단어 수, **연속 학습일(Streak)** 실시간 표시
   - **새 학습 / 오늘의 복습 퀴즈 시작** 원클릭 버튼 및 퀴즈 3종 바로 시작 카드 제공
   - 간격반복(SRS) 단계별(`미학습/재출제` · `1일` · `3일` · `7일` · `14일`) 단어 분포 현황판 및 `+1일 경과 테스트` 시뮬레이션 지원
2. **단어장 (`data/words.json`)**
   - 고등 기본·핵심·심화(`고1`, `고2`, `고3`) 어휘 24개의 단어·품사·뜻·영어 예문·한국어 해석 카드 목록
   - 영단어/한국어 뜻 실시간 검색 및 난이도별·복습 대상별 필터링
   - 단어 카드 또는 발음 버튼 클릭 시 브라우저 내장 **Web Speech API (`window.speechSynthesis`)** 기반 영어 단어 및 예문 발음 재생
3. **퀴즈 3종**
   - **(a) 뜻 맞히기 4지선다**: 제시된 영단어의 알맞은 한국어 뜻 선택
   - **(b) 예문 빈칸 채우기 4지선다**: 영어 예문 속 빈칸(`_______`)에 들어갈 알맞은 영단어 선택
   - **(c) 카드 뒤집기 자기 판정**: 플래시카드를 클릭해 뜻과 예문을 확인한 뒤 `알아요` / `몰라요` 자기 판정
4. **오답노트**
   - 퀴즈에서 틀리거나 `몰라요`로 판정한 단어를 `localStorage`에 자동 저장 및 오답 횟수 기록
   - **오답노트에 저장된 단어만으로** 3종 퀴즈(뜻 맞히기 / 예문 빈칸 / 카드 뒤집기) 재시작 가능
   - 암기 완료 단어 개별 제거 지원
5. **간격반복 (Spaced Repetition)**
   - 정답 판정 시 단어별 복습 간격 단계 확대: **`1일 → 3일 → 7일 → 14일`**
   - 오답 판정 시 복습 단계 초기화 및 **내일(`+1일`) 재출제**
   - 단어별 복습 단계(`stage`), 주기(`intervalDays`), 다음 복습 예정일(`nextReviewDate`)을 `localStorage`에 영구 저장
6. **PWA (Progressive Web App)**
   - `manifest.json` 및 아이콘(`192x192`, `512x512`, `SVG`) 구성으로 모바일·데스크톱 홈 화면 설치 지원
   - 서비스 워커(`sw.js`)를 통한 정적 자산 및 `data/words.json` 오프라인 캐시 지원
   - 모바일 우선(Mobile-First) 반응형 한국어 UI

---

## 디렉터리 구조

```text
vocab-trainer/
├── SPEC.md             # 프로젝트 요구사항 및 기능 명세서
├── README.md           # 프로젝트 구조 및 실행 방법 안내
├── index.html          # 메인 엔트리 HTML (홈, 단어장, 퀴즈 3종, 오답노트 뷰)
├── manifest.json       # PWA 웹앱 매니페스트
├── sw.js               # 오프라인 캐시 지원 서비스 워커 (Service Worker)
├── css/
│   └── style.css       # 모바일 우선 반응형 스타일시트 (바닐라 CSS)
├── js/
│   └── app.js          # 상태 관리(localStorage), SRS, 퀴즈 3종, TTS 로직
├── data/
│   └── words.json      # 자체 작성 고등 필수 영단어 24개 및 예문 데이터
└── icons/
    ├── icon.svg        # 앱 벡터 아이콘
    ├── icon-192.png    # PWA 설치용 192x192 아이콘
    └── icon-512.png    # PWA 설치용 512x512 아이콘
```

---

## 실행 방법

이 프로젝트는 별도의 빌드 도구나 외부 서버·API 키 없이 정적 웹 서버만으로 즉시 실행됩니다. (`fetch('./data/words.json')` 및 서비스 워커 등록을 위해 `file://` 직접 열기 대신 로컬 HTTP 서버 실행을 권장합니다.)

### 방법 1: Python 내장 HTTP 서버 (권장)

```bash
python3 -m http.server 8080
```

실행 후 브라우저에서 `http://localhost:8080` 에 접속합니다.

### 방법 2: Node.js (`npx serve`)

```bash
npx -y serve . -l 8080
```

---

## `localStorage` 저장 키 구조

| 키 이름 | 설명 |
| :--- | :--- |
| `vocab_trainer_srs_v1` | 단어 ID별 복습 단계(`stage: 0~4`), 간격(`1/3/7/14일`), 다음 복습 예정일(`nextReviewDate`) |
| `vocab_trainer_wrong_v1` | 오답 단어 ID별 누적 오답 횟수(`wrongCount`) 및 최근 오답 일자(`lastWrongDate`) |
| `vocab_trainer_streak_v1` | 연속 학습일(`count`), 최근 학습 일자(`lastStudyDate`), 당일 학습 단어 목록 |
