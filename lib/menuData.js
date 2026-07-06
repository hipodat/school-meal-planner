// 초등학교 급식 메뉴 데이터베이스 (자동 편성용)
// allergens: 식약처 19종 알레르기 번호. season: 'all' | 'summer' (여름철 우대)
// protein: 메인반찬의 단백질 계열 (요일별 균형 배분에 사용)
// n: 1인 1회 제공량 기준 영양가 [열량kcal, 단백질g, 칼슘mg, 철mg, 비타민A㎍RE, 비타민Cmg]
//    ※ 대략값(예시). 실제 운영 시 식품성분표 값으로 교체 권장.
// ing: 1인 소요 식재료 [ [재료명, ग(g)] , ... ] — 발주서·원가 산출에 사용.

export const NUTRIENT_KEYS = ["열량", "단백질", "칼슘", "철분", "비타민A", "비타민C"];
export const NUTRIENT_UNITS = ["kcal", "g", "mg", "mg", "㎍RE", "mg"];

export const RICE = [
  { name: "쌀밥", allergens: [], season: "all", n: [313, 5.6, 6, 0.8, 0, 0], ing: [["백미", 90]] },
  { name: "흑미밥", allergens: [], season: "all", n: [318, 6.0, 9, 1.2, 0, 0], ing: [["백미", 80], ["흑미", 10]] },
  { name: "잡곡밥", allergens: [], season: "all", n: [322, 6.4, 12, 1.4, 1, 0], ing: [["백미", 75], ["잡곡", 15]] },
  { name: "기장밥", allergens: [], season: "all", n: [320, 6.2, 8, 1.1, 0, 0], ing: [["백미", 80], ["기장", 10]] },
  { name: "완두콩밥", allergens: [5], season: "all", n: [330, 7.8, 18, 1.6, 5, 3], ing: [["백미", 80], ["완두콩", 15]] },
  { name: "옥수수밥", allergens: [], season: "summer", n: [326, 6.0, 7, 0.9, 6, 2], ing: [["백미", 80], ["옥수수", 20]] },
  { name: "수수밥", allergens: [], season: "all", n: [321, 6.3, 10, 1.3, 0, 0], ing: [["백미", 80], ["수수", 10]] },
];

export const SOUP = [
  { name: "된장찌개", allergens: [5, 6], season: "all", n: [95, 6.5, 55, 1.8, 25, 6], ing: [["된장", 15], ["두부", 40], ["애호박", 20], ["양파", 20]] },
  { name: "미역국", allergens: [5, 9], season: "all", n: [70, 4.8, 90, 2.6, 40, 3], ing: [["건미역", 5], ["소고기", 20], ["국간장", 5]] },
  { name: "콩나물국", allergens: [5], season: "all", n: [45, 3.2, 35, 1.2, 8, 8], ing: [["콩나물", 50], ["대파", 10]] },
  { name: "계란국", allergens: [1], season: "all", n: [75, 5.5, 40, 1.4, 60, 2], ing: [["계란", 30], ["대파", 10]] },
  { name: "어묵국", allergens: [5, 6, 9], season: "all", n: [90, 6.0, 45, 1.0, 5, 3], ing: [["어묵", 40], ["무", 30], ["대파", 10]] },
  { name: "순두부찌개", allergens: [5], season: "all", n: [100, 7.2, 65, 1.9, 30, 5], ing: [["순두부", 70], ["애호박", 20], ["양파", 15]] },
  { name: "오이냉국", allergens: [], season: "summer", n: [30, 1.0, 20, 0.5, 10, 6], ing: [["오이", 40], ["양파", 10]] },
  { name: "미역냉국", allergens: [5], season: "summer", n: [35, 1.8, 60, 1.8, 20, 4], ing: [["건미역", 4], ["오이", 20]] },
  { name: "열무김치냉국", allergens: [], season: "summer", n: [28, 1.2, 45, 1.0, 30, 8], ing: [["열무김치", 40]] },
  { name: "콩국수국물(콩국)", allergens: [5, 6], season: "summer", n: [180, 11.0, 80, 2.4, 3, 1], ing: [["대두", 40], ["소면", 60]] },
];

