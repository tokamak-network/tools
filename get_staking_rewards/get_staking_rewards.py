import json
from web3 import Web3, HTTPProvider

ADDRESS_DEPOSIT_MANAGER = "0x56E465f654393fa48f007Ed7346105c7195CEe43"
PATH_DEPOSIT_MANAGER = "DepositManager.json"

ADDRESS_SEIG_MANAGER = "0x710936500aC59e8551331871Cbad3D33d5e0D909"
PATH_SEIG_MANAGER = "SeigManager.json"

PATH_COINAGE = "AutoRefactorCoinage.json"

rpc_url = "INSERT YOUR URL"

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


w3 = Web3(HTTPProvider(rpc_url))
instance_deposit_manager = get_contract_instance(w3, PATH_DEPOSIT_MANAGER, ADDRESS_DEPOSIT_MANAGER)
instance_seig_manager = get_contract_instance(w3, PATH_SEIG_MANAGER, ADDRESS_SEIG_MANAGER)

event_signature_hash_deposited = w3.keccak(text="Deposited(address,address,uint256)").hex()
event_signature_hash_comitted = w3.keccak(text="Comitted(address)").hex()

def get_staked_tx(address, layer2, from_block, to_block):
    logs = w3.eth.getLogs({
        'fromBlock': from_block,
        'toBlock': to_block,
        'address': ADDRESS_DEPOSIT_MANAGER,
        "topics": [event_signature_hash_deposited]
    })

    txs = list(map(lambda x: (x["blockNumber"], x["transactionHash"].hex()), logs))

    staked_info = []
    for tx in txs:
        receipt = w3.eth.getTransactionReceipt(tx[1])
        
        tmp = instance_deposit_manager.events.Deposited().processReceipt(receipt)
        depositor = tmp[0]["args"]["depositor"]
        if depositor == address:
            staked_info.append((tx[0], tx[1]))
    
    min_block = min([x[0] for x in staked_info])

    logs = w3.eth.getLogs({
        'fromBlock': min_block,
        'address': ADDRESS_SEIG_MANAGER,
        "topics": [event_signature_hash_comitted, "0x" + layer2[2:].zfill(64)]
    })

    blocks = list(map(lambda x: x["blockNumber"], logs))
    blocks = sorted(blocks)

    coinage_address = instance_seig_manager.functions.coinages(layer2).call()
    instance_coinage = get_contract_instance(w3, PATH_COINAGE, coinage_address)

    rewards = []
    for block in blocks:
        balance1 = instance_coinage.functions.balanceOf(address).call(block_identifier=block-1)
        balance2 = instance_coinage.functions.balanceOf(address).call(block_identifier=block)
        rewards.append((block, balance2 - balance1))

    return rewards

staker_address = ""
layer2_address = ""
from_block = "10837698"
to_block = "12000000"

rewards = get_staked_tx(staker_address, layer2_address, from_block, to_block)
for reward in rewards:
    print(f"block: {reward[0]}, reward: {reward[1]}")
print(f"total reward: {sum([x[1] for x in rewards])}")