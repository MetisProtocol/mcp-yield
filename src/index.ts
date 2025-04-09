// Unified DeFi APY Model Context Protocol
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { YieldProtocol } from "./utils/aggregator.js";
import { z } from "zod";

export class YieldMcpServer {
  private protocol: YieldProtocol;
  private server: McpServer;

  constructor() {
    this.protocol = new YieldProtocol();

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
      async (extra) => {
        const pools = await this.protocol.getAllData();
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

    const getPoolsByProtocolSchema = {
      protocol: z
        .string()
        .describe(
          "Protocol name (e.g., 'AAVE', 'Hercules', 'Netswap', 'Enki')"
        ),
    };

    this.server.tool(
      "getYieldByProtocol",
      "Get yield information from a specific protocol",
      getPoolsByProtocolSchema,
      async (args, extra) => {
        const pools = await this.protocol.getDataByProtocol(args.protocol);
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
        .describe("Number of yield sources to return (default: 10)"),
    };

    this.server.tool(
      "getTopYield",
      "Get the top yield information for a set number of yield sources",
      getTopApyPoolsSchema,
      async (args, extra) => {
        const pools = await this.protocol.getTopYield(args.limit);
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
      "getYieldByToken",
      "Get yield sources containing a specific token",
      getPoolsByTokenSchema,
      async (args, extra) => {
        const pools = await this.protocol.getDataByToken(args.token);
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
    const getYieldsInputSchema = {
      protocol: z
        .string()
        .optional()
        .describe(
          "Filter by protocol (e.g., 'AAVE', 'Hercules', 'Netswap', 'Enki')"
        ),
      token: z.string().optional().describe("Filter by token symbol or name"),
      limit: z
        .number()
        .optional()
        .describe("Limit the number of results (default: all)"),
    };
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
