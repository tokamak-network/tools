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

# Load .env file
load_dotenv()

RPC_ENDPOINT = os.getenv("RPC_ENDPOINT_URL")

ADDRESS_DEPOSIT_MANAGER = "0x0b58ca72b12F01FC05F8f252e226f3E2089BD00E"
PATH_DEPOSIT_MANAGER = "DepositManager.json"

ADDRESS_SEIG_MANAGER = "0x0b55a0f463b6DEFb81c6063973763951712D0E5F"
PATH_SEIG_MANAGER = "SeigManager.json"

BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED = 18416838
BLOCK_NUMBER_SNAPSHOT = 22846796

# BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED = 18417750
# BLOCK_NUMBER_SNAPSHOT = 18417751

# Block chunk size setting (number of blocks to read at once)
BLOCK_CHUNK_SIZE = 9990

# layer2s = [
#     "0xf3B17FDB808c7d0Df9ACd24dA34700ce069007DF",
#     "0x44e3605d0ed58FD125E9C47D1bf25a4406c13b57",
#     "0x2B67D8D4E61b68744885E243EfAF988f1Fc66E2D",
#     "0x36101b31e74c5E8f9a9cec378407Bbb776287761",
#     "0x2c25A6be0e6f9017b5bf77879c487eed466F2194",
#     "0x0F42D1C40b95DF7A1478639918fc358B4aF5298D",
#     "0xbc602C1D9f3aE99dB4e9fD3662CE3D02e593ec5d",
#     "0xC42cCb12515b52B59c02eEc303c887C8658f5854",
#     "0xf3CF23D896Ba09d8EcdcD4655d918f71925E3FE5",
#     "0x06D34f65869Ec94B3BA8c0E08BCEb532f65005E2",
# ]

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

def get_stakers(w3, from_block, to_block):
    instance = get_contract_instance(w3, PATH_DEPOSIT_MANAGER, ADDRESS_DEPOSIT_MANAGER)
    event_signature_hash = w3.keccak(text="Deposited(address,address,uint256)").hex()

    total_blocks = to_block - from_block + 1
    total_chunks = (total_blocks + BLOCK_CHUNK_SIZE - 1) // BLOCK_CHUNK_SIZE

    print(f"📊 Total block range: {from_block} ~ {to_block} ({total_blocks:,} blocks)")
    print(f"📦 Chunk size: {BLOCK_CHUNK_SIZE:,} blocks")
    print(f"📦 Total chunks: {total_chunks}")
    print(f"🔍 Starting Deposited event search...")

    all_logs = []
    stakers = set([])
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
                "topics": [event_signature_hash]
            })

            print(f"   ✅ Found {len(logs)} events")
            all_logs.extend(logs)
            total_events += len(logs)

        except Exception as e:
            print(f"   ❌ Chunk {chunk_idx + 1} query failed: {str(e)}")
            continue

    print(f"\n✅ Total {total_events} Deposited events found")
    print(f"📋 Event details:")

    # Process each log directly to ensure all events are aggregated
    for i, log in enumerate(all_logs, 1):
        # Extract event data directly from log
        decoded_log = instance.events.Deposited().process_log(log)
        depositor = decoded_log["args"]["depositor"]
        amount = decoded_log["args"]["amount"]
        tx_hash = log["transactionHash"].hex()
        block_number = log["blockNumber"]

        stakers.add(depositor)

        # print(f"[{i:3d}/{len(all_logs)}] Block {block_number} | TX: {tx_hash[:10]}... | Depositor: {depositor[:10]}... | Amount: {float(amount)/1e27:.4f}")

    print(f"🎯 Found {len(stakers)} unique stakers")
    return stakers, total_events


def get_total_staked_amount(instance_seigmanager, account):
    staked_amount = 0
    staked_amount = instance_seigmanager.functions.stakeOf(account).call()

    # for layer2 in layer2s:
    #     staked_amount += instance_seigmanager.functions.stakeOf(layer2, account).call()
    return staked_amount

