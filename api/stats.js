import { ethers } from "ethers";

const HYPEREVM_RPC = "https://rpc.hyperliquid.xyz/evm";
const POOL_ADDRESSES_PROVIDER = "0xf33e33B35163Ce2f46bf7150E1592839aC199124";
const UI_POOL_DATA_PROVIDER = "0x0C591b5A3615c21cbd09F028F2E4509C2938F65E";

const ABI = ["function getReservesData(address provider) view returns ((address underlyingAsset, string name, string symbol, uint256 decimals, uint256 baseLTVasCollateral, uint256 reserveLiquidationThreshold, uint256 reserveLiquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool isActive, bool isFrozen, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 liquidityRate, uint128 variableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint256 availableLiquidity, uint256 totalVariableDebt, uint256 priceInMarketReferenceCurrency, uint256 variableRateSlope1, uint256 variableRateSlope2, uint256 baseVariableBorrowRate, uint256 optimalUsageRatio, uint256 totalAToken, uint256 priceInEth, uint256 accruedToTreasury, uint256 unbacked, uint256 isolationModeTotalDebt, bool flashLoanEnabled, uint256 debtCeiling, uint256 debtCeilingDecimals, uint8 eModeCategoryId, uint256 borrowCap, uint256 supplyCap, uint16 eModeLtv, uint16 eModeLiquidationThreshold, uint16 eModeLiquidationBonus, address eModePriceSource, string eModeLabel, bool borrowableInIsolation)[], (uint256 marketReferenceCurrencyUnit, int256 marketReferencePriceInUsd, uint256 networkBaseTokenPriceInUsd))"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const provider = new ethers.JsonRpcProvider(HYPEREVM_RPC);
    const contract = new ethers.Contract(UI_POOL_DATA_PROVIDER, ABI, provider);
    const [reserves] = await contract.getReservesData(POOL_ADDRESSES_PROVIDER);

    // Only HYPED for now to nail the math
    const hyped = reserves[0];
    const decimals = BigInt(hyped.decimals.toString());
    const price    = BigInt(hyped.priceInMarketReferenceCurrency.toString());
    const amount   = BigInt(hyped.totalAToken.toString());

    return res.status(200).json({
      symbol:    hyped.symbol,
      decimals:  decimals.toString(),
      price:     price.toString(),
      amount:    amount.toString(),
      // try dividing price by different powers to see which gives ~$1 per HYPED
      priceDiv1e40: (Number(price) / 1e40).toFixed(4),
      priceDiv1e39: (Number(price) / 1e39).toFixed(4),
      priceDiv1e38: (Number(price) / 1e38).toFixed(4),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
