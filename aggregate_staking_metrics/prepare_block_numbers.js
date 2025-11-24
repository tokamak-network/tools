#!/usr/bin/env node
/**
 * 일일 기준 블록 번호 사전 계산 스크립트
 * 매일 00:00 UTC (09:00 KST) 기준 블록 번호를 계산하여 파일로 저장
 */

const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
require('dotenv').config();

const { calculateDailyBlocks } = require('./utils/blockCalculator');

// 설정
const RPC_ENDPOINT = process.env.RPC_ENDPOINT_URL || process.env.RPC_ENDPOINT;
const DATA_DIR = path.join(__dirname, 'data');

// 디렉토리 생성
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Tokamak Network Daily Block Numbers Calculator');
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

  // 시작 날짜 설정 (2025년 11월부터 현재까지)
  const startDate = new Date('2025-11-21T00:00:00Z'); // 2025년 11월 21일 00:00 UTC
  const today = new Date();
  const endDate = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    0, 0, 0, 0
  )); // 오늘 00:00 UTC (미래 블록은 계산하지 않음)

  console.log(`\n📅 Calculating daily block numbers from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`);
  console.log(`   (00:00 UTC / 09:00 KST each day)`);
  console.log(`   ⚠️  Only past and current dates will be calculated (future blocks don't exist yet)\n`);

  // 일일 블록 번호 계산 (과거부터 현재까지만)
  const dailyBlocks = await calculateDailyBlocks(web3, startDate, endDate);

  if (dailyBlocks.length === 0) {
    console.error('❌ No block numbers calculated');
    process.exit(1);
  }

  // CSV 파일로 저장
  const csvFilename = path.join(DATA_DIR, 'daily_block_numbers.csv');

  // csv-stringify는 객체 배열을 받아야 함
  const csvData = dailyBlocks.map(block => ({
    date: block.date,
    block_number: block.blockNumber,
    timestamp: block.timestamp
  }));

  const csvOutput = stringify(csvData, {
    header: true
  });

  fs.writeFileSync(csvFilename, csvOutput, 'utf-8');

  // JSON 파일로도 저장 (더 읽기 쉬움)
  const jsonFilename = path.join(DATA_DIR, 'daily_block_numbers.json');
  fs.writeFileSync(jsonFilename, JSON.stringify(dailyBlocks, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(80));
  console.log('✅ Block numbers calculation completed!');
  console.log(`📄 CSV file: ${csvFilename}`);
  console.log(`📄 JSON file: ${jsonFilename}`);
  console.log(`📊 Total dates: ${dailyBlocks.length}`);
  console.log(`📅 Date range: ${dailyBlocks[0].date} ~ ${dailyBlocks[dailyBlocks.length - 1].date}`);
  console.log(`🔢 Block range: ${dailyBlocks[0].blockNumber} ~ ${dailyBlocks[dailyBlocks.length - 1].blockNumber}`);
  console.log('='.repeat(80));
  console.log('\n💡 Tip: You can now use this file in calculate_metrics.js');
  console.log('   The file will be automatically loaded if it exists.\n');
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };

