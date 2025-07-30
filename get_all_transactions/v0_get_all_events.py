import json
import sys
import time
import pprint
import os
import csv
from web3 import Web3, HTTPProvider
from datetime import datetime
import asyncio
from dotenv import load_dotenv
from decimal import Decimal

# Load .env file
load_dotenv()

RPC_ENDPOINT = os.getenv("RPC_ENDPOINT_URL")

ADDRESS_DEPOSIT_MANAGER = "0x56E465f654393fa48f007Ed7346105c7195CEe43"
PATH_DEPOSIT_MANAGER = "DepositManager.json"

ADDRESS_SEIG_MANAGER = "0x710936500aC59e8551331871Cbad3D33d5e0D909"
PATH_SEIG_MANAGER = "SeigManager.json"

BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED = 10837675
BLOCK_NUMBER_SNAPSHOT = 18231453 # simple staking patch block


# Block chunk size setting (number of blocks to read at once)
BLOCK_CHUNK_SIZE = 9990

LAYER2S = [
    "0x42CCF0769e87CB2952634F607DF1C7d62e0bBC52",
    "0x39A13a796A3Cd9f480C28259230D2EF0a7026033",
    "0xBC8896Ebb2E3939B1849298Ef8da59E09946cF66",
    "0xCc38C7aaf2507da52A875e93F57451e58E8c6372",
    "0xB9D336596Ea2662488641c4AC87960BFdCb94c6e",
    "0x17602823b5fE43a65aD7122946A73B019e77fD33",
    "0x2000fC16911FC044130c29C1Aa49D3E0B101716a",
    "0x97d0a5880542ab0e699c67e7f4ff61F2E5200484",
    "0x41fb4bAD6fbA9e9b6E45F3f96bA3ad7Ec2fF5b3C",
    "0x5d9a0646c46245A8a3B4775aFB3c54d07BCB1764"
]

LAYER2S_NAMES = [
    "level19",
    "tokamak1",
    "DSRV",
    "staked",
    "Talken",
    "decipher",
    "DeSpread",
    "Danal Fintech",
    "DXM Corp",
    "Hammer DAO"
]

