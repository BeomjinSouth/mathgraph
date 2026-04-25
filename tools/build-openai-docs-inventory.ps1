param(
    [string]$Output = "docs/openai-url-inventory.yaml",
    [string]$RelatedOutput = "docs/openai-related-links.md",
    [int]$Concurrency = 16,
    [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path ".").Path
$outPath = Join-Path $repoRoot $Output
$relatedPath = Join-Path $repoRoot $RelatedOutput
New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $relatedPath) | Out-Null

$nodeScript = @'
import fs from "node:fs/promises";
import path from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const output = args.get("--output");
const relatedOutput = args.get("--related-output");
const concurrency = Number(args.get("--concurrency") || 16);
const timeoutSeconds = Number(args.get("--timeout-seconds") || 20);

const now = new Date().toISOString();
const rootDomains = new Set([
  "developers.openai.com",
  "platform.openai.com",
]);
const officialLinkedDomains = new Set([
  "openai.com",
  "help.openai.com",
  "status.openai.com",
  "community.openai.com",
]);
const externalRelatedDomains = new Set([
  "github.com",
  "www.youtube.com",
  "youtube.com",
  "discord.com",
]);

const coreSummaryUrls = new Set([
  "https://developers.openai.com/",
  "https://developers.openai.com/api/docs/",
  "https://developers.openai.com/api/docs/models/",
  "https://developers.openai.com/api/docs/guides/latest-model/",
  "https://developers.openai.com/api/docs/guides/migrate-to-responses/",
  "https://developers.openai.com/api/docs/guides/text/",
  "https://developers.openai.com/api/docs/guides/structured-outputs/",
  "https://developers.openai.com/api/docs/guides/function-calling/",
  "https://developers.openai.com/api/docs/guides/tools/",
  "https://developers.openai.com/api/docs/guides/tools-web-search/",
  "https://developers.openai.com/api/docs/guides/tools-file-search/",
  "https://developers.openai.com/api/docs/guides/tools-connectors-mcp/",
  "https://developers.openai.com/api/docs/guides/tools-computer-use/",
  "https://developers.openai.com/api/docs/guides/conversation-state/",
  "https://developers.openai.com/api/docs/guides/background/",
  "https://developers.openai.com/api/docs/guides/streaming-responses/",
  "https://developers.openai.com/api/docs/guides/webhooks/",
  "https://developers.openai.com/api/docs/guides/prompt-caching/",
  "https://developers.openai.com/api/docs/guides/agents/",
  "https://developers.openai.com/api/docs/guides/agents/orchestration/",
  "https://developers.openai.com/api/docs/guides/agents/guardrails-approvals/",
  "https://developers.openai.com/api/docs/guides/realtime/",
  "https://developers.openai.com/api/docs/guides/evaluation-getting-started/",
  "https://developers.openai.com/api/docs/guides/evals/",
  "https://developers.openai.com/api/docs/guides/model-optimization/",
  "https://developers.openai.com/api/docs/guides/supervised-fine-tuning/",
  "https://developers.openai.com/api/docs/guides/image-generation/",
  "https://developers.openai.com/api/docs/guides/video-generation/",
  "https://developers.openai.com/api/docs/guides/embeddings/",
  "https://developers.openai.com/api/docs/guides/moderation/",
  "https://developers.openai.com/api/docs/guides/production-best-practices/",
  "https://developers.openai.com/api/docs/guides/deployment-checklist/",
  "https://developers.openai.com/codex/",
  "https://developers.openai.com/codex/guides/agents-md/",
  "https://developers.openai.com/codex/skills/",
  "https://developers.openai.com/codex/concepts/subagents/",
  "https://developers.openai.com/codex/app/browser/",
  "https://developers.openai.com/codex/app/computer-use/",
  "https://developers.openai.com/codex/agent-approvals-security/",
  "https://developers.openai.com/apps-sdk/",
  "https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt/",
  "https://developers.openai.com/apps-sdk/build/mcp-server/",
  "https://developers.openai.com/apps-sdk/build/chatgpt-ui/",
  "https://developers.openai.com/apps-sdk/guides/security-privacy/",
  "https://developers.openai.com/commerce/",
  "https://developers.openai.com/commerce/guides/get-started/",
  "https://developers.openai.com/commerce/guides/best-practices/",
  "https://platform.openai.com/tokenizer",
]);

