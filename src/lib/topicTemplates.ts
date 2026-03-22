/**
 * Topic-adaptive prompt templates.
 * The classifier identifies a topic tag → we look it up here → inject into the solve prompt.
 * Keys are lowercase, matched via includes() for flexibility.
 */

export const TOPIC_TEMPLATES: Record<string, string> = {
  // === CFA / Fixed Income ===
  "bond pricing": `
- Always set up the TVM framework first: identify N, I/Y, PMT, FV, then solve for PV
- Show the cash flow timeline
- If semi-annual coupons, explicitly halve the coupon and double the periods
- State whether the bond trades at premium, par, or discount and explain why`,

  "bond duration": `
- Distinguish between Macaulay duration and modified duration
- Show the weighted average time calculation for Macaulay
- Modified duration = Macaulay / (1 + YTM/k) where k = coupons per year
- Interpret the result: "For every 1% change in yield, price changes by approximately X%"`,

  "yield": `
- Clarify which yield is being asked: current yield, YTM, YTC, or BEY
- Current yield = annual coupon / current price
- For YTM, set up the bond pricing equation and solve
- If comparing yields, convert to the same basis (BEY vs EAY)`,

  // === CFA / Equity ===
  "dcf": `
- Identify the appropriate model: DDM, FCFE, FCFF
- State all assumptions explicitly: growth rate, discount rate, terminal value method
- Show the terminal value calculation separately
- Sensitivity check: note how small changes in growth or discount rate affect value`,

  "valuation": `
- Identify which multiple is most appropriate (P/E, EV/EBITDA, P/B) and why
- Compare to sector median, not just peer average
- Note any adjustments needed: normalize earnings, exclude one-time items
- State whether the stock appears cheap or expensive and on what basis`,

  "dividend": `
- Identify the model: Gordon Growth (constant), multi-stage DDM, or H-model
- For Gordon Growth: P = D1 / (r - g), emphasize g must be less than r
- For multi-stage: explicitly map out each phase with its growth rate
- Always calculate D1 = D0 x (1 + g), not use D0 directly`,

  // === CFA / Derivatives ===
  "option": `
- Draw or describe the payoff diagram
- Distinguish between payoff at expiration and profit (payoff minus premium)
- For strategies (spreads, straddles): show the combined payoff
- State max profit, max loss, and breakeven point(s)
- If pricing: identify whether to use Black-Scholes or binomial and why`,

  "forward": `
- Use the no-arbitrage pricing framework: F = S x (1 + r)^T - PV(benefits)
- Identify carrying costs and convenience yields
- For currency forwards: state which interest rate differential applies
- Value at expiration vs value during life — different calculations`,

  "swap": `
- Identify swap type: interest rate, currency, equity
- For interest rate swaps: the fixed rate makes PV(fixed) = PV(floating) at inception
- Show the notional principal and payment frequency
- Calculate net payment, not gross payments on each leg`,

  // === CFA / Portfolio ===
  "portfolio": `
- For return: weighted average of individual returns
- For risk: use the full covariance/correlation formula, not just weighted average of risks
- sigma_p^2 = w1^2*s1^2 + w2^2*s2^2 + 2*w1*w2*s1*s2*rho
- If more than 2 assets, use matrix approach or enumerate all covariance terms`,

  "capm": `
- State the formula: E(R) = Rf + beta x (Rm - Rf)
- Identify each input clearly: risk-free rate, market return, beta
- If solving for beta: beta = Cov(Ri, Rm) / Var(Rm)
- Interpret: beta > 1 means more volatile than market, beta < 1 means less`,

  "sharpe": `
- Sharpe ratio = (Rp - Rf) / sigma_p
- Use excess return, not total return
- Higher is better — compare across portfolios
- Note limitations: assumes normal distribution, uses total risk not systematic`,

  // === GMAT ===
  "data sufficiency": `
- CRITICAL: Evaluate Statement (1) ALONE first, then Statement (2) ALONE, then COMBINED
- For each statement, determine if it is SUFFICIENT or INSUFFICIENT independently
- Do NOT let information from one statement influence evaluation of the other
- The answer choices are always: A, B, C, D, E — state which and why
- Show your work for each statement evaluation separately`,

  "probability": `
- Identify the type: independent, conditional, mutually exclusive, complementary
- State the formula being used
- For "at least one" problems: use complement — P(at least 1) = 1 - P(none)
- For combinations: clearly distinguish between permutations (order matters) and combinations (order doesn't)
- Check: all probabilities must be between 0 and 1, and sum to 1 for complete sets`,

  "percent": `
- Be clear about the base: "X% of what?"
- For percent change: (New - Old) / Old x 100
- For successive percentages: multiply the factors, don't add percentages
- Example: 20% increase then 20% decrease = 1.2 x 0.8 = 0.96 = 4% decrease, NOT 0%`,

  "interest": `
- Distinguish between simple and compound interest
- Simple: A = P(1 + rt)
- Compound: A = P(1 + r/n)^(nt)
- For effective annual rate: EAR = (1 + r/n)^n - 1
- Always state the compounding frequency`,

  // === General Finance ===
  "time value": `
- Set up the TVM framework: identify which variable you're solving for (PV, FV, PMT, N, or I/Y)
- State all known variables before calculating
- For annuities: distinguish between ordinary annuity (end of period) and annuity due (beginning)
- Always check: does the answer make economic sense? PV < FV for positive rates`,

  "wacc": `
- WACC = wE x rE + wD x rD x (1 - T)
- Use market values for weights, not book values
- Cost of equity: use CAPM or DDM to derive
- Cost of debt: use YTM on existing debt, then apply tax shield
- State all components and their sources`,

  "ratio": `
- State the formula first
- Identify what the ratio measures (liquidity, profitability, leverage, efficiency)
- Compare to industry benchmark or prior period — a ratio alone means nothing
- Watch for common traps: using average vs ending balances, mixing income statement and balance sheet timing`,

  "npv": `
- NPV = sum of PV of all cash flows, including initial investment (negative)
- Discount each cash flow individually: CF_t / (1 + r)^t
- Decision rule: NPV > 0 means accept, NPV < 0 means reject
- Compare NPV to IRR interpretation — they can disagree with non-conventional cash flows`,

  "regression": `
- State the model: Y = a + bX + error
- b = Cov(X,Y) / Var(X), or use the formula with means
- R-squared = explained variation / total variation — interpret as "% of variance explained"
- Check significance: t-stat, p-value, confidence intervals
- Note assumptions: linearity, independence, homoscedasticity, normality of errors`,

  "statistics": `
- State which measure or test applies and why
- For descriptive stats: mean, median, mode — note which is appropriate for the distribution
- For hypothesis testing: state H0 and H1, choose the test, calculate the test statistic, compare to critical value
- Always state the conclusion in context of the original question`,

  // === Series 7 ===
  "suitability": `
- Identify the client's investment objective: growth, income, preservation, speculation
- Consider risk tolerance, time horizon, liquidity needs, tax situation
- Match the recommendation to the client profile — state WHY it's suitable
- Note any red flags: concentration risk, unsuitable risk level, illiquidity mismatch`,

  "margin": `
- Distinguish between initial margin (Reg T = 50%) and maintenance margin (25% for long, 30% for short)
- For margin calls: calculate equity, compare to maintenance requirement
- Formula: margin call when equity / market value < maintenance %
- For short sales: proceeds + deposit must cover market value + maintenance`,

  "municipal": `
- Tax-equivalent yield = municipal yield / (1 - tax bracket)
- Distinguish between GO bonds (backed by taxing power) and revenue bonds (backed by project revenue)
- Note: exempt from federal tax, may be exempt from state/local if in-state
- Compare after-tax yields, not nominal yields`,

  "options regulatory": `
- Know position limits and exercise limits
- Opening transactions vs closing transactions
- Customer account requirements for different strategies
- Distinguish between covered and uncovered (naked) positions — different margin requirements`,

  // === Series 24 ===
  "supervision": `
- Identify the supervisory requirement being tested
- Reference the specific FINRA rule when applicable (e.g., Rule 3110, Rule 3120)
- Distinguish between principal approval, supervisory review, and compliance review
- Note timeframes: when must review occur, what are the escalation requirements`,

  "registration": `
- Identify the registration category: representative, principal, associated person
- Know the exam requirements: SIE + top-off exams
- Continuing education: Regulatory Element (annually) vs Firm Element (annual plan)
- U4/U5 filing requirements and timelines`,

  "compliance": `
- Identify the compliance issue: AML, insider trading, market manipulation, books and records
- Know SAR filing thresholds and requirements
- Distinguish between required and prohibited activities
- Note record retention requirements: 3 years, 6 years, or lifetime depending on record type`,

  "net capital": `
- Net capital rule (SEC Rule 15c3-1): minimum net capital requirements
- Aggregate indebtedness method vs alternative method
- Haircuts on securities positions
- Customer reserve computation (Rule 15c3-3)`,

  // === Accounting ===
  "journal entry": `
- Always state the debit and credit accounts explicitly
- Use T-account format or DR/CR notation
- Verify debits = credits (the entry must balance)
- Identify the account type (asset, liability, equity, revenue, expense) for each entry
- Note the effect on the accounting equation: A = L + E`,

  "financial statement": `
- Identify which statement is affected: income statement, balance sheet, cash flow, or equity
- For balance sheet: assets = liabilities + equity must always hold
- For income statement: revenue - expenses = net income
- For cash flow: distinguish between operating, investing, and financing activities
- Note: accrual vs cash basis differences if relevant`,

  "depreciation": `
- Identify the method: straight-line, declining balance, units of production, MACRS
- Straight-line: (Cost - Salvage) / Useful life
- Double declining: 2 / Useful life x Book value (ignore salvage until end)
- State the annual depreciation expense and accumulated depreciation
- Note: land is NEVER depreciated`,

  "ratio analysis": `
- State the formula before calculating
- Liquidity: current ratio, quick ratio, cash ratio
- Profitability: ROA, ROE, profit margin, gross margin
- Leverage: debt-to-equity, interest coverage, debt ratio
- Efficiency: inventory turnover, receivables turnover, asset turnover
- Always interpret the result — what does this ratio tell us about the company?`,

  "revenue recognition": `
- Apply the 5-step model (ASC 606): identify contract, identify obligations, determine price, allocate price, recognize revenue
- Revenue is recognized when performance obligation is satisfied
- Point in time vs over time recognition — state which applies and why
- Note any variable consideration or contract modifications`,

  // === Economics ===
  "supply demand": `
- Draw or describe the supply and demand diagram
- Identify the shift: is it supply shifting, demand shifting, or both?
- Distinguish between a shift OF the curve vs movement ALONG the curve
- State the effect on equilibrium price AND quantity
- A shift in demand: price and quantity move in same direction
- A shift in supply: price and quantity move in opposite directions`,

  "elasticity": `
- State the formula: % change in quantity / % change in price
- Use midpoint method for arc elasticity: % change = (Q2-Q1)/((Q2+Q1)/2)
- Elastic: |E| > 1 (quantity responsive to price)
- Inelastic: |E| < 1 (quantity not responsive to price)
- Unit elastic: |E| = 1
- Revenue implications: elastic = lower price increases revenue, inelastic = raise price increases revenue`,

  "gdp": `
- GDP = C + I + G + (X - M) — expenditure approach
- Distinguish between nominal GDP and real GDP
- Real GDP adjusts for inflation using a base year
- GDP deflator = (Nominal GDP / Real GDP) x 100
- Growth rate = (GDP_new - GDP_old) / GDP_old x 100`,

  "monetary policy": `
- Identify the central bank tool: open market operations, discount rate, reserve requirements
- Expansionary: buy bonds, lower rates, lower reserves → increases money supply
- Contractionary: sell bonds, raise rates, raise reserves → decreases money supply
- Transmission mechanism: policy → interest rates → investment/consumption → output
- Note the difference between nominal and real interest rates (Fisher equation)`,

  "fiscal policy": `
- Identify the tool: government spending, taxation, transfer payments
- Expansionary: increase spending or cut taxes → increases aggregate demand
- Contractionary: decrease spending or raise taxes → decreases aggregate demand
- Multiplier effect: spending multiplier = 1 / (1 - MPC)
- Tax multiplier = -MPC / (1 - MPC)
- Crowding out: government borrowing can raise interest rates and reduce private investment`,

  "trade": `
- Comparative advantage: produce where opportunity cost is lowest
- Absolute advantage: produce where productivity is highest
- Terms of trade must fall between the opportunity costs of both countries
- Trade balance = exports - imports
- Note: a country can have comparative advantage without absolute advantage`,
};

/**
 * Look up topic-specific instructions. Uses fuzzy matching.
 */
export function getTopicTemplate(topic: string): string | null {
  if (!topic) return null;
  const lower = topic.toLowerCase();
  
  for (const [key, template] of Object.entries(TOPIC_TEMPLATES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return template;
    }
  }
  return null;
}