export const MAIN = [
  { name: "제육볶음", allergens: [10], season: "all", protein: "돼지고기", trending: false, n: [265, 17.0, 25, 1.6, 20, 12], ing: [["돼지고기", 70], ["양파", 30], ["대파", 15], ["고추장", 12]] },
  { name: "닭갈비", allergens: [15], season: "all", protein: "닭고기", trending: false, n: [255, 18.5, 30, 1.3, 40, 15], ing: [["닭고기", 70], ["양배추", 40], ["고구마", 25], ["고추장", 12]] },
  { name: "고등어구이", allergens: [7], season: "all", protein: "생선", trending: false, n: [240, 20.0, 20, 1.5, 30, 1], ing: [["고등어", 80], ["식용유", 5]] },
  { name: "돈까스", allergens: [10, 6, 1], season: "all", protein: "돼지고기", trending: false, n: [340, 16.0, 30, 1.4, 10, 3], ing: [["돼지등심", 70], ["빵가루", 20], ["계란", 15], ["식용유", 12]] },
  { name: "잡채", allergens: [5, 16], season: "all", protein: "소고기", trending: false, n: [230, 8.0, 30, 1.8, 60, 8], ing: [["당면", 40], ["소고기", 25], ["시금치", 20], ["당근", 15]] },
  { name: "오징어볶음", allergens: [17], season: "all", protein: "해산물", trending: false, n: [200, 15.0, 40, 1.2, 30, 14], ing: [["오징어", 70], ["양파", 30], ["양배추", 25], ["고추장", 10]] },
  { name: "갈비찜", allergens: [16, 5], season: "all", protein: "소고기", trending: false, n: [300, 19.0, 25, 2.4, 50, 6], ing: [["소갈비", 80], ["무", 30], ["당근", 20], ["간장", 10]] },
  { name: "불고기", allergens: [16, 5], season: "all", protein: "소고기", trending: false, n: [250, 17.5, 20, 2.2, 15, 5], ing: [["소고기", 70], ["양파", 30], ["당근", 15], ["간장", 10]] },
  { name: "치즈닭갈비", allergens: [15, 2], season: "all", protein: "닭고기", trending: true, n: [305, 20.0, 120, 1.4, 55, 13], ing: [["닭고기", 65], ["모짜렐라치즈", 25], ["양배추", 35], ["고추장", 12]] },
  { name: "로제떡볶이", allergens: [6, 2, 5], season: "all", protein: "채소", trending: true, n: [290, 7.0, 90, 1.2, 40, 8], ing: [["떡", 80], ["생크림", 20], ["어묵", 20], ["고추장", 10]] },
  { name: "마라두부볶음(순한맛)", allergens: [5], season: "all", protein: "채소", trending: true, n: [210, 11.0, 130, 2.0, 20, 10], ing: [["두부", 80], ["청경채", 30], ["양파", 20], ["마라소스", 10]] },
  { name: "크림새우파스타", allergens: [6, 2, 9], season: "all", protein: "해산물", trending: true, n: [330, 13.0, 110, 1.5, 45, 4], ing: [["스파게티면", 70], ["새우", 40], ["생크림", 30]] },
  { name: "치킨너겟", allergens: [15, 6, 1], season: "all", protein: "닭고기", trending: true, n: [300, 14.0, 25, 1.0, 8, 2], ing: [["닭고기", 60], ["빵가루", 20], ["식용유", 12]] },
  { name: "함박스테이크", allergens: [16, 10, 1], season: "all", protein: "소고기", trending: true, n: [320, 16.0, 30, 2.0, 20, 6], ing: [["소고기", 45], ["돼지고기", 25], ["양파", 25], ["빵가루", 15]] },
  { name: "새우까스", allergens: [9, 6, 1], season: "all", protein: "해산물", trending: true, n: [310, 13.0, 60, 1.2, 10, 2], ing: [["새우", 60], ["빵가루", 20], ["식용유", 12]] },
  { name: "탕수육", allergens: [10, 6, 1], season: "all", protein: "돼지고기", trending: true, n: [340, 14.0, 20, 1.3, 30, 10], ing: [["돼지고기", 65], ["전분", 20], ["당근", 15], ["식용유", 12]] },
  { name: "닭볶음탕", allergens: [15], season: "all", protein: "닭고기", trending: false, n: [270, 18.0, 30, 1.6, 60, 14], ing: [["닭고기", 75], ["감자", 40], ["당근", 20], ["고추장", 12]] },
  { name: "너비아니구이", allergens: [16, 5], season: "all", protein: "소고기", trending: false, n: [245, 17.0, 20, 2.1, 10, 3], ing: [["소고기", 70], ["양파", 15], ["간장", 8]] },
];

export const ONE_DISH = [
  { name: "나물비빔밥", allergens: [5], season: "all", protein: "채소", n: [480, 12.0, 90, 2.8, 120, 15], ing: [["백미", 90], ["시금치", 30], ["콩나물", 30], ["당근", 20], ["고추장", 15]] },
  { name: "카레라이스", allergens: [5, 6], season: "all", protein: "돼지고기", n: [540, 14.0, 45, 2.2, 80, 8], ing: [["백미", 90], ["돼지고기", 40], ["감자", 40], ["당근", 25], ["카레분", 15]] },
  { name: "짜장밥", allergens: [5, 6], season: "all", protein: "돼지고기", n: [560, 15.0, 40, 2.0, 20, 6], ing: [["백미", 90], ["돼지고기", 40], ["양파", 40], ["춘장", 20]] },
  { name: "오므라이스", allergens: [1, 5], season: "all", protein: "닭고기", n: [520, 16.0, 55, 1.8, 90, 8], ing: [["백미", 90], ["계란", 50], ["닭고기", 30], ["당근", 20]] },
  { name: "유부초밥", allergens: [5], season: "summer", protein: "채소", n: [470, 10.0, 60, 1.6, 5, 2], ing: [["백미", 90], ["유부", 30], ["단촛물", 10]] },
  { name: "치킨마요덮밥", allergens: [15, 1, 6], season: "all", protein: "닭고기", n: [590, 18.0, 40, 1.6, 30, 4], ing: [["백미", 90], ["닭고기", 60], ["계란", 30], ["마요네즈", 15]] },
  { name: "비빔국수", allergens: [6, 5], season: "summer", protein: "채소", n: [460, 10.0, 50, 2.2, 40, 12], ing: [["소면", 90], ["오이", 30], ["상추", 20], ["고추장", 15]] },
  { name: "콩국수", allergens: [5, 6], season: "summer", protein: "채소", n: [500, 18.0, 120, 3.0, 3, 1], ing: [["소면", 80], ["대두", 50], ["오이", 20]] },
];

