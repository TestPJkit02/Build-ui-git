import { describe, expect, it } from "vitest";
import { aiScore, isAiText } from "../lib/aiKeywords";

describe("isAiText — English", () => {
  it("matches short tokens on a word boundary", () => {
    expect(isAiText("AI is changing the world")).toBe(true);
    expect(isAiText("LLM apps are popular")).toBe(true);
    expect(isAiText("GPT-5 announced")).toBe(true);
  });

  it("does NOT match short tokens that are substrings of a larger word", () => {
    expect(isAiText("Trải nghiệm tại Đà Lạt")).toBe(false); // "tai" not "AI"
    expect(isAiText("the rain returns")).toBe(false);
    expect(isAiText("again and again")).toBe(false);
    expect(isAiText("llmao")).toBe(false);
  });

  it("matches multi-word phrases (substring is fine)", () => {
    expect(isAiText("machine learning at scale")).toBe(true);
    expect(isAiText("Deep Learning workshop")).toBe(true);
    expect(isAiText("a guide to neural networks")).toBe(true);
    expect(isAiText("transformer architecture overview")).toBe(true);
  });

  it("matches major brand keywords", () => {
    expect(isAiText("OpenAI announces o4")).toBe(true);
    expect(isAiText("Anthropic Claude 4 review")).toBe(true);
    expect(isAiText("Hands-on with ChatGPT")).toBe(true);
    expect(isAiText("Hugging Face spaces tutorial")).toBe(true);
  });
});

describe("isAiText — Vietnamese", () => {
  it("matches Vietnamese AI phrases", () => {
    expect(isAiText("Trí tuệ nhân tạo trong giáo dục")).toBe(true);
    expect(isAiText("Học máy ứng dụng thực tế")).toBe(true);
    expect(isAiText("Mô hình ngôn ngữ tiếng Việt")).toBe(true);
    expect(isAiText("Mạng nơ-ron tích chập")).toBe(true);
  });

  it("matches mixed VN/EN text", () => {
    expect(isAiText("Hướng dẫn dùng AI trong công việc")).toBe(true);
    expect(isAiText("OpenAI vừa ra mắt mô hình mới")).toBe(true);
  });

  it("matches without diacritics in EN-keyword phrases", () => {
    expect(isAiText("ChatGPT tiếng Việt")).toBe(true);
  });

  it("does not match Vietnamese sentences without AI keywords", () => {
    expect(isAiText("iPhone 16 ra mắt tại Việt Nam")).toBe(false);
    expect(isAiText("Tin tức công nghệ giải trí")).toBe(false);
  });
});

describe("aiScore", () => {
  it("counts each distinct keyword once", () => {
    expect(aiScore("AI AI AI")).toBe(1); // single-keyword repetition
  });

  it("counts multiple distinct keywords", () => {
    const txt = "OpenAI ChatGPT and Claude with deep learning";
    // openai + chatgpt + claude + deep learning => 4
    expect(aiScore(txt)).toBe(4);
  });

  it("returns 0 for non-AI text", () => {
    expect(aiScore("camera review on tinhte")).toBe(0);
  });

  it("scores high for keyword-dense Vietnamese titles", () => {
    const txt = "Trí tuệ nhân tạo và học máy: ứng dụng mạng nơ-ron trong xử lý ngôn ngữ tự nhiên";
    expect(aiScore(txt)).toBeGreaterThanOrEqual(4);
  });

  it("matches the boundary regex case-insensitively", () => {
    expect(aiScore("ai is here")).toBe(1);
    expect(aiScore("AI is here")).toBe(1);
  });

  it("returns 0 for empty input", () => {
    expect(aiScore("")).toBe(0);
  });
});
