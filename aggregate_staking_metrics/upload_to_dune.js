#!/usr/bin/env node
/**
 * Dune Analytics 업로드 스크립트
 * aggregate_staking_metrics 결과를 Dune Custom Tables에 업로드
 * Dune API를 통해 테이블 생성 및 데이터 업로드 지원
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
require('dotenv').config();

// 설정
const DUNE_WORKSPACE = process.env.DUNE_WORKSPACE || 'zena_team_5836'; // 팀 계정 기본값
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
  // 실제 테이블은 zena_team_5836.basic_staking_metrics로 생성됨
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
    // 단일 INSERT 문으로 생성
    let query = `-- INSERT query for ${tableNameEscaped}\n`;
    query += `-- Generated: ${new Date().toISOString()}\n`;
    query += `-- Total rows: ${data.length}\n\n`;

    query += `INSERT INTO ${tableNameEscaped} (${columns.join(', ')})\n`;
    query += `VALUES\n`;

    const values = data.map(row => {
      const rowValues = columns.map(col => formatValue(row[col]));
      return `  (${rowValues.join(', ')})`;
    });

    query += values.join(',\n');
    query += ';\n';

    return query;
  } else {
    // 개별 INSERT 문 배열로 생성 (배치 처리용)
    return data.map(row => {
      const rowValues = columns.map(col => formatValue(row[col]));
      return `INSERT INTO ${tableNameEscaped} (${columns.join(', ')}) VALUES (${rowValues.join(', ')});`;
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

  // Dune 준비 파일 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvOutputPath = path.join(DUNE_READY_DIR, `basic_staking_metrics_${timestamp}.csv`);
  const sqlOutputPath = path.join(DUNE_READY_DIR, `basic_staking_metrics_${timestamp}_insert.sql`);

  console.log('\n💾 Saving files for Dune upload...');

  // CSV 파일 저장
  const headers = Object.keys(transformedData[0] || {});
  writeCSV(csvOutputPath, transformedData, headers);
  console.log(`✅ CSV saved: ${path.basename(csvOutputPath)}`);

  // INSERT 쿼리 생성 (단일 문으로)
  const insertQuery = generateInsertQuery(tableName, transformedData, true);
  fs.writeFileSync(sqlOutputPath, insertQuery, 'utf-8');
  console.log(`✅ INSERT query saved: ${path.basename(sqlOutputPath)}`);

  // 배치 처리용 개별 INSERT 문도 저장 (선택사항)
  const insertStatements = generateInsertQuery(tableName, transformedData, false);
  const batchSqlPath = path.join(DUNE_READY_DIR, `basic_staking_metrics_${timestamp}_insert_batch.sql`);
  fs.writeFileSync(batchSqlPath, insertStatements.join('\n'), 'utf-8');
  console.log(`✅ Batch INSERT queries saved: ${path.basename(batchSqlPath)}`);

  // 테이블 생성 SQL 생성
  const createTableSQL = generateCreateTableSQL(tableName, headers, transformedData);
  const createTablePath = path.join(DUNE_READY_DIR, `basic_staking_metrics_create_table.sql`);
  fs.writeFileSync(createTablePath, createTableSQL, 'utf-8');
  console.log(`✅ CREATE TABLE query saved: ${path.basename(createTablePath)}`);

  // 요약 출력
  console.log('\n' + '='.repeat(80));
  console.log('📋 Summary');
  console.log('='.repeat(80));
  console.log(`Table name: ${tableName}`);
  console.log(`Total rows: ${transformedData.length}`);
  console.log(`Columns: ${headers.length}`);
  console.log(`\nFiles saved in: ${DUNE_READY_DIR}/`);
  console.log(`  - ${path.basename(csvOutputPath)}`);
  console.log(`  - ${path.basename(sqlOutputPath)}`);
  console.log(`  - ${path.basename(createTablePath)}`);

  console.log('\n💡 Next Steps:');
  console.log('   Method 1: Web Interface (Recommended)');
  console.log('   1. Go to Dune Analytics → Data → Custom Tables');
  console.log(`   2. Click "Create Table" and import ${path.basename(csvOutputPath)}`);
  console.log('   3. Dune will auto-detect column types');
  console.log('\n   Method 2: SQL Query');
  console.log(`   1. Go to Dune Query Editor`);
  console.log(`   2. Run ${path.basename(createTablePath)} to create table`);
  console.log(`   3. Run ${path.basename(sqlOutputPath)} to insert data`);
  console.log('\n   Method 3: Dune REST API (Recommended for automation) ⭐');
  console.log('   1. Set DUNE_API_KEY in .env file');
  console.log('   2. Run: node create_table_dune_rest.js (creates table via REST API)');
  console.log('   3. Use generated SQL/CSV files to upload data');
  console.log('\n✅ Done!');
}

/**
 * CREATE TABLE SQL 생성
 */
function generateCreateTableSQL(tableName, columns, sampleData) {
  // 실제 생성된 테이블과 일치하도록 namespace 수정
  // 실제 테이블: zena_team_5836.basic_staking_metrics
  const tableNameEscaped = tableName.includes('.')
    ? tableName.replace(/^tokamak\./, `${DUNE_WORKSPACE}.`) // tokamak을 실제 workspace로 변경
    : `${DUNE_WORKSPACE}.${tableName}`;

  let sql = `-- CREATE TABLE for ${tableNameEscaped}\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- Note: This SQL matches the actual table created via REST API\n\n`;
  sql += `CREATE TABLE IF NOT EXISTS ${tableNameEscaped} (\n`;

  const columnDefs = columns.map(col => {
    // 샘플 데이터로 타입 추론
    const sampleValue = sampleData.find(row => row[col] !== null && row[col] !== undefined && row[col] !== '');
    let type = 'VARCHAR'; // Dune API는 TEXT 대신 VARCHAR 사용

    if (sampleValue) {
      const value = sampleValue[col];
      if (typeof value === 'number') {
        type = 'DOUBLE PRECISION';
      } else if (typeof value === 'string') {
        // 날짜 형식 - Dune API는 timestamp 사용
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          type = 'TIMESTAMP'; // DATE 대신 TIMESTAMP (실제 생성된 테이블과 일치)
        }
        // 숫자 문자열
        else if (/^-?\d+\.?\d*$/.test(value)) {
          type = 'DOUBLE PRECISION';
        }
      }
    }

    // 특정 컬럼 타입 지정 (실제 생성된 테이블과 일치하도록)
    if (col === 'date') {
      type = 'TIMESTAMP'; // DATE 대신 TIMESTAMP (실제 생성된 테이블과 일치)
    } else if (col.includes('block_number') || col.includes('blockNumber')) {
      type = 'BIGINT';
    } else if (col.includes('_decimal') || col === 'apy') {
      type = 'DOUBLE PRECISION';
    } else if (col.includes('_ton') || col.includes('_amount') || col.includes('_issued') || col.includes('_burned')) {
      type = 'DOUBLE PRECISION';
    } else if (col.includes('timestamp')) {
      type = 'BIGINT';
    } else if (col.includes('price')) {
      type = 'DOUBLE PRECISION';
    } else if (col.includes('currency')) {
      type = 'VARCHAR'; // TEXT 대신 VARCHAR
    }

    return `    ${col} ${type}`;
  });

  sql += columnDefs.join(',\n');
  sql += '\n);\n';

  return sql;
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, readCSV, writeCSV, generateInsertQuery, generateCreateTableSQL };

