'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// Chain logo URLs - using popular CDNs for chain logos
const CHAIN_LOGOS: Record<number, string> = {
  1: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png', // Ethereum
  56: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png', // BSC
  8453: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg', // Base
  137: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png', // Polygon
  42161: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png', // Arbitrum
  10: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png', // Optimism
}

interface ChainIconProps {
  chainId: number
  className?: string
}

export function ChainIcon({ chainId, className }: ChainIconProps) {
  const [error, setError] = React.useState(false)
  const logoUrl = CHAIN_LOGOS[chainId]

  if (error || !logoUrl) {
    // Fallback: show chain ID or a simple circle
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted text-[8px] font-bold text-muted-foreground rounded-full border border-background", 
          className
        )}
      >
        {chainId}
      </div>
    )
  }

  return (
    <img
      src={logoUrl}
      alt={`Chain ${chainId}`}
      className={cn("rounded-full border border-background/50 bg-background object-cover", className)}
      onError={() => setError(true)}
    />
  )
}

