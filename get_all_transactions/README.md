# Tokamak Network Simple Staking Events Collector

A tool for collecting and analyzing staking/unstaking events from the Tokamak Network.

## File Structure

### Scripts
- **v0_get_all_events.py** - Collect data before initial staking patch
- **v1_get_all_events.py** - Collect data after contract patch completion

### Data
- **logs_events/** - Contains pre-collected data files:
  - `10837675_18231453.csv` - v0 data (942KB, 3,664 events)
  - `18417896_23029214.csv` - v1 data (214KB, 833 events)

## Key Features

### Multi-Event Support
Monitors events from **DepositManager Contract** (`0x56E465f654393fa48f007Ed7346105c7195CEe43`):
- **Deposited(address,address,uint256)**: Staking events (layer2, depositor, amount)
- **WithdrawalRequested(address,address,uint256)**: Unstaking request events (layer2, depositor, amount)
- **WithdrawalProcessed(address,address,uint256)**: Withdrawal completion events (layer2, depositor, amount)

### Block Ranges
- **v0**: `10837675 ~ 18231453` (Up to Simple Staking Patch Block) - *Data already collected*
- **v1**: `18417896 ~ 23029214` (From first update seigniorage execution block after patch completion) - *Update block range as needed*

### Technical Features
- **Block Chunking**: Process 9,990 blocks at a time for stability (adjust based on RPC limitations)
- **WTON Conversion**: Accurate calculation with Decimal 27 units
- **Web3.py Compatibility**: Stability ensured using HTTP Provider
- **Error Handling**: Continue processing even if individual blocks fail

## Output Format

### CSV File
```
BlockNumber,Timestamp,TxHash,EventType,Layer2Name,Layer2Address,Depositor,Amount,AmountWTON
```

- **Filename**: `v0_StartBlock_EndBlock.csv` / `v1_StartBlock_EndBlock.csv`
- **Amount**: Original wei value
- **AmountWTON**: WTON unit converted value (Amount / 1e27)

## Usage

### 1. Environment Setup
```bash
# Install dependencies
pip install web3==6.19.0 python-dotenv
```

**Create .env file and configure RPC endpoint**:
```bash
# Create .env file
touch .env
```

Add the following content to the `.env` file:
```
RPC_ENDPOINT_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
# or
RPC_ENDPOINT_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY
```
> ⚠️ **Required**: Replace `YOUR_PROJECT_ID` or `YOUR_API_KEY` with actual values.

**RPC Limitations and Chunk Size Adjustment**:

Block query limits by RPC provider:
- **Infura**: ~10,000 blocks (fewer if many logs)
- **Alchemy**: ~10,000 blocks (adjust based on log count)
- **Other RPC**: Varies by provider

If you encounter the following errors, reduce `BLOCK_CHUNK_SIZE`:
```
- "query returned more than 10000 results"
- "request entity too large"
- "timeout" and similar errors
```

**Modify chunk size in each file**:
```python
BLOCK_CHUNK_SIZE = 9990  # Reduce to 1000, 5000, etc. if errors occur
```

### 2. Block Range Configuration
**v0** data is already collected and available in the logs_events folder.

For **v1**, modify the block range before data collection:

**v1_get_all_events.py**:
```python
BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED = 18417896  # Modify here
BLOCK_NUMBER_SNAPSHOT = 23029214  # Modify here
```

### 3. Execution
```bash
python v0_get_all_events.py  # Initial data
python v1_get_all_events.py  # Post-patch data, modify the blocks you want to collect and run.
```

## Development Notes

### Issues Resolved
- **Multi-event queries**: Use `"topics": [[hash1, hash2, hash3]]` format for DepositManager contract (`0x56E465f654393fa48f007Ed7346105c7195CEe43`) events: `Deposited(address,address,uint256)`, `WithdrawalRequested(address,address,uint256)`, and `WithdrawalProcessed(address,address,uint256)`
- **Python 3.9 compatibility**: WebSocket → HTTP Provider change
- **Data accuracy**: 27-digit precision guaranteed with Decimal module
- **Memory efficiency**: Large block range support with chunk processing

### Layer2 Support
Automatic mapping of 10 Layer2 networks (level19, tokamak1, DSRV, staked, Talken, decipher, DeSpread, Danal Fintech, DXM Corp, Hammer DAO)
