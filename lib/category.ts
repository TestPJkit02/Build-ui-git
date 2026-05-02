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
 *   - Short single-token keywords (≤ 5 chars, no whitespace/hyphen) require a
 *     word-boundary match. This prevents the LLM keyword "gpt" from matching
 *     inside the Agents topic "autogpt", or "rag" matching inside "fragment".
 *   - Longer or multi-token keywords use plain substring match so we can
 *     still catch phrases like "language-model" or "retrieval augmented".
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchKeyword(haystack: string, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  if (needle.length <= 5 && !/[\s-]/.test(needle)) {
    const re = new RegExp(`\\b${escapeRegex(needle)}\\b`);
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
