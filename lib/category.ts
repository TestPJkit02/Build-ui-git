import type { Category, Repo } from "./types";

/**
 * Category classifier for AI repos.
 *
 * Uses keyword match on `topics` (preferred) and falls back to `description`.
 * Returns `"Other"` if no rule matches.
 *
 * Keep all rules in this single table so they are easy to inspect, extend,
 * and unit-test.
 */
const RULES: Array<{ category: Category; keywords: string[] }> = [
  {
    category: "LLM",
    keywords: [
      "llm",
      "llms",
      "gpt",
      "gpts",
      "language-model",
      "language model",
      "transformer",
      "transformers",
      "chatgpt",
      "claude",
      "llama",
      "codellama",
    ],
  },
  {
    category: "Agents",
    keywords: ["agent", "agents", "autonomous", "autogpt", "multi-agent", "agentic"],
  },
  {
    category: "RAG",
    keywords: [
      "rag",
      "retrieval-augmented",
      "retrieval augmented",
      "vector-database",
      "vector database",
      "embedding",
      "embeddings",
    ],
  },
  {
    category: "Vision",
    keywords: [
      "computer-vision",
      "computer vision",
      "object-detection",
      "yolo",
      // Common YOLO version aliases. The leading-boundary rule used by
      // matchKeyword() rejects "yolov<N>" against the bare "yolo" keyword
      // (the trailing "v" is a letter), so each shipped major version is
      // listed explicitly. Add new ones here as they become common.
      "yolov3",
      "yolov4",
      "yolov5",
      "yolov7",
      "yolov8",
      "yolov9",
      "yolov10",
      "segmentation",
      "ocr",
    ],
  },
  {
    category: "Audio",
    keywords: ["speech", "audio", "tts", "asr", "whisper", "voice", "voices"],
  },
  {
    category: "Image",
    keywords: [
      "image-generation",
      "diffusion",
      "diffusions",
      "stable-diffusion",
      "txt2img",
      "text-to-image",
      "image generation",
    ],
  },
  {
    category: "Tooling",
    keywords: [
      "framework",
      "frameworks",
      "toolkit",
      "toolkits",
      "sdk",
      "sdks",
      "platform",
      "platforms",
      "infrastructure",
      "mlops",
      "fine-tuning",
      "fine tuning",
    ],
  },
];

/**
 * Match a keyword against a haystack with these rules:
 *
 *   - Multi-token keywords (containing whitespace or a hyphen, e.g.
 *     `"language-model"`, `"retrieval augmented"`, `"vector-database"`) use a
 *     plain substring match. Hyphens / spaces already act as natural word
 *     separators inside topics and descriptions, so substring is safe.
 *
 *   - Single-token keywords (`"gpt"`, `"voice"`, `"llama"`, `"yolo"`, …) must
 *     appear at a *word start* AND must NOT be immediately followed by another
 *     letter. The regex is `\\bkw(?![a-z])`. This:
 *       • blocks mid-word matches    — "gpt"  in "autogpt"  / "chatgpt"
 *       • blocks letter-suffix words — "rag"  in "rage" / "rags" / "ragtime"
 *                                       "voice" in "invoice"
 *                                       "agent" in "reagent"
 *                                       "audio" in "claudio"
 *       • allows digit / hyphen / underscore suffixes — "gpt4", "gpt-4",
 *         "llama2", "llama-2", "rag-pipeline".
 *
 * Why a *negative lookahead* `(?![a-z])` instead of a trailing `\\b`: in JS,
 * `\\b` exists between a letter and a non-word char, but NOT between a letter
 * and a digit (both are `\\w`). So `\\bgpt\\b` would miss "gpt4" / "gpt2", and
 * `\\byolo\\b` would miss "yolov5" — extremely common AI topics on GitHub.
 * `(?![a-z])` lets us reject letter suffixes only, while still permitting
 * digits and other non-letter characters.
 *
 * Compound forms whose keyword is *embedded* in another word (e.g. `codellama`
 * = code + llama, `chatgpt` = chat + gpt) are not reachable by this rule —
 * those are listed in `RULES` above as their own explicit aliases instead.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchKeyword(haystack: string, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  if (/[\s-]/.test(needle)) {
    return haystack.includes(needle);
  }
  const re = new RegExp(`\\b${escapeRegex(needle)}(?![a-z])`);
  return re.test(haystack);
}

export function classifyCategory(input: Pick<Repo, "topics" | "description">): Category {
  const haystacks: string[] = [];
  for (const t of input.topics ?? []) haystacks.push(t.toLowerCase());
  if (input.description) haystacks.push(input.description.toLowerCase());

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      for (const h of haystacks) {
        if (matchKeyword(h, kw)) return rule.category;
      }
    }
  }
  return "Other";
}

export const ALL_CATEGORIES: Category[] = [
  "LLM",
  "Agents",
  "RAG",
  "Vision",
  "Audio",
  "Image",
  "Tooling",
  "Other",
];
