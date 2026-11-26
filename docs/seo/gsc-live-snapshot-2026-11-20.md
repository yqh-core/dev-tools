# GSC query and landing-page snapshot — 2026-11-20

Property: sc-domain:digdevbox.com  
Source: authenticated Google Search Console via Supermetrics data source GW.  
Ranges: rolling last 90 days and last 28 days as returned on 2026-11-20. The country rollup request was served from cache at 2026-11-20T07:29:26Z; other pulls were uncached. These are source-reported metrics, not estimates.

## 90-day country view

| Country | Clicks | Impressions | CTR | Average position |
|---|---:|---:|---:|---:|
| United States (USA) | 0 | 67 | 0% | 26.403 |
| Thailand (THA) | 0 | 74 | 0% | 9.8919 |
| Taiwan (TWN) | 1 | 65 | 1.54% | 10.0769 |
| Singapore (SGP) | 0 | 11 | 0% | 8.3636 |
| Hong Kong (HKG) | 1 | 12 | 8.33% | 14.6667 |
| Japan (JPN) | 1 | 10 | 10% | 14.7 |
| United Kingdom (GBR) | 0 | 4 | 0% | 32.5 |
| Germany (DEU) | 0 | 4 | 0% | 52 |
| Canada (CAN) | 0 | 4 | 0% | 7.75 |

The 90-day country rollup returned 67 US impressions and no clicks. This supersedes earlier approximate snapshots (65 impressions / average position 27.15) for this connector pull. Country-level data is sparse and should not be over-interpreted.

## 28-day country/query signal

The query+page+country report returned 21 impressions and 1 click in its visible output; the US row was 15 impressions, 0 clicks, average position 5.1333. The query-only report returned 21 impressions and 1 click in the unknown-query bucket plus five visible low-volume query rows. This reflects query anonymization/aggregation and is not a complete list of user searches.

## 90-day page-level opportunities

| Landing page | Clicks | Impressions | CTR | Average position | Assessment |
|---|---:|---:|---:|---:|---|
| https://digdevbox.com/percentage-calculator/ | 0 | 150 | 0% | 9.1667 | Highest measured snippet opportunity; query breakdown is largely hidden. Inspect current snippet and available query evidence before changing title. |
| https://digdevbox.com/percentage-calculator (slashless) | 0 | 74 | 0% | 8.2568 | Redirect/canonical variant; one page, not a second keyword target. |
| https://ip.digdevbox.com/ | 1 | 35 | 2.86% | 23 | Existing traction, overall average position page 3; US slice has 6 impressions, 0 clicks, position 61.8333. |
| https://digdevbox.com/eta-calculator/ | 0 | 21 | 0% | 39.619 | Visible terms include ETA/project/software-development phrases. Clarify the specific calculation use case; don't force generic transport ETA wording. |
| https://digdevbox.com/regex-tester/ | 0 | 11 | 0% | 78.2727 | Low current visibility. US slice: 4 impressions, 0 clicks, position 82.75. Useful examples and guide links are warranted, but this is not a near-page-one quick win. |
| https://digdevbox.com/rmb-uppercase/ | 0 | 10 | 0% | 7.1 | Chinese-language intent, not US-English priority. |
| https://digdevbox.com/numeronym-generator/ | 0 | 9 | 0% | 6.7778 | Promising-looking position but tiny sample and ambiguous query intent. |
| https://digdevbox.com/ | 2 | 10 | 20% | 12 | Homepage has the largest click count among listed pages; protect existing snippet and improve category discovery/internal links. |
| https://digdevbox.com/pdf-signature-checker | 1 | 2 | 50% | 5 | Tiny sample; retain and monitor, no conclusion from CTR. |
| https://digdevbox.com/htpasswd-generator/ | 0 | 4 | 0% | 23.25 | Small signal; align copy with htpasswd / Apache / Nginx intent and validate Bing data. |
| https://play.digdevbox.com/docs | 0 | 4 | 0% | 45 | StreamPlay documentation visibility; distinguish docs from player/analyzer landing page. |
| https://draw.digdevbox.com/ | 0 | 4 | 0% | 5.75 | ImageForge homepage has very low sample; brand query imageforge.dev appeared once in query rows. |
| https://notes.digdevbox.com/posts/ | 0 | 10 | 0% | 5 | Editorial index appears for some searches; strengthen topic-specific article links and unique page descriptions. |

