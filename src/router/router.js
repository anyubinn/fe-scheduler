import { createRouter, createWebHistory } from "vue-router";
import Main from "../pages/schedule/Main.vue";
import AddSchedule from "@/pages/schedule/AddSchedule.vue";
import ScheduleDetail from "@/pages/schedule/ScheduleDetail.vue";
import KakaoTest from "@/pages/kakao/kakaoTest.vue";
import OauthRedirect from "@/pages/kakao/OauthRedirect.vue";
import Location from "@/pages/exchange/Location.vue";


const routes = [
    { path: "/", component: Main },
    { path: "/add-schedule", component: AddSchedule },
    { path: "/detail-schedule/:id", name: "ScheduleDetail", component: ScheduleDetail},
    { path : "/kakao", name: "KakaoTest", component: KakaoTest},
    { path : "/oauth2/redirect", name: "OauthRedirect", component: OauthRedirect },
    { path : "/location", name: "Location", component: Location},
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
