import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "WHB Companies - Command Center",
  description: "WHB Companies Application Suite",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-serif antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
