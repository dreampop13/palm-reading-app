import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "손금 (Palm Reading)",
  description: "TensorFlow.js를 활용한 손금 읽기 애플리케이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <main className="flex min-h-screen flex-col items-center p-2 md:p-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
