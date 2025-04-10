// Unified DeFi APY Model Context Protocol
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { YieldProtocol } from "./utils/aggregator.js";
import { CoinGecko } from "./utils/coingecko.js";
import { z } from "zod";
import * as dotenv from "dotenv";
dotenv.config();

export class YieldMcpServer {
  private protocol: YieldProtocol;
  private coinGecko: CoinGecko;
  private server: McpServer;

  constructor() {
    this.protocol = new YieldProtocol();
    this.coinGecko = new CoinGecko();

    this.server = new McpServer({
      name: "metis-yield-aggregator",
      version: "1.0.0",
      transport: new StdioServerTransport(),
      description:
        "Yield aggregator across multiple protocols in the Metis Ecosystem",
    });

    this.server.tool(
      "getAllYield",
      "Get yield information from all supported protocols",
      async () => {
        const yieldData = await this.protocol.getAllData();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(yieldData),
            },
          ],
        };
      }
    );

    const getYieldByProtocolSchema = {
      protocol: z
        .string()
        .describe(
          "Protocol name (e.g., 'AAVE', 'Hercules', 'Netswap', 'Enki')"
        ),
    };

    this.server.tool(
      "getYieldByProtocol",
      "Get yield information from a specific protocol",
      getYieldByProtocolSchema,
      async (args) => {
        const yieldData = await this.protocol.getDataByProtocol(args.protocol);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(yieldData),
            },
          ],
        };
      }
    );

    // Get top pools by APY
    const getTopApySchema = {
      limit: z
        .number()
        .optional()
        .describe("Number of yield sources to return (default: 10)"),
    };

    this.server.tool(
      "getTopYield",
      "Get the top yield information for a set number of yield sources",
      getTopApySchema,
      async (args) => {
        const yieldData = await this.protocol.getTopYield(args.limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(yieldData),
            },
          ],
        };
      }
    );

    const getYieldByTokenSchema = {
      token: z.string().describe("Token symbol or name to search for"),
    };

    this.server.tool(
      "getYieldByToken",
      "Get yield sources containing a specific token",
      getYieldByTokenSchema,
      async (args) => {
        const yieldData = await this.protocol.getDataByToken(args.token);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(yieldData),
            },
          ],
        };
      }
    );

    // Get total TVL
    this.server.tool(
      "getTotalTvl",
      "Get total TVL across all protocols",
      async () => {
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

    const getTokenPriceSchema = {
      token: z.string().describe("Token symbol or name to search for"),
    };

    this.server.tool(
      "getTokenPrice",
      "Get token price of a specific token",
      getTokenPriceSchema,
      async (args) => {
        const price = await this.coinGecko.getTokenPrice(args.token);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(price),
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
  const server = new YieldMcpServer();
  await server.start();
}

main().catch((error) => {
  console.error("Error in main function:", error);
});
