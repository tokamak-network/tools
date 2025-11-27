/**
 * The Graph Subgraph 클라이언트
 */

const https = require('https');
require('dotenv').config();

const SUBGRAPH_URL = process.env.SUBGRAPH_URL ||
  'https://gateway-arbitrum.network.thegraph.com/api/subgraphs/id/CJLiXNdHXJ22BzWignD62gohDRVTYXJQVgU4qKJEtNVS';
const THE_GRAPH_API_KEY = process.env.THE_GRAPH_API_KEY;

class SubgraphClient {
  constructor(url = SUBGRAPH_URL) {
    // API 키가 있고 URL에 포함되지 않은 경우 URL에 추가
    // The Graph URL 형식: https://gateway-arbitrum.network.thegraph.com/api/[API_KEY]/subgraphs/id/...
    if (THE_GRAPH_API_KEY && url.includes('gateway-arbitrum.network.thegraph.com')) {
      // 이미 API 키가 포함되어 있는지 확인
      if (url.includes(`/api/${THE_GRAPH_API_KEY}/`)) {
        // 이미 API 키가 포함되어 있음
        this.url = url;
      } else if (url.includes('/api/subgraphs/')) {
        // /api/subgraphs/를 /api/[API_KEY]/subgraphs/로 변경
        this.url = url.replace('/api/subgraphs/', `/api/${THE_GRAPH_API_KEY}/subgraphs/`);
      } else if (url.includes('/subgraphs/')) {
        // /subgraphs/를 /api/[API_KEY]/subgraphs/로 변경
        this.url = url.replace('/subgraphs/', `/api/${THE_GRAPH_API_KEY}/subgraphs/`);
      } else {
        this.url = url;
      }
    } else {
      this.url = url;
    }
  }

  /**
   * GraphQL 쿼리 실행
   */
  async query(query, variables = null) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({ query, variables });
      const url = new URL(this.url);

