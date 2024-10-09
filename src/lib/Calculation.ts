import { BN } from "@coral-xyz/anchor";

const PRECISION = 1e9;
const SECONDS_PER_YEAR = 31536000;

function timeToExpiry(endUnixTs: number, currentUnixTs: number): number {
  return Math.max(endUnixTs - currentUnixTs, 0);
}

function yearsToExpiryNano(endUnixTs: number, currentUnixTs: number): number {
  const timeToExp = timeToExpiry(endUnixTs, currentUnixTs);
  return (timeToExp * PRECISION) / SECONDS_PER_YEAR;
}

function rateScalarNano(
  scalarRootNano: BN,
  endUnixTs: number,
  currentUnixTs: number
): BN {
  const yearsToExpiry = yearsToExpiryNano(endUnixTs, currentUnixTs);
  return scalarRootNano.mul(new BN(PRECISION)).div(new BN(yearsToExpiry));
}

function proportionNano(nPt: number, nAsset: number): number {
  const denominator = nPt + nAsset;
  if (denominator === 0) {
    return PRECISION / 2; // Equivalent to 0.5 in fixed-point
  } else {
    return Math.floor((nPt * PRECISION) / denominator);
  }
}

function updateRateAnchor(
  nPt: number,
  nAsset: number,
  rateScalarNano: BN,
  lastImpliedRateNano: number,
  endUnixTs: number,
  currentUnixTs: number
): number {
  const pNano = proportionNano(nPt, nAsset);

  const numerator = pNano;
  const denominator = PRECISION - pNano;

  const lnValue = Math.log(numerator / denominator);
  const lnTermNano = lnValue * PRECISION;

  const yearsToExpiry = yearsToExpiryNano(endUnixTs, currentUnixTs);

  const yearsToExpiryF64 = yearsToExpiry / PRECISION;
  const lastImpliedRateF64 = lastImpliedRateNano / PRECISION;

  const exchangeRateTargetNano =
    Math.pow(lastImpliedRateF64, yearsToExpiryF64) * PRECISION;

  const rateAnchorNano =
    exchangeRateTargetNano -
    new BN(lnTermNano).mul(new BN(PRECISION)).div(rateScalarNano).toNumber();

  if (rateAnchorNano <= 0) {
    throw new Error("Negative rate anchor");
  }

  return rateAnchorNano;
}

function exchangeRateNano(
  pNano: number,
  rateScalarNano: BN,
  rateAnchorNano: number
): number {
  if (pNano <= 0 || pNano >= PRECISION) {
    throw new Error("Invalid proportion");
  }

  const numerator = pNano;
  const denominator = PRECISION - pNano;

  const lnValue = Math.log(numerator / denominator);
  const lnTermNano = new BN(lnValue * PRECISION);

  const exchangeRateNano =
    new BN(PRECISION).mul(lnTermNano).div(rateScalarNano).toNumber() +
    rateAnchorNano;

  if (exchangeRateNano <= 0) {
    throw new Error("Negative exchange rate");
  }

  return exchangeRateNano;
}

export const calculateAmountPtToIb = (
  currentUnixTs: number,
  endUnixTs: number,
  nPtPre: number,
  nAssetPre: number,
  scalarRootNanoPre: BN,
  lastImpliedRateNanoPre: number,
  dPt: number
) => {
  const nPtPost = nPtPre + dPt;
  const nAssetPost = nAssetPre - dPt;

  const rateAnchorNano = updateRateAnchor(
    nPtPre,
    nAssetPre,
    scalarRootNanoPre,
    lastImpliedRateNanoPre,
    endUnixTs,
    currentUnixTs
  );
  const pTrade = proportionNano(nPtPost, nAssetPost);

  const rateScalar = rateScalarNano(
    scalarRootNanoPre,
    endUnixTs,
    currentUnixTs
  );

  const exchangeRate = exchangeRateNano(pTrade, rateScalar, rateAnchorNano);

  const dIb = Math.floor((dPt * PRECISION) / exchangeRate);
  return dIb;
};

export const calculateAmountIbToPt = (
  currentUnixTs: number,
  endUnixTs: number,
  nPtPre: number,
  nAssetPre: number,
  scalarRootNanoPre: BN,
  lastImpliedRateNanoPre: number,
  dIb: number
) => {
  let lower = 0;
  let upper = nAssetPre; // Cannot trade more PT than available assets

  const tolerance = 1; // Adjust for desired precision
  const maxIterations = 100;

  let iteration = 0;
  let dPt;

  while (iteration < maxIterations) {
    dPt = Math.floor((lower + upper) / 2);

    const nPtPost = nPtPre + dPt;
    const nAssetPost = nAssetPre - dPt;

    if (nAssetPost < 0) {
      upper = dPt - 1;
      iteration++;
      continue;
    }

    const rateAnchorNano = updateRateAnchor(
      nPtPre,
      nAssetPre,
      scalarRootNanoPre,
      lastImpliedRateNanoPre,
      endUnixTs,
      currentUnixTs
    );

    const pTrade = proportionNano(nPtPost, nAssetPost);

    const rateScalar = rateScalarNano(
      scalarRootNanoPre,
      endUnixTs,
      currentUnixTs
    );

    const exchangeRate = exchangeRateNano(pTrade, rateScalar, rateAnchorNano);

    const exchangeRateFromTrade = Math.floor((dPt * PRECISION) / dIb);

    const f = exchangeRate - exchangeRateFromTrade;

    if (Math.abs(f) <= tolerance) {
      return dPt;
    }

    if (f > 0) {
      lower = dPt + 1;
    } else {
      upper = dPt - 1;
    }

    iteration++;
  }

  throw new Error("Failed to find dPt in calculateAmountIbToPt");
};

export const getBasePerIbCurr = (
  currentUnixTs: number,
  startUnixTS: number
) => {
  const elapsedTime = currentUnixTs - startUnixTS;
  const yearsElapsed = elapsedTime / SECONDS_PER_YEAR;
  return Math.pow(1.2, yearsElapsed);
};

export const calculateRequiredIbAmount = (
  amountNumber: number,
  currentUnixTS: number,
  endUnixTS: number,
  basePerIbCurr: number,
  nPt: number,
  nAsset: number,
  scalarRootNano: BN,
  lastImpliedRateNano: number
) => {
  const tolerance = 1e-6;
  const maxIterations = 100;
  let lower = amountNumber;
  let upper = nPt / basePerIbCurr;
  let requiredIbAmount = 0;
  let iteration = 0;
  let inIbAmm = 0;

  while (iteration < maxIterations) {
    requiredIbAmount = (lower + upper) / 2;
    const PtYtAmount = basePerIbCurr * requiredIbAmount;
    inIbAmm = calculateAmountPtToIb(
      currentUnixTS,
      endUnixTS,
      nPt,
      nAsset,
      scalarRootNano,
      lastImpliedRateNano,
      PtYtAmount
    );
    const f = requiredIbAmount - inIbAmm - amountNumber;

    if (Math.abs(f) <= tolerance) {
      break;
    }

    if (f > 0) {
      upper = requiredIbAmount;
    } else {
      lower = requiredIbAmount;
    }

    iteration++;
  }

  if (iteration === maxIterations) {
    throw new Error("Failed to find requiredIbAmount");
  }

  const inIbMerchant = requiredIbAmount - inIbAmm;

  return { requiredIbAmount, inIbMerchant, inIbAmm };
};
