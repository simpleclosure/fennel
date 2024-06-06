import type { Metadata } from "next";
import { Source_Serif_4, Source_Sans_3 } from 'next/font/google'
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz'],
  variable: '--font-serif',
})

const sans = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: "SimpleClosure",
  description: "Coding exercise",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
