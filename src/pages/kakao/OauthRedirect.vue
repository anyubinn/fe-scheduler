<template>
  <div>로그인 중입니다...</div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { onMounted } from 'vue'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  // URL 쿼리에서 token 꺼내기
  const token = route.query.token
  if (token) {
    // 토큰을 로컬스토리지 등에 저장
    localStorage.setItem('jwt_token', token)
    console.log('JWT 토큰 저장 완료:', token)

    // 로그인 성공 후 메인 페이지나 원하는 곳으로 리다이렉트
    router.push('/')
  } else {
    alert('토큰을 찾을 수 없습니다.')
    router.push('/login')
  }
})
</script>
