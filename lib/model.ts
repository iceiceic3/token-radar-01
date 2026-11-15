// Token Radar, model radar-3: one sealed snapshot in, one ranked board out.
//
// The board ranks every pre-token protocol the snapshot can rank, strongest implied
// value first. A protocol is pre-token when its record carries no token at all (no
// market cap, no CoinGecko id, no symbol); live-token protocols are kept apart and
// shown with the market's own value, never mixed into the ranking. Wrapped,
// staked and bridged products of a token that already trades are set aside too:
// their token exists already, so there is no launch left to rank.
//
// Implied value follows only from the snapshot's own figures, never from a
// hand-kept list of names. The same function scores every row:
//
//   implied = tvl_usd x categoryBenchmark x growthMult x maturityMult x breadthMult
//
//   categoryBenchmark  the median market-cap / TVL of the live-token protocols in
//                      the same category (at least 3 comparables, else the global
//                      median over all live protocols), clamped to [0.03, 1.0].
//                      Ratios outside [0.01, 3] are dropped before the median:
//                      a token with a tiny TVL and a hyped market cap must not
//                      set the benchmark for its whole category. A lending
//                      protocol is priced like lending protocols trade, a DEX
//                      like DEXes trade. The benchmark is computed from the
//                      snapshot at run time, so it moves with the data, not with
//                      anyone's opinion of a name.
//   growthMult         1 + eff(change_7d) / 100 x 0.6, where eff clamps the
//                      change to [-60, 120] and then takes the square root of
//                      positive growth: eff = 120 x sqrt(g / 120) for g >= 0,
//                      eff = g for g < 0. One wild week still cannot decide the
//                      board, and steady growth counts more than a single spike:
//                      +10% a week compounds to far more than +10% a year.
//                      Declines stay linear: shrinking TVL is real signal.
//   maturityMult       0.6 + min(age_days, 1095) / 1095 x 0.4. Age is the time
//                      since DefiLlama first listed the protocol: how long it has
//                      run with no token. Unknown age counts as 365 days.
//   breadthMult        1 + 0.05 x ln(chains), capped at 1.15. A protocol live on
//                      more chains reaches more users at launch; the log keeps a
//                      45-chain protocol from dwarfing the board.
//
// Every row also carries flags the dashboard shows: declining TVL, young, and
// single-chain, so a reader sees the model's caveats next to its number.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_weight: number;
  breadth_cap: number;
  benchmark_floor: number;
  benchmark_cap: number;
  benchmark_ratio_floor: number;
  benchmark_ratio_cap: number;
  min_comparables: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_weight: 0.05,
  breadth_cap: 1.15,
  benchmark_floor: 0.03,
  benchmark_cap: 1.0,
  benchmark_ratio_floor: 0.01,
  benchmark_ratio_cap: 3,
  min_comparables: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_benchmark: number;
    comparables: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  flags: string[];
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_benchmark: number;
  comparables: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  flags: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's benchmark: the median mcap/TVL of its live comparables. */
