"use client";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Layout from "../components/layouts";
import { GlobalProvider } from "@/providers/GlobalContext";
import { MetaMaskProvider } from "@/providers/MetaMaskProvider";
import "react-multi-carousel/lib/styles.css";
import { CustomToastContainer } from "@/components/elements/ToastGroup";
import { usePathname } from "next/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MetaMaskProvider>
          <CustomToastContainer />
          <GlobalProvider>
            {isLanding ? children : <Layout>{children}</Layout>}
          </GlobalProvider>
        </MetaMaskProvider>
      </body>
    </html>
  );
}
