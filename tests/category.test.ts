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
    // gpts / llms / transformers plural / family forms
    expect(classifyCategory({ topics: ["gpts"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["llms"], description: null })).toBe("LLM");
    expect(classifyCategory({ topics: ["transformers"], description: null })).toBe("LLM");
  });

  it("classifies plural / family aliases consistently across categories (PR #5 review)", () => {
    // Tooling plurals must classify as Tooling, not fall through to Other
    expect(classifyCategory({ topics: ["frameworks"], description: null })).toBe("Tooling");
    expect(classifyCategory({ topics: ["toolkits"], description: null })).toBe("Tooling");
    expect(classifyCategory({ topics: ["sdks"], description: null })).toBe("Tooling");
    expect(classifyCategory({ topics: ["platforms"], description: null })).toBe("Tooling");
    // YOLO common variants beyond v5 / v8 must classify as Vision
    expect(classifyCategory({ topics: ["yolov3"], description: null })).toBe("Vision");
    expect(classifyCategory({ topics: ["yolov4"], description: null })).toBe("Vision");
    expect(classifyCategory({ topics: ["yolov7"], description: null })).toBe("Vision");
    expect(classifyCategory({ topics: ["yolov9"], description: null })).toBe("Vision");
    expect(classifyCategory({ topics: ["yolov10"], description: null })).toBe("Vision");
    // Audio plural
    expect(classifyCategory({ topics: ["voices"], description: null })).toBe("Audio");
    // Image plural
    expect(classifyCategory({ topics: ["diffusions"], description: null })).toBe("Image");
  });

  it("does not let short keywords letter-suffix-match unrelated words (PR #4 review)", () => {
    // 'rag' (RAG) must not match 'rage' / 'rags' / 'ragtime'
    expect(classifyCategory({ topics: [], description: "rage in the engine" })).toBe("Other");
    expect(classifyCategory({ topics: ["ragtime"], description: null })).toBe("Other");
    expect(classifyCategory({ topics: [], description: "the rags-to-riches saga" })).toBe("Other");
    // 'voice' (Audio) must not match 'invoice'
    expect(
      classifyCategory({ topics: [], description: "invoice management system" }),
    ).toBe("Other");
    // 'agent' (Agents) must not match 'reagent'
    expect(
      classifyCategory({ topics: [], description: "reagent chemistry library" }),
    ).toBe("Other");
    // 'audio' (Audio) must not match 'claudio'
    expect(classifyCategory({ topics: ["claudio"], description: null })).toBe("Other");
    // 'llm' (LLM) must not match a fictional 'llmix' / 'llmate' word
    expect(
      classifyCategory({ topics: [], description: "an llmix benchmark suite" }),
    ).toBe("Other");
    // Sanity: real, valid uses of those same keywords still classify correctly
    expect(classifyCategory({ topics: ["voice"], description: null })).toBe("Audio");
    expect(classifyCategory({ topics: ["rag"], description: null })).toBe("RAG");
    expect(classifyCategory({ topics: ["agent"], description: null })).toBe("Agents");
    expect(classifyCategory({ topics: ["audio"], description: null })).toBe("Audio");
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
