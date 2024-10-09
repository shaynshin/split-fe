import {
  BN,
  Idl,
  Program,
  AnchorProvider,
  Wallet,
  Provider,
  setProvider,
} from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SplitProgram } from "./types/split_program";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

// Custom wallet adapter that works in both Node.js and browser environments
class CustomWallet implements Wallet {
  constructor(readonly payer: Keypair) {}

  async signTransaction(tx: any) {
    tx.partialSign(this.payer);
    return tx;
  }

  async signAllTransactions(txs: any[]) {
    return txs.map((t) => {
      t.partialSign(this.payer);
      return t;
    });
  }

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
}

class AccountUtils {
  conn: Connection;

  constructor(conn: Connection) {
    this.conn = conn;
  }

  // --------------------------------------- PDA

  async findProgramAddress(
    programId: PublicKey,
    seeds: (PublicKey | Uint8Array | string)[]
  ): Promise<[PublicKey, number]> {
    const seed_bytes = seeds.map((s) => {
      if (typeof s == "string") {
        return Buffer.from(s);
      } else if ("toBytes" in s) {
        return s.toBytes();
      } else {
        return s;
      }
    });
    return await PublicKey.findProgramAddress(seed_bytes, programId);
  }

  // --------------------------------------- Normal account

  async getBalance(publicKey: PublicKey): Promise<number> {
    return this.conn.getBalance(publicKey);
  }
}

export class SplitClient extends AccountUtils {
  // @ts-ignore
  provider!: Provider;
  splitProgram!: Program<SplitProgram>;
  admin: PublicKey;

  constructor(conn: Connection, idl?: Idl, programId?: PublicKey) {
    super(conn);
    this.admin = new PublicKey("Bh6rQ5d6iCRrH9CzBRPUgoWnVtrmADGkPrbAveUiywpu");
    this.setProvider();
    this.setSplitProgram(idl, programId);
  }

  setProvider() {
    /// we are creating instructions with this client without signing
    const leakedKp = Keypair.fromSecretKey(
      Uint8Array.from([
        208, 175, 150, 242, 88, 34, 108, 88, 177, 16, 168, 75, 115, 181, 199,
        242, 120, 4, 78, 75, 19, 227, 13, 215, 184, 108, 226, 53, 111, 149, 179,
        84, 137, 121, 79, 1, 160, 223, 124, 241, 202, 203, 220, 237, 50, 242,
        57, 158, 226, 207, 203, 188, 43, 28, 70, 110, 214, 234, 251, 15, 249,
        157, 62, 80,
      ])
    );
    this.provider = new AnchorProvider(
      this.conn,
      new CustomWallet(leakedKp),
      AnchorProvider.defaultOptions()
    );
    setProvider(this.provider);
  }

  setSplitProgram(idl?: Idl, programId?: PublicKey) {
    //instantiating program depends on the environment
    if (idl && programId) {
      this.splitProgram = new Program<SplitProgram>(idl as any, this.provider);
    } else {
      //means running inside test suite
      const anchor = require("@coral-xyz/anchor");
      this.splitProgram = anchor.workspace
        .SplitProgram as Program<SplitProgram>;
    }
  }

  // --------------------------------------- fetch deserialized accounts

  async fetchMarketAcc(marketPda: PublicKey) {
    return this.splitProgram.account.market.fetch(marketPda);
  }

  async fetchYtPositionAcc(tokenYtMint: PublicKey) {
    const [ytPosition] = this.findYtPositionPda(tokenYtMint);
    return this.splitProgram.account.ytPosition.fetch(ytPosition);
  }

  async fetchAMMAcc(ammPda: PublicKey) {
    return this.splitProgram.account.amm.fetch(ammPda);
  }

