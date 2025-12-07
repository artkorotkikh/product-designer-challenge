'use client'

import * as React from 'react'
import { ArrowUpRight, ArrowDownRight, Info, AlertCircle, CheckCircle2, X, XCircle } from 'lucide-react'
import { cn, formatCompactNumber, formatNumber, getRelativeTime, calculateVaultStatus, type VaultStatus } from '@/lib/utils'
import { TokenIcon } from '@/components/token-icon'
import { fetchVaultBalance, fetchFeesHistory } from '@/lib/api'

interface VaultStatsProps {
  data: any
  loading?: boolean
}

interface StatItemProps {
  label: string
  value: React.ReactNode
  indicator?: React.ReactNode
}

interface StatWithChangeProps extends Omit<StatItemProps, 'value'> {
  value: string | number
  change: number | null
  changeLabel: string
}

/**
 * Component to render numbers in scientific notation
 * Example: 1.5 × 10²²
 */
function ScientificNotation({ num }: { num: number | string }) {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n) || n === 0) return <span>0</span>

  const [mantissa, exponent] = n.toExponential(1).split('e')
  const exp = parseInt(exponent, 10)

  return (
    <span className="inline-flex items-baseline">
      {parseFloat(mantissa)} × 10
      <sup className="text-[0.75em] leading-none ml-0.5">{exp}</sup>
    </span>
  )
}

/**
 * Component to render small prices with subscript notation
 * Example: $0.0₅85 (meaning $0.000000085)
 */
function SubscriptPrice({ num }: { num: number | string }) {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n) || n === 0) return <span>$0</span>

  const absNum = Math.abs(n)
  
  // Convert to string to analyze decimal places
  const numStr = absNum.toFixed(20) // Use high precision
  const match = numStr.match(/^0\.0+([1-9]\d*)/)
  
  if (!match) {
    // Not a candidate for subscript notation, use normal formatting
    return <span>${formatNumber(n, 3)}</span>
  }

  const leadingZeros = match[0].split('.')[1].match(/^0+/)?.[0].length || 0
  const significantDigits = match[1]

  // Use subscript notation if we have at least 2 leading zeros after decimal point
  if (leadingZeros >= 2) {
    const subscript = leadingZeros.toString()
    const subscriptMap: Record<string, string> = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
    }
    
    const subscriptChar = subscript
      .split('')
      .map(d => subscriptMap[d] || d)
      .join('')

    return (
      <span className="inline-flex items-baseline">
        $0.0<span className="text-[0.75em] leading-none align-baseline">{subscriptChar}</span>{significantDigits}
      </span>
    )
  }

  return <span>${formatNumber(n, 3)}</span>
}

/**
 * Status Tooltip Component
 * Shows detailed breakdown of vault health metrics
 */
