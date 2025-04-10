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
      ],
      "env": {
        "COINGECKO_API_KEY": "your-api-key-here"
      }
    },
    // Other MCP Servers
}
```

The server exposes the following tools via the Model Context Protocol:

### Available Tools

- `getAllYield`: Retrieve yield information from all supported protocols in a unified format.
- `getYieldByProtocol`: Retrieve yield information from a specific protocol (e.g., AAVE, Hercules, Netswap, Enki).
- `getTopYield`: Retrieve the top yield information for a set number of yield sources, sorted by APY.
- `getYieldByToken`: Retrieve yield sources containing a specific token.
- `getTotalTvl`: Retrieve the total value locked (TVL) across all protocols.
- `getTokenPrice`: Retrieve the price of a specific token. (Requires CoinGecko API Key)

### Example Queries

#### Get Lending Yields with Filters

```json
{
  "name": "getYieldByProtocol",
  "args": {
    "protocol": "AAVE"
  }
}
```

#### Get Total TVL

```json
{
  "name": "getTotalTvl"
}
```

## License

MIT

## Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty of any kind, express or implied. The data provided by this tool is sourced from third-party DeFi protocols and may not always be accurate or up-to-date. Any financial decisions made based on this information are at your own risk. Always conduct your own research before making investment decisions.

The authors and contributors of this project are not responsible for any losses, damages, or other liabilities that may arise from using this software or the information it provides.
