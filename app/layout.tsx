import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Arrakis Vault Dashboard | Product Designer Challenge',
  description:
    'A Next.js 14 starter for the Arrakis product designer challenge. Explore vault data, liquidity profiles, and more.',
  keywords: ['Arrakis', 'DeFi', 'Liquidity', 'Vaults', 'Web3'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
