#!/usr/bin/env node
/**
 * getTotalWithdrawalsAmount 함수 테스트 스크립트
 *
 * 사용법:
 *   node test_getTotalWithdrawalsAmount.js <fromBlock> <toBlock> [--details]
 *
 * 예시:
 *   node test_getTotalWithdrawalsAmount.js 18000000 18100000
 *   node test_getTotalWithdrawalsAmount.js 18000000 18100000 --details
 */

require('dotenv').config();
const SubgraphClient = require('./utils/subgraphClient');

async function testGetTotalWithdrawalsAmount(fromBlock, toBlock, includeDetails = false) {
  console.log('='.repeat(80));
  console.log('Testing getTotalWithdrawalsAmount');
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

    const result = await subgraph.getTotalWithdrawalsAmount(fromBlock, toBlock, includeDetails);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log();
    console.log('✅ Result:');

    if (includeDetails && typeof result === 'object') {
      console.log(`   Total Withdrawals Amount (raw): ${result.totalAmount}`);
      console.log(`   Total Withdrawals Amount (decimal): ${result.totalAmountDecimal}`);
      console.log(`   Event Count: ${result.eventCount}`);
      console.log(`   Query Duration: ${duration}s`);

      if (result.events && result.events.length > 0) {
        console.log();
        console.log('📋 Sample Events (first 5):');
        result.events.slice(0, 5).forEach((event, idx) => {
          console.log(`   [${idx + 1}] Block: ${event.transaction.blockNumber}, Amount: ${parseFloat(event.amount) / 1e27}, User: ${event.user.id.slice(0, 10)}..., Candidate: ${event.candidate?.name || 'N/A'}, Event: ${event.eventName || 'N/A'}`);
        });
        if (result.events.length > 5) {
          console.log(`   ... and ${result.events.length - 5} more events`);
        }
      }
    } else {
      console.log(`   Total Withdrawals Amount (raw): ${result}`);
      console.log(`   Total Withdrawals Amount (decimal): ${parseFloat(result) / 1e27}`);
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
    console.error('❌ Usage: node test_getTotalWithdrawalsAmount.js <fromBlock> <toBlock> [--details]');
    console.error('   Example: node test_getTotalWithdrawalsAmount.js 18000000 18100000');
    console.error('   Example: node test_getTotalWithdrawalsAmount.js 18000000 18100000 --details');
    process.exit(1);
  }

  let fromBlock = parseInt(args[0], 10);
  let toBlock = parseInt(args[1], 10);
  const includeDetails = args.includes('--details');

  if (isNaN(fromBlock) || isNaN(toBlock)) {
    console.error('❌ Error: fromBlock and toBlock must be valid numbers');
    process.exit(1);
  }

  // fromBlock이 toBlock보다 크면 자동으로 순서 교정
  if (fromBlock > toBlock) {
    console.warn(`⚠️  Warning: fromBlock (${fromBlock}) is greater than toBlock (${toBlock})`);
    console.warn(`   Auto-correcting: swapping values...`);
    [fromBlock, toBlock] = [toBlock, fromBlock];
    console.log(`   ✅ Using: fromBlock=${fromBlock}, toBlock=${toBlock}`);
  }

  testGetTotalWithdrawalsAmount(fromBlock, toBlock, includeDetails)
    .then(() => {
      console.log('✅ Test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testGetTotalWithdrawalsAmount };

