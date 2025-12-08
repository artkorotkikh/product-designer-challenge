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
  ReferenceArea,
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
  const [timePeriod, setTimePeriod] = React.useState<TimePeriod>('30d')
  const [feesData, setFeesData] = React.useState<any[]>([])
  const [inventoryData, setInventoryData] = React.useState<any[]>([])
  const [volumeData, setVolumeData] = React.useState<any[]>([])
  const [rebalanceTimestamps, setRebalanceTimestamps] = React.useState<number[]>([])
  const [tokenSymbols, setTokenSymbols] = React.useState<{ token0: string; token1: string } | null>(null)
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
        
        console.log('Processed fees:', processedFees.length, 'items', processedFees)

        // Calculate moving average for fees data
        // Determine window size based on time period
        let maWindowSize = 3 // default for 24h
        if (timePeriod === '7d') {
          maWindowSize = 5
        } else if (timePeriod === '30d') {
          maWindowSize = 7 // MA7 for 30d as per instructions
        }
        
        const feesWithMA = processedFees.map((point: any, index: number) => {
          // Calculate moving average from previous points
          const startIndex = Math.max(0, index - maWindowSize + 1)
          const window = processedFees.slice(startIndex, index + 1)
          const sum = window.reduce((acc: number, p: any) => acc + (p.fees || 0), 0)
          const movingAverage = sum / window.length
          
          return {
            ...point,
            movingAverage: movingAverage,
          }
        })

        // Process inventory data (vault balance)
        const balanceDataPoints = (balanceResponse as any)?.data || []
        console.log('Balance data points:', balanceDataPoints.length, balanceDataPoints.slice(0, 3))
        
        if (!Array.isArray(balanceDataPoints)) {
          console.error('Balance data is not an array:', balanceDataPoints)
        }
        
        const processedInventory = balanceDataPoints
          .map((point: any) => {
            const timestamp = point.timestamp || point.time || point.date
            // Normalize percentage: API might return 0-1 or 0-100 range
            let rawPercentage = parseFloat(point.tokens?.token0?.percentage || '0')
            // If percentage > 1, it's already in 0-100 range, otherwise it's 0-1
            const token0Pct = rawPercentage > 1 
              ? Math.min(100, Math.max(0, rawPercentage)) 
              : Math.min(100, Math.max(0, rawPercentage * 100))
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
              rawData: point, // Keep raw data for tooltip
            }
          })
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        
        console.log('Processed inventory:', processedInventory.length, 'items', processedInventory.slice(0, 3))

        // Extract token symbols from balance response metadata or vault data
        const balanceMetadata = (balanceResponse as any)?.metadata
        const token0Symbol = balanceMetadata?.tokens?.token0?.symbol || vaultData?.data?.tokens?.token0?.symbol || 'Token0'
        const token1Symbol = balanceMetadata?.tokens?.token1?.symbol || vaultData?.data?.tokens?.token1?.symbol || 'Token1'
        setTokenSymbols({ token0: token0Symbol, token1: token1Symbol })

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
        
        console.log('Processed volume:', volumeDataPoints.length, 'items', volumeDataPoints.slice(0, 3))

        console.log('Setting state - Fees:', feesWithMA.length, 'Inventory:', processedInventory.length, 'Volume:', volumeDataPoints.length)
        
        setFeesData(feesWithMA)
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

  // Calculate cumulative fees up to a point
  const calculateCumulativeFees = React.useCallback((data: any[], upToTimestamp: string) => {
    return data
      .filter(point => new Date(point.timestamp || point.fullDate).getTime() <= new Date(upToTimestamp).getTime())
      .reduce((sum, point) => sum + (point.fees || 0), 0)
  }, [])


  // Get X-axis interval based on time period and data length
  const getXAxisInterval = React.useCallback((period: TimePeriod, dataLength: number) => {
    if (dataLength === 0) return 0
    if (period === '24h') {
      return Math.max(0, Math.floor(dataLength / 6)) // ~6 hourly ticks
    } else if (period === '7d') {
      return Math.max(0, Math.floor(dataLength / 7)) // daily
    } else {
      return Math.max(0, Math.floor(dataLength / 10)) // every 2-3 days
    }
  }, [])

  // Custom Tooltip for Fees Chart
  const FeesTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null
    
    const point = payload[0].payload
    const cumulativeFees = calculateCumulativeFees(feesData, point.timestamp)
    const totalFees = currentFees || 0
    const percentage = totalFees > 0 ? ((point.fees / totalFees) * 100).toFixed(1) : '0'
    
    // Format date as "Dec 1" (month and day)
    let tooltipDate = point.date || 'N/A'
    if (point.fullDate) {
      const date = new Date(point.fullDate + 'T00:00:00Z')
      tooltipDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else if (point.timestamp) {
      const date = new Date(point.timestamp)
      tooltipDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    
    // Format cumulative fees as "$35.37k"
    const formatCumulative = (value: number) => {
      if (value >= 1000) {
        return `$${(value / 1000).toFixed(2)}k`
      }
      return `$${formatNumber(value, 2)}`
    }
    
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">
          {tooltipDate}
        </p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Daily Fees: <span className="text-foreground font-mono">${formatNumber(point.fees, 2)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Contribution: <span className="text-foreground font-mono">{percentage}%</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Cumulative: <span className="text-foreground font-mono">{formatCumulative(cumulativeFees)}</span>
          </p>
        </div>
      </div>
    )
  }

  // Custom Tooltip for Inventory Chart
  const InventoryTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null
    
    const point = payload[0].payload
    const deviationValue = point.token0Percentage - 50
    const deviationAbs = Math.abs(deviationValue)
    const deviationFormatted = deviationValue.toFixed(1)
    const token0Symbol = tokenSymbols?.token0 || 'Token0'
    const token1Symbol = tokenSymbols?.token1 || 'Token1'
    
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">
          {point.date}
        </p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {token0Symbol}: <span className="text-foreground font-mono">{point.token0Percentage.toFixed(1)}%</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {token1Symbol}: <span className="text-foreground font-mono">{point.token1Percentage.toFixed(1)}%</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Deviation from 50/50: <span className={`font-mono ${deviationAbs > 10 ? 'text-orange-400' : 'text-foreground'}`}>
              {deviationValue > 0 ? '+' : ''}{deviationFormatted}%
            </span>
          </p>
          {deviationAbs > 10 && (
            <p className="text-xs text-orange-400 mt-1">
              ⚠ High drift detected
            </p>
          )}
        </div>
      </div>
    )
  }

  // Custom Tooltip for Volume Chart
  const VolumeTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null
    
    const point = payload[0].payload
    const volume = point.volume || 0
    const feeTier = 0.003 // 0.3% - typical fee tier
    const estimatedFees = volume * feeTier
    
    // Format date as "Dec 8" (month and day)
    let tooltipDate = point.date || 'N/A'
    if (point.fullDate) {
      const date = new Date(point.fullDate + 'T00:00:00Z')
      tooltipDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else if (point.timestamp) {
      const date = new Date(point.timestamp)
      tooltipDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    
    // Format volume as "$219k"
    const formatVolume = (value: number) => {
      if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}k`
      }
      return `$${formatNumber(value, 0)}`
    }
    
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">
          {tooltipDate}
        </p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Volume: <span className="text-foreground font-mono">{formatVolume(volume)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Fee tier: <span className="text-foreground font-mono">{(feeTier * 100).toFixed(2)}%</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Estimated fees: <span className="text-foreground font-mono">${formatNumber(estimatedFees, 2)}</span>
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-medium text-foreground">Performance</h2>
          <div className="flex gap-2 items-center">
            {(['30d', '7d', '24h'] as TimePeriod[]).map((period) => (
              <button
                key={period}
                className="px-3 py-1.5 text-sm rounded bg-[#2a2a2a] text-muted-foreground"
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
      <div className="flex items-center gap-6">
        <h2 className="text-2xl font-medium text-foreground">Performance</h2>
        <div className="flex gap-2 items-center">
          {(['30d', '7d', '24h'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                timePeriod === period
                  ? 'bg-[#2a2a2a] text-foreground'
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
          <CardContent className="px-0 pr-5 pt-0 pb-0">
            {feesData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No fees data available for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={feesData} barCategoryGap="10%" margin={{ left: 5, right: 5, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9F9C97" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  interval={getXAxisInterval(timePeriod, feesData.length)}
                />
                <YAxis
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  tickFormatter={(value) => {
                    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
                    return `$${value}`
                  }}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<FeesTooltip />} />
                <Bar 
                  dataKey="fees" 
                  fill="#005efe" 
                  radius={[2, 2, 0, 0]}
                  maxBarSize={40}
                />
                <Line
                  type="monotone"
                  dataKey="movingAverage"
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
                <CardDescription className="mt-1">Vault&apos;s token composition changed over time.</CardDescription>
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
          <CardContent className="px-0 pr-5 pt-0 pb-0">
            {inventoryData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No inventory data available for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={inventoryData} margin={{ left: 0, right: 5, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9F9C97" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  interval={getXAxisInterval(timePeriod, inventoryData.length)}
                />
                <YAxis
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<InventoryTooltip />} />
                {/* Drift zones - highlight risk areas */}
                <ReferenceArea y1={0} y2={40} fill="#ef4444" fillOpacity={0.03} />
                <ReferenceArea y1={60} y2={100} fill="#ef4444" fillOpacity={0.03} />
                <ReferenceArea y1={40} y2={60} fill="#22c55e" fillOpacity={0.05} />
                {/* Baseline - balanced inventory */}
                <ReferenceLine 
                  y={50} 
                  stroke="#EC9117" 
                  strokeDasharray="4 4" 
                  opacity={0.5}
                  label={{ 
                    value: "Balanced (50/50)", 
                    position: "right",
                    fill: "#EC9117",
                    fontSize: 9,
                    offset: 5
                  }}
                />
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
            <CardDescription>Trading volume interacting with this vault&apos;s liquidity.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pr-5 pt-0 pb-0">
            {volumeData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No volume data available for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeData} barCategoryGap="10%" margin={{ left: 0, right: 5, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9F9C97" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  stroke="#9F9C97"
                  fontSize={10}
                  tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
                  interval={getXAxisInterval(timePeriod, volumeData.length)}
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
                  domain={[0, 'auto']}
                />
                <Tooltip content={<VolumeTooltip />} />
                <Bar 
                  dataKey="volume" 
                  fill="#005efe" 
                  radius={[2, 2, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

