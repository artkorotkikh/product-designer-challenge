'use client'

/**
 * Liquidity Distribution Chart
 * 
 * This chart visualizes how liquidity is distributed across price ticks in a Uniswap v3/v4 vault.
 * 
 * WHAT IS A TICK?
 * - A tick is a discrete price point: price = 1.0001^tick
 * - Each tick is 0.01% (1 basis point) apart in price
 * - Liquidity providers deposit liquidity between a MIN and MAX tick
 * - The height of each bar shows how much liquidity exists at that price
 * 
 * WHY IT LOOKS LIKE A HISTOGRAM:
 * - Each bar = one tick/price point with liquidity
 * - Flat bars = even liquidity distribution (good for trading)
 * - Peaks = concentrated liquidity at specific prices
 * - Gaps = no liquidity (would cause high slippage)
 * 
 * The chart shows:
 * - Blue bars: Liquidity amount at each price
 * - Orange shaded area: Active liquidity range (MIN → MAX)
 * - Dashed orange lines: MIN and MAX price boundaries
 * - Solid orange line: Current market price
 */

import * as React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import type { LiquidityProfile } from '@/lib/types'
import { formatPriceFromTick } from '@/lib/utils'

interface LiquidityDistributionChartProps {
  data: LiquidityProfile | null
  loading?: boolean
}

/**
 * Custom label renderer for MIN/MAX labels
 * Recharts passes x, y, and value props to the label component
 * y is at the top of the chart area, so we position the label above it
 */
const createMinMaxLabel = (labelText: string) => {
  return ({ x, y }: { x?: number; y?: number }) => {
    if (!x || !y) {
      // Return empty group instead of null
      return <g />
    }
    
    // Position label above the chart area (in the top margin)
    // y is at the top of the chart area, so we position above it
    const labelY = y - 25
    
    return (
      <g>
        <rect
          x={x - 20}
          y={labelY}
          width={40}
          height={16}
          fill="rgba(236, 145, 23, 0.9)"
          rx={2}
        />
        <text
          x={x}
          y={labelY + 12}
          textAnchor="middle"
          fill="#fff"
          fontSize="10"
          fontWeight="600"
        >
          {labelText}
        </text>
      </g>
    )
  }
}

