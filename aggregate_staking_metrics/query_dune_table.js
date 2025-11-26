#!/usr/bin/env node
/**
 * Dune Analytics 테이블 조회 스크립트
 * 테이블의 데이터를 조회하고 출력
 */

const https = require('https');
require('dotenv').config();

// 설정
const DUNE_API_KEY = process.env.DUNE_API_KEY;
const DEFAULT_DUNE_WORKSPACE = 'zena_team_5836'; // 기본 workspace 이름 (환경변수로 변경 가능)
const DUNE_WORKSPACE = process.env.DUNE_WORKSPACE || DEFAULT_DUNE_WORKSPACE;
const TABLE_NAME = 'basic_staking_metrics';

/**
 * Dune REST API를 사용하여 쿼리 실행
 */
async function executeQuery(query) {
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
 * 쿼리 결과 조회
 */
async function getQueryResults(queryId) {
  const url = `https://api.dune.com/api/v1/query/${queryId}/results`;

  const headers = {
    'X-DUNE-API-KEY': DUNE_API_KEY
  };

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'GET',
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

    req.end();
  });
}

/**
 * 쿼리 실행 상태 확인
 */
async function getQueryStatus(queryId) {
  const url = `https://api.dune.com/api/v1/query/${queryId}/status`;

  const headers = {
    'X-DUNE-API-KEY': DUNE_API_KEY
  };

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'GET',
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
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            response: response
          });
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

    req.end();
  });
}

/**
 * 테이블 데이터 조회
 */
async function queryTableData(limit = 10, offset = 0, orderBy = 'date', orderDirection = 'DESC') {
  const tableName = `dune.${DUNE_WORKSPACE}.${TABLE_NAME}`;
  // const query = `SELECT * FROM ${tableName} ORDER BY ${orderBy} ${orderDirection} LIMIT ${limit} OFFSET ${offset}`;
  const query = `SELECT * FROM ${tableName} `;

  console.log(`📊 Query: ${query}\n`);

  // 쿼리 실행
  const executeResult = await executeQuery(query);

  if (!executeResult.success) {
    console.error('❌ Query execution failed:', executeResult.error);
    if (executeResult.response) {
      console.error('Response:', JSON.stringify(executeResult.response, null, 2));
    }
    return null;
  }

  // query_id 추출
  const queryId = executeResult.response?.query_id;
  if (!queryId) {
    console.error('❌ No query_id in response');
    console.error('Response:', JSON.stringify(executeResult.response, null, 2));
    return null;
  }

  console.log(`✅ Query executed. Query ID: ${queryId}`);
  console.log('⏳ Waiting for query to complete...');

  // 쿼리 완료 대기 (최대 30초)
  let attempts = 0;
  const maxAttempts = 30;
  let queryState = null;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기

    const statusResult = await getQueryStatus(queryId);
    if (statusResult.success && statusResult.response) {
      queryState = statusResult.response.state;

      if (queryState === 'QUERY_STATE_COMPLETED') {
        console.log('✅ Query completed');
        break;
      } else if (queryState === 'QUERY_STATE_FAILED') {
        console.error('❌ Query failed');
        console.error('Status:', JSON.stringify(statusResult.response, null, 2));
        return null;
      }

      process.stdout.write(`   State: ${queryState}...\r`);
    }

    attempts++;
  }

  if (queryState !== 'QUERY_STATE_COMPLETED') {
    console.error(`\n❌ Query did not complete within ${maxAttempts} seconds`);
    return null;
  }

  // 결과 조회
  console.log('\n📥 Fetching results...');
  const resultsResult = await getQueryResults(queryId);

  if (!resultsResult.success) {
    console.error('❌ Failed to get results:', resultsResult.error);
    return null;
  }

  return resultsResult.response;
}

/**
 * 결과 출력
 */
function printResults(results) {
  if (!results || !results.result || !results.result.rows) {
    console.log('No data found');
    return;
  }

  const rows = results.result.rows;
  const metadata = results.result.metadata;

  console.log(`\n📊 Results: ${rows.length} rows`);
  console.log('='.repeat(80));

  if (rows.length === 0) {
    console.log('No rows returned');
    return;
  }

  // 컬럼 이름 출력
  const columns = metadata?.column_names || Object.keys(rows[0]);
  console.log('\nColumns:', columns.join(', '));
  console.log('\n' + '-'.repeat(80));

  // 데이터 출력
  rows.forEach((row, index) => {
    console.log(`\n[Row ${index + 1}]`);
    columns.forEach(col => {
      const value = row[col];
      const displayValue = value === null || value === undefined ? 'NULL' : value;
      console.log(`  ${col}: ${displayValue}`);
    });
  });

  console.log('\n' + '='.repeat(80));
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Tokamak Network - Dune Analytics Table Query');
  console.log('='.repeat(80));
  console.log();

  if (!DUNE_API_KEY) {
    console.error('❌ DUNE_API_KEY is not set in .env file');
    console.log('   Please set DUNE_API_KEY in your .env file');
    process.exit(1);
  }

  console.log(`✅ Using API key: ${DUNE_API_KEY.substring(0, 10)}...`);
  console.log(`✅ Using workspace: ${DUNE_WORKSPACE}`);
  console.log(`✅ Table: ${TABLE_NAME}`);
  console.log();
  console.log('⚠️  Note: Dune Query API requires a paid plan.');
  console.log('   If you see "Query management endpoints are only available in paid plans" error,');
  console.log('   please use Dune Query Editor in the web interface instead.');
  console.log();

  // 명령줄 인자 파싱
  const args = process.argv.slice(2);
  const limit = args[0] ? parseInt(args[0], 10) : 10;
  const offset = args[1] ? parseInt(args[1], 10) : 0;
  const orderBy = args[2] || 'date';
  const orderDirection = args[3] || 'DESC';

  if (isNaN(limit) || limit < 1) {
    console.error('❌ Invalid limit. Must be a positive number');
    process.exit(1);
  }

  if (isNaN(offset) || offset < 0) {
    console.error('❌ Invalid offset. Must be a non-negative number');
    process.exit(1);
  }

  console.log(`📋 Query Parameters:`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Offset: ${offset}`);
  console.log(`   Order By: ${orderBy}`);
  console.log(`   Order Direction: ${orderDirection}`);
  console.log();

  try {
    const results = await queryTableData(limit, offset, orderBy, orderDirection);

    if (results) {
      printResults(results);
    } else {
      console.error('\n❌ Failed to query table data');
      console.log('\n💡 Alternative: Use Dune Query Editor in web interface');
      console.log(`   Go to: https://dune.com/queries`);
      console.log(`   Run: SELECT * FROM dune.${DUNE_WORKSPACE}.${TABLE_NAME} ORDER BY ${orderBy} ${orderDirection} LIMIT ${limit} OFFSET ${offset}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    console.log('\n💡 Alternative: Use Dune Query Editor in web interface');
    console.log(`   Go to: https://dune.com/queries`);
    console.log(`   Run: SELECT * FROM dune.${DUNE_WORKSPACE}.${TABLE_NAME} ORDER BY ${orderBy} ${orderDirection} LIMIT ${limit} OFFSET ${offset}`);
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

module.exports = { queryTableData, executeQuery, getQueryResults, getQueryStatus };

