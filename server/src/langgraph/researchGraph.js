import { StateGraph, Annotation } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { env } from "../config/env.js";
import {
  normalizeCompanyName,
  companyKey,
  safeNumber,
  safeText,
  formatBillions,
  getSecCompanyFacts,
  pickFacts,
  latestFact,
  latestQuarterlyValue,
  computeGrowth,
  getTavilySearchData,
  buildFinancialMetrics,
  scoreFromData,
  buildSupportingSections,
  buildSummary,
  buildReasoning,
  searchSecCompany,
} from "../services/researchService.js";

// Define the State structure using LangGraph Annotation
const ResearchStateAnnotation = Annotation.Root({
  companyName: Annotation(),
  onStage: Annotation(),
  secTicker: Annotation(),
  companyFacts: Annotation(),
  tavilyData: Annotation(),
  financialMetrics: Annotation(),
  recommendationBundle: Annotation(),
  supportingSections: Annotation(),
  aiReport: Annotation(),
  report: Annotation(),
});

// Graph Node 1: Search Company
async function companySearchNode(state) {
  const onStage = state.onStage || (() => {});
  onStage('Searching company...', 10);

  const normalizedCompany = normalizeCompanyName(state.companyName);
  let secTicker = null;
  try {
    secTicker = await searchSecCompany(normalizedCompany);
  } catch (err) {
    console.error("SEC lookup failed, continuing with fallback:", err.message);
  }

  if (!secTicker) {
    // Return a placeholder for non-SEC company
    secTicker = {
      ticker: 'N/A',
      title: normalizedCompany,
      cik_str: null,
      marketCap: null,
      sicDescription: 'Non-SEC Company',
    };
  }

  return { secTicker };
}

// Graph Node 2: Fetch Financial Data from SEC facts (if CIK exists)
async function financialDataNode(state) {
  const onStage = state.onStage || (() => {});
  onStage('Fetching financial data...', 35);

  if (!state.secTicker.cik_str) {
    return { companyFacts: null };
  }

  try {
    const companyFacts = await getSecCompanyFacts(state.secTicker.cik_str);
    return { companyFacts };
  } catch (err) {
    console.error("Failed to fetch SEC facts, continuing without them:", err.message);
    return { companyFacts: null };
  }
}

// Graph Node 3: Collect news from Tavily
async function newsCollectionNode(state) {
  const onStage = state.onStage || (() => {});
  onStage('Analyzing news...', 60);

  const normalizedCompany = normalizeCompanyName(state.companyName);
  const tavilyData = await getTavilySearchData(normalizedCompany);
  return { tavilyData };
}

