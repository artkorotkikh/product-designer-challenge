'use client'

import * as React from 'react'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { Sidebar } from '@/components/sidebar'
import { VaultCard } from '@/components/vault-card'
import { TokenIcon } from '@/components/token-icon'
import { VaultStats } from '@/components/vault-stats'
import { LiquidityDistributionChart } from '@/components/liquidity-distribution-chart'
import { PriceImpactTable } from '@/components/price-impact-table'
import { TEST_VAULTS, fetchLiquidityProfile } from '@/lib/api'
import { UserMenu } from '@/components/user-menu'
import { ExternalLink, Copy, CheckCircle2, Hexagon, Globe, Layers, CircleDollarSign } from 'lucide-react'
import { cn, formatAddress } from '@/lib/utils'
import type { LiquidityProfile } from '@/lib/types'

// Simple Chain Info Helper
const getChainInfo = (chainId: number) => {
  switch (chainId) {
    case 1: return { name: 'Ethereum', color: 'text-indigo-400' }
    case 56: return { name: 'BSC', color: 'text-yellow-400' }
    case 8453: return { name: 'Base', color: 'text-blue-400' }
    case 137: return { name: 'Polygon', color: 'text-purple-400' }
    case 42161: return { name: 'Arbitrum', color: 'text-blue-500' }
    case 10: return { name: 'Optimism', color: 'text-red-500' }
    default: return { name: `Chain ${chainId}`, color: 'text-muted-foreground' }
  }
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const chainId = searchParams.get('chainId')
  const address = searchParams.get('address')

  const [collapsed, setCollapsed] = React.useState(true)
  const [copied, setCopied] = React.useState(false)
  
  // Vault Data State
  const [vaultData, setVaultData] = React.useState<any | null>(null)
  const [liquidityData, setLiquidityData] = React.useState<LiquidityProfile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [liquidityLoading, setLiquidityLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Handle default redirect - only run once
  React.useEffect(() => {
    if ((!chainId || !address) && TEST_VAULTS.length > 0) {
      const defaultVault = TEST_VAULTS[0]
      router.replace(`/?chainId=${defaultVault.chainId}&address=${defaultVault.address}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch Vault Data
  React.useEffect(() => {
    if (!chainId || !address) {
      setLoading(false)
      return
    }

    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/vaults/${chainId}/${address}`)
        if (response.ok) {
          const data = await response.json()
          setVaultData(data)
        } else {
          setError(`Failed to load vault data: ${response.statusText}`)
        }
      } catch (error) {
        console.error('Failed to fetch vault data', error)
        setError(error instanceof Error ? error.message : 'Failed to load vault data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [chainId, address])

  // Fetch Liquidity Data
  React.useEffect(() => {
    if (!chainId || !address) {
      setLiquidityData(null)
      return
    }

    async function fetchLiquidity() {
      try {
        setLiquidityLoading(true)
        console.log(`Fetching liquidity for chainId: ${chainId}, address: ${address}`)
        const data = await fetchLiquidityProfile(Number(chainId), address as string)
        console.log('Liquidity profile response:', data)
        setLiquidityData(data)
      } catch (error) {
        console.error('Failed to fetch liquidity data', error)
        // Log more details about the error
        if (error instanceof Error) {
          console.error('Error message:', error.message)
          console.error('Error stack:', error.stack)
        }
        setLiquidityData(null)
      } finally {
        setLiquidityLoading(false)
      }
    }

    fetchLiquidity()
  }, [chainId, address])

  // Helper to copy address
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!chainId || !address) {
    return null
  }

  const chainInfo = getChainInfo(Number(chainId))
  const token0 = vaultData?.data?.tokens?.token0
  const token1 = vaultData?.data?.tokens?.token1
  const feeTier = vaultData?.data?.pool?.feeTier
  const protocolName = vaultData?.data?.pool?.name || 'v4' // Fallback/Mock if missing

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <main 
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
      {/* Header */}
          <header className="flex h-20 items-center justify-between px-[72px] pt-8 pb-4 bg-background">
            <div className="flex items-center gap-6">
              {/* Token Pair Info */}
              {loading ? (
                <div className="h-8 w-48 bg-muted/50 animate-pulse rounded-md" />
              ) : (
                <div className="flex items-center gap-4">
                  {/* Token Icons */}
                  <div className="flex -space-x-2">
                    {token0 && (
                      <TokenIcon 
                        address={token0.address} 
                        chainId={Number(chainId)} 
                        symbol={token0.symbol} 
                        className="w-10 h-10 z-0"
                      />
                    )}
                    {token1 && (
                      <TokenIcon 
                        address={token1.address} 
                        chainId={Number(chainId)} 
                        symbol={token1.symbol} 
                        className="w-10 h-10 z-10"
                      />
                    )}
                  </div>

                  {/* Pair Name */}
                  <h1 className="text-2xl font-medium tracking-tight text-foreground">
                    {vaultData?.tokenPair || error || 'Loading...'}
                </h1>

                  {/* Metadata Separator */}
                  <div className="flex items-center gap-4 ml-2">
                    {/* Chain */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/30">
                      <Globe className={cn("w-3.5 h-3.5", chainInfo.color)} />
                      <span className="text-xs font-medium text-muted-foreground">
                        {chainInfo.name}
                      </span>
                    </div>

                    {/* Protocol Version */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/30">
                      <Layers className="w-3.5 h-3.5 text-pink-500" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {protocolName.includes('v3') ? 'v3' : 'v4'}
                      </span>
                    </div>

                    {/* Fee Tier - with vertical divider style */}
                    <div className="h-4 w-px bg-border/60" />
                    
                    <span className="text-xs font-mono text-muted-foreground">
                      {feeTier ? `${feeTier}%` : '0.05%'}
                    </span>
                  </div>
              </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <UserMenu />
        </div>
      </header>

      {/* Main Content */}
          <div className="px-[72px] py-6 space-y-8">
            
            {/* Stats Row */}
            <VaultStats data={vaultData} loading={loading} />

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
              <LiquidityDistributionChart 
                data={liquidityData} 
                loading={liquidityLoading}
              />
              <PriceImpactTable
                chainId={chainId ? Number(chainId) : null}
                vaultAddress={address}
                vaultData={vaultData}
              />
        </div>
          </div>
        </div>

        {/* Slim Sticky Footer */}
        <footer className="h-12 flex items-center justify-between px-[72px] border-t border-border/40 bg-background text-xs text-muted-foreground shrink-0 z-10">
          <div className="flex items-center gap-2">
             <Image
                src="/assets/icons/logo.svg"
                alt="Arrakis"
                width={80}
                height={16}
                className="h-4 w-auto opacity-70 hover:opacity-100 transition-opacity"
             />
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground transition-colors">About</a>
            <a href="#" className="hover:text-foreground transition-colors">Help</a>
            <span>@ 2025</span>
          </div>
        </footer>
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
