import type { Metadata } from "next";
import "@/styles/globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MANDATE",
  description: "AI-native strategy game — control room interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-night-sky text-text-primary font-dashboard antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
