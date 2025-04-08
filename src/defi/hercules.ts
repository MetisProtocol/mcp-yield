import axios from "axios";

// Define the GraphQL endpoint
const HERCULES_YIELD_URL = "https://api.hercules.exchange/pools/apy";

// Define the types based on the GraphQL response structure
export interface Token {
  id: string;
  symbol: string;
  name: string;
  totalValueLocked: string;
}

export interface Pool {
  pool: string;
  address: string;
  name: string;
  totalApr: number;
  tvl: string;
  apy: number;
}

/**
 * Fetch Hercules pools data from the new URL format
 */
export async function fetchHerculesPools(): Promise<Pool[]> {
  try {
    // Fetch data from the new source
    const response = await axios.get(HERCULES_YIELD_URL);
    const { data } = response.data;

    if (!data || !data.pools) {
      throw new Error("Invalid data format from the new source");
    }

    // Map the new data format to the existing Pool structure
    const pools: Pool[] = Object.values(data.pools).map((pool: any) => ({
      pool: pool.pool,
      totalApr: pool.totalApr,
      apy: pool.apy,
      address: pool.address,
      name: pool.name,
      tvl: pool.tvl,
    }));

    return pools;
  } catch (error) {
    console.error("Error fetching Hercules pools from new source:", error);
    return [];
  }
}

/**
 * Format TVL value to human-readable string
 */
export function formatTvl(tvl: number): string {
  if (tvl >= 1000000000) {
    return `$${(tvl / 1000000000).toFixed(2)}B`;
  } else if (tvl >= 1000000) {
    return `$${(tvl / 1000000).toFixed(2)}M`;
  } else if (tvl >= 1000) {
    return `$${(tvl / 1000).toFixed(1)}k`;
  }
  return `$${tvl.toFixed(2)}`;
}

/**
 * Calculate APY from APR
 * APY = (1 + APR/n)^n - 1, where n is the number of compounding periods
 */
export function calculateApyFromApr(apr: number): number {
  // Assuming daily compounding (365 times per year)
  const n = 365;
  const aprDecimal = apr / 100;
  return (Math.pow(1 + aprDecimal / n, n) - 1) * 100;
}

/**
 * Gets all pools as an array
 * @returns Promise with an array of pools
 */
export async function getHerculesPoolsArray(): Promise<Pool[]> {
  return await fetchHerculesPools();
}

/**
 * Gets pools sorted by APY in descending order
 * @returns Promise with sorted pools array
 */
export async function getHerculesPoolsSortedByApy(): Promise<Pool[]> {
  const pools = await getHerculesPoolsArray();
  return pools.sort((a, b) => (b.apy || 0) - (a.apy || 0));
}

/**
 * Gets pools with APY above a specified threshold
 * @param threshold The minimum APY value
 * @returns Promise with filtered pools array
 */
export async function getHerculesPoolsAboveApyThreshold(
  threshold: number
): Promise<Pool[]> {
  const pools = await getHerculesPoolsArray();
  return pools.filter((pool) => (pool.apy || 0) > threshold);
}

/**
 * Gets the total TVL across all pools
 * @returns Promise with the total TVL as a formatted string
 */
export async function getTotalTvl(): Promise<string> {
  const pools = await getHerculesPoolsArray();

  // Sum up the totalValueLockedUSD values
  const totalTvlValue = pools.reduce((total, pool) => {
    return total + parseFormattedAmount(pool.tvl);
  }, 0);

  // Format the total TVL
  return formatTvl(totalTvlValue);
}

function parseFormattedAmount(formattedAmount: string): number {
  if (!formattedAmount) return 0;

  // Remove currency symbol and any commas
  let cleanedStr = formattedAmount.replace(/[$,]/g, "").trim();

  // Extract the numeric part and the suffix
  const match = cleanedStr.match(/^([\d.]+)([KMB])?$/i);
  if (!match) return parseFloat(cleanedStr) || 0;

  const [, numPart, suffix] = match;
  const baseValue = parseFloat(numPart);

  if (isNaN(baseValue)) return 0;

  // Apply multiplier based on suffix
  if (suffix === "K" || suffix === "k") {
    return baseValue * 1_000;
  } else if (suffix === "M" || suffix === "m") {
    return baseValue * 1_000_000;
  } else if (suffix === "B" || suffix === "b") {
    return baseValue * 1_000_000_000;
  }

  return baseValue;
}
