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
const DEFAULT_DUNE_WORKSPACE = 'zena_team_5836'; // 기본 workspace 이름 (환경변수로 변경 가능)
const DUNE_WORKSPACE = process.env.DUNE_WORKSPACE || DEFAULT_DUNE_WORKSPACE;

// 테이블 스키마 정의
const TABLE_SCHEMA = {
  columns: [
    { name: 'date', type: 'DATE' },
    { name: 'criterion_block_number', type: 'BIGINT', unique: true },
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
  // 하지만 실제 권한이 있는 namespace는 DUNE_WORKSPACE이므로 이를 사용
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

    const colDef = {
      name: col.name,
      type: type,
      nullable: true
    };

    // criterion_block_number에 unique 속성 추가 시도
    if (col.name === 'criterion_block_number' && col.unique) {
      colDef.unique = true;
    }

    return colDef;
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
 * 인덱스 및 제약조건 생성
 */
async function createIndexesAndConstraints(tableName) {
  const tableNameEscaped = `${DUNE_WORKSPACE}.${tableName}`;

  // SQL 쿼리들
  const queries = [
    // UNIQUE 제약조건: criterion_block_number는 중복되지 않아야 함
    `ALTER TABLE ${tableNameEscaped} ADD CONSTRAINT ${tableName}_criterion_block_number_unique UNIQUE (criterion_block_number);`,
    // 인덱스: date로 빠른 조회
    `CREATE INDEX IF NOT EXISTS ${tableName}_date_idx ON ${tableNameEscaped} (date);`,
    // 인덱스: criterion_block_number로 빠른 조회 (UNIQUE 제약조건이 이미 인덱스를 생성하지만 명시적으로 추가)
    `CREATE INDEX IF NOT EXISTS ${tableName}_criterion_block_number_idx ON ${tableNameEscaped} (criterion_block_number);`
  ];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`   🔄 Executing query ${i + 1}/${queries.length}...`);

    try {
      const result = await executeQueryViaRESTAPI(query);

      if (result.success) {
        console.log(`   ✅ Query ${i + 1} executed successfully`);
      } else {
        // 이미 존재하는 경우는 경고만 출력
        if (result.error && (result.error.includes('already exists') || result.error.includes('duplicate'))) {
          console.log(`   ⚠️  Query ${i + 1}: ${result.error} (may already exist)`);
        } else {
          console.error(`   ❌ Query ${i + 1} failed: ${result.error}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Query ${i + 1} error: ${error.message}`);
    }
  }
}

/**
 * Dune REST API를 사용하여 SQL 쿼리 실행
 */
async function executeQueryViaRESTAPI(query) {
  const url = 'https://api.dune.com/api/v1/query';

  const payload = {
    query_sql: query,
    parameters: []
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

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

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
  // 실제 생성되는 테이블: ${DUNE_WORKSPACE}.basic_staking_metrics
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

      console.log('\n📊 Duplicate Prevention:');
      console.log('   ⚠️  Note: Dune Analytics does not support ALTER TABLE or CREATE INDEX.');
      console.log('   Duplicate prevention is handled in the upload script.');
      console.log('   The upload script will use INSERT with conflict handling.');
      console.log('   If duplicates occur, they will be skipped automatically.');

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

