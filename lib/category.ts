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
    keywords: ["llm", "gpt", "language-model", "language model", "transformer", "chatgpt", "claude", "llama"],
  },
  {
    category: "Agents",
    keywords: ["agent", "autonomous", "autogpt", "multi-agent", "agentic"],
  },
  {
    category: "RAG",
    keywords: ["rag", "retrieval-augmented", "retrieval augmented", "vector-database", "vector database", "embedding"],
  },
  {
    category: "Vision",
    keywords: ["computer-vision", "computer vision", "object-detection", "yolo", "segmentation", "ocr"],
  },
  {
    category: "Audio",
    keywords: ["speech", "audio", "tts", "asr", "whisper", "voice"],
  },
  {
    category: "Image",
    keywords: ["image-generation", "diffusion", "stable-diffusion", "txt2img", "text-to-image", "image generation"],
  },
  {
    category: "Tooling",
    keywords: ["framework", "toolkit", "sdk", "platform", "infrastructure", "mlops", "fine-tuning", "fine tuning"],
  },
];

/**
 * Match a keyword against a haystack with smarter rules:
 *   - Very short ambiguous keywords (≤ 3 chars, no whitespace/hyphen) require
 *     the keyword to be at a *word start* (leading word-boundary `\bkw`). This
 *     stops "gpt" from matching inside "autogpt"/"chatgpt", "rag" inside
 *     "fragment", "llm" inside random words, etc. — but still allows compound
 *     topics where the keyword leads, like "gpt-4", "gpt4", "rag-pipeline",
 *     "llms", "asr-models".
 *   - Everything else (≥ 4 chars or multi-token) uses plain substring match so
 *     the classifier still catches "language-model", "retrieval augmented",
 *     "yolov5", "llama2", "codellama", "agents", etc.
 *
 * Why `\bkw` (leading) instead of `\bkw\b` (both sides): `\b` does not exist
 * between a letter and a digit (both are `\w`), so `\bgpt\b` would miss
 * "gpt4" / "gpt2", and `\byolo\b` would miss "yolov5" — those are extremely
 * common AI topics on GitHub.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchKeyword(haystack: string, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  if (needle.length <= 3 && !/[\s-]/.test(needle)) {
    const re = new RegExp(`\\b${escapeRegex(needle)}`);
    return re.test(haystack);
  }
  return haystack.includes(needle);
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
