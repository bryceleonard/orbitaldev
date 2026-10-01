import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Orbital — AI Project Intelligence',
  description:
    'Drop in your meeting transcripts and files. Orbital reads them, extracts decisions, flags risks, and updates your project — automatically.',
  keywords: [
    'meeting transcript AI',
    'AI project management',
    'meeting intelligence',
    'action items from meetings',
    'AI project assistant',
  ],
  openGraph: {
    title: 'Orbital — AI Project Intelligence',
    description: 'The AI member of your team that never misses a meeting.',
    type: 'website',
  },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
