from web3 import Web3, WebsocketProvider
import time
import json
import logging
import traceback
import requests
import datetime

ADDRESS_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
BUILD_MANAGER_PATH = "NonfungiblePositionManager.json"

LATEST_BLOCK_LOG_PATH = "latest_block"
ENDPOINT_PATH = ".endpoint"
SLACK_PATH = ".slack"

def get_file_data(path):
    data = None
    with open(path, "r", encoding="utf-8") as f:
        data = f.read()

    data = data.rstrip()
    print(f"{path}: {data}")
    return data

tokens = {
    "0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2": "WTON",
    "0x409c4D8cd5d2924b9bc5509230d16a61289c8153": "TOS",
    "0x0e498afce58dE8651B983F136256fA3b8d9703bc": "DOC"
}

endpoint_url = get_file_data(ENDPOINT_PATH)
slack_url = get_file_data(SLACK_PATH)

w3 = Web3(WebsocketProvider(endpoint_url))

event_hash_IncreaseLiquidity = w3.keccak(text="IncreaseLiquidity(uint256,uint128,uint256,uint256)").hex()
event_hash_DecreaseLiquidity = w3.keccak(text="DecreaseLiquidity(uint256,uint128,uint256,uint256)").hex()

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

def format_number(num):
    if num % 1 == 0:
        return int(num)
    else:
        return num

def parse_pair(token0: str, token1: str):
    result = ""

    if token0 in tokens:
        result += tokens[token0]
    else:
        result += token0
    result += "/"
    if token1 in tokens:
        result += tokens[token1]
    else:
        result += token1

    return result

def parse_event_increased_liquidity(instance, receipt):
    log = ""
    result = instance.events.IncreaseLiquidity().processReceipt(receipt)

    newline = False
    for x in result:
        operator = ""
        tickLower = "-"
        tickUpper = "-"
        token0 = ""
        token1 = ""
        tx = w3.eth.get_transaction_receipt(x['transactionHash'])
        operator = tx['from']
        try:
            #TODO: handle MEV tx
            positions = instance.functions.positions(x['args']['tokenId']).call(block_identifier=x['blockNumber'])
#operator = positions[1]
            tickLower = positions[5]
            tickUpper = positions[6]
            token0 = positions[2]
            token1 = positions[3]
            if token0 not in tokens and token1 not in tokens:
                return None
        except Exception as e:
            print("#" * 80)
            print("error:")
#print(str(e) == "execution reverted: Invalid token ID")
            print(e)
            print(f"tx: {tx['transactionHash'].hex()}")
            return None

        pair = parse_pair(token0, token1)

        if newline:
            log += "\n"
        log += f"<https://etherscan.io/tx/{x['transactionHash'].hex()}|IncreasedLiquidity tx> - "
        log += f"{pair} - "
        log += f"from: `{operator}`, "
        log += f"liquidity: `{int(x['args']['liquidity']/1e18)}({int(x['args']['amount0']/1e18)}/{int(x['args']['amount1']/1e18)})`, "
        log += f"tickLower: `{tickLower}`, tickUpper: `{tickUpper}`"
        newline = True

    return log

def parse_event_decreased_liquidity(instance, receipt):
    log = ""
    result = instance.events.DecreaseLiquidity().processReceipt(receipt)

    newline = False
    for x in result:
        operator = ""
        tickLower = "-"
        tickUpper = "-"
        token0 = ""
        token1 = ""
        tx = w3.eth.get_transaction_receipt(x['transactionHash'])
        operator = tx['from']
        try:
            #TODO: handle MEV tx
            positions = instance.functions.positions(x['args']['tokenId']).call(block_identifier=x['blockNumber'])
#operator = positions[1]
            tickLower = positions[5]
            tickUpper = positions[6]
            token0 = positions[2]
            token1 = positions[3]
            if token0 not in tokens and token1 not in tokens:
                return None
        except Exception as e:
            print("#" * 80)
            print("error:")
            print(e)
            print(f"tx: {tx['transactionHash'].hex()}")
            return None

        pair = parse_pair(token0, token1)

        if newline:
            log += "\n"
        log += f"<https://etherscan.io/tx/{x['transactionHash'].hex()}|DecreasedLiquidity tx> - "
        log += f"{pair} - "
        log += f"from: `{operator}`, "
        log += f"liquidity: `{int(x['args']['liquidity']/1e18)}({int(x['args']['amount0']/1e18)}/{int(x['args']['amount1']/1e18)})`, "
        log += f"tickLower: `{tickLower}`, tickUpper: `{tickUpper}`"
        newline = True

    return log

def send_message(msg):
    payload = {"text": msg}
    requests.post(slack_url, json=payload)

def make_log(instance, event, receipt):
    log = ""

    block = w3.eth.getBlock(event["blockNumber"])
    tz = datetime.timezone(datetime.timedelta(hours=9))
    log += str(datetime.datetime.fromtimestamp(block["timestamp"], tz))
    log += "(KST) "

    buf = None
    if event["topics"][0].hex() == event_hash_IncreaseLiquidity:
        buf = parse_event_increased_liquidity(instance, receipt)
    elif event["topics"][0].hex() == event_hash_DecreaseLiquidity:
        buf = parse_event_decreased_liquidity(instance, receipt)
    if buf is None:
        return None
    log += buf

    return log

def get_events():
    try:
        monitoring_events = [
            event_hash_IncreaseLiquidity,
            event_hash_DecreaseLiquidity
        ]

        instance = get_contract_instance(BUILD_MANAGER_PATH, ADDRESS_MANAGER)

        from_block = get_from_block() + 1
        to_block = min(w3.eth.get_block("latest")["number"], from_block + 1000)

        if to_block < from_block:
            print("waiting for next block")
            time.sleep(60)
            return

        print(f"from_block: {from_block}")
        print(f"to_block: {to_block}")

        logs = w3.eth.getLogs({
            'fromBlock': from_block,
            'toBlock': to_block,
            'address': ADDRESS_MANAGER,
        })

        events = list(filter(lambda log: log["topics"][0].hex() in monitoring_events, logs))
        events2 = list({event["transactionHash"]:event for event in events}.values())

        msgs = []
        for event in events2:
            receipt = w3.eth.getTransactionReceipt(event["transactionHash"])
            log = make_log(instance, event, receipt)
            if log is not None:
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
