# Bing query and SERP competitor research — 2026-11-20

## Bing Webmaster live pull

Property: https://digdevbox.com/  
Source: authenticated Bing Webmaster Tools via Supermetrics data source BW.  
Window: last 28 days, queried 2026-11-20. QueryStats and PageStats were both returned successfully; the 90-day QueryStats request was served from cache at 2026-11-20T07:30:23Z and returned the same rows, so this note treats the uncached 28-day query/page pull as the reliable current slice.

### PageStats (28 days)

| Page | Impressions | Clicks | Average impression position |
|---|---:|---:|---:|
| https://digdevbox.com/basic-auth-generator/ | 33 | 0 | 6.24 |
| https://digdevbox.com/safelink-decoder/ | 23 | 0 | 7.00 |
| https://digdevbox.com/http-status-checker/ | 3 | 0 | 8.33 |
| https://ip.digdevbox.com/ | 2 | 0 | 4.00 |
| https://ip.digdevbox.com/docs | 2 | 0 | 8.00 |
| https://digdevbox.com/text-to-binary/ | 1 | 0 | 8.00 |
| https://play.digdevbox.com/ | 1 | 0 | 7.00 |

### QueryStats (28 days)

| Query | Impressions | Clicks | Average impression position |
|---|---:|---:|---:|
| basic auth generator | 17 | 0 | 5.41 |
| outlook safelink decoder | 3 | 0 | 9.00 |
| basic auth generateor (typo) | 2 | 0 | 6.00 |
| basic auth token generator | 2 | 0 | 5.00 |
| basic authorization generator | 2 | 0 | 9.00 |
| generator basic authentication | 2 | 0 | 8.50 |
| how to open the outlook safelink original url | 2 | 0 | 10.00 |
| http status checker | 2 | 0 | 9.00 |
| web basic auth generator | 2 | 0 | 7.00 |
| safelink decoder | 1 | 0 | 9.00 |
| decode outlook safelink | 1 | 0 | 4.00 |
| convert outlook safelinke to url | 1 | 0 | 6.00 |
| decode link outlook | 1 | 0 | 6.00 |
| get around outlook safelink | 1 | 0 | 3.00 |
| generate basic auth | 1 | 0 | 8.00 |
| html status code checker | 1 | 0 | 8.00 |

Note: the typo query is evidence of a user query, not a phrase to place in titles or copy. Preserve natural spelling and use it only as a query-matching clue.

## What this changes

1. Basic Auth Generator is the strongest immediate Bing opportunity: 33 page impressions, 17 exact-query impressions, average positions 6.24 / 5.41, and zero clicks. This is a snippet/CTR diagnosis before a ranking project.
2. SafeLink Decoder is also a clear quick-win candidate: 23 page impressions, with Outlook Safe Links-related queries around positions 3–10, but zero clicks. The page needs a compelling, trustworthy snippet and concise answer to the user's job: reveal the original destination without opening it.
3. HTTP Status Checker has a small but directly relevant signal (3 page impressions, 2 for “http status checker”); retain as P1/P2, not a broad campaign.
4. IP Locator has only 2 Bing page impressions in this 28-day pull, despite more GSC 90-day impressions. Do not over-prioritize from a single small sample.
5. StreamPlay homepage has one impression; its /docs page is absent from this PageStats top rows, and GSC returned only a few docs impressions. Need sitemap and page-level inspection before content expansion.

## SERP / competitor observations (qualitative, not volume data)

### Basic Auth header generator

Search results show competing tools that combine generation with decoding, explain the Authorization: Basic format, and clarify that Base64 is encoding rather than encryption. Some include username-colon limitations, UTF-8 handling, curl examples and browser-local processing. Examples:

- Free.Tools, Basic Auth Header Generator: https://free.tools/tools/basic-auth-header/
- Boneyard Tools, HTTP Basic Auth Header Generator: https://boneyardtools.com/dev/basic-auth-generator
- W3Schools Basic Auth Header Generator: https://www.w3schools.com/tools/tool_basic_auth.php

