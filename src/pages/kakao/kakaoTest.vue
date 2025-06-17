<template>
  <div>
    <button @click="loginWithKakao">카카오 로그인</button>
  </div>
</template>

<script setup>
const REST_API_KEY = '73de350af1d87d13f6b9f10b6106fa83';
const REDIRECT_URI = 'http://localhost:8080/login/oauth2/code/kakao';

function loginWithKakao() {
  window.location.href = `http://localhost:8080/oauth2/authorization/kakao`;
}
</script>
: