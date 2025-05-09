// src/types.ts
// 컴포넌트 타입 정의 (대문자로 시작하는 형태로 수정)
export type ComponentType = 'Vga' | 'Cpu' | 'M.B' | 'Memory' | 'SSD' | 'Case' | 'Cooler' | 'Power';

// 나머지 인터페이스는 그대로 유지
export interface ComponentData {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  specs: string;
  url: string;
  category: ComponentType;
  createdAt: Date;
}

export interface ProductListItem {
  name: string;
  price: number;
  image: string;
  url: string;
}

export interface ProductDetails {
  specs: string;
  description: string;
}