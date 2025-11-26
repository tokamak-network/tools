# Tokamak Network Basic Staking Metrics Aggregator

A Node.js project that calculates Basic Staking Metrics based on 00:00 UTC (09:00 KST) daily.

## 📋 Metrics Calculated

1. **criterion block number** - Block number at 00:00 UTC daily
2. **total supply of TON** - Total TON supply
3. **total staked amount** - Total staking amount
4. **total liquidity amount** - Total liquidity (total supply - total staked)
5. **number of blocks in period** - Number of blocks in the period
6. **amount issued within period** - Amount issued in the period (Seigniorage)
7. **amount burned within period** - Amount burned in the period
8. **additional staking amount** - Additional staking amount in the period
9. **withdrawal amount** - Withdrawal amount in the period
10. **amount to be withdrawn within 2 weeks** - Amount to be withdrawn within 2 weeks
11. **APY (Annual Percentage Yield)** - Annual percentage yield
12. **TON Price** - TON price

## 🚀 Quick Start

### 1. Installation

```bash
npm install
```

**Required packages:**
- `web3` - Ethereum blockchain interaction
- `dotenv` - Environment variable management
- `csv-parse`, `csv-stringify` - CSV file processing
- `axios` - HTTP requests

### 2. Environment Setup

Create `.env` file:

```bash
RPC_ENDPOINT_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
SUBGRAPH_URL=https://gateway-arbitrum.network.thegraph.com/api/subgraphs/id/CJLiXNdHXJ22BzWignD62gohDRVTYXJQVgU4qKJEtNVS
ETHERSCAN_API_KEY=your_etherscan_api_key_here  # Optional, faster if available
DUNE_API_KEY=your_dune_api_key_here  # Required for Dune table creation
DUNE_WORKSPACE=zena_team_5836  # Optional, default: zena_team_5836
```

