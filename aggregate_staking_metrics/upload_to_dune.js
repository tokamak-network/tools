#!/usr/bin/env node
/**
 * Dune Analytics 업로드 스크립트
 * aggregate_staking_metrics 결과를 Dune Custom Tables에 업로드
 * Dune API를 통해 테이블 생성 및 데이터 업로드 지원
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
require('dotenv').config();

// 설정
const DUNE_API_KEY = process.env.DUNE_API_KEY;
const DEFAULT_DUNE_WORKSPACE = 'project_eco_test'; // 기본 workspace 이름 (환경변수로 변경 가능)
const DUNE_WORKSPACE = process.env.DUNE_WORKSPACE || DEFAULT_DUNE_WORKSPACE;
const OUTPUT_DIR = path.join(__dirname, 'output');
const DUNE_READY_DIR = path.join(__dirname, 'dune_ready');

// 디렉토리 생성
if (!fs.existsSync(DUNE_READY_DIR)) {
  fs.mkdirSync(DUNE_READY_DIR, { recursive: true });
}

/**
 * CSV 파일 읽기
 */
function readCSV(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      cast: true
    });
    return records;
  } catch (error) {
    throw new Error(`Failed to read CSV: ${error.message}`);
  }
}

/**
 * CSV 파일 쓰기
 */
