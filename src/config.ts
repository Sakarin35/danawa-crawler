import type { ComponentType } from "./types"

// 크롤링 설정
export const CRAWL_CONFIG = {
  HEADLESS: process.env.HEADLESS === "true", // 헤드리스 모드 (false: 브라우저 표시)
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  MAX_PAGES: Number(process.env.MAX_PAGES) || 30, // 최대 페이지 수
  PAGE_DELAY: 1000, // 페이지 간 딜레이 (ms) - 속도 향상을 위해 줄임
  PRODUCT_DELAY: 500, // 제품 간 딜레이 (ms) - 속도 향상을 위해 줄임
  SCROLL_DELAY: 300, // 스크롤 간 딜레이 (ms) - 속도 향상을 위해 줄임
}

// 카테고리 URL 매핑 (올바른 카테고리 번호로 수정)
export const CATEGORY_URLS: Record<ComponentType, string> = {
  Vga: "https://prod.danawa.com/list/?cate=112753", // 그래픽카드
  Cpu: "https://prod.danawa.com/list/?cate=112747", // CPU
  "M.B": "https://prod.danawa.com/list/?cate=112751", // 메인보드
  Memory: "https://prod.danawa.com/list/?cate=112752", // 메모리
  SSD: "https://prod.danawa.com/list/?cate=112760", // SSD
  Case: "https://prod.danawa.com/list/?cate=112775", // 케이스
  Cooler: "https://prod.danawa.com/list/?cate=11236855", // 쿨러
  Power: "https://prod.danawa.com/list/?cate=112777", // 파워
}