**Etherscan API Key (Optional, Recommended):**
- Using Etherscan API makes block number lookup much faster
- [Get Etherscan API Key](https://etherscan.io/apis)
- Works without API key using Web3 binary search, but slower

Or copy `.env.example` file:

```bash
cp .env.example .env
# Edit .env file and enter actual values
```

### 3. Create Dune Table (Run First)

```bash
# Create table schema in Dune (using REST API)
node create_table_dune_rest.js
```

This command:
- Creates `zena_team_5836.basic_staking_metrics` table in Dune Analytics
- Requires `DUNE_API_KEY` to be set in `.env` file
- May show error if table already exists (can be ignored)

**Note:**
- Table creation only needs to be done once

### 4. Prepare Block Number File (Required)

```bash
# Calculate and save block numbers to file
npm run prepare-blocks
```

This command calculates daily block numbers from the past to the present.

**Specify Start Date (Optional):**
```bash
# Set start date in .env file
START_DATE=2025-11-21

# Or specify directly when running command
START_DATE=2025-11-21 npm run prepare-blocks
```

**Note:**
- Future blocks are not calculated as they don't exist yet
- Only calculates actual existing blocks from past to present
- Calculation time increases proportionally with period (approximately 1-2 minutes per year)

### 5. Run Metrics Calculation

```bash
npm start
# or
node calculate_metrics.js
```

This command:
- Reads block number file (`data/daily_block_numbers.csv`)
- Calculates metrics for each date
- Creates `output/basic_staking_metrics_*.csv` file

### 6. Prepare for Dune Upload

```bash
npm run upload-dune
# or
node upload_to_dune.js
```

This command:
- Reads calculated CSV file from `output/` directory
- Converts to Dune upload format
- Creates CSV and SQL files in `dune_ready/` directory

## 📁 Project Structure

```
aggregate_staking_metrics/
├── package.json
├── index.js                    # Main entry point
├── calculate_metrics.js        # Main metrics calculation script
├── config/
│   └── addresses.js           # Contract addresses and settings
├── utils/
│   ├── blockCalculator.js     # Block number calculation
│   ├── contractHelper.js      # Contract call helper
│   ├── subgraphClient.js      # Subgraph client
│   └── priceApi.js            # Price API client
├── data/                      # Input data
└── output/                    # Output CSV files
```

## 📊 Output Format

CSV files are created in `output/` directory:

**Filename**: `basic_staking_metrics_YYYY-MM-DD_HHMMSS.csv`

**Columns**:
- `date` - Date (YYYY-MM-DD)
- `criterion_block_number` - Criterion block number
- `previous_block_number` - Previous block number
- `blocks_in_period` - Number of blocks in period
- `total_supply_ton` - Total TON supply (ray, decimals 27)
- `total_supply_ton_decimal` - Total TON supply (TON units)
- `total_staked_amount` - Total staked amount (ray, decimals 27)
- `total_staked_amount_decimal` - Total staked amount (TON units)
- `total_liquidity_amount` - Total liquidity (ray, decimals 27)
- `total_liquidity_amount_decimal` - Total liquidity (TON units)
- `amount_issued` - Issued amount (ray, decimals 27)
- `amount_issued_decimal` - Issued amount (TON units)
- `amount_burned` - Burned amount (ray, decimals 27)
- `amount_burned_decimal` - Burned amount (TON units)
- `additional_staking_amount` - Additional staking amount (ray, decimals 27)
- `additional_staking_amount_decimal` - Additional staking amount (TON units)
- `withdrawal_amount` - Withdrawal amount (ray, decimals 27)
- `withdrawal_amount_decimal` - Withdrawal amount (TON units)
- `pending_withdrawal_2weeks` - Pending withdrawal within 2 weeks (ray, decimals 27)
- `pending_withdrawal_2weeks_decimal` - Pending withdrawal within 2 weeks (TON units)
- `apy` - Annual percentage yield (%)
- `ton_price` - TON price (USD)
- `ton_price_currency` - Price currency (USD, KRW if exchange rate lookup fails)

## 🔧 Calculation Methods

### 1. Criterion Block Number
- Block number at 00:00 UTC (09:00 KST) daily
- Accurate block number calculation using binary search

```bash
# Calculate and save block numbers to file
node prepare_block_numbers.js
```

This command creates `data/daily_block_numbers.csv` and `data/daily_block_numbers.json` files.
If these files exist, `calculate_metrics.js` will use them for faster execution.

### 2. Total Supply of TON
- Calls `SeigManager.totalSupplyOfTon()`
- Ray unit (decimals 27)

### 3. Total Staked Amount
- Calls `TOT.totalSupply()`
- TOT address: `0x47e264ea9b229368aa90c331D3f4CBe0b4c0f01d`
- Ray unit (decimals 27)

### 4. Total Liquidity Amount
- `total_supply_ton - total_staked_amount - DAOVault balance (TON)`
- DAOVault address: `0x2520CD65BAa2cEEe9E6Ad6EBD3F45490C42dd303`
- TON is 18 decimals → converted to ray unit (multiply by 10^9)
- **Planned**: DAOVault WTON balance will also be deducted

### 5. Number of Blocks in Period
- `current_block - previous_block`

### 6. Amount Issued
- `Seigniorage per block * blocks_in_period`
- Seigniorage per block: `3920000000000000000000000000` (ray)

### 7. Amount Burned
- Change in `TON.balanceOf(address(1))`
- `current_balance - previous_balance`

### 8. Additional Staking Amount
- Sum of `Deposited` events from subgraph
- Sum of all Deposited event amounts within the period

### 9. Withdrawal Amount
- Sum of `WithdrawalAndDeposited` events from subgraph

### 10. Pending Withdrawal (2 weeks)
- Sum of `DepositManager.pendingUnstakedLayer2(layer2)`
- Sum of pending withdrawals for all Layer2 candidates

### 11. APY
- Seigniorage-based calculation
- `(total_seig / total_staked) * (blocks_per_year / blocks_in_period) * 100`

### 12. TON Price
- Fetch KRW price from Upbit API
- Convert to USD using exchange rate
- Exchange rate API: `https://open.er-api.com/v6/latest/KRW`

## 📤 Dune Analytics Upload

### Upload Data to Dune Custom Tables

Calculated metrics can be uploaded to Dune Analytics Custom Tables.

#### 1. Create Table (Run First) ⭐

**Table creation is already completed in the "3. Create Dune Table" step above.**

If you need to recreate the table:

```bash
# Create table schema (using REST API)
node create_table_dune_rest.js
```

This command:
- Creates `zena_team_5836.basic_staking_metrics` table in Dune Analytics
- Requires `DUNE_API_KEY` to be set in `.env` file

#### 2. Prepare Upload (with Data)

```bash
# Convert calculated CSV file to Dune format
node upload_to_dune.js
```

This command creates the following files in `dune_ready/` directory:
- `basic_staking_metrics_*.csv` - CSV file for Dune upload
- `basic_staking_metrics_*_insert.sql` - INSERT query
- `basic_staking_metrics_create_table.sql` - CREATE TABLE query

#### 2. Create Table in Dune

**Method A: Web Interface (Recommended) ⭐**

1. Log in to Dune Analytics
2. Go to **Data** → **Custom Tables**
3. Select table `project_eco_test.basic_staking_metrics` (must already exist)
4. Click **Import CSV** or **Upload Data**
5. Select `dune_ready/basic_staking_metrics_*.csv` file
6. Auto-detect or manually set column types
7. Click **Import**

**Method B: SQL Query**

1. Open Dune Query Editor
2. Execute `dune_ready/basic_staking_metrics_*_insert.sql` content to insert data
3. Or manually write INSERT query referring to `dune_ready/basic_staking_metrics_create_table.sql`

**Method C: Dune REST API (Recommended) ⭐**

Dune Analytics REST API can be used to create tables.

```bash
# 1. Set Dune API key in .env file
DUNE_API_KEY=your_dune_api_key_here

# 2. Create table (see "3. Create Dune Table" step above)
node create_table_dune_rest.js

# 3. Upload data manually via CSV or SQL files
#    (Automatic upload feature planned for future)
```

**How it works:**
1. Create table schema using REST API
2. Manually upload generated CSV/SQL files via Dune web interface
3. Or execute INSERT query in SQL Query Editor

**API Key Setup:**

See [DUNE_API_SETUP.md](./DUNE_API_SETUP.md) document for detailed instructions.

Quick summary:
1. Log in to [Dune Analytics](https://dune.com)
2. Click profile icon (top right) → **Settings** → **API Keys**
3. Click **Create API Key** or **New API Key**
4. Enter API key name (e.g., "Tokamak Metrics Uploader")
5. Copy the generated key (⚠️ Only shown once, copy immediately!)
6. Set `DUNE_API_KEY=your_api_key_here` in `.env` file

**Note:**
- Table creation is automated via REST API
- Data upload must be done manually via CSV or SQL files
- Automatic data upload feature planned for future

#### 3. Table Structure

Actual created table structure:

```sql
CREATE TABLE zena_team_5836.basic_staking_metrics (
    date TIMESTAMP,
    criterion_block_number BIGINT,
    previous_block_number BIGINT,
    blocks_in_period BIGINT,
    total_supply_ton DOUBLE PRECISION,
    total_supply_ton_decimal DOUBLE PRECISION,
    total_staked_amount DOUBLE PRECISION,
    total_staked_amount_decimal DOUBLE PRECISION,
    total_liquidity_amount DOUBLE PRECISION,
    total_liquidity_amount_decimal DOUBLE PRECISION,
    amount_issued DOUBLE PRECISION,
    amount_issued_decimal DOUBLE PRECISION,
    amount_burned DOUBLE PRECISION,
    amount_burned_decimal DOUBLE PRECISION,
    additional_staking_amount DOUBLE PRECISION,
    additional_staking_amount_decimal DOUBLE PRECISION,
    withdrawal_amount DOUBLE PRECISION,
    withdrawal_amount_decimal DOUBLE PRECISION,
    pending_withdrawal_2weeks DOUBLE PRECISION,
    pending_withdrawal_2weeks_decimal DOUBLE PRECISION,
    apy DOUBLE PRECISION,
    ton_price DOUBLE PRECISION,
    ton_price_currency VARCHAR
);
```

**Note:**
- Table name: `zena_team_5836.basic_staking_metrics` (includes workspace)
- `date` type: `TIMESTAMP` (Dune API uses TIMESTAMP instead of DATE)
- Numeric type: `DOUBLE PRECISION` (Dune API uses DOUBLE PRECISION instead of NUMERIC)
- String type: `VARCHAR` (Dune API uses VARCHAR instead of TEXT)

## 🔄 Automation

### GitHub Actions

**Planned** - Will be configured in `.github/workflows/daily_aggregate_and_upload.yml`.

### Local Cron Job

```bash
# crontab -e
# Calculate and prepare upload daily at 09:00 KST
0 9 * * * cd /path/to/aggregate_staking_metrics && \
  node calculate_metrics.js && \
  node upload_to_dune.js
```

## 📚 References

- [Staking V1 Subgraph](../staking-v1-subgraph/README.md)
- [Dune Dashboard Strategy](../example_subgraph/DUNE_DASHBOARD_STRATEGY.md)
- [Dune API Setup Guide](./DUNE_API_SETUP.md) - Detailed API key creation guide

## ⚠️ Notes

1. **RPC Endpoint**: Recommended to use RPC with sufficient rate limit
2. **Calculation Time**: Processing 3 years of data may take a long time
3. **Error Handling**: Continues processing even if individual date calculation fails
4. **Price API**: Upbit API may fail, fallback needed

## 🔍 Troubleshooting

### RPC Connection Failure
- Check RPC_ENDPOINT_URL
- Check network connection

### Subgraph Query Failure
- Check SUBGRAPH_URL
- Check subgraph sync status

### Calculation Takes Too Long
- Modify to calculate only specific periods
- Consider adding parallel processing

