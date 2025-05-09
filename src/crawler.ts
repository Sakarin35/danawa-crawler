// src/crawler.ts
import puppeteer from 'puppeteer';
import { ComponentData, ComponentType, ProductListItem, ProductDetails } from './types';
import { CRAWL_CONFIG, CATEGORY_URLS } from './config';
import { saveComponent } from './firebase-utils';
import * as fs from 'fs';
import * as path from 'path';


// 디버그 폴더 생성
const debugDir = path.join(__dirname, '../debug');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

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
    defaultViewport: { width: 1366, height: 768 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    // 각 컴포넌트 타입별로 크롤링
    for (const [category, url] of Object.entries(CATEGORY_URLS) as [ComponentType, string][]) {
      console.log(`${category} 카테고리 크롤링 시작...`);
      
      // 페이지 열기
      const page = await browser.newPage();
      
      // 사용자 에이전트 설정
      await page.setUserAgent(CRAWL_CONFIG.USER_AGENT);
      
      // 페이지 로드 타임아웃 증가
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // 페이지가 완전히 로드될 때까지 추가 대기
      console.log('페이지 로딩 대기 중...');
      await page.waitForTimeout(5000);
      
      // 스크롤을 내려서 더 많은 콘텐츠 로드
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(2000);
      
      // 다시 맨 위로 스크롤
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1000);
      
      // 디버깅을 위한 스크린샷 저장
      await page.screenshot({ path: path.join(debugDir, `${category}-page.png`), fullPage: true });
      
      // 쿠키 동의 처리 (필요한 경우)
      try {
        const cookieButton = await page.$('.btn_close_cookie');
        if (cookieButton) {
          console.log('쿠키 동의 버튼 클릭');
          await cookieButton.click();
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.log('쿠키 동의 버튼 없음');
      }
      
      // 페이지 HTML 구조 로깅
      console.log('페이지 HTML 구조 분석 중...');
      const pageContent = await page.content();
      fs.writeFileSync(path.join(debugDir, `${category}-html.txt`), pageContent.substring(0, 10000));
      console.log(`페이지 HTML 일부 저장됨: ${path.join(debugDir, `${category}-html.txt`)}`);
      
      // 제품 목록 추출
      const products = await page.evaluate(() => {
        console.log('페이지 평가 시작');
        
        // 다나와의 현재 제품 목록 구조에 맞는 선택자 사용
        // 여러 가능한 선택자를 시도
        const selectors = [
          '.product_list .prod_item',
          '.product_list > li',
          '.main_prodlist .product_item',
          '.main_prodlist > ul > li',
          '.product_item',
          '[class*="product_item"]',
          '[class*="prod_item"]',
          '.list_item',
          '.item'
        ];
        
        
        let items: Element[] = [];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`선택자 ${selector}에서 ${elements.length}개 항목 발견`);
            items = Array.from(elements);
            break;
          }
        }
        
        if (items.length === 0) {
          console.log('어떤 선택자로도 제품을 찾을 수 없습니다.');
          return [];
        }
        
        return items.map(item => {
          // 다양한 가능한 선택자 시도
          const nameElement = 
            item.querySelector('.prod_name a') || 
            item.querySelector('.product_name a') || 
            item.querySelector('[class*="name"] a') ||
            item.querySelector('a[title]');
          
          const priceElement = 
            item.querySelector('.price_sect .price_txt') || 
            item.querySelector('.prod_pricelist .price_sect') ||
            item.querySelector('[class*="price"]');
          
          const imageElement = 
            item.querySelector('.thumb_image img') || 
            item.querySelector('.thumb_Img img') ||
            item.querySelector('[class*="thumb"] img') ||
            item.querySelector('img');
          
          const linkElement = 
            item.querySelector('.prod_name a') || 
            item.querySelector('.product_name a') ||
            item.querySelector('[class*="name"] a') ||
            item.querySelector('a[href*="prod.danawa.com"]');
          
          const name = nameElement ? nameElement.textContent?.trim() : '';
          const priceText = priceElement ? priceElement.textContent?.trim() : '';
          const price = priceText ? parseInt(priceText.replace(/[^0-9]/g, '') || '0') : 0;
          const image = imageElement ? imageElement.getAttribute('src') || '' : '';
          const url = linkElement ? linkElement.getAttribute('href') || '' : '';
          
          console.log(`제품 발견: ${name}, 가격: ${price}, URL: ${url.substring(0, 30)}...`);
          
          return { name, price, image, url };
        }).filter(item => item.name && item.price > 0);
      }) as ProductListItem[];
      
      // 최대 제품 수 제한
      const limitedProducts = products.slice(0, CRAWL_CONFIG.MAX_PRODUCTS_PER_CATEGORY);
      
      console.log(`${limitedProducts.length}개의 제품 발견`);
      
      // 제품 목록 저장 (디버깅용)
      fs.writeFileSync(
        path.join(debugDir, `${category}-products.json`), 
        JSON.stringify(limitedProducts, null, 2)
      );
      
      // 각 제품의 상세 정보 크롤링
      for (let i = 0; i < limitedProducts.length; i++) {
        const product = limitedProducts[i];
        console.log(`[${i+1}/${limitedProducts.length}] ${product.name} 처리 중...`);
        
        try {
          // 상세 페이지 열기
          const detailPage = await browser.newPage();
          await detailPage.setUserAgent(CRAWL_CONFIG.USER_AGENT);
          await detailPage.goto(product.url, { waitUntil: 'networkidle2', timeout: 60000 });
          
          // 상세 페이지가 완전히 로드될 때까지 추가 대기
          await detailPage.waitForTimeout(3000);
          
          // 디버깅을 위한 스크린샷 저장
          await detailPage.screenshot({ 
            path: path.join(debugDir, `${category}-detail-${i}.png`), 
            fullPage: false 
          });
          
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