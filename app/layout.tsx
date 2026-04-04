import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "DigitAlchemy\u00AE Console",
  description: "Task intake and MCP orchestration interface \u2014 DigitAlchemy\u00AE Tech Limited",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} bg-gray-50 min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
