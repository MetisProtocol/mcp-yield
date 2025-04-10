import axios, { AxiosResponse } from "axios";

export class CoinGecko {
  private coingeckoIDConversion(tokenId: string) {
    switch (tokenId) {
      case "Metis":
        return "metis-token";
      case "USDT":
        return "tether";
      case "USDC":
        return "usd-coin";
      default:
        return "";
    }
  }

  async getTokenPrice(tokenId: string): Promise<number> {
    const convertedTokenId = this.coingeckoIDConversion(tokenId);
    let coinGeckoPrice: AxiosResponse;
    try {
      coinGeckoPrice = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${convertedTokenId}?x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}&localization=false&tickers=false&community_data=false&developer_data=false`
      );
      if (coinGeckoPrice.status !== 200) throw Error("Status code not OK");
      return parseFloat(coinGeckoPrice.data.market_data.current_price.usd);
    } catch (e) {
      console.log(`Failed to reach api: ${e}`);
      return 0;
    }
  }
}
