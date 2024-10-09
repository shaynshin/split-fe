import { Connection } from "@solana/web3.js";

export function createConnection(): Connection {
  return new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
}
