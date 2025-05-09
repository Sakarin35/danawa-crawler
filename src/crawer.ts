// src/crawler.ts
import puppeteer from 'puppeteer';
import { ComponentData, ComponentType, ProductListItem, ProductDetails } from './types';
import { CRAWL_CONFIG, CATEGORY_URLS } from './config';
import { saveComponent } from './firebase-utils';

// 지연 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 제품 ID 생성 함수
function generateProductId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// 메인 크롤링 함수
export async function crawlDanawa() {
  console.log('다나와 크롤링 시작...');
  
  const browser = await puppeteer.launch({
    headless: CRAWL_CONFIG.HEADLESS,
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    // 각 컴포넌트 타입별로 크롤링
    for (const [category, url] of Object.entries(CATEGORY_URLS) as [ComponentType, string][]) {
      console.log(`${category} 카테고리 크롤링 시작...`);
      
      // 페이지 열기
      const page = await browser.newPage();
      await page.setUserAgent(CRAWL_CONFIG.USER_AGENT);
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // 쿠키 동의 처리 (필요한 경우)
      try {
        const cookieButton = await page.$('.btn_close_cookie');
        if (cookieButton) await cookieButton.click();
      } catch (e) {
        console.log('쿠키 동의 버튼 없음');
      }
      
      // 제품 목록 추출
      const products = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.product_list .prod_item'));
        return items.map(item => {
          const nameElement = item.querySelector('.prod_name a');
          const priceElement = item.querySelector('.price_sect .price_txt');
          const imageElement = item.querySelector('.thumb_image img');
          const linkElement = item.querySelector('.prod_name a');
          
          return {
            name: nameElement ? nameElement.textContent?.trim() : '',
            price: priceElement ? 
              parseInt(priceElement.textContent?.replace(/[^0-9]/g, '') || '0') : 0,
            image: imageElement ? imageElement.getAttribute('src') || '' : '',
            url: linkElement ? linkElement.getAttribute('href') || '' : ''
          };
        }).filter(item => item.name && item.price > 0);
      }) as ProductListItem[];
      
      // 최대 제품 수 제한
      const limitedProducts = products.slice(0, CRAWL_CONFIG.MAX_PRODUCTS_PER_CATEGORY);
      
      console.log(`${limitedProducts.length}개의 제품 발견`);
      
      // 각 제품의 상세 정보 크롤링
      for (let i = 0; i < limitedProducts.length; i++) {
        const product = limitedProducts[i];
        console.log(`[${i+1}/${limitedProducts.length}] ${product.name} 처리 중...`);
        
        try {
          // 상세 페이지 열기
          const detailPage = await browser.newPage();
          await detailPage.setUserAgent(CRAWL_CONFIG.USER_AGENT);
          await detailPage.goto(product.url, { waitUntil: 'networkidle2' });
          
          // 상세 정보 추출
          const details = await detailPage.evaluate(() => {
            // 스펙 정보 추출
            const specRows = Array.from(document.querySelectorAll('.spec_tbl tr'));
            const specs = specRows.map(row => {
              const title = row.querySelector('th')?.textContent?.trim() || '';
              const value = row.querySelector('td')?.textContent?.trim() || '';
              return `${title}: ${value}`;
            }).join('\n');
            
            // 상세 설명 추출
            const description = document.querySelector('.detail_cont')?.textContent?.trim() || '';
            
            return { specs, description };
          }) as ProductDetails;
          
          // 제품 ID 생성
          const productId = generateProductId(product.name);
          
          // 컴포넌트 데이터 구성 (이미지 URL 그대로 사용)
          const componentData: ComponentData = {
            id: productId,
            name: product.name,
            price: product.price,
            image: product.image, // 다나와 이미지 URL 그대로 사용
            description: details.description.substring(0, 1000), // 설명 길이 제한
            specs: details.specs,
            url: product.url,
            category: category,
            createdAt: new Date()
          };
          
          // Firebase에 저장
          await saveComponent(componentData);
          
          // 상세 페이지 닫기
          await detailPage.close();
        } catch (error) {
          console.error(`제품 처리 중 오류 발생: ${product.name}`, error);
        }
        
        // 서버 부하 방지를 위한 지연
        await delay(CRAWL_CONFIG.DELAY_BETWEEN_PRODUCTS);
      }
      
      // 카테고리 페이지 닫기
      await page.close();
      
      console.log(`${category} 카테고리 크롤링 완료`);
      
      // 카테고리 간 지연
      await delay(CRAWL_CONFIG.DELAY_BETWEEN_CATEGORIES);
    }
  } catch (error) {
    console.error('크롤링 중 오류 발생:', error);
  } finally {
    await browser.close();
    console.log('크롤링 완료');
  }
}