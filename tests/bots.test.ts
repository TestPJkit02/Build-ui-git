import { describe, expect, it } from "vitest";
import { isBot, isBotLogin } from "../lib/bots";
import type { UserProfile } from "../lib/types";

function makeProfile(partial: Partial<UserProfile> & { login: string }): UserProfile {
  return {
    avatar_url: "",
    html_url: `https://github.com/${partial.login}`,
    type: "User",
    name: null,
    company: null,
    location: null,
    country: null,
    public_repos: 0,
    ...partial,
  };
}

describe("isBotLogin", () => {
  it("matches [bot] suffix (case-insensitive)", () => {
    expect(isBotLogin("dependabot[bot]")).toBe(true);
    expect(isBotLogin("github-actions[bot]")).toBe(true);
    expect(isBotLogin("RENOVATE[BOT]")).toBe(true);
  });

  it("matches -bot suffix", () => {
    expect(isBotLogin("renovate-bot")).toBe(true);
    expect(isBotLogin("snyk-bot")).toBe(true);
    expect(isBotLogin("Some-Random-Bot")).toBe(true);
  });

  it("matches known service accounts", () => {
    expect(isBotLogin("tensorflower-gardener")).toBe(true);
    expect(isBotLogin("actions-user")).toBe(true);
    expect(isBotLogin("snyk-bot")).toBe(true);
  });

  it("does not match human-looking logins", () => {
    expect(isBotLogin("torvalds")).toBe(false);
    expect(isBotLogin("ollama")).toBe(false);
    expect(isBotLogin("openai")).toBe(false);
    // -bot inside the login but not as suffix
    expect(isBotLogin("robot-warrior")).toBe(false);
  });

  it("does NOT treat live GitHub orgs as bots (avoid false positives)", () => {
    // These are live Organizations on GitHub — their *bots* (vercel[bot],
    // mergify[bot], dependabot[bot]) are caught by the [bot] suffix.
    expect(isBotLogin("vercel")).toBe(false);
    expect(isBotLogin("mergify")).toBe(false);
    expect(isBotLogin("dependabot")).toBe(false);
    expect(isBotLogin("github-actions")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isBotLogin("")).toBe(false);
  });
});

describe("isBot", () => {
  it("uses profile.type === 'Bot' as primary signal", () => {
    const profile = makeProfile({ login: "weird-account", type: "Bot" });
    expect(isBot("weird-account", profile)).toBe(true);
  });

  it("falls back to login heuristic when profile is missing", () => {
    expect(isBot("dependabot[bot]", undefined)).toBe(true);
    expect(isBot("torvalds", undefined)).toBe(false);
  });

  it("flags known service accounts even when GitHub returns type=User", () => {
    const profile = makeProfile({
      login: "tensorflower-gardener",
      type: "User",
    });
    expect(isBot("tensorflower-gardener", profile)).toBe(true);
  });

  it("returns false for a normal User account that matches no heuristic", () => {
    const profile = makeProfile({ login: "ollama", type: "Organization" });
    expect(isBot("ollama", profile)).toBe(false);
  });

  it("never treats Organizations as bots even if heuristic would match", () => {
    // The Organization-type guard supersedes the login heuristic, so an
    // org login that *would* otherwise match the known-bot list (e.g. an
    // org someone names "snyk-bot") is still not classified as a bot.
    const orgProfile = makeProfile({ login: "snyk-bot", type: "Organization" });
    expect(isBot("snyk-bot", orgProfile)).toBe(false);

    const vercelOrg = makeProfile({ login: "vercel", type: "Organization" });
    expect(isBot("vercel", vercelOrg)).toBe(false);
  });
});
