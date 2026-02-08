interface DiscoverPayload {
  level: string;
  difficultyIndex: number;
  devanagari: string;
  roman: string;
  meaning: string;
  structure: string;
  tip: string;
  words?: WordPayload[];
}

interface ProgressState {
  difficultyIndex: number;
  lastSeenDate: string;
  recentSentences: string[];
}

interface WordPayload {
  word: string;
  transliteration: string;
  partOfSpeech: string;
  meaning: string;
  grammar: string;
}

interface AnalyzePayload {
  normalizedSentence: string;
  overallMeaning: string;
  explanation: string;
  words: WordPayload[];
}

const STORAGE_KEY = "sanskrit-daily-progress-v2";

const tabs = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
const panels: Record<"discover" | "analyze", HTMLElement | null> = {
  discover: document.getElementById("discoverPanel"),
  analyze: document.getElementById("analyzePanel")
};

const todayDateEl = document.getElementById("todayDate") as HTMLElement;
const difficultyBadge = document.getElementById("difficultyBadge") as HTMLElement;
const sentenceDevanagari = document.getElementById("sentenceDevanagari") as HTMLElement;
const sentenceRoman = document.getElementById("sentenceRoman") as HTMLElement;
const sentenceMeaning = document.getElementById("sentenceMeaning") as HTMLElement;
const sentenceStructure = document.getElementById("sentenceStructure") as HTMLElement;
const sentenceTip = document.getElementById("sentenceTip") as HTMLElement;
const discoverStatus = document.getElementById("discoverStatus") as HTMLElement;
const nextSentenceBtn = document.getElementById("nextSentenceBtn") as HTMLButtonElement;
const easierBtn = document.getElementById("easierBtn") as HTMLButtonElement;
const harderBtn = document.getElementById("harderBtn") as HTMLButtonElement;

const sentenceInput = document.getElementById("sentenceInput") as HTMLTextAreaElement;
const analyzeBtn = document.getElementById("analyzeBtn") as HTMLButtonElement;
const analysisEmpty = document.getElementById("analysisEmpty") as HTMLElement;
const analysisResult = document.getElementById("analysisResult") as HTMLElement;
const wordBreakdown = document.getElementById("wordBreakdown") as HTMLElement;
const overallMeaning = document.getElementById("overallMeaning") as HTMLElement;
const grammarNotes = document.getElementById("grammarNotes") as HTMLElement;

function setTodayLabel(): void {
  const now = new Date();
  todayDateEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function toLevel(index: number): string {
  if (index <= 2) return "Beginner";
  if (index <= 5) return "Elementary";
  if (index <= 8) return "Intermediate";
  return "Advanced";
}

function getProgress(): ProgressState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<ProgressState> | null;
    if (saved && Number.isInteger(saved.difficultyIndex)) {
      return {
        difficultyIndex: Math.max(0, Math.min(11, saved.difficultyIndex!)),
        lastSeenDate: typeof saved.lastSeenDate === "string" ? saved.lastSeenDate : getTodayKey(),
        recentSentences: Array.isArray(saved.recentSentences) ? saved.recentSentences.slice(0, 8) : []
      };
    }
  } catch {
    // Ignore invalid localStorage payload.
  }

  return {
    difficultyIndex: 0,
    lastSeenDate: getTodayKey(),
    recentSentences: []
  };
}

function saveProgress(progress: ProgressState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function setDiscoverLoading(isLoading: boolean, message = ""): void {
  nextSentenceBtn.disabled = isLoading;
  easierBtn.disabled = isLoading;
  harderBtn.disabled = isLoading;

  if (message) {
    discoverStatus.textContent = message;
    discoverStatus.classList.remove("hidden");
  } else {
    discoverStatus.textContent = "";
    discoverStatus.classList.add("hidden");
  }
}

function renderSentence(data: DiscoverPayload): void {
  difficultyBadge.textContent = data.level || toLevel(data.difficultyIndex || 0);
  sentenceDevanagari.textContent = data.devanagari || "";
  sentenceRoman.textContent = data.roman || "";
  sentenceMeaning.textContent = data.meaning || "";
  sentenceStructure.textContent = data.structure || "";
  sentenceTip.textContent = data.tip || "";

  const discoverWordBreakdown = document.getElementById("discoverWordBreakdown");
  if (discoverWordBreakdown) {
    if (data.words && data.words.length > 0) {
      renderWordBreakdown(data.words, discoverWordBreakdown);
    } else {
      discoverWordBreakdown.innerHTML = "";
    }
  }
}

async function fetchDiscover(difficultyIndex: number, recentSentences: string[]): Promise<DiscoverPayload> {
  const response = await fetch("/api/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficultyIndex, recentSentences })
  });

  const payload = (await response.json()) as DiscoverPayload & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Failed to fetch new sentence.");
  }

  return payload;
}

