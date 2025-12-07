'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChevronRight, Hexagon, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn, formatCompactNumber, calculateVaultStatus, type VaultStatus } from '@/lib/utils'
import { TEST_VAULTS, fetchVaultDetails } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { TokenIcon } from '@/components/token-icon'
import { ChainIcon } from '@/components/chain-icon'
import { ExchangeIcon } from '@/components/exchange-icon'
import { useState, useEffect } from 'react'
import type { VaultMetadata } from '@/lib/types'

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

interface VaultWithMetadata {
  address: string
  chainId: number
  metadata: VaultMetadata | null
  loading: boolean
  status?: VaultStatus
  statusLoading: boolean
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentAddress = searchParams.get('address')
  const currentChainId = searchParams.get('chainId')
  const [vaultsWithMetadata, setVaultsWithMetadata] = useState<VaultWithMetadata[]>([])

  // Fetch vault metadata and status for all test vaults
  useEffect(() => {
    async function fetchAllVaults() {
      const vaultsData = TEST_VAULTS.map(vault => ({
        address: vault.address,
        chainId: vault.chainId,
        metadata: null as VaultMetadata | null,
        loading: true,
        statusLoading: true,
      }))
      setVaultsWithMetadata(vaultsData)

      // Fetch metadata for each vault
      const promises = TEST_VAULTS.map(async (vault) => {
        try {
          const metadata = await fetchVaultDetails(vault.chainId, vault.address)
          return { ...vault, metadata, loading: false }
        } catch (error) {
          console.error(`Failed to fetch vault ${vault.address}:`, error)
          return { ...vault, metadata: null, loading: false }
        }
      })

      const results = await Promise.all(promises)
      setVaultsWithMetadata(results.map(({ address, chainId, metadata, loading }) => ({
        address,
        chainId,
        metadata,
        loading,
        statusLoading: true,
      })))

      // Fetch full vault data for status calculation
      const statusPromises = results.map(async ({ address, chainId, metadata }) => {
        if (!metadata) return { address, chainId, status: undefined as VaultStatus | undefined }
        
        try {
          const response = await fetch(`/api/vaults/${chainId}/${address}`)
          if (!response.ok) return { address, chainId, status: undefined as VaultStatus | undefined }
          
          const fullData = await response.json()
          
          // Calculate status from full data
          const token0 = fullData?.data?.tokens?.token0
          const token1 = fullData?.data?.tokens?.token1
          const tvl = fullData?.data?.totalValueUSD || 0
          const fees30d = fullData?.summary?.fees30d?.usdValue || 0
          
          // Extract metrics for status calculation
          const priceImpactBuy = fullData?.summary?.priceImpact?.buy
          const priceImpact10k = priceImpactBuy?.['10000'] || priceImpactBuy?.[10000]
          
          const lastRebalancedDate = fullData?.data?.general?.lastRebalanced
          const rebalanceAgeHours = lastRebalancedDate
            ? (Date.now() - new Date(lastRebalancedDate).getTime()) / (1000 * 60 * 60)
            : undefined
          
          const inventoryDiff = token0?.percentage !== undefined
            ? Math.abs(token0.percentage - 50)
            : undefined
          
          const feesRate = tvl > 0 && fees30d > 0
            ? (fees30d / tvl) / 30
            : undefined
          
          // Estimate in-range % based on inventory balance
          let inRangePercent: number | undefined
          if (inventoryDiff !== undefined) {
            if (inventoryDiff < 20) {
              inRangePercent = 85
            } else if (inventoryDiff < 30) {
              inRangePercent = 65
            } else {
              inRangePercent = 35
            }
          }
          
          const statusResult = calculateVaultStatus({
            priceImpact10k: priceImpact10k ? Math.abs(parseFloat(priceImpact10k.toString())) : undefined,
            inRangePercent,
            rebalanceAgeHours,
            inventoryDiff,
            feesRate,
          })
          
          return { address, chainId, status: statusResult.status }
        } catch (error) {
          console.error(`Failed to fetch status for vault ${address}:`, error)
          return { address, chainId, status: undefined as VaultStatus | undefined }
        }
      })

      const statusResults = await Promise.all(statusPromises)
      
      // Update vaults with status
      setVaultsWithMetadata(prev => prev.map(vault => {
        const statusResult = statusResults.find(s => s.address === vault.address && s.chainId === vault.chainId)
        return {
          ...vault,
          status: statusResult?.status,
          statusLoading: false,
        }
      }))
    }

    fetchAllVaults()
  }, [])

