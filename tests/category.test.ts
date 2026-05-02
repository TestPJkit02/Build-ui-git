import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES, classifyCategory } from "../lib/category";

describe("classifyCategory", () => {
  it("classifies LLM repos by topic", () => {
    expect(classifyCategory({ topics: ["llm", "ml"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["language-model"], description: null })).toBe("LLM");
  });

  it("classifies Agents repos", () => {
    expect(classifyCategory({ topics: ["agent", "autogpt"], description: null })).toBe("Agents");
    expect(classifyCategory({ topics: ["multi-agent"], description: null })).toBe("Agents");
    expect(classifyCategory({ topics: ["autogpt"], description: null })).toBe("Agents");
    expect(classifyCategory({ topics: ["agentic"], description: null })).toBe("Agents");
  });

  it("does not let short LLM keyword 'gpt' substring-match Agents topics", () => {
    // regression: "gpt" must not match inside "autogpt" / "chatgpt"-like agent topics
    expect(classifyCategory({ topics: ["autogpt"], description: null })).toBe("Agents");
    // ChatGPT-style topic still classified as LLM via the longer "chatgpt" keyword
    expect(classifyCategory({ topics: ["chatgpt"], description: null })).toBe("LLM");
    // Plain "gpt" / "gpt-4" / "gpt4" topic still classified as LLM (leading-boundary match)
    expect(classifyCategory({ topics: ["gpt"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["gpt-4"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["gpt4"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["gpt2"], description: null })).toBe("LLM");
  });

  it("does not let short RAG keyword 'rag' substring-match unrelated words", () => {
    expect(
      classifyCategory({ topics: [], description: "fragment shader benchmark" }),
    ).toBe("Other");
    expect(
      classifyCategory({ topics: [], description: "RAG pipeline tutorial" }),
    ).toBe("RAG");
    // "rag" topic and "rag-pipeline" topic both classify as RAG (leading-boundary)
    expect(classifyCategory({ topics: ["rag"], description: null })).toBe("RAG");
    expect(classifyCategory({ topics: ["rag-pipeline"], description: null })).toBe("RAG");
  });

  it("still matches digit-suffixed AI compound topics (regression for #2/#3)", () => {
    // llama2 / llama3 / codellama — Meta's Llama family
    expect(classifyCategory({ topics: ["llama2"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["llama3"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["codellama"], description: null })).toBe("LLM");
    // yolov5 / yolov8 — popular YOLO object-detection variants
    expect(classifyCategory({ topics: ["yolov5"], description: null })).toBe("Vision");
    expect(classifyCategory({ topics: ["yolov8"], description: null })).toBe("Vision");
    // "agents" plural topic
    expect(classifyCategory({ topics: ["agents"], description: null })).toBe("Agents");
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