def save_results_to_files(stakers_ordered, total_deposited_events, unique_stakers_count):
    """Save results to multiple file formats"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # 1. Save to CSV file
    csv_filename = f"stakers_results_{timestamp}.csv"
    with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Rank', 'Address', 'Staking_Amount_TON'])

        for i, (address, amount) in enumerate(stakers_ordered, 1):
            writer.writerow([i, address, f"{float(amount)/1e27:.4f}"])

    print(f"📄 CSV file saved: {csv_filename}")


    # # 2. Save to JSON file
    # json_filename = f"stakers_results_{timestamp}.json"
    # results_data = {
    #     "summary": {
    #         "total_deposited_events": total_deposited_events,
    #         "unique_stakers_count": unique_stakers_count,
    #         "query_timestamp": datetime.now().isoformat(),
    #         "block_range": f"{BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED}-{BLOCK_NUMBER_SNAPSHOT}"
    #     },
    #     "stakers": [
    #         {
    #             "rank": i,
    #             "address": address,
    #             "staking_amount_ton": float(amount) / 1e27,
    #             "staking_amount_wei": str(amount)
    #         }
    #         for i, (address, amount) in enumerate(stakers_ordered, 1)
    #     ]
    # }

    # with open(json_filename, 'w', encoding='utf-8') as jsonfile:
    #     json.dump(results_data, jsonfile, indent=2, ensure_ascii=False)

    # print(f"📄 JSON file saved: {json_filename}")

    # 3. Save summary information to text file
    summary_filename = f"stakers_summary_{timestamp}.txt"
    with open(summary_filename, 'w', encoding='utf-8') as txtfile:
        txtfile.write("=" * 60 + "\n")
        txtfile.write("🎯 TOKAMAK NETWORK STAKERS ANALYSIS REPORT\n")
        txtfile.write("=" * 60 + "\n\n")

        txtfile.write(f"📊 Query time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        txtfile.write(f"📊 Block range: {BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED} ~ {BLOCK_NUMBER_SNAPSHOT}\n")
        txtfile.write(f"📊 Total Deposited events: {total_deposited_events}\n")
        txtfile.write(f"📊 Unique stakers: {unique_stakers_count}\n\n")

        # Calculate total staking amount
        total_staking = sum(float(amount) / 1e27 for _, amount in stakers_ordered)
        txtfile.write(f"💰 Total staking amount: {total_staking:.4f} TON\n\n")

        txtfile.write("=" * 60 + "\n")
        txtfile.write("🏆 TOP Stakers Ranking (Sorted by Staking Amount)\n")
        txtfile.write("=" * 60 + "\n\n")

        for i, (address, amount) in enumerate(stakers_ordered, 1):
            txtfile.write(f"{i:3d}. {address}: {float(amount)/1e27:.4f} TON\n")

    print(f"📄 Summary file saved: {summary_filename}")

    # return csv_filename, json_filename, summary_filename
    return csv_filename, summary_filename

def get_all_stakers():
    print("🚀 Starting staker query...")
    print(f"🔗 RPC endpoint: {RPC_ENDPOINT[:50]}...")

    w3 = Web3(HTTPProvider(RPC_ENDPOINT))

    # Check connection
    if w3.is_connected():
        print("✅ Blockchain connection successful")
    else:
        print("❌ Blockchain connection failed")
        return []

    # current_block_number = w3.eth.getBlock("latest")["number"]
    stakers, total_events = get_stakers(w3, BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED, BLOCK_NUMBER_SNAPSHOT)

    print(f"\n💰 Querying current staking amounts for each staker...")
    instance_seigmanager = get_contract_instance(w3, PATH_SEIG_MANAGER, ADDRESS_SEIG_MANAGER)

    stakers_ordered = []
    for i, staker in enumerate(stakers, 1):
        amount = get_total_staked_amount(instance_seigmanager, staker)
        stakers_ordered.append((staker, amount))
        print(f"[{i:3d}/{len(stakers)}] {staker}: {float(amount)/1e27:.4f} TON")

    stakers_ordered.sort(key=lambda x: x[1], reverse=True)
    print(f"\n📋 Sorting by staking amount completed")
    return stakers_ordered, len(stakers), total_events

if __name__ == '__main__':
    ordered_stakers, unique_count, total_events = get_all_stakers()

    # Output results to console
    print("\n" + "="*80)
    print("🎯 Final Results (Sorted by Staking Amount)")
    print("="*80)
    for i, (address, amount) in enumerate(ordered_stakers, 1):
        print(f"{i:3d}. {address}: {float(amount)/1e27:.4f} TON")

    # Save to files
    print("\n" + "="*50)
    print("💾 Saving results to files...")
    print("="*50)

    csv_file, summary_file = save_results_to_files(
        ordered_stakers, total_events, unique_count
    )

    print("\n✅ All tasks completed!")
    print(f"📁 Generated files:")
    print(f"   - {csv_file}")
    print(f"   - {summary_file}")