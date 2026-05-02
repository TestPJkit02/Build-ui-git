import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES, classifyCategory } from "../lib/category";

describe("classifyCategory", () => {
  it("classifies LLM repos by topic", () => {
    expect(classifyCategory({ topics: ["llm", "ml"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["language-model"], description: null })).toBe("LLM");
  });

  it("classifies Agents repos", () => {
    expect(classifyCategory({ topics: ["agent", "autogpt"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["multi-agent"], description: null })).toBe("Agents");
  });

  it("classifies RAG by retrieval-augmented topic", () => {
    expect(
      classifyCategory({ topics: ["retrieval-augmented"], description: null }),
    ).toBe("RAG");
  });

  it("classifies Vision repos", () => {
    expect(classifyCategory({ topics: ["computer-vision"], description: null })).toBe("Vision");
    expect(classifyCategory({ topics: ["yolo"], description: null })).toBe("Vision");
  });

  it("classifies Audio repos", () => {
    expect(classifyCategory({ topics: ["whisper", "speech"], description: null })).toBe("Audio");
  });

  it("classifies Image generation", () => {
    expect(classifyCategory({ topics: ["stable-diffusion"], description: null })).toBe("Image");
  });

  it("classifies Tooling fallback when only generic topics are present", () => {
    expect(classifyCategory({ topics: ["framework"], description: null })).toBe("Tooling");
  });

  it("falls back to Other when nothing matches", () => {
    expect(classifyCategory({ topics: ["random-topic"], description: "a database" })).toBe("Other");
  });

  it("uses description when topics are empty", () => {
    expect(
      classifyCategory({
        topics: [],
        description: "A toolkit for fine-tuning open weight models",
      }),
    ).toBe("Tooling");
  });

  it("is case-insensitive on description", () => {
    expect(
      classifyCategory({ topics: [], description: "Build a Vector Database for RAG" }),
    ).toBe("RAG");
  });

  it("handles missing topics gracefully", () => {
    // simulate missing array (defensive)
    expect(
      classifyCategory({ topics: undefined as unknown as string[], description: "An LLM agent runtime" }),
    ).toBe("LLM");
  });

  it("exports all category labels", () => {
    expect(ALL_CATEGORIES).toContain("LLM");
    expect(ALL_CATEGORIES).toContain("Other");
    expect(ALL_CATEGORIES.length).toBeGreaterThanOrEqual(8);
  });
});
