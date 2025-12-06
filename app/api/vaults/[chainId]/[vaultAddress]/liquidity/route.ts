/**
 * GET /api/vaults/[chainId]/[vaultAddress]/liquidity
 *
 * Proxies to: GET /{chainId}/{vaultAddress}/live/liquidity-profile?refresh=false
 * Returns: Liquidity distribution across price ticks
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
    
    // Check if client wants to limit data (though API may not support this)
    const limit = searchParams.get('limit')
    
    // Build query string - API may support limit or other params
    const queryParams = new URLSearchParams({ refresh: 'false' })
    if (limit) {
      queryParams.append('limit', limit)
    }

    const url = `${INDEXER_API_URL}/indexer/private/${chainId}/${vaultAddress}/live/liquidity-profile?${queryParams}`

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: 30, // Cache for 30 seconds (live data)
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Failed to fetch liquidity profile',
          message: response.statusText,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching liquidity profile:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
