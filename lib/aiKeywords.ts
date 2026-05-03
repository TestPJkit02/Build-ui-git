/**
 * AI-keyword matcher for the VN-news aggregator.
 *
 * Two responsibilities:
 *   1. `isAiText(text)` — boolean filter for sources that aggregate
 *      general tech (e.g. Tinh Tế) where we want to include only the
 *      AI-related items.
 *   2. `aiScore(text)` — count of distinct AI keyword hits in a string,
 *      used by the trending ranker (`aiScore × recency_decay`).
 *
 * Matches both Vietnamese and English keywords case-insensitively.
 * Uses word-boundary regex for short / ambiguous tokens (`AI`, `LLM`,
 * `GPT`, `RAG`, `AGI`, `NLP`) to avoid false positives like `tai` /
 * `llmao` / `again`. Multi-word phrases are substring-matched after
 * lowercasing — adequate because Vietnamese words are whitespace-
 * separated.
 */

/** Short / ambiguous tokens — must hit on a word boundary. */
const WORD_BOUNDARY_KEYWORDS = [
  "ai",
  "llm",
  "gpt",
  "rag",
  "agi",
  "nlp",
  "asi",
] as const;

/** Multi-word or long enough to be safe under substring match. */
const SUBSTRING_KEYWORDS = [
  // English
  "machine learning",
  "deep learning",
  "neural network",
  "neural networks",
  "transformer",
  "diffusion",
  "stable diffusion",
  "midjourney",
  "openai",
  "anthropic",
  "chatgpt",
  "claude",
  "gemini",
  "copilot",
  "ollama",
  "huggingface",
  "hugging face",
  "langchain",
  "llamaindex",
  "vector database",
  "embedding",
  "fine-tuning",
  "fine tuning",
  "computer vision",
  "image generation",
  "speech recognition",
  "agentic",
  "autonomous agent",
  "multi-agent",
  "foundation model",
  "large language model",
  // Vietnamese
  "trí tuệ nhân tạo",
  "học máy",
  "học sâu",
  "mạng nơ-ron",
  "mạng nơron",
  "thị giác máy",
  "xử lý ngôn ngữ tự nhiên",
  "tạo ảnh",
  "sinh ảnh",
  "tác tử",
  "công cụ ai",
  "mô hình ngôn ngữ",
  "mô hình ai",
  "trợ lý ai",
] as const;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns true if any AI keyword is detected. Stops at the first hit
 * (cheaper than `aiScore` when only a yes/no is needed).
 */
export function isAiText(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  for (const kw of WORD_BOUNDARY_KEYWORDS) {
    if (new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(text)) return true;
  }
  for (const kw of SUBSTRING_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

/**
 * Count of distinct AI keyword hits in a string. Each keyword counts at
 * most once even if it appears multiple times — keeps the trending score
 * stable for repetitive titles.
 */
export function aiScore(text: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of WORD_BOUNDARY_KEYWORDS) {
    if (new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(text)) score += 1;
  }
  for (const kw of SUBSTRING_KEYWORDS) {
    if (lower.includes(kw)) score += 1;
  }
  return score;
}
