# Get All Stakers

A script to retrieve all stakers from Tokamak Network on the Ethereum blockchain.

## Overview

This script analyzes `Deposited` events from the `DepositManager` contract to find all stakers and queries their current staking amounts from the `SeigManager` contract.

## Key Features

- ✅ **Complete Deposited Event Aggregation**: Accurately processes all events even when multiple Deposited events exist in a single transaction
- ✅ **Block Chunking**: Processes large block ranges efficiently by splitting them into configurable chunks
- ✅ **Detailed Logging**: Outputs execution progress and detailed event information
- ✅ **Current Staking Amount Query**: Retrieves each staker's current total staking amount
- ✅ **Sorted Results**: Outputs results sorted by staking amount
- ✅ **File Export**: Saves results to CSV and summary text files

## Required Files

- `get_all_stakers.py`: Main script
- `DepositManager.json`: DepositManager contract ABI
- `SeigManager.json`: SeigManager contract ABI
- `.env`: Environment variables configuration file

## Setup

### 1. Dependencies Installation

**✅ Recommended: Simple Installation (Verified)**
```bash
pip install web3 python-dotenv
```

**Python Version Compatibility (Tested)**
- **Python 3.9**: `pip install web3==6.19.0 aiohttp==3.8.6 python-dotenv` ✅ **Recommended**
- **Python 3.10+**: `pip install web3 python-dotenv` (latest versions)
- **Python 3.12**: `pip install web3 python-dotenv` (aiohttp compatibility issues resolved)

**Using Virtual Environment:**
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install packages
pip install web3 python-dotenv
```

### 2. Environment Variables

Create a `.env` file and add the following:

```bash
# Ethereum mainnet RPC endpoint
RPC_ENDPOINT_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"

# Or using Infura
# RPC_ENDPOINT_URL="https://mainnet.infura.io/v3/YOUR_PROJECT_ID"
```

### 3. Block Range Configuration

Configure the block range to query in the script:

```python
# Full range (takes longer)
BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED = 18416838
BLOCK_NUMBER_SNAPSHOT = 22846796  # latest block number

# Block chunk size (number of blocks to process at once)
BLOCK_CHUNK_SIZE = 9990
```

## Usage

### ✅ Basic Execution (Verified)

```bash
cd get_all_stakers
python3 get_all_stakers.py
```

### Using pyenv

```bash
~/.pyenv/versions/3.9.0/bin/python3 get_all_stakers.py
```

### Sample Output

```
🚀 Starting staker query...
🔗 RPC endpoint: https://eth-mainnet.g.alchemy.com/v2/...
✅ Blockchain connection successful
📊 Total block range: 18417750 ~ 18417751 (2 blocks)
📦 Chunk size: 9,990 blocks
📦 Total chunks: 1
🔍 Starting Deposited event search...

📦 Chunk 1/1: blocks 18417750 ~ 18417751
   ✅ Found 80 events

✅ Total 80 Deposited events found
📋 Event details:
🎯 Found 45 unique stakers

💰 Querying current staking amounts for each staker...
[  1/ 45] 0x1234567890123456789012345678901234567890: 150.5000 TON
[  2/ 45] 0x2345678901234567890123456789012345678901: 200.2500 TON
...
📋 Sorting by staking amount completed

================================================================================
🎯 Final Results (Sorted by Staking Amount)
================================================================================
  1. 0x2345678901234567890123456789012345678901: 200.2500 TON
  2. 0x1234567890123456789012345678901234567890: 150.5000 TON
...

==================================================
💾 Saving results to files...
==================================================
📄 CSV file saved: stakers_results_20240101_120000.csv
📄 Summary file saved: stakers_summary_20240101_120000.txt

✅ All tasks completed!
📁 Generated files:
   - stakers_results_20240101_120000.csv
   - stakers_summary_20240101_120000.txt
```

### Integrated Execution (main.py)

Query both Phase 1 stakers and all stakers together:

```bash
python3 main.py
```

## Output Files

### CSV File (`stakers_results_YYYYMMDD_HHMMSS.csv`)
Excel-compatible format with columns:
- Rank
- Address
- Staking_Amount_TON

### Summary File (`stakers_summary_YYYYMMDD_HHMMSS.txt`)
Detailed report including:
- Query metadata (timestamp, block range, event counts)
- Total staking amount across all stakers
- Ranked list of all stakers with amounts

## License

This project is licensed under the MIT License.