from web3 import Web3, WebsocketProvider
import time
import json
import logging
import traceback
import requests
import datetime

ADDRESS_DEPOSIT_MANAGER = "0x56E465f654393fa48f007Ed7346105c7195CEe43"
BUILD_DEPOSIT_MANAGER_PATH = "DepositManager.json"

LATEST_BLOCK_LOG_PATH = "latest_block"
ENDPOINT_PATH = ".endpoint"
SLACK_PATH = ".slack"

def get_file_data(path):
    data = None
    with open(path, "r", encoding="utf-8") as f:
        data = f.read()

    print(f"{path}: {data}")
    return data

endpoint_url = get_file_data(ENDPOINT_PATH)
slack_url = get_file_data(SLACK_PATH)

w3 = Web3(WebsocketProvider(endpoint_url))

event_hash_deposited = w3.keccak(text="Deposited(address,address,uint256)").hex()
event_hash_withdrawal_requested = w3.keccak(text="WithdrawalRequested(address,address,uint256)").hex()
event_hash_withdrawal_processed = w3.keccak(text="WithdrawalProcessed(address,address,uint256)").hex()

def get_from_block():
    from_block = w3.eth.get_block("latest")["number"]
    try:
        with open(LATEST_BLOCK_LOG_PATH, "r", encoding="utf-8") as f:
            from_block = int(f.read())
    except:
        pass

    print(f"from_block: {from_block}")
    return from_block

def read_contract(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def get_contract_instance(path, address):
    compiled = read_contract(path)
    instance = w3.eth.contract(
        address=address,
        abi=compiled["abi"])
    return instance

def save_latest_block(block_number):
    with open(LATEST_BLOCK_LOG_PATH, "w", encoding="utf-8") as f:
        f.write(str(block_number))

layer2s = {
    "0x39A13a796A3Cd9f480C28259230D2EF0a7026033": "Tokamak1",
    "0x42CCF0769e87CB2952634F607DF1C7d62e0bBC52": "Level 19",
    "0xBC8896Ebb2E3939B1849298Ef8da59E09946cF66": "DSRV",
    "0xCc38C7aaf2507da52A875e93F57451e58E8c6372": "staked",
    "0xB9D336596Ea2662488641c4AC87960BFdCb94c6e": "Talken",
    "0x17602823b5fE43a65aD7122946A73B019e77fD33": "decipher",
    "0x41fb4bAD6fbA9e9b6E45F3f96bA3ad7Ec2fF5b3C": "DXM Corp",
    "0x2000fC16911FC044130c29C1Aa49D3E0B101716a": "DeSpread",
    "0x97d0a5880542ab0e699c67e7f4ff61f2e5200484": "Danal Fintech"
}

def get_layer2_name(layer2: str):
    name = "Unknown"
    try:
        name = layer2s[layer2]
    except:
        pass
    return name

def format_number(num):
    if num % 1 == 0:
        return int(num)
    else:
        return num

def parse_event_deposited(instance, receipt):
    log = ""
    result = instance.events.Deposited().processReceipt(receipt)

    newline = False
    for x in result:
        if newline:
            log += "\n"
        log += f"<https://etherscan.io/tx/{x['transactionHash'].hex()}|Deposited tx> - "
        log += f"depositor: `{x['args']['depositor']}`, "
        log += f"{get_layer2_name(x['args']['layer2'])},"
        log += f" `{format_number(x['args']['amount'] / 1e27)}` TON"
        newline = True

    return log

def parse_event_requested(instance, receipt):
    log = ""
    result = instance.events.WithdrawalRequested().processReceipt(receipt)

    newline = False
    for x in result:
        if newline:
            log += "\n"
        log += f"<https://etherscan.io/tx/{x['transactionHash'].hex()}|Withdrawal Requested tx> - "
        log += f"depositor: `{x['args']['depositor']}`, "
        log += f"{get_layer2_name(x['args']['layer2'])},"
        log += f" `{format_number(x['args']['amount'] / 1e27)}` TON"
        newline = True

    return log

def parse_event_processed(instance, receipt):
    log = ""
    result = instance.events.WithdrawalProcessed().processReceipt(receipt)

    newline = False
    for x in result:
        if newline:
            log += "\n"
        log += f"<https://etherscan.io/tx/{x['transactionHash'].hex()}|Withdrawal Processed tx> - "
        log += f"depositor: `{x['args']['depositor']}`, "
        log += f"{get_layer2_name(x['args']['layer2'])},"
        log += f" `{format_number(x['args']['amount'] / 1e27)}` TON"
        newline = True

    return log

def send_message(msg):
    payload = {"text": msg}
    requests.post(slack_url, json=payload)

def make_log(instance, event, receipt):
    log = ""

    block = w3.eth.getBlock(event["blockNumber"])
    log += str(datetime.datetime.fromtimestamp(block["timestamp"]))
    log += "(KST) "

    if event["topics"][0].hex() == event_hash_deposited:
        log += parse_event_deposited(instance, receipt)
    elif event["topics"][0].hex() == event_hash_withdrawal_requested:
        log += parse_event_requested(instance, receipt)
    elif event["topics"][0].hex() == event_hash_withdrawal_processed:
        log += parse_event_processed(instance, receipt)

    return log

def get_events():
    try:
        monitoring_events = [
            event_hash_deposited,
            event_hash_withdrawal_requested,
            event_hash_withdrawal_processed
        ]

        instance = get_contract_instance(BUILD_DEPOSIT_MANAGER_PATH, ADDRESS_DEPOSIT_MANAGER)

        from_block = get_from_block() + 1
        to_block = min(w3.eth.get_block("latest")["number"], from_block + 100)

        if to_block < from_block:
            print("waiting for next block")
            time.sleep(60)
            return

        logs = w3.eth.getLogs({
            'fromBlock': from_block,
            'toBlock': to_block,
            'address': ADDRESS_DEPOSIT_MANAGER,
        })

        events = list(filter(lambda log: log["topics"][0].hex() in monitoring_events, logs))
        events2 = list({event["transactionHash"]:event for event in events}.values())

        msgs = []
        for event in events2:
            receipt = w3.eth.getTransactionReceipt(event["transactionHash"])
            log = make_log(instance, event, receipt)
            msgs.append(log)

        for msg in msgs:
            print("$"*80)
            print("msg:", msg)
            send_message(msg)

        save_latest_block(to_block)
    except Exception as e:
        logging.error(traceback.format_exc())
        time.sleep(60)


def main():
    while True:
        get_events()

if __name__ == '__main__':
    main()
