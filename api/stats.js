import { ethers } from "ethers";

const HYPEREVM_RPC = "https://rpc.hyperliquid.xyz/evm";
const POOL_ADDRESSES_PROVIDER = "0xf33e33B35163Ce2f46bf7150E1592839aC199124";
const UI_POOL_DATA_PROVIDER = "0x0C591b5A3615c21cbd09F028F2E4509C2938F65E";

const ABI = ["function getReservesData(address provider) view returns ((address underlyingAsset, string name, string symbol, uint256 decimals, uint256 baseLTVasCollateral, uint256 reserveLiquidationThreshold, uint256 reserveLiquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool isActive, bool isFrozen, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 liquidityRate, uint128 variableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint256 availableLiquidity, uint256 totalVariableDebt, uint256 priceInMarketReferenceCurrency, uint256 variableRateSlope1, uint256 variableRateSlope2, uint256 baseVariableBorrowRate, uint256 optimalUsageRatio, uint256 totalAToken, uint256 priceInEth, uint256 accruedToTreasury, uint256 unbacked, uint256 isolationModeTotalDebt, bool flashLoanEnabled, uint256 debtCeiling, uint256 debtCeilingDecimals, uint8 eModeCategoryId, uint256 borrowCap, uint256 supplyCap, uint16 eModeLtv, uint16 eModeLiquidationThreshold, uint16 eModeLiquidationBonus, address eModePriceSource, string eModeLabel, bool borrowableInIsolation)[], (uint256 marketReferenceCurrencyUnit, int256 marketReferencePriceInUsd, uint256 networkBaseTokenPriceInUsd))"];

function shortenUSD(cents) {
  // cents is in whole USD cents (divide by 100 for dollars)
  const dollars = Number(cents) / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(2)}K`;
  return `$${dollars.toFixed(2)}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const provider = new ethers.JsonRpcProvider(HYPEREVM_RPC);
    const contract = new ethers.Contract(UI_POOL_DATA_PROVIDER, ABI, provider);
    const [reserves] = await contract.getReservesData(POOL_ADDRESSES_PROVIDER);

    // SCALE keeps 2 decimal places of USD precision (cents)
    const SCALE = 100n;

    let totalMarketSize = 0n;
    let totalAvailable  = 0n;
    let totalBorrows    = 0n;

    for (const r of reserves) {
      const decimals = BigInt(r.decimals.toString());
      const price    = BigInt(r.priceInMarketReferenceCurrency.toString());
      // price is in units of 10^(decimals + 22 + 8)
      // USD cents = amount * price * 100 / 10^decimals / 10^(decimals+22) / 10^8 * 10^(decimals+22+8)
      // simplified: USD cents = amount * price * SCALE / 10^decimals / 10^(decimals+30)
      const divisor = 10n ** (decimals + 30n);

      const toCents = (raw) => BigInt(raw.toString()) * price * SCALE / 10n ** decimals / divisor;

      totalMarketSize += toCents(r.totalAToken);
      totalAvailable  += toCents(r.availableLiquidity);
      totalBorrows    += toCents(r.totalVariableDebt);
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
