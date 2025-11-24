#!/usr/bin/env node
/**
 * Dune Analytics REST API를 사용하여 테이블 생성 (SDK 없이)
 * SDK 방식과 비교하기 위한 별도 스크립트
 *
 * 엔드포인트: POST /v1/uploads (새로운 엔드포인트)
 * 참고: /v1/table/create는 deprecated되었지만 여전히 작동함
 */

const https = require('https');
require('dotenv').config();

// 설정
const DUNE_API_KEY = process.env.DUNE_API_KEY;
const DUNE_WORKSPACE = process.env.DUNE_WORKSPACE || 'zena_team_5836';

// 테이블 스키마 정의
const TABLE_SCHEMA = {
  columns: [
    { name: 'date', type: 'DATE' },
    { name: 'criterion_block_number', type: 'BIGINT' },
    { name: 'previous_block_number', type: 'BIGINT' },
    { name: 'blocks_in_period', type: 'BIGINT' },
    { name: 'total_supply_ton', type: 'DOUBLE PRECISION' },
    { name: 'total_supply_ton_decimal', type: 'DOUBLE PRECISION' },
    { name: 'total_staked_amount', type: 'DOUBLE PRECISION' },
    { name: 'total_staked_amount_decimal', type: 'DOUBLE PRECISION' },
    { name: 'total_liquidity_amount', type: 'DOUBLE PRECISION' },
    { name: 'total_liquidity_amount_decimal', type: 'DOUBLE PRECISION' },
    { name: 'amount_issued', type: 'DOUBLE PRECISION' },
    { name: 'amount_issued_decimal', type: 'DOUBLE PRECISION' },
    { name: 'amount_burned', type: 'DOUBLE PRECISION' },
    { name: 'amount_burned_decimal', type: 'DOUBLE PRECISION' },
    { name: 'additional_staking_amount', type: 'DOUBLE PRECISION' },
    { name: 'additional_staking_amount_decimal', type: 'DOUBLE PRECISION' },
    { name: 'withdrawal_amount', type: 'DOUBLE PRECISION' },
    { name: 'withdrawal_amount_decimal', type: 'DOUBLE PRECISION' },
    { name: 'pending_withdrawal_2weeks', type: 'DOUBLE PRECISION' },
    { name: 'pending_withdrawal_2weeks_decimal', type: 'DOUBLE PRECISION' },
    { name: 'apy', type: 'DOUBLE PRECISION' },
    { name: 'ton_price', type: 'DOUBLE PRECISION' },
    { name: 'ton_price_currency', type: 'VARCHAR' }
  ]
};

/**
 * Dune REST API를 사용하여 테이블 생성
 * 새로운 엔드포인트 사용: /v1/uploads (기존 /v1/table/create는 deprecated)
 */
async function createTableViaRESTAPI(tableName, schema) {
  const url = 'https://api.dune.com/api/v1/uploads';

  // namespace와 table_name 분리
  // tableName이 "tokamak.basic_staking_metrics" 형식이면 분리
  // 하지만 실제 권한이 있는 namespace는 DUNE_WORKSPACE (zena_team_5836)이므로 이를 사용
  let namespace, table_name;
  if (tableName.includes('.')) {
    const parts = tableName.split('.');
    // namespace는 항상 DUNE_WORKSPACE 사용 (권한이 있는 namespace)
    namespace = DUNE_WORKSPACE;
    table_name = parts[1]; // 두 번째 부분만 테이블 이름으로 사용
  } else {
    namespace = DUNE_WORKSPACE;
    table_name = tableName;
  }

  console.log(`   📋 Namespace: ${namespace}`);
  console.log(`   📋 Table name: ${table_name}`);

  // 스키마를 Dune API 형식으로 변환
  const duneSchema = schema.map(col => {
    let type = col.type.toLowerCase();

    // Dune API 타입 매핑
    if (type === 'date') {
      type = 'timestamp'; // Dune API는 timestamp 사용
    } else if (type === 'bigint') {
      type = 'bigint';
    } else if (type === 'double precision') {
      type = 'double';
    } else if (type === 'varchar') {
      type = 'varchar';
    }

    return {
      name: col.name,
      type: type,
      nullable: true
    };
  });

  const payload = {
    namespace: namespace,
    table_name: table_name,
    description: 'Daily Tokamak Network staking metrics including total supply, staked amount, APY, and price data',
    schema: duneSchema,
    is_private: false
  };

  const headers = {
    'X-DUNE-API-KEY': DUNE_API_KEY,
    'Content-Type': 'application/json'
  };

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: headers
    };

    console.log(`   🔄 Sending request to: ${url}`);
    console.log(`   📦 Payload:`, JSON.stringify(payload, null, 2));

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          console.log(`   📥 Response status: ${res.statusCode}`);
          console.log(`   📥 Response body:`, JSON.stringify(response, null, 2));

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              statusCode: res.statusCode,
              response: response
            });
          } else {
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: response.error || response.message || `HTTP ${res.statusCode}`,
              response: response
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to parse response: ${error.message}`,
            rawResponse: data
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Tokamak Network - Dune Analytics Table Creator (REST API)');
  console.log('='.repeat(80));
  console.log();

  if (!DUNE_API_KEY) {
    console.error('❌ DUNE_API_KEY is not set in .env file');
    console.log('   Please set DUNE_API_KEY in your .env file');
    process.exit(1);
  }

  console.log(`✅ Using API key: ${DUNE_API_KEY.substring(0, 10)}...`);
  console.log(`✅ Using workspace: ${DUNE_WORKSPACE}`);
  console.log();

  // 테이블 이름: namespace는 DUNE_WORKSPACE를 사용하므로 테이블 이름만 지정
  // 실제 생성되는 테이블: zena_team_5836.basic_staking_metrics
  const tableName = 'basic_staking_metrics'; // 원래 이름은 유지하되, namespace는 DUNE_WORKSPACE 사용

  console.log('🔌 Attempting to create table via Dune REST API...');
  console.log(`   🏗️  Creating table: ${tableName}`);
  console.log();

  try {
    const result = await createTableViaRESTAPI(tableName, TABLE_SCHEMA.columns);

    console.log();
    console.log('='.repeat(80));

    if (result.success) {
      console.log('✅ SUCCESS: Table created via REST API!');
      console.log(`   Table: ${tableName}`);
      if (result.response) {
        console.log(`   Response:`, JSON.stringify(result.response, null, 2));
      }
      console.log('='.repeat(80));
    } else {
      console.log('❌ FAILED: Table creation via REST API failed');
      console.log(`   Error: ${result.error || 'Unknown error'}`);
      if (result.statusCode) {
        console.log(`   HTTP Status: ${result.statusCode}`);
      }
      if (result.response) {
        console.log(`   Response:`, JSON.stringify(result.response, null, 2));
      }
      if (result.rawResponse) {
        console.log(`   Raw Response: ${result.rawResponse}`);
      }
      console.log('='.repeat(80));
      process.exit(1);
    }
  } catch (error) {
    console.log();
    console.log('='.repeat(80));
    console.log('❌ ERROR: Unexpected error occurred');
    console.log(`   Error: ${error.message}`);
    console.log('='.repeat(80));
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { createTableViaRESTAPI, TABLE_SCHEMA };

