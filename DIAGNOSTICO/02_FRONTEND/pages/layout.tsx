import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "USDCOP Trading Dashboard",
  description: "Real-time trading dashboard with ML predictions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${inter.className} antialiased bg-gray-50 dark:bg-gray-900`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
