# API Response Structures

This document summarizes the actual response structures from all API endpoints used in the application.

## 1. Vault Details
**Endpoint:** `GET /api/vaults/{chainId}/{vaultAddress}`

**Response Structure:**
```json
{
  "chainId": 1,
  "vaultId": "0xe20b37048bec200db1ef35669a4c8a9470ce3288",
  "tokenPair": "VSN/USDC",
  "data": {
    "general": {
      "chain": "Ethereum",
      "owner": "0x20b39062fe2c04b5e11b0bcfa121747dc4ff1d0f",
      "createdAt": "2025-07-11T09:46:23Z",
      "lastRebalanced": "2025-12-02T13:53:59Z",  // ← Used for rebalance markers
      "depositAddresses": [...]
    },
    "tokens": {
      "token0": {
        "symbol": "VSN",
        "address": "...",
        "amount": "...",
        "valueUSD": 2416957.08,
        "percentage": 47.61,  // Already a percentage (0-100)
        "decimals": 18
      },
      "token1": {
        "symbol": "USDC",
        "percentage": 52.39
      }
    },
    "pool": {
      "name": "Uniswap V4",
      "feeTier": 0.75
    },
    "totalValueUSD": 5076378.91
  },
  "summary": {
    "priceImpact": {
      "buy": {
        "1000": 0.024597168,
        "10000": 0.24690247,
        "100000": 2.4832
      },
      "sell": {
        "1000": -0.024803162,
        "100000": -2.2294006
      }
    },
    "volume30d": {
      "usdValue": 7452925.96
    },
    "fees30d": {
      "usdValue": 39127.86
    }
  }
}
```

**Key Fields:**
- `data.general.lastRebalanced` - ISO timestamp for rebalance markers
- `summary.priceImpact.buy/sell` - Price impact by trade size (string keys)
- `summary.volume30d.usdValue` - 30-day volume
- `summary.fees30d.usdValue` - 30-day fees

---

## 2. Liquidity Profile
**Endpoint:** `GET /api/vaults/{chainId}/{vaultAddress}/liquidity`

**Response Structure:**
```json
{
  "chainId": 1,
  "vaultId": "0xe20b37048bec200db1ef35669a4c8a9470ce3288",
  "currentPrice": 0.091343,
  "currentTick": -300198,
  "isLeftInfinity": false,
  "isRightInfinity": false,
  "labels": [-40, -20, 0, 20, 40, 60, 80, 100],
  "data": [
    {
      "relativePct": -54.17,
      "liquidity": 0
    },
    {
      "relativePct": -51.33,
      "liquidity": 26.53795263144581
    },
    {
      "relativePct": -50.35,
      "liquidity": 29.07812538038736
    }
    // ... more data points (79 total in example)
  ]
}
```

**Key Fields:**
- `data` - Array of objects with `relativePct` (price offset %) and `liquidity` (amount)
- `currentPrice` - Current price as number
- `currentTick` - Current tick index
- Data points can range from 79 to 25,000+ depending on vault

**Note:** The `data` array structure is consistent - always an array, not an object with numeric keys.

---

## 3. Fees History
**Endpoint:** `GET /api/vaults/{chainId}/{vaultAddress}/fees-history?startDate={ISO_DATE}&endDate={ISO_DATE}`

**Query Parameters:**
- `startDate`: ISO format (e.g., `2025-11-06T00:00:00Z`)
- `endDate`: ISO format (e.g., `2025-12-06T23:59:59Z`)

**Response Structure:**
```json
{
  "chainId": 1,
  "vaultId": "0xe20b37048bec200db1ef35669a4c8a9470ce3288",
  "metadata": {
    "requestedStartDate": "2025-11-06T00:00:00.000Z",
    "requestedEndDate": "2025-12-06T23:00:00.000Z",
    "requestedHours": 743,
    "actualHoursAvailable": 840,
    "barAggregation": "week"  // ← Aggregation level
  },
  "summary": {
    "totalFeesUSD": 39849.89,
    "totalQuoteTokenFees": 20145.14,
    "totalGovTokenFees": 231287.61
  },
  "data": [
    {
      "date": "2025-11-03",           // ← YYYY-MM-DD format
      "label": "3 Nov 2025",          // ← Human-readable label
      "feesUSD": 3810.3761567287,     // ← Main field for fees chart
      "quoteTokenFees": 1759.06,
      "govTokenFees": 20685.60
    },
    {
      "date": "2025-11-10",
      "label": "10 Nov 2025",
      "feesUSD": 9664.89
    }
    // ... more data points (aggregated by week)
  ]
}
```

