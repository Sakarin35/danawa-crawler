import * as dotenv from "dotenv"
import { crawlDanawa } from "./crawler"
import { initFirebase } from "./firebase-utils"

// 환경 변수 로드
dotenv.config()

// 메인 함수
async function main() {
  console.log("다나와 크롤러 시작...")

  // Firebase 초기화
  if (!initFirebase()) {
    console.error("Firebase 초기화 실패. 크롤링을 중단합니다.")
    process.exit(1)
  }

  try {
    // 크롤링 실행
    await crawlDanawa()
    console.log("크롤링 완료!")
  } catch (error) {
    console.error("크롤링 중 오류 발생:", error)
    process.exit(1)
  }
}

// 프로그램 실행
main().catch(console.error)