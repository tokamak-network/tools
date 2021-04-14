import json
import sys
import time
import pprint
from web3 import Web3, WebsocketProvider
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

    txs = list(map(lambda x: x["transactionHash"].hex(), logs))

    stakers = set([])

    for tx in txs:
        receipt = w3.eth.getTransactionReceipt(tx)
        
        tmp = instance.events.Deposited().processReceipt(receipt)
        stakers.add(tmp[0]["args"]["depositor"])
    return stakers

original_stakers = get_stakers(w3, BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED, BLOCK_NUMBER_EVENT_START)

current_block_number = w3.eth.getBlock("latest")["number"]
new_stakers = get_stakers(w3, BLOCK_NUMBER_EVENT_START-1, current_block_number)
new_stakers = new_stakers - original_stakers

print(new_stakers)
