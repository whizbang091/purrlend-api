import { ethers } from "ethers";

const HYPEREVM_RPC = "https://rpc.hyperliquid.xyz/evm";
const POOL_ADDRESSES_PROVIDER = "0xf33e33B35163Ce2f46bf7150E1592839aC199124";
const UI_POOL_DATA_PROVIDER = "0x0C591b5A3615c21cbd09F028F2E4509C2938F65E";

const ABI = ["function getReservesData(address provider) view returns ((address underlyingAsset, string name, string symbol, uint256 decimals, uint256 baseLTVasCollateral, uint256 reserveLiquidationThreshold, uint256 reserveLiquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool isActive, bool isFrozen, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 liquidityRate, uint128 variableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint256 availableLiquidity, uint256 totalVariableDebt, uint256 priceInMarketReferenceCurrency, uint256 variableRateSlope1, uint256 variableRateSlope2, uint256 baseVariableBorrowRate, uint256 optimalUsageRatio, uint256 totalAToken, uint256 priceInEth, uint256 accruedToTreasury, uint256 unbacked, uint256 isolationModeTotalDebt, bool flashLoanEnabled, uint256 debtCeiling, uint256 debtCeilingDecimals, uint8 eModeCategoryId, uint256 borrowCap, uint256 supplyCap, uint16 eModeLtv, uint16 eModeLiquidationThreshold, uint16 eModeLiquidationBonus, address eModePriceSource, string eModeLabel, bool borrowableInIsolation)[], (uint256 marketReferenceCurrencyUnit, int256 marketReferencePriceInUsd, uint256 networkBaseTokenPriceInUsd))"];

function shortenUSD(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const provider = new ethers.JsonRpcProvider(HYPEREVM_RPC);
    const contract = new ethers.Contract(UI_POOL_DATA_PROVIDER, ABI, provider);
    const [reserves, baseCurrency] = await contract.getReservesData(POOL_ADDRESSES_PROVIDER);

    const unit = BigInt(baseCurrency.marketReferenceCurrencyUnit.toString()); // 1e8

    let totalMarketSize = 0;
    let totalAvailable  = 0;
    let totalBorrows    = 0;

    for (const r of reserves) {
      const decimals = Number(r.decimals);
      const price    = r.priceInMarketReferenceCurrency.toString();
      // price is always 1e(decimals + 22 + 8) based on Aave V3 on HyperEVM
      // so priceUSD = price / 10^(decimals + 22) / 1e8 * 1e8 = price / 10^(decimals+22)
      const PRICE_EXTRA = 22;
      const priceDivisor = Math.pow(10, decimals + PRICE_EXTRA);
      const priceUSD = Number(price) / priceDivisor;

      const toUSD = (raw) => (Number(raw) / Math.pow(10, decimals)) * priceUSD;

      totalMarketSize += toUSD(r.totalAToken.toString());
      totalAvailable  += toUSD(r.availableLiquidity.toString());
      totalBorrows    += toUSD(r.totalVariableDebt.toString());
    }

    return res.status(200).json({
      totalMarketSize: shortenUSD(totalMarketSize),
      totalAvailable:  shortenUSD(totalAvailable),
      totalBorrows:    shortenUSD(totalBorrows),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
