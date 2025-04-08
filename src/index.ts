// Unified DeFi APY Model Context Protocol
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import AAVE module
import { fetchContractData } from "./defi/aave.js";

// Import Hercules module
import { getHerculesPoolsArray, Pool } from "./defi/hercules.js";

// Import Netswap module
import { getNetswapLpAprs } from "./defi/netswap.js";

// Define types for our unified protocol
interface UnifiedPoolData {
  protocol: string;
  symbol: string;
  name: string;
  address?: string;
  apy?: number;
  apr?: number;
  tvl: number;
  borrow?: number;
  borrowApy?: number;
  stableBorrowApy?: number;
  utilizationRate?: number;
}

function multiplyStringAsFloat(strValue: string, multiplier: number): number {
  const num = parseFloat(strValue);
  return num * multiplier;
}
/**
 * DeFi APY Data Protocol
 * Combines data from multiple DeFi protocols (AAVE, Hercules) into a unified format
 */
export class DeFiApyProtocol {
  private cachedData: UnifiedPoolData[] = [];

  /**
   * Fetch and normalize data from all supported protocols
   */
  async fetchAllProtocolsData(): Promise<UnifiedPoolData[]> {
    if (this.cachedData.length > 0) {
      return this.cachedData;
    }
    try {
      // Fetch data from Hercules
      let herculesData: UnifiedPoolData[] = [];
      try {
        const herculesPoolsArray = await getHerculesPoolsArray();
        herculesData = herculesPoolsArray.map((pool) =>
          this.transformHerculesPool(pool)
        );
      } catch (error) {
        console.error("Error fetching Hercules data:", error);
        // Continue with other data if Hercules fails
      }

      // Fetch data from AAVE
      let aaveData: UnifiedPoolData[] = [];
      try {
        const aaveReserves = await fetchContractData();
        aaveData = this.transformAaveData(aaveReserves);
      } catch (error) {
        console.error("Error fetching AAVE data:", error);
        // Continue with other data if AAVE fails
      }

      // Fetch data from Netswap
      let netswapData: UnifiedPoolData[] = [];
      try {
        const netswapPairs = await getNetswapLpAprs();
        netswapData = this.transformNetswapData(netswapPairs);
      } catch (error) {
        console.error("Error fetching Netswap data:", error);
      }

      // Combine data from all protocols
      const allData = [...herculesData, ...aaveData, ...netswapData];

      // Update cache
      this.cachedData = allData;

      return allData;
    } catch (error) {
      console.error("Error fetching protocol data:", error);
      // Return cached data if available, otherwise rethrow
      if (this.cachedData.length > 0) {
        return this.cachedData;
      }
      throw error;
    }
  }

  /**
   * Transform Hercules pool data to unified format
   */
  transformHerculesPool(pool: Pool): UnifiedPoolData {
    return {
      protocol: "Hercules",
      name: pool.pool,
      symbol: pool.name,
      address: pool.address,
      apy: pool.apy || 0,
      apr: pool.totalApr || 0,
      tvl: this.parseFormattedAmount(pool.tvl || "0"),
    };
  }

  /**
   * Transform AAVE data to unified format
   */
  transformAaveData(aaveReserves: any[]): UnifiedPoolData[] {
    if (!aaveReserves || !Array.isArray(aaveReserves)) {
      return [];
    }

    const result = aaveReserves.map((reserve) => {
      return {
        protocol: "AAVE",
        symbol: reserve.symbol,
        name: reserve.name,
        address: reserve.underlyingAsset,
        apy: multiplyStringAsFloat(reserve.supplyAPY, 100) || 0,
        borrowIncentiveAPR:
          multiplyStringAsFloat(
            reserve.aIncentivesData[0]?.incentiveAPR,
            100
          ) || 0,
        tvl: this.parseFormattedAmount(reserve.totalLiquidityUSD),
        borrow: this.parseFormattedAmount(reserve.totalDebtUSD),
        borrowApy: multiplyStringAsFloat(reserve.variableBorrowAPY, 100) || 0,
        stableBorrowApy:
          multiplyStringAsFloat(reserve.stableBorrowAPY, 100) || 0,
        utilizationRate: reserve.borrowUsageRatio,
      };
    });

    return result;
  }

