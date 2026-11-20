# 위험물 지정수량 계산기

건설현장 위험물을 지정수량 미만으로 관리하기 위한 계산기입니다.

- **MSDS 업로드**: PDF를 올리면 15항(위험물안전관리법) 또는 9항(인화점)·3항(성분)으로 유별·품명을 자동 판정
- **물질 검색**: 소방청 국가위험물정보(공공데이터포털) 약 7,300종을 물질명·CAS로 검색
- **유별 직접 선택**: 위험물안전관리법 시행령 [별표 1] 기준
- **배수 합산**: 저장장소별 지정수량 배수, 소량위험물(1/5) 판정, 추가 가능량, 인쇄용 산정표

## 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 계산기 (이 파일 하나로 동작) |
| `data/materials.json` | 국가위험물정보 데이터 (자동 갱신) |
| `scripts/fetch-materials.mjs` | 공공데이터 API 수집 스크립트 |
| `.github/workflows/update-materials.yml` | 매월 2일 자동 수집 |

## 설정

1. Settings → Secrets and variables → Actions → `DATA_GO_KR_KEY` 에 공공데이터포털 인증키(Decoding) 등록
2. Actions 탭 → "위험물 정보 갱신" → Run workflow (첫 수집)
3. Settings → Pages → Deploy from a branch → `main` / `(root)`

인증키는 Secrets에만 저장되며 저장소 파일에는 포함되지 않습니다.

## 주의

자동 판정은 참고용입니다. 최종 판정은 제품 MSDS 원문과 관할 소방서 확인을 따르십시오.
데이터 출처: 소방청_국가 위험물 정보 조회 서비스 (공공데이터포털, 공공누리)
