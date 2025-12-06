/**
 * GET /api/vaults/[chainId]/[vaultAddress]/fees-history
 *
 * Proxies to: GET /{chainId}/{vaultAddress}/historical/fees
 * Query params: startDate, endDate
 * Returns: Historical fee earnings for the vault
 */

import { NextResponse } from 'next/server'

const INDEXER_API_URL =
  process.env.NEXT_PUBLIC_INDEXER_API_URL ||
  'https://indexer-v3.api.arrakis.finance/v3'

export async function GET(
  request: Request,
  { params }: { params: { chainId: string; vaultAddress: string } }
) {
  try {
    const { chainId, vaultAddress } = params
    const { searchParams } = new URL(request.url)

    // Get query parameters with defaults
    let startDate = searchParams.get('startDate') || '2025-01-01T00:00:00Z'
    let endDate = searchParams.get('endDate') || '2025-11-19T23:59:59Z'

    // Convert YYYY-MM-DD format to ISO format if needed
    const formatDateForAPI = (dateStr: string) => {
      if (dateStr.includes('T')) {
        return dateStr // Already ISO format
      }
      // YYYY-MM-DD format, convert to ISO
      return `${dateStr}T00:00:00Z`
    }

    startDate = formatDateForAPI(startDate)
    endDate = formatDateForAPI(endDate)

    const queryParams = new URLSearchParams({
      startDate,
      endDate,
    })

    const url = `${INDEXER_API_URL}/indexer/private/${chainId}/${vaultAddress}/historical/fees?${queryParams}`

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: 300, // Cache for 5 minutes (historical data)
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Failed to fetch fees history',
          message: response.statusText,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching fees history:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
