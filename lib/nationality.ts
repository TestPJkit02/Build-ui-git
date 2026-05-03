/**
 * Heuristic country derivation from a free-text GitHub `location` string.
 *
 * GitHub does not expose a structured nationality field — only a free-text
 * `location` (`Ho Chi Minh, Vietnam`, `San Francisco, CA`, `Earth`, `the
 * matrix`, …). This module maps that string to an ISO 3166-1 alpha-2 country
 * code via a hard-coded keyword table:
 *
 * 1) Lowercase + trim the input.
 * 2) Try each known country *name* / *alias* token (longest first) as a
 *    word-boundary substring match.
 * 3) If no country match, try the major-city table (also longest first).
 * 4) Otherwise return `null`.
 *
 * The match is *deliberately* lenient — many users write only a city, or
 * abbreviations like "SF" / "NYC". Returning `null` for unknowns is fine; the
 * UI shows `—`.
 *
 * Pure function, no side effects, no network calls.
 */

/**
 * Country names + common aliases → ISO 3166-1 alpha-2 codes.
 *
 * Keys MUST be lowercase. Multi-word entries are matched with word-boundary
 * regex; single-word entries with `\bword\b` to avoid false positives like
 * `"american samoa"` triggering `"america"` first.
 *
 * Order in this object does not matter — the matcher sorts by length desc.
 */
const COUNTRY_NAMES: Record<string, string> = {
  // Vietnam
  vietnam: "VN",
  "viet nam": "VN",
  vn: "VN",
  // United States
  "united states": "US",
  "united states of america": "US",
  america: "US",
  usa: "US",
  "u.s.a.": "US",
  "u.s.": "US",
  us: "US",
  // United Kingdom
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  // China
  china: "CN",
  prc: "CN",
  // Hong Kong
  "hong kong": "HK",
  hk: "HK",
  // Taiwan
  taiwan: "TW",
  // Japan
  japan: "JP",
  // Korea
  "south korea": "KR",
  korea: "KR",
  // Singapore
  singapore: "SG",
  // India
  india: "IN",
  // Indonesia
  indonesia: "ID",
  // Thailand
  thailand: "TH",
  // Philippines
  philippines: "PH",
  // Malaysia
  malaysia: "MY",
  // Australia
  australia: "AU",
  // New Zealand
  "new zealand": "NZ",
  // Canada
  canada: "CA",
  // Mexico
  mexico: "MX",
  // Brazil
  brazil: "BR",
  brasil: "BR",
  // Argentina
  argentina: "AR",
  // Chile
  chile: "CL",
  // Colombia
  colombia: "CO",
  // Germany
  germany: "DE",
  deutschland: "DE",
  // France
  france: "FR",
  // Spain
  spain: "ES",
  españa: "ES",
  // Italy
  italy: "IT",
  italia: "IT",
  // Portugal
  portugal: "PT",
  // Netherlands
  netherlands: "NL",
  holland: "NL",
  // Belgium
  belgium: "BE",
  // Switzerland
  switzerland: "CH",
  // Austria
  austria: "AT",
  // Sweden
  sweden: "SE",
  // Norway
  norway: "NO",
  // Finland
  finland: "FI",
  // Denmark
  denmark: "DK",
  // Iceland
  iceland: "IS",
  // Ireland
  ireland: "IE",
  // Poland
  poland: "PL",
  // Czechia
  "czech republic": "CZ",
  czechia: "CZ",
  // Russia
  russia: "RU",
  "russian federation": "RU",
  // Ukraine
  ukraine: "UA",
  // Turkey
  turkey: "TR",
  türkiye: "TR",
  // Israel
  israel: "IL",
  // United Arab Emirates
  uae: "AE",
  "united arab emirates": "AE",
  // Saudi Arabia
  "saudi arabia": "SA",
  // Egypt
  egypt: "EG",
  // South Africa
  "south africa": "ZA",
  // Nigeria
  nigeria: "NG",
  // Kenya
  kenya: "KE",
  // Greece
  greece: "GR",
  // Romania
  romania: "RO",
  // Hungary
  hungary: "HU",
  // Bulgaria
  bulgaria: "BG",
  // Serbia
  serbia: "RS",
  // Croatia
  croatia: "HR",
  // Slovenia
  slovenia: "SI",
  // Slovakia
  slovakia: "SK",
  // Estonia
  estonia: "EE",
  // Latvia
  latvia: "LV",
  // Lithuania
  lithuania: "LT",
  // Belarus
  belarus: "BY",
  // Pakistan
  pakistan: "PK",
  // Bangladesh
  bangladesh: "BD",
  // Sri Lanka
  "sri lanka": "LK",
  // Iran
  iran: "IR",
  // Iraq
  iraq: "IQ",
};

