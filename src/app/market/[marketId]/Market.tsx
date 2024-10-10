"use client";

import { useEffect, useState } from "react";
import {
  Menu,
  MenuButton,
  Transition,
  Tab,
  TabList,
  TabGroup,
} from "@headlessui/react";
import Image from "next/image";
import { useWallet } from "@jup-ag/wallet-adapter";
import { UnifiedWalletButton } from "@jup-ag/wallet-adapter";
import { BN } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionConfirmationStrategy,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  calculateAmountIbToPt,
  calculateAmountPtToIb,
  getBasePerIbCurr,
} from "@/lib/Calculation";
import * as smIdl from "@/client/idl/split_program.json";
import { SPLIT_PROGRAM_ID } from "@/lib/Constants";
import { SplitClient } from "@/client/split.client";
import { createConnection } from "@/lib/Connection";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { toast } from "react-toastify";

// Constants
const PRECISION = 1e9;
const SECONDS_PER_YEAR = 31_536_000;

// Interfaces
interface MarketAccount {
  nPtCirculate: string;
  nIbVault: string;
  startUnixTs: string;
  endUnixTs: string;
  basePerIbNanoFinal: string;
  ibMint: string;
  basePerIbNanoLast: string;
}

interface AmmAccount {
  market: PublicKey;
  nIb: string;
  nPt: string;
  nAsset: string;
  lpSupply: string;
  scalarRootNano: string;
  rateAnchorNano: string;
  feeRateRootNano: string;
  lastImpliedRateNano: string;
  lastUpdateTs: string;
}

