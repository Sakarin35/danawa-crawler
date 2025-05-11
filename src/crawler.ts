import { Builder, By, type WebDriver } from "selenium-webdriver"
import chrome from "selenium-webdriver/chrome"
import fs from "fs"
import path from "path"
import { initFirebase, saveComponentData } from "./firebase-utils"
import { CATEGORY_URLS, CRAWL_CONFIG } from "./config"
import type { ComponentType, ProductListItem, ProductDetails, ComponentData } from "./types"

// 디버그 디렉토리 생성
const DEBUG_DIR = path.join(__dirname, "../debug")
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true })
}

// 스크린샷 저장 함수
async function takeScreenshot(driver: WebDriver, filePath: string): Promise<void> {
  try {
    const screenshot = await driver.takeScreenshot()
    fs.writeFileSync(filePath, screenshot, "base64")
    console.log(`스크린샷 저장: ${filePath}`)
  } catch (error) {
    console.error("스크린샷 저장 실패:", error)
  }
}

// 메인 크롤링 함수
export async function crawlDanawa(): Promise<void> {
  console.log("다나와 크롤링 시작...")

  // Firebase 초기화 확인
  if (!initFirebase()) {
    console.error("Firebase 초기화 실패. 크롤링을 중단합니다.")
    return
  }

  // Selenium 설정
  const options = new chrome.Options()
  if (CRAWL_CONFIG.HEADLESS) {
    options.addArguments("--headless=new")
  }

  options.addArguments("--window-size=1920,1080")
  options.addArguments("--no-sandbox")
  options.addArguments("--disable-dev-shm-usage")
  options.addArguments(`--user-agent=${CRAWL_CONFIG.USER_AGENT}`)

  const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build()

  try {
    // 각 컴포넌트 타입별로 크롤링
    for (const [category, baseUrl] of Object.entries(CATEGORY_URLS) as [ComponentType, string][]) {
      console.log(`${category} 카테고리 크롤링 시작...`)

      // 디버그 디렉토리 생성
      const categoryDebugDir = path.join(DEBUG_DIR, category)
      if (!fs.existsSync(categoryDebugDir)) {
        fs.mkdirSync(categoryDebugDir, { recursive: true })
      }

      // 모든 제품 목록 저장 배열
      const allProducts: ProductListItem[] = []

      // 페이지 번호
      let pageNum = 1
      let hasNextPage = true

      // 첫 페이지 로드
      await driver.get(baseUrl)
      await driver.sleep(3000) // 페이지 로딩 대기

      // 페이지별로 크롤링
      while (hasNextPage && pageNum <= CRAWL_CONFIG.MAX_PAGES) {
        console.log(`${category} 카테고리 ${pageNum}페이지 크롤링 중...`)

        // 쿠키 동의 처리 (필요한 경우)
        try {
          const cookieButton = await driver.findElements(By.css(".btn_close_cookie_confirm"))
          if (cookieButton.length > 0) {
            await cookieButton[0].click()
            await driver.sleep(1000)
          }
        } catch (error) {
          console.log("쿠키 동의 버튼이 없거나 처리 중 오류 발생")
        }

        // 디버깅을 위한 스크린샷 저장
        await takeScreenshot(driver, path.join(categoryDebugDir, `page-${pageNum}.png`))

        // 제품 목록 추출
        console.log("페이지 HTML 구조 분석 중...")
        const products = await driver.executeScript<ProductListItem[]>(() => {
          const items: Array<{
            name: string
            price: number
            image: string
            url: string
          }> = []

          // 제품 목록 요소 선택
          const productElements = document.querySelectorAll(".product_list > li.prod_item")

          productElements.forEach((element) => {
            try {
              // 제품명
              const nameElement = element.querySelector(".prod_name a")
              if (!nameElement) return

              const name = nameElement.textContent?.trim() || ""

              // 제품 URL
              const url = nameElement.getAttribute("href") || ""

              // 가격
              const priceElement = element.querySelector(".price_sect .price_sect_right .rank_one .num")
              const priceText = priceElement?.textContent?.replace(/[^\d]/g, "") || "0"
              const price = Number.parseInt(priceText, 10) || 0

              // 이미지 URL
              const imageElement = element.querySelector(".thumb_image img")
              const image =
                imageElement?.getAttribute("src") ||
                imageElement?.getAttribute("data-original") ||
                imageElement?.getAttribute("data-src") ||
                ""

              if (name && url && price > 0) {
                items.push({ name, price, image, url })
              }
            } catch (error) {
              console.error("제품 정보 추출 중 오류 발생")
            }
          })

          return items
        })

        console.log(`${products.length}개의 제품 발견 (총 ${allProducts.length + products.length}개)`)

        // 추출한 제품 목록 추가
        allProducts.push(...products)

        // 다음 페이지 확인 및 클릭
        try {
          // 다음 페이지 버튼 찾기
          const nextPageElements = await driver.findElements(By.css(".num.now + .num, .num.now + .num_next, .num_next"))

          if (nextPageElements.length > 0) {
            // 다음 페이지 버튼 클릭
            await nextPageElements[0].click()
            await driver.sleep(3000) // 페이지 로딩 대기
            pageNum++
          } else {
            console.log(`${category} 카테고리의 마지막 페이지에 도달했습니다.`)
            hasNextPage = false
          }
        } catch (error) {
          console.error("다음 페이지 이동 중 오류 발생:", error)
          hasNextPage = false
        }
      }

      console.log(`${category} 카테고리에서 총 ${allProducts.length}개의 제품을 발견했습니다.`)

      // 각 제품의 상세 정보 크롤링
      for (let i = 0; i < allProducts.length; i++) {
        const product = allProducts[i]
        console.log(`[${i + 1}/${allProducts.length}] ${product.name} 처리 중...`)

        try {
          // 새 탭에서 상세 페이지 열기
          await driver.executeScript("window.open(arguments[0]);", product.url)

          // 새 탭으로 전환
          const tabs = await driver.getAllWindowHandles()
          await driver.switchTo().window(tabs[1])

          // 상세 페이지가 완전히 로드될 때까지 추가 대기
          await driver.sleep(2000)

          // 디버깅을 위한 스크린샷 저장
          await takeScreenshot(driver, path.join(categoryDebugDir, `detail-${i}.png`))

          // 원본 이미지 URL 추출 - 스크롤 없이 현재 화면에서만 추출
          const originalImageUrl = await driver.executeScript<string | null>(() => {
            // 상세 페이지에서 원본 이미지 찾기
            const imageSelectors = [
              ".detail_view .photo_w img", // 일반적인 상세 이미지
              ".thumb_area img", // 썸네일 영역 이미지
              ".detail_view img", // 상세 뷰 이미지
              ".product_img img", // 제품 이미지
              ".photo_w img", // 사진 영역 이미지
              '[class*="photo"] img', // photo 클래스를 포함하는 요소의 이미지
              '[class*="detail"] img', // detail 클래스를 포함하는 요소의 이미지
              '[class*="product"] img', // product 클래스를 포함하는 요소의 이미지
            ]

            for (const selector of imageSelectors) {
              const imgElement = document.querySelector(selector)
              if (imgElement) {
                const src = imgElement.getAttribute("src")
                if (src) return src

                // data-src 속성 확인 (지연 로딩 이미지)
                const dataSrc = imgElement.getAttribute("data-src")
                if (dataSrc) return dataSrc
              }
            }

            // 원본 이미지를 찾을 수 없는 경우 null 반환
            return null
          })

          // 더 큰 이미지 URL이 있으면 사용
          const imageUrl = originalImageUrl || product.image

          // 제품 상세 정보 추출 - 스크롤 없이 현재 화면에서만 추출
          const details = await driver.executeScript<ProductDetails>(() => {
            // 스펙 정보 추출
            let specs = ""
            const specElements = document.querySelectorAll(".spec_list li")
            specElements.forEach((el) => {
              specs += el.textContent?.trim() + "\n"
            })

            // 설명 정보 추출 - 현재 화면에 보이는 부분만
            let description = ""
            const descElements = document.querySelectorAll(".detail_cont, .detail_view, .prod_detail_view")
            descElements.forEach((el) => {
              description += el.textContent?.trim() + "\n"
            })

            return {
              specs: specs.trim(),
              description: description.trim(),
            }
          })

          // 컴포넌트 데이터 생성
          const componentData: ComponentData = {
            id: `${category}-${Date.now()}-${i}`,
            name: product.name,
            price: product.price,
            image: imageUrl,
            description: details.description,
            specs: details.specs,
            url: product.url,
            category: category as ComponentType,
            createdAt: new Date(),
          }

          // Firebase에 데이터 저장
          await saveComponentData(componentData)

          // 탭 닫기 및 원래 탭으로 돌아가기
          await driver.close()
          await driver.switchTo().window(tabs[0])

          // 제품 간 딜레이 - 속도 향상을 위해 줄임
          await driver.sleep(500)
        } catch (error) {
          console.error(`${product.name} 상세 정보 크롤링 중 오류 발생:`, error)

          // 오류 발생 시 열린 탭 정리
          const tabs = await driver.getAllWindowHandles()
          if (tabs.length > 1) {
            await driver.switchTo().window(tabs[1])
            await driver.close()
            await driver.switchTo().window(tabs[0])
          }
        }
      }
    }
  } catch (error) {
    console.error("크롤링 중 오류 발생:", error)
  } finally {
    // 브라우저 닫기
    await driver.quit()
  }
}