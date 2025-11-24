/**
 * 컨트랙트 호출 헬퍼
 */

const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

/**
 * ABI 파일에서 특정 함수의 ABI만 추출
 */
function getFunctionABI(functionName, abiArray) {
  return abiArray.find(item =>
    item.type === 'function' && item.name === functionName
  );
}

/**
 * 간단한 함수 ABI 생성 (balanceOf 등)
 */
function createSimpleABI(functionName, inputType, outputType) {
  return [{
    inputs: inputType ? [{ name: 'account', type: inputType }] : [],
    name: functionName,
    outputs: [{ name: '', type: outputType }],
    stateMutability: 'view',
    type: 'function'
  }];
}

/**
 * TOT 컨트랙트의 balanceOf ABI
 */
const TOT_BALANCE_OF_ABI = createSimpleABI('balanceOf', 'address', 'uint256');

/**
 * TOT 컨트랙트의 totalSupply ABI
 */
const TOT_TOTAL_SUPPLY_ABI = [{
  inputs: [],
  name: 'totalSupply',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}];

/**
 * SeigManager의 totalSupplyOfTon ABI
 */
const SEIG_TOTAL_SUPPLY_ABI = [{
  inputs: [],
  name: 'totalSupplyOfTon',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}];

/**
 * DepositManager의 pendingUnstakedLayer2 ABI
 */
const DEPOSIT_PENDING_UNSTAKED_ABI = [{
  inputs: [{ name: 'layer2', type: 'address' }],
  name: 'pendingUnstakedLayer2',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}];

/**
 * SeigManager의 coinages 함수 ABI (coinage 주소 가져오기)
 */
const SEIG_COINAGES_ABI = [{
  inputs: [{ name: '', type: 'address' }],
  name: 'coinages',
  outputs: [{ name: '', type: 'address' }],
  stateMutability: 'view',
  type: 'function'
}];

/**
 * 컨트랙트 인스턴스 생성
 */
function getContract(web3, address, abi) {
  return new web3.eth.Contract(abi, address);
}

/**
 * 특정 블록에서 컨트랙트 함수 호출
 */
async function callContractFunction(web3, address, abi, functionName, params = [], blockNumber = 'latest') {
  const contract = getContract(web3, address, abi);
  const method = contract.methods[functionName](...params);
  return await method.call(undefined, blockNumber);
}

module.exports = {
  getFunctionABI,
  createSimpleABI,
  getContract,
  callContractFunction,
  TOT_BALANCE_OF_ABI,
  TOT_TOTAL_SUPPLY_ABI,
  SEIG_TOTAL_SUPPLY_ABI,
  DEPOSIT_PENDING_UNSTAKED_ABI,
  SEIG_COINAGES_ABI
};