Implementation in this PR: title changed to “Basic Auth Header Generator — Create Authorization Header”; description now explicitly warns Base64 is not encryption and recommends HTTPS. This matches the observed query without inventing new features. Next, verify the production snippet after deployment. The current DigDevBox implementation is generate-only (username/password to Authorization: Basic header); do not advertise decoding unless that feature is implemented and tested. Add curl examples only after checking exact behavior; do not claim secrets are safe merely because the page is browser-based.

### Outlook Safe Links decoder

Search results emphasize Outlook / Microsoft 365, original destination, decoding without opening, and a warning that decoding does not establish link safety. Microsoft documentation confirms Safe Links wraps/rewrites URLs and can scan a link when clicked: https://learn.microsoft.com/en-us/defender-office-365/safe-links-about

Competing examples:
- ToolsKit Safe Links decoder: https://toolskit.cc/tools/safelinks-decoder
- RedirectSniffer Outlook Safe Links decoder: https://redirectsniffer.com/outlook-safe-links-decoder
- ToolsForThat SafeLink decoder: https://www.toolsforthat.com/tools/safelink-decoder

Implementation in this PR: title changed to “Outlook Safe Links Decoder — Reveal the Original URL”; description clarifies that decoding does not verify destination safety. This directly answers the observed query. Next, verify the production snippet and test supported host patterns before documenting wrapper-depth claims. Do not encourage bypassing Safe Links or clicking a suspicious destination.

### Percentage calculator

Competitor pages present a compact group of common tasks: percent of a number, what percent one number is of another, percentage change, percentage difference, adding/subtracting a percentage, reverse percentage, and percentage points. Examples:
- ToolkitJar: https://toolkitjar.com/tools/percentage-calculator
- JYE LABS: https://jyelabs.com/en/tools/percentage-calculator/
- Every Boring Tool: https://everyboringtool.com/calculators/percentage-calculator

Implementation in this PR: title changed to “Percentage Calculator — Percent of a Number & Percent Change”; description names the four current modes without claiming the six modes competitors may provide. GSC reports 224 impressions / 0 clicks across canonical and slashless variants, at positions around 8–9. The query set is largely anonymized and this URL did not appear in the US-only page slice, so this is a cautious snippet hypothesis, not a proven US-market win. Verify the rendered SERP after deployment.

### Regex tester

Current SERP competitors position around JavaScript-specific testing, live highlighting, capture groups, replace preview, cheat sheets, and privacy. More comprehensive tools such as regex101 cover many regex engines and debugging features. Examples:
- iTechGuides 2026 comparison: https://www.itechguides.com/best/regular-expression-testers/
- Shiklo Regex Tester: https://tools.shiklo.com/regex-tester/
- FreeDevTool Regex Tester: https://freedevtool.org/regex-tester

Opportunity: do not compete on multi-language regex flavors unless the product supports them. Position honestly as a quick JavaScript RegExp tester, explain browser-native behavior and supported flags/capture groups, and provide tested copy-paste examples. Improve guide-to-tool linking and answer common debugging questions.

## Next actions by priority

- P0: Basic Auth Generator — title/description hypothesis added in this PR; validate locale/build tests, then inspect the live Bing/Google snippet after deployment. Follow with feature tests for encoding, Unicode, username colon and curl examples before expanding body copy.
- P0: SafeLink Decoder — title/description hypothesis added in this PR; validate safety wording and local-only behavior, then inspect the live snippet. Test supported wrapper patterns and nested decoding before documenting those limits.
- P0: Percentage Calculator — title/description hypothesis added in this PR; validate the four existing modes and current canonical URL. Improve formulas/examples only where they match implemented calculations; do not add unsupported features or create a second URL.
- P1: HTTP Status Checker — improve examples for status and response headers, preserving exact live-request limitations.
- P1: Regex Tester — expand examples/guide coverage, but do not describe it as a high-ranking page or multi-engine competitor.

## Sources

- Google Search Console query/page/country exports: docs/seo/gsc-live-snapshot-2026-11-20.md
- DigDevBox public tool inventory: https://github.com/yqh-core/dev-tools/blob/main/README.md
- Microsoft Safe Links official explanation: https://learn.microsoft.com/en-us/defender-office-365/safe-links-about
- Competitor and SERP pages are listed inline above. SERP observations are qualitative; no competitor traffic or keyword volume is claimed.
