#!/usr/bin/env node
/**
 * Basic Staking Metrics 계산 스크립트
 * 매일 00:00 UTC (09:00 KST) 기준으로 메트릭 계산
 */

const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
require('dotenv').config();

const { contracts, layer2Candidates, constants } = require('./config/addresses');
const { calculateDailyBlocks, calculateBlocksInPeriod, getBlockNumberForDate } = require('./utils/blockCalculator');
const {
  callContractFunction,
  TOT_BALANCE_OF_ABI,
  TOT_TOTAL_SUPPLY_ABI,
  SEIG_TOTAL_SUPPLY_ABI,
  DEPOSIT_PENDING_UNSTAKED_ABI,
  SEIG_COINAGES_ABI
} = require('./utils/contractHelper');

// TON balanceOf ABI (ERC20)
const TON_BALANCE_OF_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}];
const SubgraphClient = require('./utils/subgraphClient');
const { getTONPrice, getUSDPrice } = require('./utils/priceApi');

// 설정
const RPC_ENDPOINT = process.env.RPC_ENDPOINT_URL || process.env.RPC_ENDPOINT;
const OUTPUT_DIR = path.join(__dirname, 'output');
const DATA_DIR = path.join(__dirname, 'data');

// 디렉토리 생성
[OUTPUT_DIR, DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * TOT 컨트랙트의 totalSupply로 전체 스테이킹된 양 조회
 */
async function getTotalStakedAmount(web3, blockNumber = 'latest') {
  try {
    const totalSupply = await callContractFunction(
      web3,
      contracts.TOT,
      TOT_TOTAL_SUPPLY_ABI,
      'totalSupply',
      [],
      blockNumber
    );
    return totalSupply ? totalSupply.toString() : '0';
  } catch (error) {
    console.error(`Error getting total staked amount: ${error.message}`);
    return '0';
  }
}

/**
 * Total Supply of TON 조회
 */
async function getTotalSupplyOfTON(web3, blockNumber = 'latest') {
  try {
    const totalSupply = await callContractFunction(
      web3,
      contracts.SeigManagerProxy,
      SEIG_TOTAL_SUPPLY_ABI,
      'totalSupplyOfTon',
      [],
      blockNumber
    );
    return totalSupply ? totalSupply.toString() : '0';
  } catch (error) {
    console.error(`Error getting total supply: ${error.message}`);
    return '0';
  }
}

/**
 * Burned amount 계산 (Address(1)의 balance 변화)
 */
async function getBurnedAmount(web3, previousBlock, currentBlock) {
  try {
    // TON 컨트랙트의 balanceOf(address(1))
    const currentBalance = await callContractFunction(
      web3,
      contracts.TON,
      TOT_BALANCE_OF_ABI,
      'balanceOf',
      [contracts.BurnAddress],
      currentBlock
    );

    const previousBalance = previousBlock ? await callContractFunction(
      web3,
      contracts.TON,
      TOT_BALANCE_OF_ABI,
      'balanceOf',
      [contracts.BurnAddress],
      previousBlock
    ) : '0';

    const burned = BigInt(currentBalance || '0') - BigInt(previousBalance || '0');
    return burned >= 0 ? burned.toString() : '0';
  } catch (error) {
    console.error(`Error getting burned amount: ${error.message}`);
    return '0';
  }
}

/**
 * Pending withdrawal amount (2주 내 출금 예정)
 */
async function getPendingWithdrawalAmount(web3, blockNumber = 'latest') {
  let totalPending = BigInt(0);

  for (const candidate of layer2Candidates) {
    try {
      const pending = await callContractFunction(
        web3,
        contracts.DepositManagerProxy,
        DEPOSIT_PENDING_UNSTAKED_ABI,
        'pendingUnstakedLayer2',
        [candidate.address],
        blockNumber
      );

      if (pending) {
        totalPending += BigInt(pending);
      }
    } catch (error) {
      console.error(`Error getting pending withdrawal for ${candidate.name}: ${error.message}`);
    }
  }

  return totalPending.toString();
}

/**
 * APY 계산 (Seigniorage 기반)
 */
async function calculateAPY(web3, subgraph, fromBlock, toBlock, totalStaked) {
  try {
    // Seigniorage 이벤트 조회
    const query = `
      query GetSeigniorage($fromBlock: BigInt!, $toBlock: BigInt!) {
        seigGiven2s(
          where: {
            transaction_: {
              blockNumber_gte: $fromBlock
              blockNumber_lte: $toBlock
            }
          }
        ) {
          stakedSeig
        }
      }
    `;

    const result = await subgraph.query(query, { fromBlock, toBlock });
    let totalSeig = BigInt(0);

    if (result.data?.seigGiven2s) {
      for (const event of result.data.seigGiven2s) {
        totalSeig += BigInt(event.stakedSeig || '0');
      }
    }

    // APY 계산: (totalSeig / totalStaked) * (blocks_per_year / blocks_in_period) * 100
    const blocksInPeriod = toBlock - fromBlock;
    const blocksPerYear = Math.floor(365 * 24 * 60 * 60 / 12); // Ethereum block time ~12s

    if (totalStaked > 0 && blocksInPeriod > 0) {
      const seigDecimal = parseFloat(totalSeig.toString()) / 1e27;
      const stakedDecimal = parseFloat(totalStaked) / 1e27;
      const apy = (seigDecimal / stakedDecimal) * (blocksPerYear / blocksInPeriod) * 100;
      return apy;
    }

    return 0;
  } catch (error) {
    console.error(`Error calculating APY: ${error.message}`);
    return 0;
  }
}

/**
 * 단일 날짜의 메트릭 계산
 */
async function calculateMetricsForDate(web3, subgraph, date, previousBlock, currentBlock) {
  console.log(`\n📊 Calculating metrics for ${date} (Block ${currentBlock})...`);

  const metrics = {
    date: date,
    criterion_block_number: currentBlock,
    previous_block_number: previousBlock || null,
    blocks_in_period: previousBlock ? calculateBlocksInPeriod(previousBlock, currentBlock) : 0
  };

  try {
    // 1. Total Supply of TON
    console.log('  📈 Getting total supply of TON...');
    metrics.total_supply_ton = await getTotalSupplyOfTON(web3, currentBlock);
    metrics.total_supply_ton_decimal = parseFloat(metrics.total_supply_ton) / 1e27;
    console.log('  metrics.total_supply_ton : ', metrics.total_supply_ton);
    console.log('  metrics.total_supply_ton_decimal : ', metrics.total_supply_ton_decimal);


    // 2. Total Staked Amount
    console.log('  💰 Getting total staked amount...');
    metrics.total_staked_amount = await getTotalStakedAmount(web3, currentBlock);
    metrics.total_staked_amount_decimal = parseFloat(metrics.total_staked_amount) / 1e27;
    console.log('  metrics.total_staked_amount : ', metrics.total_staked_amount);
    console.log('  metrics.total_staked_amount_decimal : ', metrics.total_staked_amount_decimal);

    // 3. Total Liquidity Amount
    // total_liquidity = total_supply - total_staked - DAOVault balance (TON)
    console.log('  🏦 Getting DAOVault balance (TON)...');

    // DAOVault의 TON 잔액 (TON은 ERC20이므로 18 decimals)
    const daoVaultTONBalanceRaw = await callContractFunction(
      web3,
      contracts.TON,
      TON_BALANCE_OF_ABI,
      'balanceOf',
      [contracts.DAOVault],
      currentBlock
    );

    // TON은 18 decimals이므로 ray 단위(27 decimals)로 변환
    // 18 decimals -> 27 decimals: multiply by 10^9
    const daoVaultTONInRay = BigInt(daoVaultTONBalanceRaw || '0') * BigInt(10 ** 9);
    console.log(`    DAOVault TON balance: ${daoVaultTONBalanceRaw} (${daoVaultTONInRay.toString()} in ray)`);


    metrics.total_liquidity_amount = (
      BigInt(metrics.total_supply_ton) - BigInt(metrics.total_staked_amount) - daoVaultTONInRay
    ).toString();
    metrics.total_liquidity_amount_decimal = parseFloat(metrics.total_liquidity_amount) / 1e27;
    console.log('  metrics.total_liquidity_amount : ', metrics.total_liquidity_amount);
    console.log('  metrics.total_liquidity_amount_decimal : ', metrics.total_liquidity_amount_decimal);

    console.log('  metrics.blocks_in_period : ', metrics.blocks_in_period);

    // 4. Amount Issued (Seigniorage)
    if (metrics.blocks_in_period > 0) {
      const seignioragePerBlock = BigInt(constants.SEIGNIORAGE_PER_BLOCK);
      metrics.amount_issued = (seignioragePerBlock * BigInt(metrics.blocks_in_period)).toString();
      metrics.amount_issued_decimal = parseFloat(metrics.amount_issued) / 1e27;
    } else {
      metrics.amount_issued = '0';
      metrics.amount_issued_decimal = 0;
    }
    console.log('  metrics.amount_issued : ', metrics.amount_issued);
    console.log('  metrics.amount_issued_decimal : ', metrics.amount_issued_decimal);

    // 5. Amount Burned
    console.log('  🔥 Getting burned amount...');
    metrics.amount_burned = await getBurnedAmount(web3, previousBlock, currentBlock);
    metrics.amount_burned_decimal = parseFloat(metrics.amount_burned) / 1e27;
    console.log('  metrics.amount_burned : ', metrics.amount_burned);
    console.log('  metrics.amount_burned_decimal : ', metrics.amount_burned_decimal);

    // 6. Additional Staking Amount (Deposited events)
    if (previousBlock && metrics.blocks_in_period > 0) {
      console.log('  📥 Getting deposited amount from subgraph...');
      metrics.additional_staking_amount = await subgraph.getTotalDepositedAmount(previousBlock, currentBlock);
      metrics.additional_staking_amount_decimal = parseFloat(metrics.additional_staking_amount) / 1e27;
    } else {
      metrics.additional_staking_amount = '0';
      metrics.additional_staking_amount_decimal = 0;
    }
    console.log('  metrics.additional_staking_amount : ', metrics.additional_staking_amount);
    console.log('  metrics.additional_staking_amount_decimal : ', metrics.additional_staking_amount_decimal);
    // 7. Withdrawal Amount (WithdrawalAndDeposited events)
    if (previousBlock && metrics.blocks_in_period > 0) {
      console.log('  📤 Getting withdrawal amount from subgraph...');
      metrics.withdrawal_amount = await subgraph.getTotalWithdrawalAndDepositedAmount(previousBlock, currentBlock);
      metrics.withdrawal_amount_decimal = parseFloat(metrics.withdrawal_amount) / 1e27;
    } else {
      metrics.withdrawal_amount = '0';
      metrics.withdrawal_amount_decimal = 0;
    }
    console.log('  metrics.withdrawal_amount : ', metrics.withdrawal_amount);
    console.log('  metrics.withdrawal_amount_decimal : ', metrics.withdrawal_amount_decimal);
    // 8. Pending Withdrawal (2 weeks)
    console.log('  ⏳ Getting pending withdrawal amount...');
    metrics.pending_withdrawal_2weeks = await getPendingWithdrawalAmount(web3, currentBlock);
    metrics.pending_withdrawal_2weeks_decimal = parseFloat(metrics.pending_withdrawal_2weeks) / 1e27;
    console.log('  metrics.pending_withdrawal_2weeks : ', metrics.pending_withdrawal_2weeks);
    console.log('  metrics.pending_withdrawal_2weeks_decimal : ', metrics.pending_withdrawal_2weeks_decimal);
    // 9. APY
    if (previousBlock && metrics.blocks_in_period > 0) {
      console.log('  📊 Calculating APY...');
      metrics.apy = await calculateAPY(web3, subgraph, previousBlock, currentBlock, metrics.total_staked_amount);
    } else {
      metrics.apy = 0;
    }
    console.log('  metrics.apy : ', metrics.apy);

    // 10. TON Price (USD로 변환)
    console.log('  💵 Getting TON price...');
    const dateObj = new Date(date + 'T00:00:00Z');
    const timestamp = Math.floor(dateObj.getTime() / 1000);
    // TON 가격 조회 (KRW)
    const priceData = await getTONPrice(timestamp);
    let tonPriceKRW = priceData?.price || null;

    // USD로 변환
    // open.er-api.com의 rates.USD는 1 KRW = X USD 형식 (예: 0.0007)
    // 따라서 KRW 가격 * rates.USD = USD 가격
    if (tonPriceKRW) {
      const usdRate = await getUSDPrice();
      if (usdRate) {
        // usdRate가 1 KRW = X USD 형식이므로 곱하기
        metrics.ton_price = tonPriceKRW * usdRate;
        metrics.ton_price_currency = 'USD';
        console.log(`    TON price (KRW): ${tonPriceKRW}, USD rate (1 KRW = ${usdRate} USD): ${usdRate}`);
      } else {
        // USD 환율 조회 실패 시 KRW 가격 사용
        metrics.ton_price = tonPriceKRW;
        metrics.ton_price_currency = priceData?.currency || 'KRW';
        console.log('    ⚠️  USD exchange rate not available, using KRW price');
      }
    } else {
      metrics.ton_price = null;
      metrics.ton_price_currency = null;
    }
    console.log('  metrics.ton_price : ', metrics.ton_price);
    console.log('  metrics.ton_price_currency : ', metrics.ton_price_currency);

    console.log(`  ✅ Completed: ${date}`);
    return metrics;
  } catch (error) {
    console.error(`  ❌ Error calculating metrics for ${date}: ${error.message}`);
    throw error;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Tokamak Network Basic Staking Metrics Calculator');
  console.log('='.repeat(80));
  console.log();

  if (!RPC_ENDPOINT) {
    console.error('❌ RPC_ENDPOINT_URL or RPC_ENDPOINT not set in .env file');
    process.exit(1);
  }

  // Web3 초기화
  const web3 = new Web3(RPC_ENDPOINT);

  // 연결 확인
  try {
    const blockNumber = await web3.eth.getBlockNumber();
    console.log(`✅ Connected to Ethereum. Latest block: ${blockNumber}`);
  } catch (error) {
    console.error(`❌ Failed to connect to Ethereum: ${error.message}`);
    process.exit(1);
  }

  // Subgraph 클라이언트 초기화
  const subgraph = new SubgraphClient();

  // 일일 블록 번호 로드 또는 계산
  let dailyBlocks = [];
  const blockNumbersFile = path.join(DATA_DIR, 'daily_block_numbers.json');

  if (fs.existsSync(blockNumbersFile)) {
    console.log('\n📅 Loading daily block numbers from file...');
    try {
      const fileContent = fs.readFileSync(blockNumbersFile, 'utf-8');
      dailyBlocks = JSON.parse(fileContent);
      console.log(`✅ Loaded ${dailyBlocks.length} block numbers from file`);
      console.log(`   Date range: ${dailyBlocks[0].date} ~ ${dailyBlocks[dailyBlocks.length - 1].date}`);
    } catch (error) {
      console.error(`⚠️  Error loading block numbers file: ${error.message}`);
      console.log('   Calculating block numbers instead...');
      dailyBlocks = await calculateDailyBlocks(web3);
    }
  } else {
    console.log('\n📅 Block numbers file not found. Calculating daily block numbers (3 years)...');
    console.log('   💡 Tip: Run "node prepare_block_numbers.js" first to save time');
    dailyBlocks = await calculateDailyBlocks(web3);
  }

  // CSV 헤더 준비
  const csvHeader = [
    'date',
    'criterion_block_number',
    'previous_block_number',
    'blocks_in_period',
    'total_supply_ton',
    'total_supply_ton_decimal',
    'total_staked_amount',
    'total_staked_amount_decimal',
    'total_liquidity_amount',
    'total_liquidity_amount_decimal',
    'amount_issued',
    'amount_issued_decimal',
    'amount_burned',
    'amount_burned_decimal',
    'additional_staking_amount',
    'additional_staking_amount_decimal',
    'withdrawal_amount',
    'withdrawal_amount_decimal',
    'pending_withdrawal_2weeks',
    'pending_withdrawal_2weeks_decimal',
    'apy',
    'ton_price',
    'ton_price_currency'
  ];

  const allMetrics = [];

  // 각 날짜별 메트릭 계산
  for (let i = 0; i < dailyBlocks.length; i++) {
    const current = dailyBlocks[i];
    let previousBlock = null;

    // 이전 블록 번호 찾기
    if (i > 0) {
      // 이전 날짜가 있으면 그 블록 번호 사용
      previousBlock = dailyBlocks[i - 1].blockNumber;
    } else {
      // 첫 번째 날짜인 경우, 이전 날짜(하루 전)의 0시 블록 번호 계산
      try {
        const currentDate = new Date(current.date + 'T00:00:00Z');
        const previousDate = new Date(currentDate);
        previousDate.setUTCDate(previousDate.getUTCDate() - 1);

        console.log(`\n📅 Calculating previous block for first date: ${current.date}`);
        console.log(`   Previous date: ${previousDate.toISOString().split('T')[0]}`);

        previousBlock = await getBlockNumberForDate(previousDate, web3);
        console.log(`   ✅ Previous block number: ${previousBlock}`);
      } catch (error) {
        console.error(`   ⚠️  Could not calculate previous block: ${error.message}`);
        console.error(`   Continuing with previousBlock = null`);
        previousBlock = null;
      }
    }

    try {
      const metrics = await calculateMetricsForDate(
        web3,
        subgraph,
        current.date,
        previousBlock,
        current.blockNumber
      );

      allMetrics.push(metrics);

      // 진행 상황 출력
      if ((i + 1) % 10 === 0) {
        console.log(`\n📊 Progress: ${i + 1}/${dailyBlocks.length} dates processed`);
      }
    } catch (error) {
      console.error(`Failed to calculate metrics for ${current.date}: ${error.message}`);
      // 에러가 나도 계속 진행
    }
  }

  // CSV 파일로 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvFilename = path.join(OUTPUT_DIR, `basic_staking_metrics_${timestamp}.csv`);

  // csv-stringify는 객체 배열을 받아야 함
  const csvData = allMetrics.map(m => ({
    date: m.date,
    criterion_block_number: m.criterion_block_number,
    previous_block_number: m.previous_block_number || '',
    blocks_in_period: m.blocks_in_period,
    total_supply_ton: m.total_supply_ton,
    total_supply_ton_decimal: m.total_supply_ton_decimal,
    total_staked_amount: m.total_staked_amount,
    total_staked_amount_decimal: m.total_staked_amount_decimal,
    total_liquidity_amount: m.total_liquidity_amount,
    total_liquidity_amount_decimal: m.total_liquidity_amount_decimal,
    amount_issued: m.amount_issued,
    amount_issued_decimal: m.amount_issued_decimal,
    amount_burned: m.amount_burned,
    amount_burned_decimal: m.amount_burned_decimal,
    additional_staking_amount: m.additional_staking_amount,
    additional_staking_amount_decimal: m.additional_staking_amount_decimal,
    withdrawal_amount: m.withdrawal_amount,
    withdrawal_amount_decimal: m.withdrawal_amount_decimal,
    pending_withdrawal_2weeks: m.pending_withdrawal_2weeks,
    pending_withdrawal_2weeks_decimal: m.pending_withdrawal_2weeks_decimal,
    apy: m.apy,
    ton_price: m.ton_price || '',
    ton_price_currency: m.ton_price_currency || ''
  }));

  const csvOutput = stringify(csvData, {
    header: true,
    columns: csvHeader
  });

  fs.writeFileSync(csvFilename, csvOutput, 'utf-8');

  console.log('\n' + '='.repeat(80));
  console.log('✅ Calculation completed!');
  console.log(`📄 Output file: ${csvFilename}`);
  console.log(`📊 Total records: ${allMetrics.length}`);
  console.log('='.repeat(80));
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  calculateMetricsForDate,
  getTotalStakedAmount,
  getTotalSupplyOfTON,
  getBurnedAmount,
  getPendingWithdrawalAmount,
  calculateAPY
};