async function loadSentence(forceIncrement = false): Promise<void> {
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

function makeDifficultyChange(delta: number): void {
  const progress = getProgress();
  progress.difficultyIndex = Math.max(0, Math.min(11, progress.difficultyIndex + delta));
  saveProgress(progress);
  void loadSentence(false);
}

function linkifyGrammar(text: string): string {
  const grammarLinks: Record<string, string> = {
    // Cases
    nominative: "https://en.wikipedia.org/wiki/Nominative_case",
    accusative: "https://en.wikipedia.org/wiki/Accusative_case",
    instrumental: "https://en.wikipedia.org/wiki/Instrumental_case",
    dative: "https://en.wikipedia.org/wiki/Dative_case",
    ablative: "https://en.wikipedia.org/wiki/Ablative_case",
    genitive: "https://en.wikipedia.org/wiki/Genitive_case",
    locative: "https://en.wikipedia.org/wiki/Locative_case",
    vocative: "https://en.wikipedia.org/wiki/Vocative_case",
    // Numbers
    singular: "https://en.wikipedia.org/wiki/Grammatical_number",
    dual: "https://en.wikipedia.org/wiki/Dual_(grammatical_number)",
    plural: "https://en.wikipedia.org/wiki/Plural",
    // Genders
    masculine: "https://en.wikipedia.org/wiki/Grammatical_gender",
    feminine: "https://en.wikipedia.org/wiki/Grammatical_gender",
    neuter: "https://en.wikipedia.org/wiki/Grammatical_gender",
    // Tenses & Moods
    present: "https://en.wikipedia.org/wiki/Present_tense",
    past: "https://en.wikipedia.org/wiki/Past_tense",
    future: "https://en.wikipedia.org/wiki/Future_tense",
    imperative: "https://en.wikipedia.org/wiki/Imperative_mood",
    optative: "https://en.wikipedia.org/wiki/Optative_mood",
    perfect: "https://en.wikipedia.org/wiki/Perfect_(grammar)",
    aorist: "https://en.wikipedia.org/wiki/Aorist",
    // Voice
    active: "https://en.wikipedia.org/wiki/Active_voice",
    middle: "https://en.wikipedia.org/wiki/Middle_voice",
    passive: "https://en.wikipedia.org/wiki/Passive_voice",
    parasmaipada: "https://en.wikipedia.org/wiki/Sanskrit_verbs",
    ātmanepada: "https://en.wikipedia.org/wiki/Sanskrit_verbs",
    atmanepada: "https://en.wikipedia.org/wiki/Sanskrit_verbs",
    // Sandhi & Compounds
    sandhi: "https://en.wikipedia.org/wiki/Sandhi",
    compound: "https://en.wikipedia.org/wiki/Compound_(linguistics)",
    samāsa: "https://en.wikipedia.org/wiki/Sanskrit_compound",
    samasa: "https://en.wikipedia.org/wiki/Sanskrit_compound",
    tatpuruṣa: "https://en.wikipedia.org/wiki/Sanskrit_compound",
    tatpurusa: "https://en.wikipedia.org/wiki/Sanskrit_compound",
    bahuvrīhi: "https://en.wikipedia.org/wiki/Bahuvrihi",
    bahuvrihi: "https://en.wikipedia.org/wiki/Bahuvrihi",
    dvandva: "https://en.wikipedia.org/wiki/Dvandva",
    avyayībhāva: "https://en.wikipedia.org/wiki/Sanskrit_compound",
    avyayibhava: "https://en.wikipedia.org/wiki/Sanskrit_compound"
  };

  let result = text;
  Object.keys(grammarLinks).forEach(term => {
    const regex = new RegExp(`\\b(${term})\\b`, "gi");
    result = result.replace(regex, (match) => {
      const url = grammarLinks[term.toLowerCase()];
      return `<a href="${url}" target="_blank" rel="noopener" title="Learn more about ${match}">${match}</a>`;
    });
  });
  return result;
}

function renderWordBreakdown(words: WordPayload[], container: HTMLElement): void {
  container.innerHTML = "";
  words.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "word-row";
    const iast = entry.transliteration || "";
    const pos = entry.partOfSpeech || "";
    const header = iast && pos ? `${iast} / ${pos}` : iast || pos || "";

    row.innerHTML = `
      <div class="word-header">
        <span class="word-sanskrit">${entry.word}</span>
        ${header ? `<span class="word-info">(${header})</span>` : ""}
      </div>
      <div class="word-meaning">${entry.meaning || "-"}</div>
      ${entry.grammar ? `<div class="word-grammar">${linkifyGrammar(entry.grammar)}</div>` : ""}
    `;
    container.appendChild(row);
  });
}

function renderAnalysis(data: AnalyzePayload): void {
  renderWordBreakdown(data.words, wordBreakdown);

  overallMeaning.textContent = data.overallMeaning;
  grammarNotes.textContent = data.explanation;
  analysisEmpty.classList.add("hidden");
  analysisResult.classList.remove("hidden");
}

async function analyzeSentence(): Promise<void> {
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

    const data = (await response.json()) as AnalyzePayload & { error?: string };
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

function initTabs(): void {
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab as "discover" | "analyze" | undefined;
      if (!tab) return;

      tabs.forEach((other) => {
        const active = other === btn;
        other.classList.toggle("active", active);
        other.setAttribute("aria-selected", active ? "true" : "false");
      });

      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        panel.classList.toggle("active", key === tab);
      });
    });
  });
}

function initPwa(): void {
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js");
  }
}

function init(): void {
  setTodayLabel();
  initTabs();
  initPwa();

  nextSentenceBtn.addEventListener("click", () => {
    void loadSentence(true);
  });
  easierBtn.addEventListener("click", () => {
    void makeDifficultyChange(-1);
  });
  harderBtn.addEventListener("click", () => {
    void makeDifficultyChange(1);
  });
  analyzeBtn.addEventListener("click", () => {
    void analyzeSentence();
  });

  sentenceInput.addEventListener("keydown", (evt: KeyboardEvent) => {
    if ((evt.metaKey || evt.ctrlKey) && evt.key === "Enter") {
      void analyzeSentence();
    }
  });

  void loadSentence(false);
}

init();
