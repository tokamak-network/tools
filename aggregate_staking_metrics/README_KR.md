# Tokamak Network Basic Staking Metrics Aggregator

매일 00:00 UTC (09:00 KST) 기준으로 Basic Staking Metrics를 계산하는 Node.js 프로젝트입니다.

## 📋 계산하는 메트릭

1. **criterion block number** - 매일 00:00 UTC 기준 블록 번호
2. **total supply of TON** - TON 총 공급량
3. **total staked amount** - 총 스테이킹량
4. **total liquidity amount** - 총 유동성 (total supply - total staked)
5. **number of blocks in period** - 기간 내 블록 수
6. **amount issued within period** - 기간 내 발행량 (Seigniorage)
7. **amount burned within period** - 기간 내 소각량
8. **additional staking amount** - 기간 내 추가 스테이킹량
9. **withdrawal amount** - 기간 내 출금량
10. **amount to be withdrawn within 2 weeks** - 2주 내 출금 예정량
11. **APY (Annual Percentage Yield)** - 연율 수익률
12. **TON Price** - TON 가격

## 🚀 빠른 시작

### 1. 설치

```bash
npm install
```

**필수 패키지:**
- `web3` - Ethereum 블록체인 상호작용
- `dotenv` - 환경 변수 관리
- `csv-parse`, `csv-stringify` - CSV 파일 처리
- `axios` - HTTP 요청

### 2. 환경 설정

`.env` 파일 생성:

```bash
RPC_ENDPOINT_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
SUBGRAPH_URL=https://gateway-arbitrum.network.thegraph.com/api/subgraphs/id/CJLiXNdHXJ22BzWignD62gohDRVTYXJQVgU4qKJEtNVS
ETHERSCAN_API_KEY=your_etherscan_api_key_here  # 선택사항, 있으면 더 빠름
DUNE_API_KEY=your_dune_api_key_here  # Dune 테이블 생성용 (필수)
DUNE_WORKSPACE=zena_team_5836  # 선택사항, 기본값: zena_team_5836
```

