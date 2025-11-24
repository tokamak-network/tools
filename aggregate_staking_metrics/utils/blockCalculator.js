/**
 * 블록 번호 계산 유틸리티
 * 매일 00:00 UTC (09:00 KST) 기준 블록 번호 계산
 */

const { Web3 } = require('web3');
const https = require('https');
const { BLOCKS_PER_DAY } = require('../config/addresses').constants;

/**
 * Etherscan API를 통해 타임스탬프로 블록 번호 조회
 * API 문서: https://docs.etherscan.io/api-endpoints/blocks#get-block-number-by-timestamp
 *
 * @param {number} timestamp - Unix timestamp (seconds)
 * @param {string} apiKey - Etherscan API 키 (필수)
 * @param {string} closest - 'before' 또는 'after' (기본값: 'before')
 * @returns {Promise<number>} 블록 번호
 */
async function getBlockNumberByTimestampEtherscan(timestamp, apiKey, closest = 'before') {
  if (!apiKey) {
    throw new Error('Etherscan API key is required');
  }

  return new Promise((resolve, reject) => {
    // Etherscan API V2 사용 (V1은 deprecated됨)
    // V2 엔드포인트: https://api.etherscan.io/v2/api
    // chainid 파라미터 필수 (Ethereum Mainnet = 1)
    const params = new URLSearchParams({
      module: 'block',
      action: 'getblocknobytime',
      timestamp: timestamp.toString(),
      closest: closest,
      chainid: '1', // Ethereum Mainnet
      apikey: apiKey
    });

    // V2 API 엔드포인트 사용
    const url = `https://api.etherscan.io/v2/api?${params.toString()}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);

          // Etherscan API 응답 확인
          if (result.status === '1' && result.message === 'OK') {
            const blockNumber = Number(result.result);
            if (isNaN(blockNumber)) {
              reject(new Error(`Invalid block number returned: ${result.result}`));
            } else {
              resolve(blockNumber);
            }
          } else {
            // NOTOK 에러의 경우 더 자세한 정보 제공
            const errorMsg = result.message || result.result || 'Unknown error';
            const errorDetails = result.result ? ` (${result.result})` : '';
            reject(new Error(`Etherscan API error: ${errorMsg}${errorDetails}. Status: ${result.status || 'N/A'}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Etherscan response: ${e.message}. Response: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`HTTP request failed: ${error.message}`));
    });
  });
}

/**
 * 특정 날짜의 00:00 UTC 블록 번호 계산
 * Etherscan API를 우선 사용하고, 실패 시 Web3 이진 탐색 사용
 * @param {Date} date - 날짜 객체
 * @param {Web3} web3 - Web3 인스턴스
 * @param {string} etherscanApiKey - Etherscan API 키 (선택사항)
 * @returns {Promise<number>} 블록 번호
 */
async function getBlockNumberForDate(date, web3, etherscanApiKey = null) {
  // 날짜를 00:00 UTC로 설정
  const targetDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));

  const targetTimestamp = Number(Math.floor(targetDate.getTime() / 1000));

  // Etherscan API 사용 시도 (API 키가 있는 경우만)
  const apiKey = etherscanApiKey || process.env.ETHERSCAN_API_KEY;
  if (apiKey) {
    try {
      // 'before'를 사용하여 지정된 시간 이전의 가장 가까운 블록 찾기
      const blockNumber = await getBlockNumberByTimestampEtherscan(targetTimestamp, apiKey, 'before');
      return blockNumber;
    } catch (error) {
      // Etherscan API 실패 시 Web3 이진 탐색으로 fallback
      // 첫 번째 에러만 상세히 출력 (너무 많은 로그 방지)
      if (!getBlockNumberForDate._errorLogged) {
        console.log(`   ⚠️  Etherscan API failed: ${error.message}`);
        console.log(`   💡 Check your ETHERSCAN_API_KEY or rate limits. Falling back to Web3 binary search.`);
        getBlockNumberForDate._errorLogged = true;
      }
    }
  }

  // Fallback: Web3 이진 탐색 사용
  let low = 0;
  const highBlock = await web3.eth.getBlockNumber();
  // BigInt를 Number로 변환 (재할당 가능하도록 let 사용)
  let high = typeof highBlock === 'bigint' ? Number(highBlock) : Number(highBlock);
  let result = high;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await web3.eth.getBlock(mid);

    if (!block) {
      high = mid - 1;
      continue;
    }

    // block.timestamp가 BigInt일 수 있으므로 Number로 변환
    const blockTimestamp = typeof block.timestamp === 'bigint'
      ? Number(block.timestamp)
      : Number(block.timestamp);

    if (blockTimestamp === targetTimestamp) {
      result = mid;
      break;
    } else if (blockTimestamp < targetTimestamp) {
      low = mid + 1;
      result = mid; // 가장 가까운 블록
    } else {
      high = mid - 1;
    }
  }

  return result;
}