const robotsDisallow = [
  { domain: "platform.openai.com", pattern: "/settings/*", reason: "robots_disallow_account_settings" },
  { domain: "platform.openai.com", pattern: "/finetune/*", reason: "robots_disallow_account_data" },
  { domain: "platform.openai.com", pattern: "/assistants/*", reason: "robots_disallow_account_data" },
  { domain: "platform.openai.com", pattern: "/threads/*", reason: "robots_disallow_account_data" },
  { domain: "platform.openai.com", pattern: "/batches/*", reason: "robots_disallow_account_data" },
  { domain: "platform.openai.com", pattern: "/usage/*", reason: "robots_disallow_account_usage" },
  { domain: "platform.openai.com", pattern: "/api-keys/*", reason: "robots_disallow_sensitive_keys" },
  { domain: "platform.openai.com", pattern: "/chat-completions/*", reason: "robots_disallow_account_data" },
  { domain: "platform.openai.com", pattern: "/evaluations/*", reason: "robots_disallow_account_data" },
];

function normalizeUrl(raw, base = "https://developers.openai.com/") {
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return null;
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    if (url.hostname === "developers.openai.com" && url.pathname !== "/" && !url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return url.toString();
  } catch {
    return null;
  }
}

function yamlQuote(value) {
  if (value === null || value === undefined) return "null";
  return JSON.stringify(String(value));
}

function mdEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "OpenAI-GuideLine-doc-inventory/1.0",
        "Accept": "text/html,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, finalUrl: response.url, text };
  } catch (error) {
    return { ok: false, status: null, finalUrl: url, text: "", error: error?.message || String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => decodeHtml(m[1]));
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const normalized = normalizeUrl(match[1], baseUrl);
    if (normalized) links.add(normalized);
  }
  return [...links];
}

function extractTitle(html, fallbackUrl) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) return decodeHtml(title);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return decodeHtml(h1.replace(/<[^>]+>/g, " "));
  return new URL(fallbackUrl).pathname;
}