// Market Data
const market = {
  EvhH5tnknbgikGsqRMLMCXNPEnsKs8P3mWxpt65eG6fK: {
    name: "JitoSOL",
    fullName: "Jito Staked SOL",
    decimals: 9,
    icon: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png",
    mint: "9g3Zn7Qkwx4duF4L9tVQjXB1MnoMpnyrHRgY11da7ETB",
    amm: "8EkrjaAsV3j1AMG377U2prFKoMpaCT4LYb91HXW7ZicN",
  },
  "8E8g93aDN1qD1XB4HoLQnJQAGmr45pnHrTUVkDG2aiRM": {
    name: "CRT",
    fullName: "Carrot",
    decimals: 9,
    icon: "https://shdw-drive.genesysgo.net/7G7ayDnjFoLcEUVkxQ2Jd4qquAHp5LiSBii7t81Y2E23/carrot.png",
    mint: "fAM1Fwf2ZutMTPRvXYnJLpWkb3FRoP7uQWyNCX2Uvfk",
    amm: "99jZTemhuEczbWXsqzsBKDEPcAuhjCoXtxgG2hH5CJk",
  },
};
// React Component
export default function MarketClientPage({
  params,
  marketAcc,
  ammAcc,
}: {
  params: { marketId: string };
  marketAcc: MarketAccount;
  ammAcc: AmmAccount;
}) {
  const wallet = useWallet();

  const [isButtonLoading, setIsButtonLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"PT" | "YT" | "LP">("PT");
  const [selectedTab, setSelectedTab] = useState<"swap" | "mintRedeem">("swap");
  const [idxPay, setIdxPay] = useState<number>(0);
  const [idxReceive, setIdxReceive] = useState<number>(1);
  const [inputAmount, setInputAmount] = useState("");
  const [inputAmount2, setInputAmount2] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [outputAmount2, setOutputAmount2] = useState("");
  const [allowedTokens, setAllowedTokens] = useState([
    {
      name: market[params.marketId as keyof typeof market].fullName,
      symbol: market[params.marketId as keyof typeof market].name,
      mint: market[params.marketId as keyof typeof market].mint,
      decimals: market[params.marketId as keyof typeof market].decimals,
      logoURI: market[params.marketId as keyof typeof market].icon,
    },
    {
      name: `${selectedMode}-${
        market[params.marketId as keyof typeof market].fullName
      }`,
      symbol: `${selectedMode}-${
        market[params.marketId as keyof typeof market].name
      }`,
      mint: market[params.marketId as keyof typeof market].mint,
      decimals: market[params.marketId as keyof typeof market].decimals,
      logoURI: market[params.marketId as keyof typeof market].icon,
    },
  ]);

  // State variable to track the last input changed
  const [lastInputChanged, setLastInputChanged] = useState<
    "input1" | "input2" | null
  >(null);

  const handleSwitchClick = () => {
    setIdxPay(idxReceive);
    setIdxReceive(idxPay);
  };

  useEffect(() => {
    if (selectedMode === "LP") {
      setAllowedTokens([
        {
          name: `${selectedMode}-${
            market[params.marketId as keyof typeof market].fullName
          }`,
          symbol: `${selectedMode}-${
            market[params.marketId as keyof typeof market].name
          }`,
          mint: market[params.marketId as keyof typeof market].mint,
          decimals: market[params.marketId as keyof typeof market].decimals,
          logoURI: market[params.marketId as keyof typeof market].icon,
        },
        {
          name: `PT-${market[params.marketId as keyof typeof market].fullName}`,
          symbol: `PT-${market[params.marketId as keyof typeof market].name}`,
          mint: market[params.marketId as keyof typeof market].mint,
          decimals: market[params.marketId as keyof typeof market].decimals,
          logoURI: market[params.marketId as keyof typeof market].icon,
        },
        {
          name: `${market[params.marketId as keyof typeof market].fullName}`,
          symbol: `${market[params.marketId as keyof typeof market].name}`,
          mint: market[params.marketId as keyof typeof market].mint,
          decimals: market[params.marketId as keyof typeof market].decimals,
          logoURI: market[params.marketId as keyof typeof market].icon,
        },
      ]);
    } else if (selectedTab === "mintRedeem") {
      setAllowedTokens([
        {
          name: market[params.marketId as keyof typeof market].fullName,
          symbol: market[params.marketId as keyof typeof market].name,
          mint: market[params.marketId as keyof typeof market].mint,
          decimals: market[params.marketId as keyof typeof market].decimals,
          logoURI: market[params.marketId as keyof typeof market].icon,
        },
        {
          name: `PT-${market[params.marketId as keyof typeof market].fullName}`,
          symbol: `PT-${market[params.marketId as keyof typeof market].name}`,
          mint: market[params.marketId as keyof typeof market].mint,
          decimals: market[params.marketId as keyof typeof market].decimals,
          logoURI: market[params.marketId as keyof typeof market].icon,
        },
        {
          name: `YT-${market[params.marketId as keyof typeof market].fullName}`,
          symbol: `YT-${market[params.marketId as keyof typeof market].name}`,
          mint: market[params.marketId as keyof typeof market].mint,
          decimals: market[params.marketId as keyof typeof market].decimals,
          logoURI: market[params.marketId as keyof typeof market].icon,
        },
      ]);
    } else {
      setAllowedTokens([
        {
          name: market[params.marketId as keyof typeof market].fullName,
          symbol: market[params.marketId as keyof typeof market].name,
          mint: market[params.marketId as keyof typeof market].mint,
          decimals: market[params.marketId as keyof typeof market].decimals,
          logoURI: market[params.marketId as keyof typeof market].icon,
        },
        {
          name: `${selectedMode}-${
            market[params.marketId as keyof typeof market].fullName
          }`,
          symbol: `${selectedMode}-${
            market[params.marketId as keyof typeof market].name
          }`,
          mint: market[params.marketId as keyof typeof market].mint,
          decimals: market[params.marketId as keyof typeof market].decimals,
          logoURI: market[params.marketId as keyof typeof market].icon,
        },
      ]);
    }
  }, [selectedMode, selectedTab, params.marketId]);

  // useEffect for inputAmount changes (input1)
  useEffect(() => {
    if (lastInputChanged === "input1") {
      if (selectedMode === "LP" && idxPay === 0 && inputAmount) {
        // User is redeeming LP tokens to get PT and IB
        const nPt = new BN(ammAcc.nPt, 16).toNumber();
        const nIb = new BN(ammAcc.nIb, 16).toNumber();
        const lpSupply = new BN(ammAcc.lpSupply, 16).toNumber();

        const ratio = +inputAmount / lpSupply;
        setOutputAmount((ratio * nPt).toString());
        setOutputAmount2((ratio * nIb).toString());
      } else if (selectedMode === "LP" && idxPay !== 0 && inputAmount) {
        // User is providing PT and IB to get LP tokens (inputAmount is PT)
        const nPt = new BN(ammAcc.nPt, 16).toNumber();
        const nIb = new BN(ammAcc.nIb, 16).toNumber();
        const lpSupply = new BN(ammAcc.lpSupply, 16).toNumber();

        const ratio = +inputAmount / nPt;
        setInputAmount2((ratio * nIb).toString());
        setOutputAmount((ratio * lpSupply).toString());
      } else if (selectedMode !== "LP" && +inputAmount) {
        // Handle other modes (Swap and Mint/Redeem)
        const currentTime = Date.now() / 1000;
        const marketData = market[params.marketId as keyof typeof market];
        const decimals = marketData.decimals;
        const inputAmountInBaseUnits = +inputAmount * 10 ** decimals;

        let output = 0;

        if (selectedTab === "swap") {
          if (idxPay === 0) {
            // Swap from IB to PT
            output =
              calculateAmountIbToPt(
                currentTime,
                new BN(marketAcc.endUnixTs, 16).toNumber(),
                new BN(ammAcc.nPt, 16).toNumber(),
                new BN(ammAcc.nAsset, 16).toNumber(),
                new BN(ammAcc.scalarRootNano, 16),
                new BN(ammAcc.lastImpliedRateNano, 16).toNumber(),
                inputAmountInBaseUnits
              ) /
              10 ** decimals;
          } else {
            // Swap from PT to IB
            output =
              calculateAmountPtToIb(
                currentTime,
                new BN(marketAcc.endUnixTs, 16).toNumber(),
                new BN(ammAcc.nPt, 16).toNumber(),
                new BN(ammAcc.nAsset, 16).toNumber(),
                new BN(ammAcc.scalarRootNano, 16),
                new BN(ammAcc.lastImpliedRateNano, 16).toNumber(),
                inputAmountInBaseUnits
              ) /
              10 ** decimals;
          }
          setOutputAmount(output.toString());
          setOutputAmount2(output.toString());
        } else {
          const basePerIbCurrNano = getBasePerIbCurr(
            currentTime,
            new BN(marketAcc.startUnixTs, 16).toNumber()
          );
          if (idxPay === 0) {
            // Mint PT + YT from IB
            output = +inputAmount * basePerIbCurrNano;
          } else {
            // Redeem IB from PT + YT
            output = +inputAmount / basePerIbCurrNano;
          }
          setOutputAmount(output.toString());
          setOutputAmount2(output.toString());
        }
      } else {
        setOutputAmount("");
        setOutputAmount2("");
        setInputAmount2("");
      }
    }
  }, [
    inputAmount,
    lastInputChanged,
    selectedMode,
    selectedTab,
    idxPay,
    params.marketId,
    ammAcc,
    marketAcc,
  ]);

  // useEffect for inputAmount2 changes (input2)
  useEffect(() => {
    if (lastInputChanged === "input2") {
      if (selectedMode === "LP" && idxPay !== 0 && inputAmount2) {
        // User is providing PT and IB to get LP tokens (inputAmount2 is IB)
        const nPt = new BN(ammAcc.nPt, 16).toNumber();
        const nIb = new BN(ammAcc.nIb, 16).toNumber();
        const lpSupply = new BN(ammAcc.lpSupply, 16).toNumber();

        const ratio = +inputAmount2 / nIb;
        setInputAmount((ratio * nPt).toString());
        setOutputAmount((ratio * lpSupply).toString());
      } else {
        setOutputAmount("");
        setOutputAmount2("");
        setInputAmount("");
      }
    }
  }, [inputAmount2, lastInputChanged, selectedMode, idxPay, ammAcc]);

  const handleButtonClick = async () => {
    if (!wallet || !wallet.connected || !wallet.publicKey) {
      console.error("Wallet not connected");
      return;
    }
    setIsButtonLoading(true);
    try {
      const conn = createConnection();

      const smc = new SplitClient(
        conn,
        smIdl as any,
        new PublicKey(SPLIT_PROGRAM_ID)
      );

      const user = wallet.publicKey;

      // Get market data
      const marketData = market[params.marketId as keyof typeof market];
      const marketPk = new PublicKey(params.marketId);
      const tokenIbMint = new PublicKey(marketData.mint);
      const tokenIbProgram = TOKEN_2022_PROGRAM_ID; // Replace with the correct program ID if different

      const decimals = marketData.decimals;
      const inputAmountBN = new BN(Number(inputAmount) * 10 ** decimals);

      const ixs = [];
      const signers = [];
      let msg = "";

      // Determine the case based on user selections
      if (selectedMode === "PT") {
        if (selectedTab === "swap") {
          msg = "swapped";
          if (allowedTokens[idxPay].symbol.startsWith("PT-")) {
            // Case 1: Purchase PT -> IB (Swap PT for IB)
            const deltaPt = inputAmountBN;
            ixs.push(
              ...(await smc.swap(
                { deltaPt, ptToIb: true },
                {
                  user,
                  market: marketPk,
                  tokenIbMint,
                  tokenIbProgram,
                }
              ))
            );
          } else {
            // Case 2: Purchase IB -> PT (Swap IB for PT)
            const deltaPt = new BN(
              Number(outputAmount) * 10 ** allowedTokens[idxReceive].decimals
            );
            ixs.push(
              ...(await smc.swap(
                { deltaPt, ptToIb: false },
                {
                  user,
                  market: marketPk,
                  tokenIbMint,
                  tokenIbProgram,
                }
              ))
            );
          }
        } else if (selectedTab === "mintRedeem") {
          const tokenYtMintKp = Keypair.generate();

          if (allowedTokens[idxPay].symbol === marketData.name) {
            msg = "minted PT + YT";
            // Case 3: Mint PT + YT from IB
            const ibInAmount = inputAmountBN;
            signers.push(tokenYtMintKp);
            ixs.push(
              ...(await smc.mintPYT(
                { ibInAmount },
                {
                  user,
                  market: marketPk,
                  tokenYtMint: tokenYtMintKp.publicKey,
                  tokenIbMint,
                  tokenIbProgram,
                }
              ))
            );
          } else {
            // Case 4: Redeem IB from PT + YT
            msg = "redeemed";
            const ptYtInAmount = inputAmountBN;
            ixs.push(
              ...(await smc.redeemPYT(
                { ptYtInAmount },
                {
                  user,
                  market: marketPk,
                  tokenYtMint: tokenYtMintKp.publicKey,
                  tokenIbMint,
                  tokenIbProgram,
                }
              ))
            );
          }
        }
      } else if (selectedMode === "LP") {
        if (allowedTokens[idxPay].symbol.startsWith("LP-")) {
          // Case 6: Withdraw LP -> PT + IB
          msg = "withdrew LP";
          const lpTokenAmount = inputAmountBN;
          ixs.push(
            ...(await smc.removeLiquidity(
              { lpTokenAmount },
              {
                user,
                market: marketPk,
                tokenIbMint,
                tokenIbProgram,
              }
            ))
          );
        } else {
          // Case 5: Provide PT + IB -> LP
          msg = "provided LP";
          const lpTokenAmount = new BN(
            Number(outputAmount) * 10 ** allowedTokens[idxReceive].decimals
          );
          ixs.push(
            ...(await smc.addLiquidity(
              { lpTokenAmount },
              {
                user,
                market: marketPk,
                tokenIbMint,
                tokenIbProgram,
              }
            ))
          );
        }
      }

      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400000, // or any other value up to 1,400,000
      });

      const blockhash = (await conn.getLatestBlockhash()).blockhash;
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: [modifyComputeUnits, ...ixs],
      }).compileToV0Message();
      const transaction = new VersionedTransaction(messageV0);
      transaction.sign(signers);
      const txSig = await wallet.sendTransaction(transaction, conn);
      const { lastValidBlockHeight, lastBlockhash } = await conn
        .getLatestBlockhash()
        .then((res) => ({
          lastValidBlockHeight: res.lastValidBlockHeight,
          lastBlockhash: res.blockhash,
        }));

      const strategy: TransactionConfirmationStrategy = {
        signature: txSig,
        lastValidBlockHeight,
        blockhash: lastBlockhash,
      };
      await conn.confirmTransaction(strategy, "confirmed");
      toast.success(`Successfully ${msg}!`);
    } catch (error) {
      console.error("Error:", error);
      toast.error(`Error: ${error} !`);
    } finally {
      setIsButtonLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-15.5rem)]">
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-0 mb-36">
        {/* Mode Selection */}
        <div className="bg-gray-900 rounded-xl p-2 shadow-lg w-full max-w-md mb-4">
          <div className="grid grid-cols-3 gap-2">
            {["PT", "YT", "LP"].map((mode) => (
              <button
                key={mode}
                className={`
                  font-bold py-2 px-4 rounded-lg focus:outline-none
                  ${
                    selectedMode === mode
                      ? mode === "PT"
                        ? "bg-blue-500 text-white"
                        : mode === "YT"
                        ? "bg-cyan-500 text-white"
                        : "bg-indigo-500 text-white"
                      : mode === "PT"
                      ? "bg-blue-500/30 text-blue-500"
                      : mode === "YT"
                      ? "bg-cyan-500/30 text-cyan-500"
                      : "bg-indigo-500/30 text-indigo-500"
                  }
                `}
                onClick={() => setSelectedMode(mode as "PT" | "YT" | "LP")}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Swap/Mint-Redeem Tab */}
        <div className="bg-gray-900 rounded-2xl p-4 shadow-lg w-full max-w-md mb-4">
          <TabGroup
            onChange={(index) =>
              setSelectedTab(index === 0 ? "swap" : "mintRedeem")
            }
          >
            <TabList className="flex rounded-full bg-blue-700/20 p-1 font-bold">
              {selectedMode !== "LP" ? (
                <>
                  <Tab
                    className={({ selected }) =>
                      `w-full rounded-full py-2 text-sm leading-5 transition-all ${
                        selected
                          ? "text-blue-800 bg-white shadow"
                          : "text-blue-100 hover:bg-white/[0.12] hover:text-white"
                      }`
                    }
                  >
                    Swap
                  </Tab>
                  <Tab
                    className={({ selected }) =>
                      `w-full rounded-full py-2 text-sm leading-5 transition-all ${
                        selected
                          ? "text-blue-800 bg-white shadow"
                          : "text-blue-100 hover:bg-white/[0.12] hover:text-white"
                      }`
                    }
                  >
                    Mint/Redeem
                  </Tab>
                </>
              ) : (
                <Tab
                  className={`w-full rounded-full py-2 text-sm leading-5 transition-all text-blue-800 bg-white shadow`}
                >
                  Provide / Withdraw Liquidity
                </Tab>
              )}
            </TabList>
          </TabGroup>

          {/* Input/Output Sections */}
          <div className="flex-col relative">
            {/* From Section */}
            <div className="flex justify-between my-2">
              <label
                htmlFor="fromValue"
                className="text-xs sm:text-sm font-medium"
              >
                User will be paying
              </label>
            </div>
            <DropdownFull
              selectedIdx={idxPay}
              opposingIdx={idxReceive}
              allowedTokens={allowedTokens}
              setSelectedIdx={setIdxPay}
              handleSwitchClick={handleSwitchClick}
              amount={inputAmount}
              setAmount={(value) => {
                setInputAmount(value);
                setLastInputChanged("input1");
              }}
              isInput={true}
            />
            {allowedTokens.length === 3 && idxPay === 1 && (
              <div className="flex justify-center py-2 text-gray-300 text-lg">
                +
              </div>
            )}
            {allowedTokens.length === 3 && idxPay === 1 && (
              <DropdownFull
                selectedIdx={2}
                opposingIdx={idxPay}
                allowedTokens={allowedTokens}
                setSelectedIdx={setIdxReceive}
                handleSwitchClick={handleSwitchClick}
                amount={selectedMode === "LP" ? inputAmount2 : inputAmount}
                setAmount={(value) => {
                  if (selectedMode === "LP") {
                    setInputAmount2(value);
                    setLastInputChanged("input2");
                  } else {
                    setInputAmount(value);
                    setLastInputChanged("input1");
                  }
                }}
                isInput={true}
              />
            )}

            {/* Swap Button */}
            <div className="relative flex justify-center my-2">
              <hr className="absolute w-full border-gray-800/50 top-1/2 transform -translate-y-1/2" />
              <button
                type="button"
                className="group bg-gray-800 w-8 h-8 rounded-full cursor-pointer flex items-center justify-center border-[3px] border-[rgba(25,35,45,0.75)] text-white hover:border-gray-700 hover:shadow-lg"
                onClick={handleSwitchClick}
              >
                <svg
                  width="21"
                  height="22"
                  viewBox="0 0 21 22"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.51043 7.47998V14.99H7.77043V7.47998L9.66043 9.36998L10.5505 8.47994L7.5859 5.51453C7.3398 5.26925 6.94114 5.26925 6.69504 5.51453L3.73047 8.47994L4.62051 9.36998L6.51043 7.47998Z"
                    fill="currentColor"
                  ></path>
                  <path
                    d="M14.4902 14.52V7.01001H13.2302V14.52L11.3402 12.63L10.4502 13.5201L13.4148 16.4855C13.6609 16.7308 14.0595 16.7308 14.3056 16.4855L17.2702 13.5201L16.3802 12.63L14.4902 14.52Z"
                    fill="currentColor"
                  ></path>
                </svg>
              </button>
            </div>

            {/* To Section */}
            <div className="flex justify-between my-2">
              <label className="text-xs sm:text-sm font-medium">
                To receive
              </label>
            </div>
            <DropdownFull
              selectedIdx={idxReceive}
              opposingIdx={idxPay}
              allowedTokens={allowedTokens}
              setSelectedIdx={setIdxReceive}
              handleSwitchClick={handleSwitchClick}
              amount={outputAmount}
              setAmount={() => {}}
              isInput={false}
            />
            {allowedTokens.length === 3 && idxReceive === 1 && (
              <div className="flex justify-center py-2 text-gray-300 text-lg">
                +
              </div>
            )}
            {allowedTokens.length === 3 && idxReceive === 1 && (
              <DropdownFull
                selectedIdx={2}
                opposingIdx={idxPay}
                allowedTokens={allowedTokens}
                setSelectedIdx={setIdxReceive}
                handleSwitchClick={handleSwitchClick}
                amount={outputAmount2}
                setAmount={() => {}}
                isInput={false}
              />
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="w-full max-w-md">
          {wallet && wallet.connected ? (
            !isButtonLoading ? (
              <button
                onClick={() => handleButtonClick()}
                className="btn w-full bg-gradient-to-t from-blue-600 to-blue-500 text-white shadow-inner hover:bg-gradient-to-b"
              >
                {selectedMode === "LP"
                  ? "Provide / Withdraw Liquidity"
                  : selectedTab === "mintRedeem"
                  ? "Mint / Redeem"
                  : "Swap"}
              </button>
            ) : (
              <button
                type="button"
                className="btn w-full bg-gradient-to-t from-blue-600 to-blue-500 text-white shadow-inner hover:bg-gradient-to-b"
                disabled
              >
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </button>
            )
          ) : (
            <UnifiedWalletButton
              buttonClassName="btn !w-full !bg-gradient-to-t !from-blue-600 !to-blue-500 !bg-[length:100%_100%] !bg-[bottom] !text-white !shadow-[inset_0px_1px_0px_0px_theme(colors.white/.16)] hover:!bg-[length:100%_150%]"
              currentUserClassName="btn !w-full !bg-gradient-to-t !from-blue-600 !to-blue-500 !bg-[length:100%_100%] !bg-[bottom] !text-white !shadow-[inset_0px_1px_0px_0px_theme(colors.white/.16)] hover:!bg-[length:100%_150%]"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// DropdownFull Component
interface DropdownProps {
  selectedIdx: number;
  opposingIdx: number;
  allowedTokens: any[];
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  handleSwitchClick: () => void;
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  isInput: boolean;
}

const DropdownFull: React.FC<DropdownProps> = ({
  selectedIdx,
  opposingIdx,
  allowedTokens,
  setSelectedIdx,
  handleSwitchClick,
  amount,
  setAmount,
  isInput,
}) => {
  return (
    <div className="flex w-full gap-2">
      <Menu as="div" className="relative inline-flex w-1/2">
        {({ open }) => (
          <>
            <MenuButton
              className="btn w-full !justify-between min-w-[11rem] text-gray-300 bg-gray-800 border-white/15 hover:border-white/30 hover:text-gray-100"
              aria-label="Select option"
              disabled
            >
              <span className="flex items-center">
                {allowedTokens && (
                  <div className="flex items-center gap-4">
                    <Image
                      width={16}
                      height={16}
                      alt="Coin image"
                      src={allowedTokens[selectedIdx].logoURI}
                      className="w-4 h-4 rounded-full"
                    />
                    <span>{allowedTokens[selectedIdx].symbol}</span>
                  </div>
                )}
              </span>
            </MenuButton>
          </>
        )}
      </Menu>
      <span className="flex-1 text-right">
        <div className="flex h-full flex-col text-right">
          <input
            inputMode="decimal"
            autoComplete="off"
            name={isInput ? "fromValue" : "toValue"}
            data-lpignore="true"
            placeholder="0.00"
            className="h-full w-full bg-transparent text-right disabled:cursor-not-allowed disabled:text-black dark:text-white text-xl outline-none font-semibold"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            readOnly={!isInput}
          />
        </div>
      </span>
    </div>
  );
};