/**
 * 일일 블록 번호 계산 (00:00 UTC 기준)
 * @param {Web3} web3 - Web3 인스턴스
 * @param {Date} startDate - 시작 날짜
 * @param {Date} endDate - 종료 날짜 (선택사항, 기본값: 오늘)
 * @returns {Promise<Array>} [{date, blockNumber}] 배열
 */
async function calculateDailyBlocks(web3, startDate = null, endDate = null) {
  const blocks = [];
  const today = new Date();
  const start = startDate || new Date(today.getFullYear() - 3, 0, 1);
  const end = endDate || today;

  // Etherscan API 키 확인
  const etherscanApiKey = process.env.ETHERSCAN_API_KEY || null;
  if (etherscanApiKey) {
    console.log('✅ Using Etherscan API for faster block number lookup');
    console.log('   ⚠️  Note: Adding 1 second delay between requests to avoid rate limits');
    console.log('   ⚠️  If you hit limits, it will automatically fallback to Web3.');
  } else {
    console.log('ℹ️  ETHERSCAN_API_KEY not set, using Web3 binary search (slower)');
    console.log('   💡 Set ETHERSCAN_API_KEY in .env for faster execution');
  }

  // 에러 로깅 플래그 초기화
  getBlockNumberForDate._errorLogged = false;

  // 시작 날짜부터 종료 날짜까지
  const currentDate = new Date(start);
  currentDate.setUTCHours(0, 0, 0, 0);

  // 현재 블록 번호 확인 (미래 날짜 체크용)
  let latestBlockNumber;
  try {
    const latestBlock = await web3.eth.getBlockNumber();
    // BigInt를 Number로 변환
    latestBlockNumber = typeof latestBlock === 'bigint'
      ? Number(latestBlock)
      : Number(latestBlock);
  } catch (error) {
    console.error(`Warning: Could not get latest block number: ${error.message}`);
  }

  while (currentDate <= end) {
    try {
      // 미래 날짜인 경우 스킵 (블록이 아직 생성되지 않음)
      const currentTimestamp = Math.floor(currentDate.getTime() / 1000);
      const now = Math.floor(Date.now() / 1000);

      if (currentTimestamp > now) {
        console.log(`⏭️  ${currentDate.toISOString().split('T')[0]}: Skipped (future date, block not created yet)`);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        continue;
      }

      const blockNumber = await getBlockNumberForDate(currentDate, web3, etherscanApiKey);

      // 계산된 블록이 현재 최신 블록보다 큰 경우 (미래 블록) 스킵
      if (latestBlockNumber && blockNumber > latestBlockNumber) {
        console.log(`⏭️  ${currentDate.toISOString().split('T')[0]}: Skipped (block ${blockNumber} doesn't exist yet, latest: ${latestBlockNumber})`);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        continue;
      }

      // Rate limit 방지를 위해 Etherscan API 사용 시 1초 지연 추가
      if (etherscanApiKey) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 지연 (초당 1회 이하로 제한)
      }

      blocks.push({
        date: currentDate.toISOString().split('T')[0],
        blockNumber: blockNumber,
        timestamp: Math.floor(currentDate.getTime() / 1000)
      });

      console.log(`✅ ${currentDate.toISOString().split('T')[0]}: Block ${blockNumber}`);

      // 다음 날로 이동
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    } catch (error) {
      // 에러가 발생하면 해당 날짜는 스킵하고 계속 진행
      console.error(`❌ Error calculating block for ${currentDate.toISOString().split('T')[0]}: ${error.message}`);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  }

  return blocks;
}

/**
 * 특정 기간의 블록 수 계산
 * @param {number} startBlock - 시작 블록
 * @param {number} endBlock - 종료 블록
 * @returns {number} 블록 수
 */
function calculateBlocksInPeriod(startBlock, endBlock) {
  return endBlock - startBlock;
}

module.exports = {
  getBlockNumberForDate,
  calculateDailyBlocks,
  calculateBlocksInPeriod
};