function writeCSV(filePath, data, headers) {
  try {
    const output = stringify(data, {
      header: true,
      columns: headers || Object.keys(data[0] || {})
    });
    fs.writeFileSync(filePath, output, 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write CSV: ${error.message}`);
  }
}

/**
 * Dune REST API를 사용하여 기존 블록 번호 조회
 * 참고: Query API는 유료 플랜이 필요하므로, 일단 빈 Set 반환
 * 실제 구현 시 query_id로 결과를 조회해야 함
 */
async function getExistingBlockNumbers(namespace, tableName) {
  // Query API는 유료 플랜이 필요하므로 일단 스킵
  // 실제로는 query_id를 받아서 결과를 조회해야 함
  console.log('   ⚠️  Note: Duplicate check requires a paid Dune plan for query execution.');
  console.log('   ⚠️  Skipping duplicate check. All data will be uploaded.');
  return new Set();
}

/**
 * INSERT 쿼리 생성
 * @param {string} tableName - 테이블 이름
 * @param {Array} data - 데이터 배열
 * @param {boolean} singleStatement - 단일 INSERT 문으로 생성할지 여부 (기본값: true)
 * @returns {string|Array} INSERT 쿼리 문자열 또는 배열
 */
function generateInsertQuery(tableName, data, singleStatement = true) {
  if (data.length === 0) {
    return singleStatement ? `-- No data to insert\n` : [];
  }

  const columns = Object.keys(data[0]);
  // 실제 테이블은 ${DUNE_WORKSPACE}.basic_staking_metrics로 생성됨
  const tableNameEscaped = tableName.includes('.')
    ? tableName.replace(/^tokamak\./, `${DUNE_WORKSPACE}.`) // tokamak을 실제 workspace로 변경
    : `${DUNE_WORKSPACE}.${tableName}`;

  // 값 포맷팅 헬퍼
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return 'NULL';
    }
    if (typeof value === 'string') {
      // 날짜 형식 체크
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `'${value}'`;
      }
      // 숫자 문자열 체크
      if (/^-?\d+\.?\d*$/.test(value)) {
        return value;
      }
      // 일반 문자열은 이스케이프
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return `'${value}'`;
  };

  if (singleStatement) {
    // 단일 INSERT 문으로 생성 (WHERE NOT EXISTS로 중복 방지)
    // 각 행마다 개별적으로 중복 체크를 위해 UNION ALL 사용
    let query = `-- INSERT query for ${tableNameEscaped}\n`;
    query += `-- Generated: ${new Date().toISOString()}\n`;
    query += `-- Total rows: ${data.length}\n`;
    query += `-- Duplicate prevention: criterion_block_number\n\n`;

    // 각 행을 SELECT ... WHERE NOT EXISTS로 변환하고 UNION ALL로 연결
    const selectStatements = data.map((row, index) => {
      const rowValues = columns.map(col => formatValue(row[col]));
      const criterionBlockNumber = formatValue(row.criterion_block_number);

      let selectClause = `SELECT ${rowValues.join(', ')}\n`;
      selectClause += `WHERE NOT EXISTS (\n`;
      selectClause += `  SELECT 1 FROM ${tableNameEscaped} AS T\n`;
      selectClause += `  WHERE T.criterion_block_number = ${criterionBlockNumber}\n`;
      selectClause += `)`;

      if (index < data.length - 1) {
        selectClause += '\nUNION ALL\n';
      }

      return selectClause;
    });

    query += `INSERT INTO ${tableNameEscaped} (${columns.join(', ')})\n`;
    query += selectStatements.join('');

    return query + ';\n';


  } else {
    // 개별 INSERT 문 배열로 생성 (배치 처리용, WHERE NOT EXISTS로 중복 방지)
    return data.map(row => {
      const rowValues = columns.map(col => formatValue(row[col]));
      const criterionBlockNumber = formatValue(row.criterion_block_number);

      return `INSERT INTO ${tableNameEscaped} (${columns.join(', ')})\n` +
             `SELECT ${rowValues.join(', ')}\n` +
             `WHERE NOT EXISTS (\n` +
             `  SELECT 1 FROM ${tableNameEscaped} AS T\n` +
             `  WHERE T.criterion_block_number = ${criterionBlockNumber}\n` +
             `);`;
    });
  }
}

/**
 * 최신 CSV 파일 찾기
 */
function findLatestCSV(pattern) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return null;
  }

  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(file => file.match(pattern))
    .map(file => ({
      name: file,
      path: path.join(OUTPUT_DIR, file),
      mtime: fs.statSync(path.join(OUTPUT_DIR, file)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].path : null;
}

/**
 * 데이터 변환 (Dune 형식에 맞게)
 */
function transformDataForDune(data) {
  return data.map(row => {
    const transformed = { ...row };

    // 날짜 형식 확인
    if (transformed.date && !transformed.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // 날짜 변환 필요 시
      const date = new Date(transformed.date);
      transformed.date = date.toISOString().split('T')[0];
    }

    // NULL 값 처리
    Object.keys(transformed).forEach(key => {
      if (transformed[key] === '' || transformed[key] === null || transformed[key] === undefined) {
        transformed[key] = null;
      }
    });

    return transformed;
  });
}

/**
 * Execute Query API를 사용하여 SQL INSERT 쿼리 실행
 * 참고: https://docs.dune.com/api-reference/queries/endpoint/execute-query
 * 유료 플랜 필요
 */
async function uploadDataViaExecuteQueryAPI(tableName, data) {
  console.log('\n🚀 Uploading data to Dune via Execute Query API...');
  console.log('   ⚠️  Note: This requires a paid Dune plan.');

  if (!DUNE_API_KEY) {
    return { success: false, error: 'DUNE_API_KEY not set' };
  }

  if (data.length === 0) {
    console.log('   ℹ️  No data to upload.');
    return { success: true, successCount: 0 };
  }

  // SQL INSERT 쿼리 생성 (WHERE NOT EXISTS로 중복 방지)
  const sqlQuery = generateInsertQuery(tableName, data, true);

  // 주석 제거하고 실제 SQL만 추출
  const cleanQuery = sqlQuery
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .trim();

  console.log(`   📋 Table: ${tableName.replace(/^tokamak\./, `${DUNE_WORKSPACE}.`)}`);
  console.log(`   📊 Rows to insert: ${data.length}`);
  console.log(`   📝 SQL Query length: ${cleanQuery.length} characters`);

  try {
    // 1. 쿼리 실행
    console.log('\n   🔄 Executing SQL query...');
    const executeResult = await executeQueryAPI(cleanQuery);

    if (!executeResult.success) {
      return {
        success: false,
        error: executeResult.error || 'Query execution failed',
        response: executeResult.response
      };
    }

    const queryId = executeResult.response?.query_id;
    if (!queryId) {
      return {
        success: false,
        error: 'No query_id in response',
        response: executeResult.response
      };
    }

    console.log(`   ✅ Query submitted. Query ID: ${queryId}`);

    // 2. 쿼리 완료 대기
    console.log('   ⏳ Waiting for query to complete...');
    const statusResult = await waitForQueryCompletion(queryId);

    if (!statusResult.success) {
      return {
        success: false,
        error: statusResult.error || 'Query execution failed',
        queryId: queryId
      };
    }

    console.log('   ✅ Query completed successfully');

    return {
      success: true,
      successCount: data.length,
      queryId: queryId
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute Query API 호출
 */
async function executeQueryAPI(query) {
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
 * 쿼리 완료 대기
 */
async function waitForQueryCompletion(queryId, maxAttempts = 60) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기

    const statusResult = await getQueryStatus(queryId);
    if (statusResult.success && statusResult.response) {
      const queryState = statusResult.response.state;

      if (queryState === 'QUERY_STATE_COMPLETED') {
        return { success: true, state: queryState };
      } else if (queryState === 'QUERY_STATE_FAILED') {
        return {
          success: false,
          error: 'Query execution failed',
          state: queryState,
          response: statusResult.response
        };
      }

      process.stdout.write(`   State: ${queryState}...\r`);
    }

    attempts++;
  }

  return {
    success: false,
    error: `Query did not complete within ${maxAttempts} seconds`
  };
}

/**
 * 쿼리 상태 확인
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
 * Dune REST API를 사용하여 데이터 업로드 (Uploads API 사용)
 * 참고: https://docs.dune.com/api-reference/tables/endpoint/uploads-insert
 * Content-Type: text/csv 또는 application/x-ndjson
 */
async function uploadDataViaUploadsAPI(namespace, tableName, data) {
  // Uploads API 엔드포인트: POST /v1/uploads/{namespace}/{table_name}/insert
  const url = `https://api.dune.com/api/v1/uploads/${namespace}/${tableName}/insert`;

  // 데이터를 CSV 형식으로 변환
  const columns = Object.keys(data[0] || {});
  const csvData = stringify(data, {
    header: true,
    columns: columns
  });

  const headers = {
    'X-DUNE-API-KEY': DUNE_API_KEY,
    'Content-Type': 'text/csv'
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
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);

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
            rawResponse: responseData
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

    // CSV 데이터를 직접 전송
    req.write(csvData);
    req.end();
  });
}


