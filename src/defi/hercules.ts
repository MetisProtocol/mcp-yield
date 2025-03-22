// api-client.ts
import axios from "axios";

// Define the types based on the API response structure
export interface Pool {
  pool: string;
  address: string;
  name: string;
  totalApr: number;
  tvl: string;
  apy: number;
}

interface ApiResponse {
  data: {
    lastSync: number;
    pools: {
      [address: string]: Pool;
    };
  };
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetches pool data from the API
   * @returns Promise with the pool data
   */
  async fetchPools(): Promise<ApiResponse> {
    try {
      const response = await axios.get<ApiResponse>(this.baseUrl);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API Error: ${error.message}`);
      }
      throw new Error(`Unexpected error: ${String(error)}`);
    }
  }

  /**
   * Gets all pools as an array
   * @returns Promise with an array of pools
   */
  async getPoolsArray(): Promise<Pool[]> {
    const response = await this.fetchPools();
    return Object.values(response.data.pools);
  }

  /**
   * Gets the timestamp of the last synchronization
   * @returns Promise with the last sync timestamp
   */
  async getLastSyncTimestamp(): Promise<number> {
    const response = await this.fetchPools();
    return response.data.lastSync;
  }

  /**
   * Gets a specific pool by its address
   * @param address The pool address
   * @returns Promise with the pool data or null if not found
   */
  async getPoolByAddress(address: string): Promise<Pool | null> {
    const response = await this.fetchPools();
    return response.data.pools[address] || null;
  }

  /**
   * Gets pools sorted by APY in descending order
   * @returns Promise with sorted pools array
   */
  async getPoolsSortedByApy(): Promise<Pool[]> {
    const pools = await this.getPoolsArray();
    return pools.sort((a, b) => b.apy - a.apy);
  }

  /**
   * Gets pools with APY above a specified threshold
   * @param threshold The minimum APY value
   * @returns Promise with filtered pools array
   */
  async getPoolsAboveApyThreshold(threshold: number): Promise<Pool[]> {
    const pools = await this.getPoolsArray();
    return pools.filter((pool) => pool.apy > threshold);
  }

  /**
   * Gets the total TVL across all pools
   * @returns Promise with the total TVL as a formatted string
   */
  async getTotalTvl(): Promise<string> {
    const pools = await this.getPoolsArray();

    // Extract numerical values from TVL strings (e.g., "$1.13M" → 1130000)
    const totalTvlValue = pools.reduce((total, pool) => {
      const tvlStr = pool.tvl;
      const numericValue = parseFloat(tvlStr.replace(/[^0-9.]/g, ""));

      if (tvlStr.includes("k")) {
        return total + numericValue * 1000;
      } else if (tvlStr.includes("M")) {
        return total + numericValue * 1000000;
      } else if (tvlStr.includes("B")) {
        return total + numericValue * 1000000000;
      }

      return total + numericValue;
    }, 0);

    // Format the total TVL
    if (totalTvlValue >= 1000000000) {
      return `$${(totalTvlValue / 1000000000).toFixed(2)}B`;
    } else if (totalTvlValue >= 1000000) {
      return `$${(totalTvlValue / 1000000).toFixed(2)}M`;
    } else if (totalTvlValue >= 1000) {
      return `$${(totalTvlValue / 1000).toFixed(1)}k`;
    }

    return `$${totalTvlValue.toFixed(2)}`;
  }
}
