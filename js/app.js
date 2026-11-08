(function () {
  'use strict';

  const STORAGE_KEYS = {
    SRS: 'vocab_trainer_srs_v1',
    WRONG: 'vocab_trainer_wrong_v1',
    STREAK: 'vocab_trainer_streak_v1',
    GAMIFICATION: 'vocab_trainer_gamification_v1'
  };

  // 간격반복(SRS) 복습 간격 단계: 맞히면 1일 -> 3일 -> 7일 -> 14일 확대
  const SRS_INTERVALS = [1, 3, 7, 14];

  // 퀴즈 모드 라벨 (기본 3종 + 기출 모드 2종)
  const QUIZ_MODE_LABELS = {
    meaning: '기본 · 뜻 맞히기',
    blank: '기본 · 예문 빈칸',
    flashcard: '기본 · 카드 뒤집기',
    'exam-blank': '기출 · 예문 빈칸',
    'exam-meaning': '기출 · 문맥 속 뜻'
  };

  const state = {
    words: [],
    examWords: [],
    srs: {},
    wrongNote: {},
    streak: {
      count: 0,
      lastStudyDate: null,
      todayDate: null,
      todayStudiedIds: [],
      dayOffset: 0
    },
    gamification: createDefaultGamification(),
    currentView: 'home',
    wordbookTab: 'sample',      // 'sample' | 'exam'
    wordbookFilter: 'all',      // 'all' | '고1' | '고2' | '고3' | 'due'
    examWordbookFilter: 'all',  // 'all' | 'S' | 'A' | 'due'
    wordbookSearch: '',
    wrongNoteFilter: 'all',     // 'all' | 'exam' | 'sample' | 'exam-blank' | 'exam-meaning' | 'meaning' | 'blank' | 'flashcard'
    quiz: {
      mode: 'meaning', // 'meaning' | 'blank' | 'flashcard' | 'exam-blank' | 'exam-meaning'
      scope: 'today',  // 'today' | 'all' | 'wrong' | 'S' | 'A'
      queue: [],
      currentIndex: 0,
      answered: false,
      flipped: false,
      choices: [],
      results: [], // { wordId, isCorrect, nextInterval, nextReviewDate, mode, xp }
      sessionCombo: 0,        // 세션 내 연속 정답 수 (오답/몰라요 시 0)
      sessionXp: 0,           // 세션 누적 획득 XP
      sessionStartLevel: 1,   // 세션 시작 시점 레벨 (레벨업 배너용)
      completionRecorded: false // 세션 완료 통계 중복 집계 방지
    }
  };

  let deferredInstallPrompt = null;

  // --- 게임화(XP·레벨) 상태 기본값 (DESIGN.md 6.2) ---
  function createDefaultGamification() {
    return {
      version: 1,
      totalXp: 0,
      level: 1,
      weekly: { weekId: null, xp: 0 },
      dailyXpGuard: { date: null, wordCounts: {} },
      badges: {},
      stats: { completedSessions: 0, maxCombo: 0, totalCorrectAnswers: 0 }
    };
  }

  // --- 날짜 유틸리티 ---
  function formatDateYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getTodayStr() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (state.streak && state.streak.dayOffset) {
      now.setDate(now.getDate() + Number(state.streak.dayOffset));
    }
    return formatDateYMD(now);
  }

  function addDays(ymdStr, days) {
    const parts = ymdStr.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    dt.setDate(dt.getDate() + days);
    return formatDateYMD(dt);
  }

  function formatKoreanShortDate(ymdStr) {
    if (!ymdStr) return '-';
    const parts = ymdStr.split('-').map(Number);
    return `${parts[1]}월 ${parts[2]}일`;
  }

  // --- localStorage 입출력 ---
  function loadStateFromStorage() {
    try {
      const rawSrs = localStorage.getItem(STORAGE_KEYS.SRS);
      state.srs = rawSrs ? JSON.parse(rawSrs) : {};
    } catch (e) {
      state.srs = {};
    }

    try {
      const rawWrong = localStorage.getItem(STORAGE_KEYS.WRONG);
      state.wrongNote = rawWrong ? JSON.parse(rawWrong) : {};
    } catch (e) {
      state.wrongNote = {};
    }

    try {
      const rawStreak = localStorage.getItem(STORAGE_KEYS.STREAK);
      if (rawStreak) {
        const parsed = JSON.parse(rawStreak);
        state.streak = {
          count: Number(parsed.count) || 0,
          lastStudyDate: parsed.lastStudyDate || null,
          todayDate: parsed.todayDate || null,
          todayStudiedIds: Array.isArray(parsed.todayStudiedIds) ? parsed.todayStudiedIds : [],
          dayOffset: Number(parsed.dayOffset) || 0
        };
      }
    } catch (e) {
      // 기본값 유지
    }

    normalizeStreakForToday();

    // 게임화 상태: 없거나 파싱 실패 시 신규 상태만 기본값으로 초기화 (기존 학습 기록은 건드리지 않음, DESIGN.md 6.3)
    state.gamification = loadGamificationFromStorage();
    normalizeGamificationForToday();
  }

  function loadGamificationFromStorage() {
    const base = createDefaultGamification();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GAMIFICATION);
      if (!raw) return base;
      const p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return base;
      const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);
      base.totalXp = num(p.totalXp);
      base.level = getLevelFromXp(base.totalXp);
      if (p.weekly && typeof p.weekly === 'object') {
        base.weekly = {
          weekId: typeof p.weekly.weekId === 'string' ? p.weekly.weekId : null,
          xp: num(p.weekly.xp)
        };
      }
      if (p.dailyXpGuard && typeof p.dailyXpGuard === 'object') {
        const wc = {};
        if (p.dailyXpGuard.wordCounts && typeof p.dailyXpGuard.wordCounts === 'object') {
          Object.keys(p.dailyXpGuard.wordCounts).forEach((k) => {
            wc[k] = num(p.dailyXpGuard.wordCounts[k]);
          });
        }
        base.dailyXpGuard = {
          date: typeof p.dailyXpGuard.date === 'string' ? p.dailyXpGuard.date : null,
          wordCounts: wc
        };
      }
      if (p.badges && typeof p.badges === 'object') {
        Object.keys(p.badges).forEach((k) => {
          const b = p.badges[k];
          if (b && typeof b === 'object') base.badges[k] = { unlockedAt: b.unlockedAt || null };
        });
      }
      if (p.stats && typeof p.stats === 'object') {
        base.stats = {
          completedSessions: num(p.stats.completedSessions),
          maxCombo: num(p.stats.maxCombo),
          totalCorrectAnswers: num(p.stats.totalCorrectAnswers)
        };
      }
      return base;
    } catch (e) {
      return base;
    }
  }

  function saveStateToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.SRS, JSON.stringify(state.srs));
      localStorage.setItem(STORAGE_KEYS.WRONG, JSON.stringify(state.wrongNote));
      localStorage.setItem(STORAGE_KEYS.STREAK, JSON.stringify(state.streak));
      localStorage.setItem(STORAGE_KEYS.GAMIFICATION, JSON.stringify(state.gamification));
    } catch (e) {
      showToast('브라우저 저장소(localStorage)에 기록을 저장할 수 없습니다.');
    }
  }

  function normalizeStreakForToday() {
    const today = getTodayStr();
    if (state.streak.todayDate !== today) {
      state.streak.todayDate = today;
      state.streak.todayStudiedIds = [];
    }
    if (state.streak.lastStudyDate) {
      const yesterday = addDays(today, -1);
      if (
        state.streak.lastStudyDate !== today &&
        state.streak.lastStudyDate !== yesterday
      ) {
        // 어제 학습 기록이 없으면 연속 학습일 초기화
        state.streak.count = 0;
      }
    }
  }

  // --- XP · 레벨 · 주간 키 유틸리티 (DESIGN.md 2.4, 3.1, 6.3) ---
  // 레벨 L 도달 누적 XP: 25(L-1)(L+2) / 레벨 상한 없음 (유보 7.8 확정)
  function getRequiredTotalXp(level) {
    return 25 * (level - 1) * (level + 2);
  }

  function getLevelFromXp(totalXp) {
    let level = 1;
    while (getRequiredTotalXp(level + 1) <= totalXp) level += 1;
    return level;
  }

  function getLevelProgress(totalXp) {
    const level = getLevelFromXp(totalXp);
    const base = getRequiredTotalXp(level);
    const span = 100 + 50 * (level - 1);
    const cur = totalXp - base;
    return { level, cur, span, pct: Math.min(100, Math.floor((cur / span) * 100)) };
  }

  // 주간 식별자: 해당 주 월요일 날짜 (getTodayStr 기준 → 가상 날짜 반영, 유보 7.5 확정)
  function getWeekMondayStr(ymdStr) {
    const parts = ymdStr.split('-').map(Number);
    const dayIndex = (new Date(parts[0], parts[1] - 1, parts[2]).getDay() + 6) % 7;
    return addDays(ymdStr, -dayIndex);
  }

  function getCurrentWeekMondayStr() {
    return getWeekMondayStr(getTodayStr());
  }

  function normalizeGamificationForToday() {
    const g = state.gamification;
    const today = getTodayStr();
    if (!g.dailyXpGuard || g.dailyXpGuard.date !== today) {
      g.dailyXpGuard = { date: today, wordCounts: {} };
    }
    const weekId = getCurrentWeekMondayStr();
    if (!g.weekly || g.weekly.weekId !== weekId) {
      g.weekly = { weekId, xp: 0 };
    }
  }

  // --- 주간 연습 리그 (DESIGN.md 3장) ---
  // 고정 규칙 AI 연습 봇 9명 (실제 사용자 아님)
  const PRACTICE_BOTS = [
    { botId: 'bot-1', name: '연습봇 알파', minDaily: 15, maxDaily: 35 },
    { botId: 'bot-2', name: '연습봇 베타', minDaily: 30, maxDaily: 60 },
    { botId: 'bot-3', name: '연습봇 감마', minDaily: 45, maxDaily: 85 },
    { botId: 'bot-4', name: '연습봇 델타', minDaily: 65, maxDaily: 110 },
    { botId: 'bot-5', name: '연습봇 엡실론', minDaily: 85, maxDaily: 140 },
    { botId: 'bot-6', name: '연습봇 제타', minDaily: 110, maxDaily: 170 },
    { botId: 'bot-7', name: '연습봇 에타', minDaily: 140, maxDaily: 210 },
    { botId: 'bot-8', name: '연습봇 세타', minDaily: 175, maxDaily: 255 },
    { botId: 'bot-9', name: '연습봇 오메가', minDaily: 215, maxDaily: 310 }
  ];

  // 32-bit FNV-1a
  function hashSeed(seedKey) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedKey.length; i++) {
      h ^= seedKey.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // Mulberry32
  function seededRandom01(seedUint32) {
    let t = (seedUint32 + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function getBotDailyXp(bot, dateYMD) {
    const r = seededRandom01(hashSeed(`${dateYMD}:${bot.botId}`));
    const span = bot.maxDaily - bot.minDaily + 1;
    const raw = bot.minDaily + Math.floor(r * span);
    return Math.round(raw / 5) * 5;
  }

  // 월요일 ~ 기준일까지 일 단위 일괄 합산 (유보 7.4 확정: 시각 비례 없음)
  function getBotWeeklyXp(bot, todayStr) {
    const weekId = getWeekMondayStr(todayStr);
    const parts = todayStr.split('-').map(Number);
    const dayIndex = (new Date(parts[0], parts[1] - 1, parts[2]).getDay() + 6) % 7;
    let sum = 0;
    for (let d = 0; d <= dayIndex; d++) {
      sum += getBotDailyXp(bot, addDays(weekId, d));
    }
    return sum;
  }

  function getLeagueStandings() {
    normalizeGamificationForToday();
    const today = getTodayStr();
    const rows = PRACTICE_BOTS.map((bot) => ({
      id: bot.botId,
      name: bot.name,
      isUser: false,
      weeklyXp: getBotWeeklyXp(bot, today)
    }));
    rows.push({ id: 'user', name: '나 (학습자)', isUser: true, weeklyXp: state.gamification.weekly.xp });
    rows.sort((a, b) => {
      if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
      if (a.isUser !== b.isUser) return a.isUser ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  function renderLeagueCard() {
    const box = document.getElementById('home-league-card');
    if (!box) return;
    const rows = getLeagueStandings();
    const me = rows.find((r) => r.isUser);
    box.innerHTML = `
      <p class="league-caption">연습 리그는 실제 다른 사용자와의 경쟁이 아니며, 학습 페이스 유지를 위해 고정 규칙으로 동작하는 AI 연습 봇 9명과 주간 XP를 비교하는 화면입니다.</p>
      <div class="league-summary">이번 주 내 순위 <strong>${me.rank}위 / ${rows.length}명</strong> · 주간 <strong>${me.weeklyXp} XP</strong></div>
      <ol class="league-list">
        ${rows
          .map(
            (r) => `
          <li class="league-row ${r.isUser ? 'me' : ''}">
            <span class="league-rank">${r.rank}</span>
            <span class="league-name">${r.isUser ? '' : '<span class="bot-badge">BOT</span>'}${escapeHtml(r.name)}</span>
            <span class="league-xp">${r.weeklyXp} XP</span>
          </li>`
          )
          .join('')}
      </ol>
    `;
  }

  // --- 배지 시스템 (DESIGN.md 4장, 7종) ---
  const BADGE_DEFS = [
    { id: 'first_clear', name: '첫 완주', icon: '🏁', desc: '퀴즈 세션을 1개 끝까지 완료' },
    { id: 'streak_3', name: '3일 연속 학습', icon: '🌱', desc: '연속 학습일 3일 이상' },
    { id: 'streak_7', name: '7일 연속', icon: '🔥', desc: '연속 학습일 7일 이상' },
    { id: 'combo_10', name: '10연속 정답', icon: '⚡', desc: '한 세션에서 10문제 연속 정답' },
    { id: 'exam_s_all', name: '기출 S급 전파', icon: '👑', desc: '기출 S급 14개 모두 SRS 1단계 이상' },
    { id: 'srs_stage4_10', name: '장기 기억 마스터', icon: '🧠', desc: 'SRS 4단계(14일 완성) 단어 10개 이상' },
    { id: 'all_64_learned', name: '64단어 전수 학습', icon: '🎓', desc: '기본 24 + 기출 40단어 모두 1회 이상 학습' }
  ];

  function isBadgeConditionMet(badgeId) {
    const g = state.gamification;
    switch (badgeId) {
      case 'first_clear':
        return g.stats.completedSessions >= 1;
      case 'streak_3':
        return state.streak.count >= 3;
      case 'streak_7':
        return state.streak.count >= 7;
      case 'combo_10':
        return g.stats.maxCombo >= 10;
      case 'exam_s_all': {
        const sWords = state.examWords.filter((w) => w.grade === 'S');
        return (
          sWords.length > 0 &&
          sWords.every((w) => {
            const rec = state.srs[String(w.id)];
            return rec && Number(rec.stage) >= 1;
          })
        );
      }
      case 'srs_stage4_10':
        return Object.keys(state.srs).filter((k) => state.srs[k] && Number(state.srs[k].stage) >= 4).length >= 10;
      case 'all_64_learned': {
        const all = [...state.words, ...state.examWords];
        return all.length > 0 && all.every((w) => state.srs[String(w.id)]);
      }
      default:
        return false;
    }
  }

  // 단방향 해금: 한 번 해금된 배지는 박탈하지 않음. 새로 해금된 배지 목록 반환.
  function evaluateBadges() {
    const g = state.gamification;
    const today = getTodayStr();
    const unlocked = [];
    BADGE_DEFS.forEach((def) => {
      if (!g.badges[def.id] && isBadgeConditionMet(def.id)) {
        g.badges[def.id] = { unlockedAt: today };
        unlocked.push(def);
      }
    });
    if (unlocked.length > 0) {
      saveStateToStorage();
      const names = unlocked.map((d) => d.name).join(', ');
      // 같은 틱의 다른 토스트(카드 판정 안내 등)에 덮어쓰이지 않도록 지연 표시
      setTimeout(() => showToast(`🏅 새 배지 획득: ${names}`), 0);
    }
    return unlocked;
  }

  function formatBadgeDate(ymdStr) {
    if (!ymdStr) return '-';
    const parts = ymdStr.split('-');
    return `${parts[1]}월 ${parts[2]}일`;
  }

  function renderBadgeCollection() {
    const box = document.getElementById('home-badge-grid');
    if (!box) return;
    box.innerHTML = BADGE_DEFS.map((def) => {
      const got = state.gamification.badges[def.id];
      return `
        <div class="badge-item ${got ? 'unlocked' : 'locked'}">
          <span class="badge-icon" aria-hidden="true">${def.icon}</span>
          <strong class="badge-name">${escapeHtml(def.name)}</strong>
          <span class="badge-sub">${
            got ? `${escapeHtml(formatBadgeDate(got.unlockedAt))} 획득` : escapeHtml(def.desc)
          }</span>
        </div>`;
    }).join('');
  }

  // --- 간격반복(SRS) 및 오답노트 핵심 로직 ---
  function getQuizModeLabel(modeKey) {
    return QUIZ_MODE_LABELS[modeKey] || '기록 없음';
  }

  function getWordSrs(wordId) {
    return state.srs[String(wordId)] || null;
  }

  function isWordDueToday(wordId) {
    const rec = getWordSrs(wordId);
    if (!rec || !rec.nextReviewDate) return false;
    return rec.nextReviewDate <= getTodayStr();
  }

  function getDueSampleWords() {
    return state.words.filter((w) => isWordDueToday(w.id));
  }

  function getDueExamWords() {
    return state.examWords.filter((w) => isWordDueToday(w.id));
  }

  function getDueWords() {
    return [...getDueSampleWords(), ...getDueExamWords()];
  }

  function getNewSampleWords() {
    return state.words.filter((w) => !getWordSrs(w.id));
  }

  function getNewExamWords() {
    return state.examWords.filter((w) => !getWordSrs(w.id));
  }

  function getNewWords() {
    return [...getNewSampleWords(), ...getNewExamWords()];
  }

  function getWrongSampleWords() {
    return state.words.filter((w) => Boolean(state.wrongNote[String(w.id)]));
  }

  function getWrongExamWords() {
    return state.examWords.filter((w) => Boolean(state.wrongNote[String(w.id)]));
  }

  function getWrongWords() {
    return [...getWrongSampleWords(), ...getWrongExamWords()];
  }

  function getWrongModesForRecord(wrongInfo) {
    if (!wrongInfo) return [];
    if (Array.isArray(wrongInfo.wrongModes) && wrongInfo.wrongModes.length > 0) {
      return wrongInfo.wrongModes.filter((m) => Boolean(QUIZ_MODE_LABELS[m]));
    }
    if (wrongInfo.lastWrongMode && QUIZ_MODE_LABELS[wrongInfo.lastWrongMode]) {
      return [wrongInfo.lastWrongMode];
    }
    return [];
  }

  function renderWrongModeBadges(wrongInfo, isExamWord, compact) {
    if (!wrongInfo) return '';
    const modes = getWrongModesForRecord(wrongInfo);
    if (modes.length === 0) {
      const unknownText = compact ? '오답노트 · 기록 없음' : '기록 없음';
      return `<span class="wrong-mode-badge" data-wrong-mode="unknown">${escapeHtml(unknownText)}</span>`;
    }

    const modeCounts =
      wrongInfo.modeCounts && typeof wrongInfo.modeCounts === 'object'
        ? wrongInfo.modeCounts
        : {};

    return modes
      .map((m) => {
        const label = getQuizModeLabel(m);
        const cls = String(m).startsWith('exam-') ? 'exam-mode' : 'basic-mode';
        const cnt = Number(modeCounts[m]) || 0;
        const text = compact
          ? `오답노트 · ${label}`
          : cnt > 1
          ? `${label} 오답 ${cnt}회`
          : `${label} 오답`;
        return `<span class="wrong-mode-badge ${cls}" data-wrong-mode="${escapeHtml(m)}">${escapeHtml(text)}</span>`;
      })
      .join('');
  }

  function recordQuizAnswer(wordId, isCorrect, quizMode) {
    const key = String(wordId);
    const modeKey = quizMode || state.quiz.mode || (key.startsWith('exam-') ? 'exam-blank' : 'meaning');
    const today = getTodayStr();
    const prev = state.srs[key];

    let nextStage = 0;
    let intervalDays = 1;

    if (isCorrect) {
      const prevStage = prev && typeof prev.stage === 'number' ? prev.stage : 0;
      nextStage = Math.min(prevStage + 1, SRS_INTERVALS.length);
      intervalDays = SRS_INTERVALS[nextStage - 1];
    } else {
      // 틀리면 간격 단계 초기화 및 내일(+1일) 재출제
      nextStage = 0;
      intervalDays = 1;
    }

    const nextReviewDate = addDays(today, intervalDays);

    state.srs[key] = {
      stage: nextStage,
      intervalDays,
      nextReviewDate,
      lastReviewedDate: today,
      lastResult: isCorrect ? 'correct' : 'wrong',
      lastMode: modeKey,
      reviewCount: (prev && prev.reviewCount ? prev.reviewCount : 0) + 1
    };

    // 오답노트 자동 저장 (어떤 모드에서 틀렸는지 구분 저장)
    if (!isCorrect) {
      const prevWrong = state.wrongNote[key];
      const isExam = key.startsWith('exam-');
      const prevModes = getWrongModesForRecord(prevWrong, isExam);
      const wrongModes = prevModes.includes(modeKey)
        ? prevModes.slice()
        : [...prevModes, modeKey];
      const modeCounts =
        prevWrong && prevWrong.modeCounts && typeof prevWrong.modeCounts === 'object'
          ? { ...prevWrong.modeCounts }
          : {};
      modeCounts[modeKey] = (Number(modeCounts[modeKey]) || 0) + 1;

      state.wrongNote[key] = {
        wrongCount: (prevWrong && prevWrong.wrongCount ? prevWrong.wrongCount : 0) + 1,
        lastWrongDate: today,
        lastWrongMode: modeKey,
        wrongModes,
        modeCounts,
        sourceType: isExam ? 'exam' : 'sample'
      };
    }

    // 오늘 학습 기록 및 연속 학습일(Streak) 갱신
    normalizeStreakForToday();
    if (!state.streak.todayStudiedIds.includes(wordId)) {
      state.streak.todayStudiedIds.push(wordId);
    }

    if (state.streak.lastStudyDate !== today) {
      const yesterday = addDays(today, -1);
      if (state.streak.lastStudyDate === yesterday) {
        state.streak.count += 1;
      } else {
        state.streak.count = 1;
      }
      state.streak.lastStudyDate = today;
    }

    // XP · 콤보 · 파밍 방지 처리 (DESIGN.md 2.1~2.3)
    const xp = awardXpForAnswer(key, isCorrect, modeKey);

    saveStateToStorage();
    evaluateBadges();
    updateGlobalBadges();

    return {
      wordId,
      isCorrect,
      stage: nextStage,
      intervalDays,
      nextReviewDate,
      mode: modeKey,
      xp
    };
  }

  // 기본 XP (DESIGN.md 2.1) — 카드 뒤집기 기출은 절반 버림 +7 (유보 7.1 확정)
  function getBaseXp(effectiveMode, isExam) {
    if (effectiveMode === 'flashcard') return isExam ? 7 : 5;
    if (effectiveMode === 'exam-blank' || effectiveMode === 'exam-meaning') return 15;
    return 10;
  }

  // 연속 정답 보너스 (DESIGN.md 2.2) — 카드 뒤집기에도 절반 규칙으로 인정 (유보 7.2 확정)
  function getComboBonus(combo, isFlashcard) {
    let bonus = 0;
    if (combo >= 10) bonus = 6;
    else if (combo >= 5) bonus = 4;
    else if (combo >= 3) bonus = 2;
    return isFlashcard ? bonus / 2 : bonus;
  }

  function awardXpForAnswer(key, isCorrect, effectiveMode) {
    const g = state.gamification;
    const result = {
      earned: 0, baseXp: 0, comboBonus: 0, combo: 0,
      capped: false, reduced: false, leveledUp: false, prevLevel: g.level, newLevel: g.level
    };
    normalizeGamificationForToday();

    if (!isCorrect) {
      state.quiz.sessionCombo = 0; // 오답/몰라요: 0 XP, 콤보 초기화
      return result;
    }

    state.quiz.sessionCombo += 1;
    const combo = state.quiz.sessionCombo;
    result.combo = combo;
    g.stats.totalCorrectAnswers += 1;
    if (combo > g.stats.maxCombo) g.stats.maxCombo = combo;

    const isExam = key.startsWith('exam-');
    const isFlash = effectiveMode === 'flashcard';
    const baseXp = getBaseXp(effectiveMode, isExam);
    const prevCount = g.dailyXpGuard.wordCounts[key] || 0;
    result.baseXp = baseXp;

    if (prevCount === 0) {
      result.comboBonus = getComboBonus(combo, isFlash);
      result.earned = baseXp + result.comboBonus;
    } else if (prevCount === 1) {
      result.earned = Math.max(1, Math.floor(baseXp * 0.2));
      result.reduced = true;
    } else {
      result.earned = 0;
      result.capped = true;
    }
    g.dailyXpGuard.wordCounts[key] = prevCount + 1;

    if (result.earned > 0) {
      g.totalXp += result.earned;
      g.weekly.xp += result.earned;
    }
    const newLevel = getLevelFromXp(g.totalXp);
    result.prevLevel = g.level;
    result.newLevel = newLevel;
    if (newLevel > g.level) {
      result.leveledUp = true;
      g.level = newLevel;
    }
    state.quiz.sessionXp += result.earned;
    return result;
  }

  // --- 발음 재생 (브라우저 내장 speechSynthesis 전용) ---
  function speakEnglish(text, activeCardEl) {
    if (!('speechSynthesis' in window)) {
      showToast('이 브라우저는 음성 합성(speechSynthesis)을 지원하지 않습니다.');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.92;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const enVoice =
        voices.find((v) => v.lang === 'en-US' && v.localService) ||
        voices.find((v) => v.lang && v.lang.startsWith('en'));
      if (enVoice) {
        utterance.voice = enVoice;
      }

      document.querySelectorAll('.word-card.speaking').forEach((el) => {
        el.classList.remove('speaking');
      });

      if (activeCardEl) {
        activeCardEl.classList.add('speaking');
        const clearHighlight = () => activeCardEl.classList.remove('speaking');
        utterance.onend = clearHighlight;
        utterance.onerror = clearHighlight;
      }

      window.speechSynthesis.speak(utterance);
      showToast(`🔊 발음 재생: "${text}"`);
    } catch (err) {
      showToast('발음 재생 중 오류가 발생했습니다.');
    }
  }

  // --- 토스트 알림 ---
  let toastTimer = null;
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    container.innerHTML = `<div class="toast-msg">${escapeHtml(message)}</div>`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      container.innerHTML = '';
    }, 2200);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  // --- 상단/하단 글로벌 배지 갱신 ---
  function updateGlobalBadges() {
    normalizeStreakForToday();
    const streakCount = state.streak.count;
    const headerStreak = document.getElementById('header-streak-text');
    if (headerStreak) {
      headerStreak.textContent = `${streakCount}일 연속`;
    }

    const levelText = document.getElementById('header-level-text');
    if (levelText) {
      levelText.textContent = `Lv.${state.gamification.level} · ${state.gamification.totalXp} XP`;
    }

    const wrongCount = getWrongWords().length;
    const wrongBadge = document.getElementById('nav-wrong-badge');
    if (wrongBadge) {
      wrongBadge.textContent = String(wrongCount);
      wrongBadge.classList.toggle('hidden', wrongCount === 0);
    }
  }

  // --- 화면 전환 ---
  function switchView(viewName) {
    state.currentView = viewName;
    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `view-${viewName}`);
    });
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.navTarget === viewName);
    });

    updateGlobalBadges();

    if (viewName === 'home') {
      renderHomeView();
    } else if (viewName === 'wordbook') {
      renderWordbookView();
    } else if (viewName === 'quiz') {
      if (state.quiz.queue.length === 0) {
        initQuizSession(state.quiz.mode, state.quiz.scope);
      } else {
        renderQuizView();
      }
    } else if (viewName === 'wrong') {
      renderWrongNoteView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- 1. 홈 화면 렌더링 ---
  function renderHomeView() {
    const today = getTodayStr();
    const allWords = [...state.words, ...state.examWords];
    const dueWords = getDueWords();
    const newWords = getNewWords();
    const totalWords = allWords.length;
    const learnedCount = totalWords - newWords.length;
    const scheduledFutureCount = learnedCount - dueWords.length;
    const todayStudiedCount = state.streak.todayStudiedIds.length;

    const dateBadge = document.getElementById('home-date-badge');
    if (dateBadge) {
      dateBadge.textContent = `학습 기준일 · ${formatKoreanShortDate(today)}`;
    }

    const greetingTitle = document.getElementById('home-greeting-title');
    if (greetingTitle) {
      if (dueWords.length > 0) {
        greetingTitle.textContent = `오늘 복습할 단어가 ${dueWords.length}개 있습니다`;
      } else if (newWords.length > 0) {
        greetingTitle.textContent = `오늘의 복습 완료! 새 단어 ${newWords.length}개를 학습해 보세요`;
      } else {
        greetingTitle.textContent = `오늘 예정된 모든 단어 복습을 마쳤습니다!`;
      }
    }

    document.getElementById('stat-due-count').textContent = String(dueWords.length);
    document.getElementById('stat-due-sub').textContent =
      scheduledFutureCount > 0
        ? `예정된 복습 ${scheduledFutureCount}개`
        : '오늘 복습 대상';

    document.getElementById('stat-new-count').textContent = String(newWords.length);
    document.getElementById('stat-learned-sub').textContent = `학습 경험 ${learnedCount}/${totalWords}개`;

    document.getElementById('stat-streak-count').textContent = `${state.streak.count}일`;
    document.getElementById('stat-today-done').textContent = `오늘 ${todayStudiedCount}개 학습`;

    const startBtnText = document.getElementById('btn-hero-start-text');
    if (startBtnText) {
      if (dueWords.length > 0) {
        startBtnText.textContent = `오늘 복습할 단어 ${dueWords.length}개 퀴즈 시작하기`;
      } else if (newWords.length > 0) {
        startBtnText.textContent = `새 단어 학습 퀴즈 시작하기 (${newWords.length}개)`;
      } else {
        startBtnText.textContent = `전체 단어 복습 퀴즈 시작하기 (${totalWords}개)`;
      }
    }

    // 간격반복 단계별 단어 수 집계 (기본 단어 + 기출 다의어 전체 연동)
    const stageCounts = [0, 0, 0, 0, 0];
    allWords.forEach((w) => {
      const rec = getWordSrs(w.id);
      if (!rec || !rec.stage) {
        stageCounts[0] += 1;
      } else {
        const idx = Math.min(Math.max(rec.stage, 0), 4);
        stageCounts[idx] += 1;
      }
    });

    for (let s = 0; s <= 4; s++) {
      const el = document.getElementById(`srs-count-${s}`);
      if (el) el.textContent = String(stageCounts[s]);
    }

    renderLevelProgress();
    renderLeagueCard();
    renderBadgeCollection();

    const simDisplay = document.getElementById('sim-date-display');
    if (simDisplay) {
      const offset = state.streak.dayOffset || 0;
      simDisplay.textContent =
        offset === 0
          ? `기준일: ${today} (오늘)`
          : `기준일: ${today} (+${offset}일 경과 시뮬레이션 중)`;
    }
  }

  // 홈 히어로 카드 레벨 프로그레스 바 (DESIGN.md 2.5-2)
  function renderLevelProgress() {
    const box = document.getElementById('home-level-progress');
    if (!box) return;
    const prog = getLevelProgress(state.gamification.totalXp);
    box.innerHTML = `
      <div class="level-progress-head">
        <strong>Lv.${prog.level}</strong>
        <span>현재 구간 ${prog.cur} / ${prog.span} XP (${prog.pct}%)</span>
      </div>
      <div class="level-progress-track" aria-hidden="true">
        <div class="level-progress-fill" style="width: ${prog.pct}%;"></div>
      </div>
    `;
  }

  // --- 2. 단어장 화면 렌더링 ---
  function getSrsBadgeMeta(wordId) {
    const rec = getWordSrs(wordId);
    if (!rec) {
      return { text: '미학습', cls: '' };
    }
    const today = getTodayStr();
    if (rec.nextReviewDate <= today) {
      return {
        text: `오늘 복습 대상 (${rec.intervalDays}일 주기)`,
        cls: 'due'
      };
    }
    return {
      text: `${rec.intervalDays}일 간격 · ${formatKoreanShortDate(rec.nextReviewDate)} 복습 예정`,
      cls: 'scheduled'
    };
  }

  function switchWordbookTab(tabName) {
    state.wordbookTab = tabName === 'exam' ? 'exam' : 'sample';
    document.querySelectorAll('[data-wordbook-tab]').forEach((btn) => {
      const isActive = btn.dataset.wordbookTab === state.wordbookTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const sampleFilters = document.getElementById('wordbook-sample-filters');
    const examFilters = document.getElementById('wordbook-exam-filters');
    if (sampleFilters) {
      sampleFilters.classList.toggle('hidden', state.wordbookTab !== 'sample');
    }
    if (examFilters) {
      examFilters.classList.toggle('hidden', state.wordbookTab !== 'exam');
    }

    renderWordbookView();
  }

  function renderExamWordCard(w, options) {
    const opts = options || {};
    const srsMeta = getSrsBadgeMeta(w.id);
    const wrongInfo = state.wrongNote[String(w.id)];
    const isWrong = Boolean(wrongInfo);

    const hasBaseMeaning =
      w.base_meaning_ko !== null &&
      w.base_meaning_ko !== undefined &&
      String(w.base_meaning_ko).trim() !== '';

    const meaningsItemsHtml = Array.isArray(w.exam_meanings)
      ? w.exam_meanings
          .map((m) => {
            if (!m) return '';
            const hasMeaning =
              m.meaning_ko !== null &&
              m.meaning_ko !== undefined &&
              String(m.meaning_ko).trim() !== '';
            const hasPct = m.share_pct !== null && m.share_pct !== undefined;
            const hasSignal =
              m.signal !== null &&
              m.signal !== undefined &&
              String(m.signal).trim() !== '';

            if (!hasMeaning && !hasPct && !hasSignal) return '';

            return `
              <li class="exam-meaning-item">
                ${
                  hasMeaning || hasPct
                    ? `
                  <div class="exam-meaning-main">
                    ${hasMeaning ? `<span class="exam-meaning-ko">${escapeHtml(m.meaning_ko)}</span>` : ''}
                    ${hasPct ? `<span class="exam-meaning-pct">${escapeHtml(m.share_pct)}%</span>` : ''}
                  </div>
                `
                    : ''
                }
                ${hasSignal ? `<div class="exam-meaning-sig">신호: ${escapeHtml(m.signal)}</div>` : ''}
              </li>
            `;
          })
          .join('')
      : '';

    const hasWordSignal =
      w.signal !== null &&
      w.signal !== undefined &&
      String(w.signal).trim() !== '';

    const hasSourceNote =
      w.source_note !== null &&
      w.source_note !== undefined &&
      String(w.source_note).trim() !== '';

    const hasExampleEn =
      w.example_en !== null &&
      w.example_en !== undefined &&
      String(w.example_en).trim() !== '';

    const hasExampleKo =
      w.example_ko !== null &&
      w.example_ko !== undefined &&
      String(w.example_ko).trim() !== '';

    const wrongBadgesHtml = opts.wrongBadgesHtml
      ? opts.wrongBadgesHtml
      : isWrong
      ? renderWrongModeBadges(wrongInfo, true, true)
      : '';

    return `
      <article class="word-card exam-word-card" data-word-id="${escapeHtml(w.id)}" data-speak-word="${escapeHtml(w.word)}" tabindex="0" role="button" aria-label="${escapeHtml(w.word)} 발음 듣기">
        <div class="word-card-top">
          <div class="word-title-group">
            <span class="word-en">${escapeHtml(w.word)}</span>
            ${w.grade ? `<span class="grade-badge grade-${escapeHtml(w.grade)}">${escapeHtml(w.grade)}급</span>` : ''}
            ${hasSourceNote ? `<span class="source-badge">출처: ${escapeHtml(w.source_note)}</span>` : ''}
            ${wrongBadgesHtml}
          </div>
          <button class="speak-btn" type="button" data-action="speak-word" data-speak-text="${escapeHtml(w.word)}" aria-label="${escapeHtml(w.word)} 단어 발음 재생">
            <span aria-hidden="true">🔊</span>
            <span>발음</span>
          </button>
        </div>

        ${
          hasBaseMeaning
            ? `
          <div class="exam-base-meaning">
            <span class="exam-base-tag">기본 뜻</span>
            <span class="exam-base-text">${escapeHtml(w.base_meaning_ko)}</span>
          </div>
        `
            : ''
        }

        ${
          meaningsItemsHtml
            ? `
          <div class="exam-meanings-section">
            <div class="exam-meanings-header">
              <span class="exam-meanings-title">시험에서는 이 뜻</span>
            </div>
            <ul class="exam-meanings-list">
              ${meaningsItemsHtml}
            </ul>
          </div>
        `
            : ''
        }

        ${
          hasWordSignal
            ? `
          <div class="exam-word-signal">
            <span class="exam-word-signal-label">💡 판단 신호</span>
            <p class="exam-word-signal-body">${escapeHtml(w.signal)}</p>
          </div>
        `
            : ''
        }

        ${
          hasExampleEn || hasExampleKo || hasSourceNote
            ? `
          <div class="word-example-box exam-example-box">
            ${hasExampleEn ? `<p class="word-example-en">${escapeHtml(w.example_en)}</p>` : ''}
            ${hasExampleKo ? `<p class="word-example-ko">${escapeHtml(w.example_ko)}</p>` : ''}
            ${hasSourceNote ? `<div class="exam-example-source">기출 출처: ${escapeHtml(w.source_note)}</div>` : ''}
          </div>
        `
            : ''
        }

        <div class="word-card-footer">
          <span class="srs-tag ${srsMeta.cls}">${escapeHtml(srsMeta.text)}</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${
              hasExampleEn
                ? `
              <button class="mini-btn" type="button" data-action="speak-sentence" data-speak-text="${escapeHtml(w.example_en)}">
                🔊 예문 듣기
              </button>
            `
                : ''
            }
            ${
              opts.showRemoveWrongBtn
                ? `
              <button class="mini-btn" type="button" data-action="remove-wrong" data-word-id="${escapeHtml(w.id)}">
                ✓ 암기 완료 (노트에서 제거)
              </button>
            `
                : ''
            }
          </div>
        </div>
      </article>
    `;
  }

  function renderWordbookView() {
    const listEl = document.getElementById('wordbook-list');
    if (!listEl) return;

    const query = state.wordbookSearch.trim().toLowerCase();

    // 기출 다의어 (40개) 탭 렌더링 — 기존 샘플 24개와 절대 섞지 않음
    if (state.wordbookTab === 'exam') {
      const filteredExam = state.examWords.filter((w) => {
        if (state.examWordbookFilter === 'due') {
          if (!isWordDueToday(w.id)) return false;
        } else if (state.examWordbookFilter === 'S' || state.examWordbookFilter === 'A') {
          if (w.grade !== state.examWordbookFilter) return false;
        }

        if (query) {
          const matchWord = w.word.toLowerCase().includes(query);
          const matchBase = w.base_meaning_ko && w.base_meaning_ko.toLowerCase().includes(query);
          const matchMeanings =
            Array.isArray(w.exam_meanings) &&
            w.exam_meanings.some(
              (m) =>
                m &&
                m.meaning_ko !== null &&
                m.meaning_ko !== undefined &&
                String(m.meaning_ko).trim() !== '' &&
                (m.meaning_ko.toLowerCase().includes(query) ||
                  (m.signal && m.signal.toLowerCase().includes(query)))
            );
          const matchSignal = w.signal && w.signal.toLowerCase().includes(query);
          const matchExEn = w.example_en && w.example_en.toLowerCase().includes(query);
          const matchExKo = w.example_ko && w.example_ko.toLowerCase().includes(query);
          const matchSource = w.source_note && w.source_note.toLowerCase().includes(query);
          return Boolean(
            matchWord ||
              matchBase ||
              matchMeanings ||
              matchSignal ||
              matchExEn ||
              matchExKo ||
              matchSource
          );
        }
        return true;
      });

      if (filteredExam.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <p class="empty-title">조건에 맞는 기출 다의어가 없습니다</p>
            <p class="empty-desc">검색어나 등급 필터(전체 / S급 / A급)를 변경해 보세요.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = filteredExam.map((w) => renderExamWordCard(w)).join('');
      return;
    }

    // 기본 샘플 단어장 (24개) 탭 렌더링
    const filtered = state.words.filter((w) => {
      if (state.wordbookFilter === 'due') {
        if (!isWordDueToday(w.id)) return false;
      } else if (state.wordbookFilter !== 'all') {
        if (w.level !== state.wordbookFilter) return false;
      }

      if (query) {
        const matchWord = w.word.toLowerCase().includes(query);
        const matchMeaning = w.meaning_ko.toLowerCase().includes(query);
        const matchEx = w.example_en.toLowerCase().includes(query);
        return matchWord || matchMeaning || matchEx;
      }
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p class="empty-title">조건에 맞는 단어가 없습니다</p>
          <p class="empty-desc">검색어나 난이도 필터를 변경해 보세요.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map((w) => {
        const srsMeta = getSrsBadgeMeta(w.id);
        const wrongInfo = state.wrongNote[String(w.id)];
        return `
          <article class="word-card" data-word-id="${w.id}" data-speak-word="${escapeHtml(w.word)}" tabindex="0" role="button" aria-label="${escapeHtml(w.word)} 발음 듣기">
            <div class="word-card-top">
              <div class="word-title-group">
                <span class="word-en">${escapeHtml(w.word)}</span>
                <span class="word-pos">${escapeHtml(w.pos)}</span>
                <span class="level-badge level-${escapeHtml(w.level)}">${escapeHtml(w.level)}</span>
                ${wrongInfo ? renderWrongModeBadges(wrongInfo, false, true) : ''}
              </div>
              <button class="speak-btn" type="button" data-action="speak-word" data-speak-text="${escapeHtml(w.word)}" aria-label="${escapeHtml(w.word)} 단어 발음 재생">
                <span aria-hidden="true">🔊</span>
                <span>발음</span>
              </button>
            </div>

            <p class="word-meaning">${escapeHtml(w.meaning_ko)}</p>

            <div class="word-example-box">
              <p class="word-example-en">${escapeHtml(w.example_en)}</p>
              <p class="word-example-ko">${escapeHtml(w.example_ko)}</p>
            </div>

            <div class="word-card-footer">
              <span class="srs-tag ${srsMeta.cls}">${escapeHtml(srsMeta.text)}</span>
              <button class="mini-btn" type="button" data-action="speak-sentence" data-speak-text="${escapeHtml(w.example_en)}">
                🔊 예문 듣기
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // --- 3. 퀴즈 (기본 3종 + 기출 모드 2종) ---
  function isExamQuizMode(mode) {
    return mode === 'exam-blank' || mode === 'exam-meaning';
  }

  function getExamContextMeaningObj(wordObj) {
    if (!wordObj || !Array.isArray(wordObj.exam_meanings)) {
      return { meaning_ko: '', share_pct: null, signal: null };
    }
    const idx = wordObj.context_meaning_index;
    if (
      typeof idx === 'number' &&
      wordObj.exam_meanings[idx] &&
      wordObj.exam_meanings[idx].meaning_ko
    ) {
      return wordObj.exam_meanings[idx];
    }
    const firstValid = wordObj.exam_meanings.find((m) => m && m.meaning_ko);
    return firstValid || { meaning_ko: '', share_pct: null, signal: null };
  }

  function findWordById(wordId) {
    const key = String(wordId);
    return (
      state.words.find((w) => String(w.id) === key) ||
      state.examWords.find((w) => String(w.id) === key) ||
      null
    );
  }

  function getEffectiveQuestionMode(quizMode, wordObj) {
    const isExamWord = Boolean(wordObj && wordObj.isExam);
    if (quizMode === 'flashcard') {
      return 'flashcard';
    }
    if (isExamWord) {
      if (quizMode === 'meaning' || quizMode === 'exam-meaning') {
        return 'exam-meaning';
      }
      return 'exam-blank';
    }
    if (quizMode === 'blank' || quizMode === 'exam-blank') {
      return 'blank';
    }
    return 'meaning';
  }

  function syncQuizScopeSelect(mode, requestedScope) {
    const scopeSelect = document.getElementById('quiz-scope-select');
    if (!scopeSelect) return requestedScope || 'today';

    if (isExamQuizMode(mode)) {
      const validExamScopes = ['today', 'all', 'S', 'A', 'wrong'];
      const nextScope = validExamScopes.includes(requestedScope) ? requestedScope : 'today';
      scopeSelect.innerHTML = `
        <option value="today">오늘 복습 + 미학습 단어 (샘플+기출 통합)</option>
        <option value="all">전체 기출 다의어 40개</option>
        <option value="S">S급 기출 다의어 (14개)</option>
        <option value="A">A급 기출 다의어 (26개)</option>
        <option value="wrong">오답노트 기출 단어만</option>
      `;
      scopeSelect.value = nextScope;
      return nextScope;
    }

    const validSampleScopes = ['today', 'all', 'wrong'];
    const nextScope = validSampleScopes.includes(requestedScope) ? requestedScope : 'today';
    scopeSelect.innerHTML = `
      <option value="today">오늘 복습 + 미학습 단어 (샘플+기출 통합)</option>
      <option value="all">전체 단어 24개</option>
      <option value="wrong">오답노트 단어만</option>
    `;
    scopeSelect.value = nextScope;
    return nextScope;
  }

  function buildQuizQueue(scope, mode) {
    // 복습 시작(today) 시 홈 화면 '오늘 복습할 단어 N개'와 일치하도록 샘플+기출 통합 출제
    if (scope === 'today') {
      const dueAll = getDueWords();
      if (dueAll.length > 0) {
        return shuffleArray(dueAll);
      }
      const unseenAll = getNewWords();
      if (unseenAll.length > 0) {
        return shuffleArray(unseenAll);
      }
      return shuffleArray([...state.words, ...state.examWords]);
    }

    if (isExamQuizMode(mode)) {
      if (scope === 'wrong') {
        return shuffleArray(getWrongExamWords());
      }
      if (scope === 'S' || scope === 'A') {
        return shuffleArray(state.examWords.filter((w) => w.grade === scope));
      }
      return shuffleArray(state.examWords);
    }

    if (scope === 'wrong') {
      return shuffleArray(getWrongSampleWords());
    }
    return shuffleArray(state.words);
  }

  function initQuizSession(mode, scope) {
    state.quiz.mode = mode || state.quiz.mode || 'meaning';
    state.quiz.scope = syncQuizScopeSelect(state.quiz.mode, scope || state.quiz.scope || 'today');
    state.quiz.queue = buildQuizQueue(state.quiz.scope, state.quiz.mode);
    state.quiz.currentIndex = 0;
    state.quiz.answered = false;
    state.quiz.flipped = false;
    state.quiz.results = [];
    state.quiz.sessionCombo = 0;
    state.quiz.sessionXp = 0;
    state.quiz.sessionStartLevel = state.gamification.level;
    state.quiz.completionRecorded = false;

    // 탭 UI 동기화
    document.querySelectorAll('.quiz-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.quizMode === state.quiz.mode);
    });

    prepareCurrentQuestionChoices();
    renderQuizView();
  }

  // 빈칸 퀴즈 오답 보기 선별 — 빈칸에 넣었을 때 문법적·의미적으로 문장이 성립하지 않는 오답 보기 풀
  const SAMPLE_BLANK_SAFE_DISTRACTORS = {
    abandon: ['adapt', 'collaborate', 'compel', 'contribute', 'advocate'],
    accommodate: ['adapt', 'collaborate', 'advocate', 'contribute', 'acknowledge'],
    accurate: ['ambiguous', 'conventional', 'inevitable', 'deliberate'],
    acknowledge: ['collaborate', 'compel', 'contribute', 'adapt', 'advocate'],
    adapt: ['abandon', 'accommodate', 'acknowledge', 'advocate', 'anticipate', 'compel'],
    adequate: ['ambiguous', 'apparent', 'comprehensive', 'conventional', 'deliberate', 'inevitable', 'accurate'],
    advocate: ['collaborate', 'adapt', 'accommodate', 'compel', 'contribute', 'diminish'],
    ambiguous: ['accurate', 'apparent', 'adequate', 'consistent', 'inevitable', 'crucial', 'deliberate'],
    anticipate: ['collaborate', 'adapt', 'advocate', 'contribute', 'compel'],
    apparent: ['accurate', 'adequate', 'comprehensive', 'consistent', 'conventional', 'deliberate'],
    candidate: ['capacity', 'consequence', 'collaborate', 'ambiguous', 'inevitable'],
    capacity: ['candidate', 'consequence', 'collaborate', 'ambiguous', 'inevitable'],
    collaborate: ['abandon', 'accommodate', 'acknowledge', 'advocate', 'anticipate', 'compel', 'decline', 'diminish'],
    compel: ['collaborate', 'adapt', 'advocate', 'acknowledge', 'anticipate', 'contribute', 'decline', 'diminish'],
    comprehensive: ['ambiguous', 'apparent', 'inevitable', 'deliberate'],
    consequence: ['candidate', 'capacity', 'collaborate', 'compel', 'adapt'],
    consistent: ['ambiguous', 'apparent', 'inevitable', 'accurate'],
    contribute: ['collaborate', 'compel', 'diminish', 'decline', 'abandon'],
    conventional: ['ambiguous', 'apparent', 'deliberate', 'accurate', 'inevitable'],
    crucial: ['ambiguous', 'apparent', 'accurate', 'inevitable'],
    decline: ['collaborate', 'adapt', 'compel', 'contribute', 'diminish'],
    deliberate: ['ambiguous', 'apparent', 'accurate', 'inevitable'],
    diminish: ['collaborate', 'adapt', 'advocate', 'compel', 'contribute'],
    inevitable: ['accurate', 'comprehensive', 'conventional', 'deliberate', 'ambiguous']
  };

  const EXAM_BLANK_SAFE_DISTRACTORS = {
    account: ['approach', 'base', 'sense', 'subject', 'term', 'view', 'population', 'nature'],
    approach: ['contribute', 'reflect', 'remain', 'follow', 'population', 'leave', 'term'],
    base: ['population', 'nature', 'movement', 'course', 'case', 'term', 'subject', 'sense', 'remain', 'result'],
    lead: ['population', 'nature', 'case', 'course', 'term', 'sense', 'view', 'practice', 'order', 'account'],
    leave: ['term', 'sense', 'case', 'course', 'nature', 'population', 'movement', 'remain', 'matter'],
    matter: ['term', 'subject', 'case', 'course', 'nature', 'population', 'movement', 'field', 'approach', 'order'],
    order: ['contribute', 'reflect', 'remain', 'conduct', 'follow', 'concern', 'figure', 'draw', 'lead', 'leave', 'matter', 'present', 'account'],
    practice: ['contribute', 'reflect', 'remain', 'follow', 'population', 'leave', 'turn', 'present', 'base'],
    present: ['contribute', 'remain', 'result', 'matter', 'account', 'turn', 'lead', 'population', 'course', 'movement'],
    sense: ['contribute', 'reflect', 'remain', 'conduct', 'follow', 'address', 'concern', 'figure', 'draw', 'leave', 'lead', 'turn', 'base', 'present'],
    subject: ['term', 'order', 'practice', 'view', 'sense', 'base', 'approach', 'account', 'turn', 'lead', 'leave', 'matter', 'course', 'field'],
    term: ['contribute', 'reflect', 'remain', 'conduct', 'follow', 'address', 'concern', 'figure', 'draw', 'leave', 'lead', 'turn', 'base', 'present'],
    turn: ['term', 'subject', 'sense', 'view', 'order', 'practice', 'approach', 'account', 'base', 'case', 'course', 'nature', 'population'],
    view: ['contribute', 'reflect', 'remain', 'conduct', 'follow', 'address', 'figure', 'draw', 'leave', 'lead', 'turn', 'base', 'present', 'population'],
    address: ['population', 'nature', 'course', 'case', 'movement', 'field', 'remain', 'result', 'matter', 'contribute', 'function'],
    case: ['contribute', 'reflect', 'remain', 'conduct', 'follow', 'address', 'figure', 'draw', 'leave', 'lead', 'turn', 'base', 'present', 'produce'],
    concern: ['population', 'nature', 'course', 'case', 'movement', 'field', 'point', 'term', 'sense', 'remain', 'result', 'matter', 'contribute', 'function'],
    conduct: ['population', 'nature', 'course', 'case', 'movement', 'field', 'point', 'term', 'sense', 'remain', 'result', 'matter', 'contribute', 'function'],
    contribute: ['population', 'nature', 'case', 'course', 'movement', 'field', 'term', 'sense', 'produce', 'reflect', 'follow', 'conduct', 'cover', 'address'],
    cover: ['population', 'nature', 'case', 'course', 'movement', 'field', 'point', 'remain', 'result', 'matter', 'contribute', 'function'],
    course: ['contribute', 'reflect', 'conduct', 'follow', 'address', 'concern', 'figure', 'draw', 'leave', 'lead'],
    draw: ['population', 'nature', 'case', 'course', 'movement', 'field', 'term', 'sense', 'produce', 'conduct', 'cover', 'address', 'contribute'],
    field: ['contribute', 'reflect', 'remain', 'conduct', 'follow', 'produce', 'cover', 'draw', 'leave', 'present'],
    figure: ['population', 'nature', 'case', 'course', 'movement', 'field', 'term', 'sense', 'contribute', 'remain', 'result', 'matter', 'reflect', 'conduct', 'concern'],
    follow: ['population', 'nature', 'case', 'course', 'movement', 'field', 'point', 'term', 'remain', 'result', 'matter', 'contribute', 'function'],
    force: ['population', 'nature', 'case', 'course', 'movement', 'field', 'term', 'sense', 'remain', 'result', 'matter', 'contribute', 'function', 'reflect'],
    form: ['population', 'nature', 'case', 'course', 'movement', 'field', 'point', 'term', 'remain', 'result', 'matter', 'contribute', 'function'],
    function: ['population', 'nature', 'case', 'course', 'movement', 'field', 'term', 'sense', 'contribute', 'result', 'matter', 'conduct', 'cover', 'address', 'follow', 'produce', 'reflect', 'concern'],
    mean: ['contribute', 'reflect', 'follow', 'present', 'conduct', 'concern', 'remain', 'result', 'matter'],
    movement: ['contribute', 'reflect', 'remain', 'follow', 'address', 'figure', 'draw', 'present', 'cover'],
    nature: ['contribute', 'reflect', 'conduct', 'follow', 'address', 'concern', 'figure', 'draw', 'leave', 'lead'],
    point: ['contribute', 'reflect', 'remain', 'conduct', 'follow', 'address', 'concern', 'figure', 'draw', 'leave', 'present', 'produce'],
    population: ['contribute', 'reflect', 'conduct', 'follow', 'address', 'draw', 'leave', 'present', 'cover'],
    process: ['population', 'nature', 'case', 'course', 'movement', 'field', 'point', 'term', 'remain', 'result', 'matter', 'contribute', 'function'],
    produce: ['contribute', 'reflect', 'follow', 'address', 'figure', 'draw', 'leave', 'lead', 'turn', 'base', 'present', 'cover'],
    project: ['population', 'nature', 'course', 'movement', 'field', 'remain', 'contribute', 'function', 'conduct', 'produce'],
    reflect: ['population', 'nature', 'case', 'course', 'movement', 'field', 'point', 'term', 'result', 'matter', 'contribute', 'function'],
    remain: ['contribute', 'reflect', 'follow', 'address', 'figure', 'leave', 'lead', 'turn', 'present', 'cover', 'conduct'],
    result: ['population', 'nature', 'case', 'course', 'movement', 'field', 'term', 'sense', 'conduct', 'address', 'cover', 'concern', 'contribute'],
    work: ['contribute', 'reflect', 'remain', 'conduct', 'follow', 'address', 'draw', 'leave', 'present', 'cover']
  };

  function wordAppearsInSentence(word, sentence) {
    if (!word || !sentence) return false;
    const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}[a-z]*\\b`, 'i').test(String(sentence));
  }

  function selectBlankDistractors(currentWord, pool, isExam) {
    const sentence = currentWord.example_en || '';
    const safeNames = isExam
      ? EXAM_BLANK_SAFE_DISTRACTORS[currentWord.word] || []
      : SAMPLE_BLANK_SAFE_DISTRACTORS[currentWord.word] || [];
    const safeSet = new Set(safeNames);

    // 1차 필터: 정답 자신 제외 + 예문 내 이미 등장하는 단어(파생·굴절 포함) 제외
    const nonOccurring = pool.filter(
      (w) =>
        w.id !== currentWord.id &&
        w.word !== currentWord.word &&
        !wordAppearsInSentence(w.word, sentence)
    );

    // 2차 필터: 문장 빈칸에 넣었을 때 문법적·의미적으로 성립하지 않음이 검증된 안전 오답 풀 우선 선택
    const verifiedSafe = nonOccurring.filter((w) => safeSet.has(w.word));

    if (isExam) {
      const sameGradeSafe = shuffleArray(verifiedSafe.filter((w) => w.grade === currentWord.grade));
      const diffGradeSafe = shuffleArray(verifiedSafe.filter((w) => w.grade !== currentWord.grade));
      const fallback = shuffleArray(nonOccurring.filter((w) => !safeSet.has(w.word)));
      return [...sameGradeSafe, ...diffGradeSafe, ...fallback].slice(0, 3);
    }

    const samePosSafe = shuffleArray(verifiedSafe.filter((w) => w.pos === currentWord.pos));
    const diffPosSafe = shuffleArray(verifiedSafe.filter((w) => w.pos !== currentWord.pos));
    const fallback = shuffleArray(nonOccurring.filter((w) => !safeSet.has(w.word)));
    return [...samePosSafe, ...diffPosSafe, ...fallback].slice(0, 3);
  }

  // 문맥 속 뜻 퀴즈(exam-meaning) 보기 중복·유사(포함 관계) 판별 헬퍼
  function normalizeMeaningText(text) {
    if (!text) return '';
    return String(text)
      .replace(/\([^)]*\)/g, '')
      .replace(/~/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getMeaningTokens(text) {
    const norm = normalizeMeaningText(text);
    if (!norm) return [];
    return norm
      .split(/[·,/]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function isOverlappingMeaning(a, b) {
    if (!a || !b) return false;
    const rawA = String(a).trim();
    const rawB = String(b).trim();
    if (!rawA || !rawB) return false;
    if (rawA === rawB) return true;

    const normA = normalizeMeaningText(rawA);
    const normB = normalizeMeaningText(rawB);
    if (!normA || !normB) return false;
    if (normA === normB) return true;

    const noSpaceA = normA.replace(/\s+/g, '');
    const noSpaceB = normB.replace(/\s+/g, '');
    if (
      noSpaceA.length >= 2 &&
      noSpaceB.length >= 2 &&
      (noSpaceA.includes(noSpaceB) || noSpaceB.includes(noSpaceA))
    ) {
      return true;
    }

    const tokensA = getMeaningTokens(rawA);
    const tokensB = getMeaningTokens(rawB);
    for (const ta of tokensA) {
      const cleanA = ta.replace(/\s+/g, '');
      const stemA = cleanA.replace(/하다$/, '');
      if (!cleanA) continue;
      for (const tb of tokensB) {
        const cleanB = tb.replace(/\s+/g, '');
        const stemB = cleanB.replace(/하다$/, '');
        if (!cleanB) continue;
        if (cleanA === cleanB) return true;
        if (stemA && stemB && stemA === stemB) return true;
        if (
          cleanA.length >= 2 &&
          cleanB.length >= 2 &&
          (cleanA.includes(cleanB) || cleanB.includes(cleanA))
        ) {
          return true;
        }
        if (
          stemA.length >= 2 &&
          stemB.length >= 2 &&
          (stemA.includes(stemB) || stemB.includes(stemA))
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function prepareCurrentQuestionChoices() {
    const currentWord = state.quiz.queue[state.quiz.currentIndex];
    if (!currentWord) {
      state.quiz.choices = [];
      return;
    }

    state.quiz.answered = false;
    state.quiz.flipped = false;

    const mode = getEffectiveQuestionMode(state.quiz.mode, currentWord);

    if (mode === 'exam-blank') {
      // 기출 모드 유형 1 — 기출 예문 빈칸 (빈칸에 넣어도 문장이 성립하는 단어 배제)
      const distractors = selectBlankDistractors(currentWord, state.examWords, true);
      state.quiz.choices = shuffleArray([currentWord, ...distractors]);
      return;
    }

    if (mode === 'exam-meaning') {
      // 기출 모드 유형 2 — 문맥 속 뜻 (exam_meanings 중에서 고르되, 기본 뜻을 함정으로 포함)
      const correctEntry = getExamContextMeaningObj(currentWord);
      const meaningChoices = [];
      const hasOverlappingChoice = (candidateText) =>
        meaningChoices.some((c) => isOverlappingMeaning(c.meaning_ko, candidateText));

      if (correctEntry && correctEntry.meaning_ko) {
        meaningChoices.push({
          id: 'correct',
          meaning_ko: correctEntry.meaning_ko,
          share_pct: correctEntry.share_pct,
          signal: correctEntry.signal,
          isCorrect: true,
          isTrap: false
        });
      }

      // 기본 뜻(base_meaning_ko)이 존재하고 기존 보기와 중복·포함 관계가 아니면 함정 선택지로 포함
      if (
        currentWord.base_meaning_ko !== null &&
        currentWord.base_meaning_ko !== undefined &&
        String(currentWord.base_meaning_ko).trim() !== '' &&
        !hasOverlappingChoice(currentWord.base_meaning_ko)
      ) {
        meaningChoices.push({
          id: 'trap-base',
          meaning_ko: currentWord.base_meaning_ko,
          share_pct: null,
          signal: null,
          isCorrect: false,
          isTrap: true
        });
      }

      // 해당 단어의 다른 exam_meanings 추가 (포함·유사 의미 배제)
      const otherOwnMeanings = shuffleArray(
        (currentWord.exam_meanings || []).filter((m) => m && m.meaning_ko)
      );
      for (const m of otherOwnMeanings) {
        if (meaningChoices.length >= 4) break;
        if (hasOverlappingChoice(m.meaning_ko)) continue;
        meaningChoices.push({
          id: `own-${meaningChoices.length}`,
          meaning_ko: m.meaning_ko,
          share_pct: m.share_pct,
          signal: m.signal,
          isCorrect: false,
          isTrap: false
        });
      }

      // 만약 해당 단어 자체의 뜻 개수가 4개 미만이면 다른 기출 단어의 실제 exam_meanings에서 보충 (없는 뜻을 지어내지 않음)
      if (meaningChoices.length < 4) {
        const poolFromOtherExamWords = [];
        state.examWords.forEach((ew) => {
          if (ew.id === currentWord.id) return;
          (ew.exam_meanings || []).forEach((em) => {
            if (em && em.meaning_ko) {
              poolFromOtherExamWords.push(em.meaning_ko);
            }
          });
        });
        for (const extraMeaning of shuffleArray(poolFromOtherExamWords)) {
          if (meaningChoices.length >= 4) break;
          if (hasOverlappingChoice(extraMeaning)) continue;
          meaningChoices.push({
            id: `other-${meaningChoices.length}`,
            meaning_ko: extraMeaning,
            share_pct: null,
            signal: null,
            isCorrect: false,
            isTrap: false
          });
        }
      }

      state.quiz.choices = shuffleArray(meaningChoices);
      return;
    }

    if (mode === 'blank') {
      // 기본 퀴즈 (b) 예문 빈칸 (빈칸에 넣어도 문장이 성립하는 단어 배제)
      const distractors = selectBlankDistractors(currentWord, state.words, false);
      state.quiz.choices = shuffleArray([currentWord, ...distractors]);
      return;
    }

    const others = state.words.filter((w) => w.id !== currentWord.id);
    // 같은 품사를 우선 오답 보기로 섞어 변별력 향상
    const samePos = shuffleArray(others.filter((w) => w.pos === currentWord.pos));
    const diffPos = shuffleArray(others.filter((w) => w.pos !== currentWord.pos));
    const distractors = [...samePos, ...diffPos].slice(0, 3);

    state.quiz.choices = shuffleArray([currentWord, ...distractors]);
  }

  function maskWordInSentence(sentence, targetWord) {
    const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escaped}[a-z]*)\\b`, 'gi');
    const safeSentence = escapeHtml(sentence);
    if (regex.test(safeSentence)) {
      return safeSentence.replace(
        new RegExp(`\\b(${escaped}[a-z]*)\\b`, 'gi'),
        '<span class="blank-slot" data-original="$1">_______</span>'
      );
    }
    return `${safeSentence} (<span class="blank-slot" data-original="${escapeHtml(targetWord)}">_______</span>)`;
  }

  function highlightWordInSentence(sentence, targetWord) {
    const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeSentence = escapeHtml(sentence);
    const regex = new RegExp(`\\b(${escaped}[a-z]*)\\b`, 'gi');
    if (regex.test(safeSentence)) {
      return safeSentence.replace(
        new RegExp(`\\b(${escaped}[a-z]*)\\b`, 'gi'),
        '<mark class="exam-highlight-word">$1</mark>'
      );
    }
    return safeSentence;
  }

  function renderQuizView() {
    const container = document.getElementById('quiz-active-area');
    if (!container) return;

    const sessionMode = state.quiz.mode;
    const isExamSessionMode = isExamQuizMode(sessionMode);

    if (state.quiz.queue.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p class="empty-title">선택한 범위에 출제할 단어가 없습니다</p>
          <p class="empty-desc">${
            isExamSessionMode
              ? "기출 오답노트가 비어 있거나 해당 범위의 기출 단어가 없습니다. '전체 기출 다의어 40개'로 시작해 보세요."
              : "오답노트가 비어 있거나 모든 단어를 학습했습니다. 출제 범위를 '전체 단어 24개'로 변경해 보세요."
          }</p>
          <button class="primary-cta-btn" type="button" id="btn-Fallback-all-quiz" style="max-width: 280px; margin: 0 auto;">
            ${isExamSessionMode ? '전체 기출 40단어로 시작하기' : '전체 단어로 퀴즈 시작하기'}
          </button>
        </div>
      `;
      const fbBtn = document.getElementById('btn-Fallback-all-quiz');
      if (fbBtn) {
        fbBtn.addEventListener('click', () => initQuizSession(state.quiz.mode, 'all'));
      }
      return;
    }

    // 모든 문제를 다 푼 경우 결과 요약 화면 표시
    if (state.quiz.currentIndex >= state.quiz.queue.length) {
      renderQuizSummary(container);
      return;
    }

    const total = state.quiz.queue.length;
    const idx = state.quiz.currentIndex;
    const progressPct = Math.round(((idx + 1) / total) * 100);
    const wordObj = state.quiz.queue[idx];
    const mode = getEffectiveQuestionMode(sessionMode, wordObj);

    let questionBodyHtml = '';

    if (mode === 'exam-blank') {
      // 기출 모드 유형 1 — 기출 예문 빈칸 4지선다
      const maskedSentence = maskWordInSentence(wordObj.example_en, wordObj.word);
      const contextMeaningObj = getExamContextMeaningObj(wordObj);
      questionBodyHtml = `
        <div class="quiz-question-box">
          <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;">
            <span class="mode-badge exam-badge">기출 모드 · 유형 1 (예문 빈칸)</span>
            ${wordObj.grade ? `<span class="grade-badge grade-${escapeHtml(wordObj.grade)}">${escapeHtml(wordObj.grade)}급</span>` : ''}
            ${wordObj.source_note ? `<span class="source-badge">기출 ${escapeHtml(wordObj.source_note)}</span>` : ''}
            ${
              contextMeaningObj && contextMeaningObj.meaning_ko
                ? `<span style="font-size: 0.8rem; color: var(--text-secondary);">문맥 뜻: <strong>${escapeHtml(contextMeaningObj.meaning_ko)}</strong></span>`
                : ''
            }
          </div>
          <p class="quiz-blank-sentence">${maskedSentence}</p>
          ${wordObj.example_ko ? `<p class="quiz-blank-ko">${escapeHtml(wordObj.example_ko)}</p>` : ''}
        </div>
        <div class="choices-grid" role="group" aria-label="기출 예문 빈칸 4지선다 보기">
          ${state.quiz.choices
            .map(
              (choice, cIdx) => `
            <button class="choice-btn" type="button" data-choice-id="${escapeHtml(choice.id)}" id="quiz-choice-${cIdx + 1}">
              <span class="choice-num">${cIdx + 1}</span>
              <span style="font-family: var(--font-en); font-weight: 700;">${escapeHtml(choice.word)}</span>
              ${choice.grade ? `<span class="grade-badge grade-${escapeHtml(choice.grade)}" style="margin-left: auto;">${escapeHtml(choice.grade)}급</span>` : ''}
            </button>
          `
            )
            .join('')}
        </div>
      `;
    } else if (mode === 'exam-meaning') {
      // 기출 모드 유형 2 — 문맥 속 뜻 4지선다 (기본 뜻 함정 포함)
      const highlightedSentence = highlightWordInSentence(wordObj.example_en, wordObj.word);
      questionBodyHtml = `
        <div class="quiz-question-box">
          <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;">
            <span class="mode-badge exam-badge">기출 모드 · 유형 2 (문맥 속 뜻)</span>
            ${wordObj.grade ? `<span class="grade-badge grade-${escapeHtml(wordObj.grade)}">${escapeHtml(wordObj.grade)}급</span>` : ''}
            ${wordObj.source_note ? `<span class="source-badge">기출 ${escapeHtml(wordObj.source_note)}</span>` : ''}
          </div>
          <h3 class="quiz-target-word" style="font-size: 1.65rem; margin-bottom: 8px;">${escapeHtml(wordObj.word)}</h3>
          <p class="quiz-blank-sentence" style="margin-bottom: 8px;">${highlightedSentence}</p>
          <p style="font-size: 0.82rem; color: var(--text-muted);">
            위 기출 문장에서 <strong>${escapeHtml(wordObj.word)}</strong>가 어떤 뜻으로 쓰였는지 고르세요
            ${wordObj.base_meaning_ko ? `(기본 뜻 함정 주의!)` : ''}
          </p>
        </div>
        <div class="choices-grid" role="group" aria-label="문맥 속 뜻 4지선다 보기">
          ${state.quiz.choices
            .map(
              (choice, cIdx) => `
            <button class="choice-btn" type="button" data-choice-id="${escapeHtml(choice.id)}" data-is-trap="${choice.isTrap ? 'true' : 'false'}" id="quiz-choice-${cIdx + 1}">
              <span class="choice-num">${cIdx + 1}</span>
              <span>${escapeHtml(choice.meaning_ko)}</span>
            </button>
          `
            )
            .join('')}
        </div>
      `;
    } else if (mode === 'meaning') {
      // (a) 뜻 맞히기 4지선다
      questionBodyHtml = `
        <div class="quiz-question-box">
          <div style="margin-bottom: 6px;">
            <span class="word-pos">${escapeHtml(wordObj.pos)}</span>
            <span class="level-badge level-${escapeHtml(wordObj.level)}">${escapeHtml(wordObj.level)}</span>
          </div>
          <h3 class="quiz-target-word">${escapeHtml(wordObj.word)}</h3>
          <p style="font-size: 0.82rem; color: var(--text-muted);">위 영단어의 알맞은 한국어 뜻을 고르세요</p>
        </div>
        <div class="choices-grid" role="group" aria-label="한국어 뜻 4지선다 보기">
          ${state.quiz.choices
            .map(
              (choice, cIdx) => `
            <button class="choice-btn" type="button" data-choice-id="${choice.id}" id="quiz-choice-${cIdx + 1}">
              <span class="choice-num">${cIdx + 1}</span>
              <span>${escapeHtml(choice.meaning_ko)}</span>
            </button>
          `
            )
            .join('')}
        </div>
      `;
    } else if (mode === 'blank') {
      // (b) 예문 빈칸 채우기 4지선다
      const maskedSentence = maskWordInSentence(wordObj.example_en, wordObj.word);
      questionBodyHtml = `
        <div class="quiz-question-box">
          <div style="margin-bottom: 10px;">
            <span class="word-pos">${escapeHtml(wordObj.pos)}</span>
            <span class="level-badge level-${escapeHtml(wordObj.level)}">${escapeHtml(wordObj.level)}</span>
            <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 4px;">뜻 힌트: <strong>${escapeHtml(wordObj.meaning_ko)}</strong></span>
          </div>
          <p class="quiz-blank-sentence">${maskedSentence}</p>
          <p class="quiz-blank-ko">${escapeHtml(wordObj.example_ko)}</p>
        </div>
        <div class="choices-grid" role="group" aria-label="빈칸 영단어 4지선다 보기">
          ${state.quiz.choices
            .map(
              (choice, cIdx) => `
            <button class="choice-btn" type="button" data-choice-id="${choice.id}" id="quiz-choice-${cIdx + 1}">
              <span class="choice-num">${cIdx + 1}</span>
              <span style="font-family: var(--font-en); font-weight: 700;">${escapeHtml(choice.word)}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: auto;">${escapeHtml(choice.pos)}</span>
            </button>
          `
            )
            .join('')}
        </div>
      `;
    } else {
      // (c) 카드 뒤집기 자기 판정 (알아요 / 몰라요) — 샘플 단어 및 기출 다의어 통합 지원
      const isFlipped = state.quiz.flipped;
      const isExamCard = Boolean(wordObj.isExam);
      const cardMeaning = isExamCard
        ? getExamContextMeaningObj(wordObj).meaning_ko || ''
        : wordObj.meaning_ko || '';
      const cardMetaHtml = isExamCard
        ? `
          ${wordObj.grade ? `<span class="grade-badge grade-${escapeHtml(wordObj.grade)}">${escapeHtml(wordObj.grade)}급</span>` : ''}
          ${wordObj.source_note ? `<span class="source-badge">기출 ${escapeHtml(wordObj.source_note)}</span>` : ''}
        `
        : `
          <span class="word-pos">${escapeHtml(wordObj.pos)}</span>
          <span class="level-badge level-${escapeHtml(wordObj.level)}">${escapeHtml(wordObj.level)}</span>
        `;

      questionBodyHtml = `
        <div class="flashcard-container">
          <div class="flashcard-box ${isFlipped ? 'flipped' : ''}" id="flashcard-flip-box" role="button" tabindex="0" aria-label="플래시카드 뒤집기">
            <div>
              ${cardMetaHtml}
            </div>
            <h3 class="quiz-target-word" style="margin-top: 8px;">${escapeHtml(wordObj.word)}</h3>

            ${
              isFlipped
                ? `
              <div class="flashcard-back-details">
                <p class="flashcard-meaning">${escapeHtml(cardMeaning)}</p>
                ${
                  isExamCard && wordObj.base_meaning_ko
                    ? `<p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">기본 뜻: ${escapeHtml(wordObj.base_meaning_ko)}</p>`
                    : ''
                }
                <p class="word-example-en" style="margin-bottom: 4px;">"${escapeHtml(wordObj.example_en)}"</p>
                <p class="word-example-ko">${escapeHtml(wordObj.example_ko)}</p>
              </div>
            `
                : `
              <p class="flashcard-hint">👆 카드를 클릭하여 뜻과 예문을 확인한 뒤 판정하세요</p>
            `
            }
          </div>

          <div class="self-judge-row">
            <button class="judge-btn unknown" type="button" id="btn-judge-unknown" ${isFlipped ? '' : 'disabled'}>
              <span>몰라요 ✕</span>
              <span class="judge-sub">오답노트 저장 · 내일 재출제</span>
            </button>
            <button class="judge-btn known" type="button" id="btn-judge-known" ${isFlipped ? '' : 'disabled'}>
              <span>알아요 ○</span>
              <span class="judge-sub">간격 확대 (1→3→7→14일)</span>
            </button>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="quiz-progress-header">
        <span>문제 ${idx + 1} / ${total}</span>
        <span>정답 ${state.quiz.results.filter((r) => r.isCorrect).length}개</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" style="width: ${progressPct}%;"></div>
      </div>

      <div class="quiz-stage-card">
        <div class="quiz-prompt-top">
          <span class="srs-tag">${escapeHtml(getSrsBadgeMeta(wordObj.id).text)}</span>
          <button class="speak-btn" type="button" id="btn-quiz-speak" data-speak-text="${escapeHtml(wordObj.word)}">
            <span aria-hidden="true">🔊</span>
            <span>발음 듣기</span>
          </button>
        </div>

        ${questionBodyHtml}

        <div id="quiz-feedback-slot"></div>
      </div>
    `;

    // 이벤트 연결
    const speakBtn = document.getElementById('btn-quiz-speak');
    if (speakBtn) {
      speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakEnglish(wordObj.word);
      });
    }

    if (mode === 'meaning' || mode === 'blank' || mode === 'exam-blank' || mode === 'exam-meaning') {
      container.querySelectorAll('.choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (state.quiz.answered) return;
          const chosenId = btn.dataset.choiceId;
          handleMultipleChoiceAnswer(chosenId, btn);
        });
      });
    } else if (mode === 'flashcard') {
      const flipBox = document.getElementById('flashcard-flip-box');
      if (flipBox) {
        flipBox.addEventListener('click', () => {
          state.quiz.flipped = !state.quiz.flipped;
          renderQuizView();
        });
      }
      const btnUnknown = document.getElementById('btn-judge-unknown');
      const btnKnown = document.getElementById('btn-judge-known');
      if (btnUnknown) {
        btnUnknown.addEventListener('click', () => handleFlashcardJudge(false));
      }
      if (btnKnown) {
        btnKnown.addEventListener('click', () => handleFlashcardJudge(true));
      }
    }
  }

  function handleMultipleChoiceAnswer(chosenId, clickedBtn) {
    state.quiz.answered = true;
    const wordObj = state.quiz.queue[state.quiz.currentIndex];
    const mode = getEffectiveQuestionMode(state.quiz.mode, wordObj);
    const isExamMode = isExamQuizMode(mode);

    const correctChoiceId = mode === 'exam-meaning' ? 'correct' : String(wordObj.id);
    const isCorrect = String(chosenId) === correctChoiceId;

    // 빈칸 채우기 모드일 경우 모든 빈칸에 마스킹됐던 원문 굴절형 그대로 채워 넣기
    document.querySelectorAll('#quiz-active-area .blank-slot').forEach((slot) => {
      slot.textContent = slot.dataset.original || wordObj.word;
    });

    document.querySelectorAll('#quiz-active-area .choice-btn').forEach((btn) => {
      const cid = String(btn.dataset.choiceId);
      btn.disabled = true;
      if (cid === correctChoiceId) {
        btn.classList.add('correct');
      } else if (btn === clickedBtn && !isCorrect) {
        btn.classList.add('wrong');
      }
      if (mode === 'exam-meaning' && btn.dataset.isTrap === 'true') {
        const trapTag = document.createElement('span');
        trapTag.className = 'trap-pill';
        trapTag.textContent = '기본 뜻 함정';
        btn.appendChild(trapTag);
      }
    });

    const outcome = recordQuizAnswer(wordObj.id, isCorrect, mode);
    state.quiz.results.push(outcome);
    announceLevelUp(outcome.xp);

    const feedbackSlot = document.getElementById('quiz-feedback-slot');
    if (feedbackSlot) {
      const scheduleMsg = isCorrect
        ? `복습 간격 ${outcome.intervalDays}일 적용 (${formatKoreanShortDate(outcome.nextReviewDate)} 복습 예정)`
        : `오답노트 자동 저장 · 내일(${formatKoreanShortDate(outcome.nextReviewDate)}) 재출제`;

      const contextMeaningObj = isExamMode ? getExamContextMeaningObj(wordObj) : null;
      const targetMeaningText = isExamMode
        ? (contextMeaningObj && contextMeaningObj.meaning_ko) || ''
        : wordObj.meaning_ko || '';

      const clickedTrap = mode === 'exam-meaning' && clickedBtn && clickedBtn.dataset.isTrap === 'true';

      feedbackSlot.innerHTML = `
        <div class="quiz-feedback">
          <div class="feedback-header ${isCorrect ? 'correct' : 'wrong'}">
            <span>${
              isCorrect
                ? '정답입니다! 🎉'
                : `오답입니다 · 정답: ${escapeHtml(wordObj.word)} (${escapeHtml(targetMeaningText)})`
            }</span>
            ${renderXpGainPill(outcome.xp)}
          </div>
          ${renderXpCapNotice(outcome.xp)}
          ${
            clickedTrap && wordObj.base_meaning_ko
              ? `<p style="font-size: 0.8rem; color: var(--amber-primary); font-weight: 700; margin-bottom: 4px;">
                  ⚠️ 기본 뜻('${escapeHtml(wordObj.base_meaning_ko)}') 함정에 주의하세요! 이 기출 문장에서는 '${escapeHtml(targetMeaningText)}' 뜻으로 쓰였습니다.
                </p>`
              : ''
          }
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 4px;">
            <strong>예문:</strong> ${escapeHtml(wordObj.example_en)}
          </p>
          ${
            isExamMode && wordObj.example_ko
              ? `<p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">
                  <strong>해석:</strong> ${escapeHtml(wordObj.example_ko)}
                  ${wordObj.source_note ? `<span style="color: var(--text-muted);">(${escapeHtml(wordObj.source_note)} 기출)</span>` : ''}
                </p>`
              : ''
          }
          ${
            isExamMode && wordObj.signal
              ? `<p style="font-size: 0.78rem; color: var(--amber-primary); margin-bottom: 4px;">
                  <strong>💡 판단 신호:</strong> ${escapeHtml(wordObj.signal)}
                </p>`
              : ''
          }
          <p style="font-size: 0.78rem; color: var(--text-muted);">
            📅 간격반복(SRS): ${escapeHtml(scheduleMsg)}
          </p>
          <button class="next-question-btn" type="button" id="btn-next-question">
            ${state.quiz.currentIndex + 1 < state.quiz.queue.length ? '다음 문제 →' : '결과 확인하기 →'}
          </button>
        </div>
      `;

      const nextBtn = document.getElementById('btn-next-question');
      if (nextBtn) {
        nextBtn.addEventListener('click', advanceToNextQuestion);
      }
    }
  }

  // 정답 시 인라인 XP 피드백 (DESIGN.md 2.5-3)
  function renderXpGainPill(xp) {
    if (!xp || !xp.combo || xp.combo < 1) return '';
    const comboHtml = xp.comboBonus > 0
      ? `<span class="xp-combo-text">${xp.combo}연속 보너스 +${xp.comboBonus} XP</span>`
      : '';
    return `<span class="xp-gain-wrap"><span class="xp-gain-pill">+${xp.earned - xp.comboBonus} XP</span>${comboHtml}</span>`;
  }

  function renderXpCapNotice(xp) {
    if (!xp || !xp.capped) return '';
    return `<p class="xp-cap-notice">오늘 이미 충분한 XP를 획득한 단어입니다 (+0 XP)</p>`;
  }

  // 레벨업 연출 (DESIGN.md 2.5-4)
  function announceLevelUp(xp) {
    if (!xp || !xp.leveledUp) return;
    const pill = document.getElementById('header-level-badge');
    if (pill) {
      pill.classList.remove('pulse');
      void pill.offsetWidth;
      pill.classList.add('pulse');
    }
    showToast(`🎉 레벨 업! Lv.${xp.newLevel} 달성!`);
  }

  function handleFlashcardJudge(isKnown) {
    if (state.quiz.answered) return;
    if (!state.quiz.flipped) return; // 카드를 뒤집어 확인하기 전에는 판정 불가 (DESIGN.md 2.3-3)
    state.quiz.answered = true;
    const wordObj = state.quiz.queue[state.quiz.currentIndex];
    const outcome = recordQuizAnswer(wordObj.id, isKnown, 'flashcard');
    state.quiz.results.push(outcome);

    const xpMsg = isKnown
      ? outcome.xp.capped
        ? ' · 오늘 이미 충분한 XP를 획득한 단어입니다 (+0 XP)'
        : ` · +${outcome.xp.earned} XP${outcome.xp.comboBonus > 0 ? ` (${outcome.xp.combo}연속 보너스 +${outcome.xp.comboBonus})` : ''}`
      : '';
    showToast(
      isKnown
        ? `⭕ '알아요' 판정 → ${outcome.intervalDays}일 뒤 복습 예정${xpMsg}`
        : `❌ '몰라요' 판정 → 오답노트 저장 및 내일 재출제`
    );
    announceLevelUp(outcome.xp);

    advanceToNextQuestion();
  }

  function advanceToNextQuestion() {
    state.quiz.currentIndex += 1;
    if (state.quiz.currentIndex < state.quiz.queue.length) {
      prepareCurrentQuestionChoices();
    }
    renderQuizView();
  }

  function renderQuizSummary(container) {
    if (!state.quiz.completionRecorded) {
      state.quiz.completionRecorded = true;
      state.gamification.stats.completedSessions += 1;
      saveStateToStorage();
    }
    evaluateBadges();
    const levelUpBanner =
      state.gamification.level > state.quiz.sessionStartLevel
        ? `<div class="levelup-banner">🎉 레벨 업! <strong>Lv.${state.quiz.sessionStartLevel} → Lv.${state.gamification.level}</strong></div>`
        : '';
    const total = state.quiz.results.length;
    const correctCount = state.quiz.results.filter((r) => r.isCorrect).length;
    const wrongResults = state.quiz.results.filter((r) => !r.isCorrect);
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const currentModeLabel = getQuizModeLabel(state.quiz.mode);

    container.innerHTML = `
      <div class="quiz-stage-card" style="text-align: center;">
        ${levelUpBanner}
        <span class="hero-date-label">학습 세션 완료 · ${escapeHtml(currentModeLabel)}</span>
        <h3 class="hero-headline" style="margin-bottom: 14px;">
          총 ${total}문제 중 ${correctCount}문제 정답 (${accuracy}%)
        </h3>

        <div class="hero-stats-grid" style="margin-bottom: 18px;">
          <div class="stat-box highlight-due">
            <span class="stat-label">간격 확대(정답)</span>
            <strong class="stat-value">${correctCount}</strong>
            <span class="stat-sub">1→3→7→14일</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">내일 재출제(오답)</span>
            <strong class="stat-value" style="color: var(--danger-primary);">${wrongResults.length}</strong>
            <span class="stat-sub">오답노트 저장됨</span>
          </div>
          <div class="stat-box highlight-streak">
            <span class="stat-label">연속 학습일</span>
            <strong class="stat-value">${state.streak.count}일</strong>
            <span class="stat-sub">자동 기록 완료</span>
          </div>
        </div>
        <p class="session-xp-line">이번 세션 획득 <strong>+${state.quiz.sessionXp} XP</strong> · 현재 Lv.${state.gamification.level} (${state.gamification.totalXp} XP)</p>

        <div style="text-align: left; margin-bottom: 18px; max-height: 240px; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px;">
          ${state.quiz.results
            .map((res) => {
              const w = findWordById(res.wordId);
              if (!w) return '';
              const meaningLabel = w.isExam
                ? getExamContextMeaningObj(w).meaning_ko || ''
                : w.meaning_ko || '';
              const modeLabel = getQuizModeLabel(res.mode || state.quiz.mode);
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 4px; border-bottom: 1px solid var(--border-subtle); font-size: 0.82rem; gap: 8px; flex-wrap: wrap;">
                  <div>
                    <strong style="font-family: var(--font-en);">${escapeHtml(w.word)}</strong>
                    ${w.grade ? `<span class="grade-badge grade-${escapeHtml(w.grade)}" style="margin-left: 4px;">${escapeHtml(w.grade)}급</span>` : ''}
                    <span style="color: var(--text-secondary); margin-left: 6px;">${escapeHtml(meaningLabel)}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    ${
                      !res.isCorrect
                        ? `<span class="wrong-mode-badge ${w.isExam ? 'exam-mode' : 'basic-mode'}">${escapeHtml(modeLabel)} 오답</span>`
                        : ''
                    }
                    <span class="srs-tag ${res.isCorrect ? 'scheduled' : 'due'}">
                      ${res.isCorrect ? `+${res.intervalDays}일 (${formatKoreanShortDate(res.nextReviewDate)})` : '내일 재출제'}
                    </span>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${
            wrongResults.length > 0
              ? `
            <button class="primary-cta-btn" type="button" id="btn-summary-retry-wrong" style="background: var(--danger-primary);">
              오답 단어(${wrongResults.length}개)만 바로 복습하기
            </button>
          `
              : ''
          }
          <button class="primary-cta-btn" type="button" id="btn-summary-restart">
            같은 모드로 한 번 더 학습하기
          </button>
          <button class="mini-btn" type="button" id="btn-summary-home" style="padding: 11px;">
            홈 화면으로 이동
          </button>
        </div>
      </div>
    `;

    const retryWrongBtn = document.getElementById('btn-summary-retry-wrong');
    if (retryWrongBtn) {
      retryWrongBtn.addEventListener('click', () => {
        initQuizSession(state.quiz.mode, 'wrong');
      });
    }

    const restartBtn = document.getElementById('btn-summary-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        initQuizSession(state.quiz.mode, state.quiz.scope);
      });
    }

    const homeBtn = document.getElementById('btn-summary-home');
    if (homeBtn) {
      homeBtn.addEventListener('click', () => switchView('home'));
    }
  }

  // --- 4. 오답노트 화면 렌더링 ---
  function renderWrongNoteView() {
    const headerEl = document.getElementById('wrong-note-header');
    const listEl = document.getElementById('wrong-note-list');
    if (!headerEl || !listEl) return;

    const wrongWords = getWrongWords();
    const wrongExamWords = getWrongExamWords();
    const wrongSampleWords = getWrongSampleWords();

    if (wrongWords.length === 0) {
      headerEl.innerHTML = '';
      listEl.innerHTML = `
        <div class="empty-state">
          <p class="empty-title">오답노트에 저장된 단어가 없습니다</p>
          <p class="empty-desc">기본 퀴즈 3종 또는 기출 모드 2종에서 틀린 단어가 어떤 모드에서 틀렸는지 구분되어 이곳에 자동 기록됩니다.</p>
          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <button class="primary-cta-btn" type="button" id="btn-wrong-go-quiz" style="max-width: 220px;">
              기본 퀴즈 풀러 가기
            </button>
            <button class="primary-cta-btn" type="button" id="btn-wrong-go-exam-quiz" style="max-width: 220px; background: var(--amber-primary);">
              기출 모드 풀러 가기
            </button>
          </div>
        </div>
      `;
      const goQuizBtn = document.getElementById('btn-wrong-go-quiz');
      if (goQuizBtn) {
        goQuizBtn.addEventListener('click', () => {
          initQuizSession('meaning', 'today');
          switchView('quiz');
        });
      }
      const goExamQuizBtn = document.getElementById('btn-wrong-go-exam-quiz');
      if (goExamQuizBtn) {
        goExamQuizBtn.addEventListener('click', () => {
          initQuizSession('exam-blank', 'today');
          switchView('quiz');
        });
      }
      return;
    }

    const countByMode = (targetMode) =>
      wrongWords.filter((w) => {
        const info = state.wrongNote[String(w.id)];
        return getWrongModesForRecord(info, Boolean(w.isExam)).includes(targetMode);
      }).length;

    const examBlankCount = countByMode('exam-blank');
    const examMeaningCount = countByMode('exam-meaning');
    const basicMeaningCount = countByMode('meaning');
    const basicBlankCount = countByMode('blank');
    const basicFlashcardCount = countByMode('flashcard');

    headerEl.innerHTML = `
      <div class="wrong-banner">
        <h2 class="wrong-banner-title">오답노트 집중 복습 (총 ${wrongWords.length}개 · 기출 ${wrongExamWords.length} / 기본 ${wrongSampleWords.length})</h2>
        <p class="wrong-banner-desc">
          틀린 단어는 어떤 모드에서 틀렸는지 구분되어 기록되며 내일 복습 대상에 자동 포함됩니다.
        </p>
        <div class="wrong-quiz-btns" style="margin-bottom: 8px;">
          <button class="wrong-start-btn exam-btn" type="button" data-wrong-quiz="exam-blank" id="btn-wrong-quiz-exam-blank">
            기출 · 예문 빈칸 오답 퀴즈 (${wrongExamWords.length})
          </button>
          <button class="wrong-start-btn exam-btn-secondary" type="button" data-wrong-quiz="exam-meaning" id="btn-wrong-quiz-exam-meaning">
            기출 · 문맥 속 뜻 오답 퀴즈 (${wrongExamWords.length})
          </button>
        </div>
        <div class="wrong-quiz-btns">
          <button class="wrong-start-btn" type="button" data-wrong-quiz="meaning" id="btn-wrong-quiz-meaning">
            오답 뜻 맞히기 퀴즈 시작 (${wrongSampleWords.length})
          </button>
          <button class="wrong-start-btn secondary" type="button" data-wrong-quiz="blank" id="btn-wrong-quiz-blank">
            오답 예문 빈칸 퀴즈 (${wrongSampleWords.length})
          </button>
          <button class="wrong-start-btn secondary" type="button" data-wrong-quiz="flashcard" id="btn-wrong-quiz-flashcard">
            오답 카드 뒤집기 (${wrongSampleWords.length})
          </button>
        </div>
      </div>

      <div class="wrong-filter-row" role="group" aria-label="오답노트 모드별 필터">
        <button class="filter-pill ${state.wrongNoteFilter === 'all' ? 'active' : ''}" type="button" data-wrong-filter="all">
          전체 (${wrongWords.length})
        </button>
        <button class="filter-pill exam-pill ${state.wrongNoteFilter === 'exam' ? 'active' : ''}" type="button" data-wrong-filter="exam">
          기출 모드 오답 (${wrongExamWords.length})
        </button>
        <button class="filter-pill ${state.wrongNoteFilter === 'sample' ? 'active' : ''}" type="button" data-wrong-filter="sample">
          기본 퀴즈 오답 (${wrongSampleWords.length})
        </button>
        ${
          examBlankCount > 0
            ? `<button class="filter-pill exam-pill ${state.wrongNoteFilter === 'exam-blank' ? 'active' : ''}" type="button" data-wrong-filter="exam-blank">기출 · 예문 빈칸 (${examBlankCount})</button>`
            : ''
        }
        ${
          examMeaningCount > 0
            ? `<button class="filter-pill exam-pill ${state.wrongNoteFilter === 'exam-meaning' ? 'active' : ''}" type="button" data-wrong-filter="exam-meaning">기출 · 문맥 속 뜻 (${examMeaningCount})</button>`
            : ''
        }
        ${
          basicMeaningCount > 0
            ? `<button class="filter-pill ${state.wrongNoteFilter === 'meaning' ? 'active' : ''}" type="button" data-wrong-filter="meaning">기본 · 뜻 맞히기 (${basicMeaningCount})</button>`
            : ''
        }
        ${
          basicBlankCount > 0
            ? `<button class="filter-pill ${state.wrongNoteFilter === 'blank' ? 'active' : ''}" type="button" data-wrong-filter="blank">기본 · 예문 빈칸 (${basicBlankCount})</button>`
            : ''
        }
        ${
          basicFlashcardCount > 0
            ? `<button class="filter-pill ${state.wrongNoteFilter === 'flashcard' ? 'active' : ''}" type="button" data-wrong-filter="flashcard">기본 · 카드 뒤집기 (${basicFlashcardCount})</button>`
            : ''
        }
      </div>
    `;

    headerEl.querySelectorAll('[data-wrong-quiz]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.wrongQuiz;
        initQuizSession(mode, 'wrong');
        switchView('quiz');
      });
    });

    headerEl.querySelectorAll('[data-wrong-filter]').forEach((pill) => {
      pill.addEventListener('click', () => {
        state.wrongNoteFilter = pill.dataset.wrongFilter || 'all';
        renderWrongNoteView();
      });
    });

    const filteredWrongWords = wrongWords.filter((w) => {
      const f = state.wrongNoteFilter;
      if (f === 'all') return true;
      if (f === 'exam') return Boolean(w.isExam);
      if (f === 'sample') return !w.isExam;
      const info = state.wrongNote[String(w.id)];
      return getWrongModesForRecord(info, Boolean(w.isExam)).includes(f);
    });

    if (filteredWrongWords.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p class="empty-title">선택한 모드 필터에 해당하는 오답 단어가 없습니다</p>
          <p class="empty-desc">상단 필터에서 '전체'를 선택하면 모든 오답 단어를 볼 수 있습니다.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filteredWrongWords
      .map((w) => {
        const wrongInfo = state.wrongNote[String(w.id)] || { wrongCount: 1 };
        const modeBadges = renderWrongModeBadges(wrongInfo, Boolean(w.isExam), false);
        const countBadge = `<span class="level-badge" style="background: var(--danger-soft); color: var(--danger-primary);">총 오답 ${wrongInfo.wrongCount || 1}회</span>`;

        if (w.isExam) {
          return renderExamWordCard(w, {
            showRemoveWrongBtn: true,
            wrongBadgesHtml: `${countBadge}${modeBadges}`
          });
        }

        const srsMeta = getSrsBadgeMeta(w.id);
        return `
          <article class="word-card" data-word-id="${w.id}" data-speak-word="${escapeHtml(w.word)}">
            <div class="word-card-top">
              <div class="word-title-group">
                <span class="word-en">${escapeHtml(w.word)}</span>
                <span class="word-pos">${escapeHtml(w.pos)}</span>
                <span class="level-badge level-${escapeHtml(w.level)}">${escapeHtml(w.level)}</span>
                ${countBadge}
                ${modeBadges}
              </div>
              <button class="speak-btn" type="button" data-action="speak-word" data-speak-text="${escapeHtml(w.word)}">
                <span aria-hidden="true">🔊</span>
                <span>발음</span>
              </button>
            </div>

            <p class="word-meaning">${escapeHtml(w.meaning_ko)}</p>

            <div class="word-example-box">
              <p class="word-example-en">${escapeHtml(w.example_en)}</p>
              <p class="word-example-ko">${escapeHtml(w.example_ko)}</p>
            </div>

            <div class="word-card-footer">
              <span class="srs-tag ${srsMeta.cls}">${escapeHtml(srsMeta.text)}</span>
              <button class="mini-btn" type="button" data-action="remove-wrong" data-word-id="${w.id}">
                ✓ 암기 완료 (노트에서 제거)
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // --- 이벤트 위임 및 초기화 ---
  function bindEvents() {
    // 하단 내비게이션 탭 전환
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.navTarget;
        if (target) switchView(target);
      });
    });

    // 홈 화면 메인 시작 버튼
    const heroStartBtn = document.getElementById('btn-hero-start');
    if (heroStartBtn) {
      heroStartBtn.addEventListener('click', () => {
        const startMode =
          getDueSampleWords().length === 0 && getDueExamWords().length > 0
            ? 'exam-blank'
            : 'meaning';
        initQuizSession(startMode, 'today');
        switchView('quiz');
      });
    }

    // 홈 화면 퀴즈 3종 바로 시작 카드
    document.querySelectorAll('[data-start-mode]').forEach((card) => {
      card.addEventListener('click', () => {
        const mode = card.dataset.startMode;
        initQuizSession(mode, 'today');
        switchView('quiz');
      });
    });

    // 홈 화면 +1일 경과 시뮬레이션 버튼 (간격반복 예정일 확인용)
    const simNextDayBtn = document.getElementById('btn-sim-next-day');
    if (simNextDayBtn) {
      simNextDayBtn.addEventListener('click', () => {
        state.streak.dayOffset = (Number(state.streak.dayOffset) || 0) + 1;
        normalizeStreakForToday();
        normalizeGamificationForToday();
        saveStateToStorage();
        renderHomeView();
        updateGlobalBadges();
        showToast(`📅 기준일이 ${getTodayStr()}로 +1일 이동했습니다.`);
      });
    }

    // 홈 화면 기록 초기화 버튼
    const resetBtn = document.getElementById('btn-reset-storage');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.srs = {};
        state.wrongNote = {};
        state.streak = {
          count: 0,
          lastStudyDate: null,
          todayDate: getTodayStr(),
          todayStudiedIds: [],
          dayOffset: 0
        };
        // gamification 상태도 함께 초기화, prefs(다크 모드·효과음)는 제외 (유보 7.7 확정)
        state.gamification = createDefaultGamification();
        normalizeGamificationForToday();
        saveStateToStorage();
        state.quiz.queue = [];
        renderHomeView();
        updateGlobalBadges();
        showToast('모든 학습 기록이 초기화되었습니다.');
      });
    }

    // 단어장 검색 및 필터
    const searchInput = document.getElementById('wordbook-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.wordbookSearch = e.target.value || '';
        renderWordbookView();
      });
    }

    // 단어장 구분 탭 (기본 단어장 24 vs 기출 다의어 40)
    document.querySelectorAll('[data-wordbook-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        switchWordbookTab(tabBtn.dataset.wordbookTab);
      });
    });

    document.querySelectorAll('[data-level-filter]').forEach((pill) => {
      pill.addEventListener('click', () => {
        const filterVal = pill.dataset.levelFilter || 'all';
        if (filterVal === 'exam') {
          switchWordbookTab('exam');
          return;
        }
        state.wordbookFilter = filterVal;
        document.querySelectorAll('[data-level-filter]').forEach((p) => {
          p.classList.toggle('active', p === pill);
        });
        switchWordbookTab('sample');
      });
    });

    document.querySelectorAll('[data-exam-filter]').forEach((pill) => {
      pill.addEventListener('click', () => {
        state.examWordbookFilter = pill.dataset.examFilter || 'all';
        document.querySelectorAll('[data-exam-filter]').forEach((p) => {
          p.classList.toggle('active', p === pill);
        });
        renderWordbookView();
      });
    });

    // 단어장 및 오답노트 카드 클릭 시 발음 재생 (이벤트 위임)
    document.addEventListener('click', (e) => {
      const removeWrongBtn = e.target.closest('[data-action="remove-wrong"]');
      if (removeWrongBtn) {
        e.stopPropagation();
        const wid = String(removeWrongBtn.dataset.wordId);
        delete state.wrongNote[wid];
        saveStateToStorage();
        updateGlobalBadges();
        renderWrongNoteView();
        showToast('오답노트에서 제거되었습니다.');
        return;
      }

      const speakSentenceBtn = e.target.closest('[data-action="speak-sentence"]');
      if (speakSentenceBtn) {
        e.stopPropagation();
        const card = speakSentenceBtn.closest('.word-card');
        speakEnglish(speakSentenceBtn.dataset.speakText, card);
        return;
      }

      const speakWordBtn = e.target.closest('[data-action="speak-word"]');
      if (speakWordBtn) {
        e.stopPropagation();
        const card = speakWordBtn.closest('.word-card');
        speakEnglish(speakWordBtn.dataset.speakText, card);
        return;
      }

      const wordCard = e.target.closest('.word-card');
      if (wordCard && wordCard.dataset.speakWord) {
        speakEnglish(wordCard.dataset.speakWord, wordCard);
      }
    });

    // 퀴즈 화면 상단 모드 탭 & 출제 범위
    document.querySelectorAll('.quiz-tab-btn').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const mode = tabBtn.dataset.quizMode;
        initQuizSession(mode, state.quiz.scope);
      });
    });

    const scopeSelect = document.getElementById('quiz-scope-select');
    if (scopeSelect) {
      scopeSelect.addEventListener('change', (e) => {
        initQuizSession(state.quiz.mode, e.target.value);
      });
    }

    const restartQuizBtn = document.getElementById('btn-restart-quiz');
    if (restartQuizBtn) {
      restartQuizBtn.addEventListener('click', () => {
        initQuizSession(state.quiz.mode, state.quiz.scope);
        showToast('문제를 새로 섞었습니다.');
      });
    }

    // PWA 설치 버튼
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const installBtn = document.getElementById('btn-pwa-install');
      if (installBtn) installBtn.classList.add('visible');
    });

    const installBtn = document.getElementById('btn-pwa-install');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installBtn.classList.remove('visible');
      });
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
          // 로컬 파일 프로토콜 등에서는 무시
        });
      });
    }
  }

  async function initApp() {
    loadStateFromStorage();
    bindEvents();
    registerServiceWorker();

    try {
      const wordsRes = await fetch('./data/words.json');
      if (!wordsRes.ok) {
        throw new Error(`words.json HTTP ${wordsRes.status}`);
      }
      const rawWords = await wordsRes.json();
      state.words = Array.isArray(rawWords) ? rawWords : [];
    } catch (err) {
      showToast('단어 데이터를 불러오지 못했습니다.');
      state.words = [];
    }

    try {
      const examRes = await fetch('./data/exam-words.json');
      if (!examRes.ok) {
        throw new Error(`exam-words.json HTTP ${examRes.status}`);
      }
      const rawExam = await examRes.json();
      state.examWords = Array.isArray(rawExam)
        ? rawExam.map((item) => ({
            ...item,
            id: `exam-${item.word}`,
            isExam: true
          }))
        : [];
    } catch (err) {
      state.examWords = [];
    }

    // 기존 사용자 소급 해금: 단어 데이터 로딩 후 기존 srs·streak만으로 판정 (XP는 0에서 시작, 유보 7.3)
    evaluateBadges();
    updateGlobalBadges();
    renderHomeView();
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
