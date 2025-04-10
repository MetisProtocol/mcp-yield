import axios, { all } from "axios";
import { BigNumber } from "bignumber.js";

// Define the GraphQL endpoint
const NETSWAP_GRAPH_URL =
  "https://metisapi.0xgraph.xyz/subgraphs/name/netswap/exchange";

// Types for GraphQL response
interface Token {
  id: string;
  symbol: string;
  name: string;
  totalLiquidity: string;
  derivedMETIS: string;
}

interface Pair {
  id: string;
  txCount: string;
  token0: Token;
  token1: Token;
  reserve0: string;
  reserve1: string;
  reserveUSD: string;
  totalSupply: string;
  trackedReserveMETIS: string;
  reserveMETIS: string;
  volumeUSD: string;
  untrackedVolumeUSD: string;
  token0Price: string;
  token1Price: string;
  createdAtTimestamp: string;
  pairHourData?: PairHourData[];
}

interface PairHourData {
  hourlyVolumeUSD: string;
}

interface GraphQLResponse {
  data: {
    pairs: Pair[];
  };
}

/**
 * Fetches pair data from Netswap GraphQL API
 */
export async function fetchNetswapPairs(): Promise<Pair[]> {
  try {
    // GraphQL query to fetch the top 100 pairs by liquidity
    const pairsQuery = `
      query($now: Int!) {
        pairs(first: 100, orderBy: reserveUSD, orderDirection: desc) {
          id
          txCount
          token0 {
            id
            symbol
            name
            totalLiquidity
            derivedMETIS
          }
          token1 {
            id
            symbol
            name
            totalLiquidity
            derivedMETIS
          }
          reserve0
          reserve1
          reserveUSD
          totalSupply
          trackedReserveMETIS
          reserveMETIS
          volumeUSD
          untrackedVolumeUSD
          token0Price
          token1Price
          createdAtTimestamp
          pairHourData(where: { hourStartUnix_gt: $now }) {
            hourlyVolumeUSD
          }
        }
      }
    `;

    const now = Math.floor(new Date().getTime() / 1000) - 3600 * 24; // unix timestamp minus 1 day

    const pairsResponse = await axios.post<GraphQLResponse>(NETSWAP_GRAPH_URL, {
      query: pairsQuery,
      variables: { now },
    });

    const pairs = pairsResponse.data.data.pairs;

    if (pairs.length === 0) {
      return [];
    }

    // Filter pairs with reserveUSD > 1000 and APR > 0
    return pairs.filter((pair) => {
      const last24HourVol =
        pair.pairHourData?.reduce(
          (sum: BigNumber, data) => sum.plus(data.hourlyVolumeUSD),
          new BigNumber(0)
        ) || new BigNumber(0);

      if (new BigNumber(pair.reserveUSD).gt(0)) {
        const apr = last24HourVol
          .multipliedBy(365) // Annualize daily volume
          .multipliedBy(0.0025) // 0.25% fee
          .div(pair.reserveUSD) // Divide by liquidity
          .multipliedBy(100); // Convert to percentage

        return apr.gt(0) && new BigNumber(pair.reserveUSD).gt(1000);
      }

      return false;
    });
  } catch (error) {
    console.error("Error fetching Netswap pairs:", error);
    return [];
  }
}

/**
 * Calculate LP APR for Netswap pairs
 */
export function calculateNetswapLpApr(pairs: Pair[]): Array<{
  id: string;
  name: string;
  symbol: string;
  reserveUSD: number;
  volumeUSD: number;
  apr: number;
}> {
  return pairs.map((pair) => {
    // Calculate 24-hour volume
    const last24HourVol =
      pair.pairHourData?.reduce(
        (sum: BigNumber, data) => sum.plus(data.hourlyVolumeUSD),
        new BigNumber(0)
      ) || new BigNumber(0);

    let apr = 0;

    if (new BigNumber(pair.reserveUSD).gt(0)) {
      apr = Number(
        last24HourVol
          .multipliedBy(365) // Annualize daily volume
          .multipliedBy(0.0025) // 0.25% fee
          .div(pair.reserveUSD) // Divide by liquidity
          .multipliedBy(100) // Convert to percentage
          .toFixed(2) // Format to 2 decimal places
      );
    }

    return {
      id: pair.id,
      name: `${pair.token0.symbol}-${pair.token1.symbol}`,
      symbol: `${pair.token0.symbol}/${pair.token1.symbol}`,
      reserveUSD: Number(pair.reserveUSD),
      volumeUSD: Number(pair.volumeUSD),
      last24HourVol: last24HourVol.toNumber(),
      apr,
    };
  });
}

/**
 * Fetch and calculate Netswap LP APRs
 */
export async function getNetswapLpAprs() {
  try {
    const pairs = await fetchNetswapPairs();
    const pairsWithApr = calculateNetswapLpApr(pairs);

    // Sort by APR descending
    return pairsWithApr.sort((a, b) => b.apr - a.apr);
  } catch (error) {
    console.error("Error calculating Netswap LP APRs:", error);
    return [];
  }
}
