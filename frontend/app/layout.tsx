import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import '@rainbow-me/rainbowkit/styles.css';
import "./globals.css";

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
})

export const metadata: Metadata = {
  title: "0xShadows",
  description: "Anonymous multi-signature wallet powered by PSE's semaphore.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className='dark'>
      <body className={robotoMono.className}>{children}</body>
    </html>
  );
}
