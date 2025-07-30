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

ADDRESS_DEPOSIT_MANAGER = "0x0b58ca72b12F01FC05F8f252e226f3E2089BD00E"
PATH_DEPOSIT_MANAGER = "DepositManager.json"

ADDRESS_SEIG_MANAGER = "0x0b55a0f463b6DEFb81c6063973763951712D0E5F"
PATH_SEIG_MANAGER = "SeigManager.json"

BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED = 18417896 # After the contract patch is completed, the block that runs the update seigniorage
BLOCK_NUMBER_SNAPSHOT = 23029214

# Block chunk size setting (number of blocks to read at once)
BLOCK_CHUNK_SIZE = 9990

LAYER2S = [
    "0x0F42D1C40b95DF7A1478639918fc358B4aF5298D",
    "0xf3B17FDB808c7d0Df9ACd24dA34700ce069007DF",
    "0x2B67D8D4E61b68744885E243EfAF988f1Fc66E2D",
    "0x2c25A6be0e6f9017b5bf77879c487eed466F2194",
    "0x36101b31e74c5E8f9a9cec378407Bbb776287761",
    "0xbc602C1D9f3aE99dB4e9fD3662CE3D02e593ec5d",
    "0xC42cCb12515b52B59c02eEc303c887C8658f5854",
    "0xf3CF23D896Ba09d8EcdcD4655d918f71925E3FE5",
    "0x44e3605d0ed58FD125E9C47D1bf25a4406c13b57",
    "0x06D34f65869Ec94B3BA8c0E08BCEb532f65005E2"
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
    csv_filename = f"v1_{BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED}_{BLOCK_NUMBER_SNAPSHOT}.csv"
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