/**
 * Major cities → ISO 3166-1 alpha-2. Used as a fallback when no country name
 * appears in the location text. Keep this list focused on cities GitHub users
 * actually write (tech hubs first).
 */
const CITY_TO_COUNTRY: Record<string, string> = {
  // Vietnam
  "ho chi minh": "VN",
  "ho chi minh city": "VN",
  saigon: "VN",
  hanoi: "VN",
  "ha noi": "VN",
  "da nang": "VN",
  // China
  beijing: "CN",
  shanghai: "CN",
  shenzhen: "CN",
  guangzhou: "CN",
  hangzhou: "CN",
  // United States
  "san francisco": "US",
  sf: "US",
  "new york": "US",
  nyc: "US",
  "new york city": "US",
  brooklyn: "US",
  manhattan: "US",
  "los angeles": "US",
  "la, ca": "US",
  seattle: "US",
  boston: "US",
  cambridge: "US", // Disambig: Cambridge UK is rarely used alone in GH bios.
  chicago: "US",
  austin: "US",
  "palo alto": "US",
  "mountain view": "US",
  sunnyvale: "US",
  "santa clara": "US",
  "menlo park": "US",
  "bay area": "US",
  "silicon valley": "US",
  redmond: "US",
  bellevue: "US",
  // Canada
  toronto: "CA",
  vancouver: "CA",
  montreal: "CA",
  ottawa: "CA",
  // United Kingdom
  london: "GB",
  manchester: "GB",
  edinburgh: "GB",
  oxford: "GB",
  // Germany
  berlin: "DE",
  munich: "DE",
  münchen: "DE",
  hamburg: "DE",
  frankfurt: "DE",
  cologne: "DE",
  köln: "DE",
  // France
  paris: "FR",
  lyon: "FR",
  // Netherlands
  amsterdam: "NL",
  rotterdam: "NL",
  // Belgium
  brussels: "BE",
  // Switzerland
  zurich: "CH",
  geneva: "CH",
  zürich: "CH",
  // Sweden
  stockholm: "SE",
  // Norway
  oslo: "NO",
  // Finland
  helsinki: "FI",
  // Denmark
  copenhagen: "DK",
  // Spain
  madrid: "ES",
  barcelona: "ES",
  // Italy
  milan: "IT",
  milano: "IT",
  rome: "IT",
  roma: "IT",
  // Portugal
  lisbon: "PT",
  porto: "PT",
  // Austria
  vienna: "AT",
  // Czechia
  prague: "CZ",
  // Poland
  warsaw: "PL",
  krakow: "PL",
  // Ireland
  dublin: "IE",
  // Ukraine
  kyiv: "UA",
  kiev: "UA",
  // Russia
  moscow: "RU",
  "saint petersburg": "RU",
  // Turkey
  istanbul: "TR",
  ankara: "TR",
  // Israel
  "tel aviv": "IL",
  jerusalem: "IL",
  // Japan
  tokyo: "JP",
  osaka: "JP",
  kyoto: "JP",
  // Korea
  seoul: "KR",
  // Taiwan
  taipei: "TW",
  // Hong Kong
  kowloon: "HK",
  // Singapore (city == country, already covered)
  // India
  bangalore: "IN",
  bengaluru: "IN",
  mumbai: "IN",
  delhi: "IN",
  "new delhi": "IN",
  hyderabad: "IN",
  chennai: "IN",
  pune: "IN",
  // Indonesia
  jakarta: "ID",
  // Thailand
  bangkok: "TH",
  // Philippines
  manila: "PH",
  // Malaysia
  "kuala lumpur": "MY",
  // Australia
  sydney: "AU",
  melbourne: "AU",
  // Brazil
  "são paulo": "BR",
  "sao paulo": "BR",
  "rio de janeiro": "BR",
  // Argentina
  "buenos aires": "AR",
  // Mexico
  "mexico city": "MX",
  // South Africa
  "cape town": "ZA",
  johannesburg: "ZA",
  // Egypt
  cairo: "EG",
};

