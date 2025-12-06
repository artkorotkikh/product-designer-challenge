# Understanding Ticks and Liquidity Distribution

## What is a Tick?

In Uniswap v3/v4 (and Arrakis vaults), a **tick** is a discrete price point in the AMM (Automated Market Maker) system.

### Key Concepts:

1. **Tick = Price Point**
   - Each tick represents a specific price for the token pair
   - Ticks are spaced logarithmically: `price = 1.0001^tick`
   - This means each tick is 0.01% (1 basis point) apart in price
   - Example: Tick -300198 might represent price $0.091

2. **Concentrated Liquidity**
   - Unlike Uniswap v2 (where liquidity is spread across all prices), v3/v4 allows liquidity providers to concentrate their liquidity in specific price ranges
   - Liquidity is deposited between a **min tick** and **max tick**
   - This creates a "range order" - the LP earns fees when price moves within their range

3. **Liquidity at Each Tick**
   - Each tick can have liquidity deposited on it
   - `liquidityGross` = total liquidity at that tick
   - `liquidityNet` = net change in liquidity (used for calculations)
   - When price moves, it crosses ticks, and liquidity is used for swaps

## Why the Chart Looks Like a Histogram

The Liquidity Distribution chart shows:

1. **X-Axis**: Price (converted from tick index)
   - Each bar represents a tick/price point
   - Bars are dense (no gaps) because we show every tick with liquidity

2. **Y-Axis**: Amount of liquidity
   - Height of each bar = how much liquidity is available at that price
   - Higher bars = more liquidity = better prices for traders

3. **The Pattern You See**:
   - **Flat bars** = Liquidity is evenly distributed across a price range
   - **Peaks** = Concentrated liquidity at specific prices
   - **Gaps** = No liquidity at those prices (would cause high slippage)

## Why Some Vaults Have Many Ticks

- **Wide Range Vaults**: If a vault manages liquidity across a very wide price range (e.g., $0.01 to $100), it needs many ticks
- **High Precision**: Each tick is 0.01% apart, so a 10x price range = ~23,000 ticks
- **FOLKS/USDT Example**: If the price range is very wide, you get 25,000+ ticks

## The MIN/MAX Range

- **MIN tick**: The lowest price where the vault has active liquidity
- **MAX tick**: The highest price where the vault has active liquidity
- **Current Price**: Where the market price is right now (solid orange line)
- **Shaded Area**: The active range where most liquidity is concentrated

## Why This Matters

- **For Traders**: Shows where they can trade with low slippage (high liquidity bars)
- **For LPs**: Shows where liquidity is concentrated and where they might want to add more
- **For Vault Managers**: Shows if liquidity is well-distributed or needs rebalancing

