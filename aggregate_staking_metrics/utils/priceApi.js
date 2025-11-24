/**
 * TON 가격 API 클라이언트
 */

const axios = require('axios');

/**
 * Upbit API에서 TON 가격 가져오기
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
 */
async function getTONPrice(timestamp = null) {
  // Upbit에서 가격 조회
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
  getUSDExchangeRate,
  getUSDPrice
};