**Key Fields:**
- `data[].date` - Date in YYYY-MM-DD format (not ISO timestamp)
- `data[].feesUSD` - Fees in USD (number)
- `data[].label` - Human-readable date label
- `metadata.barAggregation` - Shows aggregation level (e.g., "week")

**Note:** 
- Dates are in YYYY-MM-DD format, not ISO timestamps
- Data is aggregated (by week in this example)
- No `volumeUSD` field - volume must be estimated or fetched separately

---

## 4. Vault Balance (Inventory Range)
**Endpoint:** `GET /api/vaults/{chainId}/{vaultAddress}/vault-balance?startDate={ISO_DATE}&endDate={ISO_DATE}`

**Query Parameters:**
- `startDate`: ISO format (e.g., `2025-11-06T00:00:00Z`)
- `endDate`: ISO format (e.g., `2025-12-06T23:59:59Z`)

**Response Structure:**
```json
{
  "chainId": 1,
  "vaultId": "0xe20b37048bec200db1ef35669a4c8a9470ce3288",
  "metadata": {
    "tokens": {
      "token0": {
        "symbol": "VSN",
        "address": "...",
        "decimals": 18
      },
      "token1": {
        "symbol": "USDC",
        "decimals": 6
      }
    },
    "requestedStartDate": "2025-11-06T00:00:00.000Z",
    "requestedEndDate": "2025-12-06T23:00:00.000Z",
    "requestedHours": 743,
    "actualStartDate": "2025-11-06T01:00:00.000Z",
    "actualEndDate": "2025-12-06T13:00:00.000Z",
    "actualHoursAvailable": 744,
    "bucketSizeHours": 12  // ← Data points every 12 hours
  },
  "data": [
    {
      "timestamp": "2025-12-06T13:00:00.000Z",  // ← ISO timestamp
      "totalValueUSD": 5383383.84,
      "tokens": {
        "token0": {
          "amount": "28169415.512954243",
          "valueUSD": 2582273.98,
          "price": 0.09166942,
          "percentage": 0.4797  // ← 0-1 range, needs * 100
        },
        "token1": {
          "amount": "2801355.645343",
          "valueUSD": 2801109.85,
          "price": 0.99991226,
          "percentage": 0.5203  // ← 0-1 range, needs * 100
        }
      }
    }
    // ... more data points (62 total for 30 days = ~2 per day)
  ]
}
```

**Key Fields:**
- `data[].timestamp` - ISO timestamp format
- `data[].tokens.token0.percentage` - **0-1 range** (needs to be multiplied by 100)
- `data[].tokens.token1.percentage` - **0-1 range** (needs to be multiplied by 100)
- `metadata.bucketSizeHours` - Time between data points (12 hours in example)

**Note:**
- Percentages are in 0-1 range, not 0-100
- Timestamps are ISO format
- Data points are spaced by `bucketSizeHours` (typically 4-12 hours)

---

## 5. Price Impact
**Endpoint:** `GET /api/vaults/{chainId}/{vaultAddress}/price-impact?tradeSize={USD}&startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}`

**Note:** This endpoint is used for historical price impact, but the main price impact data comes from `summary.priceImpact` in the vault details endpoint.

---

## Summary of Data Processing Requirements

### Fees Chart
- Use `fees-history` endpoint
- Field: `data[].feesUSD`
- Date field: `data[].date` (YYYY-MM-DD format)
- Convert date to time string for X-axis: `new Date(date).toLocaleTimeString()`

### Inventory Range Chart
- Use `vault-balance` endpoint
- Field: `data[].tokens.token0.percentage` **× 100** (convert from 0-1 to 0-100)
- Date field: `data[].timestamp` (ISO format)
- Convert timestamp to time string for X-axis

### Volume Chart
- **Issue:** Fees history doesn't include `volumeUSD` field
- **Options:**
  1. Use `summary.volume30d.usdValue` from vault details (but this is only 30-day total)
  2. Estimate from fees: `volume = fees * 333.33` (assuming ~0.3% fee rate)
  3. Check if there's a separate volume endpoint

### Rebalance Markers
- Use `data.general.lastRebalanced` from vault details
- Format: ISO timestamp
- Match to closest inventory data point timestamp

