import * as admin from "firebase-admin"
import { ComponentData } from "./types"
import * as fs from "fs"
import * as path from "path"

let firebaseInitialized = false

export function initFirebase(): boolean {
  try {
    if (firebaseInitialized) return true

    // Firebase 프로젝트 ID 확인
    const projectId = process.env.FIREBASE_PROJECT_ID
    if (!projectId) {
      console.error("FIREBASE_PROJECT_ID 환경 변수가 설정되지 않았습니다.")
      return false
    }

    // 서비스 계정 키 파일 확인
    const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json")
    if (fs.existsSync(serviceAccountPath)) {
      // serviceAccountKey.json 파일로 초기화
      const serviceAccount = require(serviceAccountPath)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      })
      
      console.log("Firebase serviceAccountKey.json으로 초기화 성공")
    } else {
      // 환경 변수로 초기화
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
      
      if (!clientEmail || !privateKey) {
        console.error("Firebase 인증 정보가 올바르게 설정되지 않았습니다.")
        return false
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
      })
      
      console.log("Firebase 환경 변수로 초기화 성공")
    }

    firebaseInitialized = true
    return true
  } catch (error) {
    console.error("Firebase 초기화 중 오류 발생:", error)
    return false
  }
}

// Firebase 컬렉션 초기화 (기존 데이터 삭제)
export async function clearFirebaseCollection(collectionName: string): Promise<boolean> {
  try {
    if (!firebaseInitialized) {
      console.error("Firebase가 초기화되지 않았습니다.")
      return false
    }

    const db = admin.firestore()
    const batch = db.batch()
    const snapshot = await db.collection(collectionName).get()
    
    if (snapshot.empty) {
      console.log(`컬렉션 '${collectionName}'이 비어있습니다.`)
      return true
    }
    
    // 최대 500개 문서까지 일괄 삭제 (Firestore 제한)
    let count = 0
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref)
      count++
      
      // 500개 단위로 커밋
      if (count >= 500) {
        await batch.commit()
        console.log(`${count}개 문서 삭제 완료`)
        count = 0
      }
    }
    
    // 남은 문서 삭제
    if (count > 0) {
      await batch.commit()
      console.log(`${count}개 문서 삭제 완료`)
    }
    
    console.log(`컬렉션 '${collectionName}' 초기화 완료`)
    return true
  } catch (error) {
    console.error(`컬렉션 '${collectionName}' 초기화 중 오류 발생:`, error)
    return false
  }
}

// 컴포넌트 데이터 저장 (문서명을 제품명으로 설정)
export async function saveComponentData(componentData: ComponentData): Promise<boolean> {
  try {
    if (!firebaseInitialized) {
      console.error("Firebase가 초기화되지 않았습니다.")
      return false
    }

    const db = admin.firestore()
    
    // 카테고리별 컬렉션 구조 생성
    const categoryRef = db.collection("crawled_components").doc(componentData.category)
    const itemsRef = categoryRef.collection("items")
    
    // 제품명에서 특수문자 제거하여 문서 ID로 사용
    // 파이어베이스 문서 ID에는 /, ., [, ], *, ` 문자를 사용할 수 없음
    const docId = componentData.name
      .replace(/[\/\.\[\]\*\`#]/g, '_') // 금지된 문자 제거
      .replace(/\s+/g, '_')            // 공백을 언더스코어로 변경
      .substring(0, 1500)              // 문서 ID 길이 제한 (Firestore 제한: 1500바이트)
    
    // 컴포넌트 정보 저장 (문서명을 제품명으로 설정)
    await itemsRef.doc(docId).set({
      ...componentData,
      id: docId // ID도 문서명과 동일하게 업데이트
    })
    
    console.log(`컴포넌트 저장 완료: ${docId}`)
    return true
  } catch (error) {
    console.error(`컴포넌트 저장 중 오류 발생: ${componentData.name}`, error)
    return false
  }
}