  return (
    <aside 
      className={cn(
        "border-r border-border/40 bg-card/50 backdrop-blur-xl fixed h-screen left-0 top-0 flex flex-col z-40 transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header / Toggle */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border/40">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <Image
              src="/assets/icons/logo.svg"
              alt="Arrakis"
              width={107}
              height={20}
              className="h-5 w-auto"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("ml-auto h-8 w-8", collapsed && "mx-auto")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-2">
        <div>
          {!collapsed && (
            <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Vaults
            </h3>
          )}
          <nav className="space-y-1">
            {vaultsWithMetadata.map((vault) => {
              const isActive = 
                currentAddress === vault.address && 
                Number(currentChainId) === vault.chainId
              
              // Handle both flat and nested response structures
              const metadata = vault.metadata as any
              const token0 = vault.metadata?.token0 || metadata?.data?.tokens?.token0
              const token1 = vault.metadata?.token1 || metadata?.data?.tokens?.token1
              const tvl = vault.metadata?.tvl || metadata?.data?.totalValueUSD
              const feeTier = vault.metadata?.feeTier || metadata?.data?.pool?.feeTier
              const exchangeRaw = vault.metadata?.exchange || metadata?.data?.pool?.name
              
              // Extract exchange name from protocol name (similar to header logic)
              const getExchangeName = (protocol: string | undefined) => {
                if (!protocol) return null
                const lower = protocol.toLowerCase().trim()
                if (lower.includes('uniswap')) return 'Uniswap'
                if (lower.includes('aerodrome')) return 'Aerodrome'
                if (lower.includes('pancake')) return 'PancakeSwap'
                return protocol
              }
              
              const exchangeName = getExchangeName(exchangeRaw)
              
              const pairName = token0 && token1 
                ? `${token0.symbol}/${token1.symbol}` 
                : vault.metadata?.name || `${vault.address.slice(0, 6)}...${vault.address.slice(-4)}`
              
              // Safely parse TVL - handle both string and number
              const tvlValue = tvl 
                ? (typeof tvl === 'string' ? parseFloat(tvl) : tvl)
                : null
              const formattedTvl = tvlValue && !isNaN(tvlValue) 
                ? formatCompactNumber(tvlValue) 
                : null
              
              return (
                <Link
                  key={`${vault.chainId}-${vault.address}`}
                  href={`/?chainId=${vault.chainId}&address=${vault.address}`}
                  onClick={(e) => {
                    // Force navigation even if URL is the same
                    if (isActive) {
                      e.preventDefault()
                      router.push(`/?chainId=${vault.chainId}&address=${vault.address}`)
                      router.refresh()
                    }
                  }}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer",
                    isActive 
                      ? "bg-primary/10 text-primary border border-primary/20" 
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? pairName : undefined}
                >
                  {/* Token Pair Icons with Status Indicator */}
                  <div className="flex items-center shrink-0 relative">
                    {vault.loading ? (
                      <div className="w-8 h-8 rounded-full bg-muted/50 animate-pulse" />
                    ) : token0 && token1 ? (
                      <div className="flex -space-x-2 relative">
                        <TokenIcon
                          address={token0.address}
                          chainId={vault.chainId}
                          symbol={token0.symbol}
                          className={cn(
                            "w-6 h-6 border-2",
                            isActive ? "border-primary/30" : "border-background"
                          )}
                        />
                        <TokenIcon
                          address={token1.address}
                          chainId={vault.chainId}
                          symbol={token1.symbol}
                          className={cn(
                            "w-6 h-6 border-2",
                            isActive ? "border-primary/30" : "border-background"
                          )}
                        />
                        {/* Status Indicator Dot */}
                        {!vault.statusLoading && vault.status && (
                          <div
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2",
                              vault.status === 'Healthy' && "bg-emerald-500 border-background",
                              vault.status === 'Warning' && "bg-yellow-500 border-background",
                              vault.status === 'Critical' && "bg-red-500 border-background"
                            )}
                            title={`Status: ${vault.status}`}
                          />
                        )}
                      </div>
                    ) : (
                      <Hexagon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                    )}
                  </div>
                  
                  {!collapsed && (
                    <>
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-foreground">
                            {pairName}
                          </span>
                          {formattedTvl && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              ${formattedTvl}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                          <ChainIcon chainId={vault.chainId} className="w-3 h-3" />
                          {exchangeName && (
                            <>
                              <span>•</span>
                              <ExchangeIcon exchangeName={exchangeName} className="w-3 h-3" />
                              <span>{exchangeName}</span>
                            </>
                          )}
                          {feeTier && (
                            <>
                              {exchangeName && <span>•</span>}
                              <span>{feeTier}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      {isActive && <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />}
                    </>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
