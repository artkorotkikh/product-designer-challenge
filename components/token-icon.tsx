'use client'

import * as React from 'react'
import { getAddress } from 'viem'
import { getTokenLogoUrl } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface TokenIconProps {
  address: string
  chainId: number
  symbol: string
  className?: string
}

export function TokenIcon({ address, chainId, symbol, className }: TokenIconProps) {
  const [error, setError] = React.useState(false)

  const logoUrl = React.useMemo(() => {
    try {
      const checksumAddress = getAddress(address)
      return getTokenLogoUrl(checksumAddress, chainId, symbol)
    } catch {
      return getTokenLogoUrl(address, chainId, symbol)
    }
  }, [address, chainId, symbol])

  if (error || !logoUrl) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted text-[10px] font-bold text-muted-foreground rounded-full border-2 border-background", 
          className
        )}
      >
        {symbol[0]?.toUpperCase() || '?'}
      </div>
    )
  }

  return (
    <img
      src={logoUrl}
      alt={symbol}
      className={cn("rounded-full border-2 border-background bg-background object-cover", className)}
      onError={() => setError(true)}
    />
  )
}