/**
 * Dune REST API를 사용하여 데이터 업로드
 */
async function uploadDataToDune(tableName, data) {
  console.log('\n🚀 Uploading data to Dune via REST API...');

  if (!DUNE_API_KEY) {
    console.error('❌ DUNE_API_KEY is not set in .env file');
    return { success: false, error: 'DUNE_API_KEY not set' };
  }

  // 테이블 이름 처리 (namespace와 table_name 분리)
  let namespace, table_name;
  if (tableName.includes('.')) {
    const parts = tableName.split('.');
    namespace = DUNE_WORKSPACE;
    table_name = parts[1] || parts[0];
  } else {
    namespace = DUNE_WORKSPACE;
    table_name = tableName;
  }

  console.log(`   📋 Namespace: ${namespace}`);
  console.log(`   📋 Table: ${table_name}`);
  console.log(`   📊 Rows to upload: ${data.length}`);

  // 기존 데이터 조회하여 중복 체크 (유료 플랜 필요)
  console.log('\n   🔍 Checking for existing data...');
  const existingBlockNumbers = await getExistingBlockNumbers(namespace, table_name);

  // 중복되지 않은 데이터만 필터링
  const newData = data.filter(row => {
    const blockNumber = row.criterion_block_number;
    return !blockNumber || !existingBlockNumbers.has(blockNumber);
  });

  const duplicateCount = data.length - newData.length;
  if (duplicateCount > 0) {
    console.log(`   ⚠️  Found ${duplicateCount} duplicate rows (skipped)`);
  }
  console.log(`   ✅ ${newData.length} new rows to upload`);

  if (newData.length === 0) {
    console.log('\n   ℹ️  No new data to upload. All rows already exist.');
    return { success: true, successCount: 0, failCount: 0, skipped: duplicateCount };
  }

  // 배치로 나누어 업로드 (한 번에 너무 많은 데이터를 업로드하지 않도록)
  const batchSize = 100;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < newData.length; i += batchSize) {
    const batch = newData.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(newData.length / batchSize);

    console.log(`\n   📦 Uploading batch ${batchNumber}/${totalBatches} (${batch.length} rows)...`);

    // Uploads API를 사용하여 데이터 업로드
    const result = await uploadDataViaUploadsAPI(namespace, table_name, batch);

    if (result.success) {
      successCount += batch.length;
      console.log(`   ✅ Batch ${batchNumber} uploaded successfully`);
    } else {
      failCount += batch.length;
      console.error(`   ❌ Batch ${batchNumber} failed: ${result.error}`);
      if (result.response) {
        console.error(`   Response:`, JSON.stringify(result.response, null, 2));
      }
    }

    // Rate limit 방지를 위해 약간의 지연
    if (i + batchSize < data.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 지연
    }
  }

  console.log(`\n   📊 Upload Summary:`);
  console.log(`   ✅ Success: ${successCount} rows`);
  if (failCount > 0) {
    console.log(`   ❌ Failed: ${failCount} rows`);
  }

  return {
    success: failCount === 0,
    successCount: successCount,
    failCount: failCount
  };
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Tokamak Network - Dune Analytics Uploader');
  console.log('='.repeat(80));
  console.log();

  // 최신 basic_staking_metrics CSV 파일 찾기
  const csvFile = findLatestCSV(/^basic_staking_metrics_.*\.csv$/);

  if (!csvFile) {
    console.error('❌ No basic_staking_metrics CSV file found in output/ directory');
    console.log('   Please run "node calculate_metrics.js" first to generate data.');
    console.log();
    console.log('   💡 To create table schema only (without data):');
    console.log('      node create_table_dune_rest.js');
    process.exit(1);
  }

  console.log(`📁 Found CSV file: ${path.basename(csvFile)}`);
  console.log(`   Path: ${csvFile}\n`);

  // CSV 파일 읽기
  console.log('📖 Reading CSV file...');
  let data;
  try {
    data = readCSV(csvFile);
    console.log(`✅ Loaded ${data.length} rows, ${Object.keys(data[0] || {}).length} columns`);
  } catch (error) {
    console.error(`❌ Error reading CSV: ${error.message}`);
    process.exit(1);
  }

  // 데이터 변환
  console.log('\n🔄 Transforming data for Dune...');
  const transformedData = transformDataForDune(data);
  console.log(`✅ Transformed ${transformedData.length} rows`);

  // 테이블 이름
  const tableName = 'tokamak.basic_staking_metrics';

  // Dune REST API (Uploads API)를 사용하여 데이터 업로드
  if (DUNE_API_KEY) {
    const uploadResult = await uploadDataToDune(tableName, transformedData);

    if (uploadResult.success) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ SUCCESS: Data uploaded to Dune via REST API!');
      console.log(`   Table: ${tableName.replace(/^tokamak\./, `${DUNE_WORKSPACE}.`)}`);
      console.log(`   Rows uploaded: ${uploadResult.successCount}`);
      console.log('='.repeat(80));
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('❌ FAILED: Upload via REST API failed');
      console.log(`   Success: ${uploadResult.successCount} rows`);
      console.log(`   Failed: ${uploadResult.failCount} rows`);
      console.log('='.repeat(80));
      process.exit(1);
    }
  } else {
    console.error('\n❌ DUNE_API_KEY is not set in .env file');
    console.log('   Please set DUNE_API_KEY in your .env file to upload data automatically.');
    process.exit(1);
  }

  console.log('\n✅ Done!');
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, readCSV, writeCSV, generateInsertQuery };

