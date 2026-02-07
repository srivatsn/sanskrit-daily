import "dotenv/config";
import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Difficulty = "Beginner" | "Elementary" | "Intermediate" | "Advanced";

interface DiscoverRequestBody {
  difficultyIndex?: number;
  recentSentences?: string[];
}

interface DiscoverResponseBody {
  level: Difficulty;
  difficultyIndex: number;
  devanagari: string;
  roman: string;
  meaning: string;
  structure: string;
  tip: string;
}

interface AnalyzeRequestBody {
  sentence?: string;
}

interface WordBreakdown {
  word: string;
  transliteration: string;
  partOfSpeech: string;
  meaning: string;
  grammar: string;
}

interface AnalyzeResponseBody {
  normalizedSentence: string;
  overallMeaning: string;
  explanation: string;
  words: WordBreakdown[];
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface FoundryConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

const app = express();
const port = Number(process.env.PORT ?? 3000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir, { extensions: ["html"] }));

function getFoundryConfig(): FoundryConfig {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? process.env.AZURE_FOUNDRY_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY ?? process.env.AZURE_FOUNDRY_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? process.env.AZURE_FOUNDRY_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";

  if (!endpoint || !apiKey || !deployment) {
    throw new Error(
      "Missing Azure config. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT."
    );
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    apiKey,
    deployment,
    apiVersion
  };
}

function toDifficulty(index: number): Difficulty {
  if (index <= 2) return "Beginner";
  if (index <= 5) return "Elementary";
  if (index <= 8) return "Intermediate";
  return "Advanced";
}

function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Model response did not include JSON object.");
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}

async function callFoundry(messages: ChatMessage[], maxTokens = 700): Promise<string> {
  const config = getFoundryConfig();

  const url = `${config.endpoint}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey
    },
    body: JSON.stringify({
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Azure Foundry call failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Azure Foundry returned an empty completion.");
  }

  return content;
}

app.post(
  "/api/discover",
  async (req: Request<unknown, unknown, DiscoverRequestBody>, res: Response<DiscoverResponseBody | { error: string }>) => {
    try {
      const requestedIndex = Math.max(0, Math.min(11, Number(req.body.difficultyIndex ?? 0)));
      const level = toDifficulty(requestedIndex);
      const recentSentences = Array.isArray(req.body.recentSentences)
        ? req.body.recentSentences.filter((v): v is string => typeof v === "string").slice(0, 8)
        : [];

      const systemPrompt = [
        "You are a Sanskrit tutor.",
        "Return exactly one JSON object with keys:",
        "level, difficultyIndex, devanagari, roman, meaning, structure, tip",
        "Rules:",
        "- Produce one original Sanskrit sentence in Devanagari with proper punctuation.",
        "- Roman should be IAST transliteration.",
        "- Meaning should be natural English.",
        "- Structure should explain grammar in one short sentence.",
        "- Tip should be one practical learning tip.",
        "- Difficulty must match the requested level.",
        "- Avoid repeating recent sentences supplied by the user.",
        "- No markdown, no extra keys, JSON only."
      ].join("\n");

      const userPrompt = JSON.stringify({
        requestedLevel: level,
        difficultyIndex: requestedIndex,
        avoidTheseSentences: recentSentences
      });

      const raw = await callFoundry(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        550
      );

      const parsed = extractJson<Partial<DiscoverResponseBody>>(raw);
      const payload: DiscoverResponseBody = {
        level,
        difficultyIndex: requestedIndex,
        devanagari: String(parsed.devanagari ?? ""),
        roman: String(parsed.roman ?? ""),
        meaning: String(parsed.meaning ?? ""),
        structure: String(parsed.structure ?? ""),
        tip: String(parsed.tip ?? "")
      };

      if (!payload.devanagari || !payload.roman || !payload.meaning) {
        throw new Error("Model response missing required sentence fields.");
      }

      res.json(payload);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to generate sentence."
      });
    }
  }
);

app.post(
  "/api/analyze",
  async (req: Request<unknown, unknown, AnalyzeRequestBody>, res: Response<AnalyzeResponseBody | { error: string }>) => {
    try {
      const sentence = (req.body.sentence ?? "").trim();
      if (!sentence) {
        return res.status(400).json({ error: "Sentence is required." });
      }

      const systemPrompt = [
        "You are a Sanskrit grammar and translation tutor.",
        "Return exactly one JSON object with keys:",
        "normalizedSentence, overallMeaning, explanation, words",
        "where words is an array of objects with keys:",
        "word, transliteration, partOfSpeech, meaning, grammar",
        "Rules:",
        "- Keep grammar concise but accurate.",
        "- If uncertain, mark the uncertainty in grammar field.",
        "- overallMeaning should be natural English translation.",
        "- explanation should summarize sentence-level grammar and sense.",
        "- No markdown, no extra keys, JSON only."
      ].join("\n");

      const raw = await callFoundry(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ sentence }) }
        ],
        900
      );

      const parsed = extractJson<Partial<AnalyzeResponseBody>>(raw);
      const words = Array.isArray(parsed.words)
        ? parsed.words
            .filter((item): item is Partial<WordBreakdown> => typeof item === "object" && item !== null)
            .map((item) => ({
              word: String(item.word ?? ""),
              transliteration: String(item.transliteration ?? ""),
              partOfSpeech: String(item.partOfSpeech ?? ""),
              meaning: String(item.meaning ?? ""),
              grammar: String(item.grammar ?? "")
            }))
            .filter((item) => item.word.length > 0)
        : [];

      const payload: AnalyzeResponseBody = {
        normalizedSentence: String(parsed.normalizedSentence ?? sentence),
        overallMeaning: String(parsed.overallMeaning ?? ""),
        explanation: String(parsed.explanation ?? ""),
        words
      };

      if (!payload.overallMeaning || payload.words.length === 0) {
        throw new Error("Model response missing analysis fields.");
      }

      res.json(payload);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to analyze sentence."
      });
    }
  }
);

app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Sanskrit Daily running on http://localhost:${port}`);
});