  /**
   * Transform Netswap data to unified format
   */
  transformNetswapData(netswapPairs: any[]): UnifiedPoolData[] {
    if (!netswapPairs || !Array.isArray(netswapPairs)) {
      return [];
    }

    return netswapPairs.map((pair) => {
      return {
        protocol: "Netswap",
        symbol: pair.symbol,
        name: pair.name,
        address: pair.id,
        apr: pair.apr,
        tvl: pair.reserveUSD,
      };
    });
  }

  /**
   * Format large numbers to human-readable format
   */
  private formatAmount(amount: any): string {
    // Ensure amount is a number
    const numAmount = typeof amount === "number" ? amount : parseFloat(amount);

    // Check if conversion resulted in a valid number
    if (isNaN(numAmount)) {
      return "0.00";
    }

    if (numAmount >= 1_000_000_000) {
      return `${(numAmount / 1_000_000_000).toFixed(2)}B`;
    } else if (numAmount >= 1_000_000) {
      return `${(numAmount / 1_000_000).toFixed(2)}M`;
    } else if (numAmount >= 1_000) {
      return `${(numAmount / 1_000).toFixed(1)}K`;
    } else {
      return numAmount.toFixed(2);
    }
  }

  /**
   * Parse formatted amount string back to number
   * Examples: '$131.7K' -> 131700, '$1.13M' -> 1130000
   */
  private parseFormattedAmount(formattedAmount: string): number {
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

  /**
   * Get all pools data
   */
  async getAllPools(): Promise<UnifiedPoolData[]> {
    return await this.fetchAllProtocolsData();
  }

  /**
   * Get pools from a specific protocol
   */
  async getPoolsByProtocol(protocol: string): Promise<UnifiedPoolData[]> {
    const allPools = await this.fetchAllProtocolsData();
    return allPools.filter(
      (pool) => pool.protocol.toLowerCase() === protocol.toLowerCase()
    );
  }

  /**
   * Get pools sorted by APY
   */
  async getTopApyPools(limit: number = 10): Promise<UnifiedPoolData[]> {
    const allPools = await this.fetchAllProtocolsData();
    return allPools.sort((a, b) => (b.apy || 0) - (a.apy || 0)).slice(0, limit);
  }

  /**
   * Get pools containing a specific token
   */
  async getPoolsByToken(token: string): Promise<UnifiedPoolData[]> {
    const allPools = await this.fetchAllProtocolsData();
    const searchToken = token.toLowerCase();

    return allPools.filter(
      (pool) =>
        pool.symbol.toLowerCase().includes(searchToken) ||
        pool.name.toLowerCase().includes(searchToken)
    );
  }

  /**
   * Get pools with APY above threshold
   */
  async getHighApyPools(threshold: number = 10): Promise<UnifiedPoolData[]> {
    const allPools = await this.fetchAllProtocolsData();
    return allPools.filter((pool) => (pool.apy || 0) >= threshold);
  }

  /**
   * Get total TVL across all protocols
   */
  async getTotalTvl(): Promise<{
    totalTvl: string;
    byProtocol: Record<string, string>;
  }> {
    const allPools = await this.fetchAllProtocolsData();

    // Calculate total TVL by protocol
    const tvlByProtocol: Record<string, number> = {};

    allPools.forEach((pool) => {
      if (!tvlByProtocol[pool.protocol]) {
        tvlByProtocol[pool.protocol] = 0;
      }

      tvlByProtocol[pool.protocol] += pool.tvl;
    });

    // Calculate total TVL
    const totalTvlValue = Object.values(tvlByProtocol).reduce(
      (sum, value) => sum + value,
      0
    );

    // Format TVL values
    const formattedTvlByProtocol: Record<string, string> = {};
    for (const [protocol, tvl] of Object.entries(tvlByProtocol)) {
      formattedTvlByProtocol[protocol] = `$${this.formatAmount(tvl)}`;
    }

    return {
      totalTvl: `$${this.formatAmount(totalTvlValue)}`,
      byProtocol: formattedTvlByProtocol,
    };
  }
}

/**
 * MCP Server for DeFi APY Protocol
 */
export class DeFiApyMcpServer {
  private protocol: DeFiApyProtocol;
  private server: McpServer;

