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

ADDRESS_SEIG_MANAGER = "0x710936500aC59e8551331871Cbad3D33d5e0D909"
PATH_SEIG_MANAGER = "SeigManager.json"

BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED = 10837675
BLOCK_NUMBER_SNAPSHOT = 14995351

layer2s = [
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

def get_stakers(w3, from_block, to_block):
    instance = get_contract_instance(w3, PATH_DEPOSIT_MANAGER, ADDRESS_DEPOSIT_MANAGER)
    event_signature_hash = w3.keccak(text="Deposited(address,address,uint256)").hex()
    logs = w3.eth.getLogs({
        'fromBlock': from_block,
        'toBlock': to_block,
        'address': ADDRESS_DEPOSIT_MANAGER,
        "topics": [event_signature_hash]
    })

    txs = list(map(lambda x: (x["blockNumber"], x["transactionHash"].hex()), logs))

    stakers = set([])

    for tx in txs:
        receipt = w3.eth.getTransactionReceipt(tx[1])

        tmp = instance.events.Deposited().processReceipt(receipt)
        depositor = tmp[0]["args"]["depositor"]
        stakers.add(depositor)

    return stakers

def get_total_staked_amount(instance_seigmanager, account):
    staked_amount = 0
    for layer2 in layer2s:
        staked_amount += instance_seigmanager.functions.stakeOf(layer2, account).call()
    return staked_amount

def get_all_stakers():
    w3 = Web3(WebsocketProvider(RPC_ENDPOINT))
    current_block_number = w3.eth.getBlock("latest")["number"]
    stakers = get_stakers(w3, BLOCK_NUMBER_DEPOSIT_MANAGER_CREATED, BLOCK_NUMBER_SNAPSHOT)

    instance_seigmanager = get_contract_instance(w3, PATH_SEIG_MANAGER, ADDRESS_SEIG_MANAGER)

    stakers_ordered = []
    for staker in stakers:
        amount = get_total_staked_amount(instance_seigmanager, staker)
        stakers_ordered.append((staker, amount))

    stakers_ordered.sort(key=lambda x: x[1], reverse=True)
    return stakers_ordered

if __name__ == '__main__':
    ordered = get_all_stakers()
    for x in ordered:
        print(f"{x[0]}: {float(x[1])/1e27:.4f}")