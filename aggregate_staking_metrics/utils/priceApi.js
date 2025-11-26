/**
 * TON 가격 API 클라이언트
 */

const axios = require('axios');

/**
 * Upbit API에서 TON 가격 가져오기 (현재 가격)
 * 참고: Upbit에서 TON은 'KRW-tokamak'으로 거래됨
 */
async function getTONPriceFromUpbit() {
  try {
    const response = await axios.get('https://api.upbit.com/v1/ticker', {
      params: {
        markets: 'KRW-tokamak'
      },
      headers: {
        'Cache-Control': 'no-store'
      },
      timeout: 50000
    });

    if (response.data && response.data.length > 0) {
      // 응답이 배열로 오므로 첫 번째 요소 사용
      const ticker = response.data[0];
      return {
        price: parseFloat(ticker.trade_price || ticker.last_price),
        currency: 'KRW',
        source: 'upbit'
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching TON price from Upbit: ${error.message}`);
    return null;
  }
}

/**
 * Upbit 일 캔들 API에서 특정 시간의 TON 가격 가져오기
 * 업비트 일 캔들은 한국시간(KST, UTC+9) 기준입니다.
 * @param {number|Date|string} timestampOrDate - Unix timestamp (초), Date 객체, 또는 ISO 8601 형식 문자열
 * @returns {Promise<{price: number, currency: string, source: string, candle_date: string}|null>}
 */
async function getTONPriceFromUpbitCandles(timestampOrDate) {
  try {
    let toDate;

    // timestampOrDate를 Date 객체로 변환
    if (typeof timestampOrDate === 'number') {
      // Unix timestamp (초 단위)인 경우
      toDate = new Date(timestampOrDate * 1000);
    } else if (timestampOrDate instanceof Date) {
      toDate = timestampOrDate;
    } else if (typeof timestampOrDate === 'string') {
      toDate = new Date(timestampOrDate);
    } else {
      // null이거나 undefined인 경우 현재 시간 사용
      toDate = new Date();
    }

    // 업비트 일 캔들은 한국시간(KST, UTC+9) 기준입니다.
    // 입력된 timestamp/날짜를 한국시간 기준 날짜로 해석합니다.
    //
    // 예시: date = "2025-11-26" → new Date("2025-11-26T00:00:00Z") → UTC 2025-11-26 00:00:00
    //      우리가 원하는 것: 한국시간 2025-11-26 00:00:00의 캔들
    //      한국시간 2025-11-26 00:00:00 = UTC 2025-11-25 15:00:00
    //      한국시간 2025-11-26 23:59:59 = UTC 2025-11-26 14:59:59
    //      따라서 UTC 2025-11-26 14:59:59로 조회하면 한국시간 2025-11-26의 캔들을 가져올 수 있음

    // 입력된 날짜의 UTC 날짜 정보
    const utcYear = toDate.getUTCFullYear();
    const utcMonth = toDate.getUTCMonth();
    const utcDay = toDate.getUTCDate();

    // 한국시간 기준 날짜 계산
    // 입력된 UTC 날짜를 한국시간 기준 날짜로 해석
    // UTC 2025-11-26 00:00:00 → 한국시간 2025-11-26 09:00:00
    // 우리가 원하는 것: 한국시간 2025-11-26 00:00:00의 캔들
    // 한국시간 2025-11-26 23:59:59 = UTC 2025-11-26 14:59:59
    // 따라서 UTC 날짜의 14:59:59로 조회하면 한국시간 기준 해당 날짜의 캔들을 가져올 수 있음
    const year = utcYear;
    const month = String(utcMonth + 1).padStart(2, '0');
    const day = String(utcDay).padStart(2, '0');

    // ISO 8601 형식: YYYY-MM-DDTHH:mm:ssZ
    // 한국시간 기준 해당 날짜의 23:59:59에 해당하는 UTC 시간 (14:59:59)
    // 예: 한국시간 2025-11-26 23:59:59 = UTC 2025-11-26 14:59:59
    const toParam = `${year}-${month}-${day}T14:59:59Z`;
    console.log(`  toParam:`, toParam);
    const response = await axios.get('https://api.upbit.com/v1/candles/days', {
      params: {
        market: 'KRW-tokamak',
        to: toParam,
        count: 1
      },
      headers: {
        'Cache-Control': 'no-store'
      },
      timeout: 50000
    });

    if (response.data && response.data.length > 0) {
      const candle = response.data[0];
      console.log(`  ✅ Candle found:`);
            console.log(`     Candle KST: ${candle.candle_date_time_kst} (캔들 구간 시작 시각)`);
      console.log(`     Price: ${candle.trade_price} KRW`);
      return {
        price: parseFloat(candle.trade_price),
        currency: 'KRW',
        source: 'upbit',
        candle_date_utc: candle.candle_date_time_utc,
        candle_date_kst: candle.candle_date_time_kst
      };
    }

    // 해당 날짜에 캔들이 없는 경우 (체결이 발생하지 않은 경우)
    // 이전 날짜의 캔들을 조회 (한국시간 기준)
    const previousDate = new Date(Date.UTC(utcYear, utcMonth, utcDay));
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    const prevYear = previousDate.getUTCFullYear();
    const prevMonth = String(previousDate.getUTCMonth() + 1).padStart(2, '0');
    const prevDay = String(previousDate.getUTCDate()).padStart(2, '0');
    const prevToParam = `${prevYear}-${prevMonth}-${prevDay}T14:59:59Z`;

    // 이전 날짜 한국시간 계산
    const prevKstTime = new Date(prevToParam);
    prevKstTime.setUTCHours(prevKstTime.getUTCHours() + 9);
    const prevKstTimeString = prevKstTime.toISOString().replace('Z', '+09:00').replace(/\.\d{3}/, '');

    console.log(`  ⚠️  No candle found for target date, trying previous date:`);
    console.log(`     Upbit API param (to): ${prevToParam} (UTC)`);
    console.log(`     Upbit API param (to) KST: ${prevKstTimeString} (한국시간)`);
    console.log(`     Target date: 한국시간 ${prevYear}-${prevMonth}-${prevDay} 00:00:00 ~ 23:59:59`);

    const prevResponse = await axios.get('https://api.upbit.com/v1/candles/days', {
      params: {
        market: 'KRW-tokamak',
        to: prevToParam,
        count: 1
      },
      headers: {
        'Cache-Control': 'no-store'
      },
      timeout: 50000
    });

    if (prevResponse.data && prevResponse.data.length > 0) {
      const candle = prevResponse.data[0];
      console.log(`  ✅ Previous date candle found:`);
      console.log(`     Candle UTC: ${candle.candle_date_time_utc}`);
      console.log(`     Candle KST: ${candle.candle_date_time_kst} (캔들 구간 시작 시각)`);
      console.log(`     Price: ${candle.trade_price} KRW`);
      return {
        price: parseFloat(candle.trade_price),
        currency: 'KRW',
        source: 'upbit',
        candle_date_utc: candle.candle_date_time_utc,
        candle_date_kst: candle.candle_date_time_kst
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching TON price from Upbit candles: ${error.message}`);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Response: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * USD 환율 조회 (KRW to USD)
 */
async function getUSDExchangeRate() {
  try {
    const response = await axios.get('https://open.er-api.com/v6/latest/KRW', {
      headers: {
        'Cache-Control': 'no-store'
      },
      timeout: 10000
    });

    if (response.data && response.data.rates && response.data.rates.USD) {
      return response.data.rates.USD;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching USD exchange rate: ${error.message}`);
    return null;
  }
}

/**
 * TON 가격 가져오기 (Upbit API 사용)
 * @param {number|Date|string|null} timestamp - Unix timestamp (초), Date 객체, ISO 8601 형식 문자열, 또는 null (현재 가격)
 * @returns {Promise<{price: number, currency: string, source: string}|null>}
 */
async function getTONPrice(timestamp = null) {
  // timestamp가 제공된 경우 일 캔들 API 사용 (특정 시간의 가격)
  if (timestamp !== null) {
    const candlePrice = await getTONPriceFromUpbitCandles(timestamp);
    if (candlePrice) {
      return {
        price: candlePrice.price,
        currency: candlePrice.currency,
        source: candlePrice.source
      };
    }
    // 캔들 API 실패 시 ticker API로 폴백
    console.warn('  ⚠️  Failed to get price from candles API, falling back to ticker API');
  }

  // timestamp가 없거나 캔들 API 실패 시 현재 가격 조회 (ticker API)
  const upbitPrice = await getTONPriceFromUpbit();
  if (upbitPrice) {
    return upbitPrice;
  }

  // Upbit 실패 시 null 반환
  return null;
}

/**
 * USD 가격 조회 (KRW to USD 환율)
 * getUSDPrice는 getUSDExchangeRate의 별칭
 */
async function getUSDPrice() {
  return await getUSDExchangeRate();
}

module.exports = {
  getTONPrice,
  getTONPriceFromUpbit,
  getTONPriceFromUpbitCandles,
  getUSDExchangeRate,
  getUSDPrice
};

