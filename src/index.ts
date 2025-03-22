// Unified DeFi APY Model Context Protocol
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import AAVE module
import { fetchContractData } from "./defi/aave.js";

// Import Hercules module
import { ApiClient, Pool } from "./defi/hercules.js";

// Define types for our unified protocol
interface UnifiedPoolData {
  protocol: string;
  symbol: string;
  name: string;
  address?: string;
  apy: number;
  apr?: number;
  tvl: string;
  tvlUsd?: number;
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
class DeFiApyProtocol {
  private herculesClient: ApiClient;
  private cachedData: UnifiedPoolData[] = [];

  constructor(
    herculesApiUrl: string = "https://api.hercules.exchange/pools/apy"
  ) {
    this.herculesClient = new ApiClient(herculesApiUrl);
  }

  /**
   * Fetch and normalize data from all supported protocols
   */
  async fetchAllProtocolsData(): Promise<UnifiedPoolData[]> {
    try {
      // Fetch data from Hercules
      const herculesPoolsArray = await this.herculesClient.getPoolsArray();

      // Transform Hercules data to unified format
      const herculesData = herculesPoolsArray.map((pool) =>
        this.transformHerculesPool(pool)
      );

      // Fetch data from AAVE
      let aaveData: UnifiedPoolData[] = [];
      try {
        const aaveReserves = await fetchContractData();
        aaveData = this.transformAaveData(aaveReserves);
      } catch (error) {
        console.error("Error fetching AAVE data:", error);
        // Continue with just Hercules data if AAVE fails
      }

      // Combine data from all protocols
      const allData = [...herculesData, ...aaveData];

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
  private transformHerculesPool(pool: Pool): UnifiedPoolData {
    return {
      protocol: "Hercules",
      symbol: pool.name.split("-").join("/"), // Convert "WETH-METIS" to "WETH/METIS"
      name: pool.name,
      address: pool.address,
      apy: pool.apy,
      apr: pool.totalApr,
      tvl: pool.tvl,
    };
  }

  /**
   * Transform AAVE data to unified format
   */
  public transformAaveData(aaveReserves: any[]): UnifiedPoolData[] {
    if (!aaveReserves || !Array.isArray(aaveReserves)) {
      return [];
    }

    return aaveReserves.map((reserve) => ({
      protocol: "AAVE",
      symbol: reserve.symbol,
      name: reserve.name,
      address: reserve.underlyingAsset,
      apy: multiplyStringAsFloat(reserve.supplyAPY, 100) || 0,
      tvl: `$${this.formatAmount(reserve.totalLiquidityUSD)}`,
      tvlUsd: reserve.totalLiquidityUSD,
      borrowApy: multiplyStringAsFloat(reserve.variableBorrowAPY, 100) || 0,
      stableBorrowApy: multiplyStringAsFloat(reserve.stableBorrowAPY, 100) || 0,
      utilizationRate: reserve.utilizationRate,
    }));
  }

  /**
   * Format large numbers to human-readable format
   */
  private formatAmount(amount: number): string {
    if (amount >= 1_000_000_000) {
      return `${(amount / 1_000_000_000).toFixed(2)}B`;
    } else if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(2)}M`;
    } else if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(2)}K`;
    } else {
      return amount.toFixed(2);
    }
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
    return allPools.sort((a, b) => b.apy - a.apy).slice(0, limit);
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
    return allPools.filter((pool) => pool.apy >= threshold);
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
      // Extract numeric value from TVL string
      let tvlValue = 0;

      if (pool.tvlUsd) {
        tvlValue = pool.tvlUsd;
      } else if (pool.tvl) {
        const tvlStr = pool.tvl.replace("$", "");
        const numericValue = parseFloat(tvlStr);

        if (tvlStr.includes("B")) {
          tvlValue = numericValue * 1_000_000_000;
        } else if (tvlStr.includes("M")) {
          tvlValue = numericValue * 1_000_000;
        } else if (tvlStr.includes("K")) {
          tvlValue = numericValue * 1_000;
        } else {
          tvlValue = numericValue;
        }
      }

      if (!tvlByProtocol[pool.protocol]) {
        tvlByProtocol[pool.protocol] = 0;
      }

      tvlByProtocol[pool.protocol] += tvlValue;
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
class DeFiApyMcpServer {
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
        const pools = await this.protocol.getHighApyPools(5); // Default threshold of 5%
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
          pools = pools.filter((pool) => pool.apy >= args.minApy!);
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
        pools.sort((a, b) => b.apy - a.apy);

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
  console.error("Fatal error in main():", error);
  process.exit(1);
});

// Export for module usage
//export { DeFiApyProtocol, DeFiApyMcpServer, UnifiedPoolData };