/**
 * Country flag emoji (regional indicator pair) by ISO 3166-1 alpha-2.
 *
 * Computed from the code on demand — no static map needed because regional
 * indicator symbols are at codepoints `0x1F1E6 + (letter - 'A')`.
 */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  const A = 0x41;
  const REGIONAL_A = 0x1f1e6;
  return String.fromCodePoint(
    REGIONAL_A + (upper.charCodeAt(0) - A),
    REGIONAL_A + (upper.charCodeAt(1) - A),
  );
}

/**
 * Display country names by ISO 3166-1 alpha-2. Only entries we actually map
 * to in the heuristic table.
 */
const COUNTRY_DISPLAY: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  VN: "Vietnam",
  CN: "China",
  HK: "Hong Kong",
  TW: "Taiwan",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  IN: "India",
  ID: "Indonesia",
  TH: "Thailand",
  PH: "Philippines",
  MY: "Malaysia",
  AU: "Australia",
  NZ: "New Zealand",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  DK: "Denmark",
  IS: "Iceland",
  IE: "Ireland",
  PL: "Poland",
  CZ: "Czechia",
  RU: "Russia",
  UA: "Ukraine",
  TR: "Turkey",
  IL: "Israel",
  AE: "UAE",
  SA: "Saudi Arabia",
  EG: "Egypt",
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  GR: "Greece",
  RO: "Romania",
  HU: "Hungary",
  BG: "Bulgaria",
  RS: "Serbia",
  HR: "Croatia",
  SI: "Slovenia",
  SK: "Slovakia",
  EE: "Estonia",
  LV: "Latvia",
  LT: "Lithuania",
  BY: "Belarus",
  PK: "Pakistan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  IR: "Iran",
  IQ: "Iraq",
};

/** Display country name for a code, or empty string for unknown / null. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  return COUNTRY_DISPLAY[code.toUpperCase()] ?? code.toUpperCase();
}

/**
 * Cache of compiled match entries, sorted by token length desc.
 *
 * Sorting longest-first ensures that `"new zealand"` matches before
 * `"zealand"` would (if such an entry existed) and that `"south korea"`
 * wins over a hypothetical `"korea"` entry — guarding against partial
 * substring collisions.
 */
const COUNTRY_ENTRIES: { token: string; code: string }[] = Object.entries(
  COUNTRY_NAMES,
)
  .map(([token, code]) => ({ token, code }))
  .sort((a, b) => b.token.length - a.token.length);

const CITY_ENTRIES: { token: string; code: string }[] = Object.entries(
  CITY_TO_COUNTRY,
)
  .map(([token, code]) => ({ token, code }))
  .sort((a, b) => b.token.length - a.token.length);

/**
 * Match a token (already lowercased) at a word boundary inside `haystack`.
 *
 * We use a manual boundary check rather than a regex constructor per token
 * because some tokens contain non-ASCII characters (`münchen`, `türkiye`,
 * `são paulo`) that would need escaping for `\b` to work the way we want.
 *
 * Boundary rule: the character before/after the match must NOT be a Unicode
 * letter or digit. This mirrors `\b` in JavaScript regex but works for the
 * full `\p{L}` set.
 */
function tokenAppears(haystack: string, token: string): boolean {
  let from = 0;
  while (from <= haystack.length - token.length) {
    const idx = haystack.indexOf(token, from);
    if (idx === -1) return false;
    const before = idx === 0 ? "" : haystack[idx - 1];
    const after =
      idx + token.length >= haystack.length ? "" : haystack[idx + token.length];
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = idx + 1;
  }
  return false;
}

function isWordChar(ch: string): boolean {
  if (ch === "") return false;
  // Letters (any script) or digits (any script).
  return /[\p{L}\p{N}]/u.test(ch);
}

/**
 * Map a free-text `location` string to an ISO 3166-1 alpha-2 country code.
 *
 * Matching strategy:
 *   1. Lowercase + trim.
 *   2. Try every country-name/alias token (longest first); first match wins.
 *   3. Try every city token (longest first); first match wins.
 *   4. Return `null` if nothing matched.
 *
 * Returns `null` for `null`, `undefined`, empty strings, joke strings
 * (`"earth"`, `"the matrix"`), or unmappable text.
 */
export function locationToCountry(loc: string | null | undefined): string | null {
  if (!loc || typeof loc !== "string") return null;
  const norm = loc.toLowerCase().trim();
  if (norm.length === 0) return null;

  for (const { token, code } of COUNTRY_ENTRIES) {
    if (tokenAppears(norm, token)) return code;
  }
  for (const { token, code } of CITY_ENTRIES) {
    if (tokenAppears(norm, token)) return code;
  }
  return null;
}
