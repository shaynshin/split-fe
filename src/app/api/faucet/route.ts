import { createConnection } from "@/lib/Connection";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { baseToken: string } }
) {
  try {
    const { customer } = await req.json();

    // check merchant and customer are valid solana public keys
    try {
      new PublicKey(customer);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid merchant or customer" },
        { status: 400 }
      );
    }

    const adminSecret = JSON.parse(
      process.env.ADMIN_PRIVATE_KEY || ""
    ) as number[];
    const adminSecretKey = Uint8Array.from(adminSecret);
    const adminKeypair = Keypair.fromSecretKey(adminSecretKey);
    const admin = adminKeypair.publicKey;

    const ibMint = new PublicKey(
      "22E2oN64PYazaKdK54WH1urjGJSTcznwRQqvPcpkiJUL"
    );

    const customerIbAta = getAssociatedTokenAddressSync(
      ibMint,
      new PublicKey(customer),
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const adminIbAta = getAssociatedTokenAddressSync(
      ibMint,
      admin,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const ixs = [];

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        new PublicKey(customer),
        customerIbAta,
        new PublicKey(customer),
        ibMint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // transfer amount ibToken from admin to customer
    const transferIbIxs = createTransferCheckedInstruction(
      adminIbAta,
      ibMint,
      customerIbAta,
      new PublicKey(admin),
      10 * Math.pow(10, 9),
      9,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    ixs.push(transferIbIxs);

    const conn = createConnection();

    const blockhash = (await conn.getLatestBlockhash()).blockhash;
    const messageV0 = new TransactionMessage({
      payerKey: new PublicKey(customer),
      recentBlockhash: blockhash,
      instructions: [...ixs],
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([adminKeypair]);

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
