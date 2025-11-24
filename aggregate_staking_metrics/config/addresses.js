/**
 * 컨트랙트 주소 및 Layer2 후보자 주소 설정
 */

module.exports = {
  // 기본 컨트랙트 주소
  contracts: {
    TON: '0x2be5e8c109e2197D077D13A82dAead6a9b3433C5',
    WTON: '0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2',
    SeigManagerProxy: '0x0b55a0f463b6defb81c6063973763951712d0e5f',
    DepositManagerProxy: '0x0b58ca72b12f01fc05f8f252e226f3e2089bd00e',
    TOT: '0x47e264ea9b229368aa90c331D3f4CBe0b4c0f01d', // Total Staked TON
    BurnAddress: '0x0000000000000000000000000000000000000001', // Address(1) for burn tracking
    DAOVault: '0x2520CD65BAa2cEEe9E6Ad6EBD3F45490C42dd303' // DAO Vault address
  },

  // Layer2 후보자 정보
  layer2Candidates: [
    {
      name: 'tokamak1',
      address: '0xf3B17FDB808c7d0Df9ACd24dA34700ce069007DF',
      operator: '0xea8e2ec08dcf4971bdcdfffe21439995378b44f3'
    },
    {
      name: 'DXM Corp',
      address: '0x44e3605d0ed58FD125E9C47D1bf25a4406c13b57',
      operator: '0x566b98a715ef8f60a93a208717d9182310ac3867'
    },
    {
      name: 'DSRV',
      address: '0x2B67D8D4E61b68744885E243EfAF988f1Fc66E2D',
      operator: '0x8dfcbc1df9933c8725618015d10b7b6de2d2c6f8'
    },
    {
      name: 'Talken',
      address: '0x36101b31e74c5E8f9a9cec378407Bbb776287761',
      operator: '0xcc2f386adca481a00d614d5aa77a30984f264a07'
    },
    {
      name: 'staked',
      address: '0x2c25A6be0e6f9017b5bf77879c487eed466F2194',
      operator: '0x247a0829c63c5b40dc6b21cf412f80227dc7fb76'
    },
    {
      name: 'level',
      address: '0x0F42D1C40b95DF7A1478639918fc358B4aF5298D',
      operator: '0xd1820b18be7f6429f1f44104e4e15d16fb199a43'
    },
    {
      name: 'decipher',
      address: '0xbc602C1D9f3aE99dB4e9fD3662CE3D02e593ec5d',
      operator: '0xba33eddfd3e4e155a6da10281d9069bf44743228'
    },
    {
      name: 'DeSpread',
      address: '0xC42cCb12515b52B59c02eEc303c887C8658f5854',
      operator: '0xfc9c403993bea576c28ac901bd62640bff8b057a'
    },
    {
      name: 'Danal Fintech',
      address: '0xf3CF23D896Ba09d8EcdcD4655d918f71925E3FE5',
      operator: '0x887af02970781a088962dbaa299a1eba8d573321'
    },
    {
      name: 'Hammer DAO',
      address: '0x06D34f65869Ec94B3BA8c0E08BCEb532f65005E2',
      operator: '0x42adfaae7db56b294225ddcfebef48b337b34b23'
    }
  ],

  // 상수
  constants: {
    // Seigniorage issuance per block (ray unit, decimals 27)
    SEIGNIORAGE_PER_BLOCK: '3920000000000000000000000000',
    // Block time (seconds) - Ethereum mainnet average
    BLOCK_TIME_SECONDS: 12,
    // Seconds per day
    SECONDS_PER_DAY: 86400,
    // Blocks per day (approximate)
    BLOCKS_PER_DAY: 7200, // 86400 / 12
    // Decimals for TON (ray unit)
    RAY_DECIMALS: 27
  }
};

