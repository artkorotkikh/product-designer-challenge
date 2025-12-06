'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// Exchange/Protocol logo URLs
const EXCHANGE_LOGOS: Record<string, string> = {
  'uniswap': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
  'uniswap v3': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
  'uniswap v4': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
  'aerodrome': 'https://assets.coingecko.com/coins/images/28203/large/aerodrome.png',
  'pancakeswap': 'https://assets.coingecko.com/coins/images/12632/large/pancakeswap-cake-logo_%281%29.png',
}

interface ExchangeIconProps {
  exchangeName: string
  className?: string
}

export function ExchangeIcon({ exchangeName, className }: ExchangeIconProps) {
  const [error, setError] = React.useState(false)
  
  // Normalize exchange name for lookup - handle variations
  const normalizedName = exchangeName?.toLowerCase().trim() || ''
  
  // Try exact match first
  let logoUrl = EXCHANGE_LOGOS[normalizedName]
  
  // If no exact match, try partial matches
  if (!logoUrl) {
    if (normalizedName.includes('uniswap')) {
      logoUrl = EXCHANGE_LOGOS['uniswap']
    } else if (normalizedName.includes('aerodrome')) {
      logoUrl = EXCHANGE_LOGOS['aerodrome']
    } else if (normalizedName.includes('pancake')) {
      logoUrl = EXCHANGE_LOGOS['pancakeswap']
    }
  }

  if (error || !logoUrl) {
    // Fallback: show first letter or exchange name
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted text-[8px] font-bold text-muted-foreground rounded-full border border-background", 
          className
        )}
      >
        {exchangeName?.[0]?.toUpperCase() || '?'}
      </div>
    )
  }

  return (
    <img
      src={logoUrl}
      alt={exchangeName}
      className={cn("rounded-full border border-background/50 bg-background object-cover", className)}
      onError={() => setError(true)}
    />
  )
}

