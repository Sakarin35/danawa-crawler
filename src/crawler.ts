import { Builder, By, WebDriver, WebElement, until, Key } from "selenium-webdriver"
import chrome from "selenium-webdriver/chrome"
import fs from "fs"
import path from "path"
import { initFirebase, saveComponentData, clearFirebaseCollection } from "./firebase-utils"
import { CATEGORY_URLS, CRAWL_CONFIG } from "./config"
import type { ComponentType, ProductListItem, ProductDetails, ComponentData } from "./types"

// 현재 시간 기반 디버그 디렉토리 생성 (시간 형식: YYYY-MM-DD-HH:mm)
const TIMESTAMP = new Date().toISOString().replace(/:/g, '-').split('.')[0].replace('T', '-')
const DEBUG_DIR = path.join(__dirname, "../debug", TIMESTAMP)
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true })
}

// 카테고리별 제품 정보를 저장할 객체
const categoryProducts: Record<ComponentType, ComponentData[]> = {} as Record<ComponentType, ComponentData[]>

// 이미지 URL 크기 조정 함수
function adjustImageSize(imageUrl: string, size: number = 500): string {
  if (!imageUrl) return imageUrl
  
  try {
    // 다나와 이미지 URL 형식: https://img.danawa.com/prod_img/...?shrink=330:*&_v=...
    if (imageUrl.includes('danawa.com') && imageUrl.includes('shrink=')) {
      // 기존 shrink 파라미터를 새로운 크기로 교체
      return imageUrl.replace(/shrink=\d+:\*/, `shrink=${size}:*`)
    }
    
    // 다나와 이미지이지만 shrink 파라미터가 없는 경우
    if (imageUrl.includes('danawa.com')) {
      const separator = imageUrl.includes('?') ? '&' : '?'
      return `${imageUrl}${separator}shrink=${size}:*`
    }
    
    // 다나와가 아닌 다른 이미지 URL은 그대로 반환
    return imageUrl
  } catch (error) {
    console.error("이미지 URL 크기 조정 중 오류:", error)
    return imageUrl
  }
}

// 제품 정보를 카테고리별 배열에 추가하는 함수
function addProductToCategory(componentData: ComponentData): void {
  const category = componentData.category
  
  if (!categoryProducts[category]) {
    categoryProducts[category] = []
  }
  
  categoryProducts[category].push(componentData)
}

// 특정 카테고리의 제품 정보를 텍스트 파일로 저장하는 함수
function saveCategoryToFile(category: ComponentType): void {
  if (!categoryProducts[category] || categoryProducts[category].length === 0) {
    console.log(`${category} 카테고리에 저장할 제품이 없습니다.`)
    return
  }
  
  const filePath = path.join(DEBUG_DIR, `${category}.txt`)
  let fileContent = ""
  
  // 각 제품 정보를 텍스트로 변환
  categoryProducts[category].forEach((product, index) => {
    fileContent += `제품명: ${product.name}\n`
    fileContent += `가격: ${product.price.toLocaleString()}원\n`
    fileContent += `이미지 링크: ${product.image}\n`
    
    // 마지막 제품이 아니면 빈 줄 추가
    if (index < categoryProducts[category].length - 1) {
      fileContent += "\n"
    }
  })
  
  // 파일 저장
  fs.writeFileSync(filePath, fileContent, 'utf8')
  console.log(`${category} 카테고리 제품 ${categoryProducts[category].length}개 정보 저장 완료: ${filePath}`)
}

// 모든 제품 정보를 카테고리별 텍스트 파일로 저장하는 함수
function saveCategoryProductsToFile(): void {
  console.log("카테고리별 제품 정보를 텍스트 파일로 저장합니다...")
  
  for (const [category, products] of Object.entries(categoryProducts)) {
    if (products.length === 0) continue
    
    const filePath = path.join(DEBUG_DIR, `${category}.txt`)
    let fileContent = ""
    
    // 각 제품 정보를 텍스트로 변환
    products.forEach((product, index) => {
      fileContent += `제품명: ${product.name}\n`
      fileContent += `가격: ${product.price.toLocaleString()}원\n`
      fileContent += `이미지 링크: ${product.image}\n`
      
      // 마지막 제품이 아니면 빈 줄 추가
      if (index < products.length - 1) {
        fileContent += "\n"
      }
    })
    
    // 파일 저장
    fs.writeFileSync(filePath, fileContent, 'utf8')
    console.log(`${category} 카테고리 제품 ${products.length}개 정보 저장 완료: ${filePath}`)
  }
}