export const SIDE = [
  { name: "콩나물무침", allergens: [5], season: "all", n: [35, 2.8, 35, 1.0, 6, 8], ing: [["콩나물", 50], ["참기름", 3]] },
  { name: "시금치나물", allergens: [5], season: "all", n: [40, 3.0, 60, 2.4, 180, 20], ing: [["시금치", 50], ["참기름", 3]] },
  { name: "어묵볶음", allergens: [6, 9], season: "all", n: [110, 6.0, 30, 0.8, 5, 4], ing: [["어묵", 50], ["양파", 20], ["간장", 6]] },
  { name: "감자조림", allergens: [], season: "all", n: [95, 2.0, 10, 0.6, 2, 20], ing: [["감자", 60], ["간장", 8]] },
  { name: "멸치볶음", allergens: [5], season: "all", n: [90, 8.0, 300, 3.0, 10, 1], ing: [["잔멸치", 20], ["견과류", 5], ["물엿", 8]] },
  { name: "계란말이", allergens: [1], season: "all", n: [120, 8.5, 45, 1.5, 90, 2], ing: [["계란", 55], ["당근", 10], ["대파", 8]] },
  { name: "오이무침", allergens: [], season: "summer", n: [25, 1.0, 20, 0.5, 12, 8], ing: [["오이", 50], ["고춧가루", 3]] },
  { name: "도토리묵무침", allergens: [5], season: "all", n: [60, 2.5, 25, 0.8, 20, 6], ing: [["도토리묵", 70], ["상추", 15], ["간장", 6]] },
  { name: "가지볶음", allergens: [5], season: "summer", n: [55, 1.8, 20, 0.6, 8, 5], ing: [["가지", 60], ["대파", 10], ["간장", 6]] },
  { name: "애호박볶음", allergens: [5], season: "summer", n: [50, 1.5, 25, 0.5, 15, 10], ing: [["애호박", 60], ["새우젓", 5]] },
];

export const KIMCHI = [
  { name: "배추김치", allergens: [9], season: "all", n: [18, 1.2, 40, 0.6, 30, 12], ing: [["배추김치", 40]] },
  { name: "깍두기", allergens: [9], season: "all", n: [20, 1.0, 35, 0.5, 10, 10], ing: [["깍두기", 40]] },
  { name: "열무김치", allergens: [], season: "summer", n: [16, 1.4, 50, 0.8, 40, 14], ing: [["열무김치", 40]] },
  { name: "오이소박이", allergens: [9], season: "summer", n: [18, 1.0, 30, 0.5, 20, 10], ing: [["오이소박이", 40]] },
];

export const DESSERT = [
  { name: "수박", allergens: [], season: "summer", n: [45, 0.8, 8, 0.3, 40, 10], ing: [["수박", 120]] },
  { name: "참외", allergens: [], season: "summer", n: [55, 1.0, 10, 0.4, 5, 22], ing: [["참외", 120]] },
  { name: "포도", allergens: [], season: "summer", n: [60, 0.6, 8, 0.4, 3, 4], ing: [["포도", 100]] },
  { name: "찐옥수수", allergens: [], season: "summer", n: [90, 3.0, 5, 0.6, 8, 6], ing: [["옥수수", 100]] },
  { name: "떠먹는요구르트", allergens: [2], season: "all", n: [85, 3.5, 120, 0.1, 30, 1], ing: [["요구르트", 85]] },
  { name: "아이스크림", allergens: [2], season: "summer", n: [130, 2.5, 90, 0.1, 50, 1], ing: [["아이스크림", 70]] },
  { name: "식혜", allergens: [], season: "all", n: [110, 1.0, 5, 0.2, 0, 0], ing: [["식혜", 150]] },
  { name: "두유", allergens: [5], season: "all", n: [100, 6.0, 180, 1.2, 0, 0], ing: [["두유", 190]] },
];

// 고정일 공휴일(양력). 학사일정 API가 없는 경우의 최소 제외용.
export const FIXED_HOLIDAYS = new Set([
  "01-01", "03-01", "05-05", "06-06", "08-15", "10-03", "10-09", "12-25",
]);
