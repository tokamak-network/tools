# Dune Analytics API 키 설정 가이드

Dune Analytics API를 사용하여 테이블 생성 및 데이터 업로드를 자동화하기 위한 API 키 생성 방법입니다.

## 🔑 API 키 생성 방법

### 1. Dune Analytics 로그인

1. [Dune Analytics](https://dune.com/product/api) 웹사이트에 접속
2. 계정이 없으면 **Sign Up**으로 회원가입
3. 계정이 있으면 **Sign In**으로 로그인

### 2. API 키 생성

#### 방법 A: Settings 페이지에서 생성 (권장)

1. 로그인 후 우측 상단의 **프로필 아이콘** 클릭
2. **Settings** 또는 **Account Settings** 선택
3. 왼쪽 메뉴에서 **API Keys** 또는 **API** 섹션 찾기
4. **Create API Key** 또는 **New API Key** 버튼 클릭
5. API 키 이름 입력 (예: "Tokamak Metrics Uploader")
6. **Create** 또는 **Generate** 클릭
7. 생성된 API 키를 복사하여 안전한 곳에 보관
   - ⚠️ **중요**: API 키는 한 번만 표시됩니다. 복사하지 않으면 다시 확인할 수 없습니다!

#### 방법 B: API 문서 페이지에서 생성

1. [Dune API 문서](https://docs.dune.com/api-reference/api-overview) 페이지 접속
2. **Authentication** 섹션 확인
3. **Get Your API Key** 링크 클릭
4. Settings 페이지로 이동하여 위의 방법 A를 따라 진행

### 3. API 키 확인

생성된 API 키는 다음과 같은 형식입니다:
```
dune_api_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🔧 프로젝트에 API 키 설정

### 1. .env 파일 생성/수정

프로젝트 루트 디렉토리에 `.env` 파일을 생성하거나 수정:

```bash
# aggregate_staking_metrics/.env
DUNE_API_KEY=dune_api_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DUNE_WORKSPACE=tokamak-network  # 선택사항, 기본값: tokamak-network
```

### 2. .env 파일 보안

⚠️ **중요 보안 사항:**

- `.env` 파일은 **절대** Git에 커밋하지 마세요
- `.gitignore`에 `.env`가 포함되어 있는지 확인하세요
- API 키를 공개 저장소에 업로드하지 마세요
- API 키가 노출되면 즉시 Dune에서 삭제하고 새로 생성하세요

### 3. 환경 변수 확인

스크립트 실행 전에 환경 변수가 제대로 설정되었는지 확인:

```bash
# .env 파일 확인 (API 키는 마스킹)
cat .env | grep DUNE_API_KEY
```

## 📋 API 키 사용 예시

### upload_to_dune.js 실행

```bash
# .env 파일에 DUNE_API_KEY가 설정되어 있으면 자동으로 사용
node upload_to_dune.js
```

## 🔍 API 키 권한 및 제한사항

### 권한

- **Query 실행**: SQL 쿼리 실행 가능
- **Custom Tables**: 테이블 생성 및 데이터 삽입 가능
- **Results 조회**: 쿼리 결과 조회 가능

### 제한사항

- **Rate Limits**: API 호출 횟수 제한이 있을 수 있습니다
- **Credits**: 일부 작업은 크레딧을 소모할 수 있습니다
- **Workspace**: API 키는 특정 워크스페이스에 연결됩니다

## 🆘 문제 해결

### API 키가 작동하지 않는 경우

1. **API 키 형식 확인**
   - `dune_api_key_`로 시작하는지 확인
   - 공백이나 특수문자가 없는지 확인

2. **환경 변수 확인**
   ```bash
   # Node.js에서 확인
   node -e "require('dotenv').config(); console.log(process.env.DUNE_API_KEY ? 'Set' : 'Not set');"
   ```

3. **API 키 유효성 확인**
   - Dune Settings에서 API 키가 활성화되어 있는지 확인
   - API 키가 만료되지 않았는지 확인

4. **에러 메시지 확인**
   - `401 Unauthorized`: API 키가 잘못되었거나 만료됨
   - `403 Forbidden`: 권한 부족
   - `429 Too Many Requests`: Rate limit 초과

### API 키 재생성

1. Dune Settings → API Keys로 이동
2. 기존 API 키 삭제 또는 비활성화
3. 새 API 키 생성
4. `.env` 파일 업데이트

## 📚 참고 자료

- [Dune API 문서](https://docs.dune.com/api-reference/api-overview)
- [Dune API 인증 가이드](https://docs.dune.com/api-reference/authentication)
- [Dune Analytics 홈페이지](https://dune.com)

## ✅ 체크리스트

- [ ] Dune Analytics 계정 생성/로그인
- [ ] API 키 생성
- [ ] API 키 복사 및 안전하게 보관
- [ ] `.env` 파일에 API 키 설정
- [ ] `.gitignore`에 `.env` 포함 확인
- [ ] `upload_to_dune.js` 실행하여 API 키 작동 확인