  // --------------------------------------- find PDA addresses
  findMarketPDA(
    tokenIbMint: PublicKey,
    startUnixTS: BN,
    endUnixTS: BN
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        tokenIbMint.toBytes(),
        startUnixTS.toArrayLike(Buffer, "le", 8),
        endUnixTS.toArrayLike(Buffer, "le", 8),
      ],
      this.splitProgram.programId
    );
  }

  findYtPositionPda(tokenYtMint: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("yt_position"), tokenYtMint.toBytes()],
      this.splitProgram.programId
    );
  }

  findPtMint(marketPda: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pt"), marketPda.toBytes()],
      this.splitProgram.programId
    );
  }

  findAuthority(marketPda: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), marketPda.toBytes()],
      this.splitProgram.programId
    );
  }

  findAMM(marketPda: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("amm"), marketPda.toBytes()],
      this.splitProgram.programId
    );
  }

  findAMMAuthority(amm: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), amm.toBytes()],
      this.splitProgram.programId
    );
  }

  findLpMint(amm: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), amm.toBytes()],
      this.splitProgram.programId
    );
  }

  // --------------------------------------- find all PDA addresses

  // --------------------------------------- split ixs

  async initializeMarket(
    {
      startUnixTs,
      endUnixTs,
      rateExpNano,
      rateInitialNano,
      rateMaxNano,
    }: {
      startUnixTs: BN;
      endUnixTs: BN;
      rateInitialNano: BN;
      rateMaxNano: BN;
      rateExpNano: BN;
    },
    {
      payer,
      tokenIbMint,
      tokenIbProgram,
    }: {
      payer: PublicKey;
      tokenIbMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const ixs = [];
    const [market] = this.findMarketPDA(tokenIbMint, startUnixTs, endUnixTs);

    const [auth] = this.findAuthority(market);
    const tokenIbVaultAcc = getAssociatedTokenAddressSync(
      tokenIbMint,
      auth,
      true,
      tokenIbProgram
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        tokenIbVaultAcc,
        auth,
        tokenIbMint,
        tokenIbProgram
      )
    );

    ixs.push(
      await this.splitProgram.methods
        .initializeMarket(
          startUnixTs,
          endUnixTs,
          rateInitialNano,
          rateMaxNano,
          rateExpNano
        )
        .accounts({
          payer,
          market,
          tokenIbMint,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }

  async mintPYT(
    { ibInAmount }: { ibInAmount: BN },
    {
      user,
      market,
      tokenYtMint,
      tokenIbMint,
      tokenIbProgram,
    }: {
      user: PublicKey;
      market: PublicKey;
      tokenYtMint: PublicKey;
      tokenIbMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const ixs = [];

    const [ytMintPosition] = this.findYtPositionPda(tokenYtMint);
    const [ptMint] = this.findPtMint(market);

    const userYtAccount = getAssociatedTokenAddressSync(
      tokenYtMint,
      user,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const userPtAccount = getAssociatedTokenAddressSync(
      ptMint,
      user,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        userPtAccount,
        user,
        ptMint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    ixs.push(
      await this.splitProgram.methods
        .mintPyt(ibInAmount)
        .accounts({
          user,
          market,
          tokenIbMint,
          tokenYtMint,
          tokenYtUserAccount: userYtAccount,
          ytMintPosition,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }

  async redeemPYT(
    { ptYtInAmount }: { ptYtInAmount: BN },
    {
      user,
      market,
      tokenYtMint,
      tokenIbMint,
      tokenIbProgram,
    }: {
      user: PublicKey;
      market: PublicKey;
      tokenYtMint: PublicKey;
      tokenIbMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const ixs = [];

    const [ytMintPosition] = this.findYtPositionPda(tokenYtMint);

    const userIbAccount = getAssociatedTokenAddressSync(
      tokenIbMint,
      user,
      false,
      tokenIbProgram
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        userIbAccount,
        user,
        tokenIbMint,
        tokenIbProgram
      )
    );

    ixs.push(
      await this.splitProgram.methods
        .redeemPyt(ptYtInAmount)
        .accounts({
          user,
          market,
          tokenIbMint,
          tokenYtMint,
          ytMintPosition,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }

  async claimYT(
    { ytInAmount }: { ytInAmount: BN },
    {
      user,
      market,
      tokenYtPreMint,
      tokenYtPostMint,
      tokenIbMint,
      tokenIbProgram,
    }: {
      user: PublicKey;
      market: PublicKey;
      tokenYtPreMint: PublicKey;
      tokenYtPostMint: PublicKey;
      tokenIbMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const ixs = [];

    const [ytPreMintPosition] = this.findYtPositionPda(tokenYtPreMint);
    const [ytPostMintPosition] = this.findYtPositionPda(tokenYtPostMint);

    const userYtPostAccount = getAssociatedTokenAddressSync(
      tokenYtPostMint,
      user,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const userIbAccount = getAssociatedTokenAddressSync(
      tokenIbMint,
      user,
      false,
      tokenIbProgram
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        userIbAccount,
        user,
        tokenIbMint,
        tokenIbProgram
      )
    );

    ixs.push(
      await this.splitProgram.methods
        .claimYt(ytInAmount)
        .accounts({
          user,
          market,
          tokenIbMint,
          tokenYtPostMint,
          tokenYtPreMint,
          tokenYtPostUserAccount: userYtPostAccount,
          ytPostMintPosition,
          ytPreMintPosition,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }

  async claimPT(
    { ptInAmount }: { ptInAmount: BN },
    {
      user,
      tokenIbMint,
      market,
      tokenIbProgram,
    }: {
      user: PublicKey;
      market: PublicKey;
      tokenIbMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const ixs = [];
    const userIbAccount = getAssociatedTokenAddressSync(
      tokenIbMint,
      user,
      false,
      tokenIbProgram
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        userIbAccount,
        user,
        tokenIbMint,
        tokenIbProgram
      )
    );

    ixs.push(
      await this.splitProgram.methods
        .claimPt(ptInAmount)
        .accounts({
          user,
          market,
          tokenIbMint,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }

  async bootstrapLiquidity(
    { dIb, dPt }: { dIb: BN; dPt: BN },
    {
      user,
      market,
      tokenIbMint,
      tokenIbProgram,
    }: {
      user: PublicKey;
      market: PublicKey;
      tokenIbMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const ixs = [];

    const [amm] = this.findAMM(market);
    const [lpMint] = this.findLpMint(amm);
    const [ammAuthority] = this.findAMMAuthority(amm);
    const [ptMint] = this.findPtMint(market);

    const lpUserAccount = getAssociatedTokenAddressSync(
      lpMint,
      user,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const ibAmmAccount = getAssociatedTokenAddressSync(
      tokenIbMint,
      ammAuthority,
      true,
      tokenIbProgram
    );

    const ptAmmAccount = getAssociatedTokenAddressSync(
      ptMint,
      ammAuthority,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    ixs.push(
      await this.splitProgram.methods
        .bootstrapLiquidity(dIb, dPt)
        .accounts({
          user,
          market,
          ibMint: tokenIbMint,
          ibAmmAccount,
          lpUserAccount,
          ptAmmAccount,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }

  async addLiquidity(
    { lpTokenAmount }: { lpTokenAmount: BN },
    {
      user,
      market,
      tokenIbMint,
      tokenIbProgram,
    }: {
      user: PublicKey;
      market: PublicKey;
      tokenIbMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const ixs = [];

    const [amm] = this.findAMM(market);
    const [lpMint] = this.findLpMint(amm);

    const lpUserAccount = getAssociatedTokenAddressSync(
      lpMint,
      user,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        lpUserAccount,
        user,
        lpMint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    ixs.push(
      await this.splitProgram.methods
        .addLiquidity(lpTokenAmount)
        .accounts({
          user,
          market,
          ibMint: tokenIbMint,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }

  async removeLiquidity(
    { lpTokenAmount }: { lpTokenAmount: BN },
    {
      user,
      market,
      tokenIbMint,
      tokenIbProgram,
    }: {
      user: PublicKey;
      market: PublicKey;
      tokenIbMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const ixs = [];
    const [ptMint] = this.findPtMint(market);

    const userPtAccount = getAssociatedTokenAddressSync(
      ptMint,
      user,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        userPtAccount,
        user,
        ptMint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    const userIbAccount = getAssociatedTokenAddressSync(
      tokenIbMint,
      user,
      false,
      tokenIbProgram
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        userIbAccount,
        user,
        tokenIbMint,
        tokenIbProgram
      )
    );

    ixs.push(
      await this.splitProgram.methods
        .removeLiquidity(lpTokenAmount)
        .accounts({
          user,
          market,
          ibMint: tokenIbMint,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }

  async swap(
    { deltaPt, ptToIb }: { deltaPt: BN; ptToIb: boolean },
    {
      user,
      market,
      tokenIbMint,
      tokenIbProgram,
    }: {
      user: PublicKey;
      market: PublicKey;
      tokenIbMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const ixs = [];

    if (ptToIb) {
      const userIbAccount = getAssociatedTokenAddressSync(
        tokenIbMint,
        user,
        false,
        tokenIbProgram
      );

      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          user,
          userIbAccount,
          user,
          tokenIbMint,
          tokenIbProgram
        )
      );
    } else {
      const [ptMint] = this.findPtMint(market);

      const userPtAccount = getAssociatedTokenAddressSync(
        ptMint,
        user,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          user,
          userPtAccount,
          user,
          ptMint,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    ixs.push(
      await this.splitProgram.methods
        .swap(deltaPt, ptToIb)
        .accounts({
          user,
          market,
          ibMint: tokenIbMint,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }

  async swapYt(
    { deltaPt }: { deltaPt: BN },
    {
      user,
      market,
      tokenIbMint,
      ytMint,
      tokenIbProgram,
    }: {
      user: PublicKey;
      market: PublicKey;
      tokenIbMint: PublicKey;
      ytMint: PublicKey;
      tokenIbProgram: PublicKey;
    }
  ) {
    const [ytMintPosition] = this.findYtPositionPda(ytMint);
    const ixs = [];

    const userIbAccount = getAssociatedTokenAddressSync(
      tokenIbMint,
      user,
      false,
      tokenIbProgram
    );

    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        userIbAccount,
        user,
        tokenIbMint,
        tokenIbProgram
      )
    );

    ixs.push(
      await this.splitProgram.methods
        .swapYt(deltaPt)
        .accounts({
          user,
          market,
          ibMint: tokenIbMint,
          ytMint,
          ytMintPosition,
          tokenIbProgram,
        })
        .instruction()
    );

    return ixs;
  }
}