// HTML 저장 함수
async function saveHtml(driver: WebDriver, filePath: string): Promise<void> {
  try {
    const html = await driver.getPageSource()
    fs.writeFileSync(filePath, html)
    console.log(`HTML 저장: ${filePath}`)
  } catch (error) {
    console.error("HTML 저장 실패:", error)
  }
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

// 요소 대기 함수
async function waitForElement(driver: WebDriver, selector: string, timeout: number = 10000): Promise<WebElement | null> {
  try {
    return await driver.wait(until.elementLocated(By.css(selector)), timeout)
  } catch (error) {
    console.log(`요소를 찾을 수 없음: ${selector}`)
    return null
  }
}

// 요소 목록 대기 함수
async function waitForElements(driver: WebDriver, selector: string, timeout: number = 10000): Promise<WebElement[]> {
  try {
    await driver.wait(until.elementLocated(By.css(selector)), timeout)
    return await driver.findElements(By.css(selector))
  } catch (error) {
    console.log(`요소 목록을 찾을 수 없음: ${selector}`)
    return []
  }
}

// 요소로 스크롤 함수
async function scrollToElement(driver: WebDriver, element: WebElement): Promise<void> {
  try {
    await driver.executeScript("arguments[0].scrollIntoView({block: 'center', behavior: 'smooth'});", element)
    await driver.sleep(500) // 스크롤 후 잠시 대기
  } catch (error) {
    console.error("요소로 스크롤 실패:", error)
  }
}

// 다음 페이지로 이동 함수
async function moveToNextPage(driver: WebDriver, currentPage: number): Promise<boolean> {
  console.log(`다음 페이지(${currentPage + 1})로 이동 시도 중...`)
  
  // 방법 1: 직접 페이지 번호 버튼 클릭
  const pageNumberSelectors = [
    `a.num[data-page="${currentPage + 1}"]`,
    `a.num[href*="page=${currentPage + 1}"]`,
    `div.number_wrap a.num:nth-child(${currentPage + 1})`,
    `div.paging_wrap a.num:nth-child(${currentPage + 1})`,
    `a.num:contains("${currentPage + 1}")`,
    `a[data-page="${currentPage + 1}"]`
  ]
  
  for (const selector of pageNumberSelectors) {
    try {
      const pageButtons = await driver.findElements(By.css(selector))
      if (pageButtons.length > 0) {
        console.log(`페이지 번호 버튼 발견: ${selector}`)
        await scrollToElement(driver, pageButtons[0])
        await pageButtons[0].click()
        await driver.sleep(3000) // 페이지 로딩 대기
        return true
      }
    } catch (error) {
      console.log(`선택자 ${selector}로 페이지 버튼 클릭 실패`)
    }
  }
  
  // 방법 2: 다음 페이지 버튼 클릭
  const nextPageSelectors = [
    "a.num.now + a.num",
    "a.num.now + a.num_next",
    "a.num_next",
    "a.next",
    "a[class*='next']",
    "a[title='다음']",
    "a[title='다음 페이지']",
    "a.btn_next",
    "div.number_wrap a.num.now + a.num",
    "div.paging_wrap a.num.now + a.num"
  ]
  
  for (const selector of nextPageSelectors) {
    try {
      const nextButtons = await driver.findElements(By.css(selector))
      if (nextButtons.length > 0) {
        console.log(`다음 페이지 버튼 발견: ${selector}`)
        await scrollToElement(driver, nextButtons[0])
        await nextButtons[0].click()
        await driver.sleep(3000) // 페이지 로딩 대기
        return true
      }
    } catch (error) {
      console.log(`선택자 ${selector}로 다음 페이지 버튼 클릭 실패`)
    }
  }
  
  // 방법 3: JavaScript로 직접 클릭 시도
  try {
    const jsResult = await driver.executeScript<boolean>((nextPageNum: number) => {
      // 페이지 번호 버튼 찾기
      const pageButtons = document.querySelectorAll(`a.num[data-page="${nextPageNum}"], a[href*="page=${nextPageNum}"]`)
      if (pageButtons.length > 0) {
        try {
          (pageButtons[0] as HTMLElement).click()
          return true
        } catch (e) {
          console.error("JS 페이지 번호 클릭 실패")
        }
      }
      
      // 다음 페이지 버튼 찾기
      const nextSelectors = [
        "a.num.now + a.num",
        "a.num.now + a.num_next",
        "a.num_next",
        "a.next",
        "a[class*='next']",
        "a[title='다음']",
        "a.btn_next"
      ]
      
      for (const selector of nextSelectors) {
        const nextButtons = document.querySelectorAll(selector)
        if (nextButtons.length > 0) {
          try {
            (nextButtons[0] as HTMLElement).click()
            return true
          } catch (e) {
            console.error(`JS ${selector} 클릭 실패`)
          }
        }
      }
      
      return false
    }, currentPage + 1)
    
    if (jsResult) {
      console.log("JavaScript로 다음 페이지 이동 성공")
      await driver.sleep(3000) // 페이지 로딩 대기
      return true
    }
  } catch (error) {
    console.log("JavaScript로 다음 페이지 이동 실패")
  }
  
  // 방법 4: 페이지 소스에서 다음 페이지 링크 찾기
  try {
    const pageSource = await driver.getPageSource()
    const nextPageRegex = new RegExp(`[?&]page=${currentPage + 1}[&"]`, "i")
    if (nextPageRegex.test(pageSource)) {
      console.log("페이지 소스에서 다음 페이지 링크 발견")
      
      // URL 직접 조작
      const currentUrl = await driver.getCurrentUrl()
      const nextUrl = currentUrl.includes("page=") 
        ? currentUrl.replace(/page=\d+/, `page=${currentPage + 1}`)
        : currentUrl.includes("?") 
          ? `${currentUrl}&page=${currentPage + 1}`
          : `${currentUrl}?page=${currentPage + 1}`
      
      await driver.get(nextUrl)
      await driver.sleep(3000) // 페이지 로딩 대기
      return true
    }
  } catch (error) {
    console.log("페이지 소스에서 다음 페이지 링크 찾기 실패")
  }
  
  // 방법 5: 키보드 페이지 다운 후 다시 시도
  try {
    await driver.findElement(By.css("body")).sendKeys(Key.PAGE_DOWN)
    await driver.sleep(1000)
    
    // 페이지 다운 후 다시 다음 페이지 버튼 찾기
    for (const selector of nextPageSelectors) {
      const nextButtons = await driver.findElements(By.css(selector))
      if (nextButtons.length > 0) {
        console.log(`페이지 다운 후 다음 페이지 버튼 발견: ${selector}`)
        await scrollToElement(driver, nextButtons[0])
        await nextButtons[0].click()
        await driver.sleep(3000) // 페이지 로딩 대기
        return true
      }
    }
  } catch (error) {
    console.log("페이지 다운 후 다음 페이지 버튼 찾기 실패")
  }
  
  console.log("모든 다음 페이지 이동 방법 실패")
  return false
}

// 제품 목록 추출 함수
async function extractProducts(driver: WebDriver): Promise<ProductListItem[]> {
  console.log("제품 목록 추출 중...")
  
  // 다나와 제품 목록 선택자 (여러 가지 시도)
  const productSelectors = [
    "div.main_prodlist ul.product_list > li.prod_item",
    "div.main_prodlist div.product_list > div.prod_item",
    "table.product_list > tbody > tr:not(.prod_ad_item)",
    "div.product_list > div.prod_item",
    "div.main_prodlist ul.product_list li:not(.prod_ad_item)"
  ]
  
  let productElements: WebElement[] = []
  let usedSelector = ""
  
  // 여러 선택자 시도
  for (const selector of productSelectors) {
    console.log(`선택자 시도 중: ${selector}`)
    productElements = await waitForElements(driver, selector)
    if (productElements.length > 0) {
      usedSelector = selector
      console.log(`선택자 '${selector}'로 ${productElements.length}개 제품 요소 발견`)
      break
    }
  }
  
  // Selenium으로 제품 요소를 찾은 경우
  if (productElements.length > 0) {
    const products: ProductListItem[] = []
    
    for (const element of productElements) {
      try {
        // 제품명 (여러 선택자 시도)
        const nameSelectors = [
          ".prod_name a", 
          ".product_name a", 
          "a.prod_name", 
          "a.product_name",
          "p.prod_name > a",
          "div.prod_info > p > a"
        ]
        
        let name = ""
        let url = ""
        
        for (const selector of nameSelectors) {
          const nameElements = await element.findElements(By.css(selector))
          if (nameElements.length > 0) {
            name = await nameElements[0].getText()
            url = await nameElements[0].getAttribute("href")
            if (name && url) break
          }
        }
        
        // 가격 (여러 선택자 시도)
        const priceSelectors = [
          ".price_sect .price_sect_right .rank_one .num", 
          ".price_sect .price_num", 
          ".prod_pricelist .price_sect strong",
          ".prod_price .price_sect strong",
          "span.price_num",
          "div.prod_pricelist > ul > li > p.price_sect > a > strong"
        ]
        
        let price = 0
        
        for (const selector of priceSelectors) {
          const priceElements = await element.findElements(By.css(selector))
          if (priceElements.length > 0) {
            const priceText = await priceElements[0].getText()
            price = parseInt(priceText.replace(/[^\d]/g, ""), 10) || 0
            if (price > 0) break
          }
        }
        
        // 이미지 URL (여러 선택자 시도)
        const imageSelectors = [
          ".thumb_image img", 
          ".thumb_area img", 
          ".prod_thumb img",
          ".product_img img",
          "div.thumb_area > a > img"
        ]
        
        let image = ""
        
        for (const selector of imageSelectors) {
          const imageElements = await element.findElements(By.css(selector))
          if (imageElements.length > 0) {
            // 여러 속성 시도
            const srcAttrs = ["src", "data-original", "data-src"]
            for (const attr of srcAttrs) {
              const src = await imageElements[0].getAttribute(attr)
              if (src && src !== "") {
                image = adjustImageSize(src, 500) // 이미지 크기 500으로 조정
                break
              }
            }
            if (image !== "") break
          }
        }
        
        // 유효한 제품 정보만 추가
        if (name && url && price > 0) {
          products.push({ name, price, image, url })
          console.log(`제품 발견: ${name} (${price.toLocaleString()}원)`)
        }
      } catch (error) {
        console.error("제품 정보 추출 중 오류 발생:", error)
      }
    }
    
    return products
  }
  
  // Selenium으로 찾지 못한 경우 JavaScript로 시도
  console.log("셀레니움으로 제품을 찾지 못해 JavaScript로 시도합니다...")
  
  try {
    const extractedProducts = await driver.executeScript<ProductListItem[]>(() => {
      // JavaScript 내부에서 사용할 이미지 크기 조정 함수
      function adjustImageSizeJS(imageUrl: string, size: number = 500): string {
        if (!imageUrl) return imageUrl
        
        try {
          if (imageUrl.includes('danawa.com') && imageUrl.includes('shrink=')) {
            return imageUrl.replace(/shrink=\d+:\*/, `shrink=${size}:*`)
          }
          
          if (imageUrl.includes('danawa.com')) {
            const separator = imageUrl.includes('?') ? '&' : '?'
            return `${imageUrl}${separator}shrink=${size}:*`
          }
          
          return imageUrl
        } catch (error) {
          console.error("이미지 URL 크기 조정 중 오류:", error)
          return imageUrl
        }
      }
      
      const items: Array<{
        name: string
        price: number
        image: string
        url: string
      }> = []
      
      // 제품 요소 선택 (여러 선택자 시도)
      let productElements: Element[] = []
      const selectors = [
        "div.main_prodlist ul.product_list > li.prod_item",
        "div.main_prodlist div.product_list > div.prod_item",
        "table.product_list > tbody > tr:not(.prod_ad_item)",
        "div.product_list > div.prod_item",
        "div.main_prodlist ul.product_list li:not(.prod_ad_item)"
      ]
      
      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector))
        if (elements.length > 0) {
          console.log(`JS: 선택자 '${selector}'로 ${elements.length}개 제품 발견`)
          productElements = elements
          break
        }
      }
      
      productElements.forEach((element) => {
        try {
          // 제품명 (여러 선택자 시도)
          let name = ""
          let url = ""
          const nameSelectors = [
            ".prod_name a", 
            ".product_name a", 
            "a.prod_name", 
            "a.product_name",
            "p.prod_name > a",
            "div.prod_info > p > a"
          ]
          
          for (const selector of nameSelectors) {
            const nameElement = element.querySelector(selector)
            if (nameElement) {
              name = nameElement.textContent?.trim() || ""
              url = nameElement.getAttribute("href") || ""
              if (name && url) break
            }
          }
          
          // 가격 (여러 선택자 시도)
          let price = 0
          const priceSelectors = [
            ".price_sect .price_sect_right .rank_one .num", 
            ".price_sect .price_num", 
            ".prod_pricelist .price_sect strong",
            ".prod_price .price_sect strong",
            "span.price_num",
            "div.prod_pricelist > ul > li > p.price_sect > a > strong"
          ]
          
          for (const selector of priceSelectors) {
            const priceElement = element.querySelector(selector)
            if (priceElement) {
              const priceText = priceElement.textContent || ""
              price = parseInt(priceText.replace(/[^\d]/g, ""), 10) || 0
              if (price > 0) break
            }
          }
          
          // 이미지 URL (여러 선택자 시도)
          let image = ""
          const imageSelectors = [
            ".thumb_image img", 
            ".thumb_area img", 
            ".prod_thumb img",
            ".product_img img",
            "div.thumb_area > a > img"
          ]
          
          for (const selector of imageSelectors) {
            const imageElement = element.querySelector(selector)
            if (imageElement) {
              // 여러 속성 시도
              const srcAttrs = ["src", "data-original", "data-src"]
              for (const attr of srcAttrs) {
                const src = imageElement.getAttribute(attr)
                if (src && src !== "") {
                  image = adjustImageSizeJS(src, 500) // 이미지 크기 500으로 조정
                  break
                }
              }
              if (image !== "") break
            }
          }
          
          // 유효한 제품 정보만 추가
          if (name && url && price > 0) {
            items.push({ name, price, image, url })
          }
        } catch (error) {
          console.error("제품 정보 추출 중 오류 발생")
        }
      })
      
      return items
    })
    
    if (extractedProducts && extractedProducts.length > 0) {
      console.log(`JavaScript로 ${extractedProducts.length}개 제품 정보 추출 성공`)
      return extractedProducts
    }
  } catch (error) {
    console.error("JavaScript로 제품 추출 중 오류 발생:", error)
  }
  
  // 제품을 찾지 못한 경우
  console.log("제품을 찾지 못했습니다.")
  return []
}

