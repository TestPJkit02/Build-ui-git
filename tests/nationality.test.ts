import { describe, expect, it } from "vitest";
import { countryFlag, countryName, locationToCountry } from "../lib/nationality";

describe("locationToCountry", () => {
  it("returns null for null / undefined / empty / whitespace", () => {
    expect(locationToCountry(null)).toBeNull();
    expect(locationToCountry(undefined)).toBeNull();
    expect(locationToCountry("")).toBeNull();
    expect(locationToCountry("   ")).toBeNull();
  });

  it("returns null for unmappable text", () => {
    expect(locationToCountry("Earth")).toBeNull();
    expect(locationToCountry("the matrix")).toBeNull();
    expect(locationToCountry("¯\\_(ツ)_/¯")).toBeNull();
  });

  it("maps full country names", () => {
    expect(locationToCountry("Vietnam")).toBe("VN");
    expect(locationToCountry("Germany")).toBe("DE");
    expect(locationToCountry("Japan")).toBe("JP");
    expect(locationToCountry("Australia")).toBe("AU");
  });

  it("maps multi-word country names ahead of substring collisions", () => {
    expect(locationToCountry("United States")).toBe("US");
    expect(locationToCountry("United Kingdom")).toBe("GB");
    expect(locationToCountry("South Korea")).toBe("KR");
    expect(locationToCountry("New Zealand")).toBe("NZ");
    expect(locationToCountry("Czech Republic")).toBe("CZ");
  });

  it("maps common aliases", () => {
    expect(locationToCountry("USA")).toBe("US");
    expect(locationToCountry("UK")).toBe("GB");
    expect(locationToCountry("VN")).toBe("VN");
    expect(locationToCountry("UAE")).toBe("AE");
    expect(locationToCountry("Brasil")).toBe("BR");
    expect(locationToCountry("Türkiye")).toBe("TR");
  });

  it("is case-insensitive", () => {
    expect(locationToCountry("germany")).toBe("DE");
    expect(locationToCountry("FRANCE")).toBe("FR");
    expect(locationToCountry("VietNam")).toBe("VN");
  });

  it("maps city, country forms by city when full country is also present", () => {
    // Country wins over city because country tokens are checked first.
    expect(locationToCountry("Ho Chi Minh, Vietnam")).toBe("VN");
    expect(locationToCountry("Berlin, Germany")).toBe("DE");
    expect(locationToCountry("San Francisco, USA")).toBe("US");
  });

  it("maps cities when country is absent", () => {
    expect(locationToCountry("San Francisco")).toBe("US");
    expect(locationToCountry("Berlin")).toBe("DE");
    expect(locationToCountry("Tokyo")).toBe("JP");
    expect(locationToCountry("Bangalore")).toBe("IN");
    expect(locationToCountry("Tel Aviv")).toBe("IL");
    expect(locationToCountry("São Paulo")).toBe("BR");
  });

  it("maps city abbreviations", () => {
    expect(locationToCountry("SF")).toBe("US");
    expect(locationToCountry("NYC")).toBe("US");
  });

  it("handles word boundaries — does not match inside other words", () => {
    // "us" inside "Russia" should NOT match — Russia takes precedence anyway.
    expect(locationToCountry("Russia")).toBe("RU");
    // "in" inside "Beijing" should NOT match the IN code.
    expect(locationToCountry("Beijing")).toBe("CN");
    // "us" inside "Houston" should NOT match the US code by itself; Houston
    // isn't in our city table so this should return null.
    expect(locationToCountry("Houston")).toBeNull();
  });

  it("matches when separator is a punctuation mark or slash", () => {
    expect(locationToCountry("Hanoi - Vietnam")).toBe("VN");
    expect(locationToCountry("Munich, Germany")).toBe("DE");
    expect(locationToCountry("Tokyo / Japan")).toBe("JP");
  });

  it("handles common GitHub bio location strings", () => {
    expect(locationToCountry("Mountain View, CA")).toBe("US");
    expect(locationToCountry("Bay Area")).toBe("US");
    expect(locationToCountry("Silicon Valley")).toBe("US");
    expect(locationToCountry("London, UK")).toBe("GB");
    expect(locationToCountry("Stockholm, Sweden")).toBe("SE");
  });

  it("returns null when input is non-string", () => {
    // @ts-expect-error — runtime guard, not type-safe
    expect(locationToCountry(42)).toBeNull();
    // @ts-expect-error — runtime guard, not type-safe
    expect(locationToCountry({})).toBeNull();
  });
});

describe("countryFlag", () => {
  it("emits the correct regional indicator pair", () => {
    expect(countryFlag("US")).toBe("🇺🇸");
    expect(countryFlag("VN")).toBe("🇻🇳");
    expect(countryFlag("DE")).toBe("🇩🇪");
    expect(countryFlag("JP")).toBe("🇯🇵");
  });

  it("normalises lowercase input", () => {
    expect(countryFlag("us")).toBe("🇺🇸");
    expect(countryFlag("vn")).toBe("🇻🇳");
  });

  it("returns empty string for null / undefined / wrong-length input", () => {
    expect(countryFlag(null)).toBe("");
    expect(countryFlag(undefined)).toBe("");
    expect(countryFlag("")).toBe("");
    expect(countryFlag("USA")).toBe("");
    expect(countryFlag("X")).toBe("");
  });
});

describe("countryName", () => {
  it("returns the display name for known codes", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("VN")).toBe("Vietnam");
    expect(countryName("GB")).toBe("United Kingdom");
  });

  it("returns the upper-cased code for unknown codes", () => {
    expect(countryName("XX")).toBe("XX");
    expect(countryName("zz")).toBe("ZZ");
  });

  it("returns empty string for null / undefined / empty", () => {
    expect(countryName(null)).toBe("");
    expect(countryName(undefined)).toBe("");
    expect(countryName("")).toBe("");
  });
});