      // URL에서 API 키를 마스킹하여 로깅
      // const maskedUrl = this.url.replace(/\/api\/[^/]+/, '/api/***');
      // console.log('Request URL:', maskedUrl);

      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      };

      // The Graph API 키가 있으면 Authorization 헤더 추가
      if (THE_GRAPH_API_KEY) {
        headers['Authorization'] = `Bearer ${THE_GRAPH_API_KEY}`;
        // console.log('Using Authorization header (API key present)');
      } else {
        // console.log('No API key found in environment');
      }

      const options = {
        method: 'POST',
        headers: headers
      };

      const req = https.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            // 빈 응답 체크
            if (!data || data.trim().length === 0) {
              console.error('Empty response from server');
              console.error('Status Code:', res.statusCode);
              console.error('Response Headers:', res.headers);
              reject(new Error(`Empty response from server (HTTP ${res.statusCode})`));
              return;
            }

            const result = JSON.parse(data);

            // HTTP 상태 코드 확인
            if (res.statusCode !== 200) {
              console.error('Non-200 status code:', res.statusCode);
              console.error('Response body:', data);
              reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
              return;
            }

            resolve(result);
          } catch (e) {
            console.error('JSON parse error:', e.message);
            console.error('Response data (first 500 chars):', data.substring(0, 500));
            console.error('Status Code:', res.statusCode);
            console.error('Response Headers:', res.headers);
            reject(new Error(`JSON parse error: ${e.message}. Response: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * 특정 기간의 Deposited 이벤트 합계
   * 페이지네이션을 통해 모든 이벤트를 가져와 합산
   * 사용자가 제공한 쿼리 구조를 사용하여 상세 정보도 가져올 수 있음
   */
  async getTotalDepositedAmount(fromBlock, toBlock, includeDetails = false) {
    const pageSize = 1000; // The Graph의 최대 limit
    let total = BigInt(0);
    let lastTimestamp = null;
    let hasMore = true;
    let allEvents = [];
    let pageCount = 0;

    try {
      while (hasMore) {
        pageCount++;

        // timestamp 기준으로 desc 정렬하므로, timestamp_lt를 사용하여 페이지네이션
        // 사용자가 제공한 쿼리 형태와 동일하게 쿼리 이름 없이 작성
        const query = lastTimestamp ? `
          query ($fromBlock: BigInt!, $toBlock: BigInt!, $first: Int!, $lastTimestamp: BigInt!) {
            stakeds(
              where: {
                transaction_: {
                  blockNumber_gte: $fromBlock
                  blockNumber_lte: $toBlock
                }
                timestamp_lt: $lastTimestamp
              }
              orderBy: timestamp
              orderDirection: desc
              first: $first
            ) {
              id
              amount
              timestamp
              user {
                id
              }
              candidate {
                name
              }
              transaction {
                id
                blockNumber
              }
            }
          }
        ` : `
          query ($fromBlock: BigInt!, $toBlock: BigInt!, $first: Int!) {
            stakeds(
              where: {
                transaction_: {
                  blockNumber_gte: $fromBlock
                  blockNumber_lte: $toBlock
                }
              }
              orderBy: timestamp
              orderDirection: desc
              first: $first
            ) {
              id
              amount
              timestamp
              user {
                id
              }
              candidate {
                name
              }
              transaction {
                id
                blockNumber
              }
            }
          }
        `;

        const variables = lastTimestamp
          ? {
              fromBlock: fromBlock.toString(),
              toBlock: toBlock.toString(),
              first: pageSize,
              lastTimestamp: lastTimestamp.toString()
            }
          : {
              fromBlock: fromBlock.toString(),
              toBlock: toBlock.toString(),
              first: pageSize
            };

        // console.log('variables : ', JSON.stringify(variables, null, 2));
        // console.log('query : ', query);

        const result = await this.query(query, variables);

        // 에러 체크
        if (result.errors) {
          console.error('GraphQL Errors:', JSON.stringify(result.errors, null, 2));
          throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        }

        if (!result.data?.stakeds || result.data.stakeds.length === 0) {
          hasMore = false;
          break;
        }

        const events = result.data.stakeds;

        // 금액 합산
        for (const staked of events) {
          total += BigInt(staked.amount || '0');
        }

        // 상세 정보 저장 (옵션)
        if (includeDetails) {
          allEvents = allEvents.concat(events);
        }

        console.log(`  📄 Page ${pageCount}: ${events.length} events, Total so far: ${parseFloat(total.toString()) / 1e27}`);

        // 다음 페이지 확인
        if (events.length < pageSize) {
          hasMore = false;
        } else {
          // desc 정렬이므로 가장 작은 timestamp를 사용
          lastTimestamp = events[events.length - 1].timestamp;
        }
      }

      // console.log(`  ✅ Total events processed: ${includeDetails ? allEvents.length : 'N/A'}, Total amount: ${parseFloat(total.toString()) / 1e27}`);

      // 상세 정보를 포함하는 경우 객체 반환, 아니면 문자열만 반환
      if (includeDetails) {
        return {
          totalAmount: total.toString(),
          totalAmountDecimal: parseFloat(total.toString()) / 1e27,
          eventCount: allEvents.length,
          events: allEvents
        };
      }

      return total.toString();
    } catch (error) {
      console.error(`Error fetching deposited amount: ${error.message}`);
      if (includeDetails) {
        return {
          totalAmount: '0',
          totalAmountDecimal: 0,
          eventCount: 0,
          events: []
        };
      }
      return '0';
    }
  }

  /**
   * 특정 기간의 WithdrawalAndDeposited 이벤트 합계
   */
  async getTotalWithdrawalAndDepositedAmount(fromBlock, toBlock) {
    const query = `
      query GetWithdrawalAndDepositedAmount($fromBlock: BigInt!, $toBlock: BigInt!) {
        withdrawalAndDepositeds(
          where: {
            transaction_: {
              blockNumber_gte: $fromBlock
              blockNumber_lte: $toBlock
            }
          }
        ) {
          amount
        }
      }
    `;

    try {
      const result = await this.query(query, { fromBlock, toBlock });
      let total = BigInt(0);

      if (result.data?.withdrawalAndDepositeds) {
        for (const event of result.data.withdrawalAndDepositeds) {
          total += BigInt(event.amount);
        }
      }

      return total.toString();
    } catch (error) {
      console.error(`Error fetching withdrawal and deposited amount: ${error.message}`);
      return '0';
    }
  }

  /**
   * 특정 기간의 Unstakeds 이벤트 합계 (페이지네이션 지원)
   * @param {number|string} fromBlock - 시작 블록 번호
   * @param {number|string} toBlock - 종료 블록 번호
   * @param {boolean} includeDetails - 상세 정보 포함 여부
   * @returns {Promise<string|Object>} 총 출금 금액 (문자열) 또는 상세 정보 객체
   */
  async getTotalWithdrawalsAmount(fromBlock, toBlock, includeDetails = false) {
    const pageSize = 1000; // The Graph의 최대 limit
    let total = BigInt(0);
    let lastTimestamp = null;
    let hasMore = true;
    let allEvents = [];
    let pageCount = 0;

    try {
      while (hasMore) {
        pageCount++;

        // timestamp 기준으로 desc 정렬하므로, timestamp_lt를 사용하여 페이지네이션
        const query = lastTimestamp ? `
          query ($fromBlock: BigInt!, $toBlock: BigInt!, $first: Int!, $lastTimestamp: BigInt!) {
            unstakeds(
              where: {
                transaction_: {
                  blockNumber_gte: $fromBlock
                  blockNumber_lte: $toBlock
                }
                timestamp_lt: $lastTimestamp
              }
              orderBy: timestamp
              orderDirection: desc
              first: $first
            ) {
              id
              amount
              timestamp
              eventName
              transaction {
                blockNumber
                id
              }
            }
          }
        ` : `
          query ($fromBlock: BigInt!, $toBlock: BigInt!, $first: Int!) {
            unstakeds(
              where: {
                transaction_: {
                  blockNumber_gte: $fromBlock
                  blockNumber_lte: $toBlock
                }
              }
              orderBy: timestamp
              orderDirection: desc
              first: $first
            ) {
              id
              amount
              timestamp
              eventName
              transaction {
                blockNumber
                id
              }
            }
          }
        `;

        const variables = lastTimestamp
          ? {
              fromBlock: fromBlock.toString(),
              toBlock: toBlock.toString(),
              first: pageSize,
              lastTimestamp: lastTimestamp.toString()
            }
          : {
              fromBlock: fromBlock.toString(),
              toBlock: toBlock.toString(),
              first: pageSize
            };

        const result = await this.query(query, variables);

        // 에러 체크
        if (result.errors) {
          console.error('GraphQL Errors:', JSON.stringify(result.errors, null, 2));
          throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        }

        if (!result.data?.unstakeds || result.data.unstakeds.length === 0) {
          hasMore = false;
          break;
        }

        const events = result.data.unstakeds;

        // 금액 합산
        for (const unstaked of events) {
          total += BigInt(unstaked.amount || '0');
        }

        // 상세 정보 저장 (옵션)
        if (includeDetails) {
          allEvents = allEvents.concat(events);
        }

        console.log(`  📄 Page ${pageCount}: ${events.length} unstaked events, Total so far: ${parseFloat(total.toString()) / 1e27}`);

        // 다음 페이지 확인
        if (events.length < pageSize) {
          hasMore = false;
        } else {
          // desc 정렬이므로 가장 작은 timestamp를 사용
          lastTimestamp = events[events.length - 1].timestamp;
        }
      }

      // 상세 정보를 포함하는 경우 객체 반환, 아니면 문자열만 반환
      if (includeDetails) {
        return {
          totalAmount: total.toString(),
          totalAmountDecimal: parseFloat(total.toString()) / 1e27,
          eventCount: allEvents.length,
          events: allEvents
        };
      }

      return total.toString();
    } catch (error) {
      console.error(`Error fetching unstakeds amount: ${error.message}`);
      if (includeDetails) {
        return {
          totalAmount: '0',
          totalAmountDecimal: 0,
          eventCount: 0,
          events: []
        };
      }
      return '0';
    }
  }
}

module.exports = SubgraphClient;

