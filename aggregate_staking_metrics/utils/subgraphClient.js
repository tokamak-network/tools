/**
 * The Graph Subgraph 클라이언트
 */

const https = require('https');

const SUBGRAPH_URL = process.env.SUBGRAPH_URL ||
  'https://gateway-arbitrum.network.thegraph.com/api/subgraphs/id/CJLiXNdHXJ22BzWignD62gohDRVTYXJQVgU4qKJEtNVS';

class SubgraphClient {
  constructor(url = SUBGRAPH_URL) {
    this.url = url;
  }

  /**
   * GraphQL 쿼리 실행
   */
  async query(query, variables = null) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({ query, variables });
      const url = new URL(this.url);

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (res.statusCode === 200) {
              resolve(result);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (e) {
            reject(e);
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
   */
  async getTotalDepositedAmount(fromBlock, toBlock) {
    const query = `
      query GetDepositedAmount($fromBlock: BigInt!, $toBlock: BigInt!) {
        stakeds(
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

      if (result.data?.stakeds) {
        for (const staked of result.data.stakeds) {
          total += BigInt(staked.amount);
        }
      }

      return total.toString();
    } catch (error) {
      console.error(`Error fetching deposited amount: ${error.message}`);
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
}

module.exports = SubgraphClient;

