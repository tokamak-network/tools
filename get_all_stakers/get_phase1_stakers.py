import json
import sys
import time
import pprint
from web3 import Web3, WebsocketProvider
from datetime import datetime
import asyncio

RPC_ENDPOINT = "YOUR_INFURA_URL"

ADDRESS_DEPOSIT_MANAGER = "0x56E465f654393fa48f007Ed7346105c7195CEe43"
PATH_DEPOSIT_MANAGER = "DepositManager.json"
PATH_STAKE_TON = "StakeTONProxy.json"

BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED = 10837675
BLOCK_NUMBER_EVENT_START = 12223496
BLOCK_NUMBER_SNAPSHOT = 14995351

stake_ton_contract_addresses = [
    "0x9a8294566960Ab244d78D266FFe0f284cDf728F1"
]

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

def get_stakers(w3, contract_address, from_block, to_block):
    event_signature_hash = w3.keccak(text="Staked(address,uint256)").hex()
    logs = w3.eth.getLogs({
        'fromBlock': from_block,
        'toBlock': to_block,
        'address': contract_address,
        "topics": [event_signature_hash]
    })

    txs = list(map(lambda x: (x["blockNumber"], x["transactionHash"].hex()), logs))

    stakers = set([])
    stakers_block = {}

    accumulateAmount = {}

    instance = get_contract_instance(w3, PATH_STAKE_TON, contract_address)    
    end_block = instance.functions.endBlock().call()
    print(f"end_block: {end_block}")
    for tx in txs:
        receipt = w3.eth.getTransactionReceipt(tx[1])
        
        tmp = instance.events.Staked().processReceipt(receipt)
        params = tmp[0]["args"]

        if params["to"] not in accumulateAmount:
            accumulateAmount[params["to"]] = params["amount"]
        else:
            accumulateAmount[params["to"]] += params["amount"]

    current_balances = {}
    for k, v in accumulateAmount.items():
        currentAmount = instance.functions.getUserStaked(k).call(block_identifier=BLOCK_NUMBER_SNAPSHOT)
        if k not in current_balances:
            current_balances[k] = currentAmount[0]
        else:
            current_balances[k] += currentAmount[0]

    return current_balances

def get_phase1_stakers():
    w3 = Web3(WebsocketProvider(RPC_ENDPOINT))

    current_balances = {}
    for x in stake_ton_contract_addresses:
        balances = get_stakers(w3, x, 12880649, BLOCK_NUMBER_SNAPSHOT)
        for k, v in balances.items():
            if k not in current_balances:
                current_balances[k] = float(v)/1e18
            else:
                current_balances[k] += float(v)/1e18
    ordered = sorted(current_balances.items(), key=lambda x: x[1], reverse=True)
    return ordered

if __name__ == '__main__':
    ordered = get_phase1_stakers()
    print("#" * 80)
    print("#" * 80)
    print(ordered)
    for x in ordered:
        print(f"{x[0]}: {x[1]:.4f}")