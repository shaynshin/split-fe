import { NextResponse } from "next/server";
import { SplitClient } from "@/client/split.client";
import { createConnection } from "@/lib/Connection";
import * as smIdl from "@/client/idl/split_program.json";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { SPLIT_PROGRAM_ID } from "@/lib/Constants";
import { calculateRequiredIbAmount, getBasePerIbCurr } from "@/lib/Calculation";
import { BN } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

const markets = {
  SOL: {
    marketId: "EvhH5tnknbgikGsqRMLMCXNPEnsKs8P3mWxpt65eG6fK",
    mint: "9g3Zn7Qkwx4duF4L9tVQjXB1MnoMpnyrHRgY11da7ETB",
    decimals: 9,
  },
  USDC: {
    marketId: "EvhH5tnknbgikGsqRMLMCXNPEnsKs8P3mWxpt65eG6fK",
    mint: "fAM1Fwf2ZutMTPRvXYnJLpWkb3FRoP7uQWyNCX2Uvfk",
    decimals: 6,
  },
};

/**
 * @swagger
 * /api/pay/{ibToken}:
 *   get:
 *     summary: Calculate required IB amount
 *     description: Calculates the required IB amount for a given payment amount and returns the lock amount.
 *     parameters:
 *       - in: path
 *         name: ibToken
 *         required: true
 *         schema:
 *           type: string
 *         description: The IB token symbol (e.g., SOL, USDC).
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: The amount to be paid.
 *     responses:
 *       200:
 *         description: Successfully calculated required IB amount.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 endUnixTS:
 *                   type: number
 *                   description: The end Unix timestamp.
 *                 lockAmount:
 *                   type: number
 *                   description: The required IB amount to lock.
 *       400:
 *         description: Invalid input parameters.
 *       500:
 *         description: Internal server error.
 */
