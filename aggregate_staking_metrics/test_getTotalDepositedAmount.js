#!/usr/bin/env node
/**
 * getTotalDepositedAmount 함수 테스트 스크립트
 *
 * 사용법:
 *   node test_getTotalDepositedAmount.js <fromBlock> <toBlock> [--details]
 *
 * 예시:
 *   node test_getTotalDepositedAmount.js 18000000 18100000
 *   node test_getTotalDepositedAmount.js 18000000 18100000 --details
 */

require('dotenv').config();
const SubgraphClient = require('./utils/subgraphClient');

async function testGetTotalDepositedAmount(fromBlock, toBlock, includeDetails = false) {
  console.log('='.repeat(80));
  console.log('Testing getTotalDepositedAmount');
  console.log('='.repeat(80));
  console.log();

  // Subgraph 클라이언트 초기화
  const subgraph = new SubgraphClient();

  console.log(`📊 Block Range: ${fromBlock} ~ ${toBlock}`);
  console.log(`📦 Block Count: ${toBlock - fromBlock + 1}`);
  console.log(`🔍 Include Details: ${includeDetails ? 'Yes' : 'No'}`);
  console.log();

  try {
    console.log('🔍 Querying subgraph...');
    const startTime = Date.now();

    const result = await subgraph.getTotalDepositedAmount(fromBlock, toBlock, includeDetails);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log();
    console.log('✅ Result:');

    if (includeDetails && typeof result === 'object') {
      console.log(`   Total Deposited Amount (raw): ${result.totalAmount}`);
      console.log(`   Total Deposited Amount (decimal): ${result.totalAmountDecimal}`);
      console.log(`   Event Count: ${result.eventCount}`);
      console.log(`   Query Duration: ${duration}s`);

      if (result.events && result.events.length > 0) {
        console.log();
        console.log('📋 Sample Events (first 5):');
        result.events.slice(0, 5).forEach((event, idx) => {
          console.log(`   [${idx + 1}] Block: ${event.transaction.blockNumber}, Amount: ${parseFloat(event.amount) / 1e27}, User: ${event.user.id.slice(0, 10)}..., Candidate: ${event.candidate?.name || 'N/A'}`);
        });
        if (result.events.length > 5) {
          console.log(`   ... and ${result.events.length - 5} more events`);
        }
      }
    } else {
      console.log(`   Total Deposited Amount (raw): ${result}`);
      console.log(`   Total Deposited Amount (decimal): ${parseFloat(result) / 1e27}`);
      console.log(`   Query Duration: ${duration}s`);
    }

    console.log();
    console.log('='.repeat(80));

    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 메인 실행
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Usage: node test_getTotalDepositedAmount.js <fromBlock> <toBlock> [--details]');
    console.error('   Example: node test_getTotalDepositedAmount.js 18000000 18100000');
    console.error('   Example: node test_getTotalDepositedAmount.js 18000000 18100000 --details');
    process.exit(1);
  }

  const fromBlock = parseInt(args[0], 10);
  const toBlock = parseInt(args[1], 10);
  const includeDetails = args.includes('--details');

  if (isNaN(fromBlock) || isNaN(toBlock)) {
    console.error('❌ Error: fromBlock and toBlock must be valid numbers');
    process.exit(1);
  }

  if (fromBlock > toBlock) {
    console.error('❌ Error: fromBlock must be less than or equal to toBlock');
    process.exit(1);
  }

  testGetTotalDepositedAmount(fromBlock, toBlock, includeDetails)
    .then(() => {
      console.log('✅ Test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testGetTotalDepositedAmount };