export interface CategoryBenchmark {
  category: string;
  benchmark: number;
  comparables: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_benchmark: number;
  benchmarks: CategoryBenchmark[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Categories that are a product of a token that already trades, never a protocol still waiting on a launch of its own. */
const WRAPPED_CATEGORY = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a name is a wrapped, staked or bridged product, or an exchange's own product. */
const WRAPPED_NAME = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_NAME = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * Whether a protocol is a wrapped, staked or bridged product of a token that
 * already trades: WBTC is Bitcoin on Ethereum, a bridge moves a token that
 * exists, Binance staked ETH is ETH in Binance's staking product. None of them
 * is a protocol still waiting on a launch of its own, so none of them is
 * ranked. This is the house's own watchlist rule, applied to the whole board:
 * the snapshot carries no parent-protocol field, so the visible half of the
 * rule (category, name) is what the model can check.
 */
export function isWrappedProduct(p: SnapshotProtocol): boolean {
  return (
    (p.category !== null && WRAPPED_CATEGORY.has(p.category)) ||
    WRAPPED_NAME.test(p.name) ||
    EXCHANGE_NAME.test(p.name)
  );
}

/** Whether a protocol is one the board may rank: pre-token, not a wrapped product, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isWrappedProduct(p) && !VERSIONED.test(p.name);
}

/**
 * The category benchmarks, computed from the snapshot's own live protocols: for
 * each category, the median market-cap / TVL of its live protocols, after
 * dropping ratios outside [0.01, 3]. Categories with too few comparables fall
 * back to the global median. Every benchmark is clamped so one thin category
 * cannot set an absurd multiple.
 */
export function categoryBenchmarks(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { byCategory: Map<string, CategoryBenchmark>; global: number } {
  const ratiosByCategory = new Map<string, number[]>();
  const allRatios: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p)) continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    if (ratio < model.benchmark_ratio_floor || ratio > model.benchmark_ratio_cap) continue;
    allRatios.push(ratio);
    const key = p.category ?? 'Other';
    const list = ratiosByCategory.get(key);
    if (list === undefined) ratiosByCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  const clamp = (v: number): number => Math.min(model.benchmark_cap, Math.max(model.benchmark_floor, v));
  const global = allRatios.length > 0 ? clamp(median(allRatios)) : 0.25;
  const byCategory = new Map<string, CategoryBenchmark>();
  for (const [category, ratios] of ratiosByCategory) {
    if (ratios.length >= model.min_comparables) {
      byCategory.set(category, { category, benchmark: clamp(median(ratios)), comparables: ratios.length });
    }
  }
  return { byCategory, global };
}

/** The benchmark one protocol is priced on: its category's, else the global one. */
export function benchmarkFor(
  p: SnapshotProtocol,
  benchmarks: { byCategory: Map<string, CategoryBenchmark>; global: number },
): { benchmark: number; comparables: number } {
  const hit = p.category === null ? undefined : benchmarks.byCategory.get(p.category);
  if (hit !== undefined) return { benchmark: hit.benchmark, comparables: hit.comparables };
  return { benchmark: benchmarks.global, comparables: 0 };
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  benchmarks: { byCategory: Map<string, CategoryBenchmark>; global: number },
  model: ModelConstants = MODEL,
): {
  implied: number;
  benchmark: number;
  comparables: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const { benchmark, comparables } = benchmarkFor(protocol, benchmarks);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const effGrowth = growthPct >= 0 ? model.growth_cap * Math.sqrt(growthPct / model.growth_cap) : growthPct;
  const growthMult = 1 + (effGrowth / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chains = Math.max(1, protocol.chains.length);
  const breadthMult = Math.min(model.breadth_cap, 1 + model.breadth_weight * Math.log(chains));
  const implied = Math.max(
    1,
    Math.round(protocol.tvl_usd * benchmark * growthMult * maturityMult * breadthMult),
  );
  return { implied, benchmark, comparables, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The flags a row carries: what the model's number does not say on its own. */
export function flagsFor(p: SnapshotProtocol, age: number | null): string[] {
  const flags: string[] = [];
  if (p.change_7d !== null && p.change_7d < -10) flags.push('declining');
  if (age !== null && age < 90) flags.push('young');
  if (p.chains.length <= 1) flags.push('single-chain');
  if (p.tvl_usd < 10_000_000) flags.push('small-tvl');
  return flags;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const benchmarks = categoryBenchmarks(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries
  // (it cannot, but the board's coverage is the gate's row and is never gambled on
  // a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor.
  // The starter stopped at the 160 largest by TVL; this board carries all of them,
  // because the radar exists to find the early ones, not to re-list the largest.
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (!isRankable(p)) continue;
    chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, benchmarks, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      // The benchmark is stored unrounded: the dashboard recomputes the row
      // from it, and a rounded benchmark would recompute a different implied
      // value than board.json carries. The page rounds it for display only.
      category_benchmark: s.benchmark,
      comparables: s.comparables,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    flags: flagsFor(s.p, s.age),
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('onchain capital')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('liquid staking')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('privacy')) return `Deposit $${capital} into ${name} on ${chain} through its private pool and keep the receipt.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * The chain's leading venues, for the farm plan's concrete steps. Keyed by
 * chain, which the snapshot records, never by protocol name: the plan says
 * where the swap leg happens, and the venue follows the chain, not the row.
 */
const VENUES: Record<string, string> = {
  Ethereum: 'Uniswap and Aave',
  Solana: 'Jupiter and Kamino',
  Arbitrum: 'GMX and Uniswap',
  Base: 'Aerodrome',
  BSC: 'PancakeSwap',
  Optimism: 'Velodrome',
  Polygon: 'QuickSwap',
  Avalanche: 'Trader Joe',
  Sui: 'Cetus',
  Aptos: 'Thala',
};

/** Where to do the swap leg, from the protocol's own chain. */
function venueFor(chain: string): string {
  return VENUES[chain] ?? "the chain's leading DEX";
}

/** What one transaction costs on this chain, in dollars of gas. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return 'about $8 of gas';
  if (chain === 'Solana') return 'under $1 of gas';
  if (['Arbitrum', 'Optimism', 'Base', 'Polygon', 'BSC', 'Avalanche', 'Sui', 'Aptos', 'zkSync Era', 'Linea', 'Scroll', 'Blast'].includes(chain)) return 'about $1 of gas';
  return 'about $2 of gas';
}

/** The weekly qualifying action, in the protocol's own category words. */
function weeklyVerb(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'supply, borrow or repay';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return 'add or remove liquidity, or swap';
  if (c.includes('bridge')) return 'bridge a small amount';
  if (c.includes('staking') || c.includes('restak')) return 'stake or restake';
  if (c.includes('perpetual') || c.includes('derivative')) return 'open or close a small position';
  if (c.includes('prediction')) return 'place a market position';
  if (c.includes('curator') || c.includes('allocator') || c.includes('onchain capital')) return 'deposit into a vault';
  if (c.includes('stable')) return 'mint, deposit or redeem';
  if (c.includes('rwa')) return 'mint or hold the yield asset';
  if (c.includes('insurance')) return 'hold or renew cover';
  if (c.includes('basis')) return 'hold the basis position';
  if (c.includes('privacy')) return 'use the private pool';
  return 'deposit, swap or vote';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 * The weekly step names the protocol's own qualifying actions, and the last step names the exit check.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = gasFor(chain);
  const venue = venueFor(chain);
  const others = p.chains.length > 1 ? ` Repeat the position on ${p.chains[1]} if the protocol runs a points program there too.` : '';
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `${gas} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week on ${p.name}: ${weeklyVerb(p)}. Do the swap leg on ${venue} on ${chain} when the action needs a swap.${others}`,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_benchmark: row.model.category_benchmark,
    comparables: row.model.comparables,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    flags: row.flags,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const benchmarks = categoryBenchmarks(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_benchmark: round4(benchmarks.global),
    benchmarks: [...benchmarks.byCategory.values()].sort((a, b) => b.benchmark - a.benchmark),
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