// Graph Node 4: Run AI analysis using Gemini via LangChain
async function aiAnalysisNode(state) {
  const onStage = state.onStage || (() => {});
  onStage('Running AI...', 80);

  const companyFacts = state.companyFacts || { facts: { 'us-gaap': {} } };
  const marketCap = safeNumber(state.secTicker.marketCap);
  const companyNameResolved = state.secTicker.title || state.companyName;

  // Compute basic metrics and scores as a baseline for the AI
  const financialMetrics = buildFinancialMetrics({ companyFacts, marketCap });

  const latestRevenue = latestQuarterlyValue(companyFacts, 'Revenues') || latestQuarterlyValue(companyFacts, 'RevenueFromContractWithCustomerExcludingAssessedTax');
  const previousRevenue = (pickFacts(companyFacts, 'Revenues')[1] || pickFacts(companyFacts, 'RevenueFromContractWithCustomerExcludingAssessedTax')[1]) || null;
  const revenueGrowth = computeGrowth(safeNumber(latestRevenue?.val), safeNumber(previousRevenue?.val));
  const latestNetIncome = latestQuarterlyValue(companyFacts, 'NetIncomeLoss');
  const latestEquity = latestFact(companyFacts, 'StockholdersEquity');
  const debtFact = latestFact(companyFacts, 'LongTermDebtAndFinanceLeaseObligations');
  const dilutedEpsFact = latestFact(companyFacts, 'EarningsPerShareDiluted');
  const debtToEquity = safeNumber(debtFact?.val) != null && safeNumber(latestEquity?.val) != null && safeNumber(latestEquity?.val) !== 0 ? safeNumber(debtFact.val) / safeNumber(latestEquity.val) : null;
  const roe = safeNumber(latestNetIncome?.val) != null && safeNumber(latestEquity?.val) != null && safeNumber(latestEquity?.val) !== 0 ? (safeNumber(latestNetIncome.val) / safeNumber(latestEquity.val)) * 100 : null;
  const profitMargin = safeNumber(latestNetIncome?.val) != null && safeNumber(latestRevenue?.val) != null && safeNumber(latestRevenue?.val) !== 0 ? (safeNumber(latestNetIncome.val) / safeNumber(latestRevenue.val)) * 100 : null;
  const peRatio = marketCap != null && safeNumber(dilutedEpsFact?.val) != null && safeNumber(dilutedEpsFact.val) !== 0 ? marketCap / Math.abs(safeNumber(dilutedEpsFact.val)) : null;

  const recommendationBundle = scoreFromData({
    revenueGrowth,
    roe,
    profitMargin,
    debtToEquity,
    peRatio,
    marketCap,
    newsItems: state.tavilyData.newsItems,
  });

  const supportingSections = buildSupportingSections({
    companyName: companyNameResolved,
    overview: {
      market_cap: marketCap != null ? formatBillions(marketCap) : 'N/A',
    },
    metrics: financialMetrics,
    newsItems: state.tavilyData.newsItems,
    recommendation: recommendationBundle.recommendation,
    score: recommendationBundle.score,
    revenueGrowth,
    roe,
    debtToEquity,
    peRatio,
  });

  // Call Gemini using LangChain
  let aiReport = null;
  try {
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-3.5-flash",
      apiKey: env.GEMINI_API_KEY,
      temperature: 0.2,
    });

    const newsContext = state.tavilyData.newsItems
      .slice(0, 4)
      .map(item => `- Title: ${item.title}\n  Snippet: ${item.snippet}\n  Sentiment: ${item.sentiment}`)
      .join('\n');

    const prompt = `You are a Senior Investment Analyst. You are writing an institutional investment report for ${companyNameResolved} (${state.secTicker.ticker}).
    
    Here is the live data we collected:
    
    Financial Metrics (from SEC, if available):
    - Revenue: ${financialMetrics.revenue}
    - Revenue Growth: ${financialMetrics.revenue_growth}
    - Net Income: ${financialMetrics.net_income}
    - EPS: ${financialMetrics.eps}
    - P/E Ratio: ${financialMetrics.pe_ratio}
    - Operating Cash Flow: ${financialMetrics.cash_flow}
    - Total Debt: ${financialMetrics.debt}
    - Return on Equity (ROE): ${financialMetrics.roe}
    - Profit Margin: ${financialMetrics.profit_margin}
    
    Latest News Flow:
    ${newsContext}
    
    Quantitative Analysis:
    - Recommended action: ${recommendationBundle.recommendation}
    - Confidence: ${recommendationBundle.confidence}%
    - Score: ${recommendationBundle.score}/100
    - Positives: ${supportingSections.positives.join('; ')}
    - Risks: ${supportingSections.risks.join('; ')}
    
    Please draft the following qualitative sections for the investment report in a professional, analyst-style tone (avoid buzzwords).
    
    NOTE: If the financial metrics above are "N/A" (because the company is non-US, private, or not found in the SEC database), please use the provided news flow and your own knowledge to estimate/fill in reasonable financial metrics.
    Also, please provide the company overview fields (CEO, Headquarters, Employees, Industry, and Description) based on the news context and your knowledge.
    
    Return a JSON object matching this structure EXACTLY:
    {
      "executive_summary": "A concise executive summary (3-4 sentences) summarizing the stance, key metrics, and news sentiment.",
      "business_overview": "A brief overview of the business model, its industry sector, and core products.",
      "financial_health": "A summary of the company's financial strength, profitability, debt profile, and growth.",
      "industry_analysis": "An analysis of the company's competitive positioning, peers, and industry headwinds/tailwinds.",
      "growth_potential": "A description of the primary growth opportunities, AI roadmap, or product expansion.",
      "swot": {
        "strengths": ["Strength 1", "Strength 2", "Strength 3"],
        "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
        "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
        "threats": ["Threat 1", "Threat 2", "Threat 3"]
      },
      "reasoning": "A paragraph explaining the core investment thesis. Explain why we recommend the action with a score.",
      "company_overview": {
        "ceo": "CEO Name (or 'Unavailable')",
        "headquarters": "City, Country (or 'Unavailable')",
        "employees": "Estimated employee count or range (or 'Unavailable')",
        "industry": "Industry description",
        "description": "Short description of the company",
        "market_cap": "Estimated Market Cap in Billions (e.g. $45B) or 'N/A'"
      },
      "financial_metrics_override": {
        "revenue": "e.g. $10B",
        "revenue_growth": "e.g. 8%",
        "net_income": "e.g. $1.2B",
        "eps": "e.g. 2.40",
        "pe_ratio": "e.g. 25",
        "cash_flow": "e.g. $1.5B",
        "debt": "e.g. $5B",
        "roe": "e.g. 15%",
        "profit_margin": "e.g. 12%"
      },
      "recommendation_override": "INVEST | PASS (optional, use if qualitative factors override the baseline decision)",
      "score_override": 75 (optional, number between 20 and 95),
      "confidence_override": 80 (optional, number between 50 and 95)
    }
    
    Return ONLY the valid JSON object. No Markdown code block headers, no extra text, just raw JSON.`;

    const response = await llm.invoke(prompt);
    const cleanJson = response.content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    aiReport = JSON.parse(cleanJson);
  } catch (err) {
    console.error("Gemini LangChain Error, falling back to templates:", err.message);
  }

  // Fallback to templates if LLM fails or times out
  const executive_summary = aiReport?.executive_summary || buildSummary({
    companyName: companyNameResolved,
    recommendation: recommendationBundle.recommendation,
    score: recommendationBundle.score,
    revenueGrowthText: revenueGrowth != null ? `${revenueGrowth.toFixed(1)}%` : 'N/A',
    roeText: roe != null ? `${roe.toFixed(1)}%` : 'N/A',
    peText: peRatio != null ? peRatio.toFixed(1) : 'N/A',
    newsLine: state.tavilyData.newsItems[0]?.title || 'recent market data',
  });

  const business_overview = aiReport?.business_overview || `${companyNameResolved} operates in ${state.secTicker.sicDescription || 'Unknown'} with live SEC filings and Tavily news context.`;
  const financial_health = aiReport?.financial_health || `Revenue growth is ${revenueGrowth != null ? `${revenueGrowth.toFixed(1)}%` : 'N/A'}, ROE is ${roe != null ? `${roe.toFixed(1)}%` : 'N/A'}, and the current live score reflects SEC filing values.`;
  const industry_analysis = aiReport?.industry_analysis || `${state.secTicker.sicDescription || 'Unknown'} peers and competitive positioning should be interpreted from the retrieved SEC profile and market context.`;
  const growth_potential = aiReport?.growth_potential || (supportingSections.growthOpportunities.length > 0 ? supportingSections.growthOpportunities.join('; ') : 'No explicit growth signal was extracted.');
  const swot = aiReport?.swot || {
    strengths: supportingSections.positives.slice(0, 3),
    weaknesses: supportingSections.negatives.slice(0, 3),
    opportunities: supportingSections.growthOpportunities.slice(0, 3),
    threats: supportingSections.risks.slice(0, 3),
  };
  const reasoning = aiReport?.reasoning || buildReasoning({
    companyName: companyNameResolved,
    recommendation: recommendationBundle.recommendation,
    score: recommendationBundle.score,
    revenueGrowthText: revenueGrowth != null ? `${revenueGrowth.toFixed(1)}%` : 'N/A',
    roeText: roe != null ? `${roe.toFixed(1)}%` : 'N/A',
    peText: peRatio != null ? peRatio.toFixed(1) : 'N/A',
    latestNewsTitle: state.tavilyData.newsItems[0]?.title || '',
  });

  return {
    financialMetrics,
    recommendationBundle,
    supportingSections,
    aiReport: {
      executive_summary,
      business_overview,
      financial_health,
      industry_analysis,
      growth_potential,
      swot,
      reasoning,
      company_overview: aiReport?.company_overview,
      financial_metrics_override: aiReport?.financial_metrics_override,
      recommendation_override: aiReport?.recommendation_override,
      score_override: aiReport?.score_override,
      confidence_override: aiReport?.confidence_override,
    }
  };
}

