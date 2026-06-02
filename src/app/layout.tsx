import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppContext";
import NavigationWrapper from "@/components/NavigationWrapper";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${plusJakartaSans.variable} ${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="command-hub min-h-full bg-[#050816] text-foreground flex flex-col relative select-none">
        <AppProvider>
          <NavigationWrapper>
            {children}
          </NavigationWrapper>
        </AppProvider>
      </body>
    </html>
  );
}

