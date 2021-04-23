import json
import sys
import time
import pprint
from web3 import Web3, WebsocketProvider
from datetime import datetime
import asyncio

RPC_ENDPOINT = "INSERT YOUR URL"

ADDRESS_DEPOSIT_MANAGER = "0x56E465f654393fa48f007Ed7346105c7195CEe43"
PATH_DEPOSIT_MANAGER = "DepositManager.json"

BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED = 10837675
BLOCK_NUMBER_EVENT_START = 12223496

def get_compiled_contract(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)
        
    return None

def get_contract_instance(w3, path, address):
    compiled = get_compiled_contract(path)
    instance = w3.eth.contract(
        address=address,
        abi=compiled["abi"])
    return instance

w3 = Web3(WebsocketProvider(RPC_ENDPOINT))
instance = get_contract_instance(w3, PATH_DEPOSIT_MANAGER, ADDRESS_DEPOSIT_MANAGER)    
event_signature_hash = w3.keccak(text="Deposited(address,address,uint256)").hex()

def get_stakers(w3, from_block, to_block):
    logs = w3.eth.getLogs({
        'fromBlock': from_block,
        'toBlock': to_block,
        'address': ADDRESS_DEPOSIT_MANAGER,
        "topics": [event_signature_hash]
    })

    txs = list(map(lambda x: (x["blockNumber"], x["transactionHash"].hex()), logs))

    stakers = set([])
    stakers_block = {}

    for tx in txs:
        receipt = w3.eth.getTransactionReceipt(tx[1])
        
        tmp = instance.events.Deposited().processReceipt(receipt)
        depositor = tmp[0]["args"]["depositor"]
        stakers.add(depositor)
        if (depositor in stakers_block and stakers_block[depositor] > tx[0]) or depositor not in stakers_block:
            stakers_block[depositor] = int(tx[0])
    return (stakers, stakers_block)

original_stakers, original_stakers_blocks = get_stakers(w3, BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED, BLOCK_NUMBER_EVENT_START)

current_block_number = w3.eth.getBlock("latest")["number"]
new_stakers, new_stakers_block = get_stakers(w3, BLOCK_NUMBER_EVENT_START-1, current_block_number)
new_stakers = new_stakers - original_stakers

new_stakers = sorted(new_stakers, key=lambda x: new_stakers_block[x])

for new_staker in new_stakers:
    block = w3.eth.getBlock(new_stakers_block[new_staker])
    date_time = datetime.fromtimestamp(block["timestamp"])
    print(f"{new_staker}: {new_stakers_block[new_staker]}, {date_time}")

date_time = datetime.fromtimestamp(current_block_number)    
print(f"current block: {current_block_number}, {date_time}")