function classify(urlString) {
  const url = new URL(urlString);
  const host = url.hostname;
  const p = url.pathname;
  if (host === "developers.openai.com") {
    if (p.startsWith("/api/reference/")) return "api_reference";
    if (p.startsWith("/api/docs/")) return "api_docs";
    if (p.startsWith("/codex/") || p === "/codex/") return "codex";
    if (p.startsWith("/apps-sdk/") || p === "/apps-sdk/") return "apps_sdk";
    if (p.startsWith("/commerce/") || p === "/commerce/") return "commerce";
    if (p.startsWith("/learn/") || p === "/learn/") return "learn";
    if (p.startsWith("/cookbook/") || p === "/cookbook/") return "cookbook";
    if (p.startsWith("/blog/") || p === "/blog/") return "blog";
    if (p.startsWith("/showcase/") || p === "/showcase/") return "showcase";
    if (p.startsWith("/community/") || p === "/community/") return "community";
    return "developer_home";
  }
  if (host === "platform.openai.com") return p === "/tokenizer" ? "platform_public" : "platform_account_or_login";
  if (host === "openai.com" && p.startsWith("/policies")) return "policy";
  if (host === "help.openai.com") return "help_center";
  if (officialLinkedDomains.has(host)) return "official_related";
  return "external_related";
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

const entries = new Map();
const related = new Map();

function addEntry(url, source, statusOverride = null) {
  const normalized = normalizeUrl(url, "https://developers.openai.com/");
  if (!normalized) return null;
  const host = new URL(normalized).hostname;
  const existing = entries.get(normalized) || {
    url: normalized,
    source: new Set(),
    domain: host,
    category: classify(normalized),
    status: statusOverride || "readable",
    http_status: null,
    title: null,
    summary_level: coreSummaryUrls.has(normalized) ? "core_summary" : "inventory_only",
    read_state: coreSummaryUrls.has(normalized) ? "core_summarized" : "read_inventory_checked",
    last_checked: now,
    fetch_error: null,
  };
  existing.source.add(source);
  if (statusOverride) existing.status = statusOverride;
  if (host === "platform.openai.com" && source !== "platform_sitemap" && !existing.source.has("platform_sitemap")) {
    existing.status = "excluded";
    existing.summary_level = "linked_only";
    existing.read_state = "excluded_platform_account_or_login";
  }
  entries.set(normalized, existing);
  return existing;
}

function addRelated(url, sourceUrl) {
  const normalized = normalizeUrl(url, sourceUrl);
  if (!normalized) return;
  const host = new URL(normalized).hostname;
  if (rootDomains.has(host)) return;
  const item = related.get(normalized) || {
    url: normalized,
    domain: host,
    category: classify(normalized),
    include_reason: officialLinkedDomains.has(host)
      ? "official_openai_related_link"
      : externalRelatedDomains.has(host)
        ? "external_related_link_only"
        : "external_related_link_only",
    sources: new Set(),
  };
  item.sources.add(sourceUrl);
  related.set(normalized, item);
  addEntry(normalized, "linked_from_docs", "excluded");
  const inventoryEntry = entries.get(normalized);
  inventoryEntry.summary_level = "linked_only";
  inventoryEntry.read_state = officialLinkedDomains.has(host) ? "official_link_inventory_only" : "excluded_external_link";
}

const devRobots = await fetchText("https://developers.openai.com/robots.txt");
const sitemapIndexUrl = normalizeUrl(devRobots.text.match(/Sitemap:\s*(\S+)/i)?.[1] || "/sitemap-index.xml", "https://developers.openai.com/");
const sitemapIndex = await fetchText(sitemapIndexUrl);
const sitemapUrls = extractLocs(sitemapIndex.text);
let developerSitemapUrls = [];
for (const sitemapUrl of sitemapUrls) {
  const sitemap = await fetchText(sitemapUrl);
  developerSitemapUrls.push(...extractLocs(sitemap.text).map((u) => normalizeUrl(u, sitemapUrl)).filter(Boolean));
}

const platformRobots = await fetchText("https://platform.openai.com/robots.txt");
const platformSitemapUrl = platformRobots.text.match(/Sitemap:\s*(\S+)/i)?.[1] || "https://platform.openai.com/sitemap.xml";
const platformSitemap = await fetchText(platformSitemapUrl);
const platformSitemapUrls = extractLocs(platformSitemap.text).map((u) => normalizeUrl(u, platformSitemapUrl)).filter(Boolean);

for (const url of developerSitemapUrls) addEntry(url, "developers_sitemap");
for (const url of platformSitemapUrls) addEntry(url, "platform_sitemap");

const home = await fetchText("https://developers.openai.com/");
if (home.text) {
  for (const link of extractLinks(home.text, "https://developers.openai.com/")) {
    const host = new URL(link).hostname;
    if (rootDomains.has(host)) addEntry(link, "developers_home_nav");
    else addRelated(link, "https://developers.openai.com/");
  }
}

const readableUrls = [...entries.values()]
  .filter((entry) => rootDomains.has(entry.domain) && entry.status === "readable")
  .map((entry) => entry.url);

await mapLimit(readableUrls, concurrency, async (url) => {
  const fetched = await fetchText(url);
  const entry = entries.get(url);
  entry.http_status = fetched.status;
  entry.last_checked = now;
  if (!fetched.ok) {
    entry.status = "failed";
    entry.read_state = "fetch_failed";
    entry.fetch_error = fetched.error || `HTTP ${fetched.status}`;
    return;
  }
  entry.title = extractTitle(fetched.text, fetched.finalUrl || url);
  if (fetched.finalUrl && normalizeUrl(fetched.finalUrl) !== url) {
    entry.final_url = normalizeUrl(fetched.finalUrl);
  }
  for (const link of extractLinks(fetched.text, fetched.finalUrl || url)) {
    const host = new URL(link).hostname;
    if (!rootDomains.has(host)) addRelated(link, url);
  }
});

const sortedEntries = [...entries.values()].sort((a, b) => a.url.localeCompare(b.url));
const sortedRelated = [...related.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.url.localeCompare(b.url));

const counts = {
  developers_sitemap_urls: new Set(developerSitemapUrls).size,
  platform_sitemap_urls: new Set(platformSitemapUrls).size,
  inventory_entries: sortedEntries.length,
  readable_official_entries: sortedEntries.filter((e) => rootDomains.has(e.domain) && e.status === "readable").length,
  failed_official_entries: sortedEntries.filter((e) => rootDomains.has(e.domain) && e.status === "failed").length,
  linked_related_entries: sortedEntries.filter((e) => !rootDomains.has(e.domain)).length,
  core_summary_entries: sortedEntries.filter((e) => e.summary_level === "core_summary").length,
};

const yaml = [];
yaml.push("version: 1");
yaml.push(`generated_at: ${yamlQuote(now)}`);
yaml.push('scope: "developers sitemap, platform public sitemap, official OpenAI/help/policy links, and external related links as inventory only"');
yaml.push("sources:");
yaml.push(`  developers_robots: ${yamlQuote("https://developers.openai.com/robots.txt")}`);
yaml.push(`  developers_sitemap_index: ${yamlQuote(sitemapIndexUrl)}`);
yaml.push("  developers_sitemaps:");
for (const sitemapUrl of sitemapUrls) yaml.push(`    - ${yamlQuote(sitemapUrl)}`);
yaml.push(`  platform_robots: ${yamlQuote("https://platform.openai.com/robots.txt")}`);
yaml.push(`  platform_sitemap: ${yamlQuote(platformSitemapUrl)}`);
yaml.push(`  developers_home_nav: ${yamlQuote("https://developers.openai.com/")}`);
yaml.push("counts:");
for (const [key, value] of Object.entries(counts)) yaml.push(`  ${key}: ${value}`);
yaml.push("robots_exclusions:");
for (const item of robotsDisallow) {
  yaml.push(`  - domain: ${yamlQuote(item.domain)}`);
  yaml.push(`    pattern: ${yamlQuote(item.pattern)}`);
  yaml.push(`    reason: ${yamlQuote(item.reason)}`);
}
yaml.push("entries:");
for (const entry of sortedEntries) {
  yaml.push(`  - url: ${yamlQuote(entry.url)}`);
  yaml.push("    source:");
  for (const source of [...entry.source].sort()) yaml.push(`      - ${yamlQuote(source)}`);
  yaml.push(`    domain: ${yamlQuote(entry.domain)}`);
  yaml.push(`    category: ${yamlQuote(entry.category)}`);
  yaml.push(`    status: ${yamlQuote(entry.status)}`);
  yaml.push(`    http_status: ${entry.http_status === null ? "null" : entry.http_status}`);
  yaml.push(`    title: ${yamlQuote(entry.title)}`);
  if (entry.final_url) yaml.push(`    final_url: ${yamlQuote(entry.final_url)}`);
  yaml.push(`    summary_level: ${yamlQuote(entry.summary_level)}`);
  yaml.push(`    read_state: ${yamlQuote(entry.read_state)}`);
  yaml.push(`    last_checked: ${yamlQuote(entry.last_checked)}`);
  if (entry.fetch_error) yaml.push(`    fetch_error: ${yamlQuote(entry.fetch_error)}`);
}

const md = [];
md.push("# OpenAI Related Links Inventory");
md.push("");
md.push(`Generated at: ${now}`);
md.push("");
md.push("This file records official adjacent links and external related links discovered from public OpenAI developer documentation. These links are inventory-only unless they are official OpenAI/help/policy sources explicitly summarized elsewhere.");
md.push("");
md.push("| Domain | Category | URL | Include reason | Source count | Sample source |");
md.push("| --- | --- | --- | --- | ---: | --- |");
for (const item of sortedRelated) {
  const sources = [...item.sources].sort();
  md.push(`| ${mdEscape(item.domain)} | ${mdEscape(item.category)} | ${mdEscape(item.url)} | ${mdEscape(item.include_reason)} | ${sources.length} | ${mdEscape(sources[0])} |`);
}

await fs.writeFile(output, yaml.join("\n") + "\n", "utf8");
await fs.writeFile(relatedOutput, md.join("\n") + "\n", "utf8");
console.log(JSON.stringify({ output, relatedOutput, counts }, null, 2));
'@

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("openai-docs-inventory-" + [System.Guid]::NewGuid().ToString("N") + ".mjs")
Set-Content -LiteralPath $tmp -Value $nodeScript -Encoding UTF8
try {
    node $tmp --output $outPath --related-output $relatedPath --concurrency $Concurrency --timeout-seconds $TimeoutSeconds
}
finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
}
