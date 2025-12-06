'use client'

import * as React from 'react'
import { ArrowUpRight, ArrowDownRight, Info } from 'lucide-react'
import { cn, formatNumber, getRelativeTime } from '@/lib/utils'

interface VaultStatsProps {
  data: any
  loading?: boolean
}

export function VaultStats({ data, loading }: VaultStatsProps) {
  if (loading) {
    return (
      <div className="w-full h-24 bg-muted/10 animate-pulse rounded-lg" />
    )
  }

  if (!data) return null

  // Extract data
  const token0 = data.data?.tokens?.token0
  const token1 = data.data?.tokens?.token1
  const tvl = data.data?.totalValueUSD || 0
  const fees30d = data.summary?.fees30d?.usdValue || 0
  // Check top level or data level for APR, fallback to mock if missing
  const apy = data.apr || data.data?.apr || '21.3%' 
  const apyValue = typeof apy === 'string' ? parseFloat(apy.replace('%', '')) : apy
  
  const lastRebalanced = data.data?.general?.lastRebalanced
    ? getRelativeTime(data.data.general.lastRebalanced)
    : '18 hours ago' // Fallback

  // Calculate Price (Value / Amount)
  // Handle string amounts from API
  const token0Amount = token0?.amount ? parseFloat(token0.amount) : 0
  const token0Price = token0Amount > 0 ? (token0?.valueUSD || 0) / token0Amount : 0
  
  // Inventory Ratios
  const totalInventoryUSD = (token0?.valueUSD || 0) + (token1?.valueUSD || 0)
  const token0Ratio = totalInventoryUSD > 0 ? ((token0?.valueUSD || 0) / totalInventoryUSD) * 100 : 50
  const token1Ratio = 100 - token0Ratio

  // Mock changes for now as they are not in the summary endpoint
  const priceChange = 2.1
  const tvlChange = -1.29
  const feesChange = -1.29
  const apyChange = -1.29

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-6 py-2">
      {/* Status */}
      <div className="flex flex-col space-y-1 min-w-[100px]">
        <div className="flex items-center gap-1.5 h-4">
          <span className="text-xs text-muted-foreground font-sans">Status</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
        <div className="h-[2.5rem] flex items-start">
          <span className="text-2xl font-mono text-emerald-500 font-normal leading-none">
            Healthy
          </span>
        </div>
      </div>

      <div className="hidden md:block w-px h-12 bg-border/40 self-stretch" />

      {/* Last Rebalanced */}
      <div className="flex flex-col space-y-1 min-w-[120px]">
        <div className="h-4">
          <span className="text-xs text-muted-foreground font-sans">Last rebalanced</span>
        </div>
        <div className="h-[2.5rem] flex items-start">
          <span className="text-2xl font-mono text-arrakis-orange font-normal leading-none">
            {lastRebalanced.replace(' ago', '')}
          </span>
        </div>
      </div>

      <div className="hidden md:block w-px h-12 bg-border/40 self-stretch" />

      {/* Token Price */}
      <div className="flex flex-col space-y-1 min-w-[140px]">
        <div className="h-4">
          <span className="text-xs text-muted-foreground font-sans">
            {token0?.symbol || 'Token'} Price
          </span>
        </div>
        <div className="h-[2.5rem] flex items-start">
          <div className="flex flex-col">
            <span className="text-2xl font-mono text-foreground font-normal leading-none">
              ${formatNumber(token0Price, 3)}
            </span>
            <div className="flex items-center gap-1 mt-1">
              {priceChange >= 0 ? (
                 <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              ) : (
                 <ArrowDownRight className="w-3 h-3 text-red-500" />
              )}
              <span className={cn("text-xs font-sans", priceChange >= 0 ? "text-emerald-500" : "text-red-500")}>
                {Math.abs(priceChange)}% 24h
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:block w-px h-12 bg-border/40 self-stretch" />

      {/* Total Liquidity */}
      <div className="flex flex-col space-y-1 min-w-[140px]">
        <div className="h-4">
          <span className="text-xs text-muted-foreground font-sans">Total Liquidity</span>
        </div>
        <div className="h-[2.5rem] flex items-start">
          <div className="flex flex-col">
            <span className="text-2xl font-mono text-foreground font-normal leading-none">
              ${formatNumber(tvl / 1000000, 1)}M
            </span>
            <div className="flex items-center gap-1 mt-1">
               {tvlChange >= 0 ? (
                 <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              ) : (
                 <ArrowDownRight className="w-3 h-3 text-red-500" />
              )}
              <span className={cn("text-xs font-sans", tvlChange >= 0 ? "text-emerald-500" : "text-red-500")}>
                {Math.abs(tvlChange)}% today
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:block w-px h-12 bg-border/40 self-stretch" />

      {/* 30d Fees */}
      <div className="flex flex-col space-y-1 min-w-[140px]">
        <div className="h-4">
          <span className="text-xs text-muted-foreground font-sans">30d Fees</span>
        </div>
        <div className="h-[2.5rem] flex items-start">
          <div className="flex flex-col">
            <span className="text-2xl font-mono text-foreground font-normal leading-none">
              ${formatNumber(fees30d / 1000, 1)}k
            </span>
            <div className="flex items-center gap-1 mt-1">
               {feesChange >= 0 ? (
                 <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              ) : (
                 <ArrowDownRight className="w-3 h-3 text-red-500" />
              )}
              <span className={cn("text-xs font-sans", feesChange >= 0 ? "text-emerald-500" : "text-red-500")}>
                {Math.abs(feesChange)}% today
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:block w-px h-12 bg-border/40 self-stretch" />

      {/* APY */}
      <div className="flex flex-col space-y-1 min-w-[120px]">
        <div className="h-4">
          <span className="text-xs text-muted-foreground font-sans">APY</span>
        </div>
        <div className="h-[2.5rem] flex items-start">
          <div className="flex flex-col">
            <span className="text-2xl font-mono text-foreground font-normal leading-none">
              {formatNumber(apyValue, 1)}%
            </span>
            <div className="flex items-center gap-1 mt-1">
               {apyChange >= 0 ? (
                 <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              ) : (
                 <ArrowDownRight className="w-3 h-3 text-red-500" />
              )}
              <span className={cn("text-xs font-sans", apyChange >= 0 ? "text-emerald-500" : "text-red-500")}>
                {Math.abs(apyChange)}% today
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:block w-px h-12 bg-border/40 self-stretch" />

      {/* Inventory Balance */}
      <div className="flex flex-col space-y-1 min-w-[200px] max-w-[200px] w-full lg:w-auto lg:flex-1 lg:max-w-none">
        <div className="h-4">
          <span className="text-xs text-muted-foreground font-sans">Inventory Balance</span>
        </div>
        <div className="space-y-2">
          {/* Values */}
          <div className="flex items-center gap-4 font-mono text-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <span className="text-emerald-500 text-xs">✻</span>
              </div>
              <span>{formatNumber((token0Amount || 0) / 1000000, 1)}M</span>
            </div>
            <div className="w-px h-4 bg-border/40" />
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <span className="text-blue-500 text-xs">⚡</span>
              </div>
              <span>{formatNumber((parseFloat(token1?.amount || '0') || 0) / 1000000, 1)}M</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground font-mono">{Math.round(token0Ratio)}%</span>
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
            <span className="text-[10px] text-muted-foreground font-mono">{Math.round(token1Ratio)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
