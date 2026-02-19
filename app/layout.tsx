import type { Metadata } from "next";
import WalletContextProvider from "@/components/WalletContextProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Airdrop Checker",
  description: "Connect wallet and evaluate likely Solana airdrop eligibility.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
