# Metis DeFi APY Aggregator

A Model Context Protocol (MCP) server that aggregates and provides APY/yield data from various DeFi protocols on the Metis blockchain.

## Overview

This project implements an MCP server that collects, normalizes, and exposes lending yield data from multiple DeFi protocols on Metis, including:

- AAVE
- Hercules Exchange
- Netswap
- Enki

The server provides a unified interface for querying yield opportunities across these protocols with filtering capabilities by APY, protocol name, and token.

## Features

- **Protocol Aggregation**: Combines data from multiple DeFi protocols into a unified format
- **Filtering Capabilities**: Filter yield opportunities by minimum APY, protocol, or token
- **MCP Integration**: Exposes all functionality through the Model Context Protocol

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mpc-apy.git
cd mpc-apy

# Install dependencies
bun install

# Build the project
bun run build
```

## Usage

Start the MCP server:

```json
"mcpServers": {
    "metis-yield-explorer": {
      "command": "node",
      "args": [
        "/PATH/TO/mcp-yield/build/index.js"
      ]
    },
    // Other MCP Servers
}
```

The server exposes the following tools via the Model Context Protocol:

### Available Tools

- `getAllPools`: Get all pools from all supported protocols
- `getPoolsByProtocol`: Get pools from a specific protocol
- `getTopApyPools`: Get top pools sorted by APY
- `getPoolsByToken`: Get pools containing a specific token
- `getHighApyPools`: Get pools with APY above a threshold
- `getTotalTvl`: Get total value locked (TVL) across all protocols
- `get-lending-yields`: Get lending yield opportunities with filtering options
- `get-total-tvl`: Get total TVL across all protocols

### Example Queries

#### Get Lending Yields with Filters

```json
{
  "name": "get-lending-yields",
  "args": {
    "minApy": 5,
    "protocol": "AAVE",
    "limit": 10
  }
}
```

#### Get Total TVL

```json
{
  "name": "get-total-tvl"
}
```

## Project Structure

- `src/index.ts`: Main entry point and MCP server implementation
- `src/defi/`: Protocol-specific implementations
  - `aave.ts`: AAVE protocol integration
  - `hercules.ts`: Hercules Exchange protocol integration

## Dependencies

- `@modelcontextprotocol/sdk`: MCP SDK for creating MCP-compatible servers
- `@aave/contract-helpers`: Utilities for interacting with AAVE contracts
- `@bgd-labs/aave-address-book`: Address references for AAVE contracts
- `axios`: HTTP client for API requests
- `zod`: Schema validation and typing

## License

MIT

## Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty of any kind, express or implied. The data provided by this tool is sourced from third-party DeFi protocols and may not always be accurate or up-to-date. Any financial decisions made based on this information are at your own risk. Always conduct your own research before making investment decisions.

The authors and contributors of this project are not responsible for any losses, damages, or other liabilities that may arise from using this software or the information it provides.
