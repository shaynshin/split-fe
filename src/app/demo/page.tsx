"use client";

import { useState, useEffect } from "react";
import {
  TransactionConfirmationStrategy,
  VersionedTransaction,
} from "@solana/web3.js";
import { useWallet } from "@jup-ag/wallet-adapter";
import { createConnection } from "@/lib/Connection";
import { toast } from "react-toastify";

export default function DemoPage() {
  const [amount, setAmount] = useState("");
  const [merchantAddress, setMerchantAddress] = useState("");
  const [requiredIbAmount, setRequiredIbAmount] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [transaction, setTransaction] = useState(null);
  const [endUnixTs, setEndUnixTs] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [ibToken, setIbToken] = useState("SOL");
  const [isMinting, setIsMinting] = useState(false);

  const wallet = useWallet();
  const connection = createConnection();

  useEffect(() => {
    const calculateRequiredIbAmount = async () => {
      if (amount) {
        setIsCalculating(true);
        try {
          const response = await fetch(
            `/api/pay/${ibToken}?amount=${encodeURIComponent(amount)}`
          );
          if (!response.ok) {
            throw new Error("Failed to calculate required iB amount");
          }
          const data = await response.json();
          setRequiredIbAmount(data.lockAmount);
          setEndUnixTs(data.endUnixTS);
        } catch (err) {
          toast.error(`${err}`);
        } finally {
          setIsCalculating(false);
        }
      } else {
        setRequiredIbAmount(null);
      }
    };

    calculateRequiredIbAmount();
  }, [amount, ibToken]);

  const handlePurchase = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error("Wallet not connected");
      return;
    }
    if (!merchantAddress) {
      toast.error("Merchant address is required");
      return;
    }

    if (!wallet.signTransaction) return;

    setIsPurchasing(true);

    try {
      const response = await fetch(
        `/api/pay/${ibToken}?amount=${encodeURIComponent(amount)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            merchant: merchantAddress,
            customer: wallet.publicKey.toString(),
            ytMint: "YourYieldTokenMintAddress", // Replace with actual yield token mint address
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to obtain serialized transaction");
      }

      const data = await response.json();
      setTransaction(data.transaction);

      // Deserialize and send the transaction
      const deserializedTx = VersionedTransaction.deserialize(
        Buffer.from(data.transaction, "base64")
      );

      const signedTransaction = await wallet.sendTransaction(
        deserializedTx,
        connection
      );

      const { lastValidBlockHeight, lastBlockhash } = await connection
        .getLatestBlockhash()
        .then((res) => ({
          lastValidBlockHeight: res.lastValidBlockHeight,
          lastBlockhash: res.blockhash,
        }));

      const strategy: TransactionConfirmationStrategy = {
        signature: signedTransaction,
        lastValidBlockHeight,
        blockhash: lastBlockhash,
      };
      await connection.confirmTransaction(strategy, "processed");

      // Transaction successful
      setTransaction(null);
      toast.success("Transaction successful!");
    } catch (err) {
      console.error(err);
      toast.error(`Transaction failed: ${err}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  // Add this new function inside the component
  const handleMintTestTokens = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error("Wallet not connected");
      return;
    }

    setIsMinting(true);

    try {
      const response = await fetch("/api/faucet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: wallet.publicKey.toString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mint test tokens");
      }

      const data = await response.json();

      // Deserialize and send the transaction
      const deserializedTx = VersionedTransaction.deserialize(
        Buffer.from(data.transaction, "base64")
      );

      const signedTransaction = await wallet.sendTransaction(
        deserializedTx,
        connection
      );

      const { lastValidBlockHeight, lastBlockhash } = await connection
        .getLatestBlockhash()
        .then((res) => ({
          lastValidBlockHeight: res.lastValidBlockHeight,
          lastBlockhash: res.blockhash,
        }));

      const strategy: TransactionConfirmationStrategy = {
        signature: signedTransaction,
        lastValidBlockHeight,
        blockhash: lastBlockhash,
      };
      await connection.confirmTransaction(strategy, "processed");

      toast.success("Test tokens minted successfully!");
    } catch (err) {
      console.error(err);
      toast.error(`Failed to mint test tokens: ${err}`);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-15.5rem)]">
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-0 mb-36">
        <div className="w-full max-w-md space-y-4">
          <h1 className="text-2xl font-semibold text-center">
            Demo Purchase Page
          </h1>
          <button
            onClick={handleMintTestTokens}
            disabled={isMinting || !wallet.publicKey}
            className="w-full mt-4 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isMinting ? "Minting..." : "Mint Test Tokens"}
          </button>
          <div>
            <label className="block text-sm font-medium text-gray-200">
              Select Token
            </label>
            <select
              value={ibToken}
              onChange={(e) => setIbToken(e.target.value)}
              className="text-gray-700 mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="SOL">SOL</option>
              <option value="USDC">USDC</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-200">
              Amount to Pay
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-gray-700 mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              placeholder="Enter amount"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-200">
              Merchant Address
            </label>
            <input
              type="text"
              value={merchantAddress}
              onChange={(e) => setMerchantAddress(e.target.value)}
              className="text-gray-700 mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              placeholder="Enter merchant's Solana address"
            />
          </div>
          {isCalculating ? (
            <p className="text-gray-500">Calculating required iB amount...</p>
          ) : requiredIbAmount !== null ? (
            <p className="text-gray-200">
              Required iB Amount to Lock:{" "}
              <span className="font-semibold">{requiredIbAmount}</span>
            </p>
          ) : null}
          {isCalculating ? (
            <p className="text-gray-500">Calculating lockup period...</p>
          ) : endUnixTs !== null ? (
            <p className="text-gray-200">
              Fully claimable on:{" "}
              <span className="font-semibold">
                {/* TODO: translate endUnixTS to human readable date */}
                {new Date(endUnixTs * 1000).toLocaleString()}
              </span>
            </p>
          ) : null}
          <button
            onClick={handlePurchase}
            disabled={
              isPurchasing || !amount || !merchantAddress || !wallet.publicKey
            }
            className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPurchasing ? "Processing..." : "Purchase"}
          </button>
          {/* You can display transaction details or status here */}
        </div>
      </div>
    </div>
  );
}
