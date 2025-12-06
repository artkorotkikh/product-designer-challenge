import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { getAddress } from "viem"

/**
 * Utility function to merge Tailwind CSS classes
 * Used by shadcn/ui components
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a wallet address to show first and last 6 characters
 * Example: 0x1234...5678
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Format a number with commas and fixed decimals
 * Handles very small numbers by showing more decimals or <0.01
 */
export function formatNumber(num: number | string, decimals: number = 2): string {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n)) return '0'
  
  if (n > 0 && n < 0.01) {
    return '< 0.01'
  }
  
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Format large numbers in compact notation (e.g., 26.8M, 1.2k, 500)
 * Automatically chooses appropriate unit and rounds to 1 decimal place
 */
export function formatCompactNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n)) return '0'
  
  const absNum = Math.abs(n)
  
  // Billions
  if (absNum >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}B`
  }
  
  // Millions
  if (absNum >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  
  // Thousands
  if (absNum >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`
  }
  
  // Less than 1000, show with appropriate decimals
  if (absNum >= 1) {
    return n.toFixed(1)
  }
  
  // Very small numbers - return formatted string for scientific notation
  if (absNum > 0 && absNum < 1) {
    const sci = formatScientificNotation(n)
    return sci.display
  }
  
  return '0'
}

/**
 * Format very small or very large numbers in scientific notation
 * Returns an object with mantissa and exponent for rendering
 */
export function formatScientificNotation(num: number | string): {
  mantissa: string
  exponent: number
  display: string
} {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n) || n === 0) {
    return { mantissa: '0', exponent: 0, display: '0' }
  }
  
  const [mantissa, exponent] = n.toExponential(1).split('e')
  const exp = parseInt(exponent, 10)
  
  return {
    mantissa: parseFloat(mantissa).toString(),
    exponent: exp,
    display: `${parseFloat(mantissa)} × 10${exp >= 0 ? '⁺' : '⁻'}${Math.abs(exp)}`
  }
}

/**
 * Format a date string to a readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'just now'
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} hours ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays} days ago`
}

/**
 * Known token addresses for logo mapping
 * Maps common token symbols/addresses to known logo sources
 */
const KNOWN_TOKEN_LOGOS: Record<string, string> = {
  // Ethereum native token
  'ETH': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  'WETH': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  
  // Common stablecoins and major tokens
  'USDC': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  'USDT': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
  'DAI': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
  'WBTC': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
  
  // Token logo URLs - using CoinMarketCap
  'VSN': 'https://s2.coinmarketcap.com/static/img/coins/64x64/37322.png', // Vision Network
  'FOLKS': 'https://assets.coingecko.com/coins/images/25392/large/FOLKS.png', // Folks Finance
  'WOO': 'https://s2.coinmarketcap.com/static/img/coins/64x64/7501.png', // WOO Network
  
  // Ethereum Mainnet specific addresses
  '0x699ccf919c1dfdfa4c374292f42cadc9899bf753': 'https://s2.coinmarketcap.com/static/img/coins/64x64/37322.png', // VSN token address
}

/**
 * Get Token Logo URL - tries multiple sources
 * Priority: Known tokens > TrustWallet > Return empty for fallback UI
 */
export function getTokenLogoUrl(address: string, chainId: number, symbol?: string): string {
  // Try known token mapping first (by symbol or address)
  if (symbol) {
    const symbolUpper = symbol.toUpperCase()
    if (KNOWN_TOKEN_LOGOS[symbolUpper]) {
      return KNOWN_TOKEN_LOGOS[symbolUpper]
    }
  }
  
  const addressLower = address.toLowerCase()
  if (KNOWN_TOKEN_LOGOS[addressLower]) {
    return KNOWN_TOKEN_LOGOS[addressLower]
  }

  // Try TrustWallet Assets
  const chainMap: Record<number, string> = {
    1: 'ethereum',
    56: 'smartchain',
    137: 'polygon',
    10: 'optimism',
    42161: 'arbitrum',
    8453: 'base',
  }

  const chainName = chainMap[chainId]
  if (chainName) {
    try {
      const checksumAddress = getAddress(address)
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${checksumAddress}/logo.png`
    } catch {
      // If checksumming fails, try with original address
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${address}/logo.png`
    }
  }

  // Return empty to trigger fallback UI with symbol
  return ''
}
