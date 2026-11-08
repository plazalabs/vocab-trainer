(function () {
  'use strict';

  const STORAGE_KEYS = {
    SRS: 'vocab_trainer_srs_v1',
    WRONG: 'vocab_trainer_wrong_v1',
    STREAK: 'vocab_trainer_streak_v1'
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
      results: [] // { wordId, isCorrect, nextInterval, nextReviewDate, mode }
    }
  };

  let deferredInstallPrompt = null;

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
  }

  function saveStateToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.SRS, JSON.stringify(state.srs));
      localStorage.setItem(STORAGE_KEYS.WRONG, JSON.stringify(state.wrongNote));
      localStorage.setItem(STORAGE_KEYS.STREAK, JSON.stringify(state.streak));
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

  // --- 간격반복(SRS) 및 오답노트 핵심 로직 ---
  function getQuizModeLabel(modeKey) {
    return QUIZ_MODE_LABELS[modeKey] || '기본 · 뜻 맞히기';
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

  function getWrongModesForRecord(wrongInfo, isExamWord) {
    if (!wrongInfo) return [];
    if (Array.isArray(wrongInfo.wrongModes) && wrongInfo.wrongModes.length > 0) {
      return wrongInfo.wrongModes;
    }
    if (wrongInfo.lastWrongMode) {
      return [wrongInfo.lastWrongMode];
    }
    return [isExamWord ? 'exam-blank' : 'meaning'];
  }

  function renderWrongModeBadges(wrongInfo, isExamWord, compact) {
    if (!wrongInfo) return '';
    const modes = getWrongModesForRecord(wrongInfo, isExamWord);
    const modeCounts =
      wrongInfo.modeCounts && typeof wrongInfo.modeCounts === 'object'
        ? wrongInfo.modeCounts
        : {};

    return modes
      .map((m) => {
        const label = getQuizModeLabel(m);
        const cls = m.startsWith('exam-') ? 'exam-mode' : 'basic-mode';
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

    saveStateToStorage();
    updateGlobalBadges();

    return {
      wordId,
      isCorrect,
      stage: nextStage,
      intervalDays,
      nextReviewDate,
      mode: modeKey
    };
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

    const simDisplay = document.getElementById('sim-date-display');
    if (simDisplay) {
      const offset = state.streak.dayOffset || 0;
      simDisplay.textContent =
        offset === 0
          ? `기준일: ${today} (오늘)`
          : `기준일: ${today} (+${offset}일 경과 시뮬레이션 중)`;
    }
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
                (m.meaning_ko && m.meaning_ko.toLowerCase().includes(query)) ||
                (m.signal && m.signal.toLowerCase().includes(query))
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
  // 기출 다의어 40개 각각의 실제 기출 예문(example_en / example_ko)에 쓰인 exam_meanings 인덱스 매핑
  const EXAM_CONTEXT_MEANING_INDEX = {
    account: 1,     // 차지하다 (Subscriptions account for almost 90 percent...)
    approach: 0,    // 접근법·방법 (This new approach increases...)
    base: 0,        // ~에 근거하다 (when farmers base decisions on observations...)
    lead: 0,        // ~로 이어지다, ~을 초래하다 (breakthroughs that lead to a major change...)
    leave: 0,       // 남기다·~한 채로 두다 (That leaves others having to respond...)
    matter: 0,      // 중요하다 (...matters less than the fact that they are women.)
    order: 1,       // 질서·순서 (...ultimately impose order on human experience...)
    practice: 1,    // 관행·실무 관습 (...management practices and a lack of concerted research.)
    present: 0,     // 현재의 (...actual past experience or present reality exactly.)
    sense: 0,       // ~감, ~의식 (...a growing sense of competence and mastery.)
    subject: 0,     // 피험자·실험 참가자 (For example, subjects who were presented with...)
    term: 1,        // ~의 측면에서, ~으로 따지면 (In terms of direct expenditures...)
    turn: 3,        // ~로 판명되다 (It turned out that this simple suggestion...)
    view: 0,        // 견해·관점 (Scientism is the view that...)
    address: 0,     // 다루다·해결에 나서다 (...addressing the root causes of the problem.)
    case: 0,        // 경우 (...until the case is settled...)
    concern: 1,     // ~을 다루다·와 관련되다 (...are not concerned with results...)
    conduct: 0,     // 실시하다·수행하다 (Numerous biodiversity experiments have been conducted...)
    contribute: 0,  // 기여하다·(~의) 한 요인이 되다 (...contribute to a more solid understanding...)
    cover: 0,       // 다루다·포함하다·(범위를) 아우르다 (...to cover a full spectrum of...)
    course: 1,      // 물론 (You can still, of course, incorporate...)
    draw: 1,        // 활용하다·끌어다 쓰다 (...will draw on your experience...)
    field: 0,       // 분야·영역 (“opened a field up,” “transformed a field,”...)
    figure: 1,      // 알아내다·생각해 내다 (...work to figure out what you can do better...)
    follow: 0,      // 따르다·준수하다 (...tend to follow tried-and-true structural patterns.)
    force: 0,       // 강요하다·억지로 ~하게 하다 (...forces firms to meet certain reporting requirements.)
    form: 1,        // 형성하다·이루다 (...ability to form internal representations...)
    function: 1,    // ~로서 기능하다·작용하다 (...the temple functioned as an administrative authority...)
    mean: 1,        // 수단·방법 (...continuation of politics by other means.)
    movement: 1,    // (사회·정치) 운동 (...success of the suffragette movement...)
    nature: 1,      // 본성·본질·성질 (The liquid nature of services...)
    point: 0,       // 지점·시점 (...to the point of combining into one “entity.”)
    population: 1,  // 개체군(생물 집단) (...peregrine falcon population...)
    process: 1,     // 처리하다·가공하다 (...disagreement can be processed or managed...)
    produce: 1,     // 농산물 (...sales of four types of ethical produce...)
    project: 1,     // 예상된·전망되는 (It is projected that the share...)
    reflect: 0,     // 반영하다 (This phenomenon reflects a unique feature...)
    remain: 2,      // 잔해·유물·음식 찌꺼기 (...from stone tools and food remains.)
    result: 2,      // 비롯되다 (Creativity results from a complex interaction...)
    work: 1         // 작품 (...it was absolutely a work of art.)
  };

  function isExamQuizMode(mode) {
    return mode === 'exam-blank' || mode === 'exam-meaning';
  }

  function getExamContextMeaningObj(wordObj) {
    if (!wordObj || !Array.isArray(wordObj.exam_meanings)) {
      return { meaning_ko: '', share_pct: null, signal: null };
    }
    const mappedIdx = EXAM_CONTEXT_MEANING_INDEX[wordObj.word];
    if (
      typeof mappedIdx === 'number' &&
      wordObj.exam_meanings[mappedIdx] &&
      wordObj.exam_meanings[mappedIdx].meaning_ko
    ) {
      return wordObj.exam_meanings[mappedIdx];
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

  function syncQuizScopeSelect(mode, requestedScope) {
    const scopeSelect = document.getElementById('quiz-scope-select');
    if (!scopeSelect) return requestedScope || 'today';

    if (isExamQuizMode(mode)) {
      const validExamScopes = ['today', 'all', 'S', 'A', 'wrong'];
      const nextScope = validExamScopes.includes(requestedScope) ? requestedScope : 'today';
      scopeSelect.innerHTML = `
        <option value="today">오늘 복습 + 미학습 기출 단어 (추천)</option>
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
      <option value="today">오늘 복습 + 미학습 단어 (추천)</option>
      <option value="all">전체 단어 24개</option>
      <option value="wrong">오답노트 단어만</option>
    `;
    scopeSelect.value = nextScope;
    return nextScope;
  }

  function buildQuizQueue(scope, mode) {
    if (isExamQuizMode(mode)) {
      if (scope === 'wrong') {
        return shuffleArray(getWrongExamWords());
      }
      if (scope === 'S' || scope === 'A') {
        return shuffleArray(state.examWords.filter((w) => w.grade === scope));
      }
      if (scope === 'today') {
        const dueExam = getDueExamWords();
        const unseenExam = getNewExamWords();
        const combined = [...shuffleArray(dueExam), ...shuffleArray(unseenExam)];
        if (combined.length > 0) {
          return combined.slice(0, Math.max(dueExam.length, Math.min(15, combined.length)));
        }
        return shuffleArray(state.examWords).slice(0, 12);
      }
      return shuffleArray(state.examWords);
    }

    if (scope === 'wrong') {
      return shuffleArray(getWrongSampleWords());
    }
    if (scope === 'today') {
      const due = getDueSampleWords();
      const unseen = getNewSampleWords();
      // 오늘 복습할 단어를 최우선 출제하고, 부족하면 미학습 단어 추가 (최대 12문항 세션)
      const combined = [...shuffleArray(due), ...shuffleArray(unseen)];
      if (combined.length > 0) {
        return combined.slice(0, Math.max(due.length, Math.min(12, combined.length)));
      }
      return shuffleArray(state.words).slice(0, 10);
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

    // 탭 UI 동기화
    document.querySelectorAll('.quiz-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.quizMode === state.quiz.mode);
    });

    prepareCurrentQuestionChoices();
    renderQuizView();
  }

  function prepareCurrentQuestionChoices() {
    const currentWord = state.quiz.queue[state.quiz.currentIndex];
    if (!currentWord) {
      state.quiz.choices = [];
      return;
    }

    state.quiz.answered = false;
    state.quiz.flipped = false;

    const mode = state.quiz.mode;

    if (mode === 'exam-blank') {
      // 기출 모드 유형 1 — 기출 예문 빈칸 (오답 선택지는 다른 기출 단어에서)
      const otherExamWords = state.examWords.filter((w) => w.id !== currentWord.id);
      const sameGrade = shuffleArray(otherExamWords.filter((w) => w.grade === currentWord.grade));
      const diffGrade = shuffleArray(otherExamWords.filter((w) => w.grade !== currentWord.grade));
      const distractors = [...sameGrade, ...diffGrade].slice(0, 3);
      state.quiz.choices = shuffleArray([currentWord, ...distractors]);
      return;
    }

    if (mode === 'exam-meaning') {
      // 기출 모드 유형 2 — 문맥 속 뜻 (exam_meanings 중에서 고르되, 기본 뜻을 함정으로 포함)
      const correctEntry = getExamContextMeaningObj(currentWord);
      const usedTexts = new Set();
      const meaningChoices = [];

      if (correctEntry && correctEntry.meaning_ko) {
        usedTexts.add(correctEntry.meaning_ko);
        meaningChoices.push({
          id: 'correct',
          meaning_ko: correctEntry.meaning_ko,
          share_pct: correctEntry.share_pct,
          signal: correctEntry.signal,
          isCorrect: true,
          isTrap: false
        });
      }

      // 기본 뜻(base_meaning_ko)이 존재하고 정답 뜻과 다르면 함정 선택지로 반드시 포함
      if (
        currentWord.base_meaning_ko !== null &&
        currentWord.base_meaning_ko !== undefined &&
        String(currentWord.base_meaning_ko).trim() !== '' &&
        !usedTexts.has(currentWord.base_meaning_ko)
      ) {
        usedTexts.add(currentWord.base_meaning_ko);
        meaningChoices.push({
          id: 'trap-base',
          meaning_ko: currentWord.base_meaning_ko,
          share_pct: null,
          signal: null,
          isCorrect: false,
          isTrap: true
        });
      }

      // 해당 단어의 다른 exam_meanings 추가
      const otherOwnMeanings = shuffleArray(
        (currentWord.exam_meanings || []).filter(
          (m) => m && m.meaning_ko && !usedTexts.has(m.meaning_ko)
        )
      );
      for (const m of otherOwnMeanings) {
        if (meaningChoices.length >= 4) break;
        usedTexts.add(m.meaning_ko);
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
            if (em && em.meaning_ko && !usedTexts.has(em.meaning_ko)) {
              poolFromOtherExamWords.push(em.meaning_ko);
            }
          });
        });
        for (const extraMeaning of shuffleArray(poolFromOtherExamWords)) {
          if (meaningChoices.length >= 4) break;
          if (usedTexts.has(extraMeaning)) continue;
          usedTexts.add(extraMeaning);
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

    const others = state.words.filter((w) => w.id !== currentWord.id);
    // 같은 품사를 우선 오답 보기로 섞어 변별력 향상
    const samePos = shuffleArray(others.filter((w) => w.pos === currentWord.pos));
    const diffPos = shuffleArray(others.filter((w) => w.pos !== currentWord.pos));
    const distractors = [...samePos, ...diffPos].slice(0, 3);

    state.quiz.choices = shuffleArray([currentWord, ...distractors]);
  }

  function maskWordInSentence(sentence, targetWord) {
    const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}[a-z]*\\b`, 'gi');
    const safeSentence = escapeHtml(sentence);
    if (regex.test(safeSentence)) {
      return safeSentence.replace(
        new RegExp(`\\b${escaped}[a-z]*\\b`, 'gi'),
        '<span class="blank-slot">_______</span>'
      );
    }
    return `${safeSentence} (<span class="blank-slot">_______</span>)`;
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

    const mode = state.quiz.mode;
    const isExamMode = isExamQuizMode(mode);

    if (state.quiz.queue.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p class="empty-title">선택한 범위에 출제할 단어가 없습니다</p>
          <p class="empty-desc">${
            isExamMode
              ? "기출 오답노트가 비어 있거나 해당 범위의 기출 단어가 없습니다. '전체 기출 다의어 40개'로 시작해 보세요."
              : "오답노트가 비어 있거나 모든 단어를 학습했습니다. 출제 범위를 '전체 단어 24개'로 변경해 보세요."
          }</p>
          <button class="primary-cta-btn" type="button" id="btn-Fallback-all-quiz" style="max-width: 280px; margin: 0 auto;">
            ${isExamMode ? '전체 기출 40단어로 시작하기' : '전체 단어로 퀴즈 시작하기'}
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
      // (c) 카드 뒤집기 자기 판정 (알아요 / 몰라요)
      const isFlipped = state.quiz.flipped;
      questionBodyHtml = `
        <div class="flashcard-container">
          <div class="flashcard-box ${isFlipped ? 'flipped' : ''}" id="flashcard-flip-box" role="button" tabindex="0" aria-label="플래시카드 뒤집기">
            <div>
              <span class="word-pos">${escapeHtml(wordObj.pos)}</span>
              <span class="level-badge level-${escapeHtml(wordObj.level)}">${escapeHtml(wordObj.level)}</span>
            </div>
            <h3 class="quiz-target-word" style="margin-top: 8px;">${escapeHtml(wordObj.word)}</h3>

            ${
              isFlipped
                ? `
              <div class="flashcard-back-details">
                <p class="flashcard-meaning">${escapeHtml(wordObj.meaning_ko)}</p>
                <p class="word-example-en" style="margin-bottom: 4px;">"${escapeHtml(wordObj.example_en)}"</p>
                <p class="word-example-ko">${escapeHtml(wordObj.example_ko)}</p>
              </div>
            `
                : `
              <p class="flashcard-hint">👆 카드를 클릭하여 뜻과 예문을 확인하세요</p>
            `
            }
          </div>

          <div class="self-judge-row">
            <button class="judge-btn unknown" type="button" id="btn-judge-unknown">
              <span>몰라요 ✕</span>
              <span class="judge-sub">오답노트 저장 · 내일 재출제</span>
            </button>
            <button class="judge-btn known" type="button" id="btn-judge-known">
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
    const mode = state.quiz.mode;
    const wordObj = state.quiz.queue[state.quiz.currentIndex];
    const isExamMode = isExamQuizMode(mode);

    const correctChoiceId = mode === 'exam-meaning' ? 'correct' : String(wordObj.id);
    const isCorrect = String(chosenId) === correctChoiceId;

    // 빈칸 채우기 모드일 경우 모든 빈칸에 정답 채워 넣기
    document.querySelectorAll('#quiz-active-area .blank-slot').forEach((slot) => {
      slot.textContent = wordObj.word;
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
          </div>
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

  function handleFlashcardJudge(isKnown) {
    if (state.quiz.answered) return;
    state.quiz.answered = true;
    const wordObj = state.quiz.queue[state.quiz.currentIndex];
    const outcome = recordQuizAnswer(wordObj.id, isKnown, state.quiz.mode);
    state.quiz.results.push(outcome);

    showToast(
      isKnown
        ? `⭕ '알아요' 판정 → ${outcome.intervalDays}일 뒤 복습 예정`
        : `❌ '몰라요' 판정 → 오답노트 저장 및 내일 재출제`
    );

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
    const total = state.quiz.results.length;
    const correctCount = state.quiz.results.filter((r) => r.isCorrect).length;
    const wrongResults = state.quiz.results.filter((r) => !r.isCorrect);
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const currentModeLabel = getQuizModeLabel(state.quiz.mode);

    container.innerHTML = `
      <div class="quiz-stage-card" style="text-align: center;">
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
      const [wordsRes, examRes] = await Promise.all([
        fetch('./data/words.json'),
        fetch('./data/exam-words.json')
      ]);

      if (!wordsRes.ok) {
        throw new Error(`words.json HTTP ${wordsRes.status}`);
      }
      state.words = await wordsRes.json();

      if (examRes.ok) {
        const rawExam = await examRes.json();
        state.examWords = Array.isArray(rawExam)
          ? rawExam.map((item) => ({
              ...item,
              id: `exam-${item.word}`,
              isExam: true
            }))
          : [];
      } else {
        state.examWords = [];
      }
    } catch (err) {
      showToast('단어 데이터를 불러오지 못했습니다.');
      state.words = [];
      state.examWords = [];
    }

    updateGlobalBadges();
    renderHomeView();
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
