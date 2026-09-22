import type { PlaceRef } from "../types";
import type { LatLng } from "../lib/geo";

/**
 * Real restaurants and places to stay around the demo's default position,
 * copied from OpenStreetMap on 2026-09-22.
 *
 * Why a copy at all: the home map asks Overpass live, and Overpass is a public
 * service that rate-limits — it refused this very query twice while the
 * feature was being built. A map home that shows 餐廳 and 住宿 in rehearsal
 * and nothing in front of an audience is worse than one without the filter.
 * So when the live answer fails and the traveller is near the default spot,
 * this is used instead. Anywhere else, a failed request simply shows nothing.
 *
 * These are ordinary businesses that happen to be mapped. None of them is a
 * ResoMap partner, and the sheet that opens on each says so. Data ©
 * OpenStreetMap contributors, ODbL — the attribution is on the map itself.
 */
export const OSM_SNAPSHOT: { at: LatLng; fetched: string; food: PlaceRef[]; stay: PlaceRef[] } = {
  at: { lat: 24.9714202, lng: 121.5420377 },
  fetched: "2026-09-22",
  food: [
    { id: "osm:node/2621123969", name: "吉野家", lat: 24.971322, lng: 121.5421661, cat: "food", sub: "速食" },
    { id: "osm:node/3590042797", name: "老莊牛肉麵", lat: 24.9714246, lng: 121.5422469, cat: "food", sub: "餐廳" },
    { id: "osm:node/4235840183", name: "一條通", lat: 24.9711679, lng: 121.5419644, cat: "food", sub: "餐廳" },
    { id: "osm:node/4018219667", name: "三商巧福", lat: 24.9710896, lng: 121.5420517, cat: "food", sub: "餐廳" },
    { id: "osm:node/3590018294", name: "二空新村", lat: 24.9712892, lng: 121.5412902, cat: "food", sub: "餐廳" },
    { id: "osm:node/2090614029", name: "閾靈咖啡館", lat: 24.9721744, lng: 121.5420001, cat: "food", sub: "咖啡廳" },
    { id: "osm:node/3100254479", name: "周胖子餃子館", lat: 24.9711927, lng: 121.5429053, cat: "food", sub: "餐廳" },
    { id: "osm:node/2621124072", name: "響宴", lat: 24.9709452, lng: 121.5428225, cat: "food", sub: "餐廳" },
    { id: "osm:node/2713719853", name: "四海遊龍", lat: 24.9723902, lng: 121.5403088, cat: "food", sub: "餐廳" },
    { id: "osm:node/4235840187", name: "四海游龍", lat: 24.9724596, lng: 121.5401696, cat: "food", sub: "餐廳" },
    { id: "osm:node/1709446553", name: "肯德基", lat: 24.973314, lng: 121.5427192, cat: "food", sub: "速食" },
    { id: "osm:node/3840864391", name: "刷八方蒙古烤肉", lat: 24.9693027, lng: 121.5418181, cat: "food", sub: "餐廳" },
    { id: "osm:node/4443758491", name: "溢滿鮮台南虱目魚", lat: 24.9734738, lng: 121.5427159, cat: "food", sub: "餐廳" },
    { id: "osm:node/4443758492", name: "綠時代健康素食", lat: 24.9737471, lng: 121.5427418, cat: "food", sub: "餐廳" },
    { id: "osm:node/4033147901", name: "必勝客", lat: 24.969004, lng: 121.5417245, cat: "food", sub: "餐廳" },
    { id: "osm:node/3881721581", name: "碧蘿春", lat: 24.9738263, lng: 121.5431035, cat: "food", sub: "餐廳" },
    { id: "osm:node/1701856641", name: "麥當勞", lat: 24.9738053, lng: 121.5432008, cat: "food", sub: "速食" },
    { id: "osm:node/4443758495", name: "漢堡王", lat: 24.974005, lng: 121.5427437, cat: "food", sub: "速食" },
    { id: "osm:node/3423377293", name: "三媽臭臭鍋", lat: 24.973821, lng: 121.5434293, cat: "food", sub: "餐廳" },
    { id: "osm:node/3881721635", name: "陶板屋", lat: 24.9740226, lng: 121.5431672, cat: "food", sub: "餐廳" },
    { id: "osm:node/2713719852", name: "爭鮮迴轉壽司", lat: 24.9730758, lng: 121.5393606, cat: "food", sub: "餐廳" },
    { id: "osm:node/2690915292", name: "新店波特曼", lat: 24.974143, lng: 121.543389, cat: "food", sub: "速食" },
    { id: "osm:node/3881721636", name: "陶然日式小火鍋", lat: 24.9745162, lng: 121.5422018, cat: "food", sub: "餐廳" },
    { id: "osm:node/2209949976", name: "摩斯漢堡", lat: 24.9680196, lng: 121.5413548, cat: "food", sub: "速食" },
    { id: "osm:node/3929888360", name: "Mister Donut", lat: 24.9748378, lng: 121.5427468, cat: "food", sub: "速食" },
    { id: "osm:node/3695581479", name: "開喜海鮮餐廳", lat: 24.9678577, lng: 121.5418398, cat: "food", sub: "餐廳" },
    { id: "osm:node/3695581480", name: "麥香早餐", lat: 24.9678102, lng: 121.5419521, cat: "food", sub: "餐廳" },
    { id: "osm:node/3881721578", name: "楓林小館", lat: 24.9750637, lng: 121.5422104, cat: "food", sub: "餐廳" },
    { id: "osm:node/3695574953", name: "蓋鮮涮涮鍋", lat: 24.967727, lng: 121.5421265, cat: "food", sub: "餐廳" },
    { id: "osm:node/3840862940", name: "美美台式自助餐", lat: 24.9750617, lng: 121.5427533, cat: "food", sub: "餐廳" },
    { id: "osm:node/3826876371", name: "莊家班麻油雞", lat: 24.9750927, lng: 121.5427489, cat: "food", sub: "餐廳" },
    { id: "osm:node/2209949971", name: "星巴克", lat: 24.9677035, lng: 121.5412514, cat: "food", sub: "咖啡廳" },
    { id: "osm:node/3731163598", name: "七張素食自助餐", lat: 24.9753009, lng: 121.5427412, cat: "food", sub: "餐廳" },
    { id: "osm:node/3695574949", name: "LUNA", lat: 24.967464, lng: 121.5426415, cat: "food", sub: "咖啡廳" },
    { id: "osm:node/1224128124", name: "迷客夏", lat: 24.9746577, lng: 121.5446794, cat: "food", sub: "咖啡廳" },
    { id: "osm:node/4464380390", name: "八方雲集", lat: 24.975815, lng: 121.540691, cat: "food", sub: "速食" },
    { id: "osm:node/3881721637", name: "麵工坊義大利麵", lat: 24.9759093, lng: 121.5430699, cat: "food", sub: "餐廳" },
    { id: "osm:node/2712578775", name: "小樂精緻麵食館", lat: 24.9751309, lng: 121.5453053, cat: "food", sub: "餐廳" },
    { id: "osm:node/2355618185", name: "頂呱呱", lat: 24.9664463, lng: 121.5408316, cat: "food", sub: "速食" },
    { id: "osm:node/2355618189", name: "巴黎生活餐飲", lat: 24.9663705, lng: 121.5411918, cat: "food", sub: "餐廳" },
  ],
  stay: [
    { id: "osm:node/2590490940", name: "愛家旅館", lat: 24.9740891, lng: 121.54315, cat: "stay", sub: "飯店" },
    { id: "osm:node/3867437820", name: "黎明Hotel", lat: 24.9809385, lng: 121.5414507, cat: "stay", sub: "飯店" },
    { id: "osm:node/2250696319", name: "萬家旅社", lat: 24.9599773, lng: 121.5387663, cat: "stay", sub: "飯店" },
    { id: "osm:node/2931491188", name: "九閣商旅", lat: 24.9725907, lng: 121.5287493, cat: "stay", sub: "飯店" },
    { id: "osm:node/2250696136", name: "龍山旅社", lat: 24.9594424, lng: 121.538538, cat: "stay", sub: "飯店" },
    { id: "osm:node/3316912675", name: "景美大旅社", lat: 24.9901135, lng: 121.540796, cat: "stay", sub: "飯店" },
    { id: "osm:node/3316912674", name: "家賓大旅社", lat: 24.9917478, lng: 121.5410462, cat: "stay", sub: "飯店" },
    { id: "osm:node/2462876033", name: "瑪奇文旅", lat: 24.9925372, lng: 121.5419764, cat: "stay", sub: "飯店" },
    { id: "osm:node/2617041914", name: "欣園汽車旅館", lat: 24.9637755, lng: 121.5188533, cat: "stay", sub: "汽車旅館" },
  ],
};
