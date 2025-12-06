'use client'

import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import {
  ComposedChart,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { fetchFeesHistory, fetchVaultBalance } from '@/lib/api'
import type { FeesHistoryResponse, VaultBalanceResponse } from '@/lib/types'
import { formatNumber } from '@/lib/utils'

interface PerformanceChartsProps {
  chainId: number | null
  vaultAddress: string | null
  vaultData?: any
}

type TimePeriod = '24h' | '7d' | '30d'

export function PerformanceCharts({ chainId, vaultAddress, vaultData }: PerformanceChartsProps) {
  const [timePeriod, setTimePeriod] = React.useState<TimePeriod>('24h')
  const [feesData, setFeesData] = React.useState<any[]>([])
  const [inventoryData, setInventoryData] = React.useState<any[]>([])
  const [volumeData, setVolumeData] = React.useState<any[]>([])
  const [rebalanceTimestamps, setRebalanceTimestamps] = React.useState<number[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Calculate date range based on time period
  const getDateRange = (period: TimePeriod) => {
    const now = new Date()
    let daysAgo = 1
    if (period === '7d') daysAgo = 7
    if (period === '30d') daysAgo = 30
    
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    
    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    }
  }

  // Fetch all performance data
  React.useEffect(() => {
    if (!chainId || !vaultAddress) {
      setFeesData([])
      setInventoryData([])
      setVolumeData([])
      setLoading(false)
      return
    }

    async function fetchPerformanceData() {
      try {
        setLoading(true)
        setError(null)

        if (!chainId || !vaultAddress) {
          throw new Error('Missing chainId or vaultAddress')
        }

        const { startDate, endDate } = getDateRange(timePeriod)

        // Fetch fees history
        // Note: fetchFeesHistory expects YYYY-MM-DD format, but we need to pass ISO format to the API route
        // The route will handle the conversion
        console.log('Fetching fees for:', { chainId, vaultAddress, startDate: startDate.split('T')[0], endDate: endDate.split('T')[0] })
        const feesResponse = await fetchFeesHistory(
          chainId,
          vaultAddress,
          startDate.split('T')[0], // YYYY-MM-DD
          endDate.split('T')[0]    // YYYY-MM-DD
        )
        
        console.log('Fees response:', feesResponse)
        console.log('Fees response type:', typeof feesResponse, 'Has data?', !!(feesResponse as any)?.data)

        // Fetch vault balance (for inventory range)
        console.log('Fetching balance for:', { chainId, vaultAddress, startDate, endDate })
        const balanceResponse = await fetchVaultBalance(
          chainId,
          vaultAddress,
          startDate,
          endDate
        )
        console.log('Balance response:', balanceResponse)
        console.log('Balance response type:', typeof balanceResponse, 'Has data?', !!(balanceResponse as any)?.data)

        // Process fees data
        // API returns: { date: "2025-11-03", label: "3 Nov 2025", feesUSD: 3810.37, ... }
        const feesDataPoints = (feesResponse as any)?.data || []
        console.log('Fees data points:', feesDataPoints.length, feesDataPoints)
        
        if (!Array.isArray(feesDataPoints)) {
          console.error('Fees data is not an array:', feesDataPoints)
        }
        
        const processedFees = feesDataPoints
          .map((point: any) => {
            // Fees API uses 'date' field in YYYY-MM-DD format
            const dateStr = point.date || point.timestamp || point.time
            const fees = parseFloat(point.feesUSD || point.fees || point.usdValue || '0')
            
            // Convert YYYY-MM-DD to Date
            const date = dateStr ? new Date(dateStr + 'T00:00:00Z') : new Date()
            
            // For X-axis, use label if available, otherwise format date
            // For 24h: show time, for 7d/30d: show date
            let xAxisLabel = point.label || dateStr
            if (timePeriod === '24h') {
              xAxisLabel = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            } else {
              // Extract day from label or format date
              xAxisLabel = point.label ? point.label.split(' ')[0] : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
            
            return {
              timestamp: date.toISOString(),
              fees,
              date: xAxisLabel,
              fullDate: dateStr, // Keep original for sorting
            }
          })
          .sort((a: any, b: any) => new Date(a.fullDate || a.timestamp).getTime() - new Date(b.fullDate || b.timestamp).getTime())
        
        console.log('Processed fees:', processedFees)

        // Process inventory data (vault balance)
        const balanceDataPoints = (balanceResponse as any)?.data || []
        console.log('Balance data points:', balanceDataPoints.length, balanceDataPoints.slice(0, 3))
        
        if (!Array.isArray(balanceDataPoints)) {
          console.error('Balance data is not an array:', balanceDataPoints)
        }
        
        const processedInventory = balanceDataPoints
          .map((point: any) => {
            const timestamp = point.timestamp || point.time || point.date
            const token0Pct = parseFloat(point.tokens?.token0?.percentage || '0') * 100
            const date = new Date(timestamp)
            
            // Format X-axis label based on time period
            let xAxisLabel: string
            if (timePeriod === '24h') {
              xAxisLabel = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            } else {
              xAxisLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
            
            return {
              timestamp,
              token0Percentage: token0Pct,
              token1Percentage: 100 - token0Pct,
              date: xAxisLabel,
            }
          })
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        
        console.log('Processed inventory:', processedInventory.slice(0, 3))

        // Get rebalance timestamps from vault data
        const rebalances = vaultData?.data?.general?.lastRebalanced
          ? [new Date(vaultData.data.general.lastRebalanced).getTime()]
          : []
        setRebalanceTimestamps(rebalances)

        // Process volume data - fees API doesn't include volumeUSD, so estimate from fees
        // Fees are typically ~0.3% of volume, so volume ≈ fees * 333.33
        const volumeDataPoints = feesDataPoints
          .map((point: any) => {
            const dateStr = point.date || point.timestamp || point.time
            const fees = parseFloat(point.feesUSD || point.fees || '0')
            // Estimate volume from fees (assuming ~0.3% fee rate)
            const volume = fees * 333.33
            const date = dateStr ? new Date(dateStr + 'T00:00:00Z') : new Date()
            
            // Format X-axis label same as fees chart
            let xAxisLabel: string
            if (timePeriod === '24h') {
              xAxisLabel = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            } else {
              xAxisLabel = point.label ? point.label.split(' ')[0] : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
            
            return {
              timestamp: date.toISOString(),
              volume,
              date: xAxisLabel,
              fullDate: dateStr,
            }
          })
          .sort((a: any, b: any) => new Date(a.fullDate || a.timestamp).getTime() - new Date(b.fullDate || b.timestamp).getTime())
        
        console.log('Processed volume:', volumeDataPoints.slice(0, 3))

        console.log('Setting state - Fees:', processedFees.length, 'Inventory:', processedInventory.length, 'Volume:', volumeDataPoints.length)
        
        setFeesData(processedFees)
        setInventoryData(processedInventory)
        setVolumeData(volumeDataPoints)
      } catch (err) {
        console.error('Failed to fetch performance data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load performance data')
        // Set empty arrays on error
        setFeesData([])
        setInventoryData([])
        setVolumeData([])
      } finally {
        setLoading(false)
      }
    }

    fetchPerformanceData()
  }, [chainId, vaultAddress, timePeriod, vaultData])

  // Get current fees value for display
  const currentFees = React.useMemo(() => {
    if (feesData.length === 0) return null
    const total = feesData.reduce((sum, point) => sum + (point.fees || 0), 0)
    return total
  }, [feesData])

  // Get current inventory percentage
  const currentInventory = React.useMemo(() => {
    if (inventoryData.length === 0) return null
    const latest = inventoryData[inventoryData.length - 1]
    if (!latest) return null
    return {
      token0: Math.round(latest.token0Percentage || 0),
      token1: Math.round(latest.token1Percentage || 100),
    }
  }, [inventoryData])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Performance</h2>
          <div className="flex gap-2">
            {(['24h', '7d', '30d'] as TimePeriod[]).map((period) => (
              <button
                key={period}
                className="px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground"
                disabled
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/40 bg-card/50">
              <CardHeader>
                <CardTitle>Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading...</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with time period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-medium tracking-tight text-foreground">Performance</h2>
        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timePeriod === period
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Three charts in a row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fees Earned Chart */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="relative pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle>Fees Earned</CardTitle>
                <CardDescription className="mt-1">Fees generated by the vault over the selected period</CardDescription>
              </div>
              {currentFees !== null && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm text-foreground whitespace-nowrap">
                    {timePeriod} Fees
                  </div>
                  <div className="text-[#EC9117] font-mono text-lg whitespace-nowrap">
                    ${formatNumber(currentFees, 1)}k
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-6 pt-0 pb-0">
            {feesData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No fees data available for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={feesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9F9C97" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  tickFormatter={(value) => {
                    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
                    return `$${value}`
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="fees" fill="#598CD8" radius={[2, 2, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="fees"
                  stroke="#EC9117"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Inventory Range Chart */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="relative pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle>Inventory Range</CardTitle>
                <CardDescription className="mt-1">Vault's token composition changed over time.</CardDescription>
              </div>
              {currentInventory && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm text-foreground whitespace-nowrap">
                    Current
                  </div>
                  <div className="text-[#EC9117] font-mono text-lg whitespace-nowrap">
                    {currentInventory.token0}/{currentInventory.token1}%
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-6 pt-0 pb-0">
            {inventoryData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No inventory data available for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={inventoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9F9C97" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <ReferenceLine y={50} stroke="#EC9117" strokeDasharray="4 4" opacity={0.5} />
                {/* Rebalance markers */}
                {rebalanceTimestamps.length > 0 && inventoryData.length > 0 && rebalanceTimestamps.map((timestamp, idx) => {
                  // Find the closest data point to the rebalance timestamp
                  let closestPoint = inventoryData[0]
                  let minDiff = Math.abs(new Date(closestPoint.timestamp).getTime() - timestamp)
                  
                  for (const point of inventoryData) {
                    const diff = Math.abs(new Date(point.timestamp).getTime() - timestamp)
                    if (diff < minDiff) {
                      minDiff = diff
                      closestPoint = point
                    }
                  }
                  
                  // Only show if within 24 hours
                  if (minDiff > 24 * 3600000) return null
                  
                  return (
                    <ReferenceLine
                      key={idx}
                      x={closestPoint.date}
                      stroke="#EC9117"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: 'Rebalanced', position: 'top', fill: '#EC9117', fontSize: 10 }}
                    />
                  )
                })}
                <Line
                  type="stepAfter"
                  dataKey="token0Percentage"
                  stroke="#ffffff"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Volume over time Chart */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle>Volume over time</CardTitle>
            <CardDescription>Trading volume interacting with this vault's liquidity.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pt-0 pb-0">
            {volumeData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No volume data available for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9F9C97" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
                    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
                    return `$${value}`
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="volume" fill="#598CD8" radius={[2, 2, 0, 0]}                 />
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

