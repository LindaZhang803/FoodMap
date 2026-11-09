# Changed folders and files / 변경 폴더 및 파일

Member 2 changes only; existing `.DS_Store` files are excluded.

| Folder / 폴더 | Files / 파일 | Status / 상태 |
|---|---|---|
| `backend/modules/reviews/models/` | `index.js` | Added / 신규 |
| `backend/modules/reviews/validators/` | `review.js` | Added / 신규 |
| `backend/modules/reviews/services/` | `rating.js` | Added / 신규 |
| `backend/modules/reviews/tests/` | `week1.test.js` | Added / 신규 |
| `Mobile/src/modules/reviews/mocks/` | `fixtures.json` | Added / 신규 |
| `docs/reviews/` | `API_PROPOSAL.md`, `WEEK1_REPORT_KO.md` | Added; revised / 신규 작성 후 수정 |
| `docs/reviews/` | `DISCORD_QUESTIONS.md` | Created, then removed / 작성 후 삭제 |

# Week 1 Report — English

Date: 2026-10-13 | Member: Suhyun Kim | Module: Dish & Review

**Completed:** Confirmed MongoDB as the team database. Prepared Mongoose model factories for Dish, Review, and ReviewLike, review input validation, and a rating calculation function. Added synthetic fixtures with three dishes across two restaurant IDs and three reviews, including separate restaurant/dish reviews and an unrated dish. 

**Validation:** Four dependency-free tests passed, covering fixture relationships, invalid input, separate rating calculations, and rating changes after adding, editing, and deleting reviews. These are independent logic checks, not database or API integration tests.

**Pending:** The repository initially contained folder scaffolding without app/package setup or a database connection. Mongoose adoption, shared MongoDB configuration, API agreement, and authentication integration remain pending. Models have not been executed against Mongoose or MongoDB. Restaurant rating ownership and image storage need coordination. 

**Next:** Confirm shared interfaces, then build dish list/details screens with mock data and an API adapter. No new report/proposal Markdown files will be created unless requested.

# 1주차 보고서 — 한국어

날짜: 2026-10-13 | 담당: Suhyun Kim | 모듈: Dish & Review

**수행 결과:** MongoDB 사용을 확정 사항으로 반영했다. Dish·Review·ReviewLike의 Mongoose 모델 팩토리, 리뷰 입력 검증, 평점 계산 함수를 작성했다. 식당 ID 2개에 연결된 음식 3개와 리뷰 3개의 mock 데이터를 준비했으며, 식당/음식 리뷰 분리 및 평가가 없는 음식 사례를 포함했다. 

**검증:** 외부 의존성 없이 실행하는 테스트 4개가 통과했다. mock 데이터 관계, 잘못된 입력, 리뷰별 분리 집계, 추가·수정·삭제 후 평점 계산을 확인했다. 실제 DB/API 통합 테스트는 아니다.

**남은 사항:** 최초 저장소는 앱·패키지 설정과 DB 연결이 없는 폴더 구조 상태였다. Mongoose 채택, 공통 MongoDB 연결 설정, API 합의와 인증 연동은 미완료다. 모델은 실제 Mongoose/MongoDB에서 실행 검증하지 않았다. 식당 평점 갱신 책임과 사진 저장소도 협의가 필요하다. 

**다음 작업:** 공통 인터페이스를 확인하고 mock 데이터와 API 전환 계층을 사용하는 음식 목록·상세 화면을 구현한다. 별도 요청 없이는 보고서·제안서 MD 파일을 새로 만들지 않는다.
