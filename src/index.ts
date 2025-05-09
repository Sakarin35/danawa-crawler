// src/index.ts
import { crawlDanawa } from './crawler';
import { initFirebase } from './firebase-utils';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// 메인 함수
async function main() {
  console.log('다나와 크롤러 시작');
  
  // Firebase 초기화
  const firebaseInitialized = initFirebase();
  if (!firebaseInitialized) {
    console.error('Firebase 초기화 실패. 프로그램을 종료합니다.');
    process.exit(1);
  }
  
  // 크롤링 실행
  try {
    await crawlDanawa();
    console.log('크롤링이 성공적으로 완료되었습니다.');
  } catch (error) {
    console.error('크롤링 중 오류 발생:', error);
  }
}

// 프로그램 실행
main().catch(console.error);