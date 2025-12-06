'use client'

import * as React from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn, formatCompactNumber, formatNumber, getRelativeTime } from '@/lib/utils'

interface VaultStatsProps {
  data: any
  loading?: boolean
}

interface StatItemProps {
  label: string
  value: React.ReactNode
  indicator?: React.ReactNode
}

interface StatWithChangeProps extends Omit<StatItemProps, 'value'> {
  value: string | number
  change: number
  changeLabel: string
}

/**
 * Component to render numbers in scientific notation
 * Example: 1.5 × 10²²
 */
function ScientificNotation({ num }: { num: number | string }) {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n) || n === 0) return <span>0</span>

  const [mantissa, exponent] = n.toExponential(1).split('e')
  const exp = parseInt(exponent, 10)

  return (
    <span className="inline-flex items-baseline">
      {parseFloat(mantissa)} × 10
      <sup className="text-[0.75em] leading-none ml-0.5">{exp}</sup>
    </span>
  )
}

/**
 * Component to render small prices with subscript notation
 * Example: $0.0₅85 (meaning $0.000000085)
 */
function SubscriptPrice({ num }: { num: number | string }) {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n) || n === 0) return <span>$0</span>

  const absNum = Math.abs(n)
  
  // Convert to string to analyze decimal places
  const numStr = absNum.toFixed(20) // Use high precision
  const match = numStr.match(/^0\.0+([1-9]\d*)/)
  
  if (!match) {
    // Not a candidate for subscript notation, use normal formatting
    return <span>${formatNumber(n, 3)}</span>
  }

  const leadingZeros = match[0].split('.')[1].match(/^0+/)?.[0].length || 0
  const significantDigits = match[1]

  // Use subscript notation if we have at least 2 leading zeros after decimal point
  if (leadingZeros >= 2) {
    const subscript = leadingZeros.toString()
    const subscriptMap: Record<string, string> = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
    }
    
    const subscriptChar = subscript
      .split('')
      .map(d => subscriptMap[d] || d)
      .join('')

    return (
      <span className="inline-flex items-baseline">
        $0.0<span className="text-[0.75em] leading-none align-baseline">{subscriptChar}</span>{significantDigits}
      </span>
    )
  }

  return <span>${formatNumber(n, 3)}</span>
}

function StatItem({ label, value, indicator }: StatItemProps) {
  return (
    <div className="stats-item">
      <div className="stats-header">
        {indicator}
        <span>{label}</span>
      </div>
      <div className="stats-value-container">{value}</div>
    </div>
  )
}

function StatWithChange({ 
  label, 
  value, 
  change, 
  changeLabel, 
  valueColor = 'text-foreground'
}: StatWithChangeProps & { valueColor?: string }) {
  const isPositive = change >= 0
  const changeColor = isPositive ? 'text-emerald-500' : 'text-red-500'
  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight

  return (
    <StatItem
      label={label}
      value={
        <div className="flex flex-col">
          <span className={cn('stats-number', valueColor)}>{value}</span>
          <div className="stats-details">
            <ChangeIcon className={cn('stats-details-icon', changeColor)} />
            <span className={changeColor}>
              {Math.abs(change)}% {changeLabel}
            </span>
          </div>
        </div>
      }
    />
  )
}