// 제품 상세 정보 추출 함수
async function extractProductDetails(
  driver: WebDriver, 
  product: ProductListItem, 
  categoryDir: string, 
  index: number,
  category: ComponentType
): Promise<ComponentData | null> {
  console.log(`[${index + 1}] ${product.name} 상세 정보 추출 중...`)
  
  try {
    // 새 탭에서 상세 페이지 열기
    await driver.executeScript("window.open(arguments[0]);", product.url)
    
    // 새 탭으로 전환
    const tabs = await driver.getAllWindowHandles()
    await driver.switchTo().window(tabs[1])
    
    // 상세 페이지가 완전히 로드될 때까지 추가 대기
    await driver.sleep(3000)
    
    // 디버깅을 위한 스크린샷 저장
    await takeScreenshot(driver, path.join(categoryDir, `detail-${index}.png`))
    
    // HTML 저장 (디버깅용)
    await saveHtml(driver, path.join(categoryDir, `detail-${index}.html`))
    
    // 원본 이미지 URL 추출
    let imageUrl = product.image
    const imageSelectors = [
      ".detail_view .photo_w img", // 일반적인 상세 이미지
      ".thumb_area img", // 썸네일 영역 이미지
      ".detail_view img", // 상세 뷰 이미지
      ".product_img img", // 제품 이미지
      ".photo_w img", // 사진 영역 이미지
      '[class*="photo"] img', // photo 클래스를 포함하는 요소의 이미지
      '[class*="detail"] img', // detail 클래스를 포함하는 요소의 이미지
      '[class*="product"] img' // product 클래스를 포함하는 요소의 이미지
    ]
    
    for (const selector of imageSelectors) {
      const imageElements = await driver.findElements(By.css(selector))
      if (imageElements.length > 0) {
        const src = await imageElements[0].getAttribute("src")
        if (src && src !== "") {
          imageUrl = adjustImageSize(src, 500) // 이미지 크기 500으로 조정
          break
        }
        
        const dataSrc = await imageElements[0].getAttribute("data-src")
        if (dataSrc && dataSrc !== "") {
          imageUrl = adjustImageSize(dataSrc, 500) // 이미지 크기 500으로 조정
          break
        }
      }
    }
    
    // 제품 상세 정보 추출
    let specs = ""
    const specSelectors = [
      ".spec_list li", 
      ".prod_spec_set li", 
      ".prod_spec li",
      "table.spec_tbl tr",
      "div.prod_spec_set_wrap",
      "div.prod_spec_set_detail"
    ]
    
    for (const selector of specSelectors) {
      const specElements = await driver.findElements(By.css(selector))
      if (specElements.length > 0) {
        for (const element of specElements) {
          const text = await element.getText()
          if (text) specs += text + "\n"
        }
        break
      }
    }
    
    // JavaScript로 스펙 추출 시도 (더 많은 정보를 얻기 위해)
    if (!specs) {
      specs = await driver.executeScript<string>(() => {
        const specSelectors = [
          ".spec_list li", 
          ".prod_spec_set li", 
          ".prod_spec li",
          "table.spec_tbl tr",
          "div.prod_spec_set_wrap",
          "div.prod_spec_set_detail"
        ]
        
        let specsText = ""
        
        for (const selector of specSelectors) {
          const elements = document.querySelectorAll(selector)
          if (elements.length > 0) {
            elements.forEach(el => {
              specsText += el.textContent?.trim() + "\n"
            })
            break
          }
        }
        
        return specsText.trim()
      })
    }
    
    let description = ""
    const descSelectors = [
      ".detail_cont", 
      ".detail_view", 
      ".prod_detail_view", 
      ".detail_explain",
      "div.detail_cont_wrap",
      "div.detail_view_cont"
    ]
    
    for (const selector of descSelectors) {
      const descElements = await driver.findElements(By.css(selector))
      if (descElements.length > 0) {
        for (const element of descElements) {
          const text = await element.getText()
          if (text) description += text + "\n"
        }
        break
      }
    }
    
    // JavaScript로 설명 추출 시도
    if (!description) {
      description = await driver.executeScript<string>(() => {
        const descSelectors = [
          ".detail_cont", 
          ".detail_view", 
          ".prod_detail_view", 
          ".detail_explain",
          "div.detail_cont_wrap",
          "div.detail_view_cont"
        ]
        
        let descText = ""
        
        for (const selector of descSelectors) {
          const elements = document.querySelectorAll(selector)
          if (elements.length > 0) {
            elements.forEach(el => {
              descText += el.textContent?.trim() + "\n"
            })
            break
          }
        }
        
        return descText.trim()
      })
    }
    
    // 탭 닫기 및 원래 탭으로 돌아가기
    await driver.close()
    await driver.switchTo().window(tabs[0])
    
    // 컴포넌트 데이터 생성
    const componentData: ComponentData = {
      id: `${category}-${Date.now()}-${index}`,
      name: product.name,
      price: product.price,
      image: imageUrl,
      description: description.trim(),
      specs: specs.trim(),
      url: product.url,
      category: category,
      createdAt: new Date(),
    }
    
    return componentData
  } catch (error) {
    console.error(`${product.name} 상세 정보 추출 중 오류 발생:`, error)
    
    // 오류 발생 시 열린 탭 정리
    try {
      const tabs = await driver.getAllWindowHandles()
      if (tabs.length > 1) {
        await driver.switchTo().window(tabs[1])
        await driver.close()
        await driver.switchTo().window(tabs[0])
      }
    } catch (cleanupError) {
      console.error("탭 정리 중 오류 발생:", cleanupError)
    }
    
    return null
  }
}