  constructor() {
    this.protocol = new DeFiApyProtocol();

    // Create MCP server
    this.server = new McpServer({
      name: "defi-apy-protocol",
      version: "1.0.0",
      transport: new StdioServerTransport(),
      description: "DeFi APY data aggregator across multiple protocols",
    });

    this.server.tool(
      "getAllPools",
      "Get all pools from all supported protocols",
      async (extra) => {
        const pools = await this.protocol.getAllPools();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pools),
            },
          ],
        };
      }
    );

    // Get pools from a specific protocol
    const getPoolsByProtocolSchema = {
      protocol: z.string().describe("Protocol name (e.g., 'AAVE', 'Hercules')"),
    };

    this.server.tool(
      "getPoolsByProtocol",
      "Get pools from a specific protocol",
      getPoolsByProtocolSchema,
      async (args, extra) => {
        const pools = await this.protocol.getPoolsByProtocol(args.protocol);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pools),
            },
          ],
        };
      }
    );

    // Get top pools by APY
    const getTopApyPoolsSchema = {
      limit: z
        .number()
        .optional()
        .describe("Number of pools to return (default: 10)"),
    };

    this.server.tool(
      "getTopApyPools",
      "Get top pools sorted by APY",
      getTopApyPoolsSchema,
      async (args, extra) => {
        const pools = await this.protocol.getTopApyPools(args.limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pools),
            },
          ],
        };
      }
    );

    // Get pools by token
    const getPoolsByTokenSchema = {
      token: z.string().describe("Token symbol or name to search for"),
    };

    this.server.tool(
      "getPoolsByToken",
      "Get pools containing a specific token",
      getPoolsByTokenSchema,
      async (args, extra) => {
        const pools = await this.protocol.getPoolsByToken(args.token);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pools),
            },
          ],
        };
      }
    );

    // Get high APY pools
    const getHighApyPoolsSchema = {
      threshold: z
        .number()
        .optional()
        .describe("APY threshold in percent (default: 10)"),
    };

    this.server.tool(
      "getHighApyPools",
      "Get pools with high APY",
      getHighApyPoolsSchema,
      async (args, extra) => {
        const pools = await this.protocol.getHighApyPools(args.threshold || 10);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pools),
            },
          ],
        };
      }
    );

    // Get total TVL
    this.server.tool(
      "getTotalTvl",
      "Get total TVL across all protocols",
      async (extra) => {
        const tvlData = await this.protocol.getTotalTvl();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tvlData),
            },
          ],
        };
      }
    );

    // Define input schema for the get-lending-yields tool
    const getLendingYieldsInputSchema = {
      minApy: z
        .number()
        .optional()
        .describe("Minimum APY threshold in percent (default: 0)"),
      protocol: z
        .string()
        .optional()
        .describe("Filter by protocol (e.g., 'AAVE', 'Hercules')"),
      token: z.string().optional().describe("Filter by token symbol or name"),
      limit: z
        .number()
        .optional()
        .describe("Limit the number of results (default: all)"),
    };

    // Register tools
    this.server.tool(
      "get-lending-yields",
      "Get lending yield opportunities from Metis lending protocols",
      getLendingYieldsInputSchema,
      async (args, extra) => {
        let pools = await this.protocol.getAllPools();

        // Apply filters
        if (args.minApy !== undefined) {
          pools = pools.filter((pool) => (pool.apy || 0) >= args.minApy!);
        }

        if (args.protocol !== undefined) {
          pools = pools.filter(
            (pool) =>
              pool.protocol.toLowerCase() === args.protocol!.toLowerCase()
          );
        }

        if (args.token !== undefined) {
          pools = pools.filter(
            (pool) =>
              pool.symbol.toLowerCase().includes(args.token!.toLowerCase()) ||
              pool.name.toLowerCase().includes(args.token!.toLowerCase())
          );
        }

        // Sort by APY (highest first)
        pools.sort((a, b) => (b.apy || 0) - (a.apy || 0));

        // Apply limit
        if (args.limit !== undefined && args.limit > 0) {
          pools = pools.slice(0, args.limit);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pools),
            },
          ],
        };
      }
    );

    this.server.tool(
      "get-total-tvl",
      "Get total value locked (TVL) across all protocols",
      async (extra) => {
        const tvlData = await this.protocol.getTotalTvl();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tvlData),
            },
          ],
        };
      }
    );
  }

  /**
   * Start the MCP server
   */
  async start() {
    try {
      // Create a transport for the MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    } catch (error) {
      console.error("Failed to start MCP server:", error);
      throw error;
    }
  }
}

// Main function to start the server
async function main() {
  const server = new DeFiApyMcpServer();
  await server.start();
}

main().catch((error) => {
  console.error("Error in main function:", error);
});
