import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Connect Four | AI Lab", description: "Play Connect Four and compare minimax with alpha-beta pruning." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
