import * as admin from "firebase-admin"
import type { ComponentData } from "./types"

let firebaseInitialized = false

// Firebase 초기화 함수
export function initFirebase(): boolean {
  try {
    // 이미 초기화되었는지 확인
    if (firebaseInitialized) {
      return true
    }

    // 환경 변수에서 Firebase 설정 가져오기
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

    if (!projectId || !clientEmail || !privateKey) {
      console.error("Firebase 환경 변수가 설정되지 않았습니다.")
      return false
    }

    // Firebase Admin SDK 초기화
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })

    console.log("Firebase 초기화 성공")
    firebaseInitialized = true
    return true
  } catch (error) {
    console.error("Firebase 초기화 오류:", error)
    return false
  }
}

// 컴포넌트 데이터 저장 함수
export async function saveComponentData(data: ComponentData): Promise<void> {
  try {
    if (!firebaseInitialized) {
      console.error("Firebase가 초기화되지 않았습니다.")
      return
    }

    const db = admin.firestore()

    // 컴포넌트 타입별 컬렉션에 저장
    const componentRef = db.collection(`components/${data.category}/items`).doc()

    // Firestore에 저장할 데이터 준비 (Date 객체를 Timestamp로 변환)
    const firestoreData = {
      ...data,
      id: componentRef.id, // Firestore 문서 ID 사용
      createdAt: admin.firestore.Timestamp.fromDate(data.createdAt),
    }

    await componentRef.set(firestoreData)
    console.log(`컴포넌트 데이터 저장 완료: ${data.name} (${data.category})`)
  } catch (error) {
    console.error("컴포넌트 데이터 저장 오류:", error)
  }
}