export function VaultStats({ data, loading }: VaultStatsProps) {
  if (loading) {
    return <div className="w-full h-24 bg-muted/10 animate-pulse rounded-lg" />
  }

  if (!data) return null

  // Data extraction
  const token0 = data.data?.tokens?.token0
  const token1 = data.data?.tokens?.token1
  const tvl = data.data?.totalValueUSD || 0
  const fees30d = data.summary?.fees30d?.usdValue || 0
  const apy = data.apr || data.data?.apr || '21.3%'
  const apyValue = typeof apy === 'string' ? parseFloat(apy.replace('%', '')) : apy

  const lastRebalanced = data.data?.general?.lastRebalanced
    ? getRelativeTime(data.data.general.lastRebalanced).replace(' ago', '')
    : '18 hours'

  // Calculations
  // Adjust raw amounts by decimals to get actual token amounts
  const token0Decimals = token0?.decimals || 18
  const token1Decimals = token1?.decimals || 6
  const token0RawAmount = token0?.amount ? parseFloat(token0.amount) : 0
  const token1RawAmount = token1?.amount ? parseFloat(token1.amount) : 0
  
  // Calculate actual token amounts (dividing by 10^decimals)
  const token0ActualAmount = token0RawAmount / Math.pow(10, token0Decimals)
  const token1ActualAmount = token1RawAmount / Math.pow(10, token1Decimals)
  
  // Calculate price from USD value and actual amount
  const token0Price = token0ActualAmount > 0 ? (token0?.valueUSD || 0) / token0ActualAmount : 0

  const totalInventoryUSD = (token0?.valueUSD || 0) + (token1?.valueUSD || 0)
  const token0Ratio = totalInventoryUSD > 0 ? ((token0?.valueUSD || 0) / totalInventoryUSD) * 100 : 50
  const token1Ratio = 100 - token0Ratio

  // Format inventory amounts - convert to millions with proper rounding
  // For extremely large numbers, use scientific notation
  const formatInventoryAmount = (amount: number) => {
    if (amount === 0) return '0'
    
    // Convert to millions for display
    const amountInMillions = amount / 1_000_000
    
    // If still extremely large even in millions (e.g., > 1e9), use scientific notation
    if (Math.abs(amountInMillions) >= 1e9) {
      return <ScientificNotation num={amount} />
    }
    
    // Format as X.XM with one decimal place, properly rounded
    return `${amountInMillions.toFixed(1)}M`
  }

  // Format price - use subscript notation for very small numbers
  const formatPrice = (price: number): React.ReactNode => {
    if (price === 0) return '$0'
    
    // If price is very small (< 0.01), use subscript notation
    if (Math.abs(price) > 0 && Math.abs(price) < 0.01) {
      return <SubscriptPrice num={price} />
    }
    
    // Otherwise format with up to 3 decimal places
    return `$${formatNumber(price, 3)}`
  }

  // Mock changes (to be replaced with real data when available)
  const priceChange = 2.1
  const tvlChange = -1.29
  const feesChange = -1.29
  const apyChange = -1.29

  return (
    <div className="stats-container py-2">
      {/* Status */}
      <StatItem
        label="Status"
        indicator={<div className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />}
        value={
          <span className="stats-number text-emerald-500">Healthy</span>
        }
      />

      <div className="stats-divider" />

      {/* Last Rebalanced */}
      <StatItem
        label="Last rebalanced"
        value={
          <span className="stats-number text-arrakis-orange">{lastRebalanced}</span>
        }
      />

      <div className="stats-divider" />

      {/* Token Price */}
      <StatItem
        label={`${token0?.symbol || 'Token'} Price`}
        value={
          <div className="flex flex-col">
            <span className="stats-number text-foreground">{formatPrice(token0Price)}</span>
            <div className="stats-details">
              {priceChange >= 0 ? (
                <ArrowUpRight className="stats-details-icon text-emerald-500" />
              ) : (
                <ArrowDownRight className="stats-details-icon text-red-500" />
              )}
              <span className={priceChange >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                {Math.abs(priceChange)}% 24h
              </span>
            </div>
          </div>
        }
      />

      <div className="stats-divider" />

      {/* Total Liquidity */}
      <StatWithChange
        label="Total Liquidity"
        value={`$${formatCompactNumber(tvl)}`}
        change={tvlChange}
        changeLabel="today"
      />

      <div className="stats-divider" />

      {/* 30d Fees */}
      <StatWithChange
        label="30d Fees"
        value={`$${formatCompactNumber(fees30d)}`}
        change={feesChange}
        changeLabel="today"
      />

      <div className="stats-divider" />

      {/* APY */}
      <StatWithChange
        label="APY"
        value={`${formatNumber(apyValue, 1)}%`}
        change={apyChange}
        changeLabel="today"
      />

      <div className="stats-divider lg:block hidden" />

      {/* Inventory Balance */}
      <div className="stats-item stats-inventory">
        <div className="stats-header">
          <span>Inventory Balance</span>
        </div>
        <div className="space-y-2">
          {/* Values in USD */}
          <div className="flex items-center gap-4 font-mono text-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <span className="text-emerald-500 text-xs">✻</span>
              </div>
              <span>${formatCompactNumber(token0?.valueUSD || 0)}</span>
            </div>
            <div className="w-px h-4 bg-border/40" />
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <span className="text-blue-500 text-xs">⚡</span>
              </div>
              <span>${formatCompactNumber(token1?.valueUSD || 0)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground font-mono">
              {Math.round(token0Ratio)}%
            </span>
            <div className="flex-1 h-1.5 bg-blue-500/20 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-foreground"
                style={{ width: `${token0Ratio}%` }}
              />
              <div
                className="h-full bg-blue-500"
                style={{ width: `${token1Ratio}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {Math.round(token1Ratio)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
