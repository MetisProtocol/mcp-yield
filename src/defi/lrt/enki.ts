import axios from "axios";
import { BigNumber } from "bignumber.js";
import { time } from "console";
import { ethers } from "ethers";

// Define the GraphQL endpoint
const ENKI_GRAPH_URL =
  "https://api.metis.0xgraph.xyz/api/public/7628e867-6568-4fe1-9c24-742d1ffc6e79/subgraphs/generated/RewardDispatcher/v0.0.2/gn";

// Define the contract address
const CONTRACT_ADDRESS = "0x79F3522a1b56f22a6549e42f9cfa92eF5FEb81e8";

// Define the ABI for the total supply function
const ERC20_ABI = ["function totalSupply() view returns (uint256)"];

/**
 * Fetch the total supply of the contract
 */
async function fetchTotalSupply(blockNumber?: string): Promise<BigNumber> {
  const provider = new ethers.providers.JsonRpcProvider(
    "https://andromeda.metis.io/?owner=1088"
  );
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC20_ABI, provider);
  const totalSupply = await contract.totalSupply({
    blockTag: Number(blockNumber),
  });
  return new BigNumber(totalSupply.toString());
}

/**
 * Fetch dispatched data and calculate APR
 */
export async function getEnkiApr(): Promise<
  Array<{ id: string; amount: string; tvl: string; apr: number }>
> {
  try {
    // Fetch dispatched data from the GraphQL endpoint
    const response = await axios.post(ENKI_GRAPH_URL, {
      query: `
      query {
        dispatcheds(orderBy: blockNumber, orderDirection: desc) {
        id
        amount
        toVaultAmount
        toTreasuryAmount
        transactionHash
        blockNumber
        blockTimestamp
        }
      }
      `,
    });

    const dispatcheds = response.data.data.dispatcheds;

    // Calculate APY for each dispatched entry
    const results = await Promise.all(
      dispatcheds.map(
        async (dispatched: {
          id: string;
          amount: string;
          toVaultAmount: string;
          blockNumber: string;
          blockTimestamp: string;
        }) => {
          const totalSupplyForBlock = await fetchTotalSupply(
            dispatched.blockNumber
          );
          const adjustedAmount = new BigNumber(dispatched.toVaultAmount).div(
            totalSupplyForBlock
          );
          const apr = adjustedAmount.multipliedBy(365).multipliedBy(10); // Annualize and convert to percentage
          const tvl = ethers.utils.formatEther(
            new BigNumber(totalSupplyForBlock.toString()).toFixed(0)
          );
          return {
            id: dispatched.id,
            amount: dispatched.amount,
            tvl: tvl,
            apr: apr.toNumber(),
            timestamp: dispatched.blockTimestamp,
          };
        }
      )
    );

    return results;
  } catch (error) {
    console.error("Error fetching Enki APY:", error);
    return [];
  }
}