export function LiquidityDistributionChart({
  data,
  loading,
}: LiquidityDistributionChartProps) {
  const [chartData, setChartData] = React.useState<Array<{ tick: number; liquidity: number; price: number; inRange?: boolean }>>([])
  const [currentTick, setCurrentTick] = React.useState<number>(0)
  const [currentPrice, setCurrentPrice] = React.useState<number>(0)
  const [minTick, setMinTick] = React.useState<number>(0)
  const [maxTick, setMaxTick] = React.useState<number>(0)
  const [processing, setProcessing] = React.useState(false)

  React.useEffect(() => {
    if (!data) {
      setChartData([])
      setProcessing(false)
      return
    }

    // Set processing state immediately to show loading
    setProcessing(true)
    
    // Process data
    // Debug: log the data structure
    console.log('Liquidity data received:', data)

      // Handle different possible response structures
    // The API might return data directly or nested in a 'data' property
    const responseData = (data as any).data || data
    const rootData = data as any // Keep reference to root data object
    
    // Try to find ticks in various possible locations
    let ticks = responseData.ticks || responseData.liquidityTicks || responseData.profile?.ticks
    
    // If ticks is not an array, check if it's stored as numeric keys (sparse array-like object)
    if (!ticks || !Array.isArray(ticks)) {
      // Check both responseData and rootData for numeric keys
      // (numeric keys might be on the root object, not nested)
      const numericKeysResponse = Object.keys(responseData).filter(key => /^\d+$/.test(key))
      const numericKeysRoot = Object.keys(rootData).filter(key => /^\d+$/.test(key))
      const numericKeys = numericKeysRoot.length > 0 ? numericKeysRoot : numericKeysResponse
      const sourceObject = numericKeysRoot.length > 0 ? rootData : responseData
      
      console.log(`Found ${numericKeys.length} numeric keys (${numericKeysRoot.length} in root, ${numericKeysResponse.length} in responseData)`)
      
      if (numericKeys.length > 0) {
        // Convert numeric keys to array of tick objects
        // Sort keys numerically to maintain order
        const sortedKeys = numericKeys.sort((a, b) => parseInt(a) - parseInt(b))
        ticks = sortedKeys.map(key => sourceObject[key]).filter(item => item != null)
        console.log(`Extracted ${ticks.length} tick objects from numeric keys`)
        
        // If we have too many ticks, sample them intelligently
        const MAX_TICKS = 1500 // Limit to 1500 ticks for performance
        if (ticks.length > MAX_TICKS) {
          console.log(`Sampling ${ticks.length} ticks down to ${MAX_TICKS} for performance`)
          
          // First, filter out ticks with zero liquidity
          const ticksWithLiquidity: Array<{ tick: any; liquidity: number; index: number }> = []
          for (let i = 0; i < ticks.length; i++) {
            const tick = ticks[i]
            const liquidity = parseFloat(String(tick.liquidity ?? tick.liquidityGross ?? tick.gross ?? '0'))
            if (liquidity > 0) {
              ticksWithLiquidity.push({ tick, liquidity, index: i })
            }
          }
          
          // If still too many, use intelligent sampling
          if (ticksWithLiquidity.length > MAX_TICKS) {
            // Sort by liquidity (descending) to prioritize high-liquidity ticks
            ticksWithLiquidity.sort((a, b) => b.liquidity - a.liquidity)
            
            // Take top 30% by liquidity (most important ticks)
            const topLiquidityCount = Math.floor(MAX_TICKS * 0.3)
            const topTicks = ticksWithLiquidity.slice(0, topLiquidityCount)
            
            // For the remaining 70%, sample evenly across the full range
            const remainingCount = MAX_TICKS - topLiquidityCount
            
            // Sort all ticks back by original index
            ticksWithLiquidity.sort((a, b) => a.index - b.index)
            
            const step = Math.max(1, Math.floor(ticksWithLiquidity.length / remainingCount))
            const sampledTicks: Array<{ tick: any; liquidity: number; index: number }> = []
            
            // Always include first and last
            if (ticksWithLiquidity.length > 0) {
              sampledTicks.push(ticksWithLiquidity[0])
            }
            
            // Sample middle ticks evenly, avoiding duplicates with top ticks
            const topIndices = new Set(topTicks.map(t => t.index))
            for (let i = step; i < ticksWithLiquidity.length - 1 && sampledTicks.length < remainingCount - 1; i += step) {
              if (!topIndices.has(ticksWithLiquidity[i].index)) {
                sampledTicks.push(ticksWithLiquidity[i])
              }
            }
            
            // Always include last if not already included
            if (ticksWithLiquidity.length > 1) {
              const lastTick = ticksWithLiquidity[ticksWithLiquidity.length - 1]
              if (!topIndices.has(lastTick.index)) {
                const alreadyIncluded = sampledTicks.some(t => t.index === lastTick.index)
                if (!alreadyIncluded) {
                  sampledTicks.push(lastTick)
                }
              }
            }
            
            // Combine and sort by original index
            const combined = [...topTicks, ...sampledTicks]
            combined.sort((a, b) => a.index - b.index)
            
            // Extract just the tick objects
            ticks = combined.slice(0, MAX_TICKS).map(item => item.tick)
            console.log(`Intelligently sampled down to ${ticks.length} ticks (prioritizing high liquidity)`)
          } else {
            ticks = ticksWithLiquidity.map(item => item.tick)
            console.log(`Filtered to ${ticks.length} ticks with liquidity`)
          }
        }
        
        // Log first tick to see structure
        if (ticks.length > 0) {
          console.log('Sample tick structure:', ticks[0])
          console.log('Sample tick keys:', Object.keys(ticks[0]))
        } else {
          console.warn('Numeric keys found but values are null/undefined. Sample value:', sourceObject[numericKeys[0]])
        }
      } else {
        console.warn('No ticks found in liquidity data. Available keys in root:', Object.keys(rootData).slice(0, 20))
        console.warn('Available keys in responseData:', Object.keys(responseData).slice(0, 20))
        setChartData([])
        setProcessing(false)
        return
      }
    }
    
    if (!ticks || ticks.length === 0) {
      console.warn('No ticks found after processing')
      setChartData([])
      setProcessing(false)
      return
    }

    // Process ticks data - handle different field name variations
    // Based on the API response, ticks have: { relativePct, liquidity }
    // We need to calculate the actual tick index and price from relativePct and currentTick
    const currentTickValue = responseData.currentTick ?? rootData.currentTick ?? 0
    const currentPriceValue = parseFloat(String(responseData.currentPrice ?? rootData.currentPrice ?? '0'))
    
    // Pre-calculate constants for performance
    const logBase = Math.log(1.0001)
    const ticksCenter = Math.floor(ticks.length / 2)
    
    // Process ticks efficiently
    const processed: Array<{ tick: number; liquidity: number; price: number; relativePct?: number }> = []
    
    for (let i = 0; i < ticks.length; i++) {
      const tick = ticks[i]
      let tickIndex: number
      let price: number
      
      // If tick has tickIndex, use it directly
      if (tick.tickIndex !== undefined) {
        tickIndex = Number(tick.tickIndex)
        price = parseFloat(String(tick.price0 ?? tick.price ?? tick.price0Value ?? '0'))
      } else if (tick.relativePct !== undefined && currentTickValue !== 0 && currentPriceValue > 0) {
        // Calculate tick index from relativePct
        // relativePct is percentage relative to current price
        const relativePct = parseFloat(String(tick.relativePct))
        const priceMultiplier = 1 + (relativePct / 100)
        const targetPrice = currentPriceValue * priceMultiplier
        
        // Calculate tick from price: tick = log(price) / log(1.0001)
        tickIndex = Math.round(Math.log(targetPrice) / logBase)
        price = targetPrice
      } else {
        // Fallback: use array index as tick offset
        tickIndex = currentTickValue + (i - ticksCenter) * 10
        price = Math.pow(1.0001, tickIndex)
      }
      
      const liquidity = parseFloat(String(tick.liquidity ?? tick.liquidityGross ?? tick.gross ?? '0'))
      
      // Only include valid ticks with liquidity
      if (!isNaN(tickIndex) && liquidity > 0) {
        processed.push({
          tick: tickIndex,
          liquidity: liquidity,
          price: price || 0,
          relativePct: tick.relativePct,
        })
      }
    }
    
    // Sort by tick index
    processed.sort((a, b) => a.tick - b.tick)

    if (processed.length === 0) {
      console.warn('No valid ticks after processing')
      setChartData([])
      setProcessing(false)
      return
    }

    setChartData(processed)

    // Set current tick and price - use the values we already extracted
    if (currentTickValue !== undefined && currentTickValue !== null && currentTickValue !== 0) {
      setCurrentTick(Number(currentTickValue))
    }
    if (currentPriceValue !== undefined && currentPriceValue !== null && currentPriceValue > 0) {
      setCurrentPrice(currentPriceValue)
    }

    // Calculate min/max ticks from active liquidity range
    // Find the range where most liquidity is concentrated
    if (processed.length > 0) {
      // Find ticks with significant liquidity (above threshold)
      // Use reduce for better performance with large arrays
      let maxLiquidity = 0
      for (let i = 0; i < processed.length; i++) {
        if (processed[i].liquidity > maxLiquidity) {
          maxLiquidity = processed[i].liquidity
        }
      }
      
      const threshold = maxLiquidity * 0.1 // 10% of max liquidity
      
      // Find first and last ticks with significant liquidity
      let firstActiveTick: number | null = null
      let lastActiveTick: number | null = null
      
      for (let i = 0; i < processed.length; i++) {
        if (processed[i].liquidity >= threshold) {
          if (firstActiveTick === null) {
            firstActiveTick = processed[i].tick
          }
          lastActiveTick = processed[i].tick
        }
      }
      
      if (firstActiveTick !== null && lastActiveTick !== null && firstActiveTick !== lastActiveTick) {
        setMinTick(firstActiveTick)
        setMaxTick(lastActiveTick)
      } else {
        // Fallback: use range around current price or all data
        if (currentTickValue !== 0 && currentPriceValue > 0) {
          // Show range around current price: ±40% price range
          const priceRange = currentPriceValue * 0.4
          const minPrice = Math.max(currentPriceValue - priceRange, 0.0001)
          const maxPrice = currentPriceValue + priceRange
          const logBase = Math.log(1.0001)
          const calculatedMin = Math.round(Math.log(minPrice) / logBase)
          const calculatedMax = Math.round(Math.log(maxPrice) / logBase)
          setMinTick(calculatedMin)
          setMaxTick(calculatedMax)
          console.log('Using calculated range:', { calculatedMin, calculatedMax, currentTickValue, currentPriceValue })
        } else if (processed.length > 0) {
          // Use first and last tick from processed data
          const firstTick = processed[0].tick
          const lastTick = processed[processed.length - 1].tick
          setMinTick(firstTick)
          setMaxTick(lastTick)
          console.log('Using data range:', { firstTick, lastTick, dataLength: processed.length })
        } else {
          // No data, reset
          setMinTick(0)
          setMaxTick(0)
        }
      }
    }
    
    // Mark processing as complete
    setProcessing(false)
  }, [data])

  // Memoize visible data calculation to avoid recalculating on every render
  // Must be called before any conditional returns (Rules of Hooks)
  // This shows ALL available data, with MIN/MAX range clearly marked
  const visibleData = React.useMemo(() => {
    if (chartData.length === 0) return []
    
    // Show ALL available data, but mark which ticks are inside vs outside the active range
    // This gives full context of liquidity distribution beyond the MIN/MAX range
    if (minTick !== 0 && maxTick !== 0 && minTick !== maxTick) {
      // Mark all data points with inRange flag - show everything, not just near the range
      const result: Array<typeof chartData[0] & { inRange: boolean }> = []
      for (let i = 0; i < chartData.length; i++) {
        const d = chartData[i]
        result.push({
          ...d,
          inRange: d.tick >= minTick && d.tick <= maxTick
        })
      }
      
      // If we have too much data, we still need to sample for performance
      // But we'll sample intelligently to preserve both in-range and out-of-range data
      if (result.length > 2000) {
        // Separate in-range and out-of-range data
        const inRangeData = result.filter(d => d.inRange)
        const outOfRangeData = result.filter(d => !d.inRange)
        
        // Keep all in-range data (it's important)
        // Sample out-of-range data if needed
        let sampled: Array<typeof chartData[0] & { inRange: boolean }> = [...inRangeData]
        
        if (outOfRangeData.length > 0) {
          const remainingSlots = 2000 - inRangeData.length
          if (remainingSlots > 0 && outOfRangeData.length > remainingSlots) {
            // Sample out-of-range data evenly
            const step = Math.ceil(outOfRangeData.length / remainingSlots)
            for (let i = 0; i < outOfRangeData.length; i += step) {
              sampled.push(outOfRangeData[i])
            }
            // Always include first and last out-of-range ticks
            if (outOfRangeData.length > 0 && !sampled.includes(outOfRangeData[0])) {
              sampled.push(outOfRangeData[0])
            }
            if (outOfRangeData.length > 1 && !sampled.includes(outOfRangeData[outOfRangeData.length - 1])) {
              sampled.push(outOfRangeData[outOfRangeData.length - 1])
            }
          } else {
            sampled = [...sampled, ...outOfRangeData]
          }
        }
        
        // Sort by tick to maintain order
        sampled.sort((a, b) => a.tick - b.tick)
        return sampled.slice(0, 2000)
      }
      
      return result
    }
    
    // Otherwise, show data around current price (±50% price range)
    if (currentTick !== 0 && chartData.length > 0) {
      // Find current price from data
      let currentPrice = 0
      for (let i = 0; i < chartData.length; i++) {
        if (Math.abs(chartData[i].tick - currentTick) < 100) {
          currentPrice = chartData[i].price
          break
        }
      }
      
      if (currentPrice > 0) {
        const priceRange = currentPrice * 0.5 // ±50%
        const minPrice = Math.max(currentPrice - priceRange, 0.0001)
        const maxPrice = currentPrice + priceRange
        
        const result: Array<typeof chartData[0] & { inRange: boolean }> = []
        for (let i = 0; i < chartData.length; i++) {
          const d = chartData[i]
          if (d.price >= minPrice && d.price <= maxPrice) {
            result.push({
              ...d,
              inRange: minTick !== 0 && maxTick !== 0 ? d.tick >= minTick && d.tick <= maxTick : true
            })
          }
        }
        return result
      }
    }
    
    // Fallback: show all data (but limit to reasonable size for performance)
    // Mark all as in range if we don't have min/max
    if (chartData.length > 500) {
      // Sample data if too large
      const step = Math.ceil(chartData.length / 500)
      const result: Array<typeof chartData[0] & { inRange: boolean }> = []
      for (let i = 0; i < chartData.length; i += step) {
        result.push({
          ...chartData[i],
          inRange: minTick !== 0 && maxTick !== 0 
            ? chartData[i].tick >= minTick && chartData[i].tick <= maxTick 
            : true
        })
      }
      return result
    }
    
    // Mark all data points with inRange flag
    return chartData.map(d => ({
      ...d,
      inRange: minTick !== 0 && maxTick !== 0 ? d.tick >= minTick && d.tick <= maxTick : true
    }))
  }, [chartData, minTick, maxTick, currentTick])

  // Show loading state during API fetch or data processing
  if (loading || processing) {
    return (
      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle>Liquidity Distribution</CardTitle>
          <CardDescription>Liquidity concentration across the vault's price range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex flex-col items-center justify-center gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 border-2 border-arrakis-orange/20 border-t-arrakis-orange rounded-full animate-spin" />
            </div>
            <div className="text-sm text-muted-foreground">
              {loading ? 'Loading data...' : 'Processing chart data...'}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle>Liquidity Distribution</CardTitle>
          <CardDescription>Liquidity concentration across the vault's price range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">No liquidity data available</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle>Liquidity Distribution</CardTitle>
          <CardDescription>Liquidity concentration across the vault's price range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex flex-col items-center justify-center gap-2">
            <div className="text-muted-foreground">No liquidity data available</div>
            <div className="text-xs text-muted-foreground/50">
              Check console for API response details
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const isInRange = data.inRange !== false && minTick !== 0 && maxTick !== 0
        ? data.tick >= minTick && data.tick <= maxTick
        : data.inRange !== false
      
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">
            Price: {formatPriceFromTick(data.price)}
          </p>
          <p className="text-xs text-muted-foreground">
            Tick: {data.tick}
          </p>
          <p className="text-xs text-muted-foreground">
            Liquidity: {data.liquidity.toLocaleString()}
          </p>
          {minTick !== 0 && maxTick !== 0 && (
            <p className={`text-xs mt-1 ${isInRange ? 'text-arrakis-orange' : 'text-muted-foreground'}`}>
              {isInRange ? '✓ Inside active range' : 'Outside active range'}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <Card className="border-border/40 bg-card/50">
      <CardHeader>
        <CardTitle>Liquidity Distribution</CardTitle>
        <CardDescription>Liquidity concentration across the vault's price range</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={visibleData.length > 0 ? visibleData : chartData}
            margin={{ top: 24, right: 20, bottom: 20, left: 5 }}
            barCategoryGap={0}
            barGap={0}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#9F9C97" opacity={0.2} />
            
            {/* X-Axis with price formatting */}
            <XAxis
              dataKey="tick"
              tickFormatter={(tick) => {
                // Use all chartData for lookup, not just visibleData
                const dataPoint = chartData.find((d) => d.tick === tick)
                return dataPoint ? formatPriceFromTick(dataPoint.price) : ''
              }}
              stroke="#9F9C97"
              fontSize={12}
              tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
              interval="preserveStartEnd"
              tickCount={4}
            />
            
            {/* Y-Axis */}
            <YAxis
              stroke="#9F9C97"
              fontSize={12}
              tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
              width={50}
              tickFormatter={(value) => {
                if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
                if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`
                return value.toString()
              }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* Render bars first (behind) */}
            {/* Use different colors to distinguish inside vs outside the active range */}
            <Bar
              dataKey="liquidity"
              fill="#598CD8"
              isAnimationActive={false}
              radius={[0, 0, 0, 0]}
            >
              {visibleData.map((entry, index) => {
                // Use brighter blue for bars inside the active range
                // Use muted/darker blue for bars outside the range
                const isInRange = (entry as any).inRange !== false
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isInRange ? "#598CD8" : "#3B5A8A"} // Brighter blue inside, darker blue outside
                    opacity={isInRange ? 1 : 0.6} // Slightly transparent for outside range
                  />
                )
              })}
            </Bar>
            
            {/* Active liquidity range (MIN → MAX) - render after bars but before lines */}
            {/* Always show if min/max are set, even if outside visible data range */}
            {minTick !== 0 && maxTick !== 0 && minTick !== maxTick && (
              <ReferenceArea
                x1={minTick}
                x2={maxTick}
                fill="rgba(236, 145, 23, 0.12)"
                stroke="none"
              />
            )}
            
            {/* Reference lines render on top (render last) */}
            {/* Current price line (solid orange) with price label */}
            {currentTick !== 0 && (
              <ReferenceLine
                x={currentTick}
                stroke="#EC9117"
                strokeWidth={2}
                label={({ x, y }) => {
                  if (!x || !y) return <g />
                  const priceText = currentPrice > 0 ? formatPriceFromTick(currentPrice) : 'Current'
                  // Calculate text width to adjust rect width
                  const textWidth = priceText.length * 6 + 10
                  return (
                    <g>
                      <rect
                        x={x - textWidth / 2}
                        y={y - 20}
                        width={textWidth}
                        height={16}
                        fill="rgba(236, 145, 23, 0.9)"
                        rx={2}
                      />
                      <text
                        x={x}
                        y={y - 8}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="10"
                        fontWeight="600"
                      >
                        {priceText}
                      </text>
                    </g>
                  )
                }}
              />
            )}
            
            {/* Min tick line (dashed orange) with label */}
            {minTick !== 0 && (
              <ReferenceLine
                x={minTick}
                stroke="#EC9117"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={createMinMaxLabel('MIN')}
              />
            )}
            
            {/* Max tick line (dashed orange) with label */}
            {maxTick !== 0 && (
              <ReferenceLine
                x={maxTick}
                stroke="#EC9117"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={createMinMaxLabel('MAX')}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