export async function GET(
  req: Request,
  { params }: { params: { ibToken: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const amount = searchParams.get("amount");

    // check amount exists and is a positive number
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // check ibToken exists in market object
    if (!(params.ibToken in markets)) {
      return NextResponse.json({ error: "Invalid ibToken" }, { status: 400 });
    }

    const market = markets[params.ibToken as keyof typeof markets].marketId;
    const smc = new SplitClient(
      createConnection(),
      smIdl as any,
      new PublicKey(SPLIT_PROGRAM_ID)
    );
    const marketAcc = await smc.fetchMarketAcc(new PublicKey(market));
    const [amm] = smc.findAMM(new PublicKey(market));
    const ammAcc = await smc.fetchAMMAcc(amm);

    const startUnixTS = marketAcc.startUnixTs.toNumber();
    const endUnixTS = marketAcc.endUnixTs.toNumber();
    const currentUnixTS = Date.now() / 1000;
    const basePerIbCurr = getBasePerIbCurr(currentUnixTS, startUnixTS);

    const amountNumber =
      Number(amount) *
      10 ** markets[params.ibToken as keyof typeof markets].decimals;

    // Use the new function to calculate requiredIbAmount
    const { requiredIbAmount, inIbMerchant, inIbAmm } =
      calculateRequiredIbAmount(
        amountNumber,
        currentUnixTS,
        endUnixTS,
        basePerIbCurr,
        ammAcc.nPt.toNumber(),
        ammAcc.nAsset.toNumber(),
        new BN(ammAcc.scalarRootNano.toString()),
        ammAcc.lastImpliedRateNano.toNumber()
      );

    const response = {
      endUnixTS: endUnixTS,
      lockAmount:
        requiredIbAmount /
        10 ** markets[params.ibToken as keyof typeof markets].decimals,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching action:", error);
    const message = "Failed to fetch action";
    return new Response(message, {
      status: 500,
    });
  }
}

/**
 * @swagger
 * /api/pay/{ibToken}:
 *   post:
 *     summary: Process payment transaction
 *     description: Processes a payment transaction between a customer and a merchant.
 *     parameters:
 *       - in: path
 *         name: ibToken
 *         required: true
 *         schema:
 *           type: string
 *         description: The IB token symbol (e.g., SOL, USDC).
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: The amount to be paid.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - merchant
 *               - customer
 *             properties:
 *               merchant:
 *                 type: string
 *                 description: The merchant's Solana public key.
 *               customer:
 *                 type: string
 *                 description: The customer's Solana public key.
 *     responses:
 *       200:
 *         description: Successfully created serialized payment transaction.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transaction:
 *                   type: string
 *                   description: The serialized transaction in base64 format.
 *       400:
 *         description: Invalid input parameters.
 *       500:
 *         description: Internal server error.
 */
export async function POST(
  req: Request,
  { params }: { params: { ibToken: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const amount = searchParams.get("amount");
    const { merchant, customer } = await req.json();

    // check amount exists and is a positive number
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // check ibToken exists in market object
    if (!(params.ibToken in markets)) {
      return NextResponse.json({ error: "Invalid ibToken" }, { status: 400 });
    }

    // check merchant and customer exists
    if (!merchant || !customer) {
      return NextResponse.json(
        { error: "Invalid merchant or customer" },
        { status: 400 }
      );
    }

    // check merchant and customer are valid solana public keys
    try {
      new PublicKey(merchant);
      new PublicKey(customer);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid merchant or customer" },
        { status: 400 }
      );
    }

    const market = markets[params.ibToken as keyof typeof markets].marketId;
    const smc = new SplitClient(
      createConnection(),
      smIdl as any,
      new PublicKey(SPLIT_PROGRAM_ID)
    );
    const marketAcc = await smc.fetchMarketAcc(new PublicKey(market));
    const [amm] = smc.findAMM(new PublicKey(market));
    const ammAcc = await smc.fetchAMMAcc(amm);

    const startUnixTS = marketAcc.startUnixTs.toNumber();
    const endUnixTS = marketAcc.endUnixTs.toNumber();
    const currentUnixTS = Date.now() / 1000;
    const basePerIbCurr = getBasePerIbCurr(currentUnixTS, startUnixTS);

    const amountNumber =
      Number(amount) *
      10 ** markets[params.ibToken as keyof typeof markets].decimals;

    const ixs = [];

    // Use the new function to calculate requiredIbAmount
    const { requiredIbAmount, inIbMerchant, inIbAmm } =
      calculateRequiredIbAmount(
        amountNumber,
        currentUnixTS,
        endUnixTS,
        basePerIbCurr,
        ammAcc.nPt.toNumber(),
        ammAcc.nAsset.toNumber(),
        new BN(ammAcc.scalarRootNano.toString()),
        ammAcc.lastImpliedRateNano.toNumber()
      );

    const ytMintKp = Keypair.generate();
    const ytMint = ytMintKp.publicKey;

    const mintPYTIxs = await smc.mintPYT(
      { ibInAmount: new BN(requiredIbAmount) },
      {
        user: new PublicKey(customer),
        market: new PublicKey(market),
        tokenYtMint: new PublicKey(ytMint),
        tokenIbMint: new PublicKey(
          markets[params.ibToken as keyof typeof markets].mint
        ),
        tokenIbProgram: TOKEN_2022_PROGRAM_ID,
      }
    );

    ixs.push(...mintPYTIxs);

    const swapYtIxs = await smc.swapYt(
      { deltaPt: new BN(requiredIbAmount * basePerIbCurr) },
      {
        user: new PublicKey(customer),
        market: new PublicKey(market),
        ytMint: new PublicKey(ytMint),
        tokenIbMint: new PublicKey(
          markets[params.ibToken as keyof typeof markets].mint
        ),
        tokenIbProgram: TOKEN_2022_PROGRAM_ID,
      }
    );

    ixs.push(...swapYtIxs);

    const customerIbAta = getAssociatedTokenAddressSync(
      new PublicKey(markets[params.ibToken as keyof typeof markets].mint),
      new PublicKey(customer),
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const merchantIbAta = getAssociatedTokenAddressSync(
      new PublicKey(markets[params.ibToken as keyof typeof markets].mint),
      new PublicKey(merchant),
      false,
      TOKEN_2022_PROGRAM_ID
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        new PublicKey(customer),
        merchantIbAta,
        new PublicKey(merchant),
        new PublicKey(markets[params.ibToken as keyof typeof markets].mint),
        TOKEN_2022_PROGRAM_ID
      )
    );

    // transfer amount ibToken from customer to merchant
    const transferIbIxs = createTransferCheckedInstruction(
      customerIbAta,
      new PublicKey(markets[params.ibToken as keyof typeof markets].mint),
      merchantIbAta,
      new PublicKey(customer),
      Math.floor(amountNumber / basePerIbCurr),
      markets[params.ibToken as keyof typeof markets].decimals,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    ixs.push(transferIbIxs);

    const conn = createConnection();

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000, // or any other value up to 1,400,000
    });

    const blockhash = (await conn.getLatestBlockhash()).blockhash;
    const messageV0 = new TransactionMessage({
      payerKey: new PublicKey(customer),
      recentBlockhash: blockhash,
      instructions: [modifyComputeUnits, ...ixs],
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([ytMintKp]);

    const response = {
      transaction: Buffer.from(transaction.serialize()).toString("base64"),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching action:", error);
    const message = "Failed to fetch action";
    return new Response(message, {
      status: 500,
    });
  }
}
