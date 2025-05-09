// src/firebase-utils.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { ComponentData } from './types';
import * as fs from 'fs';
import * as path from 'path';

let db: Firestore;

export function initFirebase() {
  try {
    // 서비스 계정 키 가져오기
    let serviceAccount;
    if (process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_PRIVATE_KEY);
    } else {
      const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
      if (fs.existsSync(keyPath)) {
        serviceAccount = require(keyPath);
      } else {
        throw new Error('Firebase 서비스 계정 키를 찾을 수 없습니다.');
      }
    }

    initializeApp({
      credential: cert(serviceAccount)
    });

    db = getFirestore();
    console.log('Firebase 초기화 완료');
    return true;
  } catch (error) {
    console.error('Firebase 초기화 실패:', error);
    return false;
  }
}

// 컴포넌트 저장 함수
export async function saveComponent(component: ComponentData): Promise<boolean> {
  try {
    // 'crawled_components' 컬렉션 아래에 각 카테고리별로 문서를 저장
    const collectionName = 'crawled_components';
    
    // 카테고리별 하위 컬렉션 사용
    const categoryRef = db.collection(collectionName).doc(component.category);
    const itemRef = categoryRef.collection('items').doc(component.id);
    
    // 카테고리 문서가 없으면 생성
    const categoryDoc = await categoryRef.get();
    if (!categoryDoc.exists) {
      await categoryRef.set({
        name: component.category,
        createdAt: new Date()
      });
    }
    
    // 기존 데이터가 있는지 확인
    const doc = await itemRef.get();
    
    if (doc.exists) {
      // 기존 데이터가 있으면 업데이트
      await itemRef.update({
        ...component,
        updatedAt: new Date()
      });
      console.log(`✅ ${component.name} 업데이트 완료`);
    } else {
      // 새 데이터 추가
      await itemRef.set({
        ...component,
        createdAt: new Date()
      });
      console.log(`✅ ${component.name} 저장 완료`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ ${component.name} 저장 실패:`, error);
    return false;
  }
}