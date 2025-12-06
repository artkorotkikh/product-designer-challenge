/**
 * VaultCard Component
 *
 * Displays a single vault with its metadata and raw API data
 * Shows loading and error states
 */

'use client'

import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RawDataDisplay } from '@/components/raw-data-display'
import { formatAddress, formatNumber } from '@/lib/utils'
import { Loader2, AlertCircle } from 'lucide-react'

interface VaultCardProps {
  vaultAddress: string
  chainId: number
  data?: any // Optional: pass data directly to avoid re-fetching
}

export function VaultCard({ vaultAddress, chainId, data: providedData }: VaultCardProps) {
  const [fetchedData, setFetchedData] = React.useState<any | null>(null)
  const [loading, setLoading] = React.useState(!providedData)
  const [error, setError] = React.useState<string | null>(null)

  const data = providedData || fetchedData

  React.useEffect(() => {
    if (providedData) {
      setLoading(false)
      return
    }

    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/vaults/${chainId}/${vaultAddress}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch vault data: ${response.statusText}`)
        }

        const vaultData = await response.json()
        setFetchedData(vaultData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [vaultAddress, chainId, providedData])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-arrakis-orange" />
            <p className="text-sm">Loading vault data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-900">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2 text-red-400">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm font-medium">Failed to load vault</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  const token0 = data.data?.tokens?.token0
  const token1 = data.data?.tokens?.token1
  const volume30d = data.summary?.volume30d?.usdValue
  const fees30d = data.summary?.fees30d?.usdValue

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">
              {data.tokenPair || 'Vault'}
            </CardTitle>
            <CardDescription className="mt-1">
              {formatAddress(data.vaultId)}
            </CardDescription>
          </div>
          <Badge variant="secondary">{data.data?.general?.chain || `Chain ${chainId}`}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* Token Pair */}
          {token0 && token1 && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Token Pair</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{token0.symbol}</Badge>
                <span className="text-muted-foreground">/</span>
                <Badge variant="outline">{token1.symbol}</Badge>
              </div>
            </div>
          )}

          {/* Pool Info */}
          {data.data?.pool && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pool</p>
              <p className="text-sm font-medium">{data.data.pool.name}</p>
              <p className="text-xs text-muted-foreground">Fee: {data.data.pool.feeTier}%</p>
            </div>
          )}

          {/* 30d Volume */}
          {volume30d && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                30d Volume
              </p>
              <p className="text-lg font-semibold text-arrakis-blue">
                ${formatNumber(volume30d, 0)}
              </p>
            </div>
          )}

          {/* 30d Fees */}
          {fees30d && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                30d Fees Earned
              </p>
              <p className="text-lg font-semibold text-arrakis-orange">
                ${formatNumber(fees30d, 2)}
              </p>
            </div>
          )}

          {/* Raw Data Display */}
          <RawDataDisplay data={data} defaultExpanded={false} />
        </div>
      </CardContent>
    </Card>
  )
}