Additional page-level rows with small counts: date converter (3 impressions), camera recorder (6), Morse converter (4), RSA key pair generator (2), MIME types (2), px/rem converter (2), text statistics (4), SQL prettify (2), plus policy/about/legacy URLs. Do not optimize pages on one or two impressions without stronger query or conversion evidence.

## Visible query rows (90 days)

The query-only report returned 328 impressions under the unknown bucket (4 clicks, 1.22% CTR, average position 10.2927). The remaining visible queries are sparse:

| Query | Impressions | Clicks | Average position | Page association |
|---|---:|---:|---:|---|
| numeronym | 9 | 0 | 6.5556 | numeronym-generator |
| regular expression tester | 5 | 0 | 81 | regex-tester |
| regex tester | 2 | 0 | 83.5 | regex-tester |
| regex expression tester | 1 | 0 | 82 | regex-tester |
| htpasswd generator online | 1 | 0 | 51 | htpasswd-generator |
| ip geolocation | 1 | 0 | 94 | ip.digdevbox.com |
| IP country lookup (Chinese query variant) | 1 | 0 | 11 | ip.digdevbox.com |
| lipsum generator | 1 | 0 | 7 | lorem-ipsum-generator |
| private key generator | 1 | 0 | 67 | rsa-key-pair-generator |
| sql prettify | 1 | 0 | 45 | sql-prettify |
| aws vpc subnet calculator | 1 | 0 | 65 | ipv4-subnet-calculator |
| estimated time of arrival / ETA variants | 7 visible rows combined | 0 | mostly 41–98 | eta-calculator |

The query+page+country report can show a small number of query/page rows while the query-only report attributes most data to unknown. Do not treat visible queries as exhaustive or derive total page impressions by summing visible queries.

## Prioritization updated from this pull

1. Percentage Calculator — P0 for snippet/query diagnosis. 224 impressions across slash and canonical variants, zero clicks, average positions around 8–9. The US page list did not show it, so this is not evidence of US demand. Keep one canonical URL and inspect exact query availability/current title/snippet before changing metadata.
2. IP Locator — P1 for US relevance and page differentiation. 35 impressions / 1 click overall; 6 US impressions at average position 61.8. Add US-focused examples only if they accurately describe data coverage and tool behavior.
3. Homepage — protect. 2 clicks from 10 impressions; small sample but already contributes a large share of page-level clicks.
4. Regex Tester — P1 content improvement, not a quick ranking win. Existing relevant query family but current page-level position around 78 and US position around 83. Build stronger task-focused examples and guide links; do not claim it is already page-one.
5. ETA Calculator — P2 intent clarification. Queries are ambiguous and average positions weak. Explain whether this is task-completion time, estimated time of arrival, or both; don't optimize toward unrelated transport ETA if the product is a work-progress calculator.
6. Basic Auth / SafeLink / HTTP Status / StreamPlay — retain Bing-derived candidates. GSC rows are sparse or absent in this 90-day page extract. Cross-check Bing before calling them proven Google opportunities.

## Important interpretation

- The 90-day aggregate baseline previously reported was 391 impressions / 4 clicks / 1.02% CTR. The page extract shows 4 clicks distributed across homepage, PDF signature checker and IP Locator, consistent with that click total; page impressions in the extract are not a substitute for the aggregate total because GSC can suppress or bucket rows.
- US search presence remains weak: 67 impressions and 0 clicks over 90 days. This is the most important market-specific signal.
- A high average position on one or two impressions is not a stable ranking.
- GSC does not provide reliable keyword volume or keyword difficulty. Use this data to validate relevance and page performance, not to invent market demand.
- Search Console does not expose every query. The unknown bucket is a material limitation, not a keyword to target.

## Next data pulls

- Query and page reports segmented by device and country, with USA-only page/query data.
- Compare 28-day vs previous 28-day and 90-day vs previous 90-day at page level.
- Export Bing Webmaster query/page rows for all nine site hosts.
- Fetch all nine production sitemaps to complete the canonical URL map.
- Where query anonymization prevents keyword diagnosis, use SERP inspection and external keyword research tools; record volume/difficulty only when a source and date are available.
