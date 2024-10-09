"use client";

import Link from "next/link";
import Logo from "./logo-words";
import MobileMenu from "./mobile-menu";
import { UnifiedWalletButton } from "@jup-ag/wallet-adapter";

export default function Header() {
  return (
    <header className="z-30 mt-2 w-full md:mt-5">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative flex h-14 items-center justify-between gap-3 rounded-2xl bg-[#0c111d]/90 px-3 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(to_right,theme(colors.gray.800),theme(colors.gray.700),theme(colors.gray.800))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)] after:absolute after:inset-0 after:-z-10 after:backdrop-blur-sm">
          {/* Site branding */}
          <div className="flex flex-1 items-center">
            <Logo />
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex md:grow">
            {/* Desktop menu links */}
            <ul className="flex grow flex-wrap items-center justify-center gap-4 text-sm lg:gap-8">
              <li>
                <Link
                  href="/"
                  className="flex items-center px-2 py-1 text-gray-200 transition hover:text-blue-500 lg:px-3"
                >
                  Markets
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="flex items-center px-2 py-1 text-gray-200 transition hover:text-blue-500 lg:px-3"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/splitpay"
                  className="font-ataero font-medium flex items-center px-2 py-1 text-gray-200 transition hover:text-blue-500 lg:px-3"
                >
                  SplitPay API
                </Link>
              </li>
              <li>
                <Link
                  href="/demo"
                  className="font-ataero font-medium flex items-center px-2 py-1 text-gray-200 transition hover:text-blue-500 lg:px-3"
                >
                  SplitPay Demo
                </Link>
              </li>
            </ul>
          </nav>

          {/* Desktop sign in links */}
          <ul className="flex flex-1 items-center justify-end gap-3">
            <li>
              <UnifiedWalletButton
                buttonClassName="btn-sm !bg-gradient-to-t !from-blue-600 !to-blue-500 !bg-[length:100%_100%] !bg-[bottom] !py-[5px] !text-white !shadow-[inset_0px_1px_0px_0px_theme(colors.white/.16)] hover:!bg-[length:100%_150%]"
                currentUserClassName="btn-sm !bg-gradient-to-t !from-blue-600 !to-blue-500 !bg-[length:100%_100%] !bg-[bottom] !py-[5px] !text-white !shadow-[inset_0px_1px_0px_0px_theme(colors.white/.16)] hover:!bg-[length:100%_150%]"
              />
            </li>
          </ul>

          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
