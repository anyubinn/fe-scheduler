<template>
    <div>
      <h1>실시간 위치 및 아이템 지도</h1>
      <div id="map" style="width: 800px; height: 600px;"></div>
      <p>{{ status }}</p>
      <p v-if="userId">Current User ID for Subscription: {{ userId }}</p>
    </div>
  </template>
  
  <script>
  import SockJS from 'sockjs-client';
  import * as StompJs from '@stomp/stompjs';
  import axios from 'axios';
  
  export default {
    name: 'KakaoLocationMap',
    data() {
      return {
        map: null,
        stompClient: null,
        userMarkers: {},   // 사용자 마커 관리 객체
        userLocations: {},
        userItems: {},
        itemMarkers: {},   // 아이템 마커 관리 객체
        status: '사용자 정보 로딩 중...',
        subscription: null,
        locationInterval: null,
        userId: null,
      };
    },
    methods: {
      // 지도 초기화 (변경 없음)
      initMap() {
        if (!window.kakao || !window.kakao.maps) {
          this.status = '카카오맵 SDK 로드 실패';
          return false;
        }
        const container = document.getElementById('map');
        const options = {
          center: new window.kakao.maps.LatLng(37.512150, 127.071976),
          level: 2,
        };
        this.map = new window.kakao.maps.Map(container, options);
        this.status = '지도 초기화 완료.';
        return true;
      },
  
      // 사용자 정보 가져오기
      async fetchUserInfo() {
          this.status = '사용자 정보 확인 중...';
          const token = localStorage.getItem('jwt_token');
          if (!token) {
              this.status = '로그인이 필요합니다.';
              return false;
          }
          try {
            const response = await axios.get('/api/users/me', {
            headers: { Authorization: `Bearer ${token}` }
            });

            const userData = response.data.data;

            if (userData && userData.id) {
            this.userId = userData.id.toString();
            this.status = `사용자 ID ${this.userId} 확인. 지도/웹소켓 준비 중...`;
            return true;
            } else {
            this.status = 'API 응답에서 사용자 ID(providerId)를 찾을 수 없습니다.';
            return false;
            }
        } catch (error) {
            this.status = '사용자 정보 로드 실패. 다시 로그인해주세요.';
            if (error.response && [401, 403].includes(error.response.status)) {
            localStorage.removeItem('jwt_token');
            }
            return false;
        }
      },
  
      // 웹소켓 연결 및 구독 로직
      connectWebSocket() {
        if (!this.userId) {
          this.status = '사용자 ID가 없어 웹소켓 연결을 시작할 수 없습니다.';
          return;
        }
  
        const token = localStorage.getItem('jwt_token');
        // STOMP 연결 헤더에 JWT 토큰을 넣어야 인터셉터에서 인증 가능
        const connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  
        this.stompClient = new StompJs.Client({
          webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
          connectHeaders,
          debug: str => console.log('STOMP DEBUG:', str),
          reconnectDelay: 3000,
          
          onConnect: () => {
            this.status = `웹소켓 연결 성공! (User ID: ${this.userId})`;
  
            // 개인화된 토픽을 구독
            const userSpecificTopic = `/server/items/user/${this.userId}`;
            console.log(`구독 시작: ${userSpecificTopic}`);
  
            this.subscription = this.stompClient.subscribe(userSpecificTopic, (message) => {
              this.handleRealtimeMessage(JSON.parse(message.body));
            });
            
            // 연결 성공 후, 위치 전송 시작
            this.startSendingLocation();
          },
        });
        this.stompClient.activate();
      },
  
      // 수신된 메시지를 타입별로 처리하는 핸들러
      handleRealtimeMessage(message) {
        console.log('메시지 수신:', message);
        switch (message.type) {
          case 'ADD_ITEM':
            // 새 아이템 마커를 지도에 추가
            this.drawItemMarker(message.data);
            break;
          case 'REFRESH_ITEMS':
            // 내 위치가 바뀌었으니 주변 아이템 목록 전체를 새로고침
            this.fetchAndDrawItems();
            break;
          case 'USER_LOCATION_UPDATE':
            // 다른 사용자의 위치 마커를 업데이트
            this.updateUserMarker(message.data.userId.toString(), message.data.latitude, message.data.longitude);
            break;
          case 'REMOVE_ITEM':
            // 아이템 교환 완료 처리
            this.handleItemRemoval(message.data.userId.toString());
            break;
          default:
            console.warn('알 수 없는 메시지 타입:', message.type);
        }
      },
      
      // 주변 아이템 목록을 불러와 마커를 그리는 함수
      async fetchAndDrawItems() {
          const token = localStorage.getItem('jwt_token');
          if (!token) return;
  
          try {
            const response = await axios.get('/api/items', {
                  headers: { Authorization: `Bearer ${token}` }
              });
            const items = response.data.data.content;

            // 받아온 아이템 정보를 drawItemMarker를 통해 처리
            items.forEach(item => this.drawItemMarker(item));
            this.status = `${items.length}개의 주변 아이템을 로드했습니다.`;

        } catch (error) {
              console.error('주변 아이템 로드 실패:', error);
              this.status = '주변 아이템을 불러오는 데 실패했습니다.';
          }
      },
  
      // 마커 업데이트/생성 함수
      updateUserMarker(userId, latitude, longitude) {
        if (!this.map) return;
        const position = new window.kakao.maps.LatLng(latitude, longitude);
        const isMe = userId === this.userId;

        // userItems에서 해당 사용자의 아이템을 가져옴
        const item = this.userItems[userId];

        // 마커 이미지를 결정하는 로직
        let imageSrc = '';
        let imageSize;

        if (item) {
            imageSize = new window.kakao.maps.Size(35, 35);
            if (item.category === 'TICKET') {
                imageSrc = '/ticket.png';
            } else if (item.category === 'GOODS') {
                imageSrc = '/goods.avif';
            }
        } else {
            // 아이템이 없으면, '나'인지 '다른 사람'인지에 따라 기본 아이콘을 결정
            imageSrc = isMe ? 'http://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png' : 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png';
            imageSize = new window.kakao.maps.Size(isMe ? 24 : 19, isMe ? 35 : 30);
        }

        const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize);

        // 마커 생성 또는 업데이트 로직
        if (this.userMarkers[userId]) {
            // 마커가 이미 있으면 위치와 아이콘을 모두 업데이트
            const marker = this.userMarkers[userId];
            marker.setPosition(position);
            marker.setImage(markerImage);
        } else {
            // 마커가 없으면 새로 생성
            this.userMarkers[userId] = new window.kakao.maps.Marker({
                position,
                map: this.map,
                title: `User ${userId}`,
                image: markerImage
            });
        }

        // 내 위치면 지도를 중앙으로 이동
        if (isMe) {
            this.map.setCenter(position);
        }

        // userLocations는 항상 최신 위치로 업데이트
        this.userLocations[userId] = { latitude, longitude };
      },
      
      drawItemMarker(item) {
        const itemOwnerId = item.user.userId.toString();

        this.userItems[itemOwnerId] = item;

        const ownerLocation = this.userLocations[itemOwnerId];
        if (ownerLocation) {
          // 위치 정보가 있다면 updateUserMarker를 호출하여 마커를 다시 그리도록 요청
          this.updateUserMarker(itemOwnerId, ownerLocation.latitude, ownerLocation.longitude);
        }
      },

      handleItemRemoval(userId) {
        // userItems에서 해당 사용자의 아이템 정보 삭제
        if (this.userItems[userId]) {
          delete this.userItems[userId];
          console.log('아이템 제거: userId=${userId}');
        }

        // 해당 아이템 소유자의 최신 위치 정보가 있는지 확인
        const ownerLocation = this.userLocations[userId];
        if (ownerLocation) {
          // updateUserMarker를 호출하여 마커를 다시 그리도록 요청
          this.updateUserMarker(itemOwnerId, ownerLocation.latitude, ownerLocation.longitude);
          this.status = `사용자(ID: ${userId})의 아이템이 지도에서 업데이트되었습니다.`;
        }
      },
  
      // 위치 전송 시작/중지
      startSendingLocation() {
          const sendCurrentLocation = () => {
              navigator.geolocation.getCurrentPosition(
              (position) => {
                  const { latitude, longitude } = position.coords;
                  this.updateUserMarker(this.userId, latitude, longitude);
                  
                  if (this.stompClient && this.stompClient.connected) {
                      this.stompClient.publish({
                      destination: '/client/location.update',
                      body: JSON.stringify({ latitude, longitude }),
                      });
                  }
              },
              (error) => { this.status = `위치 가져오기 실패: ${error.message}`; },
              { enableHighAccuracy: true }
              );
          };
          
          sendCurrentLocation(); // 최초 1회 즉시 실행
          if (this.locationInterval) clearInterval(this.locationInterval);
          this.locationInterval = setInterval(sendCurrentLocation, 3000); // 3초 간격
      },
      
      stopSendingLocation() {
          if (this.locationInterval) {
              clearInterval(this.locationInterval);
              this.locationInterval = null;
          }
      },
  
      // 웹소켓 연결 해제
      disconnectWebSocket() {
          this.stopSendingLocation();

          if (this.stompClient && this.stompClient.connected) {
            console.log('웹소켓 연결을 해제합니다.');
            this.stompClient.deactivate();
            this.status = '웹소켓 연결이 해제되었습니다.';
          }
      },
    },
  
    async mounted() {
      // 사용자 정보 가져오기
      const userInfoLoaded = await this.fetchUserInfo();
      if (!userInfoLoaded) return;
      
      const initialize = async () => {
          // 지도 초기화
          if (this.initMap()) {
              // 초기 아이템 목록 로드
              await this.fetchAndDrawItems();
              // 웹소켓 연결
              this.connectWebSocket();
          }
      };
      
      // 카카오맵 SDK 로드
      if (window.kakao && window.kakao.maps) {
          window.kakao.maps.load(() => initialize());
      } else {
          const script = document.createElement('script');
          // 여기 secret-key에 kakao map key를 넣기
          script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey={secret-key}&autoload=false&libraries=services`;
          script.onload = () => window.kakao.maps.load(() => initialize());
          script.onerror = () => this.status = '카카오맵 SDK 스크립트 로드 실패';
          document.head.appendChild(script);
      }
    },
  
    beforeUnmount() {
      this.disconnectWebSocket();
    }
  };
  </script>
  
  <style scoped>
  #map {
    margin-top: 10px;
    border: 1px solid #ccc;
  }
  </style>