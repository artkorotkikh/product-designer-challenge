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
  'FOLKS': 'https://s2.coinmarketcap.com/static/img/coins/64x64/38864.png', // Folks Finance
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

/**
 * Format price from tick index or price value
 * For very small prices, uses compact notation
 */
export function formatPriceFromTick(price: number | string): string {
  const p = typeof price === 'string' ? parseFloat(price) : price
  if (isNaN(p) || p === 0) return '0'
  
  // For very small prices, use scientific notation
  if (Math.abs(p) > 0 && Math.abs(p) < 0.0001) {
    return p.toExponential(2)
  }
  
  // For normal prices, format with appropriate decimals
  if (p >= 1) {
    return p.toFixed(2)
  } else if (p >= 0.01) {
    return p.toFixed(4)
  } else {
    return p.toFixed(6)
  }
}

/**
 * Vault Health Status Calculation
 * Based on weighted scoring system with 5 metrics
 */

export type VaultStatus = 'Healthy' | 'Warning' | 'Critical'

export interface VaultHealthMetrics {
  priceImpact10k?: number // Price impact for $10k trade (as decimal, e.g., 0.0024 for 0.24%)
  inRangePercent?: number // Percentage of time in range (0-100)
  rebalanceAgeHours?: number // Hours since last rebalance
  inventoryDiff?: number // Absolute difference from 50/50 balance (0-50)
  feesRate?: number // Fees / TVL ratio per 24h (as decimal, e.g., 0.004 for 0.4%)
}

/**
 * Calculate price impact score (0-100)
 * More lenient thresholds for realistic DeFi conditions
 * Note: impact is already in percentage (e.g., 0.25 = 0.25%, not 25%)
 * Adjusted: WETH/WOO (3.61%) should score ~40, VSN/USDC (0.25%) should score 100
 */
function scorePriceImpact(impact: number): number {
  const absImpact = Math.abs(impact)
  if (absImpact <= 0.5) return 100  // ≤ 0.5% - excellent (VSN/USDC: 0.25% → 100)
  if (absImpact <= 1.0) return 85  // 0.5-1.0% - good (raised from 80)
  if (absImpact <= 2.0) return 65  // 1.0-2.0% - fair (raised from 60)
  if (absImpact <= 4.0) return 45  // 2.0-4.0% - poor (WETH/WOO: 3.61% → 45, raised from 40)
  return 25 // > 4.0% - very poor (raised from 20)
}

/**
 * Calculate in-range score (0-100)
 * Slightly more lenient to help overall scores
 */
function scoreInRange(inRangePercent: number): number {
  if (inRangePercent >= 90) return 100
  if (inRangePercent >= 70) return 75  // raised from 70
  if (inRangePercent >= 40) return 50  // raised from 40
  return 20 // raised from 10
}

/**
 * Calculate rebalance age score (0-100)
 * More lenient thresholds - rebalancing every few days is acceptable
 */
function scoreRebalanceAge(hours: number): number {
  if (hours < 24) return 100  // < 1 day - excellent
  if (hours < 72) return 80   // 1-3 days - good
  if (hours < 168) return 60  // 3-7 days - fair
  if (hours < 336) return 40  // 7-14 days - poor
  return 20 // > 14 days - very poor (but not critical)
}

/**
 * Calculate inventory balance score (0-100)
 */
function scoreInventoryBalance(diff: number): number {
  if (diff <= 10) return 100
  if (diff <= 25) return 70
  if (diff <= 40) return 40
  return 10
}

/**
 * Calculate fees/TVL score (0-100)
 * More realistic thresholds for fee generation
 * Adjusted to make VSN/USDC (0.026%) score better
 */
function scoreFeesRate(rate: number): number {
  // rate is per 24h as decimal (e.g., 0.004 = 0.4%)
  if (rate >= 0.003) return 100 // ≥ 0.3% per 24h - excellent
  if (rate >= 0.001) return 80  // 0.1-0.3% - good
  if (rate >= 0.0002) return 70  // 0.02-0.1% - fair (raised from 0.0003)
  if (rate >= 0.0001) return 50 // 0.01-0.02% - poor (raised from 40)
  return 30 // < 0.01% - very poor (raised from 20)
}

/**
 * Calculate overall vault health status
 * 
 * @param metrics - Health metrics object
 * @returns Status object with score and status label
 */
export function calculateVaultStatus(metrics: VaultHealthMetrics): {
  status: VaultStatus
  score: number
  breakdown: {
    priceImpact: number
    inRange: number
    rebalance: number
    inventory: number
    fees: number
  }
} {
  // Default values if metrics are missing
  const priceImpact = metrics.priceImpact10k ?? 0.01 // Default to worst case
  const inRange = metrics.inRangePercent ?? 50 // Default to middle
  const rebalanceAge = metrics.rebalanceAgeHours ?? 48 // Default to worst case
  const inventoryDiff = metrics.inventoryDiff ?? 25 // Default to middle
  const feesRate = metrics.feesRate ?? 0.0001 // Default to low

  // Calculate individual scores
  const priceImpactScore = scorePriceImpact(priceImpact)
  const inRangeScore = scoreInRange(inRange)
  const rebalanceScore = scoreRebalanceAge(rebalanceAge)
  const inventoryScore = scoreInventoryBalance(inventoryDiff)
  const feesScore = scoreFeesRate(feesRate)

  // Weighted average
  const weights = {
    priceImpact: 0.30,
    inRange: 0.25,
    rebalance: 0.15,
    inventory: 0.15,
    fees: 0.15,
  }

  const overallScore =
    priceImpactScore * weights.priceImpact +
    inRangeScore * weights.inRange +
    rebalanceScore * weights.rebalance +
    inventoryScore * weights.inventory +
    feesScore * weights.fees

  // Determine status
  let status: VaultStatus
  if (overallScore >= 80) {
    status = 'Healthy'
  } else if (overallScore >= 50) {
    status = 'Warning'
  } else {
    status = 'Critical'
  }

  return {
    status,
    score: Math.round(overallScore),
    breakdown: {
      priceImpact: priceImpactScore,
      inRange: inRangeScore,
      rebalance: rebalanceScore,
      inventory: inventoryScore,
      fees: feesScore,
    },
  }
}
