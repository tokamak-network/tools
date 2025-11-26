#!/usr/bin/env node
/**
 * 업비트 가격 API 테스트 스크립트
 */

const { getTONPrice, getTONPriceFromUpbitCandles } = require('./utils/priceApi');

/**
 * 테스트 헬퍼 함수
 */
function logTest(name, result) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Test: ${name}`);
  console.log(`${'='.repeat(60)}`);
  if (result) {
    console.log('✅ Success');
    console.log(`   Price: ${result.price} ${result.currency}`);
    console.log(`   Source: ${result.source}`);
    if (result.candle_date) {
      console.log(`   Candle Date: ${result.candle_date}`);
    }
  } else {
    console.log('❌ Failed - Returned null');
  }
}

/**
 * 메인 테스트 함수
 */
async function runTests() {
  console.log('🚀 Starting Upbit Price API Tests...\n');

  // Test 1: 현재 가격 (timestamp 없음)
  console.log('\n📌 Test 1: Current Price (no timestamp)');
  try {
    const currentPrice = await getTONPrice();
    logTest('getTONPrice() - Current Price', currentPrice);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 2: Unix timestamp (초 단위)
  console.log('\n📌 Test 2: Unix Timestamp (seconds)');
  try {
    // 2025-11-25 00:00:00 UTC
    const timestamp = Math.floor(new Date('2025-11-25T00:00:00Z').getTime() / 1000);
    console.log(`   Input timestamp: ${timestamp} (2025-11-25 00:00:00 UTC)`);
    const price1 = await getTONPrice(timestamp);
    logTest('getTONPrice(timestamp)', price1);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 3: Date 객체
  console.log('\n📌 Test 3: Date Object');
  try {
    const dateObj = new Date('2025-11-24T00:00:00Z');
    console.log(`   Input date: ${dateObj.toISOString()}`);
    const price2 = await getTONPrice(dateObj);
    logTest('getTONPrice(Date)', price2);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 4: ISO 8601 문자열
  console.log('\n📌 Test 4: ISO 8601 String');
  try {
    const dateString = '2025-11-23T00:00:00Z';
    console.log(`   Input string: ${dateString}`);
    const price3 = await getTONPrice(dateString);
    logTest('getTONPrice(ISO string)', price3);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 5: 직접 캔들 API 호출 (Unix timestamp)
  console.log('\n📌 Test 5: Direct Candle API Call (Unix timestamp)');
  try {
    const timestamp = Math.floor(new Date('2025-11-22T00:00:00Z').getTime() / 1000);
    console.log(`   Input timestamp: ${timestamp} (2025-11-22 00:00:00 UTC)`);
    const candlePrice1 = await getTONPriceFromUpbitCandles(timestamp);
    logTest('getTONPriceFromUpbitCandles(timestamp)', candlePrice1);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 6: 직접 캔들 API 호출 (Date 객체)
  console.log('\n📌 Test 6: Direct Candle API Call (Date object)');
  try {
    const dateObj = new Date('2025-11-21T00:00:00Z');
    console.log(`   Input date: ${dateObj.toISOString()}`);
    const candlePrice2 = await getTONPriceFromUpbitCandles(dateObj);
    logTest('getTONPriceFromUpbitCandles(Date)', candlePrice2);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 7: 직접 캔들 API 호출 (ISO 문자열)
  console.log('\n📌 Test 7: Direct Candle API Call (ISO string)');
  try {
    const dateString = '2025-11-20T00:00:00Z';
    console.log(`   Input string: ${dateString}`);
    const candlePrice3 = await getTONPriceFromUpbitCandles(dateString);
    logTest('getTONPriceFromUpbitCandles(ISO string)', candlePrice3);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 8: 최근 날짜 (어제)
  console.log('\n📌 Test 8: Recent Date (Yesterday)');
  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    console.log(`   Input date: ${yesterday.toISOString()}`);
    const price4 = await getTONPrice(yesterday);
    logTest('getTONPrice(yesterday)', price4);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 9: 오늘 날짜
  console.log('\n📌 Test 9: Today');
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    console.log(`   Input date: ${today.toISOString()}`);
    const price5 = await getTONPrice(today);
    logTest('getTONPrice(today)', price5);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('='.repeat(60) + '\n');
}

// 실행
if (require.main === module) {
  runTests().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };

