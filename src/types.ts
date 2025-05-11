// 컴포넌트 타입 정의
export type ComponentType = "Vga" | "Cpu" | "M.B" | "Memory" | "SSD" | "Case" | "Cooler" | "Power"

// 제품 목록 아이템 타입
export interface ProductListItem {
  name: string
  price: number
  image: string
  url: string
}

// 제품 상세 정보 타입
export interface ProductDetails {
  specs: string
  description: string
}

// 컴포넌트 데이터 타입
export interface ComponentData {
  id: string
  name: string
  price: number
  image: string
  description: string
  specs: string
  url: string
  category: ComponentType
  createdAt: Date
}