// Graph Node 5: Compile Final Report
async function reportGenerationNode(state) {
  const onStage = state.onStage || (() => {});
  onStage('Generating report...', 95);

  const companyNameResolved = state.secTicker.title || state.companyName;
  const marketCap = safeNumber(state.secTicker.marketCap);

  const companyOverview = {
    description: state.aiReport.company_overview?.description || `${companyNameResolved} is assessed using live filings and web search results.`,
    industry: state.aiReport.company_overview?.industry || state.secTicker.sicDescription || state.secTicker.sector || 'Unknown',
    ceo: state.aiReport.company_overview?.ceo || 'Unavailable',
    headquarters: state.aiReport.company_overview?.headquarters || state.secTicker.title || 'Unavailable',
    employees: state.aiReport.company_overview?.employees || safeText(state.secTicker.summary, 'Unavailable'),
    market_cap: marketCap != null ? formatBillions(marketCap) : (state.aiReport.company_overview?.market_cap || 'N/A'),
  };

  // Merge financial metrics from AI overrides if they are missing (N/A) in the baseline
  const finalMetrics = {
    ...state.financialMetrics,
  };
  
  if (state.aiReport.financial_metrics_override) {
    for (const key of Object.keys(state.aiReport.financial_metrics_override)) {
      if (finalMetrics[key] === 'N/A' || !finalMetrics[key]) {
        finalMetrics[key] = state.aiReport.financial_metrics_override[key];
      }
    }
  }

  // Set final quantitative metrics, honoring overrides
  const recommendation = state.aiReport.recommendation_override || state.recommendationBundle.recommendation;
  const investment_score = state.aiReport.score_override != null ? state.aiReport.score_override : state.recommendationBundle.score;
  const confidence = state.aiReport.confidence_override != null ? state.aiReport.confidence_override : state.recommendationBundle.confidence;

  const report = {
    company: companyNameResolved,
    symbol: state.secTicker.ticker,
    recommendation,
    confidence,
    investment_score,
    generated_at: new Date().toISOString(),
    company_overview: companyOverview,
    financial_metrics: finalMetrics,
    latest_news: state.tavilyData.newsItems.slice(0, 5).map((item) => ({
      title: item.title,
      sentiment: item.sentiment,
      source: item.source,
      url: item.url,
      snippet: item.snippet,
    })),
    competitive_analysis: {
      competitors: state.tavilyData.competitorHints.length > 0 ? state.tavilyData.competitorHints : ['Peer companies identified from live market search'],
      advantages: [
        companyOverview.market_cap !== 'N/A' ? `Market cap of ${companyOverview.market_cap}` : 'Large-scale global operations',
        finalMetrics.roe !== 'N/A' ? `ROE of ${finalMetrics.roe}` : 'Profitability captured from filings/market data',
      ],
      weaknesses: [
        finalMetrics.debt !== 'N/A' ? `Debt is ${finalMetrics.debt}` : 'Debt profile should be reviewed',
        finalMetrics.pe_ratio !== 'N/A' ? `P/E ratio of ${finalMetrics.pe_ratio}` : 'Valuation data should be reviewed',
      ],
      moat: `${companyNameResolved} appears to rely on its product stack, distribution, and customer base.`,
    },
    risk_analysis: state.supportingSections.risks,
    growth_opportunities: state.supportingSections.growthOpportunities,
    positives: state.supportingSections.positives.length > 0 ? state.supportingSections.positives : [
      `${companyNameResolved} maintains significant global brand value.`,
      `Resilient cash generation based on industry search data.`
    ],
    negatives: state.supportingSections.negatives.length > 0 ? state.supportingSections.negatives : [
      `Absence of direct US SEC Edgar filings to cross-reference financials.`
    ],
    risks: state.supportingSections.risks.length > 0 ? state.supportingSections.risks : [
      `Geopolitical and regional macroeconomic exposure.`,
      `Foreign currency fluctuation risks.`
    ],
    
    // AI generated sections
    executive_summary: state.aiReport.executive_summary,
    business_overview: state.aiReport.business_overview,
    financial_health: state.aiReport.financial_health,
    industry_analysis: state.aiReport.industry_analysis,
    growth_potential: state.aiReport.growth_potential,
    swot: state.aiReport.swot,
    reasoning: state.aiReport.reasoning,
    summary: state.aiReport.executive_summary,

    sources: [
      state.secTicker.cik_str ? `SEC ticker lookup for ${normalizeCompanyName(state.companyName)}` : 'Non-SEC Company Profiling',
      state.secTicker.cik_str ? `SEC company facts for ${state.secTicker.ticker}` : 'Tavily web data retrieval',
      `Tavily news search for ${normalizeCompanyName(state.companyName)}`,
    ],
    raw_inputs: {
      ticker: state.secTicker,
      company_facts: state.companyFacts,
      news_items: state.tavilyData.newsItems,
    },
  };

  return { report };
}

// Build the LangGraph State Graph
const graphBuilder = new StateGraph(ResearchStateAnnotation)
  .addNode("companySearch", companySearchNode)
  .addNode("financialData", financialDataNode)
  .addNode("newsCollection", newsCollectionNode)
  .addNode("aiAnalysis", aiAnalysisNode)
  .addNode("reportGeneration", reportGenerationNode)
  .addEdge("__start__", "companySearch")
  .addEdge("companySearch", "financialData")
  .addEdge("financialData", "newsCollection")
  .addEdge("newsCollection", "aiAnalysis")
  .addEdge("aiAnalysis", "reportGeneration")
  .addEdge("reportGeneration", "__end__");

// Compile the graph
export const researchGraph = graphBuilder.compile();

export function buildResearchGraph() {
  return researchGraph;
}
