// src/config.ts
import { ComponentType } from './types';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// 크롤링 설정
export const CRAWL_CONFIG = {
  MAX_PRODUCTS_PER_CATEGORY: parseInt(process.env.MAX_PRODUCTS_PER_CATEGORY || '20'),
  DELAY_BETWEEN_PRODUCTS: 2000,
  DELAY_BETWEEN_CATEGORIES: 5000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 3000,
  HEADLESS: process.env.HEADLESS === 'true',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// 카테고리 URL 매핑
export const CATEGORY_URLS: Record<ComponentType, string> = {
  'Vga': 'https://prod.danawa.com/list/?cate=112753',
  'Cpu': 'https://prod.danawa.com/list/?cate=112747',
  'M.B': 'https://prod.danawa.com/list/?cate=112751',
  'Memory': 'https://prod.danawa.com/list/?cate=112752',
  'SSD': 'https://prod.danawa.com/list/?cate=112760',
  'Case': 'https://prod.danawa.com/list/?cate=112775',
  'Cooler': 'https://prod.danawa.com/list/?cate=11236855',
  'Power': 'https://prod.danawa.com/list/?cate=112777'
};