function StatusTooltip({
  status,
  score,
  breakdown,
  metrics,
  onClose,
}: {
  status: VaultStatus
  score: number
  breakdown: {
    priceImpact: number
    inRange: number
    rebalance: number
    inventory: number
    fees: number
  }
  metrics: {
    priceImpact10k?: number
    inRangePercent?: number
    rebalanceAgeHours?: number
    inventoryDiff?: number
    feesRate?: number
  }
  onClose: () => void
}) {
  const statusConfig: Record<VaultStatus, { 
    color: string
    bgColor: string
    icon: React.ReactNode
    title: string
    description: string
  }> = {
    Healthy: {
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      title: 'Vault is operating optimally',
      description: 'All key metrics are within healthy ranges. The vault is performing well and managing liquidity effectively.',
    },
    Warning: {
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10 border-yellow-500/20',
      icon: <AlertCircle className="w-5 h-5 text-yellow-500" />,
      title: 'Some metrics need attention',
      description: 'One or more metrics are below optimal levels. Monitor the vault closely and consider rebalancing if issues persist.',
    },
    Critical: {
      color: 'text-red-500',
      bgColor: 'bg-red-500/10 border-red-500/20',
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      title: 'Vault requires immediate attention',
      description: 'Multiple metrics are in critical ranges. The vault may need rebalancing or has liquidity issues that should be addressed.',
    },
  }

  const config = statusConfig[status]

  const getMetricStatus = (score: number) => {
    if (score >= 80) return { color: 'text-emerald-500', label: 'Good' }
    if (score >= 50) return { color: 'text-yellow-500', label: 'Medium' }
    return { color: 'text-red-500', label: 'Poor' }
  }

  // Calculate contribution to overall score (weighted)
  const getContribution = (score: number, weight: number) => {
    return Math.round(score * weight)
  }

  const weights = {
    inRange: 0.25,
    priceImpact: 0.30,
    inventory: 0.15,
    rebalance: 0.15,
    fees: 0.15,
  }

  // All metrics with proper names and contributions
  const allMetrics = [
    { 
      name: 'Liquidity Depth', 
      key: 'inRange',
      score: breakdown.inRange, 
      contribution: getContribution(breakdown.inRange, weights.inRange),
      value: metrics.inRangePercent ? `${metrics.inRangePercent.toFixed(0)}%` : undefined,
      issueLabel: (val: string) => `Liquidity depth low (${val})`
    },
    { 
      name: 'Price Impact', 
      key: 'priceImpact',
      score: breakdown.priceImpact, 
      contribution: getContribution(breakdown.priceImpact, weights.priceImpact),
      value: metrics.priceImpact10k ? `${metrics.priceImpact10k.toFixed(2)}%` : undefined,
      issueLabel: (val: string) => `Price impact elevated (${val})`
    },
    { 
      name: 'Inventory Balance', 
      key: 'inventory',
      score: breakdown.inventory, 
      contribution: getContribution(breakdown.inventory, weights.inventory),
      value: metrics.inventoryDiff ? `${metrics.inventoryDiff.toFixed(1)}%` : undefined,
      issueLabel: (val: string) => `Inventory imbalance (${val})`
    },
    { 
      name: 'Rebalance Freshness', 
      key: 'rebalance',
      score: breakdown.rebalance, 
      contribution: getContribution(breakdown.rebalance, weights.rebalance),
      value: metrics.rebalanceAgeHours ? (metrics.rebalanceAgeHours < 24 ? `${metrics.rebalanceAgeHours.toFixed(1)}h` : `${Math.round(metrics.rebalanceAgeHours / 24)} days`) : undefined,
      issueLabel: (val: string) => `Rebalance overdue (${val})`
    },
    { 
      name: 'Volume Health', 
      key: 'fees',
      score: breakdown.fees, 
      contribution: getContribution(breakdown.fees, weights.fees),
      value: metrics.feesRate ? `${(metrics.feesRate * 100).toFixed(3)}%` : undefined,
      issueLabel: (val: string) => `Volume health low (${val})`
    },
  ]

  // Get problematic metrics (score < 50) for issues section
  const problematicMetrics = allMetrics.filter(m => m.score < 50)

  // Get recommendations based on problematic metrics
  const getRecommendations = () => {
    const recommendations: string[] = []
    
    if (problematicMetrics.some(m => m.key === 'priceImpact')) {
      recommendations.push('Review liquidity range')
    }
    if (problematicMetrics.some(m => m.key === 'rebalance')) {
      recommendations.push('Consider rebalancing soon')
    }
    if (problematicMetrics.some(m => m.key === 'inRange')) {
      recommendations.push('Optimize liquidity placement')
    }
    if (problematicMetrics.some(m => m.key === 'inventory')) {
      recommendations.push('Monitor inventory balance')
    }
    if (problematicMetrics.some(m => m.key === 'fees')) {
      recommendations.push('Review fee generation')
    }

    return recommendations.length > 0 ? recommendations : []
  }

  const recommendations = getRecommendations()

  return (
    <div className="absolute z-50 w-80 top-full left-0 mt-2 pointer-events-auto">
      <div className={cn(
        'rounded-lg border backdrop-blur-xl p-4 shadow-2xl',
        'bg-slate-900/80 border-slate-700/50',
        'backdrop-saturate-150'
      )}>
        {/* Status indicator and title */}
        <div className="flex items-start gap-2.5 mb-4">
          <div className={cn(
            'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
            {
              'bg-emerald-500': status === 'Healthy',
              'bg-yellow-500': status === 'Warning',
              'bg-red-500': status === 'Critical',
            }
          )} />
          <div className="flex-1 min-w-0">
            <h3 className={cn('font-semibold text-sm mb-0.5', config.color)}>
              {config.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground/60 hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Health Score */}
        <div className="mb-4 pb-4 border-b border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Health Score</span>
            <span className={cn('font-mono font-semibold text-base', config.color)}>
              {score} / 100
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all', {
                'bg-emerald-500': status === 'Healthy',
                'bg-yellow-500': status === 'Warning',
                'bg-red-500': status === 'Critical',
              })}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Breakdown - All Metrics */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-foreground mb-3">Breakdown</h4>
          <div className="space-y-2">
            {allMetrics.map((metric) => {
              const metricStatus = getMetricStatus(metric.score)
              return (
                <div key={metric.name} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{metric.name}:</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium', metricStatus.color)}>
                      {metricStatus.label}
                      </span>
                    <span className="text-muted-foreground/70 font-mono">
                      · +{metric.contribution}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status message or Issues */}
        {problematicMetrics.length > 0 ? (
          <div className="space-y-3 pt-4 border-t border-slate-700/30">
            <div>
              <h4 className="text-xs font-medium text-foreground mb-2">Issues to address</h4>
              <ul className="space-y-1.5">
                {problematicMetrics.map((metric) => {
                  if (!metric.value) return null
                  return (
                    <li key={metric.name} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-muted-foreground/50 mt-0.5">•</span>
                      <span>{metric.issueLabel(metric.value)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
            
            {recommendations.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-foreground mb-2">Recommended actions</h4>
                <ul className="space-y-1.5">
                  {recommendations.map((rec, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-muted-foreground/50 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="pt-4 border-t border-slate-700/30">
            <p className="text-xs text-muted-foreground">
            All metrics are within healthy ranges.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatItem({ label, value, indicator }: StatItemProps) {
  return (
    <div className="stats-item">
      <div className="stats-header">
        {indicator}
        <span>{label}</span>
      </div>
      <div className="stats-value-container">{value}</div>
    </div>
  )
}

function StatWithChange({ 
  label, 
  value, 
  change, 
  changeLabel, 
  valueColor = 'text-foreground'
}: StatWithChangeProps & { valueColor?: string }) {
  // Handle null/undefined/0 values - show grey/empty state
  if (change === null || change === undefined || change === 0) {
    return (
      <StatItem
        label={label}
        value={
          <div className="flex flex-col">
            <span className={cn('stats-number', valueColor)}>{value}</span>
            <div className="stats-details">
              <span className="text-muted-foreground">
                0.0% {changeLabel}
              </span>
            </div>
          </div>
        }
      />
    )
  }

  const isPositive = change > 0
  const changeColor = isPositive ? 'text-emerald-500' : 'text-red-500'
  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight

  // Round to 1-2 decimal places
  // Use 1 decimal for values >= 10, 2 decimals for smaller values
  const formattedChange = Math.abs(change) >= 10 
    ? Math.abs(change).toFixed(1)
    : Math.abs(change).toFixed(2)

  return (
    <StatItem
      label={label}
      value={
        <div className="flex flex-col">
          <span className={cn('stats-number', valueColor)}>{value}</span>
          <div className="stats-details">
            <ChangeIcon className={cn('stats-details-icon', changeColor)} />
            <span className={changeColor}>
              {formattedChange}% {changeLabel}
            </span>
          </div>
        </div>
      }
    />
  )
}

export function VaultStats({ data, loading }: VaultStatsProps) {
  // Extract token data early (available even during loading for icons/labels)
  const chainId = data?.chainId || 1
  const token0Symbol = data?.data?.tokens?.token0?.symbol || 'Token'
  const token0 = data?.data?.tokens?.token0
  const token1 = data?.data?.tokens?.token1

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Compute values needed for hooks (safe defaults if data is missing)
  const tvl = data?.data?.totalValueUSD || 0
  const fees30d = data?.summary?.fees30d?.usdValue || 0
  const apy = data?.apr || data?.data?.apr || '21.3%'
  const apyValue = typeof apy === 'string' ? parseFloat(apy.replace('%', '')) : apy

  // Calculations for price display
  const token0Decimals = token0?.decimals || 18
  const token1Decimals = token1?.decimals || 6
  const token0RawAmount = token0?.amount ? parseFloat(token0.amount) : 0
  const token1RawAmount = token1?.amount ? parseFloat(token1.amount) : 0
  const token0ActualAmount = token0RawAmount / Math.pow(10, token0Decimals)
  const token1ActualAmount = token1RawAmount / Math.pow(10, token1Decimals)
  const token0Price = token0ActualAmount > 0 ? (token0?.valueUSD || 0) / token0ActualAmount : 0
  const token1Price = token1ActualAmount > 0 ? (token1?.valueUSD || 0) / token1ActualAmount : 0
  const stablecoinSymbols = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FRAX', 'LUSD', 'GUSD', 'HUSD', 'SUSD', 'USDX', 'USDN', 'USDD', 'MIM', 'FEI', 'UST', 'EURT', 'EURS']
  const isToken0Stablecoin = token0?.symbol && stablecoinSymbols.includes(token0.symbol.toUpperCase())
  const isWETHPair = token0?.symbol?.toUpperCase() === 'WETH' && token1?.symbol?.toUpperCase() === 'WOO'
  const displayPrice = isToken0Stablecoin || isWETHPair ? token1Price : token0Price

  // State for historical data and calculated changes
  const [historicalChanges, setHistoricalChanges] = React.useState<{
    priceChange: number | null
    tvlChange: number | null
    feesChange: number | null
    apyChange: number | null
    loading: boolean
  }>({
    priceChange: null,
    tvlChange: null,
    feesChange: null,
    apyChange: null,
    loading: true,
  })

  // State for tooltip
  const [showTooltip, setShowTooltip] = React.useState(false)
  const statusRef = React.useRef<HTMLDivElement>(null)

  // Calculate vault health status (useMemo must be before conditional returns)
  const healthStatus = React.useMemo(() => {
    if (!data) {
      return { 
        status: 'Healthy' as VaultStatus, 
        score: 100, 
        breakdown: {
          priceImpact: 0,
          inRange: 0,
          rebalance: 0,
          inventory: 0,
          fees: 0,
        }
      }
    }
    // Extract price impact for $10k trade
    const priceImpactBuy = data.summary?.priceImpact?.buy
    let priceImpact10k: number | undefined
    
    if (priceImpactBuy) {
      const impact = priceImpactBuy['10000'] || priceImpactBuy[10000]
      if (impact !== undefined && impact !== null) {
        priceImpact10k = Math.abs(parseFloat(impact.toString()))
      }
    }

    const lastRebalancedDate = data.data?.general?.lastRebalanced
    const rebalanceAgeHours = lastRebalancedDate
      ? (Date.now() - new Date(lastRebalancedDate).getTime()) / (1000 * 60 * 60)
      : undefined

    const inventoryDiff = token0?.percentage !== undefined
      ? Math.abs(token0.percentage - 50)
      : undefined

    const feesRate = tvl > 0 && fees30d > 0
      ? (fees30d / tvl) / 30
      : undefined

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

    return calculateVaultStatus({
      priceImpact10k,
      inRangePercent,
      rebalanceAgeHours,
      inventoryDiff,
      feesRate,
    })
  }, [data, token0, tvl, fees30d])

  // Get raw metrics for tooltip (useMemo must be before conditional returns)
  const rawMetrics = React.useMemo(() => {
    if (!data) return null
    const priceImpactBuy = data.summary?.priceImpact?.buy
    let priceImpact10k: number | undefined
    
    if (priceImpactBuy) {
      const impact = priceImpactBuy['10000'] || priceImpactBuy[10000]
      if (impact !== undefined && impact !== null) {
        priceImpact10k = Math.abs(parseFloat(impact.toString()))
      }
    }

    const lastRebalancedDate = data.data?.general?.lastRebalanced
    const rebalanceAgeHours = lastRebalancedDate
      ? (Date.now() - new Date(lastRebalancedDate).getTime()) / (1000 * 60 * 60)
      : undefined

    const inventoryDiff = token0?.percentage !== undefined
      ? Math.abs(token0.percentage - 50)
      : undefined

    const feesRate = tvl > 0 && fees30d > 0
      ? (fees30d / tvl) / 30
      : undefined

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

    return {
      priceImpact10k,
      inRangePercent,
      rebalanceAgeHours,
      inventoryDiff,
      feesRate,
    }
  }, [data, token0, tvl, fees30d])

  // Fetch historical data to calculate "today" changes (useEffect must be before conditional returns)
  React.useEffect(() => {
    // Reset to loading state when data changes (switching vaults)
    setHistoricalChanges({
      priceChange: null,
      tvlChange: null,
      feesChange: null,
      apyChange: null,
      loading: true,
    })

    if (!data || !chainId || !data.vaultId) {
      setHistoricalChanges({
        priceChange: null,
        tvlChange: null,
        feesChange: null,
        apyChange: null,
        loading: false,
      })
      return
    }

    async function fetchHistoricalData() {
      try {
        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        const thirtyDaysAgoFromYesterday = new Date(yesterday.getTime() - 30 * 24 * 60 * 60 * 1000)

        // Fetch vault balance history (for TVL comparison)
        const balanceResponse = await fetchVaultBalance(
          chainId,
          data.vaultId,
          yesterday.toISOString(),
          now.toISOString()
        )

        // Fetch fees history for 30d fees calculation
        // Get fees for last 30 days from now
        const feesNowResponse = await fetchFeesHistory(
          chainId,
          data.vaultId,
          thirtyDaysAgo.toISOString().split('T')[0],
          now.toISOString().split('T')[0]
        )

        // Get fees for last 30 days from yesterday
        const feesYesterdayResponse = await fetchFeesHistory(
          chainId,
          data.vaultId,
          thirtyDaysAgoFromYesterday.toISOString().split('T')[0],
          yesterday.toISOString().split('T')[0]
        )

        // Calculate TVL change
        let tvlChangeValue: number | null = null
        if (balanceResponse?.data && balanceResponse.data.length > 0) {
          // Get the earliest data point (closest to 24h ago)
          const historicalTvl = balanceResponse.data[0]?.totalValueUSD || 0
          if (historicalTvl > 0 && tvl > 0) {
            tvlChangeValue = ((tvl - historicalTvl) / historicalTvl) * 100
          }
        }

        // Calculate 30d fees change
        let feesChangeValue: number | null = null
        // Handle both API response structures (with summary or without)
        // Prefer summary.totalFeesUSD if available, otherwise sum data points
        const feesNow = (feesNowResponse as any)?.summary?.totalFeesUSD ?? 
          (feesNowResponse?.data?.reduce((sum: number, point: any) => {
            const fees = point.feesUSD ?? 0
            return sum + (typeof fees === 'number' ? fees : parseFloat(String(fees)) || 0)
          }, 0) ?? 0)
        
        const feesYesterday = (feesYesterdayResponse as any)?.summary?.totalFeesUSD ?? 
          (feesYesterdayResponse?.data?.reduce((sum: number, point: any) => {
            const fees = point.feesUSD ?? 0
            return sum + (typeof fees === 'number' ? fees : parseFloat(String(fees)) || 0)
          }, 0) ?? 0)

        // Compare current fees30d with historical 30d fees from 24h ago
        if (feesYesterday > 0 && fees30d > 0) {
          feesChangeValue = ((fees30d - feesYesterday) / feesYesterday) * 100
        }

        // Calculate APY change
        // APY = (fees30d / TVL) * (365 / 30) * 100
        let apyChangeValue: number | null = null
        // Calculate APY from current data
        const currentApy = tvl > 0 && fees30d > 0 
          ? (fees30d / tvl) * (365 / 30) * 100 
          : apyValue

        // Calculate historical APY from 24h ago
        const historicalTvl = balanceResponse?.data?.[0]?.totalValueUSD || null
        if (historicalTvl && historicalTvl > 0 && feesYesterday > 0) {
          const historicalApy = (feesYesterday / historicalTvl) * (365 / 30) * 100
          if (historicalApy > 0) {
            apyChangeValue = ((currentApy - historicalApy) / historicalApy) * 100
          }
        }

        // Calculate price change from historical data
        let priceChangeValue: number | null = null
        if (balanceResponse?.data && balanceResponse.data.length > 0 && displayPrice > 0) {
          // Get the earliest data point (closest to 24h ago)
          const historicalDataPoint = balanceResponse.data[0]
          // Use the appropriate token price based on which one we're displaying
          const historicalPrice = isToken0Stablecoin 
            ? (historicalDataPoint?.tokens?.token1?.price || 0)
            : (historicalDataPoint?.tokens?.token0?.price || 0)
          if (historicalPrice > 0) {
            priceChangeValue = ((displayPrice - historicalPrice) / historicalPrice) * 100
          }
        }

        setHistoricalChanges({
          priceChange: priceChangeValue,
          tvlChange: tvlChangeValue,
          feesChange: feesChangeValue,
          apyChange: apyChangeValue,
          loading: false,
        })
      } catch (error) {
        console.error('Error fetching historical data for changes:', error)
        // Fallback to null values on error
        setHistoricalChanges({
          priceChange: null,
          tvlChange: null,
          feesChange: null,
          apyChange: null,
          loading: false,
        })
      }
    }

    fetchHistoricalData()
  }, [data, chainId, tvl, fees30d, apyValue, displayPrice, isToken0Stablecoin])

  // Close tooltip when clicking outside (useEffect must be before conditional returns)
  React.useEffect(() => {
    if (!showTooltip) return

    const handleClickOutside = (event: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setShowTooltip(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTooltip])

  if (loading) {
    return (
      <div className="stats-container py-2">
        {/* Status */}
        <StatItem
          label="Status"
          indicator={<div className="w-2 h-2 rounded-full bg-muted-foreground/50 mr-1.5 animate-pulse" />}
          value={
            <div className="w-16 h-10 bg-muted/50 animate-pulse rounded" />
          }
        />

        <div className="stats-divider" />

        {/* Last Rebalanced */}
        <StatItem
          label="Last rebalanced"
          value={
            <div className="w-20 h-10 bg-muted/50 animate-pulse rounded" />
          }
        />

        <div className="stats-divider" />

        {/* Token Price */}
        <StatItem
          label={`${token0Symbol} Price`}
          value={
            <div className="flex flex-col gap-1">
              <div className="w-24 h-10 bg-muted/50 animate-pulse rounded" />
              <div className="w-16 h-4 bg-muted/50 animate-pulse rounded" />
            </div>
          }
        />

        <div className="stats-divider" />

        {/* Total Liquidity */}
        <StatItem
          label="Total Liquidity"
          value={
            <div className="flex flex-col gap-1">
              <div className="w-24 h-10 bg-muted/50 animate-pulse rounded" />
              <div className="w-16 h-4 bg-muted/50 animate-pulse rounded" />
            </div>
          }
        />

        <div className="stats-divider" />

        {/* 30d Fees */}
        <StatItem
          label="30d Fees"
          value={
            <div className="flex flex-col gap-1">
              <div className="w-24 h-10 bg-muted/50 animate-pulse rounded" />
              <div className="w-16 h-4 bg-muted/50 animate-pulse rounded" />
            </div>
          }
        />

        <div className="stats-divider" />

        {/* APY */}
        <StatItem
          label="APY"
          value={
            <div className="flex flex-col gap-1">
              <div className="w-20 h-10 bg-muted/50 animate-pulse rounded" />
              <div className="w-16 h-4 bg-muted/50 animate-pulse rounded" />
            </div>
          }
        />

        <div className="stats-divider lg:block hidden" />

        {/* Inventory Balance */}
        <div className="stats-item stats-inventory">
          <div className="stats-header">
            <span>Inventory Balance</span>
          </div>
          <div className="space-y-2">
            {/* Values in USD */}
            <div className="flex items-center gap-4 font-mono text-lg">
              <div className="flex items-center gap-2">
                {token0 ? (
                  <TokenIcon 
                    address={token0.address} 
                    chainId={chainId} 
                    symbol={token0.symbol} 
                    className="w-4 h-4"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-muted/50 animate-pulse" />
                )}
                <div className="w-16 h-6 bg-muted/50 animate-pulse rounded" />
              </div>
              <div className="w-px h-4 bg-border/40" />
              <div className="flex items-center gap-2">
                {token1 ? (
                  <TokenIcon 
                    address={token1.address} 
                    chainId={chainId} 
                    symbol={token1.symbol} 
                    className="w-4 h-4"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-muted/50 animate-pulse" />
                )}
                <div className="w-16 h-6 bg-muted/50 animate-pulse rounded" />
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-muted/50 animate-pulse rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Data extraction (token0, token1, chainId already extracted above)
  // tvl, fees30d, apyValue, displayPrice already computed above for hooks

  const lastRebalanced = data.data?.general?.lastRebalanced
    ? getRelativeTime(data.data.general.lastRebalanced).replace(' ago', '')
    : '18 hours'

  // Determine which token price to display
  const displayToken = isToken0Stablecoin || isWETHPair ? token1 : token0

  const totalInventoryUSD = (token0?.valueUSD || 0) + (token1?.valueUSD || 0)
  const token0Ratio = totalInventoryUSD > 0 ? ((token0?.valueUSD || 0) / totalInventoryUSD) * 100 : 50
  const token1Ratio = 100 - token0Ratio

  // Format inventory amounts - convert to millions with proper rounding
  // For extremely large numbers, use scientific notation
  const formatInventoryAmount = (amount: number) => {
    if (amount === 0) return '0'
    
    // Convert to millions for display
    const amountInMillions = amount / 1_000_000
    
    // If still extremely large even in millions (e.g., > 1e9), use scientific notation
    if (Math.abs(amountInMillions) >= 1e9) {
      return <ScientificNotation num={amount} />
    }
    
    // Format as X.XM with one decimal place, properly rounded
    return `${amountInMillions.toFixed(1)}M`
  }

  // Format price - use subscript notation for very small numbers
  const formatPrice = (price: number): React.ReactNode => {
    if (price === 0) return '$0'
    
    // If price is very small (< 0.01), use subscript notation
    if (Math.abs(price) > 0 && Math.abs(price) < 0.01) {
      return <SubscriptPrice num={price} />
    }
    
    // Otherwise format with up to 3 decimal places
    return `$${formatNumber(price, 3)}`
  }

  // Use calculated changes or show 0 (grey) when loading/not available
  const priceChange = historicalChanges.priceChange ?? (historicalChanges.loading ? null : 0)
  const tvlChange = historicalChanges.tvlChange ?? (historicalChanges.loading ? null : 0)
  const feesChange = historicalChanges.feesChange ?? (historicalChanges.loading ? null : 0)
  const apyChange = historicalChanges.apyChange ?? (historicalChanges.loading ? null : 0)

  // Status styling
  const statusConfig: Record<VaultStatus, { color: string; indicatorColor: string }> = {
    Healthy: { color: 'text-emerald-500', indicatorColor: 'bg-emerald-500' },
    Warning: { color: 'text-yellow-500', indicatorColor: 'bg-yellow-500' },
    Critical: { color: 'text-red-500', indicatorColor: 'bg-red-500' },
  }

  const statusStyle = statusConfig[healthStatus.status]

  // rawMetrics already computed above in useMemo hook

  return (
    <div className="stats-container py-2">
      {/* Status */}
      <div className="stats-item relative" ref={statusRef}>
        <div className="stats-header">
          <div className={`w-2 h-2 rounded-full ${statusStyle.indicatorColor} mr-1.5`} />
          <span>Status</span>
        </div>
        <div className="stats-value-container">
          <div
            className="flex items-center gap-2 cursor-help group"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
          >
            <span className={`stats-number ${statusStyle.color}`}>{healthStatus.status}</span>
            <Info className="w-3.5 h-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        {showTooltip && rawMetrics && (
          <StatusTooltip
            status={healthStatus.status}
            score={healthStatus.score}
            breakdown={healthStatus.breakdown}
            metrics={rawMetrics}
            onClose={() => setShowTooltip(false)}
          />
        )}
      </div>

      <div className="stats-divider" />

      {/* Last Rebalanced */}
      <StatItem
        label="Last rebalanced"
        value={
          <span className="stats-number text-arrakis-orange">{lastRebalanced}</span>
        }
      />

      <div className="stats-divider" />

      {/* Token Price */}
      <StatItem
        label={`${displayToken?.symbol || 'Token'} Price`}
        value={
          <div className="flex flex-col">
            <span className="stats-number text-foreground">{formatPrice(displayPrice)}</span>
            <div className="stats-details">
              {priceChange === null || priceChange === undefined || priceChange === 0 ? (
                <span className="text-muted-foreground">
                  0.0% 24h
                </span>
              ) : (
                <>
                  {priceChange > 0 ? (
                <ArrowUpRight className="stats-details-icon text-emerald-500" />
              ) : (
                <ArrowDownRight className="stats-details-icon text-red-500" />
              )}
                  <span className={priceChange > 0 ? 'text-emerald-500' : 'text-red-500'}>
                    {Math.abs(priceChange) >= 10 
                      ? Math.abs(priceChange).toFixed(1)
                      : Math.abs(priceChange).toFixed(2)}% 24h
              </span>
                </>
              )}
            </div>
          </div>
        }
      />

      <div className="stats-divider" />

      {/* Total Liquidity */}
      <StatWithChange
        label="Total Liquidity"
        value={`$${formatCompactNumber(tvl)}`}
        change={tvlChange}
        changeLabel="today"
      />

      <div className="stats-divider" />

      {/* 30d Fees */}
      <StatWithChange
        label="30d Fees"
        value={`$${formatCompactNumber(fees30d)}`}
        change={feesChange}
        changeLabel="today"
      />

      <div className="stats-divider" />

      {/* APY */}
      <StatWithChange
        label="APY"
        value={`${formatNumber(apyValue, 1)}%`}
        change={apyChange}
        changeLabel="today"
      />

      <div className="stats-divider lg:block hidden" />

      {/* Inventory Balance */}
      <div className="stats-item stats-inventory">
        <div className="stats-header">
          <span>Inventory Balance</span>
        </div>
        <div className="space-y-2">
          {/* Values in USD */}
          <div className="flex items-center gap-4 font-mono text-lg">
            <div className="flex items-center gap-2">
              {token0 && (
                <TokenIcon 
                  address={token0.address} 
                  chainId={chainId} 
                  symbol={token0.symbol} 
                  className="w-4 h-4"
                />
              )}
              <span>${formatCompactNumber(token0?.valueUSD || 0)}</span>
            </div>
            <div className="w-px h-4 bg-border/40" />
            <div className="flex items-center gap-2">
              {token1 && (
                <TokenIcon 
                  address={token1.address} 
                  chainId={chainId} 
                  symbol={token1.symbol} 
                  className="w-4 h-4"
                />
              )}
              <span>${formatCompactNumber(token1?.valueUSD || 0)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground font-mono">
              {Math.round(token0Ratio)}%
            </span>
            <div className="flex-1 h-1.5 bg-blue-500/20 rounded-full overflow-hidden flex">
              <div
                className="h-full"
                style={{ 
                  width: `${token0Ratio}%`,
                  backgroundColor: 'hsl(var(--arrakis-orange))'
                }}
              />
              <div
                className="h-full"
                style={{ 
                  width: `${token1Ratio}%`,
                  backgroundColor: 'hsl(var(--arrakis-blue))'
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {Math.round(token1Ratio)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
