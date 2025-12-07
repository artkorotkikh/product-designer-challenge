'use client'

import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { fetchVaultDetails } from '@/lib/api'

interface PriceImpactTableProps {
  chainId: number | null
  vaultAddress: string | null
  vaultData?: any // Optional: if provided, will use this instead of fetching
}

interface PriceImpactRow {
  tradeSize: number
  buyImpact: number | null
  sellImpact: number | null
}

export function PriceImpactTable({ chainId, vaultAddress, vaultData }: PriceImpactTableProps) {
  const [data, setData] = React.useState<PriceImpactRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Trade sizes to fetch (in USD) - memoized to avoid dependency issues
  const tradeSizes = React.useMemo(() => [1000, 10000, 25000, 50000, 100000], [])

  React.useEffect(() => {
    // If vaultData is provided, use it directly
    if (vaultData) {
      const summary = vaultData.summary
      const priceImpact = summary?.priceImpact

      if (priceImpact && priceImpact.buy && priceImpact.sell) {
        const results: PriceImpactRow[] = tradeSizes.map((tradeSize) => {
          const tradeSizeKey = tradeSize.toString()
          const buyImpact = priceImpact.buy?.[tradeSizeKey] ?? null
          const sellImpact = priceImpact.sell?.[tradeSizeKey] ?? null

          return {
            tradeSize,
            buyImpact,
            sellImpact,
          }
        })
        setData(results)
        setLoading(false)
        return
      }
    }

    // Otherwise, fetch if we have chainId and vaultAddress
    if (!chainId || !vaultAddress) {
      setData([])
      setLoading(false)
      return
    }

    async function fetchAllPriceImpacts() {
      try {
        setLoading(true)
        setError(null)
        
        if (!chainId || !vaultAddress) {
          throw new Error('Missing chainId or vaultAddress')
        }
        
        // Fetch vault details - it contains summary.priceImpact with all trade sizes
        const response = await fetchVaultDetails(chainId, vaultAddress)

        // The API returns data in summary.priceImpact.buy and summary.priceImpact.sell
        // with trade sizes as keys and impact percentages as values
        const summary = (response as any).summary
        const priceImpact = summary?.priceImpact

        if (!priceImpact || !priceImpact.buy || !priceImpact.sell) {
          console.warn('No price impact data found in vault details')
          setData(tradeSizes.map(size => ({ tradeSize: size, buyImpact: null, sellImpact: null })))
          return
        }

        // Extract impacts for all trade sizes from the response
        const results: PriceImpactRow[] = tradeSizes.map((tradeSize) => {
          const tradeSizeKey = tradeSize.toString()
          const buyImpact = priceImpact.buy?.[tradeSizeKey] ?? null
          const sellImpact = priceImpact.sell?.[tradeSizeKey] ?? null

          return {
            tradeSize,
            buyImpact,
            sellImpact,
          }
        })

        setData(results)
      } catch (err) {
        console.error('Failed to fetch price impact data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load price impact data')
      } finally {
        setLoading(false)
      }
    }

    fetchAllPriceImpacts()
  }, [chainId, vaultAddress, vaultData, tradeSizes])

  // Get impact color based on magnitude
  const getImpactColor = (impact: number | null): { bg: string; text: string } => {
    if (impact === null) return { bg: 'bg-muted/20', text: 'text-muted-foreground' }
    
    const absImpact = Math.abs(impact)
    if (absImpact < 0.5) {
      // Low impact - green
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400' }
    } else if (absImpact < 1.5) {
      // Medium impact - yellow/orange
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' }
    } else {
      // High impact - red
      return { bg: 'bg-red-500/20', text: 'text-red-400' }
    }
  }

  // Format trade size
  const formatTradeSize = (size: number): string => {
    if (size >= 1000) {
      return `$${(size / 1000).toFixed(0)}k`
    }
    return `$${size}`
  }

  // Format impact percentage
  const formatImpact = (impact: number | null): string => {
    if (impact === null) return 'N/A'
    const sign = impact >= 0 ? '+' : ''
    return `${sign}${impact.toFixed(2)}%`
  }

  if (loading) {
    return (
      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle>Price Impact</CardTitle>
          <CardDescription>Impact on execution price for varying trade sizes</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">Loading price impact data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle>Price Impact</CardTitle>
          <CardDescription>Impact on execution price for varying trade sizes</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-destructive">{error}</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/40 bg-card/50">
      <CardHeader>
        <CardTitle>Price Impact</CardTitle>
        <CardDescription>Impact on execution price for varying trade sizes</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pt-0 pb-0">
        <div className="h-[300px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
              <tr className="border-b border-border/40">
                <th className="text-left py-2 pr-2 text-xs font-medium text-muted-foreground">
                  Trade Size
                </th>
                <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                  Buy Impact
                </th>
                <th className="text-right py-2 pl-2 text-xs font-medium text-muted-foreground">
                  Sell Impact
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const buyColor = getImpactColor(row.buyImpact)
                const sellColor = getImpactColor(row.sellImpact)
                
                return (
                  <tr key={row.tradeSize} className="border-b border-border/20 hover:bg-muted/5">
                    <td className="py-2 pr-2 font-mono text-xs">
                      {formatTradeSize(row.tradeSize)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${buyColor.bg} ${buyColor.text}`}
                      >
                        {formatImpact(row.buyImpact)}
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${sellColor.bg} ${sellColor.text}`}
                      >
                        {formatImpact(row.sellImpact)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

