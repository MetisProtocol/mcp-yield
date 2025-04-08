import { formatReservesAndIncentives } from "@aave/math-utils";
import dayjs from "dayjs";
import { ethers } from "ethers";
import {
  UiPoolDataProvider,
  UiIncentiveDataProvider,
} from "@aave/contract-helpers";
import * as markets from "@bgd-labs/aave-address-book";

// Sample RPC address for querying Metis network
const provider = new ethers.providers.JsonRpcProvider("https://metis.drpc.org");

// View contract used to fetch all reserves data (including market base currency data), and user reserves
const poolDataProviderContract = new UiPoolDataProvider({
  uiPoolDataProviderAddress: markets.AaveV3Metis.UI_POOL_DATA_PROVIDER,
  provider,
  chainId: 1088,
});

// View contract used to fetch all reserve incentives (APRs), and user incentives
const incentiveDataProviderContract = new UiIncentiveDataProvider({
  uiIncentiveDataProviderAddress:
    markets.AaveV3Metis.UI_INCENTIVE_DATA_PROVIDER,
  provider,
  chainId: 1088,
});

export async function fetchContractData() {
  // Object containing array of pool reserves and market base currency data
  // { reservesArray, baseCurrencyData }
  const reserves = await poolDataProviderContract.getReservesHumanized({
    lendingPoolAddressProvider: markets.AaveV3Metis.POOL_ADDRESSES_PROVIDER,
  });

  // Array of incentive tokens with price feed and emission APR
  const reserveIncentives =
    await incentiveDataProviderContract.getReservesIncentivesDataHumanized({
      lendingPoolAddressProvider: markets.AaveV3Metis.POOL_ADDRESSES_PROVIDER,
    });

  // 'reserves' and 'reserveIncentives' inputs from Fetching Protocol Data section

  const reservesArray = reserves.reservesData;
  const baseCurrencyData = reserves.baseCurrencyData;

  const currentTimestamp = dayjs().unix();

  /*
- @param `reserves` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.reservesArray`
- @param `currentTimestamp` Current UNIX timestamp in seconds, Math.floor(Date.now() / 1000)
- @param `marketReferencePriceInUsd` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.baseCurrencyData.marketReferencePriceInUsd`
- @param `marketReferenceCurrencyDecimals` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.baseCurrencyData.marketReferenceCurrencyDecimals`
- @param `reserveIncentives` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserveIncentives`
*/
  const formattedPoolReserves = formatReservesAndIncentives({
    reserves: reservesArray,
    currentTimestamp,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    reserveIncentives,
  });

  return formattedPoolReserves;
}
