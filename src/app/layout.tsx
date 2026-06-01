import type { Metadata } from "next";
import { Montserrat, Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppContext";
import NavigationWrapper from "@/components/NavigationWrapper";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "White Pigeon Command Hub | Grand RP EN3",
  description: "Advanced management portal and live Discord synchronization network for the elite White Pigeon family.",
  keywords: ["White Pigeon", "Grand RP", "GTA 5 RP", "Command Hub", "Discord Bot", "Gaming Family"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${spaceGrotesk.variable} ${inter.className} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground flex flex-col relative select-none">
        {/* Retro scanlines & Vignette */}
        <div className="scanlines"></div>
        <div className="vignette"></div>

        <AppProvider>
          {/* Navigation and layout wrapper */}
          <NavigationWrapper>
            {children}
          </NavigationWrapper>
        </AppProvider>
      </body>
    </html>
  );
}
