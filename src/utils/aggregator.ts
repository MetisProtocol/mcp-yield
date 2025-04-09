import { fetchContractData } from "../defi/lending/aave.js";
import { getHerculesPoolsArray, Pool } from "../defi/dex/hercules.js";
import { getNetswapLpAprs } from "../defi/dex/netswap.js";
import { getEnkiApr } from "../defi/lrt/enki.js";
import { formatAmount, parseFormattedAmount } from "./format.js";

interface UnifiedData {
  protocol: string;
  name: string;
  apy: number;
  tvl: number;
}

interface LendingData extends UnifiedData {
  borrow: number;
  stableBorrowApy: number;
}

interface DexData extends UnifiedData {
  apr: number;
  poolAddress: string;
}

interface LSTData extends UnifiedData {
  apr: number;
}

function multiplyStringAsFloat(strValue: string, multiplier: number): number {
  const num = parseFloat(strValue);
  return num * multiplier;
}
/**
 * Combines data from multiple DeFi protocols (AAVE, Hercules, etc.) into a unified format
 */
export class YieldProtocol {
  private cachedData: UnifiedData[] = [];

  /**
   * Fetch and normalize data from all supported protocols
   * Only include yield information for Dex, Lending, and LST categories
   */
  async fetchAllProtocolsData(): Promise<UnifiedData[]> {
    if (this.cachedData.length > 0) {
      return this.cachedData;
    }

    try {
      // Fetch data from Hercules (Dex)
      let herculesData: DexData[] = [];
      try {
        const herculesPoolsArray = await getHerculesPoolsArray();
        herculesData = herculesPoolsArray.map((pool) =>
          this.transformHerculesPool(pool)
        );
      } catch (error) {
        console.error("Error fetching Hercules data:", error);
      }

      // Fetch data from AAVE (Lending)
      let aaveData: LendingData[] = [];
      try {
        const aaveReserves = await fetchContractData();
        aaveData = this.transformAaveData(aaveReserves);
      } catch (error) {
        console.error("Error fetching AAVE data:", error);
      }

      // Fetch data from Netswap (Dex)
      let netswapData: DexData[] = [];
      try {
        const netswapPairs = await getNetswapLpAprs();
        netswapData = this.transformNetswapData(netswapPairs);
      } catch (error) {
        console.error("Error fetching Netswap data:", error);
      }

      // Fetch data from Enki (LST)
      let enkiData: LSTData[] = [];
      try {
        const enkiYield = await getEnkiApr();
        enkiData = this.transformEnkiData(enkiYield);
      } catch (error) {
        console.error("Error fetching Enki data:", error);
      }

      // Combine data from all protocols
      const allData = [
        ...herculesData,
        ...aaveData,
        ...netswapData,
        ...enkiData,
      ];

      // Filter and normalize data for Dex, Lending, and LST categories
      const filteredData = allData.filter((data) =>
        ["Dex", "Lending", "LST"].includes(this.getCategory(data.protocol))
      );

      // Update cache
      this.cachedData = filteredData;

      return filteredData;
    } catch (error) {
      console.error("Error fetching protocol data:", error);
      if (this.cachedData.length > 0) {
        return this.cachedData;
      }
      throw error;
    }
  }

  /**
   * Determine the category of a protocol
   */
  private getCategory(protocol: string): string {
    const dexProtocols = ["Hercules", "Netswap"];
    const lendingProtocols = ["AAVE"];
    const lstProtocols = ["Enki"];

    if (dexProtocols.includes(protocol)) {
      return "Dex";
    } else if (lendingProtocols.includes(protocol)) {
      return "Lending";
    } else if (lstProtocols.includes(protocol)) {
      return "LST";
    }
    return "Unknown";
  }

  /**
   * Transform Hercules pool data to unified format
   */
  transformHerculesPool(pool: Pool): DexData {
    return {
      protocol: "Hercules",
      name: pool.name,
      poolAddress: pool.address,
      tvl: parseFormattedAmount(pool.tvl || "0"),
      apy: pool.apy || 0,
      apr: pool.totalApr || 0,
    };
  }

  /**
   * Transform AAVE data to unified format
   */
  transformAaveData(aaveReserves: any[]): LendingData[] {
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
        tvl: parseFormattedAmount(reserve.totalLiquidityUSD),
        borrow: parseFormattedAmount(reserve.totalDebtUSD),
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
  transformNetswapData(netswapPairs: any[]): DexData[] {
    if (!netswapPairs || !Array.isArray(netswapPairs)) {
      return [];
    }

    return netswapPairs.map((pair) => {
      return {
        protocol: "Netswap",
        name: pair.name,
        poolAddress: pair.id,
        apr: pair.apr,
        apy: (1 + pair.apr / 365) ** 365 - 1, // Convert APR to APY
        tvl: pair.reserveUSD,
      };
    });
  }

  /**
   * Transform Enki data to unified format
   */
  transformEnkiData(enkiYield: any[]): LSTData[] {
    if (!enkiYield || !Array.isArray(enkiYield)) {
      return [];
    }

    return enkiYield.map((yieldData) => {
      return {
        protocol: "Enki",
        name: yieldData.timestamp,
        symbol: "eMetis",
        tvl: yieldData.tvl,
        apr: yieldData.apr,
        apy: (1 + yieldData.apr / 365) ** 365 - 1, // Convert APR to APY
      };
    });
  }

  /**
   * Get all pools data
   */
  async getAllData(): Promise<UnifiedData[]> {
    return await this.fetchAllProtocolsData();
  }

  /**
   * Get pools from a specific protocol
   */
  async getDataByProtocol(protocol: string): Promise<UnifiedData[]> {
    const allPools = await this.fetchAllProtocolsData();
    return allPools.filter(
      (pool) => pool.protocol.toLowerCase() === protocol.toLowerCase()
    );
  }

  /**
   * Get pools sorted by APY
   */
  async getTopYield(limit: number = 10): Promise<UnifiedData[]> {
    const allPools = await this.fetchAllProtocolsData();
    return allPools.sort((a, b) => (b.apy || 0) - (a.apy || 0)).slice(0, limit);
  }

  /**
   * Get pools containing a specific token
   */
  async getDataByToken(token: string): Promise<UnifiedData[]> {
    const allPools = await this.fetchAllProtocolsData();
    const searchToken = token.toLowerCase();

    return allPools.filter((pool) =>
      pool.name.toLowerCase().includes(searchToken)
    );
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
      formattedTvlByProtocol[protocol] = `$${formatAmount(tvl)}`;
    }

    return {
      totalTvl: `$${formatAmount(totalTvlValue)}`,
      byProtocol: formattedTvlByProtocol,
    };
  }
}