**Etherscan API 키 (선택사항, 권장):**
- Etherscan API를 사용하면 블록 번호 조회가 훨씬 빠릅니다
- [Etherscan API 키 발급](https://etherscan.io/apis)
- API 키가 없어도 Web3 이진 탐색으로 작동하지만 느립니다

또는 `.env.example` 파일을 복사:

```bash
cp .env.example .env
# .env 파일을 편집하여 실제 값 입력
```

### 3. Dune 테이블 생성 (먼저 실행)

```bash
# Dune에 테이블 스키마 생성 (REST API 사용)
node create_table_dune_rest.js
```

이 명령어는:
- Dune Analytics에 `zena_team_5836.basic_staking_metrics` 테이블을 생성합니다
- `.env` 파일에 `DUNE_API_KEY`가 설정되어 있어야 합니다
- 테이블이 이미 존재하면 에러가 발생할 수 있습니다 (무시해도 됨)

**참고:**
- 테이블 생성은 한 번만 하면 됩니다
- API 키 설정 방법은 [DUNE_API_SETUP.md](./DUNE_API_SETUP.md) 참조

### 4. 블록 번호 파일 준비 (필수)

```bash
# 블록 번호를 미리 계산하여 파일로 저장
npm run prepare-blocks
```

이 명령어는 과거부터 현재까지의 일일 블록 번호를 계산합니다.

**시작 날짜 지정 (선택사항):**
```bash
# .env 파일에 시작 날짜 지정
START_DATE=2025-11-21

# 또는 명령어 실행 시 직접 지정
START_DATE=2025-11-21 npm run prepare-blocks
```

**참고:**
- 미래 날짜의 블록은 아직 생성되지 않았으므로 계산하지 않습니다
- 과거부터 현재까지의 실제 존재하는 블록만 계산합니다
- 계산 시간은 기간에 비례하여 증가합니다 (약 1년당 1-2분)

### 5. 메트릭 계산 실행

```bash
npm start
# 또는
node calculate_metrics.js
```

이 명령어는:
- 블록 번호 파일(`data/daily_block_numbers.csv`)을 읽어서
- 각 날짜별로 메트릭을 계산하고
- `output/basic_staking_metrics_*.csv` 파일을 생성합니다

### 6. Dune 업로드 준비

```bash
npm run upload-dune
# 또는
node upload_to_dune.js
```

이 명령어는:
- `output/` 디렉토리에서 계산된 CSV 파일을 읽어서
- Dune에 업로드할 수 있는 형식으로 변환하고
- `dune_ready/` 디렉토리에 CSV 및 SQL 파일을 생성합니다

## 📁 프로젝트 구조

```
aggregate_staking_metrics/
├── package.json
├── index.js                    # 메인 진입점
├── calculate_metrics.js        # 메트릭 계산 메인 스크립트
├── config/
│   └── addresses.js           # 컨트랙트 주소 및 설정
├── utils/
│   ├── blockCalculator.js     # 블록 번호 계산
│   ├── contractHelper.js      # 컨트랙트 호출 헬퍼
│   ├── subgraphClient.js      # 서브그래프 클라이언트
│   └── priceApi.js            # 가격 API 클라이언트
├── data/                      # 입력 데이터
└── output/                    # 출력 CSV 파일
```

## 📊 출력 형식

CSV 파일이 `output/` 디렉토리에 생성됩니다:

**파일명**: `basic_staking_metrics_YYYY-MM-DD_HHMMSS.csv`

**컬럼**:
- `date` - 날짜 (YYYY-MM-DD)
- `criterion_block_number` - 기준 블록 번호
- `previous_block_number` - 이전 블록 번호
- `blocks_in_period` - 기간 내 블록 수
- `total_supply_ton` - TON 총 공급량 (ray, decimals 27)
- `total_supply_ton_decimal` - TON 총 공급량 (TON 단위)
- `total_staked_amount` - 총 스테이킹량 (ray, decimals 27)
- `total_staked_amount_decimal` - 총 스테이킹량 (TON 단위)
- `total_liquidity_amount` - 총 유동성 (ray, decimals 27)
- `total_liquidity_amount_decimal` - 총 유동성 (TON 단위)
- `amount_issued` - 발행량 (ray, decimals 27)
- `amount_issued_decimal` - 발행량 (TON 단위)
- `amount_burned` - 소각량 (ray, decimals 27)
- `amount_burned_decimal` - 소각량 (TON 단위)
- `additional_staking_amount` - 추가 스테이킹량 (ray, decimals 27)
- `additional_staking_amount_decimal` - 추가 스테이킹량 (TON 단위)
- `withdrawal_amount` - 출금량 (weiray, decimals 27)
- `withdrawal_amount_decimal` - 출금량 (TON 단위)
- `pending_withdrawal_2weeks` - 2주 내 출금 예정량 (ray, decimals 27)
- `pending_withdrawal_2weeks_decimal` - 2주 내 출금 예정량 (TON 단위)
- `apy` - 연율 수익률 (%)
- `ton_price` - TON 가격 (USD)
- `ton_price_currency` - 가격 통화 (USD, 환율 조회 실패 시 KRW)

## 🔧 계산 방법

### 1. Criterion Block Number
- 매일 00:00 UTC (09:00 KST) 기준 블록 번호
- 이진 탐색으로 정확한 블록 번호 계산

```bash
# 블록 번호를 미리 계산하여 파일로 저장
node prepare_block_numbers.js
```

이 명령어는 `data/daily_block_numbers.csv`와 `data/daily_block_numbers.json` 파일을 생성합니다.
이 파일이 있으면 `calculate_metrics.js`가 이를 사용하여 더 빠르게 실행됩니다.

### 2. Total Supply of TON
- `SeigManager.totalSupplyOfTon()` 호출
- Ray 단위 (decimals 27)

### 3. Total Staked Amount
- `TOT.totalSupply()` 호출
- TOT 주소: `0x47e264ea9b229368aa90c331D3f4CBe0b4c0f01d`
- Ray 단위 (decimals 27)

### 4. Total Liquidity Amount
- `total_supply_ton - total_staked_amount - DAOVault balance (TON)`
- DAOVault 주소: `0x2520CD65BAa2cEEe9E6Ad6EBD3F45490C42dd303`
- TON은 18 decimals → ray 단위로 변환 (10^9 곱하기)
- **구현 예정**: DAOVault의 WTON 잔액도 차감 예정

### 5. Number of Blocks in Period
- `current_block - previous_block`

### 6. Amount Issued
- `Seigniorage per block * blocks_in_period`
- Seigniorage per block: `3920000000000000000000000000` (ray)

### 7. Amount Burned
- `TON.balanceOf(address(1))` 변화량
- `current_balance - previous_balance`

### 8. Additional Staking Amount
- 서브그래프에서 `Deposited` 이벤트 합계
- 기간 내 모든 Deposited 이벤트의 amount 합계

### 9. Withdrawal Amount
- 서브그래프에서 `WithdrawalAndDeposited` 이벤트 합계

### 10. Pending Withdrawal (2 weeks)
- `DepositManager.pendingUnstakedLayer2(layer2)` 합계
- 모든 Layer2 후보자의 pending withdrawal 합계

### 11. APY
- Seigniorage 기반 계산
- `(total_seig / total_staked) * (blocks_per_year / blocks_in_period) * 100`

### 12. TON Price
- Upbit API에서 KRW 가격 조회
- USD 환율을 사용하여 USD로 변환
- 환율 API: `https://open.er-api.com/v6/latest/KRW`

## 📤 Dune Analytics 업로드

### Dune Custom Tables에 데이터 업로드

계산된 메트릭을 Dune Analytics Custom Tables에 업로드할 수 있습니다.

#### 1. 테이블 생성 (먼저 실행) ⭐

**테이블 생성은 위의 "3. Dune 테이블 생성" 단계에서 이미 완료했습니다.**

만약 테이블을 다시 생성해야 한다면:

```bash
# 테이블 스키마 생성 (REST API 사용)
node create_table_dune_rest.js
```

이 명령어는:
- Dune Analytics에 `zena_team_5836.basic_staking_metrics` 테이블을 생성합니다
- `.env` 파일에 `DUNE_API_KEY`가 설정되어 있어야 합니다

#### 2. 업로드 준비 (데이터 포함)

```bash
# 계산된 CSV 파일을 Dune 형식으로 변환
node upload_to_dune.js
```

이 명령어는 `dune_ready/` 디렉토리에 다음 파일들을 생성합니다:
- `basic_staking_metrics_*.csv` - Dune에 업로드할 CSV 파일
- `basic_staking_metrics_*_insert.sql` - INSERT 쿼리
- `basic_staking_metrics_create_table.sql` - CREATE TABLE 쿼리

#### 2. Dune에 테이블 생성

**방법 A: 웹 인터페이스 사용 (권장) ⭐**

1. Dune Analytics에 로그인
2. **Data** → **Custom Tables** 이동
3. 테이블 `zena_team_5836.basic_staking_metrics` 선택 (이미 생성되어 있어야 함)
4. **Import CSV** 또는 **Upload Data** 클릭
5. `dune_ready/basic_staking_metrics_*.csv` 파일 선택
6. 컬럼 타입 자동 감지 또는 수동 설정
7. **Import** 클릭

**방법 B: SQL 쿼리 사용**

1. Dune Query Editor 열기
2. `dune_ready/basic_staking_metrics_*_insert.sql` 내용 실행하여 데이터 삽입
3. 또는 `dune_ready/basic_staking_metrics_create_table.sql`을 참고하여 수동으로 INSERT 쿼리 작성

**방법 C: Dune REST API 사용 (권장) ⭐**

Dune Analytics REST API를 사용하여 테이블을 생성할 수 있습니다.

```bash
# 1. .env 파일에 Dune API 키 설정
DUNE_API_KEY=your_dune_api_key_here

# 2. 테이블 생성 (위의 "3. Dune 테이블 생성" 단계 참조)
node create_table_dune_rest.js

# 3. 데이터는 CSV 또는 SQL 파일로 수동 업로드
#    (자동 업로드 기능은 추후 구현 예정)
```

**동작 방식:**
1. REST API를 사용하여 테이블 스키마 생성
2. 생성된 CSV/SQL 파일을 Dune 웹 인터페이스에서 수동 업로드
3. 또는 SQL Query Editor에서 INSERT 쿼리 실행

**API 키 발급:**

자세한 방법은 [DUNE_API_SETUP.md](./DUNE_API_SETUP.md) 문서를 참조하세요.

간단 요약:
1. [Dune Analytics](https://dune.com)에 로그인
2. 우측 상단 프로필 아이콘 → **Settings** → **API Keys** 이동
3. **Create API Key** 또는 **New API Key** 클릭
4. API 키 이름 입력 (예: "Tokamak Metrics Uploader")
5. 생성된 키를 복사 (⚠️ 한 번만 표시되므로 즉시 복사!)
6. `.env` 파일에 `DUNE_API_KEY=your_api_key_here` 설정

**참고:**
- 테이블 생성은 REST API로 자동화됩니다
- 데이터 업로드는 CSV 또는 SQL 파일을 수동으로 업로드해야 합니다
- 자동 데이터 업로드 기능은 추후 구현 예정입니다

#### 3. 테이블 구조

실제 생성된 테이블 구조:

```sql
CREATE TABLE zena_team_5836.basic_staking_metrics (
    date TIMESTAMP,
    criterion_block_number BIGINT,
    previous_block_number BIGINT,
    blocks_in_period BIGINT,
    total_supply_ton DOUBLE PRECISION,
    total_supply_ton_decimal DOUBLE PRECISION,
    total_staked_amount DOUBLE PRECISION,
    total_staked_amount_decimal DOUBLE PRECISION,
    total_liquidity_amount DOUBLE PRECISION,
    total_liquidity_amount_decimal DOUBLE PRECISION,
    amount_issued DOUBLE PRECISION,
    amount_issued_decimal DOUBLE PRECISION,
    amount_burned DOUBLE PRECISION,
    amount_burned_decimal DOUBLE PRECISION,
    additional_staking_amount DOUBLE PRECISION,
    additional_staking_amount_decimal DOUBLE PRECISION,
    withdrawal_amount DOUBLE PRECISION,
    withdrawal_amount_decimal DOUBLE PRECISION,
    pending_withdrawal_2weeks DOUBLE PRECISION,
    pending_withdrawal_2weeks_decimal DOUBLE PRECISION,
    apy DOUBLE PRECISION,
    ton_price DOUBLE PRECISION,
    ton_price_currency VARCHAR
);
```

**참고:**
- 테이블 이름: `zena_team_5836.basic_staking_metrics` (workspace 포함)
- `date` 타입: `TIMESTAMP` (Dune API는 DATE 대신 TIMESTAMP 사용)
- 숫자 타입: `DOUBLE PRECISION` (Dune API는 NUMERIC 대신 DOUBLE PRECISION 사용)
- 문자열 타입: `VARCHAR` (Dune API는 TEXT 대신 VARCHAR 사용)

## 🔄 자동화

### GitHub Actions

**구현 예정** - `.github/workflows/daily_aggregate_and_upload.yml`에 설정 예정입니다.

### 로컬 Cron Job

```bash
# crontab -e
# 매일 09:00 KST에 계산 및 업로드 준비
0 9 * * * cd /path/to/aggregate_staking_metrics && \
  node calculate_metrics.js && \
  node upload_to_dune.js
```

## 📚 참고 자료

- [Staking V1 Subgraph](../staking-v1-subgraph/README.md)
- [Dune Dashboard Strategy](../example_subgraph/DUNE_DASHBOARD_STRATEGY.md)
- [Dune API 키 설정 가이드](./DUNE_API_SETUP.md) - API 키 생성 방법 상세 가이드

## ⚠️ 주의사항

1. **RPC 엔드포인트**: 충분한 rate limit이 있는 RPC 사용 권장
2. **계산 시간**: 3년치 데이터는 시간이 오래 걸릴 수 있음
3. **에러 처리**: 개별 날짜 계산 실패 시에도 계속 진행
4. **가격 API**: Upbit API가 실패할 수 있으므로 fallback 필요

## 🔍 문제 해결

### RPC 연결 실패
- RPC_ENDPOINT_URL 확인
- 네트워크 연결 확인

### 서브그래프 쿼리 실패
- SUBGRAPH_URL 확인
- 서브그래프 동기화 상태 확인

### 계산 시간이 너무 오래 걸림
- 특정 기간만 계산하도록 수정
- 병렬 처리 추가 고려