def get_compiled_contract(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

    return None

def get_contract_instance(w3, path, address):
    compiled = get_compiled_contract(path)
    checksum_address = w3.to_checksum_address(address)
    instance = w3.eth.contract(
        address=checksum_address,
        abi=compiled["abi"])
    return instance

def get_events(w3, from_block, to_block):
    instance = get_contract_instance(w3, PATH_DEPOSIT_MANAGER, ADDRESS_DEPOSIT_MANAGER)
    staking_signature_hash = w3.keccak(text="Deposited(address,address,uint256)").hex()
    unstaking_signature_hash = w3.keccak(text="WithdrawalRequested(address,address,uint256)").hex()
    withdraw_signature_hash = w3.keccak(text="WithdrawalProcessed(address,address,uint256)").hex()

    total_blocks = to_block - from_block + 1
    total_chunks = (total_blocks + BLOCK_CHUNK_SIZE - 1) // BLOCK_CHUNK_SIZE

    print(f"📊 Total block range: {from_block} ~ {to_block} ({total_blocks:,} blocks)")
    print(f"📦 Chunk size: {BLOCK_CHUNK_SIZE:,} blocks")
    print(f"📦 Total chunks: {total_chunks}")
    print(f"🔍 Starting multi-event search (Deposited, WithdrawalRequested, WithdrawalProcessed)...")

    all_logs = []
    transactions = []
    total_events = 0

    # Process blocks in chunks
    for chunk_idx in range(total_chunks):
        chunk_start = from_block + (chunk_idx * BLOCK_CHUNK_SIZE)
        chunk_end = min(chunk_start + BLOCK_CHUNK_SIZE - 1, to_block)

        print(f"\n📦 Chunk {chunk_idx + 1}/{total_chunks}: blocks {chunk_start} ~ {chunk_end}")

        try:
            logs = w3.eth.get_logs({
                'fromBlock': chunk_start,
                'toBlock': chunk_end,
                'address': ADDRESS_DEPOSIT_MANAGER,
                "topics": [[staking_signature_hash, unstaking_signature_hash, withdraw_signature_hash]]
            })

            print(f"   ✅ Found {len(logs)} events")
            all_logs.extend(logs)
            total_events += len(logs)

        except Exception as e:
            print(f"   ❌ Chunk {chunk_idx + 1} query failed: {str(e)}")
            continue

    print(f"\n✅ Total {total_events} events found")
    print(f"📋 Event details:")


    # Process each log directly to ensure all events are aggregated
    for i, log in enumerate(all_logs, 1):
        # Check event type by comparing the first topic (event signature hash)
        event_signature = log["topics"][0].hex()
        tx_hash = log["transactionHash"].hex()
        block_number = log["blockNumber"]
        # Get block timestamp
        try:
            block_info = w3.eth.get_block(block_number)
            block_timestamp = datetime.fromtimestamp(block_info["timestamp"])
        except Exception as e:
            print(f"   ⚠️ Failed to get block {block_number} timestamp: {e}")
            block_timestamp = datetime.now()  # fallback

        # Determine event type and decode accordingly
        if event_signature == staking_signature_hash or event_signature == unstaking_signature_hash or event_signature == withdraw_signature_hash:

            if event_signature == staking_signature_hash:
                # Deposited event
                decoded_log = instance.events.Deposited().process_log(log)
                event_type = "Deposited"

            elif event_signature == unstaking_signature_hash:
                # WithdrawalRequested event
                decoded_log = instance.events.WithdrawalRequested().process_log(log)
                event_type = "Unstaking"

            else:
                # WithdrawalProcessed event
                decoded_log = instance.events.WithdrawalProcessed().process_log(log)
                event_type = "Withdrawal"

            layer2 = decoded_log["args"]["layer2"]
            depositor = decoded_log["args"]["depositor"]
            amount = decoded_log["args"]["amount"]

            # Convert to WTON (decimal 27 units)
            amount_decimal = Decimal(str(amount))
            wton_amount = amount_decimal / Decimal('1e27')

            transactions.append((
                block_number,
                block_timestamp,
                tx_hash,
                event_type,
                LAYER2S_NAMES[LAYER2S.index(layer2)] if layer2 in LAYER2S else "Unknown",
                layer2,
                depositor,
                amount,
                wton_amount,
            ))

            print(f"[{i:3d}/{len(all_logs)}] Block {block_number} | {block_timestamp} | TX: {tx_hash[:10]}... | Type: {event_type} | Depositor: {depositor[:10]}... | Amount: {amount} |  WTON: {wton_amount}")

        else:
            print(f"[{i:3d}/{len(all_logs)}] Block {block_number} |({block_timestamp} | TX: {tx_hash[:10]}... | Unknown event type: {event_signature}")
            continue

    return transactions, total_events


def save_results_to_files(transactions):
    """Save results to multiple file formats"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # 1. Save to CSV file
    csv_filename = f"v0_{BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED}_{BLOCK_NUMBER_SNAPSHOT}.csv"
    with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['BlockNumber', 'Timestamp', 'TxHash', 'EventType', 'Layer2Name', 'Layer2Address', 'Depositor', 'Amount', 'AmountWTON'])

        for block_number, block_timestamp, tx_hash, event_type, layer2_name, layer2_address, depositor, amount, wton_amount in transactions:
            writer.writerow([block_number, block_timestamp, tx_hash, event_type, layer2_name, layer2_address, depositor, str(amount), str(wton_amount)])

    print(f"📄 CSV file saved: {csv_filename}")

    return csv_filename


def get_all_events():
    w3 = Web3(HTTPProvider(RPC_ENDPOINT))
    # current_block_number = w3.eth.getBlock("latest")["number"]
    transactions, total_events = get_events(w3, BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED, BLOCK_NUMBER_SNAPSHOT)

    # Save results to files
    csv_filename = save_results_to_files(transactions)

    print(f"\n🎉 Analysis completed!")
    print(f"📊 Total events processed: {total_events}")
    print(f"📄 Results saved to: {csv_filename}")

    return transactions

if __name__ == '__main__':
    transactions = get_all_events()
    print(f"\n📋 Summary: {len(transactions)} total events processed")