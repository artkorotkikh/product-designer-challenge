/**
 * API Helper Functions
 *
 * These functions provide typed interfaces to the Arrakis API proxy routes.
 * All API calls are proxied through Next.js API routes to avoid CORS issues.
 */

import type {
  VaultMetadata,
  LiquidityProfile,
  LiveInventoryResponse,
  VaultBalanceResponse,
  PriceImpactResponse,
  FeesHistoryResponse,
  ApiError,
} from './types'

const API_BASE = '/api/vaults'

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(url: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    const error: ApiError = {
      error: 'API Error',
      message: `Failed to fetch: ${response.statusText}`,
      statusCode: response.status,
    }
    throw error
  }

  const data = await response.json()
  return data as T
}

// ============================================
// Vault API Functions
// ============================================

/**
 * Fetch detailed metadata for a specific vault
 *
 * @param chainId - The blockchain chain ID (e.g., 1 for Ethereum mainnet)
 * @param vaultAddress - The vault contract address
 * @returns Detailed vault metadata
 */
export async function fetchVaultDetails(
  chainId: number,
  vaultAddress: string
): Promise<VaultMetadata> {
  return apiFetch<VaultMetadata>(`${API_BASE}/${chainId}/${vaultAddress}`)
}

/**
 * Fetch liquidity distribution across price ticks
 *
 * @param chainId - The blockchain chain ID
 * @param vaultAddress - The vault contract address
 * @param limit - Optional limit for number of ticks (may not be supported by API)
 * @returns Liquidity profile with tick data
 */
export async function fetchLiquidityProfile(
  chainId: number,
  vaultAddress: string,
  limit?: number
): Promise<LiquidityProfile> {
  const url = limit 
    ? `${API_BASE}/${chainId}/${vaultAddress}/liquidity?limit=${limit}`
    : `${API_BASE}/${chainId}/${vaultAddress}/liquidity`
  return apiFetch<LiquidityProfile>(url)
}

/**
 * Fetch live inventory (current token balance snapshot)
 *
 * @param chainId - The blockchain chain ID
 * @param vaultAddress - The vault contract address
 * @returns Current inventory state
 */
export async function fetchLiveInventory(
  chainId: number,
  vaultAddress: string
): Promise<LiveInventoryResponse> {
  return apiFetch<LiveInventoryResponse>(
    `${API_BASE}/${chainId}/${vaultAddress}/live-inventory`
  )
}

/**
 * Fetch historical vault balance composition over time
 *
 * @param chainId - The blockchain chain ID
 * @param vaultAddress - The vault contract address
 * @param startDate - Start date in ISO format (default: 30 days ago)
 * @param endDate - End date in ISO format (default: now)
 * @returns Historical token balance percentages over time
 */
export async function fetchVaultBalance(
  chainId: number,
  vaultAddress: string,
  startDate?: string,
  endDate?: string
): Promise<VaultBalanceResponse> {
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)

  const queryString = params.toString()
  const url = `${API_BASE}/${chainId}/${vaultAddress}/vault-balance${queryString ? `?${queryString}` : ''}`

  return apiFetch<VaultBalanceResponse>(url)
}

/**
 * Fetch historical price impact data
 *
 * @param chainId - The blockchain chain ID
 * @param vaultAddress - The vault contract address
 * @param tradeSize - Trade size in USD (e.g., 5000)
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Price impact data points
 */
export async function fetchPriceImpact(
  chainId: number,
  vaultAddress: string,
  tradeSize: number = 5000,
  startDate: string = '2025-01-01',
  endDate: string = '2025-11-19'
): Promise<PriceImpactResponse> {
  const params = new URLSearchParams({
    tradeSize: tradeSize.toString(),
    startDate,
    endDate,
  })

  return apiFetch<PriceImpactResponse>(
    `${API_BASE}/${chainId}/${vaultAddress}/price-impact?${params}`
  )
}

/**
 * Fetch historical fee earnings
 *
 * @param chainId - The blockchain chain ID
 * @param vaultAddress - The vault contract address
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Historical fee data
 */
export async function fetchFeesHistory(
  chainId: number,
  vaultAddress: string,
  startDate: string = '2025-01-01',
  endDate: string = '2025-11-19'
): Promise<FeesHistoryResponse> {
  const params = new URLSearchParams({
    startDate,
    endDate,
  })

  return apiFetch<FeesHistoryResponse>(
    `${API_BASE}/${chainId}/${vaultAddress}/fees-history?${params}`
  )
}

// ============================================
// Convenience function for test vaults
// ============================================

/**
 * Default test vaults across multiple chains
 */
export const TEST_VAULTS = [
  { address: '0xe20b37048bec200db1ef35669a4c8a9470ce3288', chainId: 1 }, // Ethereum
  { address: '0x70a8be67675837db9b0c7c36cb629c8aab479e93', chainId: 1 }, // Ethereum
  { address: '0x9f71298ee14176395c36797e65be1169e15f20d4', chainId: 1 }, // Ethereum
  { address: '0xb7f3c2dd386bb750d3e2132a1579d496c5faaf24', chainId: 56 }, // BSC - PancakeSwap V4
  { address: '0x5666af5c1b8d4bfe717a0d065fdc0bb190d49e42', chainId: 8453 }, // Base - Aerodrome
]

/**
 * Fetch details for all test vaults
 *
 * @returns Array of vault metadata for all test vaults
 */
export async function fetchTestVaults(): Promise<VaultMetadata[]> {
  const promises = TEST_VAULTS.map(({ address, chainId }) =>
    fetchVaultDetails(chainId, address)
  )

  return Promise.all(promises)
}
