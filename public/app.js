const STORAGE_KEY = "sanskrit-daily-progress-v2";

const tabs = document.querySelectorAll(".tab-btn");
const panels = {
  discover: document.getElementById("discoverPanel"),
  analyze: document.getElementById("analyzePanel")
};

const todayDateEl = document.getElementById("todayDate");
const difficultyBadge = document.getElementById("difficultyBadge");
const sentenceDevanagari = document.getElementById("sentenceDevanagari");
const sentenceRoman = document.getElementById("sentenceRoman");
const sentenceMeaning = document.getElementById("sentenceMeaning");
const sentenceStructure = document.getElementById("sentenceStructure");
const sentenceTip = document.getElementById("sentenceTip");
const discoverStatus = document.getElementById("discoverStatus");
const nextSentenceBtn = document.getElementById("nextSentenceBtn");
const resetBtn = document.getElementById("resetBtn");

const sentenceInput = document.getElementById("sentenceInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const analysisEmpty = document.getElementById("analysisEmpty");
const analysisResult = document.getElementById("analysisResult");
const wordBreakdown = document.getElementById("wordBreakdown");
const overallMeaning = document.getElementById("overallMeaning");
const grammarNotes = document.getElementById("grammarNotes");

function setTodayLabel() {
  const now = new Date();
  todayDateEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function toLevel(index) {
  if (index <= 2) return "Beginner";
  if (index <= 5) return "Elementary";
  if (index <= 8) return "Intermediate";
  return "Advanced";
}

function getProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Number.isInteger(saved.difficultyIndex)) {
      return {
        difficultyIndex: Math.max(0, Math.min(11, saved.difficultyIndex)),
        lastSeenDate: typeof saved.lastSeenDate === "string" ? saved.lastSeenDate : getTodayKey(),
        recentSentences: Array.isArray(saved.recentSentences) ? saved.recentSentences.slice(0, 8) : []
      };
    }
  } catch (_) {}

  return {
    difficultyIndex: 0,
    lastSeenDate: getTodayKey(),
    recentSentences: []
  };
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function setDiscoverLoading(isLoading, message = "") {
  nextSentenceBtn.disabled = isLoading;
  resetBtn.disabled = isLoading;
  if (message) {
    discoverStatus.textContent = message;
    discoverStatus.classList.remove("hidden");
  } else {
    discoverStatus.textContent = "";
    discoverStatus.classList.add("hidden");
  }
}

function renderSentence(data) {
  difficultyBadge.textContent = data.level || toLevel(data.difficultyIndex || 0);
  sentenceDevanagari.textContent = data.devanagari || "";
  sentenceRoman.textContent = data.roman || "";
  sentenceMeaning.textContent = data.meaning || "";
  sentenceStructure.textContent = data.structure || "";
  sentenceTip.textContent = data.tip || "";
}

async function fetchDiscover(difficultyIndex, recentSentences) {
  const response = await fetch("/api/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficultyIndex, recentSentences })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Failed to fetch new sentence.");
  }

  return payload;
}

async function loadSentence(forceIncrement = false) {
  const progress = getProgress();
  const todayKey = getTodayKey();

  if (forceIncrement) {
    progress.difficultyIndex = Math.min(progress.difficultyIndex + 1, 11);
  } else if (progress.lastSeenDate !== todayKey) {
    progress.difficultyIndex = Math.min(progress.difficultyIndex + 1, 11);
  }

  progress.lastSeenDate = todayKey;
  setDiscoverLoading(true, "Generating a new sentence...");

  try {
    const sentence = await fetchDiscover(progress.difficultyIndex, progress.recentSentences);
    renderSentence(sentence);
    progress.recentSentences = [sentence.devanagari, ...progress.recentSentences].slice(0, 8);
    saveProgress(progress);
    setDiscoverLoading(false);
  } catch (error) {
    setDiscoverLoading(false, error instanceof Error ? error.message : "Unable to generate sentence.");
  }
}

function resetProgress() {
  const fresh = {
    difficultyIndex: 0,
    lastSeenDate: getTodayKey(),
    recentSentences: []
  };
  saveProgress(fresh);
  loadSentence(false);
}

function renderAnalysis(data) {
  wordBreakdown.innerHTML = "";

  data.words.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "word-row";
    row.innerHTML = `
      <div class="word-sanskrit">${entry.word}</div>
      <div class="word-meta"><strong>IAST:</strong> ${entry.transliteration || "-"}</div>
      <div class="word-meta"><strong>Part of Speech:</strong> ${entry.partOfSpeech || "-"}</div>
      <div class="word-meta"><strong>Meaning:</strong> ${entry.meaning || "-"}</div>
      <div class="word-meta"><strong>Grammar:</strong> ${entry.grammar || "-"}</div>
    `;
    wordBreakdown.appendChild(row);
  });

  overallMeaning.textContent = data.overallMeaning;
  grammarNotes.textContent = data.explanation;

  analysisEmpty.classList.add("hidden");
  analysisResult.classList.remove("hidden");
}

async function analyzeSentence() {
  const sentence = sentenceInput.value.trim();
  if (!sentence) {
    analysisEmpty.textContent = "Please enter a Sanskrit sentence first.";
    analysisEmpty.classList.remove("hidden");
    analysisResult.classList.add("hidden");
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to analyze sentence.");
    }

    renderAnalysis(data);
  } catch (error) {
    analysisEmpty.textContent = error instanceof Error ? error.message : "Failed to analyze sentence.";
    analysisEmpty.classList.remove("hidden");
    analysisResult.classList.add("hidden");
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Sentence";
  }
}

function initTabs() {
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      tabs.forEach((other) => {
        const active = other === btn;
        other.classList.toggle("active", active);
        other.setAttribute("aria-selected", active ? "true" : "false");
      });

      Object.entries(panels).forEach(([key, panel]) => {
        panel.classList.toggle("active", key === tab);
      });
    });
  });
}

function initPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

function init() {
  setTodayLabel();
  initTabs();
  initPwa();

  nextSentenceBtn.addEventListener("click", () => loadSentence(true));
  resetBtn.addEventListener("click", resetProgress);
  analyzeBtn.addEventListener("click", analyzeSentence);

  sentenceInput.addEventListener("keydown", (evt) => {
    if ((evt.metaKey || evt.ctrlKey) && evt.key === "Enter") {
      analyzeSentence();
    }
  });

  loadSentence(false);
}

init();
