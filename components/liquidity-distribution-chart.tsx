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
  ComposedChart,
  Area,
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
  return (props: any) => {
    const { x, y, viewBox } = props
    console.log('MIN/MAX Label props:', { x, y, viewBox })
    
    if (x === undefined || y === undefined) {
      return <g />
    }
    
    // Use y coordinate from the line (which is at the top of chart area)
    // Position label in the middle - use viewBox if available, otherwise estimate
    let labelY: number
    if (viewBox && viewBox.height) {
      // y is at the top of chart area, so center is y + height/2
      labelY = y + (viewBox.height / 2) - 9
    } else {
      // Fallback: use y coordinate and estimate chart height (300px - margins)
      labelY = y + 130 // Approximately middle of 260px chart area
    }
    
    // Calculate text width to adjust rect width dynamically
    const textWidth = Math.max(60, labelText.length * 5.5 + 10)
    
    return (
      <g>
        <rect
          x={x - textWidth / 2}
          y={labelY}
          width={textWidth}
          height={18}
          fill="rgba(236, 145, 23, 0.95)"
          rx={3}
          stroke="rgba(236, 145, 23, 1)"
          strokeWidth={1}
        />
        <text
          x={x}
          y={labelY + 13}
          textAnchor="middle"
          fill="#fff"
          fontSize="11"
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
  const [chartData, setChartData] = React.useState<Array<{ relativePct: number; liquidity: number; price: number; inRange?: boolean }>>([])
  const [currentPrice, setCurrentPrice] = React.useState<number>(0)
  const [minRelativePct, setMinRelativePct] = React.useState<number | null>(null)
  const [maxRelativePct, setMaxRelativePct] = React.useState<number | null>(null)
  const [domainMin, setDomainMin] = React.useState<number | null>(null)
  const [domainMax, setDomainMax] = React.useState<number | null>(null)
  const [niceTicks, setNiceTicks] = React.useState<number[]>([])
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
    // API structure: { chainId, vaultId, currentPrice, currentTick, data: [{ relativePct, liquidity }, ...] }
    const rootData = data as any // Root object with chainId, vaultId, etc.
    const responseData = rootData.data || rootData // The data array or the root itself
    
    console.log('Root data keys:', Object.keys(rootData))
    if (Array.isArray(rootData.data)) {
      console.log('Data array length:', rootData.data.length)
      if (rootData.data.length > 0) {
        console.log('First data point:', rootData.data[0])
      }
    }
    
    // Try to find ticks in various possible locations
    // API returns: { data: [{ relativePct, liquidity }, ...] } or { ticks: [...] }
    // Check if responseData is already an array (the data array)
    let ticks: any[] | undefined
    if (Array.isArray(responseData)) {
      ticks = responseData
    } else if (Array.isArray(rootData.data)) {
      ticks = rootData.data
    } else {
      ticks = responseData.ticks || responseData.liquidityTicks || responseData.profile?.ticks
    }
    
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
    
    // Sample ticks if we have too many (for performance)
    // This applies to both array ticks and numeric key ticks
    // Use adaptive limit based on data size
    // Reduced limits significantly to ensure bars are visible (not too thin)
    // With numeric X-axis, Recharts BarChart needs fewer points for visible bars
    // Target: ~2-3px per bar minimum for visibility (chart width ~600px = max 200-300 bars)
    const getMaxTicks = (dataLength: number) => {
      if (dataLength > 20000) return 200 // Very large datasets: 200 points (~3px per bar)
      if (dataLength > 10000) return 250 // Large datasets: 250 points (~2.4px per bar)
      if (dataLength > 5000) return 300 // Medium-large: 300 points (~2px per bar)
      return 350 // Smaller datasets: 350 points (~1.7px per bar)
    }
    
    const MAX_TICKS = getMaxTicks(ticks.length)
    
    if (ticks.length > MAX_TICKS) {
      console.log(`Sampling ${ticks.length} ticks down to ${MAX_TICKS} for performance`)
      
      // First, sort by relativePct to ensure proper ordering
      const sortedTicks = [...ticks].sort((a: any, b: any) => {
        const aPct = parseFloat(String(a.relativePct ?? '0'))
        const bPct = parseFloat(String(b.relativePct ?? '0'))
        return aPct - bPct
      })
      
      // Separate ticks with liquidity from those without
      const ticksWithLiquidity: Array<{ tick: any; liquidity: number; index: number }> = []
      const ticksWithoutLiquidity: Array<{ tick: any; index: number }> = []
      
      for (let i = 0; i < sortedTicks.length; i++) {
        const tick = sortedTicks[i]
        const liquidity = parseFloat(String(tick.liquidity ?? tick.liquidityGross ?? tick.gross ?? '0'))
        if (liquidity > 0) {
          ticksWithLiquidity.push({ tick, liquidity, index: i })
        } else {
          ticksWithoutLiquidity.push({ tick, index: i })
        }
      }
      
      const sampled: any[] = []
      const sampledIndices = new Set<number>()
      
      // Strategy: Prioritize ticks with liquidity, but also sample evenly across the range
      // 1. Always include first and last (regardless of liquidity)
      if (sortedTicks.length > 0) {
        sampled.push(sortedTicks[0])
        sampledIndices.add(0)
      }
      if (sortedTicks.length > 1) {
        const lastIndex = sortedTicks.length - 1
        sampled.push(sortedTicks[lastIndex])
        sampledIndices.add(lastIndex)
      }
      
      // 2. Include 0% if it exists
      const zeroIndex = sortedTicks.findIndex((t: any) => {
        const pct = parseFloat(String(t.relativePct ?? '0'))
        return Math.abs(pct) < 0.01
      })
      if (zeroIndex >= 0 && !sampledIndices.has(zeroIndex)) {
        sampled.push(sortedTicks[zeroIndex])
        sampledIndices.add(zeroIndex)
      }
      
      // 3. Sample ticks with liquidity (prioritize higher liquidity)
      if (ticksWithLiquidity.length > 0) {
        // Sort by liquidity (descending) to prioritize high-liquidity areas
        const sortedByLiquidity = [...ticksWithLiquidity].sort((a, b) => b.liquidity - a.liquidity)
        
        // Take top liquidity ticks (up to 40% of max)
        const topLiquidityCount = Math.floor(MAX_TICKS * 0.4)
        for (let i = 0; i < Math.min(topLiquidityCount, sortedByLiquidity.length) && sampled.length < MAX_TICKS; i++) {
          const item = sortedByLiquidity[i]
          if (!sampledIndices.has(item.index)) {
            sampled.push(item.tick)
            sampledIndices.add(item.index)
          }
        }
        
        // Sample remaining liquidity ticks evenly across the range
        const remainingLiquiditySlots = Math.floor(MAX_TICKS * 0.3) - (sampled.length - 3) // Reserve space
        if (remainingLiquiditySlots > 0 && ticksWithLiquidity.length > 0) {
          // Sort back by index for even sampling
          ticksWithLiquidity.sort((a, b) => a.index - b.index)
          const step = Math.max(1, Math.floor(ticksWithLiquidity.length / remainingLiquiditySlots))
          for (let i = step; i < ticksWithLiquidity.length - 1 && sampled.length < MAX_TICKS - 1; i += step) {
            const item = ticksWithLiquidity[i]
            if (!sampledIndices.has(item.index)) {
              sampled.push(item.tick)
              sampledIndices.add(item.index)
            }
          }
        }
      }
      
      // 4. Fill remaining slots with evenly sampled ticks (including zero liquidity) to show full range
      const remainingSlots = MAX_TICKS - sampled.length
      if (remainingSlots > 0) {
        const step = Math.max(1, Math.floor(sortedTicks.length / remainingSlots))
        for (let i = step; i < sortedTicks.length - 1 && sampled.length < MAX_TICKS; i += step) {
          if (!sampledIndices.has(i)) {
            sampled.push(sortedTicks[i])
            sampledIndices.add(i)
          }
        }
      }
      
      // Sort by relativePct to maintain order
      sampled.sort((a: any, b: any) => {
        const aPct = parseFloat(String(a.relativePct ?? '0'))
        const bPct = parseFloat(String(b.relativePct ?? '0'))
        return aPct - bPct
      })
      
      ticks = sampled.slice(0, MAX_TICKS)
      console.log(`Sampled down to ${ticks.length} ticks (from ${ticksWithLiquidity.length} with liquidity, ${ticksWithoutLiquidity.length} without)`)
    }

    // Process ticks data - handle different field name variations
    // Based on the API response, ticks have: { relativePct, liquidity }
    // We need to calculate the actual tick index and price from relativePct and currentTick
    // currentPrice and currentTick are on the root object, not in the data array
    const currentTickValue = rootData.currentTick ?? 0
    const currentPriceValue = parseFloat(String(rootData.currentPrice ?? '0'))
    
    // Pre-calculate constants for performance
    const logBase = Math.log(1.0001)
    const ticksCenter = Math.floor(ticks.length / 2)
    
    // Process ticks efficiently - use relativePct as primary key
    const processed: Array<{ relativePct: number; liquidity: number; price: number }> = []
    
    for (let i = 0; i < ticks.length; i++) {
      const tick = ticks[i]
      let relativePct: number
      let price: number
      
      // Extract relativePct - this is our primary dimension
      if (tick.relativePct !== undefined) {
        relativePct = parseFloat(String(tick.relativePct))
      } else {
        // Skip if no relativePct (we need it for the chart)
        continue
      }
      
      // Calculate price from relativePct
      if (currentPriceValue > 0) {
        const priceMultiplier = 1 + (relativePct / 100)
        price = currentPriceValue * priceMultiplier
      } else if (tick.price0 !== undefined || tick.price !== undefined || tick.price0Value !== undefined) {
        price = parseFloat(String(tick.price0 ?? tick.price ?? tick.price0Value ?? '0'))
      } else {
        // Skip if we can't calculate price
        continue
      }
      
      const liquidity = parseFloat(String(tick.liquidity ?? tick.liquidityGross ?? tick.gross ?? '0'))
      
      // Include all ticks (even with 0 liquidity) for evenly spaced bars and complete range visualization
      if (!isNaN(relativePct) && !isNaN(price)) {
        processed.push({
          relativePct: relativePct,
          liquidity: liquidity,
          price: price || 0,
        })
      }
    }
    
    // Sort by relativePct
    processed.sort((a, b) => a.relativePct - b.relativePct)

    console.log(`Processed ${processed.length} ticks`)
    if (processed.length > 0) {
      console.log('First processed tick:', processed[0])
      console.log('Last processed tick:', processed[processed.length - 1])
      const ticksWithLiquidity = processed.filter(t => t.liquidity > 0)
      console.log(`Ticks with liquidity > 0: ${ticksWithLiquidity.length} out of ${processed.length}`)
    }

    if (processed.length === 0) {
      console.warn('No valid ticks after processing')
      console.warn('Ticks array:', ticks)
      console.warn('Current price:', currentPriceValue, 'Current tick:', currentTickValue)
      setChartData([])
      setProcessing(false)
      return
    }

    setChartData(processed)

    // Set current price
    if (currentPriceValue !== undefined && currentPriceValue !== null && currentPriceValue > 0) {
      setCurrentPrice(currentPriceValue)
    }

    // Calculate min/max relativePct from active liquidity range
    // Find the range where most liquidity is concentrated
    if (processed.length > 0) {
      // Find ticks with significant liquidity (above threshold)
      let maxLiquidity = 0
      for (let i = 0; i < processed.length; i++) {
        if (processed[i].liquidity > maxLiquidity) {
          maxLiquidity = processed[i].liquidity
        }
      }
      
      const threshold = maxLiquidity * 0.1 // 10% of max liquidity
      
      // Find first and last relativePct with significant liquidity
      let firstActiveRelativePct: number | null = null
      let lastActiveRelativePct: number | null = null
      
      for (let i = 0; i < processed.length; i++) {
        if (processed[i].liquidity >= threshold) {
          if (firstActiveRelativePct === null) {
            firstActiveRelativePct = processed[i].relativePct
          }
          lastActiveRelativePct = processed[i].relativePct
        }
      }
      
      if (firstActiveRelativePct !== null && lastActiveRelativePct !== null && firstActiveRelativePct !== lastActiveRelativePct) {
        setMinRelativePct(firstActiveRelativePct)
        setMaxRelativePct(lastActiveRelativePct)
        console.log('Set MIN/MAX from active range:', { firstActiveRelativePct, lastActiveRelativePct })
        } else if (processed.length > 0) {
        // Fallback: use first and last relativePct from processed data
        const firstRelativePct = processed[0].relativePct
        const lastRelativePct = processed[processed.length - 1].relativePct
        setMinRelativePct(firstRelativePct)
        setMaxRelativePct(lastRelativePct)
        console.log('Using data range:', { firstRelativePct, lastRelativePct, dataLength: processed.length })
        } else {
          // No data, reset
        setMinRelativePct(null)
        setMaxRelativePct(null)
      }
      
      // Calculate domain with padding and nice ticks
      if (processed.length > 0) {
        const dataMin = processed[0].relativePct
        const dataMax = processed[processed.length - 1].relativePct
        const range = dataMax - dataMin
        
        // Add 5% padding on each side (minimum 2% absolute padding)
        const padding = Math.max(range * 0.05, Math.max(Math.abs(dataMin), Math.abs(dataMax)) * 0.02, 2)
        let domainMinValue = dataMin - padding
        let domainMaxValue = dataMax + padding
        
        // Ensure 0% is centered visually if data spans both sides
        // If data is mostly negative, extend positive side; if mostly positive, extend negative side
        const absMin = Math.abs(domainMinValue)
        const absMax = Math.abs(domainMaxValue)
        const maxExtent = Math.max(absMin, absMax)
        
        // Center around 0% if data spans both sides, or extend to balance
        if (domainMinValue < 0 && domainMaxValue > 0) {
          // Data spans both sides - center at 0%
          domainMinValue = -maxExtent
          domainMaxValue = maxExtent
        } else if (domainMinValue >= 0) {
          // All positive - extend negative side to show 0%
          domainMinValue = Math.min(-maxExtent * 0.1, domainMinValue - padding)
        } else {
          // All negative - extend positive side to show 0%
          domainMaxValue = Math.max(maxExtent * 0.1, domainMaxValue + padding)
        }
        
        setDomainMin(domainMinValue)
        setDomainMax(domainMaxValue)
        console.log('Set domain:', { domainMinValue, domainMaxValue, dataMin, dataMax })
        
        // Generate nice ticks (every 20% or 10% depending on range)
        const tickRange = domainMaxValue - domainMinValue
        const tickInterval = tickRange > 100 ? 20 : 10 // Use 20% for large ranges, 10% for smaller
        
        // Start from a nice number below domainMin
        const startTick = Math.floor(domainMinValue / tickInterval) * tickInterval
        const endTick = Math.ceil(domainMaxValue / tickInterval) * tickInterval
        
        const ticks: number[] = []
        for (let tick = startTick; tick <= endTick; tick += tickInterval) {
          if (tick >= domainMinValue && tick <= domainMaxValue) {
            ticks.push(tick)
          }
        }
        
        // Always include 0% if in range
        if (domainMinValue <= 0 && domainMaxValue >= 0 && !ticks.includes(0)) {
          ticks.push(0)
          ticks.sort((a, b) => a - b)
        }
        
        setNiceTicks(ticks)
        console.log('Set nice ticks:', ticks.length, 'ticks')
      } else {
        // Reset domain if no processed data
        setDomainMin(null)
        setDomainMax(null)
        setNiceTicks([])
      }
    }
    
    // Mark processing as complete
    setProcessing(false)
  }, [data])

  // Memoize visible data calculation to avoid recalculating on every render
  // Must be called before any conditional returns (Rules of Hooks)
  // This shows ALL available data, with MIN/MAX range clearly marked
  const visibleData = React.useMemo(() => {
    if (chartData.length === 0) {
      console.log('visibleData: chartData is empty')
      return []
    }
    
    console.log('visibleData: processing', chartData.length, 'data points')
    console.log('visibleData: minRelativePct', minRelativePct, 'maxRelativePct', maxRelativePct)
    
    // Show ALL available data, but mark which relativePct are inside vs outside the active range
    // This gives full context of liquidity distribution beyond the MIN/MAX range
    if (minRelativePct !== null && maxRelativePct !== null && minRelativePct !== maxRelativePct) {
      // Mark all data points with inRange flag - show everything, not just near the range
      const result: Array<typeof chartData[0] & { inRange: boolean }> = []
      for (let i = 0; i < chartData.length; i++) {
        const d = chartData[i]
        result.push({
          ...d,
          inRange: d.relativePct >= minRelativePct && d.relativePct <= maxRelativePct
        })
      }
      
      // If we have too much data, we still need to sample for performance
      // But we'll sample intelligently to preserve both in-range and out-of-range data
      // Reduced limit significantly - with 300+ bars, each becomes < 2px and invisible
      // Further reduced to ensure bars are visible
      if (result.length > 300) {
        // Separate in-range and out-of-range data
        const inRangeData = result.filter(d => d.inRange)
        const outOfRangeData = result.filter(d => !d.inRange)
        
        // Keep all in-range data (it's important)
        // Sample out-of-range data if needed
        let sampled: Array<typeof chartData[0] & { inRange: boolean }> = [...inRangeData]
        
        if (outOfRangeData.length > 0) {
          const remainingSlots = 300 - inRangeData.length
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
        
        // Sort by relativePct to maintain order
        sampled.sort((a, b) => a.relativePct - b.relativePct)
        const final = sampled.slice(0, 300)
        console.log('visibleData: sampled to', final.length, 'points')
        return final
      }
      
      console.log('visibleData: returning all', result.length, 'points')
      return result
    }
    
    // Fallback: show all data (but limit to reasonable size for performance)
    // Mark all as in range if we don't have min/max
    // Reduced limit to ensure bars are visible
    if (chartData.length > 300) {
      // Sample data if too large
      const step = Math.ceil(chartData.length / 300)
      const result: Array<typeof chartData[0] & { inRange: boolean }> = []
      for (let i = 0; i < chartData.length; i += step) {
        result.push({
          ...chartData[i],
          inRange: minRelativePct !== null && maxRelativePct !== null 
            ? chartData[i].relativePct >= minRelativePct && chartData[i].relativePct <= maxRelativePct 
            : true
        })
      }
      return result
    }
    
    // Mark all data points with inRange flag
    return chartData.map(d => ({
      ...d,
      inRange: minRelativePct !== null && maxRelativePct !== null ? d.relativePct >= minRelativePct && d.relativePct <= maxRelativePct : true
    }))
  }, [chartData, minRelativePct, maxRelativePct])

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

  // Custom tooltip - aligned to relativePct scale
  // Recharts automatically positions tooltip based on the coordinate system
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const isInRange = data.inRange !== false && minRelativePct !== null && maxRelativePct !== null
        ? data.relativePct >= minRelativePct && data.relativePct <= maxRelativePct
        : data.inRange !== false
      
      // Format relativePct with sign
      const relativePctFormatted = data.relativePct >= 0 
        ? `+${data.relativePct.toFixed(2)}%` 
        : `${data.relativePct.toFixed(2)}%`
      
      // Format price with $ and commas
      const priceFormatted = `$${parseFloat(String(data.price)).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`
      
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">
            Price: {priceFormatted}
          </p>
          <p className="text-xs text-muted-foreground">
            Distance vs current: {relativePctFormatted}
          </p>
          <p className="text-xs text-muted-foreground">
            Liquidity: {data.liquidity.toLocaleString()}
          </p>
          {minRelativePct !== null && maxRelativePct !== null && (
            <p className={`text-xs mt-1 ${isInRange ? 'text-arrakis-orange' : 'text-muted-foreground'}`}>
              {isInRange ? 'In Range' : 'Outside active range'}
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
      <CardContent className="p-0 relative">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={(() => {
              const chartDataToUse = visibleData.length > 0 ? visibleData : chartData
              console.log('BarChart rendering with', chartDataToUse.length, 'data points')
              console.log('Domain:', domainMin, 'to', domainMax)
              if (chartDataToUse.length > 0) {
                console.log('Sample data point:', chartDataToUse[0])
                console.log('Data range - min relativePct:', Math.min(...chartDataToUse.map(d => d.relativePct)))
                console.log('Data range - max relativePct:', Math.max(...chartDataToUse.map(d => d.relativePct)))
                console.log('Data range - min liquidity:', Math.min(...chartDataToUse.map(d => d.liquidity)))
                console.log('Data range - max liquidity:', Math.max(...chartDataToUse.map(d => d.liquidity)))
              }
              return chartDataToUse
            })()}
            margin={{ top: 50, right: 20, bottom: 20, left: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#9F9C97" opacity={0.2} />
            
            {/* X-Axis with relativePct (%) formatting - exact domain with nice ticks */}
            <XAxis
              dataKey="relativePct"
              domain={domainMin !== null && domainMax !== null && domainMin !== domainMax ? [domainMin, domainMax] : undefined}
              ticks={niceTicks.length > 0 ? niceTicks : undefined}
              tickFormatter={(value) => {
                // Format as percentage with sign
                return value >= 0 ? `+${value.toFixed(0)}%` : `${value.toFixed(0)}%`
              }}
              stroke="#9F9C97"
              fontSize={12}
              tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
              type="number"
              scale="linear"
              allowDataOverflow={false}
              allowDecimals={true}
              padding={{ left: 0, right: 0 }}
            />
            
            {/* Y-Axis */}
            <YAxis
              stroke="#9F9C97"
              fontSize={12}
              tick={{ fill: '#9F9C97', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
              width={60}
              domain={['dataMin', 'dataMax']}
              allowDecimals={true}
              label={{ value: 'Liquidity', angle: -90, position: 'insideLeft', fill: '#9F9C97', fontSize: 12 }}
              tickFormatter={(value) => {
                // Round to reasonable precision based on magnitude
                if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
                if (value >= 1e3) return `${(value / 1e3).toFixed(2)}k`
                if (value >= 1) return value.toFixed(2)
                if (value >= 0.01) return value.toFixed(3)
                return value.toFixed(4)
              }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* Use Area chart instead of Bar for continuous numeric X-axis */}
            {/* Area chart works better with type="number" X-axis */}
            <Area
              dataKey="liquidity"
              stroke="#005efe"
              fill="#005efe"
              fillOpacity={0.6}
              strokeWidth={1}
              isAnimationActive={false}
              type="monotone"
            />
            
            {/* Active liquidity range (MIN → MAX) - render after bars but before lines */}
            {/* Always show if min/max are set, even if outside visible data range */}
            {minRelativePct !== null && maxRelativePct !== null && minRelativePct !== maxRelativePct && (
              <ReferenceArea
                x1={minRelativePct}
                x2={maxRelativePct}
                fill="rgba(236, 145, 23, 0.12)"
                stroke="none"
              />
            )}
            
            {/* Reference lines render on top (render last) */}
            {/* Current price line (solid orange) at 0% */}
            {currentPrice > 0 && (
              <ReferenceLine
                x={0}
                stroke="#EC9117"
                strokeWidth={2}
              />
            )}
            
            {/* Min relativePct line (dashed orange) */}
            {minRelativePct !== null && (
              <ReferenceLine
                x={minRelativePct}
                stroke="#EC9117"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
            
            {/* Max relativePct line (dashed orange) */}
            {maxRelativePct !== null && (
              <ReferenceLine
                x={maxRelativePct}
                stroke="#EC9117"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Labels overlay - positioned absolutely over the chart */}
        {currentPrice > 0 && domainMin !== null && domainMax !== null && (
          <div className="absolute top-2 left-[5px] right-[20px] pointer-events-none z-10">
            {/* Current Price label - centered with orange background */}
            {(() => {
              // Calculate position as percentage within the chart area (between left and right margins)
              const relativePosition = (0 - domainMin) / (domainMax - domainMin)
              // Format price without trailing zeros
              const priceStr = formatPriceFromTick(currentPrice)
              // Remove trailing zeros but keep at least one decimal if it's a decimal number
              const formattedPrice = priceStr.includes('.') 
                ? priceStr.replace(/\.?0+$/, '') 
                : priceStr
              
              return (
                <div 
                  className="text-white text-xs font-semibold absolute px-2 py-1 rounded"
                  style={{
                    left: `${relativePosition * 100}%`,
                    transform: 'translateX(-50%)',
                    backgroundColor: 'hsl(var(--arrakis-orange))',
                  }}
                >
                  {formattedPrice}
                </div>
              )
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

