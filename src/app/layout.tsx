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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var apiBaseUrl = "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}";
                var originalFetch = window.fetch;
                window.fetch = function(input, init) {
                  var url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
                  if (url.startsWith(apiBaseUrl) || url.startsWith('http://localhost:5000') || url.startsWith('/api')) {
                    init = init || {};
                    init.credentials = 'include';
                    var token = localStorage.getItem('wp_session_token');
                    if (token) {
                      var headers = init.headers || {};
                      if (headers instanceof Headers) {
                        headers.set('Authorization', 'Bearer ' + token);
                      } else if (Array.isArray(headers)) {
                        var exists = headers.some(function(pair) { return pair[0].toLowerCase() === 'authorization'; });
                        if (!exists) {
                          headers.push(['Authorization', 'Bearer ' + token]);
                        }
                      } else {
                        headers['Authorization'] = 'Bearer ' + token;
                      }
                      init.headers = headers;
                    }
                  }
                  return originalFetch(input, init);
                };
              })();
            `
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground flex flex-col relative select-none">
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
