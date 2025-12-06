'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { LayoutDashboard, PieChart, Settings, ChevronRight, Hexagon, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TEST_VAULTS, fetchVaultDetails } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { TokenIcon } from '@/components/token-icon'
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
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const searchParams = useSearchParams()
  const currentAddress = searchParams.get('address')
  const currentChainId = searchParams.get('chainId')
  const [vaultsWithMetadata, setVaultsWithMetadata] = useState<VaultWithMetadata[]>([])

  // Fetch vault metadata for all test vaults
  useEffect(() => {
    async function fetchAllVaults() {
      const vaultsData = TEST_VAULTS.map(vault => ({
        address: vault.address,
        chainId: vault.chainId,
        metadata: null as VaultMetadata | null,
        loading: true,
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
      })))
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
      <div className="flex-1 overflow-y-auto py-6 px-2 space-y-6">
        <div>
          {!collapsed && (
            <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Platform
            </h3>
          )}
          <nav className="space-y-1">
            <Link
              href="/"
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/50 rounded-md transition-colors",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Dashboard" : undefined}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Dashboard</span>}
            </Link>
            <button
              disabled
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Analytics" : undefined}
            >
              <PieChart className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Analytics</span>}
            </button>
            <button
              disabled
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Settings</span>}
            </button>
          </nav>
        </div>

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
              const token0 = vault.metadata?.token0 || (vault.metadata as any)?.data?.tokens?.token0
              const token1 = vault.metadata?.token1 || (vault.metadata as any)?.data?.tokens?.token1
              
              return (
                <Link
                  key={`${vault.chainId}-${vault.address}`}
                  href={`/?chainId=${vault.chainId}&address=${vault.address}`}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary border border-primary/20" 
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? (vault.metadata?.name || vault.address) : undefined}
                >
                  {/* Token Pair Icons */}
                  <div className="flex items-center shrink-0">
                    {vault.loading ? (
                      <div className="w-8 h-8 rounded-full bg-muted/50 animate-pulse" />
                    ) : token0 && token1 ? (
                      <div className="flex -space-x-2">
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
                      </div>
                    ) : (
                      <Hexagon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                    )}
                  </div>
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1 min-w-0">
                        {vault.metadata?.name || `${vault.address.slice(0, 6)}...${vault.address.slice(-4)}`}
                      </span>
                      {isActive && <ChevronRight className="w-3 h-3 opacity-50 ml-auto shrink-0" />}
                    </>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-border/40">
        <div className={cn("flex items-center gap-3 rounded-md", !collapsed && "px-2 py-2 bg-secondary/50")}>
          <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-arrakis-blue" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Demo User</p>
              <p className="text-xs text-muted-foreground truncate">Pro Plan</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
