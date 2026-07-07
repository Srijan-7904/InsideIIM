import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

const TAVILY_BASE_URL = 'https://api.tavily.com';
const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const SEC_DATA_BASE_URL = 'https://data.sec.gov';

const CACHE_DIR = path.join(process.cwd(), '.cache');

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    // Ignore
  }
}

async function getCachedData(filename, ttlMs) {
  try {
    const filePath = path.join(CACHE_DIR, filename);
    const stats = await fs.stat(filePath);
    const age = Date.now() - stats.mtimeMs;
    if (age < ttlMs) {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    // Cache miss
  }
  return null;
}

async function setCachedData(filename, data) {
  try {
    await ensureCacheDir();
    const filePath = path.join(CACHE_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
  } catch (err) {
    // Ignore
  }
}

let cachedSecTickers = null;
let cachedSecTickersLoadedAt = 0;
let cachedSecTickersPromise = null;
const SEC_TICKERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RESEARCH_REPORT_CACHE_TTL_MS = 15 * 60 * 1000;
const cachedResearchReports = new Map();

function normalizeCompanyName(companyName) {
  return companyName.trim().replace(/\s+/g, ' ');
}

function companyKey(companyName) {
  return normalizeCompanyName(companyName).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function safeNumber(value) {
  if (value == null) return null;
  const raw = typeof value === 'object' && 'raw' in value ? value.raw : value;
  const parsed = Number.parseFloat(String(raw).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeText(value, fallback = 'Unavailable') {
  if (value == null) return fallback;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'object' && 'longBusinessSummary' in value && value.longBusinessSummary) return String(value.longBusinessSummary);
  if (typeof value === 'object' && 'name' in value && value.name) return String(value.name);
  if (typeof value === 'object' && 'fmt' in value && value.fmt) return String(value.fmt);
  if (typeof value === 'object' && 'raw' in value && value.raw != null) return String(value.raw);
  return fallback;
}

function formatBillions(value) {
  if (value == null) return 'N/A';
  return `$${(value / 1e9).toFixed(1)}B`;
}

function inferSentiment(text) {
  const lower = text.toLowerCase();
  const positiveSignals = ['beat', 'growth', 'record', 'strong', 'upside', 'raise', 'surge', 'launch', 'expansion', 'approval'];
  const negativeSignals = ['lawsuit', 'miss', 'cut', 'slowdown', 'decline', 'probe', 'layoff', 'pressure', 'downgrade', 'recall'];

  const positiveCount = positiveSignals.reduce((count, token) => count + (lower.includes(token) ? 1 : 0), 0);
  const negativeCount = negativeSignals.reduce((count, token) => count + (lower.includes(token) ? 1 : 0), 0);

  if (positiveCount > negativeCount) return 'Positive';
  if (negativeCount > positiveCount) return 'Negative';
  return 'Neutral';
}

async function fetchJson(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': `InsideIIMResearchAgent/1.0 (${env.SEC_API_KEY || 'contact@example.com'})`,
      ...(options.headers || {}),
    },
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed with ${response.status} from ${url}: ${body.slice(0, 240)}`);
  }

  return response.json();
}

async function getSecTickers() {
  const now = Date.now();
  if (cachedSecTickers && now - cachedSecTickersLoadedAt < SEC_TICKERS_CACHE_TTL_MS) {
    return cachedSecTickers;
  }

  if (!cachedSecTickersPromise) {
    cachedSecTickersPromise = (async () => {
      const diskCached = await getCachedData('sec_tickers.json', SEC_TICKERS_CACHE_TTL_MS);
      if (diskCached) {
        cachedSecTickers = diskCached;
        cachedSecTickersLoadedAt = Date.now();
        return diskCached;
      }

      const tickers = await fetchJson(SEC_TICKERS_URL);
      const normalized = Array.isArray(tickers)
        ? tickers
        : tickers && typeof tickers === 'object'
          ? Object.values(tickers)
          : [];

      cachedSecTickers = normalized;
      cachedSecTickersLoadedAt = Date.now();
      await setCachedData('sec_tickers.json', normalized);
      return normalized;
    })().finally(() => {
      cachedSecTickersPromise = null;
    });
  }

  return cachedSecTickersPromise;
}

async function searchSecCompany(companyName) {
  const target = companyKey(companyName);
  const tickers = await getSecTickers();

  const exact = tickers.find((entry) => {
    const name = companyKey(entry.title || '');
    const ticker = companyKey(entry.ticker || '');
    return name === target || ticker === target;
  });

  if (exact) {
    return exact;
  }

  const fuzzy = tickers.find((entry) => companyKey(entry.title || '').includes(target) || target.includes(companyKey(entry.title || '')));
  return fuzzy || null;
}

async function getSecSubmissions(cik) {
  const cikPadded = String(cik).padStart(10, '0');
  return fetchJson(`${SEC_DATA_BASE_URL}/submissions/CIK${cikPadded}.json`);
}

async function getSecCompanyFacts(cik) {
  const cikPadded = String(cik).padStart(10, '0');
  const filename = `sec_facts_${cikPadded}.json`;
  const SEC_FACTS_TTL = 4 * 60 * 60 * 1000; // 4 hours

  const diskCached = await getCachedData(filename, SEC_FACTS_TTL);
  if (diskCached) {
    return diskCached;
  }

  const data = await fetchJson(`${SEC_DATA_BASE_URL}/api/xbrl/companyfacts/CIK${cikPadded}.json`);
  await setCachedData(filename, data);
  return data;
}

function pickFacts(companyFacts, usGaapKey, unitsPreference = ['USD', 'shares']) {
  const facts = companyFacts?.facts?.['us-gaap'] || {};
  const fact = facts[usGaapKey];
  if (!fact) return [];

  for (const unit of unitsPreference) {
    const values = fact.units?.[unit];
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
  }

  const allUnits = Object.values(fact.units || {});
  return allUnits.find((value) => Array.isArray(value) && value.length > 0) || [];
}

function latestFact(companyFacts, usGaapKey) {
  const values = pickFacts(companyFacts, usGaapKey);
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => {
    const aEnd = new Date(a.end || a.filed || 0).getTime();
    const bEnd = new Date(b.end || b.filed || 0).getTime();
    return bEnd - aEnd;
  });

  return sorted[0];
}

function latestQuarterlyValue(companyFacts, usGaapKey) {
  const values = pickFacts(companyFacts, usGaapKey);
  const quarterly = values.filter((entry) => String(entry.frame || '').startsWith('CY')) || values;
  const sorted = [...quarterly].sort((a, b) => {
    const aEnd = new Date(a.end || a.filed || 0).getTime();
    const bEnd = new Date(b.end || b.filed || 0).getTime();
    return bEnd - aEnd;
  });
  return sorted[0] || null;
}

function computeGrowth(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

async function getTavilySearchData(companyName) {
  if (!env.TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is required to fetch news data');
  }

  const key = companyKey(companyName);
  const filename = `tavily_${key}.json`;
  const TAVILY_TTL = 2 * 60 * 60 * 1000; // 2 hours

  const diskCached = await getCachedData(filename, TAVILY_TTL);
  if (diskCached) {
    return diskCached;
  }

  const response = await fetchJson(`${TAVILY_BASE_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query: `${companyName} latest news financial results competitors market share AI roadmap`,
      search_depth: 'advanced',
      max_results: 4,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  const results = Array.isArray(response?.results) ? response.results : [];
  const companyTokens = new Set(normalizeCompanyName(companyName).toLowerCase().split(/\s+/));
  const newsItems = results.map((item) => ({
    title: item.title || item.url || 'News item',
    source: item.source || item.url || 'Tavily',
    url: item.url || '',
    snippet: item.content || item.snippet || '',
    sentiment: inferSentiment(`${item.title || ''} ${item.content || ''}`),
  }));

  const competitorHints = [];
  for (const item of results) {
    const text = `${item.title || ''} ${item.content || ''}`;
    const candidates = text.match(/\b([A-Z][A-Za-z0-9&.-]+(?:\s+[A-Z][A-Za-z0-9&.-]+){0,2})\b/g) || [];

    for (const candidate of candidates) {
      const cleaned = candidate.trim();
      if (!cleaned) continue;
      const lower = cleaned.toLowerCase();
      if (companyTokens.has(lower)) continue;
      if (/^(the|and|for|with|from|market|share|company|companies|competitors|rivals|latest|news|financial|results|roadmap)$/i.test(cleaned)) continue;
      if (!competitorHints.some((hint) => hint.toLowerCase() === lower)) {
        competitorHints.push(cleaned);
      }
      if (competitorHints.length >= 4) break;
    }

    if (competitorHints.length >= 4) break;
  }

  const finalData = { newsItems, competitorHints };
  await setCachedData(filename, finalData);
  return finalData;
}

function getCachedResearchReport(cacheKey) {
  const cached = cachedResearchReports.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > RESEARCH_REPORT_CACHE_TTL_MS) {
    cachedResearchReports.delete(cacheKey);
    return null;
  }

  return cached.report;
}

function setCachedResearchReport(cacheKey, report) {
  cachedResearchReports.set(cacheKey, {
    cachedAt: Date.now(),
    report,
  });
}

function buildFinancialMetrics({ companyFacts, marketCap }) {
  const revenueNow = latestQuarterlyValue(companyFacts, 'Revenues') || latestQuarterlyValue(companyFacts, 'RevenueFromContractWithCustomerExcludingAssessedTax');
  const revenuePrev = (pickFacts(companyFacts, 'Revenues')[1] || pickFacts(companyFacts, 'RevenueFromContractWithCustomerExcludingAssessedTax')[1]) || null;
  const netIncome = latestQuarterlyValue(companyFacts, 'NetIncomeLoss');
  const dilutedEps = latestFact(companyFacts, 'EarningsPerShareDiluted');
  const debt = latestFact(companyFacts, 'LongTermDebtAndFinanceLeaseObligations');
  const equity = latestFact(companyFacts, 'StockholdersEquity');
  const cashFlow = latestFact(companyFacts, 'NetCashProvidedByUsedInOperatingActivities');
  const profitMargin = safeNumber(netIncome?.val) != null && safeNumber(revenueNow?.val) != null ? (safeNumber(netIncome.val) / safeNumber(revenueNow.val)) * 100 : null;
  const roe = safeNumber(netIncome?.val) != null && safeNumber(equity?.val) != null ? (safeNumber(netIncome.val) / safeNumber(equity.val)) * 100 : null;
  const peRatio = marketCap != null && safeNumber(dilutedEps?.val) != null ? marketCap / Math.abs(safeNumber(dilutedEps.val)) : null;

  return {
    revenue: safeNumber(revenueNow?.val) != null ? formatBillions(safeNumber(revenueNow.val)) : 'N/A',
    revenue_growth: computeGrowth(safeNumber(revenueNow?.val), safeNumber(revenuePrev?.val)) != null ? `${computeGrowth(safeNumber(revenueNow?.val), safeNumber(revenuePrev?.val)).toFixed(1)}%` : 'N/A',
    net_income: safeNumber(netIncome?.val) != null ? formatBillions(safeNumber(netIncome.val)) : 'N/A',
    eps: safeNumber(dilutedEps?.val) != null ? safeNumber(dilutedEps.val).toFixed(2) : 'N/A',
    pe_ratio: peRatio != null && Number.isFinite(peRatio) ? peRatio.toFixed(1) : 'N/A',
    cash_flow: safeNumber(cashFlow?.val) != null ? formatBillions(safeNumber(cashFlow.val)) : 'N/A',
    debt: safeNumber(debt?.val) != null ? formatBillions(safeNumber(debt.val)) : 'N/A',
    roe: roe != null && Number.isFinite(roe) ? `${roe.toFixed(1)}%` : 'N/A',
    profit_margin: profitMargin != null && Number.isFinite(profitMargin) ? `${profitMargin.toFixed(1)}%` : 'N/A',
  };
}

function scoreFromData({ revenueGrowth, roe, profitMargin, debtToEquity, peRatio, marketCap, newsItems }) {
  let score = 50;

  if (revenueGrowth != null) score += Math.max(-8, Math.min(14, revenueGrowth / 5));
  if (roe != null) score += Math.max(-4, Math.min(10, roe / 4));
  if (profitMargin != null) score += Math.max(-4, Math.min(10, profitMargin / 4));
  if (debtToEquity != null) score -= Math.max(0, Math.min(10, debtToEquity * 1.2));
  if (peRatio != null && peRatio > 0) {
    if (peRatio < 20) score += 4;
    else if (peRatio > 40) score -= 5;
  }
  if (marketCap != null && marketCap > 500_000_000_000) score += 2;

  const sentimentAdjustment = newsItems.reduce((acc, item) => acc + (item.sentiment === 'Positive' ? 1 : item.sentiment === 'Negative' ? -1 : 0), 0);
  score += Math.max(-5, Math.min(5, sentimentAdjustment));

  score = Math.max(20, Math.min(92, Math.round(score)));
  const confidence = Math.max(55, Math.min(90, score - 3));
  const recommendation = score >= 66 ? 'INVEST' : 'PASS';

  return { score, confidence, recommendation };
}

function buildSupportingSections({ companyName, overview, metrics, newsItems, recommendation, score, revenueGrowth, roe, debtToEquity, peRatio }) {
  const positives = [];
  const negatives = [];
  const risks = [];
  const growthOpportunities = [];

  if (overview.market_cap !== 'N/A') positives.push(`${companyName} has a live market cap of ${overview.market_cap}.`);
  if (metrics.cash_flow !== 'N/A') positives.push(`${companyName} is producing operating cash flow of ${metrics.cash_flow}.`);
  if (metrics.net_income !== 'N/A') positives.push(`${companyName} reports net income of ${metrics.net_income}.`);
  if (roe != null) positives.push(`${companyName} is generating return on equity of ${roe.toFixed(1)}%.`);

  if (debtToEquity != null && debtToEquity > 1.5) {
    negatives.push(`${companyName} is carrying a debt-to-equity ratio of ${debtToEquity.toFixed(2)}.`);
    risks.push(`${companyName} debt load needs monitoring.`);
  }
  if (peRatio != null && peRatio > 40) {
    negatives.push(`${companyName} trades at a premium P/E of ${peRatio.toFixed(1)}.`);
    risks.push(`${companyName} valuation remains demanding.`);
  }
  if (revenueGrowth != null && revenueGrowth < 0) {
    negatives.push(`${companyName} has negative recent revenue growth of ${revenueGrowth.toFixed(1)}%.`);
    risks.push(`${companyName} growth is slowing.`);
  }

  for (const item of newsItems) {
    const label = `${item.title}${item.url ? ` (${item.url})` : ''}`;
    if (item.sentiment === 'Positive') {
      growthOpportunities.push(label);
    } else if (item.sentiment === 'Negative') {
      negatives.push(label);
      risks.push(label);
    }
  }

  if (recommendation === 'INVEST') {
    positives.push(`${companyName} clears the live score threshold with ${score}/100.`);
  } else {
    negatives.push(`${companyName} does not yet clear the live score threshold with ${score}/100.`);
  }

  return {
    positives: [...new Set(positives)].slice(0, 5),
    negatives: [...new Set(negatives)].slice(0, 5),
    risks: [...new Set(risks)].slice(0, 5),
    growthOpportunities: [...new Set(growthOpportunities)].slice(0, 5),
  };
}

function buildSummary({ companyName, recommendation, score, revenueGrowthText, roeText, peText, newsLine }) {
  const stance = recommendation === 'INVEST' ? 'investable' : 'more speculative';
  return `${companyName} is currently ${stance} on live SEC and news data. Revenue growth is ${revenueGrowthText}, ROE is ${roeText}, and P/E is ${peText}. Recent news signal: ${newsLine}. The ${score}/100 score reflects live financial statements, valuation, and news momentum.`;
}

function buildReasoning({ companyName, recommendation, score, revenueGrowthText, roeText, peText, latestNewsTitle }) {
  const thesis = recommendation === 'INVEST'
    ? 'The live data supports a positive thesis because profitability, growth, and market sentiment are holding up.'
    : 'The live data points to a cautious thesis because valuation or balance-sheet quality is not yet strong enough.';

  return `${companyName} was scored using live SEC filings and Tavily news. ${thesis} Key signals: revenue growth ${revenueGrowthText}, ROE ${roeText}, P/E ${peText}. The latest news flow was incorporated into the final score of ${score}/100. ${latestNewsTitle ? `Top recent signal: ${latestNewsTitle}.` : ''}`;
}

export async function createResearchReport(companyName, options = {}) {
  const onStage = typeof options.onStage === 'function' ? options.onStage : () => {};
  const normalizedCompany = normalizeCompanyName(companyName);
  const cacheKey = companyKey(normalizedCompany);

  // 1. Check memory cache
  const cachedReport = getCachedResearchReport(cacheKey);
  if (cachedReport) {
    onStage('Generating report...', 100);
    return cachedReport;
  }

  // 2. Check disk cache
  const reportFilename = `report_${cacheKey}.json`;
  const diskCachedReport = await getCachedData(reportFilename, RESEARCH_REPORT_CACHE_TTL_MS);
  if (diskCachedReport) {
    onStage('Generating report...', 100);
    setCachedResearchReport(cacheKey, diskCachedReport);
    return diskCachedReport;
  }

  // 3. Run LangGraph Workflow
  const { researchGraph } = await import('../langgraph/researchGraph.js');
  const result = await researchGraph.invoke({
    companyName: normalizedCompany,
    onStage,
  });

  const report = result.report;

  // 4. Save to cache
  setCachedResearchReport(cacheKey, report);
  await setCachedData(reportFilename, report);
  onStage('Complete', 100);
  return report;
}

export {
  normalizeCompanyName,
  companyKey,
  safeNumber,
  safeText,
  formatBillions,
  inferSentiment,
  getSecCompanyFacts,
  pickFacts,
  latestFact,
  latestQuarterlyValue,
  computeGrowth,
  getTavilySearchData,
  getCachedResearchReport,
  setCachedResearchReport,
  buildFinancialMetrics,
  scoreFromData,
  buildSupportingSections,
  buildSummary,
  buildReasoning,
  getCachedData,
  setCachedData,
  searchSecCompany,
  RESEARCH_REPORT_CACHE_TTL_MS,
};