// 메인 크롤링 함수
export async function crawlDanawa(): Promise<void> {
  console.log("다나와 크롤링 시작...")
  console.log(`크롤링 시간: ${TIMESTAMP}`)
  console.log(`디버그 디렉토리: ${DEBUG_DIR}`)

  // Firebase 초기화 확인
  if (!initFirebase()) {
    console.error("Firebase 초기화 실패. 크롤링을 중단합니다.")
    return
  }

  // Firebase 컬렉션 초기화 (기존 데이터 삭제)
  console.log("Firebase 'crawled_components' 컬렉션 초기화 중...")
  await clearFirebaseCollection("crawled_components")
  console.log("Firebase 컬렉션 초기화 완료")

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

      // 카테고리별 디버그 디렉토리 생성 (스크린샷과 HTML 저장용)
      const categoryDir = path.join(DEBUG_DIR, `${category}_debug`)
      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true })
      }

      // 모든 제품 목록 저장 배열
      const allProducts: ProductListItem[] = []

      // 페이지 번호
      let pageNum = 1
      let hasNextPage = true

      // 첫 페이지 로드
      await driver.get(baseUrl)
      console.log(`${baseUrl} 페이지 로드 중...`)
      await driver.sleep(5000) // 페이지 로딩 대기 시간

      // 페이지별로 크롤링
      while (hasNextPage && pageNum <= CRAWL_CONFIG.MAX_PAGES) {
        console.log(`${category} 카테고리 ${pageNum}페이지 크롤링 중...`)

        // 쿠키 동의 처리 (필요한 경우)
        try {
          const cookieButtons = await driver.findElements(By.css(".btn_close_cookie_confirm"))
          if (cookieButtons.length > 0) {
            await cookieButtons[0].click()
            await driver.sleep(1000)
          }
        } catch (error) {
          console.log("쿠키 동의 버튼이 없거나 처리 중 오류 발생")
        }

        // 디버깅을 위한 스크린샷 저장
        await takeScreenshot(driver, path.join(categoryDir, `page-${pageNum}.png`))
        
        // HTML 저장 (디버깅용)
        await saveHtml(driver, path.join(categoryDir, `page-${pageNum}.html`))

        // 제품 목록 추출
        const products = await extractProducts(driver)
        
        console.log(`${products.length}개의 제품 발견 (총 ${allProducts.length + products.length}개)`)
        allProducts.push(...products)
        
        // 제품을 찾지 못한 경우 디버깅 정보 출력
        if (products.length === 0 && pageNum === 1) {
          console.error("첫 페이지에서 제품을 찾지 못했습니다. HTML 구조를 확인하세요.")
          console.log("페이지 URL:", await driver.getCurrentUrl())
          
          // 페이지 소스 출력 (일부만)
          const pageSource = await driver.getPageSource()
          console.log("페이지 소스 일부:", pageSource.substring(0, 1000) + "...")
        }

        // 다음 페이지로 이동
        const nextPageSuccess = await moveToNextPage(driver, pageNum)
        if (nextPageSuccess) {
          pageNum++
        } else {
          console.log(`${category} 카테고리의 마지막 페이지에 도달했습니다.`)
          hasNextPage = false
        }
      }

      console.log(`${category} 카테고리에서 총 ${allProducts.length}개의 제품을 발견했습니다.`)

      // 각 제품의 상세 정보 크롤링
      for (let i = 0; i < allProducts.length; i++) {
        const product = allProducts[i]
        
        // 제품 상세 정보 추출
        const componentData = await extractProductDetails(driver, product, categoryDir, i, category)
        
        if (componentData) {
          // 카테고리별 배열에 제품 정보 추가
          addProductToCategory(componentData)
          
          // Firebase에 데이터 저장
          const saveResult = await saveComponentData(componentData)
          if (saveResult) {
            console.log(`${product.name} 정보 Firebase 저장 완료 (ID: ${componentData.id})`)
          } else {
            console.error(`${product.name} 정보 Firebase 저장 실패`)
          }
        }
        
        // 제품 간 딜레이
        await driver.sleep(1000)
      }
      
      // 카테고리 크롤링 완료 후 바로 텍스트 파일 저장
      saveCategoryToFile(category)
      console.log(`${category} 카테고리 크롤링 완료 및 텍스트 파일 저장 완료`)
    }
    
    // 모든 카테고리 크롤링 완료 후 카테고리별 텍스트 파일 저장
    saveCategoryProductsToFile()
    
    console.log("크롤링 완료!")
    console.log(`크롤링 결과는 ${DEBUG_DIR} 디렉토리에 저장되었습니다.`)
    console.log("Firebase 'crawled_components' 컬렉션에 데이터가 저장되었습니다.")
  } catch (error) {
    console.error("크롤링 중 오류 발생:", error)
    
    // 오류가 발생해도 수집된 데이터는 저장
    if (Object.keys(categoryProducts).length > 0) {
      saveCategoryProductsToFile()
      console.log("오류 발생 전까지 수집된 데이터를 저장했습니다.")
    }
  } finally {
    // 브라우저 닫기
    await driver.quit()
  }
}