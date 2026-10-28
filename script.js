/* すまぽっけ V33.0 公開候補：相棒と生活支援機能を維持 */
/* すまぽっけ V18 - 生活機能仕上げ版 */
/* すまぽっけ V17 - 日次チェックロック + BGM選択 */
/* すまぽっけ V16 - 相棒の不要装飾削除版 */
/* すまぽっけ V15 - 日次選択排他 & ランク数字表示修正 */
/* すまぽっけ V14 - 成長・ウォーキング・ガチャ仕上げ */
/* すまぽっけ V13 - Lv4/Lv5見た目差別化・王冠位置修正版 */
/* すまぽっけ V12 - ガチャ演出強化版 */
/* すまぽっけ V11 - 機能・演出・デザイン仕上げ版 */
/* すまぽっけ V10 - 正式相棒デザイン統合版 */
/* すまぽっけ V9 - 天気なし / 相棒主役ホーム */
/* =============================================
   すまぽっけ V8 - 完成版ロジック
   localStorageのみで動く学校制作向けプロトタイプ
   ============================================= */
'use strict';

const APP_VERSION = '35.2';
const SCHEDULE_STORAGE_KEY='smapokke_weekly_schedule_v30';
const LIVE_STORAGE_KEY='sumapokke_v8_state';
const DEV_STORAGE_KEY='sumapokke_v27_dev_sandbox';
const DEV_SESSION_KEY='sumapokke_dev_session';
const DEV_OFFSET_KEY='sumapokke_dev_offset';
function devSessionGet(k){try{return sessionStorage.getItem(k)}catch{return null}}
const IS_DEV_MODE=false; // Release build always uses the real save, never a stale test session.
const STORAGE_KEY=IS_DEV_MODE?DEV_STORAGE_KEY:LIVE_STORAGE_KEY;
const RECOVERY_KEY=STORAGE_KEY+'_recovery';
let startupDataAlert='',saveFailure=false,externalDataChange=false,lastSavedRaw='';
function validBackupState(v){return !!(v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.userName==='string'&&Array.isArray(v.items)&&Array.isArray(v.tomorrowItems)&&['kun','chan'].includes(v.partner)&&Number.isFinite(Number(v.trust))&&Number.isFinite(Number(v.coins)))}
function validJSON(raw){const data=JSON.parse(raw);if(!validBackupState(data))throw Error('Invalid save data');return data}
function renderDataSafetyNotice(){
 const banner=document.getElementById('v32DataBanner'),text=document.getElementById('v32DataMessage');if(!banner||!text)return;
 const warning=saveFailure?'保存に失敗しています。今のうちにバックアップをダウンロードして、保存領域の設定を確認してください。':externalDataChange?'ほかのタブで保存内容が変更されました。意図せず上書きしないよう、こちらの保存を停止しました。最新データを読み込み直してください。':startupDataAlert;
 banner.hidden=!warning;text.textContent=warning;document.getElementById('v32ReloadBtn').hidden=saveFailure;
 const status=document.getElementById('v32SaveStatus');if(status)status.textContent=warning||'ブラウザ内に保存しています。定期的なバックアップをおすすめします。';
}

function testOffsetDays(){
  if(!IS_DEV_MODE)return 0;
  const value=Number(devSessionGet(DEV_OFFSET_KEY)||0);
  return Number.isInteger(value)?Math.min(365,Math.max(0,value)):0;
}
function gameNow(){
  const d=new Date();
  if(IS_DEV_MODE)d.setDate(d.getDate()+testOffsetDays());
  return d;
}
function localDateKey(date=new Date()){
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
const TODAY = () => localDateKey(gameNow());
const APP_CONFIG = { walkGoal:2000, walkMinMeters:100, walkMinSeconds:60, walkMaxSpeed:3.5, walkMaxAccuracy:45 };
const ECONOMY = {
  gachaSingle:100,gachaTen:800,
  loginBase:20,loginStep:2,loginCap:50,
  checkCoins:80,noOutingCoins:15,honestCoins:10,honestPenaltyRate:2.5,
  walkMilestones:Array.from({length:10},(_,i)=>({m:(i+1)*200,r:30}))
};
const RANKS = [
  {level:1,name:'空っぽポッケ',threshold:0,multiplier:1.0,message:'はじめての一歩！'},
  {level:2,name:'お守りポッケ',threshold:250,multiplier:1.2,message:'ポケットに「守」の刺しゅうがついたよ！'},
  {level:3,name:'幸運のポッケ',threshold:900,multiplier:1.5,message:'幸運のクローバーが周りを舞っているよ！'},
  {level:4,name:'黄金のポッケ',threshold:2400,multiplier:2.0,message:'キラキラの黄金ランク！'},
  {level:5,name:'四次元ポッケ',threshold:6000,multiplier:3.0,message:'宇宙みたいな特別ポッケ！'}
];
const PARTNERS = {
  kun:{name:'ぽけっとくん',panel:'#67b8ef',panel2:'#91d4ff',accent:'#4f9fda'},
  chan:{name:'ぽけっとちゃん',panel:'#f39fc1',panel2:'#ffc1d8',accent:'#dd78a1'}
};
const THEMES = {
  spring:{name:'春の部屋',bg:'linear-gradient(#9bdcff,#ffe5ed)',free:true},
  morning:{name:'朝焼けの部屋',bg:'linear-gradient(#ffd9a0,#fff0c9)',free:true},
  night:{name:'星空の部屋',bg:'linear-gradient(#453e79,#7b6897)',item:'nightBg'},
  mint:{name:'ミントの部屋',bg:'linear-gradient(#a9e6dd,#e4faef)',item:'mintBg'},
  sakura:{name:'満開さくらの部屋',bg:'linear-gradient(#ffc5dc,#fff0f4)',item:'sakuraBg'},
  sunset:{name:'夕焼けの部屋',bg:'linear-gradient(#ffab82,#7f75c6)',item:'sunsetBg'},
  aurora:{name:'オーロラの部屋',bg:'linear-gradient(#65d7dd,#7465c7,#f39bc9)',item:'auroraBg'},
  candy:{name:'キャンディのお部屋',bg:'linear-gradient(#f7afcb,#ffe8ac,#ffd5f2)',item:'candyBg'},
  sky:{name:'ふわふわ空の部屋',bg:'linear-gradient(#70c5f9,#dbf6ff,#fff6e6)',item:'skyBg'},
  constellation:{name:'星座のアトリエ',bg:'linear-gradient(#292e76,#6954a3,#a7a5dc)',item:'constellationBg'},
  galaxy:{name:'銀河の秘密基地',bg:'linear-gradient(#241951,#473d91,#a073b7)',item:'galaxyBg'},
  stargarden:{name:'星花の庭',bg:'linear-gradient(155deg,#9c8cff,#b8f5e0,#fff2c0)',item:'stargardenBg'},
  raindrop:{name:'雨音の窓辺',bg:'linear-gradient(155deg,#719cc7,#b9e5ef,#e9f4ff)',item:'raindropBg'},
  tea:{name:'午後のティールーム',bg:'linear-gradient(150deg,#f8ca9d,#fff0d5,#f6d5df)',item:'teaBg'},
  deepsea:{name:'深海のポケット',bg:'linear-gradient(165deg,#063e66,#126c98,#5de1df)',item:'deepseaBg'},
  moonlibrary:{name:'月明かりの図書室',bg:'linear-gradient(150deg,#241f53,#5d558d,#b9a9dc)',item:'moonlibraryBg'},
  jellysea:{name:'くらげの海',bg:'linear-gradient(145deg,#11245c,#716cd6,#89dfff)',item:'jellyseaBg'},
  meteor:{name:'流星の展望台',bg:'linear-gradient(165deg,#0e1435,#413a82,#f8a8a9)',item:'meteorBg'},
  rainbowforest:{name:'虹の秘密の森',bg:'linear-gradient(145deg,#24536a,#67c9bb,#f7db8f,#f4aecf)',item:'rainbowforestBg'}
};
const QUOTES = {
  kun:{1:['いっしょに確認してみよう！','今日もゆっくりで大丈夫！'],2:['お守りパワーで忘れ物ゼロ！','準備できたら出発しよう！'],3:['いいことありそうな予感！','ちゃんと続いててすごい！'],4:['今日もキラキラがんばろう！','黄金ポッケにまかせて！'],5:['どんな持ち物でも任せて！','ずっといっしょにがんばろう！']},
  chan:{1:['いっしょにチェックしよ〜！','今日もふんわりがんばろう！'],2:['お守りつけて準備ばっちり！','焦らずひとつずつね！'],3:['幸運のお花が咲きそう！','今日も続けられてえらい！'],4:['キラキラ準備で出発しよ！','黄金ポッケで応援するね！'],5:['四次元ポッケで安心だよ！','これからもずっと相棒だよ！']}
};
const DEFAULT_ITEMS = [
  {id:'phone',name:'スマホ',hint:'cell phone',checked:false,emoji:'📱'},
  {id:'wallet',name:'財布',hint:'wallet',checked:false,emoji:'👛'},
  {id:'bottle',name:'水筒',hint:'bottle',checked:false,emoji:'🧴'}
];
// V29: three editable starter presets. These are examples, not enforced daily plans.
const ITEM_SET_EXAMPLES=[
  {id:'set-school',name:'🏫 学校の日',items:[['スマホ','📱','cell phone'],['財布','👛',''],['家の鍵','🔑',''],['水筒','🧴','bottle'],['筆箱','✏️',''],['教科書','📚','book']]},
  {id:'set-holiday',name:'🌿 休日のおでかけ',items:[['スマホ','📱','cell phone'],['財布','👛',''],['家の鍵','🔑',''],['ハンカチ','🧻',''],['水筒','🧴','bottle']]},
  {id:'set-practice',name:'🛠️ 実習の日',items:[['スマホ','📱','cell phone'],['財布','👛',''],['家の鍵','🔑',''],['水筒','🧴','bottle'],['メモ帳','📓','book'],['筆記用具','✏️','']]}
].map(p=>({...p,items:p.items.map(([name,emoji,hint],i)=>({id:p.id+'-'+i,name,emoji,hint,checked:false}))}));
const SHOP_ITEMS = [
  // 確実に選んで買える、ショップだけの商品
  {id:'guard',source:'shop',type:'effect',name:'忘れ物ガード',emoji:'🛡️',price:250,desc:'次回のチェック報酬を+20pt',stack:true,shop:true},
  {id:'boost',source:'shop',type:'effect',name:'応援ブースター',emoji:'✨',price:400,desc:'次の獲得ポイントを1.5倍',stack:true,shop:true},
  {id:'flower',source:'shop',type:'accessory',name:'さくらのお花',emoji:'🌸',price:500,desc:'相棒の花飾り',shop:true},
  {id:'starPin',source:'shop',type:'accessory',name:'ほしのピン',emoji:'⭐',price:550,desc:'相棒の星飾り',shop:true},
  {id:'clover',source:'shop',type:'accessory',name:'幸運クローバー',emoji:'🍀',price:650,desc:'幸運のおしゃれ',shop:true},
  {id:'scarf',source:'shop',type:'accessory',name:'ふわふわマフラー',emoji:'🧣',price:900,desc:'ふかふかの首飾り',shop:true},
  {id:'sakuraBg',source:'shop',type:'background',name:'満開さくらの部屋',emoji:'🌸',price:600,desc:'春色の背景',shop:true,theme:'sakura'},
  {id:'mintBg',source:'shop',type:'background',name:'ミントの部屋',emoji:'🌿',price:700,desc:'さわやかな背景',shop:true,theme:'mint'},
  {id:'sunsetBg',source:'shop',type:'background',name:'夕焼けの部屋',emoji:'🌇',price:900,desc:'夕暮れの背景',shop:true,theme:'sunset'},
  {id:'nightBg',source:'shop',type:'background',name:'星空の部屋',emoji:'🌌',price:1200,desc:'夜空の背景',shop:true,theme:'night'},

  // ガチャでしか獲得できないコレクション（全てショップ購入不可）
  {id:'pocketBell',source:'gacha',type:'accessory',name:'ポッケベル',emoji:'🔔',desc:'おでかけのお守りベル',shop:false},
  {id:'ribbonTag',source:'gacha',type:'accessory',name:'ふんわりリボン',emoji:'🎀',desc:'ガチャ限定のリボン',shop:false},
  {id:'cloudClip',source:'gacha',type:'accessory',name:'くものヘアピン',emoji:'☁️',desc:'ふわふわ雲のアクセサリー',shop:false},
  {id:'bellFlower',source:'gacha',type:'accessory',name:'鈴蘭ブローチ',emoji:'🪻',desc:'小さなお花のブローチ',shop:false},
  {id:'blueMoonPin',source:'gacha',type:'accessory',name:'青い月のピン',emoji:'🌛',desc:'やさしく輝く月飾り',shop:false},
  {id:'candyBg',source:'gacha',type:'background',name:'キャンディのお部屋',emoji:'🍬',desc:'お菓子色のふしぎな部屋',shop:false,theme:'candy'},
  {id:'skyBg',source:'gacha',type:'background',name:'ふわふわ空の部屋',emoji:'🫧',desc:'雲に囲まれた青空のお部屋',shop:false,theme:'sky'},
  {id:'moonCharm',source:'gacha',type:'accessory',name:'お月さまチャーム',emoji:'🌙',desc:'SR・月のお守り',shop:false},
  {id:'crystalCharm',source:'gacha',type:'accessory',name:'クリスタルチャーム',emoji:'💎',desc:'SR・透き通る宝石',shop:false},
  {id:'floatingHeart',source:'gacha',type:'accessory',name:'恋するハート',emoji:'💗',desc:'SR・ふわりと浮かぶハート',shop:false},
  {id:'constellationBg',source:'gacha',type:'background',name:'星座のアトリエ',emoji:'🔭',desc:'SR・星座が輝くお部屋',shop:false,theme:'constellation'},
  {id:'rainbowBow',source:'gacha',type:'accessory',name:'七色のリボン',emoji:'🎗️',desc:'SR・虹色のおしゃれ',shop:false},
  {id:'auroraBg',source:'gacha',type:'background',name:'オーロラの部屋',emoji:'🌈',desc:'SSR・光のカーテンに包まれる部屋',shop:false,theme:'aurora'},
  {id:'galaxyBg',source:'gacha',type:'background',name:'銀河の秘密基地',emoji:'🪐',desc:'SSR・宇宙に浮かぶ特別な部屋',shop:false,theme:'galaxy'},

  // V28.7: 新しいガチャ限定の宝物18種類。ショップからは入手不可。
  {id:'starCandy',source:'gacha',type:'accessory',name:'星くずキャンディ',emoji:'🍬',desc:'ガチャ限定・小さな星型の飾り',shop:false},
  {id:'rainBoots',source:'gacha',type:'accessory',name:'あまつぶチャーム',emoji:'☂️',desc:'ガチャ限定・雨の日もごきげんのお守り',shop:false},
  {id:'berryPin',source:'gacha',type:'accessory',name:'ベリーピン',emoji:'🍓',desc:'ガチャ限定・甘い香りの小さなピン',shop:false},
  {id:'teaRibbon',source:'gacha',type:'accessory',name:'ティータイム飾り',emoji:'🫖',desc:'ガチャ限定・ほっと一息のアクセサリー',shop:false},
  {id:'stargardenBg',source:'gacha',type:'background',name:'星花の庭',emoji:'🌼',desc:'ガチャ限定・夜空の花が光る庭',shop:false,theme:'stargarden'},
  {id:'raindropBg',source:'gacha',type:'background',name:'雨音の窓辺',emoji:'🌧️',desc:'ガチャ限定・雨粒がきらめく静かな部屋',shop:false,theme:'raindrop'},
  {id:'teaBg',source:'gacha',type:'background',name:'午後のティールーム',emoji:'🍵',desc:'ガチャ限定・おやつの時間にぴったりのお部屋',shop:false,theme:'tea'},
  {id:'deepseaBg',source:'gacha',type:'background',name:'深海のポケット',emoji:'🐠',desc:'ガチャ限定・青い光の海底へおでかけ',shop:false,theme:'deepsea'},
  {id:'cometCharm',source:'gacha',type:'accessory',name:'彗星チャーム',emoji:'☄️',desc:'ガチャ限定・尾を引く流れ星のお守り',shop:false},
  {id:'musicCrown',source:'gacha',type:'accessory',name:'音符のティアラ',emoji:'🎼',desc:'ガチャ限定・リズムが聞こえそうな冠',shop:false},
  {id:'luminousFeather',source:'gacha',type:'accessory',name:'夜光の羽根',emoji:'🪶',desc:'ガチャ限定・月光で輝く羽根の飾り',shop:false},
  {id:'silverPocket',source:'gacha',type:'accessory',name:'銀のポケット鍵',emoji:'🗝️',desc:'ガチャ限定・見知らぬ扉へ続く鍵',shop:false},
  {id:'moonlibraryBg',source:'gacha',type:'background',name:'月明かりの図書室',emoji:'📚',desc:'ガチャ限定・星と物語が出会う部屋',shop:false,theme:'moonlibrary'},
  {id:'jellyseaBg',source:'gacha',type:'background',name:'くらげの海',emoji:'🪼',desc:'ガチャ限定・発光するクラゲが浮かぶ海',shop:false,theme:'jellysea'},
  {id:'celestialCrown',source:'gacha',type:'accessory',name:'星冠のきらめき',emoji:'👑',desc:'ガチャ限定・虹の光をまとう特別な冠',shop:false},
  {id:'prismWings',source:'gacha',type:'accessory',name:'プリズムの翼',emoji:'🦋',desc:'ガチャ限定・光の粒でできた不思議な翼',shop:false},
  {id:'meteorBg',source:'gacha',type:'background',name:'流星の展望台',emoji:'🌠',desc:'ガチャ限定・星が降りそそぐ夜の展望台',shop:false,theme:'meteor'},
  {id:'rainbowforestBg',source:'gacha',type:'background',name:'虹の秘密の森',emoji:'🦄',desc:'ガチャ限定・虹色に包まれた幻想の森',shop:false,theme:'rainbowforest'},

  // かぶりメダルとの交換でのみ手に入るアイテム
  {id:'rainbowCharm',source:'medal',type:'accessory',name:'虹色ポッケチャーム',emoji:'🌈',desc:'メダル交換だけの特別な飾り',shop:false,exchangePrice:250}
];
// 排出重み合計1000: R80% / SR17% / SSR3%。10連・天井の保証は従来通り。
const GACHA_POOL = [
  {id:'pocketBell',rarity:'R',weight:125},
  {id:'ribbonTag',rarity:'R',weight:85},
  {id:'cloudClip',rarity:'R',weight:75},
  {id:'bellFlower',rarity:'R',weight:65},
  {id:'blueMoonPin',rarity:'R',weight:55},
  {id:'candyBg',rarity:'R',weight:50},
  {id:'skyBg',rarity:'R',weight:45},
  {id:'starCandy',rarity:'R',weight:45},
  {id:'rainBoots',rarity:'R',weight:45},
  {id:'berryPin',rarity:'R',weight:40},
  {id:'teaRibbon',rarity:'R',weight:40},
  {id:'stargardenBg',rarity:'R',weight:35},
  {id:'raindropBg',rarity:'R',weight:35},
  {id:'teaBg',rarity:'R',weight:30},
  {id:'deepseaBg',rarity:'R',weight:30},
  {id:'moonCharm',rarity:'SR',weight:24},
  {id:'crystalCharm',rarity:'SR',weight:22},
  {id:'floatingHeart',rarity:'SR',weight:20},
  {id:'constellationBg',rarity:'SR',weight:19},
  {id:'rainbowBow',rarity:'SR',weight:17},
  {id:'cometCharm',rarity:'SR',weight:16},
  {id:'musicCrown',rarity:'SR',weight:14},
  {id:'luminousFeather',rarity:'SR',weight:12},
  {id:'silverPocket',rarity:'SR',weight:10},
  {id:'moonlibraryBg',rarity:'SR',weight:9},
  {id:'jellyseaBg',rarity:'SR',weight:7},
  {id:'auroraBg',rarity:'SSR',weight:8},
  {id:'galaxyBg',rarity:'SSR',weight:7},
  {id:'celestialCrown',rarity:'SSR',weight:5},
  {id:'prismWings',rarity:'SSR',weight:4},
  {id:'meteorBg',rarity:'SSR',weight:3},
  {id:'rainbowforestBg',rarity:'SSR',weight:3},
];
function defaultState(){return{
  version:APP_VERSION,userName:'',partner:'kun',trust:0,coins:800,rank:1,items:deepClone(DEFAULT_ITEMS),tomorrowItems:deepClone(DEFAULT_ITEMS),itemSets:deepClone(ITEM_SET_EXAMPLES),activeSetToday:'',activeSetTomorrow:'',essentialNames:[],aiQuality:'balanced',weatherAssist:{enabled:true,autoRain:true,autoHeat:false,autoCold:false,place:null,cache:null,suppressed:{}},
  inventory:{flower:false,starPin:false,clover:false,scarf:false,pocketBell:false,moonCharm:false,rainbowCharm:false,sakuraBg:false,mintBg:false,sunsetBg:false,nightBg:false,auroraBg:false,ribbonTag:false,cloudClip:false,bellFlower:false,blueMoonPin:false,candyBg:false,skyBg:false,crystalCharm:false,floatingHeart:false,constellationBg:false,rainbowBow:false,galaxyBg:false,starCandy:false,rainBoots:false,berryPin:false,teaRibbon:false,stargardenBg:false,raindropBg:false,teaBg:false,deepseaBg:false,cometCharm:false,musicCrown:false,luminousFeather:false,silverPocket:false,moonlibraryBg:false,jellyseaBg:false,celestialCrown:false,prismWings:false,meteorBg:false,rainbowforestBg:false,guard:0,boost:0},equippedAccessory:null,theme:'spring',sound:true,bgmEnabled:true,bgmTrack:'pocketpop',bgmVolume:0.24,bgmWelcomeVersion:2,
  nightBonus:false,nightBonusDate:'',itemsDate:TODAY(),lastPreparedAppliedDate:'',lastActionDate:'',lastActionType:'',lastLoginDate:'',
  walkMeters:0,totalWalkMeters:0,walkDate:TODAY(),claimedWalkMissions:[],checkCompletions:0,honestCount:0,lastHonestDate:'',honestCycleCount:0,honestLastPlus:0,
  streak:0,lastCheckDate:'',loginStreak:0,gachaPity:0,gachaHistory:[],gachaSessions:[],gachaSpeed:1,pocketMedals:0,altActionDate:'',altActionType:'',walkRewardedStages:[],walkRewardSchema:2,walkBonusPointsToday:0,walkCoinRewardSchema:3,walkAutoEnabled:false,walkLocationChoice:'unset',
  history:{},forgetEvents:[],missionClaims:{daily:{},weekly:{}},
  reminders:{morningEnabled:false,morningTime:'07:30',nightEnabled:false,nightTime:'21:00',browserEnabled:false,lastMorningDate:'',lastNightDate:''},
  lastVisitDate:'',partnerDays:0,partnerTalks:0,lastBackupAt:'',reducedMotion:false,powerSaving:false,mascotMotionMode:'on',fontStep:1,highContrast:false,preferUncheckedFirst:false,
  achievements:[],totalCoinsEarned:0,notified:false,tutorialDone:false
}};
let state = loadState();
let currentScreen='home';
let previousScreen='home';
let startPosition=null;
let walkSession=null;
let webcamStream=null;
let cocoModel=null;
let aiLoading=null;

function deepClone(v){return JSON.parse(JSON.stringify(v))}
function safeItemList(raw,fallback){
  if(!Array.isArray(raw))return deepClone(fallback);
  const valid=raw.slice(0,50).filter(x=>x&&typeof x==='object').map((x,i)=>({
    id:String(x.id||`item-${i}`).slice(0,80),
    name:String(x.name||'持ち物').trim().slice(0,35)||'持ち物',
    hint:String(x.hint||'').slice(0,70),
    checked:!!x.checked,
    emoji:String(x.emoji||'🎒').slice(0,8)
  }));
  return valid.length?valid:deepClone(fallback);
}
function sanitizeItemSets(raw){
  // Preserve existing saves and backups; never trust imported HTML/data as markup.
  if(!Array.isArray(raw))return deepClone(ITEM_SET_EXAMPLES);
  const used=new Set();
  return raw.slice(0,15).filter(p=>p&&typeof p==='object'&&Array.isArray(p.items)).map((p,i)=>{
    let id=String(p.id||'set-'+i).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,65)||'set-'+i;
    if(used.has(id))id='set-'+i+'-'+String(used.size);used.add(id);
    return {id,name:String(p.name||'持ち物セット').trim().slice(0,26)||'持ち物セット',items:safeItemList(p.items,DEFAULT_ITEMS)};
  });
}
function safeNumber(v,max=1e9){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(0,n)):0}

// Data imported from another device must never be able to corrupt the UI.
function sanitizeReminders(raw,defaults){
  const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const validTime=value=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  return {
    morningEnabled:source.morningEnabled===true,
    morningTime:validTime(source.morningTime)?source.morningTime:defaults.morningTime,
    nightEnabled:source.nightEnabled===true,
    nightTime:validTime(source.nightTime)?source.nightTime:defaults.nightTime,
    browserEnabled:source.browserEnabled===true,
    lastMorningDate:/^\d{4}-\d{2}-\d{2}$/.test(source.lastMorningDate||'')?source.lastMorningDate:'',
    lastNightDate:/^\d{4}-\d{2}-\d{2}$/.test(source.lastNightDate||'')?source.lastNightDate:''
  };
}
function sanitizeHistory(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
  const result={};
  const keys=Object.keys(raw).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-400);
  for(const key of keys){
    const r=raw[key];if(!r||typeof r!=='object'||Array.isArray(r))continue;
    result[key]={action:['check','honest','no-outing',''].includes(r.action)?r.action:'',
      walkMeters:safeNumber(r.walkMeters,1e8),trustEarned:safeNumber(r.trustEarned,1e8),
      coinsEarned:safeNumber(r.coinsEarned,1e8),coinsSpent:safeNumber(r.coinsSpent,1e8),
      tomorrowPrepared:r.tomorrowPrepared===true,gachaPulls:safeNumber(r.gachaPulls,1e6),login:r.login===true,
      trustLost:safeNumber(r.trustLost,1e8),honestOutcome:['plus','minus'].includes(r.honestOutcome)?r.honestOutcome:'',
      honestDelta:Number.isFinite(Number(r.honestDelta))?Math.max(-1e8,Math.min(1e8,Number(r.honestDelta))):0};
  }
  return result;
}
function sanitizeMissionClaims(raw){
  const safeScope=scope=>{
    if(!scope||typeof scope!=='object'||Array.isArray(scope))return {};
    const result={};
    for(const date of Object.keys(scope).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-90)){
      result[date]=Array.isArray(scope[date])?scope[date].slice(0,50).filter(x=>typeof x==='string'||typeof x==='number').map(String):[];
    }
    return result;
  };
  return {daily:safeScope(raw?.daily),weekly:safeScope(raw?.weekly)};
}

function sanitizeState(source={}){
  const base=defaultState();
  const src=source&&typeof source==='object'?source:{};
  const clean={
    ...base,...src,version:APP_VERSION,
    inventory:{...base.inventory,...(src.inventory&&typeof src.inventory==='object'?src.inventory:{})},
    reminders:sanitizeReminders(src.reminders,base.reminders),
    missionClaims:sanitizeMissionClaims(src.missionClaims),
    history:sanitizeHistory(src.history),
    items:safeItemList(src.items,DEFAULT_ITEMS),
    tomorrowItems:safeItemList(src.tomorrowItems,DEFAULT_ITEMS),
    itemSets:sanitizeItemSets(src.itemSets),
    weatherAssist:sanitizeWeatherAssist(src.weatherAssist),
    essentialNames:Array.isArray(src.essentialNames)?[...new Set(src.essentialNames.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,35)).filter(Boolean))].slice(0,25):[]
  };
  delete clean.voiceEnabled;delete clean.voiceVolume;
  clean.userName=typeof clean.userName==='string'?clean.userName.trim().slice(0,20):'';
  clean.partner=['kun','chan'].includes(clean.partner)?clean.partner:'kun';
  clean.theme=THEMES[clean.theme]?clean.theme:'spring';
  // Existing saves had BGM turned off by default, so introduce the new theme once.
  // Keep a deliberately selected alternate track/volume and any later OFF choice.
  if(!src.bgmWelcomeVersion){
    const customTrack=src.bgmTrack && src.bgmTrack!=='spring';
    const customVolume=Number.isFinite(Number(src.bgmVolume)) && Math.abs(Number(src.bgmVolume)-.26)>.001;
    if(!customTrack&&!customVolume){
      clean.bgmTrack='pocketpop';
      clean.bgmEnabled=true;
      clean.bgmVolume=.24;
    }
    clean.bgmWelcomeVersion=2;
  }
  clean.bgmTrack=['pocketpop','spring','cozy','quest','night','sparkle'].includes(clean.bgmTrack)?clean.bgmTrack:'pocketpop';
  for(const k of ['trust','coins','rank','walkMeters','totalWalkMeters','checkCompletions','honestCount','honestCycleCount','honestLastPlus','streak','loginStreak','gachaPity','pocketMedals','partnerDays','partnerTalks']){
    clean[k]=safeNumber(clean[k]);
  }
  clean.honestCycleCount=Math.floor(clean.honestCycleCount);
  clean.honestLastPlus=Math.floor(clean.honestLastPlus);
  clean.coins=Math.floor(clean.coins);
  clean.rank=Math.max(1,Math.min(5,Math.floor(clean.rank||1)));
  clean.bgmVolume=Math.max(0,Math.min(.7,(Number.isFinite(Number(clean.bgmVolume))?Number(clean.bgmVolume):.26)));
  clean.sound=clean.sound!==false;
  clean.bgmEnabled=!!clean.bgmEnabled;
  clean.reducedMotion=!!clean.reducedMotion;
  clean.powerSaving=!!clean.powerSaving;
  clean.mascotMotionMode=src.mascotMotionMode==='off'?'off':'on'; // V33.3: legacy 'auto' becomes ON; explicit OFF remains OFF.
  clean.fontStep=Number.isFinite(Number(clean.fontStep))?Math.max(0,Math.min(4,Math.round(Number(clean.fontStep)))):1;
  clean.highContrast=!!clean.highContrast;
  clean.tutorialDone=Object.prototype.hasOwnProperty.call(src,'tutorialDone')?!!src.tutorialDone:!!src.userName;
  clean.preferUncheckedFirst=false; // The check list now keeps a consistent default order.
  clean.achievements=Array.isArray(clean.achievements)?clean.achievements.filter(x=>typeof x==='string').slice(0,120):[];
  clean.gachaHistory=Array.isArray(clean.gachaHistory)?clean.gachaHistory.slice(0,40):[];
  clean.gachaSessions=Array.isArray(clean.gachaSessions)?clean.gachaSessions.slice(0,20).filter(x=>x&&Array.isArray(x.results)):[];
  clean.gachaSpeed=clean.gachaSpeed===2?2:1;
  clean.aiQuality=['balanced','detailed'].includes(src.aiQuality)?src.aiQuality:'balanced';
  clean.activeSetToday=clean.itemSets.some(x=>x.id===src.activeSetToday)?src.activeSetToday:'';
  clean.activeSetTomorrow=clean.itemSets.some(x=>x.id===src.activeSetTomorrow)?src.activeSetTomorrow:'';
  // V28.9: manually reported missed items. Invalid/backdated/duplicate records are discarded.
  clean.forgetEvents=Array.isArray(src.forgetEvents)?src.forgetEvents.slice(-500).filter(x=>x&&typeof x==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')).map(x=>({
    id:String(x.id||'').slice(0,80),name:String(x.name||'持ち物').slice(0,35),date:String(x.date)
  })).filter(x=>x.id&&x.name).filter((x,i,a)=>a.findIndex(y=>y.id===x.id&&y.date===x.date)===i).slice(-365):[];
  clean.claimedWalkMissions=Array.isArray(clean.claimedWalkMissions)?clean.claimedWalkMissions.filter(x=>Number.isFinite(x)&&x>=0).slice(0,100):[];
  // Upgrade old saves without re-awarding steps already walked on the same day.
  // Schema 2 tracks 100m increments. Existing days start from the next unrewarded 100m.
  const stages=Array.from({length:10},(_,i)=>(i+1)*100);
  const walkedToday=clean.walkDate===TODAY()?Math.max(0,clean.walkMeters):0;
  clean.walkRewardedStages=src.walkRewardSchema===2 && Array.isArray(src.walkRewardedStages)
    ? [...new Set(src.walkRewardedStages.filter(x=>stages.includes(x)))].sort((a,b)=>a-b)
    : stages.filter(m=>walkedToday>=m);
  clean.walkRewardSchema=2;
  // V34.7: migrations from the older 500/1000/2000m coin system are not
  // eligible for new 200m rewards on distance already credited today.
  const coinSteps=Array.from({length:10},(_,i)=>(i+1)*200);
  clean.claimedWalkMissions=src.walkCoinRewardSchema===3
    ? [...new Set((Array.isArray(src.claimedWalkMissions)?src.claimedWalkMissions:[]).filter(m=>coinSteps.includes(m)))].sort((a,b)=>a-b)
    : coinSteps.filter(m=>walkedToday>=m);
  clean.walkCoinRewardSchema=3;
  clean.walkAutoEnabled=src.walkAutoEnabled===true;
  clean.walkLocationChoice=['unset','later','enabled'].includes(src.walkLocationChoice)?src.walkLocationChoice:'unset';
  clean.walkBonusPointsToday=clean.walkDate===TODAY() && src.walkRewardSchema===2
    ? Math.min(200,safeNumber(src.walkBonusPointsToday)) : 0;
  return clean;
}
function loadState(){
 try{
  const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return defaultState();
  try{lastSavedRaw=raw;return sanitizeState(validJSON(raw))}
  catch(error){
   console.warn('保存データ破損',error);
   try{const prior=localStorage.getItem(RECOVERY_KEY);if(prior){const data=validJSON(prior);startupDataAlert='以前の保存データから復旧しました。内容を確認してバックアップを作成してください。';return sanitizeState(data)}}catch(e){console.warn('復旧不可',e)}
   externalDataChange=true;startupDataAlert='保存データが壊れています。上書きを防ぐため保存を停止しました。バックアップからの復元をおすすめします。';return defaultState();
  }
 }catch(error){saveFailure=true;startupDataAlert='保存領域にアクセスできません。';console.warn(error);return defaultState()}
}
function saveState(){
 if(externalDataChange){renderDataSafetyNotice();return false}
 try{
  const raw=JSON.stringify(state),previous=localStorage.getItem(STORAGE_KEY);
  // Do not overwrite another tab's changes, even if the storage event has not arrived yet.
  if((previous||'')!==lastSavedRaw){
    externalDataChange=true;
    startupDataAlert='別のタブで保存内容が更新されました。最新の内容を読み込み直してください。';
    renderDataSafetyNotice();return false;
  }
  if(previous&&previous!==raw){try{validJSON(previous);localStorage.setItem(RECOVERY_KEY,previous)}catch{}}
  localStorage.setItem(STORAGE_KEY,raw);lastSavedRaw=raw;saveFailure=false;renderDataSafetyNotice();
  if(typeof window.smapoCloudQueueSave==='function')window.smapoCloudQueueSave();
  if(typeof v352RenderSaveStatus==='function')v352RenderSaveStatus();
  return true;
 }catch(error){saveFailure=true;console.warn('保存に失敗しました',error);renderDataSafetyNotice();return false}
}
function rankForTrust(v=state.trust){return [...RANKS].reverse().find(r=>v>=r.threshold)||RANKS[0]}
function nextRank(){const r=rankForTrust();return RANKS.find(x=>x.level===r.level+1)||null}
function escapeHTML(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function rand(arr){return arr[Math.floor(Math.random()*arr.length)]}



// Partner voice recording and playback removed in V28.7.

// Original Pocket-Pop loop composed specifically for Sumapokke; not a copy of any game's BGM.
const POCKET_BGM_SRC='assets/pokke_bgm.mp3';
const BGM_TRACKS={
  pocketpop:{name:'ころころポッケ',emoji:'🍉',desc:'木琴と軽やかなリズムの、最初から流れるテーマ曲',file:true},
  spring:{
    name:'春風メロディ',emoji:'🌸',desc:'明るくてやさしい、すまぽっけの定番',
    bpm:92,wave:'triangle',
    melody:['E5','G5','A5','G5','E5','D5','C5','D5','E5','G5','C6','B5','A5','G5','E5','D5'],
    bass:['C3',null,'G3',null,'A3',null,'F3',null,'C3',null,'G3',null,'F3',null,'G3',null],
    chords:[['C4','E4','G4'],null,null,null,['A3','C4','E4'],null,null,null,['F3','A3','C4'],null,null,null,['G3','B3','D4'],null,null,null]
  },
  cozy:{
    name:'のんびりポッケ',emoji:'☕',desc:'ゆったり落ち着く、準備やマイページ向け',
    bpm:72,wave:'sine',
    melody:['C5',null,'E5',null,'G5','E5','D5',null,'A4',null,'C5',null,'F5','E5','C5',null],
    bass:['F2',null,null,null,'C3',null,null,null,'D3',null,null,null,'C3',null,null,null],
    chords:[['F3','A3','C4'],null,null,null,['C3','E3','G3'],null,null,null,['D3','F3','A3'],null,null,null,['C3','E3','G3'],null,null,null]
  },
  quest:{
    name:'おでかけクエスト',emoji:'👟',desc:'少しテンポ速め。歩きたい気分に',
    bpm:118,wave:'triangle',
    melody:['D5','F#5','A5','F#5','E5','F#5','A5','B5','A5','F#5','E5','D5','F#5','E5','D5','A4'],
    bass:['D3',null,'D3',null,'G3',null,'A3',null,'D3',null,'B2',null,'G3',null,'A3',null],
    chords:[['D4','F#4','A4'],null,null,null,['G3','B3','D4'],null,null,null,['B3','D4','F#4'],null,null,null,['A3','C#4','E4'],null,null,null]
  },
  night:{
    name:'星空おやすみ',emoji:'🌙',desc:'静かな夜向け。あしたの準備にも',
    bpm:64,wave:'sine',
    melody:['A4',null,'C5',null,'E5',null,'D5',null,'C5',null,'A4',null,'G4',null,'E4',null],
    bass:['A2',null,null,null,'F2',null,null,null,'C3',null,null,null,'E2',null,null,null],
    chords:[['A3','C4','E4'],null,null,null,['F3','A3','C4'],null,null,null,['C3','E3','G3'],null,null,null,['E3','G#3','B3'],null,null,null]
  },
  sparkle:{
    name:'キラキラポケット',emoji:'✨',desc:'ガチャやごほうびに合う、きらめく曲',
    bpm:126,wave:'square',
    melody:['G5','B5','D6','B5','A5','B5','D6','E6','D6','B5','A5','G5','B5','A5','G5','D5'],
    bass:['G2',null,'D3',null,'E3',null,'C3',null,'G2',null,'D3',null,'C3',null,'D3',null],
    chords:[['G3','B3','D4'],null,null,null,['E3','G3','B3'],null,null,null,['C3','E3','G3'],null,null,null,['D3','F#3','A3'],null,null,null]
  }
};

let bgmAudio=null;
function ensurePokkeAudio(){
  if(!bgmAudio){
    bgmAudio=new Audio(POCKET_BGM_SRC);
    bgmAudio.loop=true;
    bgmAudio.preload='auto';
    bgmAudio.setAttribute('playsinline','');
  }
  return bgmAudio;
}
function updatePokkeAudioVolume(){
  if(!bgmAudio)return;
  bgmAudio.volume=Math.min(1,Math.max(0,(state.bgmEnabled&&bgmPlaying&&state.bgmTrack==='pocketpop')?bgmTargetGain()*1.35:0));
}
let bgmCtx=null;
let bgmMaster=null;
let bgmTimer=null;
let bgmStep=0;
let bgmPlaying=false;
let bgmDuck=1;

function noteFreq(note){
  if(!note)return 0;
  const m=String(note).match(/^([A-G])(#|b)?(\d)$/);
  if(!m)return 0;
  const semis={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  let n=semis[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);
  const midi=(Number(m[3])+1)*12+n;
  return 440*Math.pow(2,(midi-69)/12);
}
function ensureBgmAudio(){
  if(!bgmCtx){
    bgmCtx=new (window.AudioContext||window.webkitAudioContext)();
    bgmMaster=bgmCtx.createGain();
    bgmMaster.gain.value=0;
    bgmMaster.connect(bgmCtx.destination);
  }
  if(bgmCtx.state==='suspended')bgmCtx.resume().catch(()=>{});
  return bgmCtx;
}
function bgmTargetGain(){
  return Math.max(0,Math.min(.7,(Number.isFinite(Number(state.bgmVolume))?Number(state.bgmVolume):.26)))*bgmDuck;
}
function setBgmGain(smooth=.15){
  updatePokkeAudioVolume();
  if(!bgmCtx||!bgmMaster)return;
  const now=bgmCtx.currentTime;
  bgmMaster.gain.cancelScheduledValues(now);
  bgmMaster.gain.setValueAtTime(bgmMaster.gain.value,now);
  bgmMaster.gain.linearRampToValueAtTime(state.bgmEnabled?bgmTargetGain():0,now+smooth);
}
function playBgmVoice(note,duration=.25,level=.18,wave='sine',detune=0){
  if(!note||!bgmCtx||!bgmMaster)return;
  const f=noteFreq(note);if(!f)return;
  const now=bgmCtx.currentTime;
  const osc=bgmCtx.createOscillator(),gain=bgmCtx.createGain();
  osc.type=wave;osc.frequency.value=f;osc.detune.value=detune;
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(Math.max(.001,level),now+.018);
  gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  osc.connect(gain);gain.connect(bgmMaster);
  osc.start(now);osc.stop(now+duration+.04);
}
function playBgmStep(){
  if(!state.bgmEnabled||!bgmPlaying)return;
  const track=BGM_TRACKS[state.bgmTrack]||BGM_TRACKS.spring;
  const len=track.melody.length;
  const step=bgmStep%len;
  const beat=60/track.bpm;
  const stepSeconds=beat/2;
  const mel=track.melody[step];
  const bass=track.bass[step%track.bass.length];
  const chord=track.chords[step%track.chords.length];
  if(mel)playBgmVoice(mel,stepSeconds*.78,.11,track.wave);
  if(bass)playBgmVoice(bass,stepSeconds*1.35,.07,'sine');
  if(chord)chord.forEach((n,i)=>playBgmVoice(n,stepSeconds*1.8,.026,'sine',(i-1)*3));
  bgmStep++;
  bgmTimer=setTimeout(playBgmStep,stepSeconds*1000);
}
function startBGM(trackId=state.bgmTrack){
  if(!BGM_TRACKS[trackId])trackId='pocketpop';
  if(state.bgmEnabled&&bgmPlaying&&state.bgmTrack===trackId){
    if(trackId!=='pocketpop'||(bgmAudio&&!bgmAudio.paused))return;
  }
  if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null}
  if(bgmAudio)bgmAudio.pause();
  state.bgmTrack=trackId;
  state.bgmEnabled=true;
  saveState();
  bgmPlaying=true;
  bgmStep=0;
  if(trackId==='pocketpop'){
    const music=ensurePokkeAudio();
    music.currentTime=0;
    setBgmGain(.2);
    const playback=music.play();
    if(playback&&typeof playback.catch==='function')playback.catch(err=>{
      // The browser may not permit sound until a user interaction.
      if(state.bgmEnabled&&state.bgmTrack==='pocketpop'&&music.paused){
        bgmPlaying=false;
        armBgmResume();
      }
      console.info('BGM waits for a user gesture:',err?.name||err);
    });
    renderBgmState();
    return;
  }
  ensureBgmAudio();
  setBgmGain(.25);
  playBgmStep();
  renderBgmState();
}
function stopBGM(save=true){
  if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null}
  if(bgmAudio)bgmAudio.pause();
  bgmPlaying=false;
  if(save){state.bgmEnabled=false;saveState()}
  setBgmGain(.18);
  renderBgmState();
}
function setBgmVolume(value){
  state.bgmVolume=Math.max(0,Math.min(.7,Number(value)||0));
  saveState();setBgmGain(.08);renderBgmState();
}
function duckBGM(mult=.3){bgmDuck=Math.max(0,Math.min(1,mult));setBgmGain(.12)}
function restoreBGM(){bgmDuck=1;setBgmGain(.18)}
function renderBgmState(){
  const el=document.getElementById('bgmState');
  if(el)el.textContent=state.bgmEnabled?(BGM_TRACKS[state.bgmTrack]?.name||'再生中'):'OFF';
  const splash=document.getElementById('splashBgmToggle');
  if(splash){
    splash.textContent=state.bgmEnabled?'♫ BGM ON':'♫ BGM OFF';
    splash.setAttribute('aria-pressed',String(state.bgmEnabled));
    splash.setAttribute('aria-label',state.bgmEnabled?'BGMをオフにする':'BGMをオンにする');
  }
}
function showBgmPicker(){
  const cards=Object.entries(BGM_TRACKS).map(([id,t])=>`
    <button class="bgm-track-card ${state.bgmTrack===id&&state.bgmEnabled?'active':''}" data-bgm-track="${id}">
      <span class="bgm-track-icon">${t.emoji}</span>
      <span><b>${t.name}</b><small>${t.desc}</small></span>
      <em>${state.bgmTrack===id&&state.bgmEnabled?'再生中':'▶'}</em>
    </button>`).join('');
  showModal('BGMを選ぶ',`
    <div class="bgm-picker">
      <div class="bgm-now"><span>🎵</span><div><small>現在のBGM</small><b>${state.bgmEnabled?(BGM_TRACKS[state.bgmTrack]?.name||'BGM'):'OFF'}</b></div>
        <button class="bgm-off-btn" id="bgmOffModal">${state.bgmEnabled?'停止':'OFF'}</button>
      </div>
      <div class="bgm-track-list">${cards}</div>
      <label class="bgm-volume-row"><span>🔉 音量</span><input id="bgmVolumeRange" type="range" min="0" max="0.7" step="0.01" value="${Number((Number.isFinite(Number(state.bgmVolume))?Number(state.bgmVolume):.26))}"><b id="bgmVolumeLabel">${Math.round(((Number.isFinite(Number(state.bgmVolume))?Number(state.bgmVolume):.26))/.7*100)}%</b></label>
      <p class="modal-note">最初の曲「ころころポッケ」はすまぽっけのオリジナルBGMです。ブラウザの制限により、最初のタップ後に再生が始まります。音楽はいつでも停止できます。</p>
    </div>`,{icon:'🎵'});
  document.querySelectorAll('[data-bgm-track]').forEach(b=>b.onclick=()=>{
    startBGM(b.dataset.bgmTrack);
    closeModal();
    toast(`${BGM_TRACKS[b.dataset.bgmTrack].name} を再生中♪`);
  });
  const off=document.getElementById('bgmOffModal');
  if(off)off.onclick=()=>{stopBGM(true);closeModal();toast('BGMを停止したよ')};
  const range=document.getElementById('bgmVolumeRange');
  if(range)range.oninput=e=>{
    setBgmVolume(e.target.value);
    const label=document.getElementById('bgmVolumeLabel');
    if(label)label.textContent=`${Math.round(Number(e.target.value)/.7*100)}%`;
  };
}
function armBgmResume(){
  if(!state.bgmEnabled||bgmPlaying)return;
  const resume=()=>{
    // Wait until the user actually enters the app; splash BGM toggle must stay silent.
    const splash=document.getElementById('splash');
    if(splash&&!splash.classList.contains('hidden'))return;
    if(state.bgmEnabled&&!bgmPlaying)startBGM(state.bgmTrack);
    if(bgmPlaying){
      document.removeEventListener('pointerdown',resume,true);
      document.removeEventListener('keydown',resume,true);
      document.removeEventListener('click',resume,true);
    }
  };
  document.addEventListener('pointerdown',resume,true);
  document.addEventListener('keydown',resume,true);
  document.addEventListener('click',resume,true);
}

function daysBetween(a,b){
  if(!a||!b)return 999;
  const A=new Date(`${a}T00:00:00`),B=new Date(`${b}T00:00:00`);
  return Math.round((B-A)/86400000);
}
function inventoryOwnedWithState(x,s){return x.stack?(s.inventory?.[x.id]||0)>0:!!s.inventory?.[x.id]}
const ACHIEVEMENTS=[
  {id:'first-check',emoji:'🎒',name:'はじめの一歩',desc:'持ち物チェックを1回達成',test:s=>s.checkCompletions>=1},
  {id:'check-5',emoji:'✅',name:'準備の達人',desc:'持ち物チェックを5回達成',test:s=>s.checkCompletions>=5},
  {id:'trust-1000',emoji:'🍀',name:'信頼の相棒',desc:'信頼度1000ptに到達',test:s=>s.trust>=1000},
  {id:'walk-5000',emoji:'👟',name:'おさんぽ仲間',desc:'合計5000m歩く',test:s=>(s.totalWalkMeters||0)>=5000},
  {id:'collector-3',emoji:'🎁',name:'コレクター',desc:'3種類のアイテムを集める',test:s=>SHOP_ITEMS.filter(x=>inventoryOwnedWithState(x,s)).length>=3},
  {id:'honest-3',emoji:'♡',name:'正直もの',desc:'正直申告を3回する',test:s=>s.honestCount>=3},
  {id:'rank-5',emoji:'🌌',name:'最高の相棒',desc:'Lv.5 四次元ポッケに到達',test:s=>s.rank>=5}
];
function rewardBurst(text='やったね！',emoji='✨',kind='reward'){
  const layer=document.getElementById('effectsLayer');if(!layer)return;
  const pop=document.createElement('div');pop.className=`reward-fly ${kind}`;
  pop.innerHTML=`<span>${emoji}</span><b>${escapeHTML(text)}</b>`;layer.appendChild(pop);
  const particleCount=state.powerSaving?5:14;for(let i=0;i<particleCount;i++){
    const p=document.createElement('i');p.className='fx-particle';
    p.style.setProperty('--x',`${(Math.random()-.5)*240}px`);
    p.style.setProperty('--y',`${-50-Math.random()*170}px`);
    p.style.setProperty('--r',`${Math.random()*260-130}deg`);
    p.style.setProperty('--d',`${.65+Math.random()*.5}s`);
    p.textContent=rand(['✦','✿','•','♡']);layer.appendChild(p);setTimeout(()=>p.remove(),1400);
  }
  setTimeout(()=>pop.remove(),1300);
}
function mascotReaction(text,emoji='✨',mood='happy'){
  const box=document.getElementById('reactionPop');
  if(box){
    document.getElementById('reactionEmoji').textContent=emoji;
    document.getElementById('reactionText').textContent=text;
    box.classList.remove('hidden');box.classList.add('show');
    clearTimeout(mascotReaction.timer);
    mascotReaction.timer=setTimeout(()=>{box.classList.remove('show');setTimeout(()=>box.classList.add('hidden'),180)},1900);
  }
  setMascotMood(mood,4200);
  document.querySelectorAll('.mascot-art').forEach(el=>{
    el.classList.remove('reaction-happy','reaction-surprise','reaction-sleepy');
    const cls=mood==='surprise'?'reaction-surprise':mood==='sleepy'||mood==='sad'?'reaction-sleepy':'reaction-happy';
    el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),1000);
  });
  const speech=document.getElementById('homeSpeech');if(speech)speech.textContent=text;
}
function unlockAchievements(show=true){
  state.achievements=Array.isArray(state.achievements)?state.achievements:[];
  const newly=[];
  ACHIEVEMENTS.forEach(a=>{if(a.test(state)&&!state.achievements.includes(a.id)){state.achievements.push(a.id);newly.push(a)}});
  if(newly.length){
    saveState();
    if(show){const a=newly[0];rewardBurst(`実績「${a.name}」`,a.emoji,'achievement');setTimeout(()=>toast(`実績解除：${a.name}`),300)}
  }
  return newly;
}
function getTodayAltAction(){
  const today=TODAY();
  if(state.altActionDate===today&&state.altActionType)return state.altActionType;
  // Migration support for V14 and earlier.
  if(state.lastActionDate===today&&state.lastActionType==='no-outing')return 'no-outing';
  if(state.lastHonestDate===today)return 'honest';
  return '';
}
function lockTodayAltAction(type){
  state.altActionDate=TODAY();
  state.altActionType=type;
}
function isCheckCompletedToday(){
  return state.lastActionDate===TODAY()&&state.lastActionType==='check';
}
function isTodayCheckLocked(){
  return !!getTodayAltAction();
}
// === V28.9 やさしい忘れ物サポート ===
// Records describe what the USER explicitly reported. An unchecked item is not treated as forgotten.
const FORGET_WINDOW_DAYS=30;
function recentForgetEvents(days=FORGET_WINDOW_DAYS){
  return (state.forgetEvents||[]).filter(e=>{const gap=daysBetween(e.date,TODAY());return gap>=0&&gap<days;});
}
function forgetStats(days=FORGET_WINDOW_DAYS){
  const events=recentForgetEvents(days),byName=new Map();
  for(const e of events){const key=forgetKey(e.name),old=byName.get(key)||{id:e.id,name:e.name,count:0,last:e.date};old.count++;if(e.date>=old.last){old.last=e.date;old.name=e.name;old.id=e.id}byName.set(key,old)}
  return [...byName.values()].sort((a,b)=>b.count-a.count||b.last.localeCompare(a.last)||a.name.localeCompare(b.name));
}
function forgetKey(name){return String(name||'').normalize('NFKC').trim().toLowerCase()}
function forgetCount(item){return forgetStats().find(x=>forgetKey(x.name)===forgetKey(item.name))?.count||0}
function attentionItems(){
  return state.items.map((item,index)=>({item,index,count:forgetCount(item)}))
    .sort((a,b)=>state.preferUncheckedFirst?(Number(a.item.checked)-Number(b.item.checked)||Number(isEssential(b.item.name))-Number(isEssential(a.item.name))||b.count-a.count||a.index-b.index):(b.count-a.count||a.index-b.index));
}
function careLevel(){
  const total=recentForgetEvents().length;
  const gap=daysBetween(state.lastCheckDate,TODAY());
  if(total>=2||state.rank<=2||gap>=7&&state.checkCompletions>0)return 'careful';
  if(total>0||state.rank===3)return 'balanced';
  return 'relaxed';
}
function careMessage(){
  const top=forgetStats()[0],mode=careLevel();
  if(top){
    const item=state.items.find(x=>forgetKey(x.name)===forgetKey(top.name));
    if(item)return `最近忘れた「${item.name}」から見てみよう。過去30日で${top.count}回の記録があるよ。`;
  }
  if(mode==='careful')return '今日はひとつずつ、実物を見ながらチェックしよう。ゆっくりで大丈夫！';
  if(mode==='balanced')return 'いつもの持ち物を、出発前にもう一度チェックしよう。';
  return 'いつもの調子で確認しよう。最後のチェックは今日も大切だよ！';
}
function renderCareSupport(){
  const heading=document.getElementById('careAssistHeading'),body=document.getElementById('careAssistText');
  const card=document.getElementById('careAssistCard'),n=document.getElementById('careForgetTotal'),list=document.getElementById('careForgetList');
  const mode=careLevel(),top=forgetStats().slice(0,3),total=recentForgetEvents().length;
  if(card){card.dataset.mode=mode;}
  if(heading)heading.textContent=mode==='careful'?'🔎 今日は丁寧にチェック':mode==='balanced'?'🌼 いつもの安心チェック':'✨ 自分のペースでチェック';
  if(body)body.textContent=careMessage();
  if(n)n.textContent=`過去30日：${total}件`;
  if(list)list.innerHTML=top.length?top.map(e=>`<span class="care-stat-chip">🎒 ${escapeHTML(e.name)} <b>${e.count}回</b></span>`).join(''):'<span class="care-stat-empty">記録はまだないよ。忘れ物があったときだけ記録してね。</span>';
  const home=document.getElementById('homeCareText');if(home)home.textContent=careMessage();
}
function showCareReview(){
  const targets=attentionItems(),top=targets.filter(x=>x.count>0).slice(0,3);
  const names=(top.length?top:targets.slice(0,3)).map(x=>`${escapeHTML(x.item.emoji||'🎒')} ${escapeHTML(x.item.name)}`);
  showModal('出発前の最終確認',`<div class="care-review"><div class="care-review-mascot">${mascotArt(state.partner,state.rank,'thinking')}</div><p>実物を見て、最後にこれだけ確認してみよう！</p><div class="care-review-items">${names.map(n=>`<span>${n}</span>`).join('')}</div><small>これは任意の確認だよ。AIが持ち物を検出したわけではないよ。</small></div>`,{
    icon:'👜',actions:[{label:'確認画面に戻る',primary:true,onClick:()=>go('check')}]});
  setMascotMood('thinking',4200);
}
function recordForgottenItem(itemId){
  const item=state.items.find(x=>x.id===itemId);
  if(!item)return toast('この持ち物は今日のリストにないよ');
  if((state.forgetEvents||[]).some(e=>forgetKey(e.name)===forgetKey(item.name)&&e.date===TODAY()))return toast('この持ち物は今日すでに記録しているよ');
  if(!confirm(`「${item.name}」を実際に忘れた記録として残しますか？\n（チェックが付いていないだけなら記録しないでね）\n信頼度・コインは減らないよ。`))return;
  state.forgetEvents=Array.isArray(state.forgetEvents)?state.forgetEvents:[];
  state.forgetEvents.push({id:item.id,name:item.name,date:TODAY()});
  state.forgetEvents=state.forgetEvents.slice(-365);saveState();renderAll();
  mascotReaction(`教えてくれてありがとう。「${item.name}」を次から優先して確認しようね。`,'🌼','thinking');
  toast(`${item.name}の忘れ物を記録したよ`);
}
function showForgetReport(){
  const events=recentForgetEvents(),stats=forgetStats(),recent=events.slice(-6).reverse();
  const options=state.items.map(it=>{
    const done=(state.forgetEvents||[]).some(e=>e.date===TODAY()&&forgetKey(e.name)===forgetKey(it.name));
    return `<button class="care-report-item" data-forgot-id="${escapeHTML(it.id)}" ${done?'disabled':''}><span>${escapeHTML(it.emoji||'🎒')} ${escapeHTML(it.name)}</span><small>${done?'今日記録済み':`過去30日 ${stats.find(x=>forgetKey(x.name)===forgetKey(it.name))?.count||0}回`}</small></button>`;
  }).join('');
  showModal('忘れ物を記録する',`<div class="forget-report"><p>出発してから本当に忘れたことに気づいた物だけ選んでね。<b>未チェック＝忘れ物</b>にはしないよ。</p><div class="care-report-list">${options}</div><p class="care-report-note">過去30日：${events.length}件。減点なし・端末内だけに保存されます。</p><button type="button" id="fgReportOther" class="fg-other-btn">＋ リストにない忘れ物を記録</button>${recent.length?`<details class="care-log"><summary>最近の記録を確認する</summary>${recent.map(e=>`<div><span>${escapeHTML(e.date)}　${escapeHTML(e.name)}</span><button data-undo-forget="${escapeHTML(e.id)}|${escapeHTML(e.date)}">取り消す</button></div>`).join('')}</details>`:''}</div>`,{icon:'🎒'});
  document.querySelectorAll('[data-forgot-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.forgotId;recordForgottenItem(id);if(!document.getElementById('modalBackdrop').classList.contains('hidden'))showForgetReport()});
  document.getElementById('fgReportOther')?.addEventListener('click',recordOtherForgotten);
  document.querySelectorAll('[data-undo-forget]').forEach(b=>b.onclick=()=>{
    const [id,date]=b.dataset.undoForget.split('|');const entry=state.forgetEvents.find(x=>x.id===id&&x.date===date);
    if(!entry||!confirm(`${entry.date} の「${entry.name}」の記録を取り消す？`))return;
    state.forgetEvents=state.forgetEvents.filter(x=>x!==entry);saveState();renderAll();showForgetReport();toast('記録を取り消したよ');
  });
}
function todayLockLabel(){
  const chosen=getTodayAltAction();
  return chosen==='no-outing'?'出ない日を記録済み':chosen==='honest'?'正直申告済み':'';
}
function renderCheckAvailability(){
  const locked=isTodayCheckLocked();
  const completed=isCheckCompletedToday();
  const notice=document.getElementById('checkLockNotice');
  const complete=document.getElementById('completeCheckBtn');
  const ai=document.getElementById('openAiBtn');
  const departure=document.getElementById('departureBtn');

  if(notice){
    notice.classList.toggle('hidden',!locked&&!completed);
    const title=document.getElementById('checkLockTitle');
    const text=document.getElementById('checkLockText');
    if(locked){
      title.textContent=`今日は「${todayLockLabel()}」`;
      text.textContent='そのため、本日の持ち物チェックはできません。明日になると再開できます。';
    }else if(completed){
      title.textContent='今日のチェックは完了済み';
      text.textContent='今日の報酬は受け取り済みです。明日また一緒に確認しよう。';
    }
  }

  if(complete){
    complete.disabled=locked||completed;
    complete.classList.toggle('check-locked',locked);
    complete.innerHTML=locked?'🔒 今日はチェックできません':completed?'✓ 今日のチェック完了済み':'✓ チェック完了！ <span>+100pt</span>';
  }
  if(ai)ai.disabled=locked||completed;

  if(departure){
    departure.disabled=locked||completed;
    departure.classList.toggle('check-locked',locked||completed);
    const b=departure.querySelector('b');
    const small=departure.querySelector('small');
    if(b)b.textContent=locked?'本日のチェックはお休み':completed?'今日のチェック完了！':'出発前チェック';
    if(small)small.textContent=locked?todayLockLabel():completed?'また明日いっしょに確認しよう':'忘れ物ゼロでいってきます！';
  }

  document.querySelectorAll('#bottomNav [data-go="check"]').forEach(btn=>{
    btn.classList.toggle('nav-locked',locked);
    btn.setAttribute('aria-label',locked?`チェック不可：${todayLockLabel()}`:'持ち物チェック');
  });
  const editLocked=isTodayCheckLocked()||isCheckCompletedToday();
  document.getElementById('addItemBtn').disabled=editLocked;
  document.querySelectorAll('[data-quick-item]').forEach(b=>{b.disabled=editLocked});
}

// V27.3: Every report (at most one per day) alternates + / - / + / -.
// Track independently from historical honestCount so a user upgrading
// from an older version starts with a clearly explained positive round.
function nextHonestCycle(){
  const index=Math.max(0,Math.floor(Number(state.honestCycleCount)||0));
  const plus=index%2===0;
  const prev=Math.max(0,Math.floor(Number(state.honestLastPlus)||0));
  // A penalty is at least 2.5x the actual points granted last positive round.
  // If there are fewer trust points, the balance stops at zero.
  const plannedPenalty=Math.max(25,Math.ceil((prev||10)*ECONOMY.honestPenaltyRate));
  return {number:index+1,plus,plannedPenalty};
}
function honestCyclePreview(){
  const cycle=nextHonestCycle();
  if(!cycle.plus)return `今回は減点の番：信頼度 −${cycle.plannedPenalty}pt（残高は0未満になりません）`;
  return '今回は加点の番：信頼度 +10pt × ランクなどの倍率、コイン +10枚';
}

function renderDailyChoiceButtons(){
  const noBtn=document.getElementById('noOutingBtn');
  const honestBtn=document.getElementById('honestBtn');
  if(!noBtn||!honestBtn)return;

  const chosen=getTodayAltAction();
  const completed=isCheckCompletedToday();
  const locked=!!chosen||completed;

  noBtn.disabled=locked;
  honestBtn.disabled=locked;

  noBtn.classList.toggle('daily-choice-selected',chosen==='no-outing');
  honestBtn.classList.toggle('daily-choice-selected',chosen==='honest');
  noBtn.classList.toggle('daily-choice-blocked',locked&&chosen!=='no-outing');
  honestBtn.classList.toggle('daily-choice-blocked',locked&&chosen!=='honest');

  if(completed){
    noBtn.textContent='🏠 今日はチェック済み';
    honestBtn.textContent='♡ 今日はチェック済み';
  }else if(chosen==='no-outing'){
    noBtn.textContent='✓ 出ない日を記録済み';
    honestBtn.textContent='♡ 今日は選べません';
  }else if(chosen==='honest'){
    honestBtn.textContent='✓ 正直申告済み';
    noBtn.textContent='🏠 今日は選べません';
  }else{
    noBtn.textContent='🏠 出ない日';
    honestBtn.textContent='♡ 正直申告';
  }
  const hint=document.getElementById('honestCycleHint');
  if(hint){
    const cycle=nextHonestCycle();
    const today=getDayRecord();
    if(chosen==='honest'){
      const delta=Number(today.honestDelta)||0;
      hint.innerHTML=`<b>♡ 今日の申告は完了</b><span>${delta>0?'+':''}${delta}ptを記録したよ。次回は${cycle.plus?'加点':'減点'}の番。</span>`;
    }else if(locked){
      hint.innerHTML=`<b>♡ 正直申告のルール</b><span>1回目は加点 → 2回目は2.5倍以上の減点 → 3回目は加点、を繰り返すよ。次の申告：${cycle.plus?'加点':'減点'}</span>`;
    }else{
      hint.innerHTML=`<b>${cycle.plus?'🌱 加点':'⚠️ 減点'}の番：${cycle.number}回目</b><span>${honestCyclePreview()}</span><small>次回は反対の結果。申告は1日1回・ほかの記録とは同日併用できないよ。</small>`;
    }
    hint.classList.toggle('is-penalty',!cycle.plus);
  }
  renderCheckAvailability();
}

function updateCheckStreak(){
  const today=TODAY(),gap=daysBetween(state.lastCheckDate,today);
  if(state.lastCheckDate===today)return;
  state.streak=gap===1?(state.streak||0)+1:1;state.lastCheckDate=today;
}
function addQuickItem(name,emoji='🎒'){
  if(isTodayCheckLocked()||isCheckCompletedToday())return toast('今日のチェックは終了済み。明日また追加できるよ');
  if(state.items.some(x=>x.name===name))return toast(`${name}はもう入ってるよ`);
  state.items.push({id:`quick-${Date.now()}-${Math.random().toString(16).slice(2)}`,name,hint:'',checked:false,emoji});state.activeSetToday='';
  saveState();renderAll();toast(`${name}を追加したよ`);
}


// ============================================================
// V10 FINAL PARTNER ART
// 正式デザイン：画像のぽけっとくん / ぽけっとちゃんを透過PNG化。
// 将来画像を差し替える場合は、この2つの値を変更すればOK。
// ============================================================
// V23: 一貫した4種類の正式な相棒画像。4枚のPNGは index.html と同じフォルダに配置。
const FINAL_MASCOT_ART = {
  kun:'assets/mascot_kun.webp',
  chan:'assets/mascot_chan.webp'
};
// すまぽっけV28.3: 両キャラ共通の表情6種類（通常 + 喜ぶ・びっくり・しょんぼり・眠い・ウインク・考え中）
const MASCOT_EXPRESSIONS = {
  kun: {
    normal:'assets/mascot_kun.webp', talk:'assets/mascot_kun.webp', grin:'assets/mascot_kun.webp',
    happy:'assets/mascot_kun.webp', excited:'assets/mascot_kun.webp',
    surprise:'assets/mascot_kun_surprise.webp', sad:'assets/mascot_kun_sad.webp',
    sleepy:'assets/mascot_kun_sleepy.webp', wink:'assets/mascot_kun_wink.webp', thinking:'assets/mascot_kun_thinking.webp'
  },
  chan: {
    normal:'assets/mascot_chan.webp', talk:'assets/mascot_chan.webp', grin:'assets/mascot_chan.webp',
    happy:'assets/mascot_chan.webp', excited:'assets/mascot_chan.webp',
    surprise:'assets/mascot_chan_surprise.webp', sad:'assets/mascot_chan_sad.webp',
    sleepy:'assets/mascot_chan_sleepy.webp', wink:'assets/mascot_chan_wink.webp', thinking:'assets/mascot_chan_thinking.webp'
  }
};
const POKKE_FEELINGS = [
  {mood:'happy',emoji:'😊',name:'にっこり',line:'いっしょにいると楽しいね！'},
  {mood:'surprise',emoji:'😮',name:'びっくり',line:'わあっ！ びっくりした！'},
  {mood:'sad',emoji:'🥺',name:'しょんぼり',line:'少ししょんぼり…でも、次があるよ。'},
  {mood:'sleepy',emoji:'😴',name:'ねむねむ',line:'ちょっと休憩しようかな…'},
  {mood:'wink',emoji:'😉',name:'ウインク',line:'今日も一緒にがんばろうね！'},
  {mood:'thinking',emoji:'🤔',name:'考え中',line:'あれれ？ なにか忘れてないかな？'}
];
function mascotSource(partnerKey,mood='normal'){
  const key=MASCOT_EXPRESSIONS[partnerKey]?partnerKey:'kun';
  return MASCOT_EXPRESSIONS[key][mood]||MASCOT_EXPRESSIONS[key].normal;
}
let currentHomeMood='normal';
// V28.8: natural idle expressions. Do not interrupt player-chosen expressions or rewards.
let mascotBusyUntil=0;
let mascotIdleSequence=0;
let mascotIdleTimer=null;
function mascotAmbientTick(){
  if(document.visibilityState==='hidden'||Date.now()<mascotBusyUntil)return;
  if(currentScreen!=='home'||document.getElementById('splash')?.classList.contains('hidden')!==true)return;
  if(!document.getElementById('modalBackdrop')?.classList.contains('hidden'))return;
  if(!document.getElementById('firstTour')?.classList.contains('hidden'))return;
  if(!document.getElementById('gachaCinematic')?.classList.contains('hidden'))return;
  if(document.getElementById('onboarding')?.classList.contains('hidden')!==true)return;
  const hour=new Date().getHours();
  const mood=hour>=22||hour<6?'sleepy':
    isCheckCompletedToday()?(mascotIdleSequence%2?'wink':'happy'):
    ['normal','thinking','wink','normal','happy'][mascotIdleSequence%5];
  mascotIdleSequence++;
  if(mood!=='normal')setMascotMood(mood,3300);
}
function startMascotAmbient(){
  if(mascotIdleTimer)clearInterval(mascotIdleTimer);
  mascotIdleTimer=setInterval(mascotAmbientTick,12500);
}
function setMascotMood(mood='normal',duration=1800){
  // Never modify the artwork: switching preserves the approved two-arm sprites.
  clearTimeout(setMascotMood.timer);
  currentHomeMood=MASCOT_EXPRESSIONS[state.partner]?.[mood]?mood:'normal';
  if(duration>0)mascotBusyUntil=Date.now()+Math.max(duration,4200);
  const src=mascotSource(state.partner,currentHomeMood);
  document.querySelectorAll('#homeMascot .mascot-art').forEach(art=>{
    const img=art.querySelector('.mascot-final-img');
    if(img && img.getAttribute('src')!==src)img.src=src;
    art.classList.remove('mood-normal','mood-talk','mood-grin','mood-happy','mood-excited','mood-surprise','mood-sad','mood-sleepy','mood-wink','mood-thinking');
    art.classList.add('mood-'+currentHomeMood);
  });
  // The sticky conversation portrait always shows the current reply expression.
  const talk=document.querySelector('.conversation-modal .talk-portrait');
  if(talk){
    if(talk.getAttribute('src')!==src)talk.src=src;
    const frame=talk.closest('.talk-portrait-frame');
    if(frame){
      frame.dataset.mood=currentHomeMood;
      frame.classList.remove('talk-reacting');void frame.offsetWidth;
      if(currentHomeMood!=='normal')frame.classList.add('talk-reacting');
    }
  }
  if(currentHomeMood!=='normal'&&duration>0){
    setMascotMood.timer=setTimeout(()=>setMascotMood('normal',0),duration);
  }
}

function rankFlair(level, partnerKey) {
  level = Math.max(1, Math.min(5, Number(level) || 1));
  const bow = partnerKey === 'chan'
    ? '<span class="mascot-bow" aria-hidden="true"><i></i><i></i><b></b></span>'
    : '';
  const byLevel = {
    1: '',
    2: '<span class="guardian-seam-decoration" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="pocket-guardian-stamp" aria-hidden="true"><span class="guardian-stitch-ring"></span><span class="guardian-kanji">守</span></span><span class="study-sprout" aria-hidden="true"><svg viewBox="0 0 66 62" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path d="M31 49 Q30 34 34 20" fill="none" stroke="#559d65" stroke-width="4" stroke-linecap="round"/><path d="M33 34 C13 37 5 21 8 11 C23 9 34 20 33 34Z" fill="#a7dc84" stroke="#62ab67" stroke-width="2.5"/><path d="M34 27 C36 8 49 5 59 11 C59 27 47 33 34 27Z" fill="#7bc98a" stroke="#50a671" stroke-width="2.5"/><path d="M13 17Q24 19 30 28 M53 15Q43 19 37 25" fill="none" stroke="#ecffe0" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="47" r="4" fill="#ffe9ad" stroke="#e7b765" stroke-width="1.5"/></svg></span><span class="study-flecks" aria-hidden="true"><i></i><i></i><i></i></span>',
    3: '<span class="lucky-clover-field" aria-hidden="true"><span class="lucky-clover lucky-clover-1" aria-hidden="true"><svg class="lucky-clover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M25 30 C31 38 35 43 38 49" stroke="#4b9b62" stroke-width="3.2" stroke-linecap="round"/><g fill="#72c971" stroke="#4a9c5b" stroke-width="1.4"><path d="M23.5 23C5.5 23 7 4 17 5c6 .7 7 7 7 7s2-7 8-7c10-.5 12 18-8.5 18Z"/><path d="M23.5 23C23.5 5.5 42 6 42 16c0 6-7 8-7 8s7 2 7 8c0 11-18.5 11-18.5-9Z"/><path d="M23.5 23c18 0 16.5 19 7 19-6 0-7-7-7-7s-2 7-8 7c-10 0-12-19 8-19Z"/><path d="M23.5 23c0 18-18.5 17-18.5 7 0-6 7-7 7-7s-7-2-7-8C5 5 23.5 5 23.5 23Z"/></g><path d="M17 12q4-3 6 1M30 10q4 0 5 4M11 29q1 4 5 5" stroke="#daffd1" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="lucky-clover lucky-clover-2" aria-hidden="true"><svg class="lucky-clover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M25 30 C31 38 35 43 38 49" stroke="#4b9b62" stroke-width="3.2" stroke-linecap="round"/><g fill="#72c971" stroke="#4a9c5b" stroke-width="1.4"><path d="M23.5 23C5.5 23 7 4 17 5c6 .7 7 7 7 7s2-7 8-7c10-.5 12 18-8.5 18Z"/><path d="M23.5 23C23.5 5.5 42 6 42 16c0 6-7 8-7 8s7 2 7 8c0 11-18.5 11-18.5-9Z"/><path d="M23.5 23c18 0 16.5 19 7 19-6 0-7-7-7-7s-2 7-8 7c-10 0-12-19 8-19Z"/><path d="M23.5 23c0 18-18.5 17-18.5 7 0-6 7-7 7-7s-7-2-7-8C5 5 23.5 5 23.5 23Z"/></g><path d="M17 12q4-3 6 1M30 10q4 0 5 4M11 29q1 4 5 5" stroke="#daffd1" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="lucky-clover lucky-clover-3" aria-hidden="true"><svg class="lucky-clover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M25 30 C31 38 35 43 38 49" stroke="#4b9b62" stroke-width="3.2" stroke-linecap="round"/><g fill="#72c971" stroke="#4a9c5b" stroke-width="1.4"><path d="M23.5 23C5.5 23 7 4 17 5c6 .7 7 7 7 7s2-7 8-7c10-.5 12 18-8.5 18Z"/><path d="M23.5 23C23.5 5.5 42 6 42 16c0 6-7 8-7 8s7 2 7 8c0 11-18.5 11-18.5-9Z"/><path d="M23.5 23c18 0 16.5 19 7 19-6 0-7-7-7-7s-2 7-8 7c-10 0-12-19 8-19Z"/><path d="M23.5 23c0 18-18.5 17-18.5 7 0-6 7-7 7-7s-7-2-7-8C5 5 23.5 5 23.5 23Z"/></g><path d="M17 12q4-3 6 1M30 10q4 0 5 4M11 29q1 4 5 5" stroke="#daffd1" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="lucky-clover lucky-clover-4" aria-hidden="true"><svg class="lucky-clover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M25 30 C31 38 35 43 38 49" stroke="#4b9b62" stroke-width="3.2" stroke-linecap="round"/><g fill="#72c971" stroke="#4a9c5b" stroke-width="1.4"><path d="M23.5 23C5.5 23 7 4 17 5c6 .7 7 7 7 7s2-7 8-7c10-.5 12 18-8.5 18Z"/><path d="M23.5 23C23.5 5.5 42 6 42 16c0 6-7 8-7 8s7 2 7 8c0 11-18.5 11-18.5-9Z"/><path d="M23.5 23c18 0 16.5 19 7 19-6 0-7-7-7-7s-2 7-8 7c-10 0-12-19 8-19Z"/><path d="M23.5 23c0 18-18.5 17-18.5 7 0-6 7-7 7-7s-7-2-7-8C5 5 23.5 5 23.5 23Z"/></g><path d="M17 12q4-3 6 1M30 10q4 0 5 4M11 29q1 4 5 5" stroke="#daffd1" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="lucky-clover lucky-clover-5" aria-hidden="true"><svg class="lucky-clover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M25 30 C31 38 35 43 38 49" stroke="#4b9b62" stroke-width="3.2" stroke-linecap="round"/><g fill="#72c971" stroke="#4a9c5b" stroke-width="1.4"><path d="M23.5 23C5.5 23 7 4 17 5c6 .7 7 7 7 7s2-7 8-7c10-.5 12 18-8.5 18Z"/><path d="M23.5 23C23.5 5.5 42 6 42 16c0 6-7 8-7 8s7 2 7 8c0 11-18.5 11-18.5-9Z"/><path d="M23.5 23c18 0 16.5 19 7 19-6 0-7-7-7-7s-2 7-8 7c-10 0-12-19 8-19Z"/><path d="M23.5 23c0 18-18.5 17-18.5 7 0-6 7-7 7-7s-7-2-7-8C5 5 23.5 5 23.5 23Z"/></g><path d="M17 12q4-3 6 1M30 10q4 0 5 4M11 29q1 4 5 5" stroke="#daffd1" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="lucky-clover lucky-clover-6" aria-hidden="true"><svg class="lucky-clover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M25 30 C31 38 35 43 38 49" stroke="#4b9b62" stroke-width="3.2" stroke-linecap="round"/><g fill="#72c971" stroke="#4a9c5b" stroke-width="1.4"><path d="M23.5 23C5.5 23 7 4 17 5c6 .7 7 7 7 7s2-7 8-7c10-.5 12 18-8.5 18Z"/><path d="M23.5 23C23.5 5.5 42 6 42 16c0 6-7 8-7 8s7 2 7 8c0 11-18.5 11-18.5-9Z"/><path d="M23.5 23c18 0 16.5 19 7 19-6 0-7-7-7-7s-2 7-8 7c-10 0-12-19 8-19Z"/><path d="M23.5 23c0 18-18.5 17-18.5 7 0-6 7-7 7-7s-7-2-7-8C5 5 23.5 5 23.5 23Z"/></g><path d="M17 12q4-3 6 1M30 10q4 0 5 4M11 29q1 4 5 5" stroke="#daffd1" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="lucky-clover lucky-clover-7" aria-hidden="true"><svg class="lucky-clover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M25 30 C31 38 35 43 38 49" stroke="#4b9b62" stroke-width="3.2" stroke-linecap="round"/><g fill="#72c971" stroke="#4a9c5b" stroke-width="1.4"><path d="M23.5 23C5.5 23 7 4 17 5c6 .7 7 7 7 7s2-7 8-7c10-.5 12 18-8.5 18Z"/><path d="M23.5 23C23.5 5.5 42 6 42 16c0 6-7 8-7 8s7 2 7 8c0 11-18.5 11-18.5-9Z"/><path d="M23.5 23c18 0 16.5 19 7 19-6 0-7-7-7-7s-2 7-8 7c-10 0-12-19 8-19Z"/><path d="M23.5 23c0 18-18.5 17-18.5 7 0-6 7-7 7-7s-7-2-7-8C5 5 23.5 5 23.5 23Z"/></g><path d="M17 12q4-3 6 1M30 10q4 0 5 4M11 29q1 4 5 5" stroke="#daffd1" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="lucky-clover lucky-clover-8" aria-hidden="true"><svg class="lucky-clover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M25 30 C31 38 35 43 38 49" stroke="#4b9b62" stroke-width="3.2" stroke-linecap="round"/><g fill="#72c971" stroke="#4a9c5b" stroke-width="1.4"><path d="M23.5 23C5.5 23 7 4 17 5c6 .7 7 7 7 7s2-7 8-7c10-.5 12 18-8.5 18Z"/><path d="M23.5 23C23.5 5.5 42 6 42 16c0 6-7 8-7 8s7 2 7 8c0 11-18.5 11-18.5-9Z"/><path d="M23.5 23c18 0 16.5 19 7 19-6 0-7-7-7-7s-2 7-8 7c-10 0-12-19 8-19Z"/><path d="M23.5 23c0 18-18.5 17-18.5 7 0-6 7-7 7-7s-7-2-7-8C5 5 23.5 5 23.5 23Z"/></g><path d="M17 12q4-3 6 1M30 10q4 0 5 4M11 29q1 4 5 5" stroke="#daffd1" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="lucky-light-particles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span></span>',
    4: '<span class="royal-aura" aria-hidden="true"></span><span class="royal-sunbeams" aria-hidden="true"></span><span class="rank-crown royal-crown" aria-hidden="true"><svg class="royal-crown-svg" viewBox="0 0 100 76" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="royalGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff6bd"/><stop offset=".36" stop-color="#f8c855"/><stop offset=".68" stop-color="#f2a632"/><stop offset="1" stop-color="#ba772a"/></linearGradient><linearGradient id="royalBand" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff4ad"/><stop offset=".55" stop-color="#ffce51"/><stop offset="1" stop-color="#cb8527"/></linearGradient></defs><path d="M14 53 8 18 31 34 50 9 69 34 92 18 86 53Z" fill="url(#royalGold)" stroke="#b77e27" stroke-width="2.6" stroke-linejoin="round"/><path d="M19 49 15 27 32 39 50 20 68 39 85 27 81 49Z" fill="#fff5cb" opacity=".52"/><path d="M14 52 Q50 60 86 52 L85 65 Q50 72 15 65Z" fill="url(#royalBand)" stroke="#b67d27" stroke-width="2.5"/><path d="M20 59Q50 65 80 59" stroke="#fff7c8" stroke-width="2" fill="none"/><g fill="#fff9cd" stroke="#d49c36" stroke-width="1.6"><circle cx="8" cy="17" r="5"/><circle cx="50" cy="9" r="5"/><circle cx="92" cy="17" r="5"/></g><path d="m50 29 9 9-9 11-9-11Z" fill="#9ce9ec" stroke="#ffffff" stroke-width="2"/><circle cx="28" cy="57" r="3" fill="#f38fb5"/><circle cx="72" cy="57" r="3" fill="#f38fb5"/></svg></span><span class="rank-gold-dust" aria-hidden="true">✦ ⋆ ✧ ⋆ ✦</span><span class="royal-decoration" aria-hidden="true"><span>✧</span><span>✦</span><span>✧</span></span><span class="royal-particles" aria-hidden="true"><span class="lux-spark lux-spark-1" aria-hidden="true"></span><span class="lux-spark lux-spark-2" aria-hidden="true"></span><span class="lux-spark lux-spark-3" aria-hidden="true"></span><span class="lux-spark lux-spark-4" aria-hidden="true"></span><span class="lux-spark lux-spark-5" aria-hidden="true"></span><span class="lux-spark lux-spark-6" aria-hidden="true"></span><span class="lux-spark lux-spark-7" aria-hidden="true"></span><span class="lux-spark lux-spark-8" aria-hidden="true"></span><span class="lux-spark lux-spark-9" aria-hidden="true"></span></span>',
    5: "<span class=\"astral-backdrop\" aria-hidden=\"true\"></span><span class=\"astral-aurora\" aria-hidden=\"true\"></span><span class=\"rank-cosmic-halo\" aria-hidden=\"true\"></span><span class=\"astral-prism-ring\" aria-hidden=\"true\"></span><span class=\"legend-seal\" aria-hidden=\"true\"><svg class=\"legend-seal-svg\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 320\" aria-hidden=\"true\" focusable=\"false\">\n <defs><linearGradient id=\"ls-ring\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#fff9d4\"/><stop offset=\".28\" stop-color=\"#a6eafd\"/><stop offset=\".58\" stop-color=\"#bf9bfd\"/><stop offset=\".82\" stop-color=\"#f9b6ed\"/><stop offset=\"1\" stop-color=\"#fff3c5\"/></linearGradient></defs>\n <circle cx=\"160\" cy=\"160\" r=\"119\" fill=\"none\" stroke=\"url(#ls-ring)\" stroke-width=\"2\" opacity=\".86\"/>\n <circle cx=\"160\" cy=\"160\" r=\"110\" fill=\"none\" stroke=\"#fff9e8\" stroke-width=\"1.1\" stroke-dasharray=\"2 9\" opacity=\".9\"/>\n <circle cx=\"160\" cy=\"160\" r=\"133\" fill=\"none\" stroke=\"#eac9ff\" stroke-width=\".9\" stroke-dasharray=\"16 15\" opacity=\".7\"/>\n <path d=\"M160 13V38 M160 282v25 M13 160h25 M282 160h25 M60 60l17 17 M243 243l17 17 M260 60l-17 17 M77 243l-17 17\" stroke=\"url(#ls-ring)\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n <g fill=\"#fff6ce\" stroke=\"#d5b3ff\" stroke-width=\"1\">\n <path d=\"m160 28 5 13-5 13-5-13Z\"/><path d=\"m160 266 5 13-5 13-5-13Z\"/>\n <path d=\"m28 160 13 5 13-5-13-5Z\"/><path d=\"m266 160 13 5 13-5-13-5Z\"/>\n </g>\n <path d=\"M55 112 71 92 91 104 111 79 M237 89l20 16-8 22 17 13 M65 222l23 15 23-9 M223 241l16-15 18 11\" stroke=\"#fff\" stroke-width=\"1.5\" fill=\"none\" opacity=\".8\"/>\n <g fill=\"#fff\"><circle cx=\"55\" cy=\"112\" r=\"3\"/><circle cx=\"71\" cy=\"92\" r=\"3.6\"/><circle cx=\"91\" cy=\"104\" r=\"2.4\"/><circle cx=\"111\" cy=\"79\" r=\"3\"/><circle cx=\"237\" cy=\"89\" r=\"3\"/><circle cx=\"257\" cy=\"105\" r=\"2.8\"/><circle cx=\"249\" cy=\"127\" r=\"2.4\"/><circle cx=\"266\" cy=\"140\" r=\"3\"/><circle cx=\"65\" cy=\"222\" r=\"3\"/><circle cx=\"88\" cy=\"237\" r=\"3.6\"/><circle cx=\"111\" cy=\"228\" r=\"2.3\"/><circle cx=\"223\" cy=\"241\" r=\"3\"/><circle cx=\"239\" cy=\"226\" r=\"3\"/><circle cx=\"257\" cy=\"237\" r=\"3.4\"/></g>\n </svg></span><span class=\"legend-comets\" aria-hidden=\"true\"><svg class=\"legend-comets-svg\" viewBox=\"0 0 320 310\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\" focusable=\"false\">\n <defs><linearGradient id=\"lc-left\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#fff\" stop-opacity=\"0\"/><stop offset=\".47\" stop-color=\"#92e6ff\" stop-opacity=\".67\"/><stop offset=\"1\" stop-color=\"#fbd5ff\" stop-opacity=\"0\"/></linearGradient>\n <linearGradient id=\"lc-right\" x1=\"1\" y1=\"0\" x2=\"0\" y2=\"1\"><stop stop-color=\"#fff\" stop-opacity=\"0\"/><stop offset=\".55\" stop-color=\"#edd0ff\" stop-opacity=\".85\"/><stop offset=\"1\" stop-color=\"#fdf5a3\" stop-opacity=\"0\"/></linearGradient></defs>\n <path d=\"M30 105Q1 165 58 227 Q24 199 41 171Q19 181 22 204Q-19 155 30 105Z\" fill=\"url(#lc-left)\"/>\n <path d=\"M290 99Q321 165 264 224Q296 197 280 167Q303 183 299 205Q342 145 290 99Z\" fill=\"url(#lc-right)\"/>\n <path d=\"M47 86 Q17 134 31 178 M270 86 Q305 145 285 189\" stroke=\"#fff\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" opacity=\".75\"/>\n </svg></span><span class=\"rank-orbit orbit-a\" aria-hidden=\"true\"></span><span class=\"rank-orbit orbit-b\" aria-hidden=\"true\"></span><span class=\"legend-star legend-star-one\" aria-hidden=\"true\">✦</span><span class=\"legend-star legend-star-two\" aria-hidden=\"true\">✧</span><span class=\"legend-star legend-star-three\" aria-hidden=\"true\">✦</span><span class=\"legend-diadem\" aria-hidden=\"true\"><svg class=\"legend-diadem-svg\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 168 110\" aria-hidden=\"true\" focusable=\"false\">\n <defs>\n  <linearGradient id=\"ld-rim\" x1=\"0\" y1=\"0\" x2=\".8\" y2=\"1\"><stop stop-color=\"#fff9d7\"/><stop offset=\".28\" stop-color=\"#fbe5a4\"/><stop offset=\".55\" stop-color=\"#caacff\"/><stop offset=\".8\" stop-color=\"#9deaff\"/><stop offset=\"1\" stop-color=\"#fff6cb\"/></linearGradient>\n  <linearGradient id=\"ld-panel\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#fffef3\"/><stop offset=\".37\" stop-color=\"#f0e0ff\"/><stop offset=\".64\" stop-color=\"#9dceff\"/><stop offset=\"1\" stop-color=\"#c8a0f7\"/></linearGradient>\n  <linearGradient id=\"ld-jewel\" x1=\".1\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#fff\"/><stop offset=\".24\" stop-color=\"#c2fcff\"/><stop offset=\".53\" stop-color=\"#77bfff\"/><stop offset=\".76\" stop-color=\"#b9a4ff\"/><stop offset=\"1\" stop-color=\"#f2c4ff\"/></linearGradient>\n  <filter id=\"ld-shine\"><feGaussianBlur stdDeviation=\"2.5\"/></filter>\n </defs>\n <g opacity=\".82\" fill=\"#fffbec\"><circle cx=\"24\" cy=\"37\" r=\"3\"/><circle cx=\"146\" cy=\"37\" r=\"3\"/><circle cx=\"83\" cy=\"12\" r=\"3.5\"/></g>\n <path d=\"M26 72 16 34 53 55 84 14 115 55 152 34 141 72 Q84 91 26 72Z\" fill=\"url(#ld-panel)\" stroke=\"#6968a0\" stroke-width=\"4\" stroke-linejoin=\"round\"/>\n <path d=\"M26 72 16 34 53 55 84 14 115 55 152 34 141 72\" fill=\"none\" stroke=\"url(#ld-rim)\" stroke-width=\"7\" stroke-linejoin=\"round\"/>\n <path d=\"M32 64 28 45 54 61 84 27 114 61 140 45 136 64\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.1\" stroke-linecap=\"round\" opacity=\".85\"/>\n <path d=\"M24 72 Q84 93 144 72 L141 88 Q84 106 27 88Z\" fill=\"url(#ld-rim)\" stroke=\"#68609a\" stroke-width=\"3.6\" stroke-linejoin=\"round\"/>\n <path d=\"M28 83 Q84 99 140 83\" fill=\"none\" stroke=\"#fffdf4\" stroke-width=\"2.3\" opacity=\".95\"/>\n <path d=\"M84 24 102 51 84 76 66 51Z\" fill=\"url(#ld-jewel)\" stroke=\"#fff\" stroke-width=\"3.5\"/>\n <path d=\"M84 27 89 49 84 71 79 49Z\" fill=\"#fff\" opacity=\".72\"/><path d=\"M70 52 84 46 98 52\" stroke=\"#fff\" stroke-width=\"2.3\" fill=\"none\" opacity=\".72\"/>\n <g fill=\"#fffce8\" stroke=\"#e8bb77\" stroke-width=\"1.7\"><circle cx=\"18\" cy=\"34\" r=\"5.5\"/><circle cx=\"151\" cy=\"34\" r=\"5.5\"/></g>\n <g fill=\"#fff\" stroke=\"#bda0ff\" stroke-width=\"1\"><circle cx=\"51\" cy=\"78\" r=\"3.5\"/><circle cx=\"117\" cy=\"78\" r=\"3.5\"/><circle cx=\"38\" cy=\"81\" r=\"2\"/><circle cx=\"130\" cy=\"81\" r=\"2\"/></g>\n <path d=\"M84 1 87 10 97 13 87 17 84 27 80 17 71 13 80 10Z\" fill=\"#fff4cb\" stroke=\"#f4d1a0\" stroke-width=\"1.3\"/>\n <path d=\"M44 28 46 35 53 38 46 41 44 48 41 41 34 38 41 35Z M123 28 125 35 132 38 125 41 123 48 120 41 113 38 120 35Z\" fill=\"#fff\" opacity=\".9\"/>\n </svg></span><span class=\"astral-pocket-jewel legend-jewel\" aria-hidden=\"true\"><span class=\"legend-jewel-core\">✧</span></span><span class=\"legend-pocket-light\" aria-hidden=\"true\"></span><span class=\"legend-twinkles\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>"
  };
  return bow + byLevel[level];
}

function mascotArt(partnerKey=state.partner, level=state.rank, mood='normal') {
  const key = FINAL_MASCOT_ART[partnerKey] ? partnerKey : 'kun';
  const safeLevel = Math.max(1, Math.min(5, Number(level) || 1));
  const allowed=['normal','talk','grin','sleepy','happy','surprise','excited','sad','wink','thinking'];
  const moodClass=allowed.includes(mood)?mood:'normal';
  const item=SHOP_ITEMS.find(x=>x.id===state.equippedAccessory);
  const accessory=item&&item.type==='accessory'
    ? `<span class="equipped-accessory accessory-${item.id}" aria-hidden="true">${item.emoji}</span>`
    : '';
  return `<span class="mascot-art rank-${safeLevel} mood-${moodClass}" data-partner="${key}">
    <img class="mascot-final-img" src="${mascotSource(key,moodClass)}" alt="">
    ${rankFlair(safeLevel, key)}
    ${accessory}
    <span class="mascot-glow" aria-hidden="true"></span>
  </span>`;
}

function renderMascots(){
  function update(el,partner,level,mood){
    const renderKey=[partner,level,mood,state.equippedAccessory||''].join('|');
    if(el.dataset.smapoRenderKey===renderKey&&el.querySelector('.mascot-art'))return;
    el.innerHTML=`<span class="mascot-motion-stage">${mascotArt(partner,level,mood)}</span>`;
    el.dataset.smapoRenderKey=renderKey;
  }
  document.querySelectorAll('[data-preview-partner]').forEach(el=>update(el,el.dataset.previewPartner,1,'normal'));
  document.querySelectorAll('[data-mascot]').forEach(el=>{
    const kind=el.dataset.mascot;
    const level=kind==='next'?Math.min(5,state.rank+1):state.rank;
    update(el,state.partner,level,kind==='main'?currentHomeMood:'normal');
  });
}
function speak(category='tap'){
  const level=state.rank,pool=QUOTES[state.partner][level]||QUOTES.kun[1];
  const text=category==='greeting'||category==='ambient'?contextualGreeting():rand(pool);
  const el=document.getElementById('homeSpeech');if(el)el.textContent=text;return text;
}

const DAILY_GOALS=[
  {id:'record',emoji:'🎒',name:'今日を記録しよう',desc:'チェック・出ない日・正直申告のどれか',target:1,reward:20},
  {id:'walk500',emoji:'👟',name:'500m歩こう',desc:'今日のウォーキング合計',target:500,reward:30},
  {id:'prep',emoji:'🌙',name:'明日の準備をしよう',desc:'あしたの自分貯金を完了',target:1,reward:40}
];
const WEEKLY_GOALS=[
  {id:'check3',emoji:'✅',name:'チェックを3日達成',desc:'月〜日の持ち物チェック',target:3,reward:100},
  {id:'walk5000',emoji:'👟',name:'合計5,000m歩こう',desc:'今週のウォーキング',target:5000,reward:150},
  {id:'prep3',emoji:'🌙',name:'明日の準備を3日',desc:'夜の準備を続けよう',target:3,reward:100}
];

let historyMonthCursor=new Date(gameNow().getFullYear(),gameNow().getMonth(),1);
let selectedHistoryDate=TODAY();
let sessionVisitGap=0;
let sessionWelcomeUsed=false;
let reminderTimer=null;

function parseDateKey(key){
  const m=String(key||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):null;
}
function addDaysKey(key,days){const d=parseDateKey(key)||new Date();d.setDate(d.getDate()+days);return localDateKey(d)}
function weekStartKey(key=TODAY()){const d=parseDateKey(key)||new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return localDateKey(d)}
function weekKeys(key=TODAY()){const start=weekStartKey(key);return Array.from({length:7},(_,i)=>addDaysKey(start,i))}
function getDayRecord(key=TODAY(),create=false){
  state.history=state.history&&typeof state.history==='object'?state.history:{};
  if(!state.history[key]&&create)state.history[key]={action:'',walkMeters:0,trustEarned:0,coinsEarned:0,coinsSpent:0,tomorrowPrepared:false,gachaPulls:0,login:false};
  return state.history[key]||{action:'',walkMeters:0,trustEarned:0,coinsEarned:0,coinsSpent:0,tomorrowPrepared:false,gachaPulls:0,login:false};
}
function recordHistory(patch,key=TODAY()){
  const r=getDayRecord(key,true);
  Object.entries(patch||{}).forEach(([k,v])=>{
    if(['walkMeters','trustEarned','trustLost','coinsEarned','coinsSpent','gachaPulls'].includes(k))r[k]=Math.max(0,(Number(r[k])||0)+(Number(v)||0));
    else r[k]=v;
  });
  return r;
}
function syncTodayHistoryFromState(){
  const r=getDayRecord(TODAY(),true),chosen=getTodayAltAction();
  if(!r.action){
    if(isCheckCompletedToday())r.action='check';
    else if(chosen==='no-outing')r.action='no-outing';
    else if(chosen==='honest')r.action='honest';
  }
  r.walkMeters=Math.max(Number(r.walkMeters)||0,Number(state.walkMeters)||0);
  if(state.nightBonus&&state.nightBonusDate===tomorrowDate())r.tomorrowPrepared=true;
  if(state.lastLoginDate===TODAY())r.login=true;
}
function pruneHistory(maxDays=400){
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-maxDays);
  Object.keys(state.history||{}).forEach(k=>{const d=parseDateKey(k);if(!d||d<cutoff)delete state.history[k]});
}
function actionLabel(action){return {check:'✅ チェック完了','no-outing':'🏠 出ない日','honest':'♡ 正直申告'}[action]||'未記録'}
function actionRecordLabel(record){return record.action==='honest'?(record.honestOutcome==='minus'?'♡ 正直申告（減点回）':'♡ 正直申告（加点回）'):actionLabel(record.action)}
function signedTrust(record){const v=Math.round((Number(record.trustEarned)||0)-(Number(record.trustLost)||0));return (v>0?'+':'')+v+'pt'}
function actionShort(action){return {check:'✅','no-outing':'🏠',honest:'♡'}[action]||''}
function todayCompletionScore(r=getDayRecord()){return Number(!!r.action)+Number((r.walkMeters||0)>=500)+Number(!!r.tomorrowPrepared)+Number((r.trustEarned||0)>0)}
function dailyGoalProgress(id){const r=getDayRecord();if(id==='record')return r.action?1:0;if(id==='walk500')return Math.round(r.walkMeters||0);if(id==='prep')return r.tomorrowPrepared?1:0;return 0}
function weeklyGoalProgress(id){
  const rows=weekKeys().map(k=>getDayRecord(k));
  if(id==='check3')return rows.filter(r=>r.action==='check').length;
  if(id==='walk5000')return Math.round(rows.reduce((s,r)=>s+(Number(r.walkMeters)||0),0));
  if(id==='prep3')return rows.filter(r=>r.tomorrowPrepared).length;
  return 0;
}
function missionClaimed(scope,id){
  const bucket=scope==='daily'?TODAY():weekStartKey(),list=state.missionClaims?.[scope]?.[bucket];
  return Array.isArray(list)&&list.includes(id);
}
function claimGoalMission(scope,id){
  const defs=scope==='daily'?DAILY_GOALS:WEEKLY_GOALS,def=defs.find(x=>x.id===id);if(!def)return;
  const progress=scope==='daily'?dailyGoalProgress(id):weeklyGoalProgress(id);
  if(progress<def.target)return toast('まだ達成していないよ');
  if(missionClaimed(scope,id))return toast('報酬は受け取り済みだよ');
  const bucket=scope==='daily'?TODAY():weekStartKey();
  state.missionClaims[scope][bucket]=Array.isArray(state.missionClaims[scope][bucket])?state.missionClaims[scope][bucket]:[];
  state.missionClaims[scope][bucket].push(id);
  state.coins+=def.reward;state.totalCoinsEarned=(state.totalCoinsEarned||0)+def.reward;recordHistory({coinsEarned:def.reward});
  saveState();renderAll();rewardBurst(`ミッション +${def.reward}コイン`,def.emoji,'achievement');mascotReaction(`${def.name}、達成おめでとう！`,def.emoji,'happy');
}
function renderGoalMissionList(targetId,scope,defs){
  const box=document.getElementById(targetId);if(!box)return;
  box.innerHTML=defs.map(def=>{
    const p=scope==='daily'?dailyGoalProgress(def.id):weeklyGoalProgress(def.id),pct=Math.min(100,p/def.target*100),claimed=missionClaimed(scope,def.id),done=p>=def.target;
    const display=def.target>=500?`${Math.min(p,def.target).toLocaleString()} / ${def.target.toLocaleString()}`:`${Math.min(p,def.target)} / ${def.target}`;
    return `<article class="goal-mission ${done?'done':''}"><span class="goal-icon">${claimed?'✅':def.emoji}</span><div class="goal-copy"><b>${def.name}</b><small>${def.desc}</small><div class="meter"><i style="width:${pct}%"></i></div><em>${display}</em></div><button type="button" data-claim-goal="${scope}:${def.id}" ${!done||claimed?'disabled':''}>${claimed?'GET':`+${def.reward}`}</button></article>`;
  }).join('');
  box.querySelectorAll('[data-claim-goal]').forEach(b=>b.onclick=()=>{const [s,id]=b.dataset.claimGoal.split(':');claimGoalMission(s,id)});
}
function renderSummary(){
  const r=getDayRecord(),score=todayCompletionScore(r),scoreEl=document.getElementById('summaryScore');if(!scoreEl)return;
  scoreEl.textContent=`${score}/4`;
  document.getElementById('summaryDateLabel').textContent=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short'}).format(gameNow());
  document.getElementById('summaryAction').textContent=actionRecordLabel(r);
  document.getElementById('summaryWalk').textContent=`${Math.round(r.walkMeters||0).toLocaleString()}m`;
  document.getElementById('summaryTrustEarned').textContent=signedTrust(r);
  document.getElementById('summaryPrep').textContent=r.tomorrowPrepared?'準備済み ✓':'まだ';
  document.getElementById('summaryCoinsEarned').textContent=`+${Math.round(r.coinsEarned||0)}`;
  document.getElementById('summaryCoinsSpent').textContent=`-${Math.round(r.coinsSpent||0)}`;
  document.getElementById('summaryGachaPulls').textContent=Math.round(r.gachaPulls||0);
  const title=document.getElementById('summaryPartnerTitle'),text=document.getElementById('summaryPartnerText');
  if(score>=4){title.textContent='今日はすごく充実した1日！';text.textContent='チェックも歩くことも明日の準備もできたね。ゆっくり休もう！'}
  else if(score>=2){title.textContent='今日もちゃんと前に進めたね！';text.textContent='できたことは十分えらいよ。残りは無理せずできるときに。'}
  else if(r.action){title.textContent='今日の記録、できてるよ！';text.textContent='ひとつ記録できただけでも大事な積み重ねだよ。'}
  else{title.textContent='今日もいっしょに始めよう！';text.textContent='まずは持ち物チェックか、今日の予定を記録してみよう。'}
  renderGoalMissionList('dailyGoalMissions','daily',DAILY_GOALS);renderGoalMissionList('weeklyGoalMissions','weekly',WEEKLY_GOALS);
  const wk=weekKeys(),a=parseDateKey(wk[0]),b=parseDateKey(wk[6]),wl=document.getElementById('weeklyRangeLabel');if(wl)wl.textContent=`${a.getMonth()+1}/${a.getDate()}〜${b.getMonth()+1}/${b.getDate()}`;
}
function renderHistory(){
  const grid=document.getElementById('calendarGrid');if(!grid)return;
  const y=historyMonthCursor.getFullYear(),m=historyMonthCursor.getMonth(),first=new Date(y,m,1),lastDay=new Date(y,m+1,0).getDate();
  document.getElementById('calendarTitle').textContent=`${y}年 ${m+1}月`;document.getElementById('historyMonthMini').textContent=`${m+1}月`;
  const cells=[];for(let i=0;i<(first.getDay()+6)%7;i++)cells.push('<span class="calendar-empty"></span>');
  for(let d=1;d<=lastDay;d++){
    const key=localDateKey(new Date(y,m,d)),r=getDayRecord(key),marks=[actionShort(r.action),(r.walkMeters||0)>=100?'👟':'',r.tomorrowPrepared?'🌙':''].filter(Boolean).slice(0,3).join('');
    cells.push(`<button type="button" class="calendar-day ${key===TODAY()?'today':''} ${key===selectedHistoryDate?'selected':''} ${r.action||r.walkMeters||r.tomorrowPrepared?'has-record':''}" data-history-date="${key}"><b>${d}</b><small>${marks}</small></button>`);
  }
  grid.innerHTML=cells.join('');grid.querySelectorAll('[data-history-date]').forEach(b=>b.onclick=()=>{selectedHistoryDate=b.dataset.historyDate;renderHistory()});renderHistoryDetail();
}
function renderHistoryDetail(){
  const r=getDayRecord(selectedHistoryDate),d=parseDateKey(selectedHistoryDate)||new Date();
  document.getElementById('historyDetailDate').textContent=new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(d);
  document.getElementById('historyDetailIcon').textContent=actionShort(r.action)||((r.walkMeters||0)>0?'👟':'📖');
  document.getElementById('historyDetailTitle').textContent=r.action?actionRecordLabel(r):((r.walkMeters||0)>0?'ウォーキング記録':'記録なし');
  document.getElementById('historyDetailAction').textContent=actionRecordLabel(r);document.getElementById('historyDetailWalk').textContent=`${Math.round(r.walkMeters||0).toLocaleString()}m`;
  document.getElementById('historyDetailTrust').textContent=signedTrust(r);document.getElementById('historyDetailCoins').textContent=`+${Math.round(r.coinsEarned||0)} / -${Math.round(r.coinsSpent||0)}`;
  document.getElementById('historyDetailPrep').textContent=r.tomorrowPrepared?'準備済み':'—';document.getElementById('historyDetailGacha').textContent=`${Math.round(r.gachaPulls||0)}回`;
}
function registerVisit(){
  const today=TODAY(),prev=state.lastVisitDate;sessionVisitGap=prev&&prev!==today?daysBetween(prev,today):0;
  if(prev!==today){state.partnerDays=(state.partnerDays||0)+1;state.lastVisitDate=today;saveState()}
}
function seasonPhrase(){
  const m=new Date().getMonth()+1;
  if([3,4,5].includes(m))return '春の空気、気持ちいいね。';
  if([6,7,8].includes(m))return '暑い日は無理せずゆっくりいこう。';
  if([9,10,11].includes(m))return '秋のおでかけも楽しみだね。';
  return 'あったかくして出かけようね。';
}
function contextualGreeting(){
  const h=new Date().getHours(),pool=QUOTES[state.partner][state.rank]||QUOTES.kun[1];
  if(sessionVisitGap>=2&&!sessionWelcomeUsed){sessionWelcomeUsed=true;return `おかえり！ ${sessionVisitGap}日ぶりだね。${pool[0]}`;}
  if(isCheckCompletedToday())return `今日の準備はもうばっちり！ ${pool[1]}`;
  const alt=getTodayAltAction();if(alt==='no-outing')return '今日はおうちの日だね。のんびり過ごそう！';if(alt==='honest')return '正直に教えてくれてありがとう。次はいっしょに気をつけよう！';
  if(h<10)return `おはよう！ ${pool[0]}`;if(h<17)return `こんにちは！ ${seasonPhrase()}`;if(h<21)return `おつかれさま！ ${pool[1]}`;
  return state.nightBonus&&state.nightBonusDate===tomorrowDate()?'明日の準備もできてるね。おやすみ！':'そろそろ明日の準備もしておく？';
}
function renderPartnerBond(){
  const el=document.getElementById('partnerDays');if(!el)return;el.textContent=Math.max(1,state.partnerDays||1);
  const p=document.getElementById('partnerBondText'),days=state.partnerDays||0,checks=state.checkCompletions||0;
  p.textContent=checks>=20?'もう息ぴったりの相棒！':days>=14?'毎日の習慣が少しずつできてきたね。':days>=5?'いっしょに過ごす日が増えてきた！':'これから思い出を増やしていこう。';
}
function hhmmNow(){const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function reminderDue(time){
 if(!/^\d{2}:\d{2}$/.test(time||''))return false;
 const [hour,min]=time.split(':').map(Number);if(hour>23||min>59)return false;
 const now=new Date(),elapsed=now.getHours()*60+now.getMinutes()-(hour*60+min);
 return elapsed>=0&&elapsed<=20;
}
async function browserNotify(title,body){
  if(!state.reminders?.browserEnabled||typeof Notification==='undefined'||Notification.permission!=='granted')return;
  try{
    if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
      const reg=await navigator.serviceWorker.getRegistration().catch(()=>null);if(reg){await reg.showNotification(title,{body,tag:'sumapokke-reminder'});return}
    }
    const note=new Notification(title,{body});note.onclick=()=>{try{window.focus();go('check')}catch{}};
  }catch(e){console.warn('notification',e)}
}
function showInAppReminder(kind,body){
  const bar=document.getElementById('v321ReminderBanner');
  const msg=document.getElementById('v321ReminderText');
  const action=document.getElementById('v321ReminderAction');
  if(!bar||!msg||!action)return;
  msg.textContent=body;
  action.textContent=kind==='morning'?'今日の持ち物を確認':'明日の準備へ';
  action.dataset.target=kind==='morning'?'check':'tomorrow';
  bar.hidden=false;
}
function closeInAppReminder(){const bar=document.getElementById('v321ReminderBanner');if(bar)bar.hidden=true}
function sendReminder(kind){
  const morning=kind==='morning',title=morning?'🎒 すまぽっけ：朝のチェック':'🌙 すまぽっけ：明日の準備';
  const priority=forgetStats()[0],related=priority&&state.items.some(i=>forgetKey(i.name)===forgetKey(priority.name));
  const body=morning?(related?`出発前に「${priority.name}」を優先して確認しよう。${PARTNERS[state.partner].name}も応援してるよ。`:`${PARTNERS[state.partner].name}が待ってるよ。出発前に持ち物を確認しよう！`):'明日の持ち物を準備して、明日の自分を少し助けよう。';
  showInAppReminder(kind,body);toast(body);mascotReaction(body,morning?'🎒':'🌙',morning?'happy':'sleepy');void browserNotify(title,body);
}
function checkReminderTick(){
  if(document.hidden)return;
  if(IS_DEV_MODE)return; // simulated dates must never trigger real-device reminders
  if(!document.hidden&&TODAY()!==lastUiDay){refreshOnReturn();return}
  const r=state.reminders||defaultState().reminders,today=TODAY();
  if(r.morningEnabled&&r.lastMorningDate!==today&&reminderDue(r.morningTime)&&!isCheckCompletedToday()&&!getTodayAltAction()){r.lastMorningDate=today;sendReminder('morning');saveState()}
  const prepared=state.nightBonus&&state.nightBonusDate===tomorrowDate();
  if(r.nightEnabled&&r.lastNightDate!==today&&reminderDue(r.nightTime)&&!prepared){r.lastNightDate=today;sendReminder('night');saveState()}
  // Late arrival: show an in-app reminder without falsely sending a scheduled device notification.
  const late=which=>{
    const value=which==='morning'?r.morningTime:r.nightTime;
    if(!/^\d{2}:\d{2}$/.test(value||''))return false;
    const [hour,minute]=value.split(':').map(Number);if(hour>23||minute>59)return false;
    const now=new Date(),diff=now.getHours()*60+now.getMinutes()-(hour*60+minute);
    return diff>20&&diff<=240;
  };
  if(r.morningEnabled&&r.lastMorningDate!==today&&late('morning')&&!isCheckCompletedToday()&&!getTodayAltAction()){
    r.lastMorningDate=today;showInAppReminder('morning','朝のお知らせ時刻を過ぎたよ。今からでも持ち物を確認しよう！（アプリ内の案内です）');saveState();
  }else if(r.nightEnabled&&r.lastNightDate!==today&&late('night')&&!prepared){
    r.lastNightDate=today;showInAppReminder('night','夜のお知らせ時刻を過ぎたよ。明日の持ち物を確認しよう！（アプリ内の案内です）');saveState();
  }
}
function startReminderScheduler(){if(reminderTimer)clearInterval(reminderTimer);reminderTimer=setInterval(checkReminderTick,60000);setTimeout(checkReminderTick,1200)}
function previewReminder(){
  const body='テスト表示だよ。出発前に持ち物を一つずつ確認しよう！';
  toast('🔔 '+body);
  showModal('🔔 お知らせのテスト',`<div class="today-notice"><p>${escapeHTML(body)}</p><small>これはテストです。今日の通知済み記録は変更しません。</small><p>ブラウザ通知は許可があり、アプリが開いているときのみ利用できます。</p></div>`,{icon:'🎒',actions:[{label:'持ち物を確認',primary:true,onClick:()=>go('check')},{label:'閉じる'}]});
  if(state.reminders.browserEnabled&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
    void browserNotify('🎒 すまぽっけ：テスト通知',body);
  }
}
function renderReminderHelp(){
  const el=document.getElementById('v321ReminderHelp');if(!el)return;
  const r=state.reminders||{};
  const active=[];
  if(r.morningEnabled)active.push(`朝 ${r.morningTime||'07:30'}`);
  if(r.nightEnabled)active.push(`夜 ${r.nightTime||'21:00'}`);
  const permitted=typeof Notification!=='undefined'&&Notification.permission==='granted'&&r.browserEnabled;
  el.textContent=(active.length?`設定中：${active.join('・')}。`:'通知時刻はどちらもOFFです。')+` ${permitted?'端末の通知も利用できます。':'アプリ内のお知らせのみ。端末通知には許可が必要です。'} アプリが動作中なら設定時刻から20分以内にお知らせ。4時間以内の見逃しはアプリ内で再案内します。閉じた状態では通知できません。`;
}
async function requestNotificationPermission(){
  if(typeof Notification==='undefined')return toast('このブラウザは通知に対応していないよ');
  if(!window.isSecureContext&&location.protocol!=='file:')return toast('通知はHTTPSまたはlocalhostで使ってね');
  try{const result=await Notification.requestPermission();state.reminders.browserEnabled=result==='granted';saveState();renderSettings();toast(result==='granted'?'ブラウザ通知をONにしたよ':'通知は許可されませんでした')}catch{toast('通知設定を開けませんでした')}
}
const FONT_STEP_NAMES=['小さめ','標準','大きめ','特大','最大'];
function applyFontPreferences(){
  const shell=document.getElementById('appShell');if(!shell)return;
  const step=Number.isFinite(Number(state.fontStep))?Math.max(0,Math.min(4,Math.round(Number(state.fontStep)))):1;
  state.fontStep=step;
  shell.dataset.textSize=String(step);
  shell.dataset.highContrast=state.highContrast?'true':'false';
  const range=document.getElementById('fontSizeRange');
  if(range){range.value=String(step);range.setAttribute('aria-valuetext',FONT_STEP_NAMES[step]);}
  const label=document.getElementById('fontSizeValue');if(label)label.textContent=FONT_STEP_NAMES[step];
  const minus=document.getElementById('fontSizeMinus'),plus=document.getElementById('fontSizePlus');
  if(minus)minus.disabled=step===0;if(plus)plus.disabled=step===4;
  const contrast=document.getElementById('contrastToggle');if(contrast)contrast.checked=!!state.highContrast;
}
function chooseFontStep(raw){
  const num=Number(raw);if(!Number.isFinite(num))return;
  const next=Math.max(0,Math.min(4,Math.round(num)));
  if(state.fontStep===next)return;
  state.fontStep=next;applyFontPreferences();saveState();
}
function openFontSettings(){
  go('settings');
  document.getElementById('fontSettingPanel')?.scrollIntoView({block:'start',behavior:state.reducedMotion?'instant':'smooth'});
  document.getElementById('fontSizeRange')?.focus({preventScroll:true});
}

// V33.3: Companion motion starts ON, independently of the home controls.
// The saved OFF preference is respected. Only the mascot wrapper is forced ON;
// the other animations can still be reduced from the Settings page.
function mascotMotionEnabled(){
  if(state.mascotMotionMode==='on')return true;
  if(state.mascotMotionMode==='off')return false;
  return !state.reducedMotion&&!state.powerSaving&&!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}
function syncMascotMotion(){
  const shell=document.getElementById('appShell');if(!shell)return;
  const enabled=mascotMotionEnabled();
  shell.classList.toggle('mascot-motion-on',state.mascotMotionMode==='on');
  shell.classList.toggle('mascot-motion-off',!enabled);
  const checkbox=document.getElementById('mascotMotionToggle');
  if(checkbox)checkbox.checked=enabled;
}
// The partner-motion setting lives in Settings; the home screen remains uncluttered.
window.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener?.('change',syncMascotMotion);

function renderSettings(){
  const shell=document.getElementById('appShell');if(!shell)return;shell.classList.toggle('reduce-motion',!!state.reducedMotion);shell.classList.toggle('power-saving',!!state.powerSaving);syncMascotMotion();
  applyFontPreferences();
  const motion=document.getElementById('motionState'),power=document.getElementById('powerState');if(motion)motion.textContent=state.reducedMotion?'ON':'OFF';if(power)power.textContent=state.powerSaving?'ON':'OFF';
  const mr=document.getElementById('morningReminderToggle'),nr=document.getElementById('nightReminderToggle'),mt=document.getElementById('morningReminderTime'),nt=document.getElementById('nightReminderTime');
  if(mr)mr.checked=!!state.reminders.morningEnabled;if(nr)nr.checked=!!state.reminders.nightEnabled;if(mt)mt.value=state.reminders.morningTime||'07:30';if(nt)nt.value=state.reminders.nightTime||'21:00';
  const ns=document.getElementById('notificationState');if(ns)ns.textContent=typeof Notification==='undefined'?'非対応':Notification.permission==='granted'&&state.reminders.browserEnabled?'ON':Notification.permission==='denied'?'拒否':'OFF';renderReminderHelp();
  const bm=document.getElementById('backupMeta');if(bm)bm.textContent=state.lastBackupAt?new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(state.lastBackupAt)):'まだありません';
}
function showTodayNotice(){
  const r=getDayRecord(),prepared=state.nightBonus&&state.nightBonusDate===tomorrowDate();
  showModal('今日のお知らせ',`<div class="today-notice"><p><b>${actionLabel(r.action)}</b></p><p>👟 ${Math.round(r.walkMeters||0).toLocaleString()}m　🌙 ${prepared?'明日の準備済み':'明日の準備はまだ'}</p><small>朝 ${state.reminders.morningEnabled?state.reminders.morningTime+' ON':'OFF'} / 夜 ${state.reminders.nightEnabled?state.reminders.nightTime+' ON':'OFF'}</small></div>`,{icon:'🔔',actions:[{label:'今日のまとめ',primary:true,onClick:()=>go('summary')}]});
}
function normalizeDaily(){
  const today=TODAY();let changed=false;
  if(state.walkDate!==today){state.walkMeters=0;state.walkDate=today;state.claimedWalkMissions=[];state.walkRewardedStages=[];state.walkBonusPointsToday=0;state.walkCoinRewardSchema=3;changed=true}
  if(state.itemsDate!==today){
    if(state.nightBonus&&state.nightBonusDate===today&&state.lastPreparedAppliedDate!==today){
      state.items=state.tomorrowItems.map(x=>({...x,checked:false}));state.lastPreparedAppliedDate=today;state.tomorrowItems=state.items.map(x=>({...x,checked:false}));state.activeSetToday=state.activeSetTomorrow;
    }else state.items=state.items.map(x=>({...x,checked:false}));
    state.itemsDate=today;changed=true;
  }
  syncTodayHistoryFromState();pruneHistory(400);if(changed)saveState();
}
function applyDailyLogin(){
  const today=TODAY();if(state.lastLoginDate===today)return false;
  const gap=daysBetween(state.lastLoginDate,today);state.loginStreak=gap===1?(state.loginStreak||0)+1:1;state.lastLoginDate=today;
  const bonus=Math.min(ECONOMY.loginCap,ECONOMY.loginBase+(state.loginStreak-1)*ECONOMY.loginStep);
  state.coins+=bonus;state.totalCoinsEarned=(state.totalCoinsEarned||0)+bonus;state._lastLoginBonus=bonus;recordHistory({login:true,coinsEarned:bonus});saveState();return true;
}
function claimWalkMissions(){
  const goals=ECONOMY.walkMilestones;state.claimedWalkMissions=Array.isArray(state.claimedWalkMissions)?state.claimedWalkMissions:[];let gained=0;
  for(const g of goals)if(state.walkMeters>=g.m&&!state.claimedWalkMissions.includes(g.m)){state.claimedWalkMissions.push(g.m);gained+=g.r}
  if(gained){state.coins+=gained;state.totalCoinsEarned=(state.totalCoinsEarned||0)+gained;recordHistory({coinsEarned:gained});saveState()}
  return gained;
}
function showRankUp(oldLevel,newLevel){
  
  const rank=RANKS[newLevel-1];
  rewardBurst(`Lv.${newLevel} ランクアップ！`,'⭐','rank');
  mascotReaction('わあ！新しいポッケになったよ！','⭐','surprise');
  showModal('ランクアップ！',`<div class="rankup-stage"><div class="rankup-rays"></div><div class="rankup-mascot">${mascotArt(state.partner,newLevel,'surprise')}</div><div class="rankup-level">Lv.${oldLevel} → Lv.${newLevel}</div><h3>${rank.name}</h3><p>${rank.message}</p></div>`,{icon:'⭐',actions:[{label:'やった！',primary:true}]});
}
function updateRank(show=false){const old=state.rank;state.rank=rankForTrust().level;if(state.rank!==old){saveState();if(show)showRankUp(old,state.rank)}}
function addPoints(basePt,baseCoins=basePt){
  let pointMult=rankForTrust().multiplier;
  if(state.nightBonus&&state.nightBonusDate===TODAY())pointMult*=1.5;
  if((state.inventory.boost||0)>0){pointMult*=1.5;state.inventory.boost--}
  const pt=Math.round(basePt*pointMult),coins=Math.max(0,Math.round(baseCoins));
  state.trust+=pt;state.coins+=coins;state.totalCoinsEarned=(state.totalCoinsEarned||0)+coins;recordHistory({trustEarned:pt,coinsEarned:coins});
  const old=state.rank;updateRank(false);saveState();renderAll();rewardBurst(`+${pt}pt  +${coins}コイン`,'✨');
  if(state.rank>old)setTimeout(()=>showRankUp(old,state.rank),450);unlockAchievements(true);return{pt,coins,mult:pointMult};
}
function renderAll(){normalizeDaily();weatherAutoSyncLists();updateRank(false);const r=rankForTrust(),n=nextRank(),prevThreshold=r.threshold,nextThreshold=n?n.threshold:r.threshold;const range=Math.max(1,nextThreshold-prevThreshold);const progress=n?Math.min(100,Math.max(0,(state.trust-prevThreshold)/range*100)):100;
  document.getElementById('appShell').dataset.theme=state.theme;document.getElementById('homeRankLevel').textContent=r.level;document.getElementById('homeRankName').textContent=r.name;
  const homePartnerPill=document.getElementById('homePartnerPill');
  if(homePartnerPill) homePartnerPill.textContent=PARTNERS[state.partner].name;document.getElementById('homeRankBar').style.width=`${progress}%`;document.getElementById('homeRankProgress').textContent=n?`${state.trust} / ${n.threshold}`:`${state.trust} / MAX`;document.getElementById('homeTrust').textContent=state.trust;document.getElementById('homeCoins').textContent=state.coins;document.getElementById('homeNextText').textContent=n?`あと ${Math.max(0,n.threshold-state.trust)}pt でLv.${n.level}`:'最高ランク達成！';
  const partnerNameHome=document.getElementById('partnerNameHome');
  const homeRankTag=document.getElementById('homeRankTag');
  const nextRankName=document.getElementById('nextRankName');
  const nextRankMessage=document.getElementById('nextRankMessage');
  if(partnerNameHome) partnerNameHome.textContent=PARTNERS[state.partner].name;
  if(homeRankTag) homeRankTag.textContent=`Lv.${r.level} ${r.name}`;
  if(nextRankName) nextRankName.textContent=n?n.name:'最高ランク！';
  if(nextRankMessage) nextRankMessage.textContent=n?n.message:'これからもずっといっしょ！';
  const checked=state.items.filter(x=>x.checked).length,total=state.items.length;document.getElementById('departureCount').textContent=`${checked}/${total}`;document.getElementById('checkHeroCounter').textContent=`${checked}/${total}`;document.getElementById('departureSub').textContent=total&&checked===total?'準備ばっちり！いってきます！':'忘れ物ゼロを目指そう！';const homeReadyTitle=document.getElementById('homeReadyTitle');
  const homeReadyText=document.getElementById('homeReadyText');
  if(homeReadyTitle) homeReadyTitle.textContent=total&&checked===total?'準備ばっちり！':'まだ準備中だよ';
  if(homeReadyText) homeReadyText.textContent=total&&checked===total?'今日も安心して出発できるね！':'今日も忘れ物しないように一緒にチェックしよう！';
  renderHomeTodos();renderCheckList();renderItemSets();renderCareSupport();renderTomorrowList();renderMissions();renderShop();renderGachaExtras();renderInventory();renderProfile();renderMascots();
  document.getElementById('shopCoins').textContent=state.coins;
  const medalEl=document.getElementById('gachaMedals');if(medalEl)medalEl.textContent=state.pocketMedals||0;
  document.getElementById('tomorrowBonusState').textContent=state.nightBonus&&state.nightBonusDate===tomorrowDate()?'予約済み':'未予約';
  const pity=document.getElementById('gachaPity');if(pity)pity.textContent=state.gachaPity>=9?'次の1回はSR以上確定！':`あと${10-(state.gachaPity||0)}回でSR以上確定`;
  const addTomorrowBtn=document.getElementById('addTomorrowBtn');
  if(addTomorrowBtn)addTomorrowBtn.disabled=!!(state.nightBonus&&state.nightBonusDate===tomorrowDate());
  const saveTomorrowBtn=document.getElementById('saveTomorrowBtn');
  if(saveTomorrowBtn){const reserved=state.nightBonus&&state.nightBonusDate===tomorrowDate();saveTomorrowBtn.disabled=reserved;saveTomorrowBtn.textContent=reserved?'✓ 明日の1.5倍ボーナス予約済み':'✨ 準備完了！1.5倍ボーナスを予約'}
  renderQuest();renderDailyChoiceButtons();renderSummary();renderHistory();renderPartnerBond();renderSettings();renderForgetGuard();renderWeatherPanels();unlockAchievements(false);
}
function renderHomeTodos(){
  const box=document.getElementById('homeTodoRows');
  if(!box) return;
  box.innerHTML=attentionItems().slice(0,4).map(({item:x})=>`<div class="todo-row ${x.checked?'done':''}"><span class="todo-box">${x.checked?'✓':''}</span><span>${escapeHTML(x.name)}</span></div>`).join('')||'<div class="todo-row">持ち物を追加しよう</div>';
}
// === V29 予定ごとの持ち物セット ===
function itemSetTargetLabel(target){return target==='tomorrow'?'明日の準備':'今日のチェック'}
function itemSetCanModify(target){
  return target==='tomorrow'?!(state.nightBonus&&state.nightBonusDate===tomorrowDate()):!(isTodayCheckLocked()||isCheckCompletedToday());
}
function itemSetTargetList(target){return target==='tomorrow'?state.tomorrowItems:state.items}
function renderItemSets(){
  for(const target of ['today','tomorrow']){
    const host=document.getElementById(target==='today'?'itemSetsToday':'itemSetsTomorrow');if(!host)continue;
    const active=target==='today'?state.activeSetToday:state.activeSetTomorrow;
    const locked=!itemSetCanModify(target);
    host.innerHTML=state.itemSets.map(set=>`<button type="button" class="item-set-pill ${active===set.id?'active':''}" data-apply-item-set="${escapeHTML(set.id)}" data-set-target="${target}" ${locked?'disabled':''} title="${escapeHTML(set.name)}：${set.items.length}個"><span>${escapeHTML(set.name)}</span><small>${set.items.length}個</small></button>`).join('')||'<span class="set-empty">まだセットはないよ。今のリストから作れるよ。</span>';
    host.querySelectorAll('[data-apply-item-set]').forEach(btn=>btn.onclick=()=>applyItemSet(btn.dataset.applyItemSet,btn.dataset.setTarget));
  }
  // Managing presets is allowed even after today's check; only applying is locked.
  document.querySelectorAll('[data-manage-item-sets]').forEach(b=>b.disabled=false);
}
function applyItemSet(id,target){
  if(!itemSetCanModify(target))return toast(`${itemSetTargetLabel(target)}は終了済みだよ`);
  const set=state.itemSets.find(x=>x.id===id);if(!set)return toast('セットが見つからないよ');
  const list=itemSetTargetList(target),checked=list.filter(x=>x.checked).length;
  const msg=`「${set.name}」(${set.items.length}個)に切り替える？\n現在の${itemSetTargetLabel(target)}リストは置き換わるよ。${checked?`\nチェック済み${checked}個の印もリセットされます。`:''}`;
  if(!confirm(msg))return false;
  const newList=deepClone(set.items).map((x,i)=>({...x,id:`${target}-${Date.now()}-${i}`,checked:false}));
  if(target==='tomorrow'){state.tomorrowItems=newList;state.activeSetTomorrow=id}else{state.items=newList;state.activeSetToday=id}
  saveState();renderAll();toast(`「${set.name}」をセットしたよ`);mascotReaction('今日はこのセットで準備しよう！','🎒','happy');return true;
}
function saveCurrentItemSet(target){
  const list=itemSetTargetList(target);if(!list.length)return toast('保存する持ち物がないよ');
  if(state.itemSets.length>=15)return toast('持ち物セットは15個まで。不要なセットを整理してね');
  const value=prompt('セットの名前は？（例：部活の日）','🎒 新しいセット');if(value==null)return;
  const name=value.trim().slice(0,26);if(!name)return toast('名前を入力してね');
  const id='set-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);
  state.itemSets.push({id,name,items:deepClone(list).map((x,i)=>({...x,id:`${id}-${i}`,checked:false}))});
  if(target==='today')state.activeSetToday=id;else state.activeSetTomorrow=id;
  saveState();renderAll();showItemSetManager(target);toast(`「${name}」を保存したよ`);
}
function renameItemSet(id,target){
  const set=state.itemSets.find(x=>x.id===id);if(!set)return;
  const raw=prompt('新しいセット名',set.name);if(raw==null)return;
  const name=raw.trim().slice(0,26);if(!name)return toast('名前を入力してね');
  set.name=name;saveState();renderAll();showItemSetManager(target);
}
function deleteItemSet(id,target){
  const set=state.itemSets.find(x=>x.id===id);if(!set)return;
  if(!confirm(`「${set.name}」を削除する？\n現在の持ち物チェックは消えません。`))return;
  state.itemSets=state.itemSets.filter(x=>x.id!==id);
  if(state.activeSetToday===id)state.activeSetToday='';if(state.activeSetTomorrow===id)state.activeSetTomorrow='';
  saveState();renderAll();showItemSetManager(target);
}
function showItemSetManager(target='today'){
  const sets=state.itemSets.map(set=>`<article class="set-manage-card"><div class="set-manage-copy"><b>${escapeHTML(set.name)}</b><small>${set.items.length}個：${escapeHTML(set.items.map(x=>x.name).join('・'))}</small></div><div class="set-manage-actions"><button type="button" data-set-manage-apply="${escapeHTML(set.id)}">使う</button><button type="button" data-set-manage-rename="${escapeHTML(set.id)}">名前変更</button><button type="button" data-set-manage-delete="${escapeHTML(set.id)}">削除</button></div></article>`).join('');
  showModal('持ち物セットの管理',`<div class="set-manager"><p>学校・休日・実習などのセットを保存しておこう。現在のリストも新しく保存できるよ。</p><button class="primary-btn set-save-action" type="button" id="setSaveCurrent">＋ ${itemSetTargetLabel(target)}のリストを保存</button><div class="set-manager-list">${sets||'<p>セットはまだありません。</p>'}</div><p class="set-manager-note">「使う」を選ぶと、${itemSetTargetLabel(target)}のリストを置き換えます。持ち物セット自体は編集・削除するまで残ります。</p></div>`,{icon:'🎒',actions:[{label:'閉じる',primary:true}]});
  document.querySelector('#modalBackdrop .modal-card')?.classList.add('set-manager-modal');
  document.getElementById('setSaveCurrent').onclick=()=>saveCurrentItemSet(target);
  document.querySelectorAll('[data-set-manage-apply]').forEach(b=>b.onclick=()=>{if(!itemSetCanModify(target))return toast('このリストは変更できません');if(state.itemSets.some(x=>x.id===b.dataset.setManageApply)){if(applyItemSet(b.dataset.setManageApply,target))closeModal();}});
  document.querySelectorAll('[data-set-manage-rename]').forEach(b=>b.onclick=()=>renameItemSet(b.dataset.setManageRename,target));
  document.querySelectorAll('[data-set-manage-delete]').forEach(b=>b.onclick=()=>deleteItemSet(b.dataset.setManageDelete,target));
}

// V32.3: one-step undo for a check/delete. Snapshots are in memory only.
const itemUndo={today:null,tomorrow:null};
function rememberItemEdit(target,label){
  const list=itemSetTargetList(target);
  itemUndo[target]={date:weatherTargetDate(target),label,after:null,items:deepClone(list),active:target==='today'?state.activeSetToday:state.activeSetTomorrow,
    suppressed:deepClone(weatherDefault().suppressed||{})};
}
function markItemEdit(target){if(itemUndo[target])itemUndo[target].after=JSON.stringify(itemSetTargetList(target));}
function renderItemUndo(target){
  const host=document.getElementById(target==='today'?'v323UndoToday':'v323UndoTomorrow');if(!host)return;
  const previous=itemUndo[target];
  const can=previous&&previous.date===weatherTargetDate(target)&&itemSetCanModify(target)&&previous.after===JSON.stringify(itemSetTargetList(target));
  host.hidden=!can;
  if(can){host.querySelector('[data-undo-copy]').textContent=previous.label+' を元に戻せるよ';}
}
function undoItemEdit(target){
  const last=itemUndo[target];
  if(!last||last.date!==weatherTargetDate(target)||!itemSetCanModify(target)||last.after!==JSON.stringify(itemSetTargetList(target)))return toast('その後にリストが変わったため元に戻せないよ');
  if(target==='today'){state.items=deepClone(last.items);state.activeSetToday=last.active;}
  else{state.tomorrowItems=deepClone(last.items);state.activeSetTomorrow=last.active;}
  weatherDefault().suppressed=deepClone(last.suppressed);
  itemUndo[target]=null;
  saveState();renderAll();toast('ひとつ前の操作に戻したよ');
}
function setCheckOrder(first){
  state.preferUncheckedFirst=!!first;saveState();renderCheckList();
}
// V32.1: item taps only redraw the related panels. Heavy screens refresh on navigation.
let v321DeferredRefresh=false;
function refreshAfterItemTap(target='today'){
  if(target==='today'){
    renderCheckList();
    renderHomeTodos();
    renderCareSupport();
    renderForgetGuard();
    const done=state.items.filter(item=>item.checked).length, total=state.items.length;
    const counter=`${done}/${total}`;
    for(const id of ['departureCount','checkHeroCounter']){
      const node=document.getElementById(id);if(node)node.textContent=counter;
    }
    const ready=total>0&&done===total;
    const sub=document.getElementById('departureSub');if(sub)sub.textContent=ready?'準備ばっちり！いってきます！':'忘れ物ゼロを目指そう！';
    const title=document.getElementById('homeReadyTitle');if(title)title.textContent=ready?'準備ばっちり！':'まだ準備中だよ';
    const text=document.getElementById('homeReadyText');if(text)text.textContent=ready?'今日も安心して出発できるね！':'今日も忘れ物しないように一緒にチェックしよう！';
  }else{
    renderTomorrowList();
    const item=document.getElementById('tomorrowBonusState');
    if(item)item.textContent=state.nightBonus&&state.nightBonusDate===tomorrowDate()?'予約済み':'未予約';
  }
  renderItemUndo(target);
  v321DeferredRefresh=true;
}
function renderCheckList(){
  const box=document.getElementById('checkList');
  const locked=isTodayCheckLocked()||isCheckCompletedToday();
  const checked=state.items.filter(x=>x.checked).length,total=state.items.length,pct=total?Math.round(checked/total*100):0;
  const bar=document.getElementById('checkProgressBar'),label=document.getElementById('checkProgressLabel'),msg=document.getElementById('checkProgressMessage');
  if(bar)bar.style.width=`${pct}%`;
  if(label)label.textContent=`${checked} / ${total} 確認済み`;
  if(msg)msg.textContent=locked?(isTodayCheckLocked()?'今日はチェックできません':'今日のチェックは完了済み'):pct===100?'全部そろったよ！':pct>=50?'あと少し！':'ひとつずつ確認しよう';

  box.classList.toggle('check-list-locked',locked);
  const order=document.getElementById('v323UncheckedFirst');if(order)order.checked=!!state.preferUncheckedFirst;
  renderItemUndo('today');
  box.innerHTML=attentionItems().map(({item:x,index:i,count})=>`<div class="check-item ${x.checked?'checked':''} ${locked?'locked':''} ${count?'care-priority':''}">
    <button type="button" class="check-toggle" data-check-index="${i}" aria-label="${escapeHTML(x.name)}：${x.checked?'確認済み':'未確認'}" aria-pressed="${x.checked}" ${locked?'disabled':''}>${x.checked?'✓':locked?'🔒':''}</button>
    <div class="check-copy"><b>${escapeHTML(x.emoji||'🎒')} ${escapeHTML(x.name)}</b><button class="fg-pin-toggle ${isEssential(x.name)?'active':''}" type="button" data-fg-pin="${escapeHTML(x.name)}" ${locked?'disabled':''} aria-pressed="${isEssential(x.name)}" title="重要品の設定・解除">${isEssential(x.name)?'⭐ 重要品':'☆ 重要品にする'}</button>${count?`<span class="care-priority-tag">🌼 最近${count}回忘れた物</span>`:''}<small>${locked?(isTodayCheckLocked()?'本日はチェックできません':'本日は完了済み'):x.checked?'確認できたよ！':'タップして確認'}</small></div>
    <button class="delete-item" data-delete-index="${i}" aria-label="${escapeHTML(x.name)}を削除" ${locked?'disabled':''}>×</button>
  </div>`).join('');

  box.querySelectorAll('[data-fg-pin]').forEach(b=>b.onclick=()=>toggleEssential(b.dataset.fgPin));
  box.querySelectorAll('[data-check-index]').forEach(b=>b.onclick=()=>{
    if(isTodayCheckLocked())return toast(`今日は「${todayLockLabel()}」のためチェックできないよ`);
    if(isCheckCompletedToday())return toast('今日はチェック完了済みだよ');
    const i=+b.dataset.checkIndex,was=state.items[i].checked;
    rememberItemEdit('today',was?'チェック解除':'持ち物チェック');
    state.items[i].checked=!was;markItemEdit('today');saveState();refreshAfterItemTap('today');beep('click');
    if(!was){
      const now=state.items.filter(x=>x.checked).length;
      if(now===state.items.length){mascotReaction('ぜんぶそろったよ！出発できるね！','🎉','happy');rewardBurst('準備ばっちり！','✅','check')}
      else mascotReaction(`${state.items[i].name}、確認できたね！`,'✓','wink');
    }
  });
  box.querySelectorAll('[data-delete-index]').forEach(b=>b.onclick=()=>{
    if(isTodayCheckLocked()||isCheckCompletedToday())return toast('今日のチェックは終了済みだよ');
    if(state.items.length<=1)return toast('持ち物は1つ以上残してね');
    rememberItemEdit('today','持ち物削除');
    weatherSuppressForDeletion(state.items[+b.dataset.deleteIndex],'today');state.items.splice(+b.dataset.deleteIndex,1);state.activeSetToday='';markItemEdit('today');saveState();renderAll();toast('持ち物を削除したよ');
  });
}
function renderTomorrowList(){
  const box=document.getElementById('tomorrowList');
  const reserved=!!(state.nightBonus&&state.nightBonusDate===tomorrowDate());
  renderItemUndo('tomorrow');
  const checked=state.tomorrowItems.filter(x=>x.checked).length,total=state.tomorrowItems.length,pct=total?Math.round(checked/total*100):0;
  const bar=document.getElementById('tomorrowProgressBar'),label=document.getElementById('tomorrowProgressLabel'),msg=document.getElementById('tomorrowProgressMessage');
  if(bar)bar.style.width=`${pct}%`;if(label)label.textContent=`${checked} / ${total} 準備済み`;
  if(msg)msg.textContent=pct===100?'明日の準備ばっちり！':pct>=50?'もう少しで準備完了':'夜のうちに準備しよう';
  box.innerHTML=state.tomorrowItems.map((x,i)=>`<div class="check-item ${x.checked?'checked':''}"><button type="button" class="check-toggle" data-tom-index="${i}" aria-label="${escapeHTML(x.name)}：${x.checked?'準備済み':'未準備'}" aria-pressed="${x.checked}" ${reserved?'disabled':''}>${x.checked?'✓':''}</button><div class="check-copy"><b>${escapeHTML(x.emoji||'🎒')} ${escapeHTML(x.name)}</b>${isEssential(x.name)?'<span class="fg-pin-badge">⭐ 重要品</span>':''}<small>${x.checked?'準備OK！':'明日の分を用意しよう'}</small></div><button class="delete-item" data-tom-delete="${i}" ${reserved?'disabled':''} aria-label="${escapeHTML(x.name)}を削除">×</button></div>`).join('');
  box.querySelectorAll('[data-tom-index]').forEach(b=>b.onclick=()=>{if(reserved)return toast('準備は予約済みだよ');const i=+b.dataset.tomIndex,was=state.tomorrowItems[i].checked;rememberItemEdit('tomorrow',was?'準備チェック解除':'明日の準備チェック');state.tomorrowItems[i].checked=!was;markItemEdit('tomorrow');saveState();refreshAfterItemTap('tomorrow');if(!was&&state.tomorrowItems.every(x=>x.checked))mascotReaction('明日の準備、全部できたね！','🌙','happy')});
  box.querySelectorAll('[data-tom-delete]').forEach(b=>b.onclick=()=>{if(reserved)return toast('準備は予約済みだよ');if(state.tomorrowItems.length<=1)return toast('持ち物は1つ以上残してね');rememberItemEdit('tomorrow','明日の持ち物削除');weatherSuppressForDeletion(state.tomorrowItems[+b.dataset.tomDelete],'tomorrow');state.tomorrowItems.splice(+b.dataset.tomDelete,1);state.activeSetTomorrow='';markItemEdit('tomorrow');saveState();renderAll()});
}
function renderQuest(){const live=walkSession?.active?Math.max(0,walkSession.distance-walkSession.creditedDistance):0;document.getElementById('questDistanceTop').textContent=`${Math.round(state.walkMeters+live)}m`;document.getElementById('questMeter').style.width=`${Math.min(100,(state.walkMeters+live)/APP_CONFIG.walkGoal*100)}%`;updateWalkLiveUI()}
function renderMissions(){
  const goals=ECONOMY.walkMilestones,claimed=Array.isArray(state.claimedWalkMissions)?state.claimedWalkMissions:[];
  document.getElementById('missionList').innerHTML=goals.map(g=>`<div class="mission-card"><span>${claimed.includes(g.m)?'✅':'🍀'}</span><div><b>${g.m.toLocaleString()}m 歩く</b><small>${Math.min(Math.round(state.walkMeters),g.m)} / ${g.m}m</small></div><span class="mission-reward">${claimed.includes(g.m)?'GET':`🪙 +${g.r}`}</span></div>`).join('');
}
let activeMarketTab='gacha';
function setMarketTab(tab){
  activeMarketTab=tab==='shop'?'shop':'gacha';
  document.querySelector('[data-screen="shop"]')?.setAttribute('data-market',activeMarketTab);
  document.querySelectorAll('[data-market-tab]').forEach(btn=>{
    const active=btn.dataset.marketTab===activeMarketTab;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-selected',String(active));
    btn.tabIndex=active?0:-1;
  });
  for(const key of ['gacha','shop']){
    const panel=document.getElementById(key==='gacha'?'marketGachaPanel':'marketShopPanel');
    if(panel)panel.classList.toggle('hidden',key!==activeMarketTab);
  }
}
function itemSourceLabel(item){
  return item.source==='shop'?'SHOP限定':item.source==='gacha'?'ガチャ限定':'メダル限定';
}
function renderShop(){
  const items=SHOP_ITEMS.filter(x=>x.source==='shop'&&Number.isFinite(x.price));
  document.getElementById('shopGrid').innerHTML=items.map(x=>{
    const owned=inventoryOwned(x),cantAfford=state.coins<x.price,uniqueOwned=!x.stack&&owned;
    const label=uniqueOwned?'所持済み':cantAfford?'コイン不足':`◉ ${x.price} で購入`;
    return `<article class="shop-item ${uniqueOwned?'owned':''}"><span class="shop-rarity rarity-SHOP">SHOP限定</span><span class="item-emoji">${x.emoji}</span><b>${escapeHTML(x.name)}</b><small>${escapeHTML(x.desc)}</small><button class="buy-btn" data-buy="${x.id}" ${uniqueOwned||cantAfford?'disabled':''}>${label}</button></article>`;
  }).join('');
  document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buyItem(b.dataset.buy));
  renderGachaPoolPreview();
}
function inventoryOwned(x){return x.stack?(state.inventory[x.id]||0)>0:!!state.inventory[x.id]}
function renderInventory(filter='all'){
  const items=SHOP_ITEMS.filter(x=>filter==='all'||x.type===filter);
  document.getElementById('inventoryCount').textContent=SHOP_ITEMS.filter(inventoryOwned).length;
  document.getElementById('inventoryGrid').innerHTML=items.map(x=>{
    const owned=inventoryOwned(x);
    const equipped=(x.type==='accessory'&&state.equippedAccessory===x.id)||(x.type==='background'&&x.theme===state.theme);
    const count=x.stack?`×${state.inventory[x.id]||0}`:(owned?'所持':'未所持');
    const rarity=rarityForItem(x.id);
    const source=x.source==='shop'?'SHOP':x.source==='gacha'?'GACHA':'MEDAL';
    return `<button class="inventory-item ${owned?'':'locked'} ${equipped?'equipped':''}" data-inv="${x.id}" ${owned?'':'disabled'} title="${escapeHTML(x.name)}：${itemSourceLabel(x)}"><span class="inventory-rarity rarity-${rarity}">${source==='GACHA'?rarity:source}</span><span class="item-emoji">${x.emoji}</span><b>${escapeHTML(x.name)}</b><small>${equipped?'使用中':count}</small></button>`;
  }).join('');
  document.querySelectorAll('[data-inv]').forEach(b=>b.onclick=()=>useInventoryItem(b.dataset.inv));
}
function renderProfile(){
  const r=rankForTrust(),n=nextRank(),prev=r.threshold,next=n?n.threshold:r.threshold,pct=n?Math.min(100,(state.trust-prev)/Math.max(1,next-prev)*100):100;
  document.getElementById('profilePartnerName').textContent=PARTNERS[state.partner].name;
  document.getElementById('profileLevel').textContent=`Lv.${r.level}`;document.getElementById('profileRankName').textContent=r.name;
  const rankMark=document.getElementById('profileRankMark');
  if(rankMark){rankMark.textContent={1:'🌱',2:'守',3:'🍀',4:'👑',5:'🌌'}[r.level]||'🌱';rankMark.title=`Lv.${r.level} ${r.name}`;}
  const profileCard=document.getElementById('profileCard');
  if(profileCard) profileCard.dataset.rank=String(r.level);
  document.getElementById('profileTrust').textContent=state.trust;document.getElementById('profileCoins').textContent=state.coins;document.getElementById('profileChecks').textContent=state.checkCompletions;
  document.getElementById('profileMeter').style.width=`${pct}%`;document.getElementById('themeName').textContent=themeLabel(state.theme);document.getElementById('soundState').textContent=state.sound?'ON':'OFF';renderBgmState();
  const st=document.getElementById('profileStreak'),sm=document.getElementById('streakMessage');
  if(st)st.textContent=state.streak||0;
  if(sm)sm.textContent=state.lastCheckDate===TODAY()?'今日はチェック達成済み！':state.streak>0?'今日も達成して連続記録を伸ばそう！':'今日のチェックで連続記録スタート！';
  const achievements=Array.isArray(state.achievements)?state.achievements:[],bc=document.getElementById('badgeCount'),grid=document.getElementById('badgeGrid');
  if(bc)bc.textContent=`${achievements.length} / ${ACHIEVEMENTS.length}`;
  if(grid)grid.innerHTML=ACHIEVEMENTS.map(a=>`<article class="achievement-badge ${achievements.includes(a.id)?'unlocked':'locked'}"><span>${achievements.includes(a.id)?a.emoji:'🔒'}</span><b>${a.name}</b><small>${a.desc}</small></article>`).join('');
  renderPartnerBond();renderSettings();
}
function go(screen){if(screen===currentScreen)return;if(v321DeferredRefresh){v321DeferredRefresh=false;renderAll()}previousScreen=currentScreen;previousScreen=currentScreen;currentScreen=screen;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===screen));document.querySelectorAll('#bottomNav [data-go]').forEach(b=>{const active=b.dataset.go===screen;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});const home=screen==='home';document.getElementById('miniHeader').classList.toggle('show',!home);document.getElementById('backBtn').classList.toggle('hidden',['check','quest','shop','mypage'].includes(screen));document.getElementById('miniTitle').textContent={check:'持ち物チェック',quest:'ウォーキングクエスト',tomorrow:'あしたの自分貯金',shop:'ガチャ・ショップ',summary:'今日のまとめ',history:'カレンダー・履歴',settings:'設定・データ',inventory:'アイテム',mypage:'マイページ'}[screen]||'すまぽっけ';document.querySelector(`[data-screen="${screen}"]`).scrollTop=0;if(screen==='home'){const s=document.getElementById('homeSpeech');if(s)s.textContent=contextualGreeting()}beep('click')}
function tomorrowDate(){const d=gameNow();d.setDate(d.getDate()+1);return localDateKey(d)}
function themeLabel(t){return THEMES[t]?.name||THEMES.spring.name}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1800)}
let feedbackAudioContext=null;
function beep(type='click'){
  if(!state.sound)return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    if(!feedbackAudioContext)feedbackAudioContext=new AC();
    const ac=feedbackAudioContext;
    if(ac.state==='suspended')ac.resume().catch(()=>{});
    const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);
    o.frequency.value=type==='reward'?680:type==='rank'?850:430;
    g.gain.setValueAtTime(.0001,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.026,ac.currentTime+.015);
    g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+.12);
    o.start();o.stop(ac.currentTime+.13);o.onended=()=>{try{o.disconnect();g.disconnect()}catch{}};
  }catch(e){console.warn('audio feedback',e)}
}

let modalPreviousFocus=null;
function showModal(title,body,{icon='✨',actions=[]}={}){
  const overlay=document.getElementById('modalBackdrop');
  if(overlay.classList.contains('hidden'))modalPreviousFocus=document.activeElement;
  document.querySelector('.modal-card')?.classList.remove('conversation-modal','set-manager-modal');
  document.getElementById('modalIcon').textContent=icon;
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=body;
  const box=document.getElementById('modalActions');box.innerHTML='';
  actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.label;b.className=a.primary?'primary-btn':'secondary-btn';b.onclick=()=>{if(a.onClick)a.onClick();if(a.close!==false)closeModal()};box.appendChild(b)});
  overlay.classList.remove('hidden');
  document.getElementById('modalClose').focus({preventScroll:true});
}
function closeModal(){
  const overlay=document.getElementById('modalBackdrop');
  if(overlay.classList.contains('hidden'))return;
  overlay.classList.add('hidden');setMascotMood('normal',0);
  if(modalPreviousFocus&&modalPreviousFocus.isConnected){modalPreviousFocus.focus({preventScroll:true})}
  modalPreviousFocus=null;
}
document.addEventListener('keydown',event=>{
  const overlay=document.getElementById('modalBackdrop');
  if(!overlay||overlay.classList.contains('hidden'))return;
  // Leave native controls inside the modal usable, but keep keyboard focus inside it.
  if(event.key==='Escape'){event.preventDefault();closeModal();return}
  if(event.key!=='Tab')return;
  const focusable=[...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length>0);
  if(!focusable.length){event.preventDefault();document.getElementById('modalClose').focus();return}
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){event.preventDefault();first.focus()}
});
/* V33.2: 相棒チェンジ。プレビューのみでは育成・保存データを変更しない。 */
function showPartnerChoice(){
  let selected=state.partner;
  const currentRank=rankForTrust();
  const html=`<section class="partner-switch-dialog" aria-label="相棒の変更">
    <p class="partner-switch-intro">好きな相棒を選んでね！ <strong>Lv.${currentRank.level} ${escapeHTML(currentRank.name)}</strong>の姿で比べられるよ。</p>
    <div class="partner-switch-options" role="group" aria-label="相棒を選択">
    ${Object.entries(PARTNERS).map(([key,partner])=>`<button type="button" class="partner-switch-card ${key===selected?'is-selected':''}" data-choice-partner="${key}" aria-pressed="${key===selected}" aria-label="${partner.name}を選ぶ">
      <span class="partner-switch-art" aria-hidden="true">${mascotArt(key,currentRank.level,'happy')}</span>
      <strong>${partner.name}</strong>
      <small>${key==='kun'?'元気でやさしい相棒':'ふんわり応援してくれる相棒'}</small>
      <span class="partner-switch-mark">${key===state.partner?'現在の相棒':'選択する'}</span>
    </button>`).join('')}
    </div>
    <p class="partner-switch-safety">🔒 レベル・信頼度・コイン・チェック記録・持ち物・コレクションはそのまま引き継がれます。</p>
    <div class="partner-switch-actions"><button type="button" id="partnerSwitchCancel" class="secondary-btn">キャンセル</button><button type="button" id="partnerSwitchConfirm" class="primary-btn" ${selected===state.partner?'disabled':''}>この相棒にチェンジ！</button></div>
  </section>`;
  showModal('相棒チェンジ',html,{icon:'🐾'});
  const body=document.getElementById('modalBody');
  const confirm=body.querySelector('#partnerSwitchConfirm');
  body.querySelectorAll('[data-choice-partner]').forEach(button=>{
    button.addEventListener('click',()=>{
      selected=button.dataset.choicePartner;
      body.querySelectorAll('[data-choice-partner]').forEach(b=>{
        const on=b.dataset.choicePartner===selected;
        b.classList.toggle('is-selected',on);
        b.setAttribute('aria-pressed',String(on));
        b.querySelector('.partner-switch-mark').textContent=on?'✓ 選択中':b.dataset.choicePartner===state.partner?'現在の相棒':'選択する';
      });
      confirm.disabled=selected===state.partner;
    });
  });
  body.querySelector('#partnerSwitchCancel').addEventListener('click',closeModal);
  confirm.addEventListener('click',()=>{
    if(selected===state.partner)return;
    if(!PARTNERS[selected])return;
    const previous=state.partner;
    state.partner=selected;
    if(!saveState()){
      state.partner=previous;
      closeModal();
      toast('保存できなかったため、相棒は変更していないよ');
      return;
    }
    closeModal();
    setMascotMood('normal',0);
    renderAll();
    renderMascots();
    speak('greeting');
    toast(`${PARTNERS[selected].name}にチェンジしたよ！`);
  });
}
/* V31.5 — 段階的に成長する相棒の会話。画像は既存の正式デザインをそのまま使う。 */
const TALK_TOPIC_BANK = [
  {id:'hello',level:1,emoji:'☀️',label:'あいさつ',mood:'happy',
    kun:[['やっほー！ 今日も会えてうれしいな。','きみの一日が、ちょっと楽しくなったらいいな！'],['おはよう！ またいっしょに過ごせるね。','まずはひとつ、できそうなことから始めよう！']],
    chan:[['おはよう〜！ また会えたね。','今日もいっしょに、ゆるりといこうね。'],['わぁ、来てくれたんだね！','うれしくて、ポッケがぽかぽかするよ〜。']]},
  {id:'today',level:1,emoji:'📖',label:'今日のできごと',mood:'thinking',
    kun:[['きみの今日のこと、ぼくもいっしょに振り返りたいな。','ちいさなことでも、がんばった一日だよ。']],
    chan:[['今日はどんな日だったかな？','うれしいことも、ちょっと疲れたことも、ここに置いていってね。']]},
  {id:'cheer',level:1,emoji:'💪',label:'応援して！',mood:'wink',
    kun:[['大丈夫！ きみならきっとできるよ！','ぼくはポケットの中から応援してる！'],['失敗したって、もう一度やってみればいいんだ！','いっしょなら、きっと前に進めるよ。']],
    chan:[['ふぁいと、ふぁいと〜！','がんばっているきみを、ちゃんと見てるよ。'],['ちょっとずつで大丈夫だよ。','できたところから、いっしょに喜ぼうね！']]},
  {id:'tired',level:1,emoji:'☕',label:'ちょっと疲れた',mood:'sleepy',
    kun:[['疲れた日は、休むのも大切な準備だよ。','水を飲んで、肩の力を抜いてみてね。']],
    chan:[['おつかれさま〜。','がんばったぶん、ふわふわ休んでほしいな。']]},
  {id:'tomorrow',level:1,emoji:'🎒',label:'明日の持ち物',mood:'thinking',
    kun:[['明日の準備は、今日の自分からのプレゼントだね！','忘れ物がないか、いっしょに見てみよう。']],
    chan:[['明日の持ち物、いっしょに確認しよう〜。','ひとつずつそろえると安心だよね。']]},
  {id:'school',level:2,emoji:'📚',label:'学校の話',mood:'happy',
    kun:[['新しいことを覚えるって、冒険みたいだよね！','むずかしいところは、少しずつ考えてみよう。'],['授業で気になったことはあった？','ぼくもいっしょに勉強した気分になるよ。']],
    chan:[['今日はどんな授業があったのかな〜？','知らないことを知るって、わくわくするね。'],['難しい勉強でも、少し進めたらすてきだよ。','あわてず、自分のペースでいこうね。']]},
  {id:'charm',level:2,emoji:'🌱',label:'若葉とお守り',mood:'wink',
    kun:[['見て！ ぼくに小さな若葉とお守りがついたよ。','きみとの毎日が、ぼくを育ててくれたんだ！']],
    chan:[['この若葉、かわいいでしょ〜？','きみと過ごした時間が、少しずつ形になったんだよ。']]},
  {id:'pace',level:2,emoji:'🫧',label:'マイペース',mood:'happy',
    kun:[['速さより、続けることが大切なときもあるよ。','ぼくたちは、ぼくたちのペースで進もう！']],
    chan:[['急がなくても、ちゃんと前に進めるよ。','今日のひとつが、明日の力になるんだね〜。']]},
  {id:'clover',level:3,emoji:'🍀',label:'クローバーの秘密',mood:'excited',
    kun:[['幸運のクローバーがふわっと浮かぶようになったよ！','これはきみががんばってきた証なんだ。','見るだけでちょっと元気になれるでしょ？']],
    chan:[['ほら、クローバーがくるくる〜！','きみといると、うれしい気持ちが増えるの。','きみにも小さな幸運が届きますように。']]},
  {id:'luck',level:3,emoji:'🌈',label:'今日のラッキー',mood:'wink',
    kun:[['きょうのラッキーは「ひとつ早めに準備すること」！','小さな工夫が、未来の自分を助けてくれるよ。']],
    chan:[['今日のラッキーアイテムは…ふわふわのハンカチ！','でも一番の幸運は、きみとお話できることかな〜。']]},
  {id:'memory',level:3,emoji:'📷',label:'思い出の話',mood:'happy',
    kun:[['最初に出会ったころのこと、覚えてる？','できることが増えて、ぼくもうれしいな。','これからも新しい思い出を作ろう！']],
    chan:[['最初はちょっぴり緊張してたの〜。','今はこうしておしゃべりできて、すごく幸せ。','これからも、たくさんお話してね。']]},
  {id:'gold',level:4,emoji:'👑',label:'黄金の王冠',mood:'excited',
    kun:[['じゃーん！ 金色の王冠、似合ってる？','きみが積み重ねた努力が、こんなにキラキラになったんだ！','ぼくももっと頼れる相棒になりたいな。']],
    chan:[['この王冠、ぴかぴかできれいでしょ〜？','きみが続けてきた毎日のきらめきなの。','大切にして、もっといっしょに成長したいな。']]},
  {id:'challenge',level:4,emoji:'🚀',label:'新しい挑戦',mood:'surprise',
    kun:[['新しいことに挑戦するのって、ちょっと勇気がいるよね。','うまくいかない日だって、挑戦した事実は残るよ。','ぼくも隣で、思いきり応援する！']],
    chan:[['やってみたいことがあるんだね〜！','最初の一歩は小さくてもいいんだよ。','がんばりたい気持ち、わたしも応援したいな。']]},
  {id:'star',level:4,emoji:'🌟',label:'星に願いを',mood:'wink',
    kun:[['夜空の星って、ずっと遠くから光っているんだ。','きみの目標も、少しずつ近づけるはず。','ぼくたちだけの星を見つけたいね！']],
    chan:[['星にひとつだけお願いできるなら…','きみが安心して笑える日が増えますように。','そんな願いを、そっと空に届けたいな〜。']]},
  {id:'dimension',level:5,emoji:'🌌',label:'四次元ポッケの世界',mood:'surprise',
    kun:[['ぼくのポケットの奥には、まだ知らない星空が広がっているんだ！','王冠の光が道しるべになって、星たちがくるくる踊るんだよ。','きみといっしょなら、どんな未来にも進める気がする！']],
    chan:[['四次元ポッケをのぞくと、やさしい星の光が見えるの〜。','ここにあるのは、きみと過ごしてきた思い出のかけら。','ひとつずつ大事にしまっておきたいな。']]},
  {id:'secret',level:5,emoji:'💎',label:'王冠の秘密',mood:'thinking',
    kun:[['この宝石はね、きみと積み重ねた毎日の光でできているんだ！','大きな出来事だけじゃなく、忘れずに準備できた日も一つの光。','だからこの王冠、ぼくにとっては宝物なんだよ。']],
    chan:[['ティアラの宝石、実は特別なの〜。','きみががんばったこと、笑ったこと、少し休んだこと。','どれもすてきな思い出だから、キラキラ光っているんだよ。']]},
  {id:'wish',level:5,emoji:'✨',label:'ひみつの願い',mood:'happy',
    kun:[['ぼくの願いは、きみが自分のペースで毎日を楽しめること！','完璧じゃなくていい。できることを一つずつ増やしていこう。','これからの冒険も、ぼくがいっしょに行くよ！']],
    chan:[['わたしのひみつの願い、聞いてくれる？','きみが今日の自分を少し好きになれたらうれしいな。','どんな日も、そっとそばにいるからね〜。']]},
  {id:'future',level:5,emoji:'🪐',label:'未来への冒険',mood:'excited',
    kun:[['もし一緒に冒険に行くなら、星の図書館に行きたいな！','宇宙じゅうの「やってみたい」を集めた場所なんだって。','帰ったら、明日の持ち物も忘れずにチェックしようね！']],
    chan:[['未来の世界には、どんなポケットがあるのかな〜？','夢や思い出をやさしくしまえるポケットがあったらいいな。','そのときも、きみと一緒にいられたらうれしいよ。']]},
  {id:'promise',level:5,emoji:'🤝',label:'ずっと相棒！',mood:'wink',
    kun:[['ここまでいっしょに来てくれてありがとう！','きみのおかげで、ぼくは四次元ポッケになれたんだ。','これからも、忘れ物チェックも新しい挑戦もいっしょにしよう！']],
    chan:[['ここまで育ててくれて、ありがとう〜！','きみとの時間が、わたしのいちばんの宝物なの。','これからも、毎日やさしく声をかけられる相棒でいたいな。']]}
];
const TALK_RANK_REFLECTIONS={
  kun:{2:['若葉みたいに、一歩ずつ成長していこうね。','お守りを見たら、きみの努力を思い出すよ。'],3:['クローバーが応援してるよ！','いいことも小さなことから見つけよう。'],4:['王冠の光といっしょに、元気を分けたいな！','積み重ねてきたことは、ちゃんと宝物になるよ。'],5:['星の光をポケットに集めて、きみを応援してる！','四次元ポッケのいちばんの宝物は、きみとの思い出！']},
  chan:{2:['この若葉といっしょに、ゆっくり育とうね〜。','お守りがあると、なんだかほっとするね。'],3:['クローバーがくるくる、応援してくれるよ〜。','小さな幸せも、きっと見つかるよ。'],4:['王冠がきらきらして、わたしも元気になるの。','きみが続けてきたこと、すてきだよ〜。'],5:['星のティアラが光るたび、きみを思い出すの。','四次元ポッケにも、やさしい気持ちをいっぱい詰めようね。']}
};
const EXTRA_GROWTH_QUOTES={
  kun:{1:['あわてなくても大丈夫！','きょうの準備、ひとつずつ見ていこう！','また会えてうれしいな。'],2:['若葉みたいにぐんぐん育ちたいな！','お守りがあると心強いね。','忘れ物がないか、ぼくと最終確認しよう！','コツコツ続けるってすごいことだよ。'],3:['クローバーがきらきらしているよ！','今日も小さな幸せを見つけよう。','ポケットからラッキーをおすそ分け！','きみのがんばり、ちゃんと見てるよ。'],4:['黄金の王冠、今日はよく光ってる！','新しいことも、ぼくと挑戦しよう！','積み重ねた毎日が一番の宝物だね。','星を見たら深呼吸してみよう。'],5:['四次元ポッケの星が、今日も輝いてる！','忘れ物ゼロの未来へ、出発だ！','きみといっしょなら、どこまでだって！','このティアラは一緒に成長した証だよ。','星空の奥にも、まだ見ぬ冒険が待ってる！']},
  chan:{1:['ゆっくりでいいんだよ〜。','きょうもいっしょにチェックしよ。','会いに来てくれてうれしいな。'],2:['若葉がすくすく育ってる〜！','お守りのこと、だいじにしたいな。','焦らずひとつずつ、だよ。','ちょっと休憩も忘れないでね。'],3:['クローバーがふわり、幸せのおすそわけ！','毎日の小さなうれしいを集めようね。','今日もがんばったね〜。','きみにいいことがありますように。'],4:['黄金の光で、そっと応援するよ。','きらきらの王冠、見てくれた？','今日の小さな一歩もすてきだね。','新しいことも、いっしょなら楽しそう！'],5:['星のきらめき、きみに届いてほしいな。','四次元ポッケで思い出を大切にするね。','いつでもお話に来てね〜。','きみと過ごす今日が、わたしの宝物。','ティアラがふわふわ、うれしい気持ちだよ〜。']}
};
Object.keys(EXTRA_GROWTH_QUOTES).forEach(key=>Object.keys(EXTRA_GROWTH_QUOTES[key]).forEach(level=>QUOTES[key][level].push(...EXTRA_GROWTH_QUOTES[key][level])));
const lastTopicVariation={};
function growTalkLines(topic){
  const key=state.partner==='chan'?'chan':'kun',rank=Math.max(1,Math.min(5,Number(state.rank)||1));
  const variants=topic[key];const memoryKey=key+':'+topic.id;
  let idx=variants.length>1?Math.floor(Math.random()*variants.length):0;
  if(variants.length>1&&idx===lastTopicVariation[memoryKey])idx=(idx+1)%variants.length;
  lastTopicVariation[memoryKey]=idx;
  const parts=[...variants[idx]];
  if(topic.id==='hello')parts.unshift(contextualGreeting());
  if(topic.id==='today'){
    const record=getDayRecord();
    parts.unshift(record.action?`今日は「${actionLabel(record.action)}」の記録があるね！`: '今日はまだ持ち物チェックの記録がないみたい。');
  }
  if(topic.id==='tomorrow')parts.unshift(state.nightBonus&&state.nightBonusDate===tomorrowDate()?'明日の準備はもう完了しているね！':'明日の準備はこれからかな？');
  if(rank>=2&&topic.level<rank){
    const reflections=TALK_RANK_REFLECTIONS[key][rank];
    if(reflections?.length)parts.push(reflections[Math.floor(Math.random()*reflections.length)]);
  }
  return parts;
}
function openTalk(){
  state.partnerTalks=(state.partnerTalks||0)+1;
  saveState();
  const level=Math.max(1,Math.min(5,Number(state.rank)||1));
  const name=PARTNERS[state.partner].name;
  const rank=RANKS[level-1];
  const available=TALK_TOPIC_BANK.filter(t=>t.level<=level);
  const upcoming=TALK_TOPIC_BANK.find(t=>t.level>level);
  const character=mascotArt(state.partner,level,'happy').replace('class="mascot-final-img"','class="mascot-final-img talk-portrait"');
  const body=`<section class="partner-conversation" aria-label="${escapeHTML(name)}との会話">
    <div class="talk-level-head"><span>✨ Lv.${level} ${escapeHTML(rank.name)}</span><span>💬 ${available.length}個の話題</span></div>
    <div class="talk-sticky-stage">
      <div class="talk-portrait-frame" data-mood="happy"><span class="talk-evolved-buddy">${character}</span></div>
      <div class="talk-response-zone">
        <div class="talk-response" id="talkResponse" role="status" aria-live="polite">${escapeHTML(name)}だよ！ 何のお話をしようかな？</div>
        <div class="talk-story-progress" id="talkStoryProgress" aria-live="off"></div>
        <button class="talk-next-line" type="button" id="talkNextLine" hidden>▶ つづきを聞く</button>
      </div>
    </div>
    <div class="talk-scroll-choices" role="region" aria-label="会話の選択肢" tabindex="0">
      <p class="talk-choice-caption">💬 話題を選んでね</p>
      <div class="talk-options">${available.map((t,i)=>`<button type="button" data-topic="${escapeHTML(t.id)}" aria-pressed="false"><span aria-hidden="true">${t.emoji}</span> ${escapeHTML(t.label)}</button>`).join('')}</div>
      ${upcoming?`<p class="talk-next-unlock">🔒 Lv.${upcoming.level}になると話題がもっと増えるよ！</p>`:'<p class="talk-all-unlocked">🌌 すべての話題が解放されたよ！</p>'}
      <details class="talk-expression-drawer"><summary>🎭 ほかの表情も見てみる</summary>
        <div class="feeling-picker" role="group" aria-label="相棒の表情を試す">
          <div class="feeling-picker-buttons">${POKKE_FEELINGS.map(f=>`<button type="button" class="feeling-chip" data-feeling="${f.mood}" aria-pressed="false" title="${f.name}">${f.emoji}<span>${f.name}</span></button>`).join('')}</div>
        </div>
      </details>
    </div>
  </section>`;
  showModal(`${name}とおしゃべり`,body,{icon:'💬'});
  document.querySelector('.modal-card')?.classList.add('conversation-modal');
  setMascotMood('happy',0);
  mascotBusyUntil=Date.now()+12000;
  let pages=[], pageIndex=0,activeTopic=null;
  const response=document.getElementById('talkResponse'),progress=document.getElementById('talkStoryProgress'),next=document.getElementById('talkNextLine');
  function showPage(){
    if(!pages.length)return;
    response.textContent=pages[pageIndex];
    progress.textContent=pages.length>1?`${pageIndex+1} / ${pages.length} ページ`:'';
    next.hidden=pageIndex>=pages.length-1;
    setMascotMood(pageIndex===0?(activeTopic?.mood||'happy'):(pageIndex%2?'talk':activeTopic?.mood||'happy'),0);
    mascotBusyUntil=Date.now()+12000;
    response.scrollTop=0;
  }
  next.addEventListener('click',()=>{if(pageIndex<pages.length-1){pageIndex++;showPage();beep('click')}});
  document.querySelectorAll('[data-topic]').forEach(button=>button.addEventListener('click',()=>{
    activeTopic=available.find(t=>t.id===button.dataset.topic);if(!activeTopic)return;
    pages=growTalkLines(activeTopic);pageIndex=0;showPage();
    document.querySelectorAll('[data-topic]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    document.querySelectorAll('[data-feeling]').forEach(b=>b.setAttribute('aria-pressed','false'));
    beep('click');
  }));
  document.querySelectorAll('[data-feeling]').forEach(button=>button.addEventListener('click',()=>{
    const f=POKKE_FEELINGS.find(x=>x.mood===button.dataset.feeling);if(!f)return;
    activeTopic=null;pages=[];pageIndex=0;next.hidden=true;progress.textContent='';
    response.textContent=f.line;
    document.querySelectorAll('[data-feeling]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    document.querySelectorAll('[data-topic]').forEach(b=>b.setAttribute('aria-pressed','false'));
    setMascotMood(f.mood,0);mascotBusyUntil=Date.now()+12000;beep('click');
  }));
}

function showThemePicker(){
  const entries=Object.entries(THEMES);
  showModal('背景テーマ',`<div class="theme-grid">${entries.map(([id,t])=>{
    const unlocked=t.free||!t.item||!!state.inventory[t.item];
    return `<button class="theme-option ${state.theme===id?'active':''} ${unlocked?'':'locked'}" data-theme-choice="${id}"><div class="theme-swatch" style="background:${t.bg}"></div><b>${t.name}</b><small>${unlocked?'使用できます':'アイテムで解放'}</small></button>`
  }).join('')}</div>`,{icon:'🌸'});
  document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{
    const t=b.dataset.themeChoice,cfg=THEMES[t];
    if(cfg?.item&&!state.inventory[cfg.item])return toast(`「${cfg.name}」を手に入れよう`);
    state.theme=t;saveState();renderAll();closeModal();
  });
}

function addItem(target='today'){
  if(target==='today'&&(isTodayCheckLocked()||isCheckCompletedToday()))return toast('今日のチェックは終了済み。明日また追加できるよ');
  if(target==='tomorrow'&&state.nightBonus&&state.nightBonusDate===tomorrowDate())return toast('明日の準備は予約済みだよ');
  const raw=prompt('追加する持ち物の名前を入力してね（35文字まで）');
  if(raw==null)return;
  const name=raw.trim().slice(0,35);if(!name)return toast('名前を入力してね');
  const list=target==='tomorrow'?state.tomorrowItems:state.items;
  if(list.length>=50)return toast('持ち物は50個まで登録できるよ');
  if(list.some(x=>x.name===name))return toast('同じ名前の持ち物があるよ');
  list.push({id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,hint:'',checked:false,emoji:'🎒'});if(target==='tomorrow')state.activeSetTomorrow='';else state.activeSetToday='';
  saveState();renderAll();toast('持ち物を追加したよ');
}
function completeCheck(){
  if(isTodayCheckLocked())return toast(`今日は「${todayLockLabel()}」を選んでいるためチェックできないよ`);
  if(!state.items.length)return;if(!state.items.every(x=>x.checked))return toast('まだ確認していない持ち物があるよ');
  if(state.lastActionDate===TODAY()&&state.lastActionType==='check')return toast('今日はすでに報酬を受け取ったよ');
  itemUndo.today=null;state.lastActionDate=TODAY();state.lastActionType='check';state.checkCompletions++;updateCheckStreak();recordHistory({action:'check'});
  let bonus=100,guardUsed=false;if((state.inventory.guard||0)>0){bonus+=20;state.inventory.guard--;guardUsed=true}
  saveState();const reward=addPoints(bonus,ECONOMY.checkCoins);beep('reward');mascotReaction('実物を確認できたね！いってらっしゃい！','🎉','wink');
  showModal('チェック完了！',`<div class="celebration-card"><div class="celebration-mascot">${mascotArt(state.partner,state.rank,'happy')}</div><h3>忘れ物チェックばっちり！</h3><div class="reward-summary"><span>🍀 +${reward.pt}pt</span><span>◉ +${reward.coins}コイン</span></div>${guardUsed?'<small>🛡️ 忘れ物ガード +20pt を使用</small>':''}<p>連続チェック <b>${state.streak}日</b></p></div>`,{icon:'🎉',actions:[{label:'出発する！',primary:true,onClick:()=>go('home')}]});
  unlockAchievements(true);
}
function noOuting(){
  const chosen=getTodayAltAction();
  if(chosen){
    return toast(chosen==='no-outing'?'今日は「出ない日」を記録済みだよ':'今日は「正直申告」を選んでいるよ');
  }
  if(state.lastActionDate===TODAY()&&state.lastActionType==='check'){
    return toast('今日は持ち物チェックを完了しているよ');
  }

  lockTodayAltAction('no-outing');
  state.lastActionDate=TODAY();
  state.lastActionType='no-outing';
  recordHistory({action:'no-outing'});
  saveState();
  renderAll();

  const reward=addPoints(20,ECONOMY.noOutingCoins);
  mascotReaction('今日はおうちの日なんだね。ゆっくりしよう！','🏠','sleepy');
  showModal(
    '今日はおうちの日',
    `出ない日もちゃんと記録できたね。<br><b>+${reward.pt}pt / +${reward.coins}コイン</b><br><small>今日は「正直申告」は選べません。</small>`,
    {icon:'🏠',actions:[{label:'OK',primary:true}]}
  );
}

function honestReport(){
  if(isCheckCompletedToday())return toast('今日は持ち物チェックを完了しているよ');
  const chosen=getTodayAltAction();
  if(chosen)return toast(chosen==='honest'?'今日は「正直申告」済みだよ':'今日は「出ない日」を選んでいるよ');

  const cycle=nextHonestCycle();
  // Confirm a negative result before making any changes.
  if(!cycle.plus && !confirm(`今日は正直申告の${cycle.number}回目（減点の番）です。\n信頼度は最大 −${cycle.plannedPenalty}pt になります。\nこの内容で申告しますか？`))return;

  // The normal one-report-per-day exclusion still applies to BOTH phases.
  lockTodayAltAction('honest');
  state.lastHonestDate=TODAY();
  state.honestCount++;

  if(cycle.plus){
    const reward=addPoints(10,ECONOMY.honestCoins);
    state.honestLastPlus=reward.pt;
    state.honestCycleCount++;
    recordHistory({action:'honest',honestOutcome:'plus',honestDelta:reward.pt});
    saveState();renderAll();
    
    mascotReaction('正直に話してくれてありがとう！次の申告は減点の番だよ。','♡','happy');
    showModal('正直申告：加点の番',
      `正直に教えてくれてありがとう！<br><b>🍀 +${reward.pt}pt / 🪙 +${reward.coins}コイン</b><br><small>${cycle.number}回目の申告。次の申告は減点の番（−${nextHonestCycle().plannedPenalty}pt）だよ。</small>`,
      {icon:'♡',actions:[{label:'わかった！',primary:true}]});
  }else{
    const before=state.trust;
    const lost=Math.min(before,cycle.plannedPenalty);
    state.trust=before-lost;
    state.honestCycleCount++;
    recordHistory({action:'honest',honestOutcome:'minus',honestDelta:-lost,trustLost:lost});
    updateRank(false);
    saveState();renderAll();
    
    mascotReaction('正直に教えてくれてありがとう。今回はしょんぼり…でも次はプラスだよ。','🥺','sad');
    showModal('正直申告：減点の番',
      `今回は減点の番だったよ。<br><b>🍀 −${lost}pt / 🪙 コインの変化なし</b><br><small>${cycle.number}回目の申告。信頼度は0未満にはならないよ。次回は加点の番！</small>`,
      {icon:'♡',actions:[{label:'次はプラス！',primary:true}]});
  }
  unlockAchievements(true);
}

function saveTomorrow(){
  if(state.nightBonus&&state.nightBonusDate===tomorrowDate())return toast('明日のボーナスは予約済みだよ');
  if(!state.tomorrowItems.length)return toast('明日の持ち物を1つ以上登録してね');
  if(!state.tomorrowItems.every(x=>x.checked))return toast('明日の持ち物を全部確認してね');
  // V28.9: まじめな前日準備には直接の信頼度報酬。1日1回の予約ロックで二重獲得を防ぐ。
  const prepReward=15;
  state.nightBonus=true;state.nightBonusDate=tomorrowDate();state.trust+=prepReward;
  recordHistory({tomorrowPrepared:true,trustEarned:prepReward});updateRank(false);saveState();renderAll();
  rewardBurst(`前日準備 +${prepReward}pt / 明日×1.5！`,'🌙','night');mascotReaction('明日の準備ばっちり！信頼度もアップしたよ。','🌙','sleepy');
  showModal('明日の準備完了！',`<div class="tomorrow-success"><div class="celebration-mascot">${mascotArt(state.partner,state.rank,'grin')}</div><p>🌱 準備ボーナス：信頼度 <b>+${prepReward}pt</b></p><p>明日の獲得ポイントは <b>1.5倍</b> になるよ。</p><small>準備した持ち物は明日、自動で今日のリストに引き継がれます。</small></div>`,{icon:'🌙',actions:[{label:'おやすみ！',primary:true}]});
}
function buyItem(id){
  const item=SHOP_ITEMS.find(x=>x.id===id);if(!item)return;if(item.source!=='shop'||!Number.isFinite(item.price))return toast('このアイテムはガチャか交換所で手に入るよ');if(state.coins<item.price)return toast('コインが足りないよ');if(!item.stack&&state.inventory[id])return toast('このアイテムは持っているよ');
  state.coins-=item.price;recordHistory({coinsSpent:item.price});if(item.stack)state.inventory[id]=(state.inventory[id]||0)+1;else state.inventory[id]=true;
  saveState();renderAll();beep('reward');rewardBurst(`${item.name} GET!`,item.emoji,'item');mascotReaction(`${item.name}を手に入れたよ！`,item.emoji,'happy');unlockAchievements(true);
}
function useInventoryItem(id){
  const item=SHOP_ITEMS.find(x=>x.id===id);if(!item)return;
  if(item.type==='accessory'){
    state.equippedAccessory=state.equippedAccessory===id?null:id;
  }else if(item.type==='background'){
    state.theme=item.theme||'spring';
  }else{
    return toast('効果アイテムは報酬獲得時に自動で使われるよ');
  }
  saveState();renderAll();mascotReaction(`${item.name}${state.equippedAccessory===id||state.theme===item.theme?'を使ったよ！':'を外したよ！'}`,item.emoji,'happy');
}

function rarityForItem(id){
  return GACHA_POOL.find(x=>x.id===id)?.rarity||(SHOP_ITEMS.find(x=>x.id===id)?.source==='shop'?'SHOP':'SPECIAL');
}
function duplicateMedals(rarity){
  return {N:5,R:15,SR:40,SSR:100}[rarity]||20;
}
function renderGachaPoolPreview(){
  const box=document.getElementById('gachaPoolPreview');if(!box)return;
  const poolCount=GACHA_POOL.length;
  const summary=document.querySelector('.v28-archive summary small');if(summary)summary.textContent=`全${poolCount}種類の限定コレクション`;
  const guide=document.querySelector('.v349-scroll-guide');if(guide)guide.textContent=`全${poolCount}種類の景品を表示中。枠の中を上下にスワイプして確認できるよ。`;
  box.setAttribute('aria-label',`ガチャの提供アイテム全${poolCount}種類。上下にスクロールできます`);
  const entries=GACHA_POOL.map(p=>({...p,item:SHOP_ITEMS.find(i=>i.id===p.id)})).filter(x=>x.item?.source==='gacha');
  box.innerHTML=entries.map(x=>`<article class="pool-chip rarity-${x.rarity} ${state.inventory[x.id]?'v24-owned':''}" title="${escapeHTML(x.item.desc)}"><span>${x.item.emoji}</span><div><b>${escapeHTML(x.item.name)}</b><small>${x.rarity} · ${state.inventory[x.id]?'✓ 所持済み':'未所持'}</small></div></article>`).join('');
  const total=GACHA_POOL.reduce((s,x)=>s+x.weight,0);
  const rates=['R','SR','SSR'].map(r=>({label:r,value:GACHA_POOL.filter(x=>x.rarity===r).reduce((s,x)=>s+x.weight,0)/total*100}));
  const rt=document.getElementById('gachaRateText');if(rt)rt.textContent=rates.map(r=>`${r.label} ${r.value.toFixed(1)}%`).join(' / ');
  const detail=document.getElementById('gachaRateBreakdown');
  if(detail)detail.innerHTML=rates.map(r=>`<div class="rate-tile rarity-${r.label}"><b>${r.label}</b><strong>${r.value.toFixed(1)}%</strong><div class="rate-meter"><i style="width:${r.value}%"></i></div></div>`).join('');
}
function showMedalExchange(){
  const rainbow=SHOP_ITEMS.find(x=>x.id==='rainbowCharm');
  const owned=!!state.inventory.rainbowCharm;
  showModal('ポッケメダル交換所',`<div class="medal-exchange-head"><span>🪙</span><div><small>所持メダル</small><b>${state.pocketMedals||0}</b></div></div><div class="exchange-grid"><button data-exchange="coins" ${(state.pocketMedals||0)<80?'disabled':''}><span>🪙 80</span><b>300コイン</b><small>コインに交換</small></button><button data-exchange="rainbow" ${owned||(state.pocketMedals||0)<250?'disabled':''}><span>🪙 250</span><b>🌈 虹色チャーム</b><small>${owned?'交換済み':'交換限定アクセ'}</small></button></div><p class="modal-note">ガチャで所持済みのアクセサリーや背景が出ると、レア度に応じてメダルに変わります。</p>`,{icon:'🪙'});
  document.querySelectorAll('[data-exchange]').forEach(b=>b.onclick=()=>exchangeMedals(b.dataset.exchange));
}
function exchangeMedals(kind){
  if(kind==='coins'){
    if((state.pocketMedals||0)<80)return toast('メダルが足りないよ');
    state.pocketMedals-=80;state.coins+=300;state.totalCoinsEarned=(state.totalCoinsEarned||0)+300;recordHistory({coinsEarned:300});
    saveState();renderAll();closeModal();rewardBurst('+300コイン','🪙','reward');return;
  }
  if(kind==='rainbow'){
    if(state.inventory.rainbowCharm)return toast('もう持っているよ');
    if((state.pocketMedals||0)<250)return toast('メダルが足りないよ');
    state.pocketMedals-=250;state.inventory.rainbowCharm=true;saveState();renderAll();closeModal();
    rewardBurst('虹色ポッケチャーム GET!','🌈','item');mascotReaction('特別な虹色チャームだ！','🌈','surprise');
  }
}

function weightedGacha(forceRare=false){
  const pool=forceRare?GACHA_POOL.filter(x=>['SR','SSR'].includes(x.rarity)):GACHA_POOL;
  const total=pool.reduce((s,x)=>s+x.weight,0);
  let n=Math.random()*total,acc=0;
  for(const entry of pool){acc+=entry.weight;if(n<=acc)return entry}
  return pool[0];
}

function rollGachaResults(times=1){
  const cost=times===10?ECONOMY.gachaTen:ECONOMY.gachaSingle;
  if(state.coins<cost){toast('コインが足りないよ');return null}

  const pityBefore=state.gachaPity||0;
  state.coins-=cost;
  recordHistory({coinsSpent:cost,gachaPulls:times});
  const results=[];
  let hasRare=false;
  let totalMedals=0;

  for(let i=0;i<times;i++){
    const pityRare=(state.gachaPity||0)>=9;
    const guaranteeLast=times===10&&i===9&&!hasRare;
    const pick=weightedGacha(pityRare||guaranteeLast);
    const item=SHOP_ITEMS.find(x=>x.id===pick.id);
    if(!item||item.source!=='gacha')throw new Error('ガチャ提供アイテムが正しく設定されていません');

    const ownedBefore=!item.stack&&!!state.inventory[item.id];
    let duplicate=false,medalGain=0;

    if(item.stack){
      state.inventory[item.id]=(state.inventory[item.id]||0)+1;
    }else if(ownedBefore){
      duplicate=true;
      medalGain=duplicateMedals(pick.rarity);
      state.pocketMedals=(state.pocketMedals||0)+medalGain;
      totalMedals+=medalGain;
    }else{
      state.inventory[item.id]=true;
    }

    const rare=['SR','SSR'].includes(pick.rarity);
    if(rare){state.gachaPity=0;hasRare=true}
    else state.gachaPity=(state.gachaPity||0)+1;

    results.push({...item,rarity:pick.rarity,duplicate,medalGain});
  }

  const now=Date.now();
  const best=results.some(x=>x.rarity==='SSR')?'SSR':results.some(x=>x.rarity==='SR')?'SR':'R';
  state.gachaSessions=[{at:now,times,cost,best,pityBefore,pityAfter:state.gachaPity,totalMedals,results:results.map(x=>({id:x.id,rarity:x.rarity,duplicate:x.duplicate,medalGain:x.medalGain}))},...(state.gachaSessions||[])].slice(0,20);
  state.gachaHistory=[
    ...results.map(x=>({id:x.id,rarity:x.rarity,duplicate:x.duplicate,medalGain:x.medalGain,at:now})),
    ...(state.gachaHistory||[])
  ].slice(0,40);

  saveState();
  renderAll();
  unlockAchievements(true);

  return{times,cost,results,best,totalMedals};
}

// V28: 星降るポケットの旅。抽選と演出を分離し、SKIPでもコインとアイテムは二重処理しない。
let activeGacha=null;
let gachaRevealCount=0;
let gachaRevealFinished=false;
let gachaFxContext=null;
let gachaTimers=[];

/* V34.8: original "星のポッケ便" gacha score.
 * Synthesized in-browser; no copyrighted game soundtrack or external audio files.
 * Temporarily interrupts (does not overwrite) the user's selected background track.
 */
const GACHA_MUSIC = {
  intro: {bpm:108, melody:['B4',null,'E5',null,'G5','F#5','E5',null,'D5',null,'B4','D5','E5',null,'F#5',null],
    bass:['E3',null,null,null,'C3',null,null,null,'G2',null,null,null,'D3',null,null,null],
    chords:[['E4','G4','B4'],['C4','E4','G4'],['G3','B3','D4'],['D4','F#4','A4']]},
  flight: {bpm:138, melody:['E5','G5','B5','G5','F#5','A5','B5','D6','B5','A5','G5','E5','F#5','G5','B5','E6'],
    bass:['E3',null,'B2',null,'C3',null,'G2',null,'A2',null,'E3',null,'B2',null,'D3',null],
    chords:[['E4','G4','B4'],['C4','E4','G4'],['A3','C4','E4'],['B3','D4','F#4']]},
  sr: {bpm:146, melody:['G5','B5','D6','E6','D6','B5','G5','A5','B5','D6','E6','F#6','E6','D6','B5','G5'],
    bass:['G2',null,'D3',null,'E3',null,'B2',null,'C3',null,'G2',null,'D3',null,'G2',null],
    chords:[['G3','B3','D4'],['E4','G4','B4'],['C4','E4','G4'],['D4','F#4','A4']]},
  ssr: {bpm:154, melody:['E5','G#5','B5','E6','D#6','B5','G#5','F#5','G#5','B5','C#6','E6','F#6','E6','B5','G#5'],
    bass:['E3',null,'B2',null,'C#3',null,'G#2',null,'A2',null,'E3',null,'B2',null,'E3',null],
    chords:[['E4','G#4','B4'],['C#4','E4','G#4'],['A3','C#4','E4'],['B3','D#4','F#4']]},
  results: {bpm:116, melody:['E5',null,'G5','B5',null,'G5','F#5',null,'E5',null,'B4',null,'D5','E5',null,null],
    bass:['E3',null,null,null,'C3',null,null,null,'G2',null,null,null,'B2',null,null,null],
    chords:[['E4','G4','B4'],['C4','E4','G4'],['G3','B3','D4'],['B3','D4','F#4']]}
};
let gachaMusicActive=false,gachaMusicPhase='intro',gachaMusicStep=0,gachaMusicTimer=null,gachaMusicGain=null,gachaMusicLimiter=null;
function gachaMusicNote(note,seconds,volume,wave='triangle'){
  if(!gachaMusicActive||!bgmCtx||!gachaMusicGain||!note)return;
  const frequency=noteFreq(note);if(!frequency)return;
  const now=bgmCtx.currentTime,osc=bgmCtx.createOscillator(),env=bgmCtx.createGain();
  osc.type=wave;osc.frequency.setValueAtTime(frequency,now);
  env.gain.setValueAtTime(.0001,now);
  env.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),now+.022);
  env.gain.exponentialRampToValueAtTime(.0001,now+Math.max(.065,seconds));
  osc.connect(env);env.connect(gachaMusicGain);
  osc.start(now);osc.stop(now+Math.max(.065,seconds)+.03);
  osc.onended=()=>{try{osc.disconnect();env.disconnect()}catch{}};
}
function playGachaMusicStep(){
  if(!gachaMusicActive||!state.bgmEnabled)return;
  const phrase=GACHA_MUSIC[gachaMusicPhase]||GACHA_MUSIC.intro;
  const n=gachaMusicStep%phrase.melody.length;
  const speed=state.gachaSpeed===2?1.22:1;
  const interval=60/(phrase.bpm*speed)/2;
  const note=phrase.melody[n];
  if(note)gachaMusicNote(note,interval*.90,.245,gachaMusicPhase==='ssr'?'triangle':'sine');
  if(n%2===0)gachaMusicNote(phrase.bass[n],interval*1.75,.205,'triangle');
  if(n%4===0)phrase.chords[Math.floor(n/4)%4].forEach((chordNote,i)=>gachaMusicNote(chordNote,interval*3.4,.058,i===1?'sine':'triangle'));
  gachaMusicStep++;
  gachaMusicTimer=setTimeout(playGachaMusicStep,interval*1000);
}
function setGachaMusicPhase(phase){
  if(!GACHA_MUSIC[phase])return;
  if(gachaMusicPhase!==phase){gachaMusicPhase=phase;gachaMusicStep=0}
}
function startGachaMusic(){
  // The normal BGM keeps its saved settings; its playback merely pauses.
  duckBGM(0);
  if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null}
  if(bgmAudio)bgmAudio.pause();
  if(gachaMusicTimer){clearTimeout(gachaMusicTimer);gachaMusicTimer=null}
  gachaMusicActive=false;gachaMusicPhase='intro';gachaMusicStep=0;
  if(!state.bgmEnabled||Number(state.bgmVolume)<=0)return;
  try{
    const ctx=ensureBgmAudio();
    if(!gachaMusicGain){
      gachaMusicGain=ctx.createGain();gachaMusicGain.gain.value=0;
      // Limit peaks when several notes coincide, keeping the melody audible without distortion.
      if(typeof ctx.createDynamicsCompressor==='function'){
        gachaMusicLimiter=ctx.createDynamicsCompressor();
        gachaMusicLimiter.threshold.value=-16;gachaMusicLimiter.knee.value=12;
        gachaMusicLimiter.ratio.value=7;gachaMusicLimiter.attack.value=.007;gachaMusicLimiter.release.value=.15;
        gachaMusicGain.connect(gachaMusicLimiter);gachaMusicLimiter.connect(ctx.destination);
      }else gachaMusicGain.connect(ctx.destination);
    }
    const now=ctx.currentTime;
    gachaMusicGain.gain.cancelScheduledValues(now);
    gachaMusicGain.gain.setValueAtTime(0,now);
    gachaMusicGain.gain.linearRampToValueAtTime(Math.min(.78,Math.max(0,state.bgmVolume)*1.85),now+.24);
    gachaMusicActive=true;playGachaMusicStep();
  }catch(err){console.info('ガチャBGMを再生できません:',err?.name||err)}
}
function stopGachaMusic(){
  gachaMusicActive=false;
  if(gachaMusicTimer){clearTimeout(gachaMusicTimer);gachaMusicTimer=null}
  if(gachaMusicGain&&bgmCtx){
    const now=bgmCtx.currentTime;
    gachaMusicGain.gain.cancelScheduledValues(now);
    gachaMusicGain.gain.setValueAtTime(gachaMusicGain.gain.value,now);
    gachaMusicGain.gain.linearRampToValueAtTime(0,now+.16);
  }
  restoreBGM();
  if(!state.bgmEnabled)return;
  // Closing the gacha is a user gesture; try to restore tracks previously blocked by autoplay.
  if(!bgmPlaying)bgmPlaying=true;
  if(state.bgmTrack==='pocketpop'){
    const audio=ensurePokkeAudio();
    const pending=audio.play();
    if(pending?.catch)pending.catch(()=>{bgmPlaying=false;armBgmResume()});
    updatePokkeAudioVolume();
  }else if(!bgmTimer){ensureBgmAudio();playBgmStep()}
}

function getGachaAudio(){
  if(!state.sound||!(window.AudioContext||window.webkitAudioContext))return null;
  try{if(!gachaFxContext)gachaFxContext=new (window.AudioContext||window.webkitAudioContext)();if(gachaFxContext.state==='suspended')gachaFxContext.resume().catch(()=>{});return gachaFxContext}catch{return null}
}
function gachaTone(freq=520,duration=.14,gain=.024,type='sine'){
  if(!state.sound)return;
  try{const ac=getGachaAudio();if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=freq;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.0005,ac.currentTime);g.gain.linearRampToValueAtTime(gain,ac.currentTime+.022);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+duration);o.start();o.stop(ac.currentTime+duration+.015)}catch{}
}
function gachaChord(kind){
  const notes=kind==='SSR'?[392,523,659,784,1047]:kind==='SR'?[392,494,587,784]:[330,440,523];
  notes.forEach((f,i)=>gachaLater(()=>gachaTone(f,.32,.025,'triangle'),i*95));
}
function gachaSafeVibrate(ms){if(!state.powerSaving&&navigator.vibrate)try{navigator.vibrate(ms)}catch{}}
// Reduced motion is visual only: never auto-skip the sequence based on PC/OS preference.
function gachaReduced(){return !!(state.reducedMotion||state.powerSaving||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)}
function gachaUpdateScene(label){const el=document.getElementById('gachaSceneLabel');if(el)el.textContent=label}
function clearGachaTimers(){for(const t of gachaTimers)clearTimeout(t);gachaTimers=[]}
function gachaLater(fn,ms){const speed=state.gachaSpeed===2?2:1;const t=setTimeout(fn,Math.round(ms/speed));gachaTimers.push(t);return t}
function renderGachaExtras(){
  const owned=GACHA_POOL.filter(x=>!!state.inventory[x.id]).length;
  const count=document.getElementById('gachaCollectionCount'),bar=document.getElementById('gachaCollectionBar'),hint=document.getElementById('gachaCollectionHint');
  if(count)count.textContent=`${owned} / ${GACHA_POOL.length}`;
  if(bar)bar.style.width=`${Math.round(owned/GACHA_POOL.length*100)}%`;
  if(hint)hint.textContent=owned===GACHA_POOL.length?'コンプリート！':`${GACHA_POOL.length-owned}種類の宝物が待っているよ`;
  const pity=Math.max(0,Math.min(9,state.gachaPity||0));
  const dots=document.getElementById('gachaPityDots');
  if(dots)dots.innerHTML=Array.from({length:10},(_,i)=>`<i class="${i<pity?'filled':''} ${i===9?'milestone':''}" aria-hidden="true"></i>`).join('');
  const speed=document.getElementById('gachaSpeedBtn');if(speed){speed.textContent=state.gachaSpeed===2?'⏩ 2倍速（約4秒）':'▶ 標準速度（約8秒）';speed.title='ポケットパスが出てから結果表示までの目安。タップで切り替えます。';}
  const bal=document.getElementById('gachaWalletBalance');if(bal)bal.textContent=state.coins.toLocaleString('ja-JP');
  const single=document.getElementById('gachaOneBtn'),ten=document.getElementById('gachaTenBtn');
  if(single){single.disabled=state.coins<ECONOMY.gachaSingle;single.setAttribute('aria-label',`1回ガチャ ${ECONOMY.gachaSingle}コイン`)}
  if(ten){ten.disabled=state.coins<ECONOMY.gachaTen;ten.setAttribute('aria-label',`10回ガチャ ${ECONOMY.gachaTen}コイン、SR以上1個確定`)}
  const wallet=document.getElementById('gachaWalletNote');
  if(wallet)wallet.textContent=state.coins<ECONOMY.gachaSingle?'コインが足りないよ。毎日のミッションで集めよう。':state.coins<ECONOMY.gachaTen?`10連まであと ${ECONOMY.gachaTen-state.coins} コイン`:'ポケットの旅に出発できるよ！';
}
function showGachaRatesDetail(){
  const total=GACHA_POOL.reduce((a,b)=>a+b.weight,0);
  const rows=GACHA_POOL.map(p=>{const item=SHOP_ITEMS.find(x=>x.id===p.id);return `<div class="v24-rate-row"><span class="v24-rarity-dot grade-${p.rarity}">${p.rarity}</span><span>${escapeHTML(item?.name||p.id)}</span><b>${(p.weight/total*100).toFixed(2)}%</b></div>`}).join('');
  showModal('星降るポケット・提供割合',`<p class="v24-modal-lead">通常抽選 R 80% / SR 17% / SSR 3%</p><p class="modal-note">下へスクロールすると全14種類を確認できるよ。</p><div class="v24-rate-detail">${rows}</div><p class="modal-note">10連はSR以上が最低1つ確定。SR以上が9回連続で出なかった場合も次回の抽選でSR以上が確定します。保証時はSRとSSRの重み比による再抽選です。SKIP・速度変更は確率に影響しません。ショップ商品は排出されません。</p>`,{icon:'✦'});
}
function showGachaHistory(){
  const sessions=state.gachaSessions||[],old=state.gachaHistory||[];
  const rows=sessions.length?sessions.slice(0,12).map(s=>{
    const date=new Date(s.at).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const loot=s.results.map(r=>{const item=SHOP_ITEMS.find(x=>x.id===r.id);return `<span class="v24-history-chip rarity-${r.rarity}">${item?.emoji||'🎁'} ${r.rarity}${r.duplicate?' 🪙':''}</span>`}).join('');
    return `<article class="v24-history-session"><div><b>${s.times===10?'10連':'1回'}・${date}</b><small>◉ ${Number(s.cost||0).toLocaleString()} / 最高 ${s.best}</small></div><div class="v24-history-loot">${loot}</div></article>`;
  }).join(''):old.length?old.slice(0,20).map(r=>`<span class="v24-history-chip rarity-${r.rarity}">${escapeHTML(SHOP_ITEMS.find(x=>x.id===r.id)?.name||r.id)} ${r.rarity}</span>`).join(''):'<p class="v24-empty">まだガチャの記録がないよ。</p>';
  showModal('ポケットの旅の記録',`<div class="v24-history-list">${rows}</div><p class="modal-note">コインと景品はガチャ開始時に保存されるため、演出を飛ばしても結果は変わりません。</p>`,{icon:'📖'});
}
function toggleGachaSpeed(){state.gachaSpeed=state.gachaSpeed===2?1:2;saveState();renderGachaExtras();toast(state.gachaSpeed===2?'演出を2倍速にしたよ':'標準速度に戻したよ')}
function resetGachaCinematic(){
  clearGachaTimers();gachaRevealCount=0;gachaRevealFinished=false;
  const root=document.getElementById('gachaCinematic');
  root.className='gacha-cinematic v28-cine v286-cine phase-intro';
  root.removeAttribute('data-rarity');root.style.setProperty('--gacha-timing', state.gachaSpeed===2?'.5':'1');
  root.dataset.speed=String(state.gachaSpeed);
  const pace=document.getElementById('v287SpeedBadge');if(pace)pace.textContent=state.gachaSpeed===2?'⏩ 2倍速':'▶ 標準速度';
  root.setAttribute('aria-hidden','false');
  for(const id of ['gachaOpenBtn','gachaSsrCutin','gachaRevealPanel'])document.getElementById(id).classList.add('hidden');
  document.getElementById('gachaRevealGrid').innerHTML='';document.getElementById('gachaSsrPartner').innerHTML='';
  document.getElementById('gachaRarityOrb').className='gacha-rarity-orb';
  document.getElementById('gachaSkipBtn').textContent='演出をスキップ ›';
  const track=document.getElementById('v286Progress');if(track)track.style.width='0%';
  const subtitle=document.getElementById('v286RarityLabel');if(subtitle)subtitle.textContent='星の旅がはじまる';
  // Prevent page scrolling while the full-viewport cinematic is in progress.
  document.documentElement.classList.add('gacha-fullscreen');
}
function startGachaCinematic(payload){
  if(!payload)return;
  activeGacha=payload;resetGachaCinematic();startGachaMusic();
  const root=document.getElementById('gachaCinematic');
  document.getElementById('gachaCineTitle').textContent=payload.times===10?'十の星が巡る旅':'星降るポケットの旅';
  document.getElementById('gachaCineMessage').textContent='ポケットパスに、ひとつ願いを込めて…';
  gachaUpdateScene('01 / 星のパス');gachaTone(440,.3,.026,'triangle');
  // Manual opening remains a deliberate user action, independent of viewport size.
  const ready=()=>{
    if(!activeGacha||!root.classList.contains('phase-intro'))return;
    root.className='gacha-cinematic v28-cine v286-cine phase-ready';
    document.getElementById('gachaOpenBtn').classList.remove('hidden');
    document.getElementById('gachaCineMessage').textContent='パスが輝いた！ ポケットの旅へ出発しよう';
    gachaUpdateScene('02 / 出発のとき');
    gachaTone(659,.18,.022,'sine');
    const subtitle=document.getElementById('v286RarityLabel');if(subtitle)subtitle.textContent='TAP TO DEPART';
    document.getElementById('gachaOpenBtn').focus({preventScroll:true});
  };
  gachaLater(ready,2000);
}
function openGachaPocket(){
  if(!activeGacha)return;
  const root=document.getElementById('gachaCinematic');if(!root.classList.contains('phase-ready'))return;
  setGachaMusicPhase('flight');
  root.className='gacha-cinematic v28-cine v286-cine phase-launch';
  document.getElementById('gachaOpenBtn').classList.add('hidden');
  document.getElementById('gachaCineMessage').textContent='星空へ、ポケットパスが飛び立つ！';
  gachaUpdateScene('03 / 星間航行');
  const orb=document.getElementById('gachaRarityOrb');orb.className='gacha-rarity-orb orb-blue';
  const progress=document.getElementById('v286Progress');
  const label=document.getElementById('v286RarityLabel');
  const update=(percent,title)=>{if(progress)progress.style.width=percent+'%';if(label)label.textContent=title};
  update(9,'星の道を進んでいるよ');
  gachaSafeVibrate(20);gachaTone(380,.29,.026,'sine');
  const best=activeGacha.best;
  // All named phases share the same timeline on PCs, tablets, and phones.
  // 2x applies ONLY when the user explicitly chose it.
  gachaLater(()=>{
    root.className='gacha-cinematic v28-cine v286-cine phase-flight';
    update(26,'流れ星が加速する…');
    document.getElementById('gachaCineMessage').textContent='星のトンネルを抜けて…';
    gachaUpdateScene('04 / 星の海');gachaTone(523,.23,.022,'sine');
  },980);
  gachaLater(()=>{
    root.className='gacha-cinematic v28-cine v286-cine phase-charge';
    update(48,'光の色が変わりはじめた');
    document.getElementById('gachaCineMessage').textContent='ポケットに星の光が集まる…';
    gachaUpdateScene('05 / 光の気配');gachaTone(587,.32,.025,'triangle');
  },2300);
  if(best==='SR'||best==='SSR')gachaLater(()=>{
    setGachaMusicPhase('sr');
    root.dataset.rarity='SR';orb.className='gacha-rarity-orb orb-violet';
    update(66,'紫色の星が輝いている…！');
    document.getElementById('gachaCineMessage').textContent='紫色の光…レアな宝物の予感！';
    gachaChord('SR');
  },3250);
  if(best==='SSR')gachaLater(()=>{
    setGachaMusicPhase('ssr');
    root.dataset.rarity='SSR';orb.className='gacha-rarity-orb orb-rainbow';
    update(81,'金色から七色へ…奇跡の光！');
    document.getElementById('gachaCineMessage').textContent='金色の閃光！ 虹色の星が降ってくる…！';
    gachaChord('SSR');gachaSafeVibrate([25,20,65]);
  },4050);
  gachaLater(()=>{
    root.className='gacha-cinematic v28-cine v286-cine phase-open';
    root.dataset.rarity=best;update(100,best==='SSR'?'七色の扉が開いた！':best==='SR'?'紫のポケットが開いた！':'光るポケットが開いた！');
    gachaUpdateScene('06 / ポケットの扉');gachaTone(best==='SSR'?1047:784,.55,.038,'triangle');
    document.getElementById('gachaCineMessage').textContent=best==='SSR'?'最高の輝きの向こうに、特別な宝物！':'宝物が、ポケットから飛び出す！';
    gachaSafeVibrate(25);
  },5100);
  gachaLater(()=>best==='SSR'?showGachaSsrCutin():showGachaResultsAnimated(),6150);
}
function showGachaSsrCutin(){
  if(!activeGacha)return;
  const prize=activeGacha.results.find(x=>x.rarity==='SSR');if(!prize)return showGachaResultsAnimated();
  const root=document.getElementById('gachaCinematic');root.className='gacha-cinematic v28-cine v286-cine phase-ssr';root.dataset.rarity='SSR';
  document.getElementById('gachaSsrEmoji').textContent=prize.emoji;document.getElementById('gachaSsrName').textContent=prize.name;
  document.getElementById('gachaSsrPartner').innerHTML=mascotArt(state.partner,state.rank,'surprise');
  document.getElementById('gachaSsrCutin').classList.remove('hidden');
  document.getElementById('gachaCineMessage').textContent='奇跡の宝物が見つかったよ！';
  gachaUpdateScene('SPECIAL / 星が虹になる瞬間');gachaChord('SSR');
  gachaLater(()=>showGachaResultsAnimated(),2300);
}
function resultCardHtml(x,i){
  const rarityLabel=x.rarity==='SSR'?'虹の奇跡':x.rarity==='SR'?'輝く星':'旅の星';
  return `<button type="button" class="v28-result-card rarity-${x.rarity}" data-result-index="${i}" aria-label="${i+1}個目の宝物を開く"><span class="v28-card-back"><i>✦</i><small>STAR POCKET</small></span><span class="v28-card-front"><em>${x.rarity} · ${rarityLabel}</em><strong>${x.emoji}</strong><b>${escapeHTML(x.name)}</b><small>${x.duplicate?`🪙 +${x.medalGain} メダル`:'NEW / 限定コレクション'}</small></span></button>`;
}
function inspectGachaCard(index){
  if(!activeGacha)return;const x=activeGacha.results[index];if(!x)return;
  document.getElementById('gachaRevealHint').textContent=x.duplicate?`${x.name}：かぶりでメダル +${x.medalGain}`:`${x.name}：${x.desc||'限定アイテム'}`;
}
function revealGachaCard(index){
  if(!activeGacha)return;const grid=document.getElementById('gachaRevealGrid'),card=grid?.querySelector(`[data-result-index="${index}"]`);
  if(!card||card.classList.contains('revealed')){if(card?.classList.contains('revealed'))inspectGachaCard(index);return}
  card.classList.add('revealed');card.setAttribute('aria-label',`${index+1}個目：${activeGacha.results[index].name} ${activeGacha.results[index].rarity}`);
  const x=activeGacha.results[index];
  if(x.rarity==='SSR'){gachaChord('SSR');gachaSafeVibrate([20,20,40])}else if(x.rarity==='SR')gachaTone(660,.21,.03,'triangle');else gachaTone(480+index*9,.09,.014);
  gachaRevealCount++;document.getElementById('gachaRevealProgress').textContent=`${gachaRevealCount} / ${activeGacha.times} 開封`;
  if(gachaRevealCount===activeGacha.times){document.getElementById('gachaRevealAllBtn').classList.add('hidden');document.getElementById('gachaRevealHint').textContent='すべての宝物を確認できたよ！';gachaLater(finishGachaReveal,270)}
}
function revealAllGachaCards(){
  if(!activeGacha)return;clearGachaTimers();
  document.querySelectorAll('#gachaRevealGrid .v28-result-card').forEach(c=>c.classList.add('revealed'));
  gachaRevealCount=activeGacha.times;document.getElementById('gachaRevealProgress').textContent=`${gachaRevealCount} / ${activeGacha.times} 開封済み`;
  document.getElementById('gachaRevealAllBtn').classList.add('hidden');document.getElementById('gachaRevealHint').textContent='すべての宝物を確認できたよ！';finishGachaReveal();
}
function showGachaResultsAnimated(skipAnimation=false){
  if(!activeGacha)return;clearGachaTimers();
  setGachaMusicPhase('results');
  const root=document.getElementById('gachaCinematic'),panel=document.getElementById('gachaRevealPanel'),grid=document.getElementById('gachaRevealGrid');
  root.className='gacha-cinematic v28-cine v286-cine phase-results';root.dataset.rarity=activeGacha.best;gachaUpdateScene('07 / 旅の結果');
  document.getElementById('gachaSsrCutin').classList.add('hidden');panel.classList.remove('hidden');gachaRevealCount=0;gachaRevealFinished=false;
  document.getElementById('gachaRevealSub').textContent=activeGacha.times===10?'10 PULL / TREASURES':'SINGLE / TREASURE';
  if(activeGacha.demo)document.getElementById('gachaRevealSub').textContent='CINEMATIC PREVIEW / 景品獲得なし';
  document.getElementById('gachaRevealTitle').textContent=activeGacha.times===10?'10個の宝物が届いたよ':'ポケットから宝物！';
  const best=document.getElementById('gachaRevealBest');best.textContent=activeGacha.best;best.className=`v28-best rarity-${activeGacha.best}`;
  document.getElementById('gachaResultMedals').textContent=activeGacha.totalMedals?`🪙 メダル +${activeGacha.totalMedals}`:'✦ コレクションへ';
  document.getElementById('gachaRevealProgress').textContent=`0 / ${activeGacha.times} 開封`;
  document.getElementById('gachaRevealHint').textContent='カードを押すと詳細も見られるよ';
  document.getElementById('gachaRevealAllBtn').classList.toggle('hidden',activeGacha.times===1);
  const again=document.getElementById('gachaAgainBtn');again.disabled=true;
  grid.className=`gacha-reveal-grid v28-result-grid ${activeGacha.times===10?'ten-grid':'single-grid'}`;
  grid.innerHTML=activeGacha.results.map(resultCardHtml).join('');
  grid.querySelectorAll('[data-result-index]').forEach(c=>c.onclick=()=>revealGachaCard(Number(c.dataset.resultIndex)));
  if(skipAnimation){revealAllGachaCards();return}
  activeGacha.results.forEach((_,i)=>gachaLater(()=>revealGachaCard(i),240+i*(activeGacha.times===10?410:0)));
}
function finishGachaReveal(){
  if(gachaRevealFinished||!activeGacha)return;gachaRevealFinished=true;
  const again=document.getElementById('gachaAgainBtn'),p=activeGacha;
  const price=p.times===10?ECONOMY.gachaTen:ECONOMY.gachaSingle;
  again.disabled=state.coins<price;again.textContent=again.disabled?'コイン不足':p.times===10?'もう10回引く':'もう1回引く';
  if(p.demo){again.disabled=true;again.textContent='これは演出のデモだよ';}
  document.getElementById('gachaSkipBtn').textContent='結果表示中';
  
  const message=p.best==='SSR'?'SSRの宝物だ！すごいね！':p.best==='SR'?'SRの宝物が出たね！':p.totalMedals>0?'かぶった分はメダルになったよ！':'新しい宝物を見つけたね！';
  mascotReaction(message,p.best==='SSR'?'🌈':'✨',p.best==='SSR'?'surprise':'happy');
  beep('reward');
}
function skipGachaCinematic(){
  if(!activeGacha)return;
  if(document.getElementById('gachaCinematic').classList.contains('phase-results'))return revealAllGachaCards();
  clearGachaTimers();showGachaResultsAnimated(true);
}
function closeGachaCinematic(){
  clearGachaTimers();document.getElementById('gachaCinematic').className='gacha-cinematic v28-cine v286-cine hidden';document.getElementById('gachaCinematic').setAttribute('aria-hidden','true');document.documentElement.classList.remove('gacha-fullscreen');activeGacha=null;stopGachaMusic();renderAll();
}
function doGacha(times=1){
  if(activeGacha)return toast('先に今のガチャ結果を確認してね');
  const payload=rollGachaResults(times);if(payload)startGachaCinematic(payload);
}


/* V34.7 — Walking is opt-in, auto-recorded only in the foreground.
 * No GPS coordinates are saved. Only validated distances and totals persist.
 * 100m = 20 trust points (max 200/day); 200m = 30 coins (max 300/day).
 */
const WALK_PROGRESS_REWARDS=Array.from({length:10},(_,i)=>({m:(i+1)*100,pt:20}));
let walkPermissionPromptShown=false,walkBooted=false,walkStarting=false,walkRequestSerial=0;
function claimWalkProgressRewards(){
  const claimed=Array.isArray(state.walkRewardedStages)?state.walkRewardedStages:[];
  let pt=0,count=0;
  for(const step of WALK_PROGRESS_REWARDS){
    if(state.walkMeters+0.000001>=step.m&&!claimed.includes(step.m)){
      claimed.push(step.m);pt+=step.pt;count++;
    }
  }
  state.walkRewardedStages=claimed;
  return {pt,count};
}
function renderWalkBonusUI(){
  const projected=Math.max(0,state.walkMeters+(walkSession?.active?Math.max(0,walkSession.distance-walkSession.creditedDistance):0));
  const e=document.getElementById('walkBonusEarned'),n=document.getElementById('walkBonusNext'),bar=document.getElementById('walkBonusMeter');
  const coins=document.getElementById('walkCoinEarned'),cn=document.getElementById('walkCoinNext'),cm=document.getElementById('walkCoinMeter');
  if(e)e.textContent=`今日の獲得 ${Math.min(200,state.walkBonusPointsToday||0)} / 200pt`;
  if(bar){bar.style.width=`${Math.min(100,projected/1000*100)}%`;bar.setAttribute('aria-valuenow',String(Math.min(100,Math.round(projected/1000*100))))}
  if(n){const target=Math.min(1000,(Math.floor(projected/100)+1)*100);
    n.textContent=projected>=1000?'本日の信頼度ボーナス達成！':`次の20ptまで あと${Math.max(0,Math.ceil(target-projected))}m`}
  const claimed=(state.claimedWalkMissions||[]).filter(m=>m>=200&&m<=2000&&m%200===0).length;
  if(coins)coins.textContent=`本日の獲得枠 ${claimed}/10（最大300コイン）`;
  if(cm){cm.style.width=`${Math.min(100,projected/2000*100)}%`;cm.setAttribute('aria-valuenow',String(Math.min(100,Math.round(projected/2000*100))))}
  if(cn)cn.textContent=projected>=2000?'本日のコインボーナス達成！':`次の30コインまで あと${Math.max(0,Math.ceil(Math.min(2000,(Math.floor(projected/200)+1)*200)-projected))}m`;
  const label=document.getElementById('walkAutoState');
  if(label)label.textContent=walkSession?.active?'位置情報を使用して自動記録中':state.walkAutoEnabled?'自動記録は一時停止中':'自動計測はOFF';
  const start=document.getElementById('startWalkBtn'),stop=document.getElementById('finishWalkBtn');
  if(start)start.textContent=walkSession?.active?'✅ 自動計測中':'📍 自動計測をON';
  if(start)start.disabled=!!walkSession?.active||walkStarting;
  if(stop)stop.textContent='⏸ 計測をOFF';
  if(stop)stop.disabled=!state.walkAutoEnabled&&!walkSession?.active;
}
function formatWalkTime(sec){
  sec=Math.max(0,Math.floor(sec||0));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}
function updateWalkLiveUI(){
  const d=walkSession?.active?Math.max(0,walkSession.distance-walkSession.creditedDistance):0;
  const elapsed=walkSession?.active?(Date.now()-walkSession.startedAt)/1000:0;
  const de=document.getElementById('walkSessionDistance'),te=document.getElementById('walkSessionTime');
  if(de)de.textContent=`${Math.round(d)}m`;
  if(te)te.textContent=formatWalkTime(elapsed);
  const projected=state.walkMeters+d,meter=document.getElementById('questMeter'),top=document.getElementById('questDistanceTop');
  if(meter)meter.style.width=`${Math.min(100,projected/APP_CONFIG.walkGoal*100)}%`;
  if(top)top.textContent=`${Math.round(projected)}m`;
  renderWalkBonusUI();
}
function stopWalkTracking(){
  if(!walkSession)return;
  walkSession.active=false;
  if(walkSession.watchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(walkSession.watchId);
  if(walkSession.timer)clearInterval(walkSession.timer);
  walkSession=null;startPosition=null;
  updateWalkLiveUI();
}
function commitAutoWalkProgress(force=false){
  if(!walkSession?.active)return;
  const session=walkSession;
  const delta=Math.max(0,session.distance-session.creditedDistance);
  // Reject stationary jitter and implausibly short sessions; save in small batches.
  if(session.validSegments<2||Date.now()-session.startedAt<APP_CONFIG.walkMinSeconds*1000)return;
  if(delta<(force?4:10))return;
  if(state.walkDate!==TODAY())normalizeDaily();
  state.walkMeters+=delta;
  state.totalWalkMeters=(state.totalWalkMeters||0)+delta;
  session.creditedDistance=session.distance;
  recordHistory({walkMeters:delta});
  const trustReward=claimWalkProgressRewards();
  const coinReward=claimWalkMissions();
  if(trustReward.pt){
    state.trust+=trustReward.pt;
    state.walkBonusPointsToday=Math.min(200,(state.walkBonusPointsToday||0)+trustReward.pt);
    recordHistory({trustEarned:trustReward.pt});
    updateRank(false);
  }
  saveState();
  if(trustReward.pt||coinReward){
    const hc=document.getElementById('homeCoins'),ht=document.getElementById('homeTrust');
    if(hc)hc.textContent=state.coins;
    if(ht)ht.textContent=state.trust;
    const message=[trustReward.pt?`信頼度 +${trustReward.pt}pt`:'',coinReward?`コイン +${coinReward}枚`:''].filter(Boolean).join(' / ');
    const el=document.getElementById('gpsStatus');if(el)el.textContent=`歩いた分を記録したよ！ ${message}`;
  }
  if(currentScreen==='quest')renderMissions();
  updateWalkLiveUI();
}
function trackWalkPosition(pos){
  if(!walkSession?.active||document.hidden)return;
  const acc=Number(pos.coords.accuracy)||999,status=document.getElementById('gpsStatus');
  if(acc>APP_CONFIG.walkMaxAccuracy){if(status)status.textContent=`GPS精度を調整中…（±${Math.round(acc)}m）`;return;}
  const now=pos.timestamp||Date.now(),curr={lat:pos.coords.latitude,lon:pos.coords.longitude,at:now,accuracy:acc};
  if(state.walkDate!==TODAY()){
    // Never credit yesterday's unsaved distance to the new day.
    walkSession.distance=0;walkSession.creditedDistance=0;
    walkSession.validSegments=0;walkSession.startedAt=Date.now();
    walkSession.lastPos=curr;
    normalizeDaily();updateWalkLiveUI();return;
  }
  const prev=walkSession.lastPos;
  if(prev){
    const dt=(curr.at-prev.at)/1000;
    if(dt>0&&dt<=45){
      const seg=distance(prev.lat,prev.lon,curr.lat,curr.lon),speed=seg/dt;
      if(seg>=4&&seg<=150&&speed>=.35&&speed<=APP_CONFIG.walkMaxSpeed){
        walkSession.distance+=seg;walkSession.validSegments++;
        commitAutoWalkProgress();
      }else if(speed>APP_CONFIG.walkMaxSpeed){walkSession.rejectedSpeed++}
    }
  }
  walkSession.lastPos=curr;
  walkSession.bestAccuracy=Math.min(walkSession.bestAccuracy,acc);
  if(status&&status.textContent?.startsWith('計測中'))status.textContent=`計測中… GPS ±${Math.round(acc)}m`;
  updateWalkLiveUI();
}
function startWalk(autoResume=false){
  if(walkSession?.active||walkStarting)return;
  const status=document.getElementById('gpsStatus');
  if(!navigator.geolocation||!window.isSecureContext){
    if(status)status.textContent='自動記録にはHTTPSなどの安全な環境で位置情報の許可が必要です';
    if(!autoResume)toast('位置情報が使えません。HTTPS公開版で試してね');
    return;
  }
  if(document.hidden)return;
  walkStarting=true;
  const token=++walkRequestSerial;
  if(status)status.textContent='位置情報の許可・GPSの精度を確認中…';
  updateWalkLiveUI();
  navigator.geolocation.getCurrentPosition(pos=>{
    if(token!==walkRequestSerial)return;
    walkStarting=false;
    if(document.hidden||!walkBooted||state.walkAutoEnabled===false&&autoResume){updateWalkLiveUI();return;}
    const now=Date.now();
    state.walkAutoEnabled=true;state.walkLocationChoice='enabled';saveState();
    walkSession={active:true,startedAt:now,distance:0,creditedDistance:0,watchId:null,timer:null,
      bestAccuracy:Number(pos.coords.accuracy)||999,validSegments:0,rejectedSpeed:0,
      lastPos:{lat:pos.coords.latitude,lon:pos.coords.longitude,at:pos.timestamp||now,accuracy:Number(pos.coords.accuracy)||999}};
    walkSession.watchId=navigator.geolocation.watchPosition(trackWalkPosition,err=>{
      if(err.code===1){state.walkAutoEnabled=false;state.walkLocationChoice='later';saveState();stopWalkTracking();}
      if(status)status.textContent=err.code===1?'位置情報が拒否されました。設定から許可してね':'GPS信号を待っています…';
    },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
    walkSession.timer=setInterval(updateWalkLiveUI,2000);
    if(status)status.textContent='計測中…アプリを開いて歩くと自動で記録するよ';
    updateWalkLiveUI();
  },err=>{
    if(token!==walkRequestSerial)return;
    walkStarting=false;
    if(err.code===1){state.walkAutoEnabled=false;state.walkLocationChoice='later';saveState();}
    if(status)status.textContent=err.code===1?'位置情報が許可されていないため記録できません':'GPSを取得できませんでした。再試行してね';
    updateWalkLiveUI();
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
function finishWalk(){
  ++walkRequestSerial;walkStarting=false;
  if(walkSession?.active)commitAutoWalkProgress(true);
  stopWalkTracking();
  state.walkAutoEnabled=false;state.walkLocationChoice='later';saveState();
  const status=document.getElementById('gpsStatus');
  if(status)status.textContent='自動記録をOFFにしたよ。再開はボタンから。';
  updateWalkLiveUI();
}
function promptAutomaticWalkPermission(){
  if(walkPermissionPromptShown||!walkBooted||!state.userName||!state.tutorialDone)return;
  walkPermissionPromptShown=true;
  if(state.walkAutoEnabled){resumeAutoWalkWithPermission();return}
  if(state.walkLocationChoice!=='unset')return;
  showModal('歩く距離を自動で記録する？',`<p>アプリを開いている間、位置情報で歩いた距離を自動計測するよ。</p>
    <p><b>100mごとに信頼度20pt、200mごとに30コイン</b>がもらえるよ。</p>
    <p class="modal-note">位置情報の許可は任意。緯度・経度は保存せず、確認された距離だけを端末に保存するよ。アプリを閉じたり画面を離れたりすると記録は止まるよ。</p>`,
    {icon:'👟',actions:[
      {label:'許可して自動計測',primary:true,onClick:()=>startWalk(false)},
      {label:'今はしない',onClick:()=>{state.walkAutoEnabled=false;state.walkLocationChoice='later';saveState();updateWalkLiveUI();}}
    ]});
}
async function resumeAutoWalkWithPermission(){
  if(!state.walkAutoEnabled||!walkBooted||document.hidden||walkSession?.active||walkStarting)return;
  if(!navigator.geolocation||!window.isSecureContext){updateWalkLiveUI();return}
  try{
    if(!navigator.permissions)return;
    const p=await navigator.permissions.query({name:'geolocation'});
    if(p.state==='granted')startWalk(true);
    else{const status=document.getElementById('gpsStatus');if(status)status.textContent='位置情報を再度許可するには「自動計測をON」を押してね';}
  }catch{/* Permissions API unavailable. User can still resume with the button. */}
}
function beginWalkAppSession(){walkBooted=true;promptAutomaticWalkPermission()}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    ++walkRequestSerial;walkStarting=false;
    if(walkSession?.active)commitAutoWalkProgress(true);
    stopWalkTracking();
  }else if(walkBooted&&state.walkAutoEnabled){resumeAutoWalkWithPermission()}
});
window.addEventListener('pagehide',()=>{++walkRequestSerial;walkStarting=false;if(walkSession?.active)commitAutoWalkProgress(true);stopWalkTracking()});
function distance(a,b,c,d){const R=6371e3,p1=a*Math.PI/180,p2=c*Math.PI/180,dp=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180;const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}


let cameraFacing='environment',cameraDeviceId='',cameraTorch=false,cameraCaptured=false,cameraImageUrl='';
let cameraRequestToken=0,cameraAnalyzeToken=0;
function cameraStatus(msg){const el=document.getElementById('aiStatus');if(el)el.textContent=msg}
function clearCameraOverlay(){const canvas=document.getElementById('detectCanvas');const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height)}
function setCameraImageVisible(visible){
  document.getElementById('uploadPreview').style.display=visible?'block':'none';
  document.getElementById('cameraVideo').style.display=visible?'none':(webcamStream?'block':'none');
  document.getElementById('cameraPlaceholder').classList.toggle('hidden',visible||!!webcamStream);
  document.getElementById('cameraAnalyzeBtn').disabled=!visible;
  document.getElementById('cameraCaptureBtn').disabled=!webcamStream;
  document.getElementById('cameraFlipBtn').disabled=!navigator.mediaDevices?.getUserMedia;
}
function updateCameraTools(){
  const tools=document.getElementById('cameraTools'),torch=document.getElementById('cameraTorchBtn'),zoomWrap=document.getElementById('cameraZoomWrap');
  tools.classList.toggle('hidden',!webcamStream);
  torch.classList.add('hidden');zoomWrap.classList.add('hidden');
  const track=webcamStream?.getVideoTracks()[0];if(!track)return;
  try{
    const caps=track.getCapabilities?.()||{};
    if(caps.torch)torch.classList.remove('hidden');
    if(caps.zoom&&Number.isFinite(caps.zoom.max)&&caps.zoom.max>caps.zoom.min){
      zoomWrap.classList.remove('hidden');const slider=document.getElementById('cameraZoomRange');
      slider.min=caps.zoom.min;slider.max=caps.zoom.max;slider.step=caps.zoom.step||.1;slider.value=track.getSettings?.().zoom||caps.zoom.min;
    }
  }catch(e){console.warn('camera capabilities',e)}
}
async function listDeviceCameras(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  try{
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    const box=document.getElementById('cameraDeviceSelect');const prev=cameraDeviceId;
    box.innerHTML='<option value="">自動選択</option>';
    devices.forEach((d,i)=>{const option=document.createElement('option');option.value=d.deviceId;option.textContent=d.label||`カメラ ${i+1}`;box.append(option)});
    box.value=devices.some(d=>d.deviceId===prev)?prev:'';
  }catch(e){console.warn('enumerate devices',e)}
}
function loadAIDependency(url){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=url;script.async=true;
    script.onload=resolve;script.onerror=()=>reject(new Error('AI依存ライブラリを読み込めません'));
    document.head.append(script);
  });
}
async function ensureAI(){
  if(cocoModel)return cocoModel;
  if(aiLoading)return aiLoading;
  cameraStatus('AIを準備中… 初回のモデル取得には通信が必要です。');
  aiLoading=(async()=>{
    try{
      if(!window.tf)await loadAIDependency('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      if(!window.cocoSsd)await loadAIDependency('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3');
      cocoModel=await window.cocoSsd.load({base:state.aiQuality==='detailed'?'mobilenet_v2':'lite_mobilenet_v2'});
      return cocoModel;
    }catch(e){
      console.warn('AIは利用できません',e);
      cameraStatus('AIは読み込めませんでした。自分で確認する機能はそのまま使えます。');
      return null;
    }finally{aiLoading=null;}
  })();
  return aiLoading;
}
// COCO-SSD can detect 80 categories, but NOT wallet/keys themselves.
// Match safe known Japanese labels to exactly supported English COCO classes.
const AI_ITEM_LABELS={
  'cell phone':'スマホ','bottle':'水筒・ボトル','book':'本・教科書','backpack':'リュック','handbag':'バッグ','umbrella':'傘','laptop':'ノートPC','keyboard':'キーボード',
  'mouse':'マウス','remote':'リモコン','cup':'カップ','scissors':'はさみ','toothbrush':'歯ブラシ','suitcase':'スーツケース','tie':'ネクタイ','clock':'時計','sports ball':'ボール'
};
const AI_ITEM_ALIASES=[
  {className:'cell phone',match:/スマホ|スマートフォン|携帯電話|携帯|iphone|android/iu},
  {className:'bottle',match:/水筒|ペットボトル|飲み物|ボトル|マイボトル/iu},
  {className:'book',match:/教科書|本|参考書|ノート|メモ帳|読書/iu},
  {className:'backpack',match:/リュック|バックパック|ランドセル/iu},
  {className:'handbag',match:/ハンドバッグ|かばん|鞄|バッグ|トート/iu},
  {className:'umbrella',match:/傘|折りたたみ傘/iu},
  {className:'laptop',match:/ノートパソコン|ノートpc|パソコン|macbook/iu},
  {className:'keyboard',match:/キーボード/iu},
  {className:'mouse',match:/マウス/iu},
  {className:'scissors',match:/ハサミ|はさみ/iu},
  {className:'toothbrush',match:/歯ブラシ/iu},
  {className:'suitcase',match:/キャリーケース|スーツケース/iu}
];
const AI_SUPPORTED_CLASSES=new Set(['cell phone','bottle','book','backpack','handbag','umbrella','laptop','keyboard','mouse','remote','cup','scissors','toothbrush','suitcase','tie','clock','sports ball']);
function aiSupportedClass(item){
  const hint=String(item.hint||'').trim().toLowerCase();
  if(AI_SUPPORTED_CLASSES.has(hint))return hint;
  const name=String(item.name||'').normalize('NFKC');
  return AI_ITEM_ALIASES.find(x=>x.match.test(name))?.className||'';
}
function aiMapPredictions(preds,items){
  const best=new Map();
  for(const p of preds){
    if(!p||!AI_SUPPORTED_CLASSES.has(p.class)||!Number.isFinite(p.score)||p.score<.53)continue;
    for(let i=0;i<items.length;i++){
      if(aiSupportedClass(items[i])!==p.class)continue;
      const prev=best.get(i);
      if(!prev||prev.score<p.score)best.set(i,{index:i,score:p.score,className:p.class});
    }
  }
  return [...best.values()].sort((a,b)=>b.score-a.score);
}
function renderAICoverage(){
  const el=document.getElementById('aiCoverage');if(!el)return;
  const supported=state.items.filter(it=>aiSupportedClass(it));const unsupported=state.items.filter(it=>!aiSupportedClass(it));
  el.innerHTML=`<b>🔍 AIで候補を探せる品物 ${supported.length}/${state.items.length}個</b><span>${supported.length?escapeHTML(supported.slice(0,6).map(x=>x.name).join('・')):'該当する品物はまだないよ'}</span>${unsupported.length?`<small>👀 目で確認：${escapeHTML(unsupported.slice(0,9).map(x=>x.name).join('・'))}${unsupported.length>9?' など':''}</small>`:''}<small>財布・鍵・筆箱・教科書などは現行モデルでは直接判別できません。候補と実物を目で照合し、認識されない物は手動確認してください。</small>`;
}
function changeAIQuality(value){
  const next=value==='detailed'?'detailed':'balanced';
  if(next===state.aiQuality)return;
  state.aiQuality=next;saveState();
  if(cocoModel){if(typeof cocoModel.dispose==='function')cocoModel.dispose();cocoModel=null}
  cameraStatus(next==='detailed'?'高精度モードに変更。次回の解析で大きめのAIモデルを読み込むよ。':'標準モードに変更。次回の解析で軽量モデルを読み込むよ。');
}
async function detectImageMoreDetail(model,el,request,original){
  // A second center crop can help on small items. Do not overclaim correctness.
  if(state.aiQuality!=='detailed'||request!==cameraAnalyzeToken)return original;
  const w=el.naturalWidth,h=el.naturalHeight;if(!w||!h)return original;
  const cropW=Math.round(w*.76),cropH=Math.round(h*.76),x=Math.round((w-cropW)/2),y=Math.round((h-cropH)/2);
  const canvas=document.createElement('canvas');canvas.width=Math.min(960,cropW);canvas.height=Math.round(canvas.width*cropH/cropW);
  canvas.getContext('2d').drawImage(el,x,y,cropW,cropH,0,0,canvas.width,canvas.height);
  const more=await model.detect(canvas,20,.52);if(request!==cameraAnalyzeToken)return original;
  return [...original,...more.map(p=>({...p,bbox:[x+p.bbox[0]*cropW/canvas.width,y+p.bbox[1]*cropH/canvas.height,p.bbox[2]*cropW/canvas.width,p.bbox[3]*cropH/canvas.height]}))];
}

function renderCameraManualItems(suggestions=[]){
  const root=document.getElementById('cameraManualItems');if(!root)return;
  root.innerHTML=state.items.map((it,i)=>{
    const match=suggestions.find(x=>x.index===i),found=!!match;
    return `<button type="button" class="camera-item-chip ${it.checked?'checked':''} ${found?'suggested':''}" data-camera-item="${i}" ${it.checked?'disabled':''}><span>${it.emoji||'🎒'}</span><b>${escapeHTML(it.name)}</b><small>${it.checked?'✓ 確認済み':found?`候補 ${Math.round(match.score*100)}%・要確認`:aiSupportedClass(it)?'見つからない／実物を確認':'AI対象外・目で確認'}</small></button>`;
  }).join('');
  root.querySelectorAll('[data-camera-item]').forEach(btn=>btn.onclick=()=>{
    if(isTodayCheckLocked()||isCheckCompletedToday())return toast('今日はチェックできません');
    const item=state.items[Number(btn.dataset.cameraItem)];if(!item||item.checked)return;
    item.checked=true;saveState();renderAll();renderCameraManualItems(suggestions);beep('click');toast(`${item.name} を確認したよ`);
    if(state.items.every(x=>x.checked))mascotReaction('全部そろったね！チェック完了を押してね！','🎉','happy');
  });
}
function openAI(){
  if(isTodayCheckLocked())return toast(`今日は「${todayLockLabel()}」でチェックできないよ`);
  if(isCheckCompletedToday())return toast('今日はチェック完了済みだよ');
  document.getElementById('aiBackdrop').classList.remove('hidden');
  cameraStatus('端末のカメラを選んでね。撮影後、AI候補を探せます。');
  document.getElementById('cameraPlaceholder').classList.remove('hidden');
  renderCameraManualItems();renderAICoverage();document.getElementById('aiQualitySelect').value=state.aiQuality;setCameraImageVisible(false);
}
function closeAI(){
  cameraRequestToken++;cameraAnalyzeToken++;stopCamera();
  document.getElementById('aiBackdrop').classList.add('hidden');
  if(cameraImageUrl){URL.revokeObjectURL(cameraImageUrl);cameraImageUrl=''}
  const img=document.getElementById('uploadPreview');img.removeAttribute('src');img.style.display='none';cameraCaptured=false;
  document.getElementById('cameraAnalyzeBtn').disabled=true;
  clearCameraOverlay();
}
function stopCamera(){
  if(webcamStream){webcamStream.getTracks().forEach(t=>t.stop());webcamStream=null}
  const v=document.getElementById('cameraVideo');v.pause();v.srcObject=null;
  cameraTorch=false;document.getElementById('cameraTorchBtn').textContent='🔦 ライトOFF';updateCameraTools();
  document.getElementById('cameraCaptureBtn').disabled=true;
}
async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia)return cameraStatus('アプリ内カメラはHTTPSまたはlocalhostで開いてね。標準カメラも試せます。');
  const token=++cameraRequestToken;stopCamera();cameraStatus('カメラの使用許可を確認しています…');
  try{
    let stream;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:cameraDeviceId?{deviceId:{exact:cameraDeviceId}}:{facingMode:{ideal:cameraFacing},width:{ideal:1280},height:{ideal:720}}});
    }catch(e){if(cameraDeviceId)throw e;stream=await navigator.mediaDevices.getUserMedia({audio:false,video:true})}
    if(token!==cameraRequestToken||document.getElementById('aiBackdrop').classList.contains('hidden')){stream.getTracks().forEach(t=>t.stop());return}
    webcamStream=stream;const video=document.getElementById('cameraVideo');video.srcObject=stream;
    const img=document.getElementById('uploadPreview');img.style.display='none';
    document.getElementById('cameraPlaceholder').classList.add('hidden');video.style.display='block';
    clearCameraOverlay();cameraCaptured=false;document.getElementById('cameraAnalyzeBtn').disabled=true;
    await video.play().catch(()=>{});updateCameraTools();await listDeviceCameras();
    cameraStatus('カメラ起動中。持ち物を画面に映して「写真を撮る」を押してね。');
  }catch(e){console.warn(e);cameraStatus(e.name==='NotAllowedError'?'カメラの使用を許可してね。標準カメラも試せます。':e.name==='NotFoundError'?'この端末のカメラが見つかりません':'カメラを起動できません。標準カメラか写真選択を使ってね')}
}
function flipCamera(){cameraFacing=cameraFacing==='environment'?'user':'environment';cameraDeviceId='';startCamera()}
async function toggleCameraTorch(){
  const track=webcamStream?.getVideoTracks()[0];if(!track)return;
  try{cameraTorch=!cameraTorch;await track.applyConstraints({advanced:[{torch:cameraTorch}]});document.getElementById('cameraTorchBtn').textContent=cameraTorch?'🔦 ライトON':'🔦 ライトOFF'}
  catch(e){cameraTorch=false;toast('このカメラはライト切り替えに非対応だよ')}
}
async function setCameraZoom(value){const track=webcamStream?.getVideoTracks()[0];if(!track)return;try{await track.applyConstraints({advanced:[{zoom:Number(value)}]})}catch(e){toast('ズームは使えません')}}
function captureCurrentFrame(){
  const video=document.getElementById('cameraVideo');if(!webcamStream||!video.videoWidth)return cameraStatus('カメラの映像を待ってね');
  const canvas=document.createElement('canvas'),ratio=Math.min(1,1280/video.videoWidth);canvas.width=Math.round(video.videoWidth*ratio);canvas.height=Math.round(video.videoHeight*ratio);
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  canvas.toBlob(blob=>{if(document.getElementById('aiBackdrop').classList.contains('hidden'))return;if(blob)displayCapturedImage(blob);else cameraStatus('撮影できませんでした')},'image/jpeg',.9);
}
function displayCapturedImage(blob){
  stopCamera();clearCameraOverlay();
  if(cameraImageUrl)URL.revokeObjectURL(cameraImageUrl);
  cameraImageUrl=URL.createObjectURL(blob);
  const img=document.getElementById('uploadPreview');img.onload=()=>{cameraCaptured=true;document.getElementById('cameraAnalyzeBtn').disabled=false};
  img.src=cameraImageUrl;setCameraImageVisible(true);cameraStatus('撮影できたよ！「写真から候補を探す」か、実物を見てチェックしてね。');
}
function uploadImage(file){
  if(!file)return;
  if(!file.type.startsWith('image/'))return cameraStatus('画像ファイルを選んでね');
  if(file.size>16*1024*1024)return cameraStatus('画像は16MB以下を選んでね');
  cameraRequestToken++;displayCapturedImage(file);
  document.getElementById('imageInput').value='';document.getElementById('nativeCameraInput').value='';
}
async function detect(el=document.getElementById('uploadPreview')){
  if(isTodayCheckLocked()||isCheckCompletedToday())return;
  if(!el.complete||!el.naturalWidth)return cameraStatus('先に写真を撮影してね');
  const request=++cameraAnalyzeToken,button=document.getElementById('cameraAnalyzeBtn');button.disabled=true;
  const model=await ensureAI();if(request!==cameraAnalyzeToken)return;
  if(!model){button.disabled=false;cameraStatus('AIモデルを読み込めません。写真を見て手動チェックできます。');return}
  try{
    cameraStatus('写真から持ち物の候補を探しています…');
    const first=await model.detect(el,20,.52);if(request!==cameraAnalyzeToken)return;
    const preds=await detectImageMoreDetail(model,el,request,first);if(request!==cameraAnalyzeToken)return;
    const canvas=document.getElementById('detectCanvas'),ctx=canvas.getContext('2d');
    canvas.width=el.naturalWidth;canvas.height=el.naturalHeight;ctx.clearRect(0,0,canvas.width,canvas.height);
    const suggestions=aiMapPredictions(preds,state.items);
    // Draw boxes only for recognized items that are relevant to this list.
    for(const p of preds){
      if(!suggestions.some(x=>x.className===p.class)||!Array.isArray(p.bbox))continue;
      ctx.strokeStyle='#62edd1';ctx.lineWidth=Math.max(2,canvas.width/250);ctx.strokeRect(...p.bbox);
      const label=`${AI_ITEM_LABELS[p.class]||p.class} ${Math.round(p.score*100)}%`;
      ctx.font=`bold ${Math.max(15,canvas.width/38)}px sans-serif`;
      const height=Math.max(22,canvas.width/30);const width=Math.min(canvas.width,ctx.measureText(label).width+14);
      ctx.fillStyle='rgba(28,71,83,.9)';ctx.fillRect(Math.max(0,p.bbox[0]),Math.max(0,p.bbox[1]-height),width,height);
      ctx.fillStyle='#fff';ctx.fillText(label,Math.max(0,p.bbox[0])+6,Math.max(18,p.bbox[1]-5));
    }
    renderCameraManualItems(suggestions);
    const notSupported=state.items.filter(x=>!aiSupportedClass(x)).length;
    cameraStatus(suggestions.length?`${suggestions.length}種類がAI候補になったよ。候補の品物を実物と見比べて、最後は自分でタップして確認してね。${notSupported?' AI対象外の品物もあるよ。':''}`:`AIの一致候補はなかったよ。${notSupported?'財布や鍵などは認識対象外。':''}実物を見ながら確認してね。`);
  }catch(e){console.warn(e);cameraStatus('AI判定できませんでした。目で確認してチェックしてね。')}
  finally{if(request===cameraAnalyzeToken)button.disabled=false}
}
function bindDeviceCamera(){
  document.getElementById('cameraBtn').onclick=startCamera;
  document.getElementById('cameraFlipBtn').onclick=flipCamera;
  document.getElementById('cameraCaptureBtn').onclick=captureCurrentFrame;
  document.getElementById('cameraAnalyzeBtn').onclick=()=>detect();
  document.getElementById('aiQualitySelect').onchange=e=>changeAIQuality(e.target.value);
  document.getElementById('cameraTorchBtn').onclick=toggleCameraTorch;
  document.getElementById('cameraZoomRange').oninput=e=>setCameraZoom(e.target.value);
  document.getElementById('cameraDeviceSelect').onchange=e=>{cameraDeviceId=e.target.value;startCamera()};
  document.getElementById('imageInput').onchange=e=>uploadImage(e.target.files?.[0]);
  document.getElementById('nativeCameraInput').onchange=e=>uploadImage(e.target.files?.[0]);
}

function safeBackupSchedule(input){
 const clean={};if(!input||typeof input!=='object'||Array.isArray(input))return clean;
 for(let day=0;day<=6;day++)if(typeof input[day]==='string')clean[day]=input[day].slice(0,160);
 return clean;
}
function exportData(){
 const at=new Date().toISOString(),payload={format:'sumapokke-backup',version:APP_VERSION,exportedAt:at,
 schedule:safeBackupSchedule(window.smapoScheduleAssist?.exportSchedule?.()||{}),state:{...state,lastBackupAt:at}};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=`sumapokke-backup-${TODAY()}.json`;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 state.lastBackupAt=at;saveState();renderSettings();toast('バックアップを書き出したよ');
}
function importData(file){
 if(!file)return;
 const input=document.getElementById('importFile');
 if(file.size>2*1024*1024){toast('バックアップが大きすぎるよ（最大2MB）');if(input)input.value='';return}
 const reader=new FileReader();
 reader.onload=e=>{try{
  const obj=JSON.parse(e.target.result),raw=obj?.format==='sumapokke-backup'?obj.state:obj;
  if(!validBackupState(raw))throw new Error('形式が違います');
  const restored=sanitizeState(raw);
  if(!confirm('現在の記録をバックアップの内容で置き換えます。よろしいですか？'))return;
  try{const previous=localStorage.getItem(STORAGE_KEY);if(previous){validJSON(previous);localStorage.setItem(RECOVERY_KEY,previous)}}catch{}
  const originalState=state,originalExternal=externalDataChange,originalAlert=startupDataAlert;
  state=restored;state.lastBackupAt=new Date().toISOString();externalDataChange=false;startupDataAlert='';
  if(!saveState()){state=originalState;externalDataChange=originalExternal;startupDataAlert=originalAlert;renderDataSafetyNotice();throw Error('保存に失敗。元の画面データは維持しました');}
  // Older backups lacked a timetable: do not erase a user's current schedule.
  if(Object.prototype.hasOwnProperty.call(obj,'schedule')){
    const previousSchedule=window.smapoScheduleAssist?.exportSchedule?.()||{};
    try{window.smapoScheduleAssist?.importSchedule(safeBackupSchedule(obj.schedule));}
    catch(error){
      state=originalState;externalDataChange=originalExternal;startupDataAlert=originalAlert;
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(originalState));window.smapoScheduleAssist?.importSchedule(previousSchedule)}catch{}
      renderDataSafetyNotice();throw Error('時間割の復元が失敗しました');
    }
  }
  normalizeDaily();renderAll();renderMascots();armBgmResume();renderDataSafetyNotice();toast('バックアップを復元したよ');
  if(v35TransferPending){v35TransferPending=false;v35FinishSplashStart()}
  if(typeof window.smapoCloudQueueSave==='function')window.smapoCloudQueueSave();
 }catch(err){console.warn(err);toast('復元できなかったよ。正しいバックアップか確認してね')}
 finally{if(input)input.value=''}};
 reader.onerror=()=>{toast('ファイルを読み込めませんでした');if(input)input.value=''};
 reader.readAsText(file);
}
function resetPreferences(){
  const d=defaultState();stopBGM(false);state.theme=d.theme;state.sound=d.sound;state.bgmEnabled=false;state.bgmTrack=d.bgmTrack;state.bgmVolume=d.bgmVolume;
  state.reminders=deepClone(d.reminders);state.reducedMotion=false;state.powerSaving=false;state.mascotMotionMode=d.mascotMotionMode;state.fontStep=1;state.highContrast=false;state.fontStep=d.fontStep;state.highContrast=d.highContrast;saveState();renderAll();toast('設定だけ初期状態に戻したよ');
}
function resetEverything(){
  if(v35Cloud.user&&v35Cloud.linked){toast('クラウド連携中は、マイページでログアウトしてからこの端末のデータを削除してください');return}
  if(!confirm('ランク・コイン・履歴を含むすべてのデータを削除します。よろしいですか？'))return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(RECOVERY_KEY);
  localStorage.removeItem(SCHEDULE_STORAGE_KEY);
  location.reload();
}
function showResetMenu(){
  showModal('データをリセット',`<p>進行データを残して設定だけ戻すこともできます。</p><div class="reset-choice-note">全データ削除は元に戻せません。必要なら先にバックアップを書き出してください。</div>`,{icon:'↻',actions:[{label:'設定だけリセット',onClick:resetPreferences},{label:'全データを削除',primary:true,onClick:resetEverything,close:false}]});
}


// ============================================================
// V26.2 — first-time interactive guide. No machine-generated voice.
// Existing named profiles migrate with tutorialDone=true so returning
// users are never unexpectedly forced through onboarding again.
// ============================================================
const TUTORIAL_STEPS=[
  {
    kicker:'01 / ようこそ',title:'すまぽっけへようこそ！',
    description:'すまぽっけは、出発前の忘れ物を減らしながら、相棒と楽しく毎日の準備を続けるアプリだよ。',
    speech:'これから一緒に、忘れ物を減らしていこう！',
    sample:'<div class="tour-welcome-badges"><span>🎒 持ち物確認</span><span>🌙 明日の準備</span><span>🍀 相棒と成長</span></div>',
    helper:'全部で7ページ。右下の「つぎへ」で進めるよ。スキップもできるよ。'
  },
  {
    kicker:'02 / おでかけ前',title:'出発前にしっかり確認！',
    description:'持ち物リストで実物を確認し、そろった物にチェック。最後の「出発前チェック」で大切な物も見直せるよ。',
    speech:'鍵や財布みたいな大事な物も、いっしょに確認しよう！',
    sample:'<div class="tour-check-sample"><span>🔑 家の鍵 <b>✓</b></span><span>✏️ 筆箱 <b>✓</b></span><span>☂️ 傘 <b>○</b></span></div>',
    helper:'チェックしただけではカバンの中身は分からないよ。出発前に実物をもう一度見てね。'
  },
  {
    kicker:'03 / 明日と持ち物セット',title:'前の日に準備すると安心！',
    description:'「明日の自分貯金」で翌日の持ち物を準備。学校・実習・おでかけなどの「持ち物セット」も保存して使い回せるよ。',
    speech:'夜のうちに準備したら、朝はもっと安心だね！',
    sample:'<div class="tour-duo"><span><i>🌙</i><b>明日の自分貯金</b><small>前日に持ち物を確認</small></span><span><i>🎒</i><b>持ち物セット</b><small>学校・休日などを登録</small></span></div>',
    helper:'持ち物は自由に追加・削除できるよ。予定に合わせてセットを選ぼう。'
  },
  {
    kicker:'04 / 時間割と天気',title:'授業や天気に合わせて準備！',
    description:'時間割に登録した教科から必要な持ち物を提案。天気予報と連動して、雨の日に傘をリストへ追加することもできるよ。',
    speech:'明日は体育？ 雨予報なら傘もチェックしよう！',
    sample:'<div class="tour-feature-grid"><span><strong>📚 時間割</strong><small>教科に合わせた準備の候補</small></span><span><strong>☔ 天気連動</strong><small>雨予報で傘を自動追加</small></span></div>',
    helper:'天気の取得には通信と地域設定が必要。予報や提案は必ず自分でも確かめてね。'
  },
  {
    kicker:'05 / AIカメラ',title:'写真でも持ち物をチェック！',
    description:'カメラで写した物をAIが解析し、チェックの候補を表示。認識できない物や間違いもあるので、最後は自分で確認してね。',
    speech:'AIはお手伝い役。分からないときは手動でもチェックできるよ！',
    sample:'<div class="tour-feature-grid"><span><strong>📷 撮影する</strong><small>AIが認識候補を表示</small></span><span><strong>✅ 自分で確認</strong><small>候補を確かめてチェック</small></span></div>',
    helper:'筆箱・教科書などは現行の認識モデルで判定できない場合があるよ。初回モデル取得は通信が必要。'
  },
  {
    kicker:'06 / 相棒とごほうび',title:'続けると相棒も成長！',
    description:'持ち物チェックなどで信頼度やコインを集めよう。相棒はLv.1〜5に成長し、会話・ミッション・ショップ・ガチャも楽しめるよ。',
    speech:'いっしょにレベルアップしよう！ いつでも相棒チェンジできるよ。',
    sample:'<div class="tour-reward"><span class="tour-heart">🍀 Lv.1〜5</span><span class="tour-coin">⭐ ミッション</span><span class="tour-gacha">🎁 ショップ・ガチャ</span></div>',
    helper:'ぽけっとくんとぽけっとちゃんは、育成状況を残したまま途中で切り替えられるよ。'
  },
  {
    kicker:'07 / 便利な機能と設定',title:'自分に合う使い方にしよう！',
    description:'クエストでのおさんぽ、アプリを開いている間の準備のお知らせ、文字サイズの調整やバックアップも使えるよ。',
    speech:'準備はばっちり！ 分からなくなったら設定からガイドを見てね。',
    sample:'<div class="tour-feature-grid tour-feature-grid-three"><span><strong>👟 クエスト</strong><small>おさんぽ記録</small></span><span><strong>🔔 通知</strong><small>準備のお知らせ</small></span><span><strong>⚙️ 設定</strong><small>文字・音・保存</small></span></div>',
    helper:'アプリを閉じた状態では通知されない場合があるよ。このガイドは「設定・データ」からもう一度見られるよ。'
  }
];
let tutorialIndex=0;
let tutorialReturnFocus=null;
function renderTutorial(){
  const step=TUTORIAL_STEPS[tutorialIndex];if(!step)return;
  document.getElementById('tourStepCounter').textContent=`${tutorialIndex+1} / ${TUTORIAL_STEPS.length}`;
  const progress=document.getElementById('tourProgress');
  progress.style.gridTemplateColumns=`repeat(${TUTORIAL_STEPS.length},minmax(0,1fr))`;
  progress.setAttribute('aria-label',`説明 ${tutorialIndex+1} / ${TUTORIAL_STEPS.length}`);
  progress.innerHTML=TUTORIAL_STEPS.map((_,i)=>`<span class="${i<=tutorialIndex?'passed':''} ${i===tutorialIndex?'current':''}"></span>`).join('');
  document.getElementById('tourKicker').textContent=step.kicker;
  document.getElementById('tourTitle').textContent=step.title;
  document.getElementById('tourDescription').textContent=step.description;
  document.getElementById('tourMascot').innerHTML=mascotArt(state.partner,state.rank,['happy','thinking','wink','surprise','thinking','happy','wink'][tutorialIndex]||'normal');
  document.getElementById('tourSpeech').textContent=tutorialIndex===0?`${state.userName||'あなた'}${/さん$/.test(state.userName||'')?'':'さん'}、${step.speech}`:step.speech;
  document.getElementById('tourSample').innerHTML=step.sample;
  document.getElementById('tourHelper').textContent=step.helper;
  const back=document.getElementById('tourBackBtn');back.disabled=tutorialIndex===0;
  const next=document.getElementById('tourNextBtn');next.textContent=tutorialIndex===TUTORIAL_STEPS.length-1?'ホームへいこう ✓':'つぎへ ›';
  const body=document.querySelector('.first-tour-card');if(body)body.scrollTop=0;
}
function openTutorial({replay=false}={}){
  const overlay=document.getElementById('firstTour');if(!overlay)return;
  tutorialIndex=0;
  tutorialReturnFocus=replay?document.activeElement:null;
  overlay.classList.remove('hidden');
  renderMascots();renderTutorial();
  document.getElementById('tourNextBtn').focus({preventScroll:true});
}
function closeTutorial(){
  if(!state.tutorialDone){state.tutorialDone=true;saveState()}
  document.getElementById('firstTour').classList.add('hidden');
  renderAll();speak('greeting');setMascotMood('wink',3600);
  if(tutorialReturnFocus&&document.contains(tutorialReturnFocus))tutorialReturnFocus.focus({preventScroll:true});
  else document.getElementById('departureBtn')?.focus({preventScroll:true});
  tutorialReturnFocus=null;
  beginWalkAppSession();
}
function tutorialNext(){
  if(tutorialIndex>=TUTORIAL_STEPS.length-1)return closeTutorial();
  tutorialIndex++;renderTutorial();
}
function tutorialPrevious(){
  if(tutorialIndex===0)return;
  tutorialIndex--;renderTutorial();
}
function bindTutorial(){
  document.getElementById('tourNextBtn').onclick=tutorialNext;
  document.getElementById('tourBackBtn').onclick=tutorialPrevious;
  document.getElementById('tourSkipBtn').onclick=closeTutorial;
  document.getElementById('replayTourBtn').onclick=()=>openTutorial({replay:true});
  document.getElementById('firstTour').addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();closeTutorial();return}
    if(e.key==='Tab'){
      const controls=[...document.querySelectorAll('#firstTour button:not([disabled])')];
      if(!controls.length)return;
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
  });
}

/* V35.0: two safe ways to transfer. File backup works without a server.
 * Optional Firebase Google auth / UID-scoped Firestore sync requires project setup.
 */
let v35TransferPending = false;
const v35Cloud = {
  ready:false, sdk:null, auth:null, db:null, user:null, revision:0,
  linked:false, busy:false, timer:0, pending:false, syncing:false,
  conflict:false, editSerial:0, retryMs:2200, session:0, lastError:''
};
// A dirty marker survives tab close, reload, and temporary loss of connectivity.
function v352DirtyKey(uid){return 'smapokke_cloud_dirty_'+uid}
function v352IsDirty(uid){try{return localStorage.getItem(v352DirtyKey(uid))==='1'}catch{return true}}
function v352SetDirty(uid,dirty){
 try{
   if(dirty)localStorage.setItem(v352DirtyKey(uid),'1');
   else localStorage.removeItem(v352DirtyKey(uid));
   return true;
 }catch(error){console.warn('同期待ちの記録に失敗',error);return false}
}
function v352RenderSaveStatus(){
 const el=document.getElementById('v352HomeSaveStatus');if(!el)return;
 let msg='💾 この端末に自動保存',status='local';
 if(saveFailure||externalDataChange){msg='⚠️ 端末への保存を確認してね';status='error'}
 else if(v35Cloud.conflict){msg='⚠️ 同期が競合しています';status='error'}
 else if(v35Cloud.user&&(v35Cloud.pending||v35Cloud.syncing||v352IsDirty(v35Cloud.user.uid))){msg='☁️ 端末に保存・クラウド同期待ち';status='pending'}
 else if(v35Cloud.user&&v35Cloud.linked){msg='✅ 端末・クラウドに保存済み';status='synced'}
 el.textContent=msg;el.dataset.status=status;
}

const v35Config = typeof window !== 'undefined' ? window.SMAPO_FIREBASE_CONFIG : null;
function v35Configured(){return !!(v35Config&&v35Config.apiKey&&v35Config.authDomain&&v35Config.projectId&&v35Config.appId)}
function v35SetStatus(message){
  const item=document.getElementById('v35AccountStatus');if(item)item.textContent=message;
  const intro=document.getElementById('v35TransferStatus');if(intro)intro.textContent=message;
  v352RenderSaveStatus();
  v35UpdateAccountButtons();
}
function v35UpdateEntry(){
  const entry=document.getElementById('startAppBtn');if(entry)entry.textContent=state.userName?'つづきから':'最初から始める';
  const x=document.getElementById('v35TransferStartBtn');if(x)x.textContent=state.userName?'別の端末から引き継ぐ':'引き継いで始める';
}
function v35ShowTransfer(show){
  document.getElementById('v35EntryActions')?.classList.toggle('hidden',show);
  document.getElementById('v35TransferOptions')?.classList.toggle('hidden',!show);
}
function v35FinishSplashStart(){
  v35TransferPending=false;
  if(state.bgmEnabled&&!bgmPlaying)startBGM(state.bgmTrack);
  document.getElementById('v35TransferOptions')?.classList.add('hidden');
  document.getElementById('splash')?.classList.add('hidden');
  if(!state.userName){document.getElementById('onboarding')?.classList.remove('hidden');}
  else if(!state.tutorialDone)openTutorial();
  else {speak('greeting');renderAll();beginWalkAppSession()}
}
function v35UpdateAccountButtons(){
  const signIn=document.getElementById('v35GoogleLoginBtn');
  const signOut=document.getElementById('v35GoogleLogoutBtn');
  if(signIn){signIn.classList.toggle('hidden',!!v35Cloud.user);signIn.textContent=v35Cloud.busy?'接続準備中…':'Googleでログイン';}
  const email=document.getElementById('v36EmailLoginBtn');if(email)email.classList.toggle('hidden',!!v35Cloud.user);
  const save=document.getElementById('v36CloudSaveNowBtn');if(save){save.disabled=!(v35Cloud.user&&v35Cloud.linked&&!v35Cloud.conflict);save.title=save.disabled?'ログイン後、同期が有効なときに利用できます':'';}
  if(signOut)signOut.classList.toggle('hidden',!v35Cloud.user);
  const resolve=document.getElementById('v352ConflictResolveBtn');if(resolve)resolve.classList.toggle('hidden',!(v35Cloud.user&&v35Cloud.conflict));
}
function v35LocalSyncKey(uid){return 'smapokke_cloud_revision_'+uid}
function v35LocalOwnerKey(){return 'smapokke_cloud_last_user'}
function v35SafeStore(key, value){try{localStorage.setItem(key,String(value))}catch(e){console.warn('account meta',e)}}
function v35CloudSchedule(){return safeBackupSchedule(window.smapoScheduleAssist?.exportSchedule?.()||{})}
function v35CloudDoc(){return v35Cloud.sdk.fs.doc(v35Cloud.db,'users',v35Cloud.user.uid)}
function v35ResumeAfterCloudTransfer(){
  v35UpdateEntry();
  if(!document.getElementById('splash')?.classList.contains('hidden') && v35TransferPending)v35FinishSplashStart();
}
function v35ApplyCloudPayload(payload){
  if(!payload || !validBackupState(payload.state))throw Error('クラウドの記録形式を確認できません');
  const clean=sanitizeState(payload.state);
  const oldState=state,oldRaw=lastSavedRaw;
  if(oldRaw){try{validJSON(oldRaw);localStorage.setItem(RECOVERY_KEY,oldRaw)}catch{}}
  state=clean;
  // Sync is paused during the replacement, avoiding an unwanted reverse upload.
  v35Cloud.linked=false;
  externalDataChange=false;startupDataAlert='';
  lastSavedRaw=localStorage.getItem(STORAGE_KEY)||'';
  if(!saveState()){state=oldState;lastSavedRaw=oldRaw;throw Error('この端末への保存に失敗しました')}
  if(payload.schedule && typeof payload.schedule==='object'){
    window.smapoScheduleAssist?.importSchedule(safeBackupSchedule(payload.schedule));
  }
  normalizeDaily();renderAll();renderMascots();renderDataSafetyNotice();v35UpdateEntry();
}
function v35CurrentOwnerMatches(uid){
  try{return localStorage.getItem(v35LocalOwnerKey())===uid}catch{return false}
}
async function v35OnSignedIn(user,{forceRemote=false}={}){
  const session=++v35Cloud.session;
  v35Cloud.user=user;
  v35Cloud.linked=false;v35Cloud.conflict=false;v35Cloud.revision=0;
  v35Cloud.pending=false;v35Cloud.lastError='';
  v35UpdateAccountButtons();
  v35SetStatus(`☁️ ${user.email||'ログイン中'}：クラウドの記録を確認しています…`);
  try{
    // Always go to the server before selecting a profile; no cached, stale document.
    const snapshot=await v35Cloud.sdk.fs.getDocFromServer(v35CloudDoc());
    if(v35Cloud.session!==session||v35Cloud.user?.uid!==user.uid)return;
    const remote=snapshot.exists()?snapshot.data():null;
    const remoteRev=Number(remote?.revision)||0;
    const localRev=Number(localStorage.getItem(v35LocalSyncKey(user.uid))||0);
    const ownLocal=v35CurrentOwnerMatches(user.uid);
    const dirty=v352IsDirty(user.uid);
    let useRemote=false,useLocal=false;
    if(ownLocal&&dirty&&remoteRev!==localRev&&!forceRemote){
      // A newer server snapshot and unsent local changes must never overwrite each other.
      v35Cloud.conflict=true;v35Cloud.revision=localRev;
      v35SetStatus('⚠️ この端末の未同期データとクラウドの記録が異なります。どちらも上書きせず同期を停止しました。先にファイルバックアップを保存してください。');
      return;
    }
    if(remote){
      if(!validBackupState(remote.payload?.state))throw Error('クラウドの記録形式が不正');
      if(forceRemote||!state.userName){useRemote=true}
      else if(ownLocal){
        if(dirty){useLocal=true}
        else if(localRev===remoteRev){useLocal=true}
        else {useRemote=true}
      }else{
        // Another account's profile or an unrelated local guest must not be uploaded.
        useRemote=confirm(`クラウドの育成データが見つかりました。

OK：このアカウントの記録を読み込む
キャンセル：端末の記録を保持（同期はしない）

現在の記録が大切なら、先にファイルバックアップを取ってください。`);
      }
      if(useRemote)v35ApplyCloudPayload(remote.payload);
      if(!useRemote&&!useLocal){
        v35Cloud.conflict=true;
        v35SetStatus('⚠️ 端末の記録を維持しました。クラウド同期は停止中です。バックアップ後に再ログインして引き継ぎを選んでください。');
        return;
      }
    }else if(state.userName){
      if(ownLocal){useLocal=true}
      else if(localStorage.getItem(v35LocalOwnerKey())){
        v35Cloud.conflict=true;
        v35SetStatus('⚠️ この端末には別アカウントの記録があります。誤って違うアカウントへ保存しないため、同期を停止しました。');
        return;
      }else{
        useLocal=confirm(`この端末の育成データを新しいクラウドアカウントへ保存しますか？

キャンセル：端末内の記録を残し、クラウドへは送信しません。`);
        if(!useLocal){v35SetStatus('端末内だけに保存中。クラウド保存は開始していません。');return}
      }
    }else{useLocal=true}
    if(v35Cloud.session!==session||v35Cloud.user?.uid!==user.uid)return;
    v35Cloud.revision=remoteRev;
    v35Cloud.linked=true;
    v35SafeStore(v35LocalSyncKey(user.uid),remoteRev);
    v35SafeStore(v35LocalOwnerKey(),user.uid);
    if(useRemote)v352SetDirty(user.uid,false);
    v35SetStatus(useRemote?'✅ クラウドの記録を端末に復元しました。':
      dirty?'☁️ 前回の未同期データを再送信します。':
      remote?'✅ このアカウントの記録を読み込みました。':
      '☁️ アカウントに接続しました。初回保存を開始します。');
    v35ResumeAfterCloudTransfer();
    // Previously unsent changes must be uploaded even if the page was closed mid-sync.
    if((useLocal&&dirty)||(useLocal&&state.userName&&!remote))v35QueueCloudSave();
    else v352RenderSaveStatus();
  }catch(err){
    console.warn('Firebase sync failed',err);
    if(v35Cloud.session!==session)return;
    v35Cloud.linked=false;
    v35SetStatus('⚠️ クラウドの状態を確認できませんでした。端末のデータは維持しています。通信回復後にログインし直してください。');
  }
}

async function v35InitFirebase(){
  if(!v35Configured()){
    v35SetStatus('🔒 現在は端末内に保存中。アカウント同期はFirebase未設定のため利用できません。バックアップファイルなら別端末へ引き継げます。');
    return;
  }
  if(!['https:','http:'].includes(location.protocol)||location.protocol==='http:'&&!['localhost','127.0.0.1'].includes(location.hostname)){
    v35SetStatus('アカウントによるログインはHTTPS公開後に使えます。今はバックアップファイルで引き継いでください。');return;
  }
  v35Cloud.busy=true;v35UpdateAccountButtons();v35SetStatus('アカウント接続を準備しています…');
  try{
    const root='https://www.gstatic.com/firebasejs/13.1.0/';
    const [app,auth,fs]=await Promise.all([
      import(root+'firebase-app.js'),import(root+'firebase-auth.js'),import(root+'firebase-firestore.js')
    ]);
    const client=app.initializeApp(v35Config,'smapokke-app');
    v35Cloud.sdk={auth,fs};v35Cloud.auth=auth.getAuth(client);v35Cloud.db=fs.getFirestore(client);
    v35Cloud.ready=true;
    auth.onAuthStateChanged(v35Cloud.auth,u=>{
      if(u){v35OnSignedIn(u)}else{
        v35Cloud.session++;
        clearTimeout(v35Cloud.timer);
        v35Cloud.user=null;v35Cloud.linked=false;v35Cloud.conflict=false;v35Cloud.pending=false;
        v35UpdateAccountButtons();v35SetStatus('未ログイン：育成データはこの端末内に保存しています。');
      }
    });
  }catch(err){console.warn('Firebase SDK setup failed',err);v35SetStatus('アカウント機能の読み込みに失敗しました。HTTPS・ネット接続・Firebase設定を確認してください。')}
  finally{v35Cloud.busy=false;v35UpdateAccountButtons()}
}
function v35GoogleSignIn(){
  if(!v35Configured()){
    v35SetStatus('Firebase設定がまだありません。開発用ZIPの firebase-config.js と Firebase管理画面で設定した後、HTTPSで公開してください。今は「バックアップファイルから復元」が使えます。');return;
  }
  if(!v35Cloud.ready){v35SetStatus('Googleログインを準備中です。HTTPSで開いているか確認してください。');return}
  v35Cloud.sdk.auth.signInWithPopup(v35Cloud.auth,new v35Cloud.sdk.auth.GoogleAuthProvider())
    .catch(err=>{console.warn('sign in',err);v35SetStatus('Googleログインに失敗しました。ポップアップの許可・認証済みドメイン・Googleログイン設定を確認してください。')});
}
async function v35GoogleSignOut(){
  if(!v35Cloud.user)return;
  if(v35Cloud.syncing){v35SetStatus('クラウドへの保存中です。少ししてからログアウトしてね。');return}
  if(!v35Cloud.linked||v35Cloud.conflict){
    if(!state.lastBackupAt||Date.now()-Date.parse(state.lastBackupAt)>600000){
      v35SetStatus('同期できていません。安全のため、先に「ファイル保存」でデータを退避してね。');return;
    }
    if(!confirm('⚠️ 同期されていない変更があります。\nクラウドには保存されません。ファイルバックアップを確認しましたか？\n\nログアウトしても、この端末内の記録は残します。共用端末では注意してください。'))return;
    try{await v35Cloud.sdk.auth.signOut(v35Cloud.auth);v35SetStatus('ログアウトしました。未同期のデータはこの端末に残っています。')}
    catch{v35SetStatus('ログアウトできませんでした。記録は端末に保持しています。')}
    return;
  }
  try{
    if(v35Cloud.pending||v352IsDirty(v35Cloud.user.uid))await v35FlushCloudSave();
    if(v35Cloud.pending||v352IsDirty(v35Cloud.user.uid))throw Error('NOT_SYNCED');
  }catch{v35SetStatus('最終同期に失敗しました。データを残すためログアウトを中止しました。');return}
  if(!confirm(`ログアウトすると、共用端末で他人のデータが表示されないよう、この端末の作業用データを閉じます。
クラウドに保存済みの記録は残ります。続けますか？`))return;
  try{
    const uid=v35Cloud.user.uid;
    // An additional local recovery slot prevents an unexpected loss if logout is interrupted.
    localStorage.setItem('smapokke_logout_recovery_'+uid,JSON.stringify({state,schedule:v35CloudSchedule(),revision:v35Cloud.revision}));
    await v35Cloud.sdk.auth.signOut(v35Cloud.auth);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RECOVERY_KEY);
    localStorage.removeItem(SCHEDULE_STORAGE_KEY);
    localStorage.removeItem(v35LocalOwnerKey());
    location.reload();
  }catch(error){v35SetStatus('安全にログアウトできませんでした。端末の記録を保持しています。')}
}
function v35QueueCloudSave(){
  if(!v35Cloud.user||!v35Cloud.ready)return;
  const uid=v35Cloud.user.uid;
  // A local record belonging to someone else must not be tagged or uploaded.
  if(!v35CurrentOwnerMatches(uid))return;
  v35Cloud.editSerial++;
  v35Cloud.pending=true;
  v352SetDirty(uid,true);
  v352RenderSaveStatus();
  if(!v35Cloud.linked||v35Cloud.conflict)return;
  clearTimeout(v35Cloud.timer);
  v35Cloud.timer=setTimeout(()=>{v35FlushCloudSave().catch(()=>{})},1400);
}
window.smapoCloudQueueSave=v35QueueCloudSave;
async function v35FlushCloudSave(){
  if(!v35Cloud.linked||!v35Cloud.user||v35Cloud.conflict)return false;
  if(v35Cloud.syncing)return false;
  clearTimeout(v35Cloud.timer);v35Cloud.timer=0;
  const uid=v35Cloud.user.uid,expected=v35Cloud.revision;
  const editSerial=v35Cloud.editSerial;
  const payload={state:JSON.parse(JSON.stringify(state)),schedule:v35CloudSchedule()};
  if(!validBackupState(payload.state))return false;
  v35Cloud.syncing=true;v352RenderSaveStatus();
  try{
    const ref=v35CloudDoc();
    await v35Cloud.sdk.fs.runTransaction(v35Cloud.db,async transaction=>{
      const doc=await transaction.get(ref);
      const actual=doc.exists()?Number(doc.data().revision)||0:0;
      if(actual!==expected)throw Error('V35_REVISION_CONFLICT');
      transaction.set(ref,{revision:actual+1,payload,updatedAt:v35Cloud.sdk.fs.serverTimestamp()});
    });
    // User may have logged out while the network request was in flight.
    if(v35Cloud.user?.uid!==uid)return false;
    v35Cloud.revision=expected+1;
    v35SafeStore(v35LocalSyncKey(uid),v35Cloud.revision);
    v35Cloud.retryMs=2200;
    if(v35Cloud.editSerial===editSerial){
      v35Cloud.pending=false;
      v352SetDirty(uid,false);
      v35SetStatus('✅ 端末・クラウドの両方に保存済み');
    }else{
      v35Cloud.pending=true;
      v352SetDirty(uid,true);
      v35SetStatus('☁️ 追加の変更をクラウドに保存しています…');
    }
    return true;
  }catch(err){
    console.warn('cloud write prevented',err);
    v35Cloud.pending=true;v352SetDirty(uid,true);
    if(String(err).includes('V35_REVISION_CONFLICT')){
      v35Cloud.conflict=true;v35Cloud.linked=false;
      v35SetStatus('⚠️ 別端末と更新が衝突しました。両方の記録を守るため同期を停止しました。ファイルバックアップを保存してから引き継ぎを確認してください。');
    }else{
      v35Cloud.retryMs=Math.min(60000,Math.round(v35Cloud.retryMs*1.8));
      v35SetStatus('☁️ 通信できず同期待ち。データは端末に保存されています。接続が戻ると再試行します。');
    }
    throw err;
  }finally{
    v35Cloud.syncing=false;v352RenderSaveStatus();
    if(v35Cloud.pending&&v35Cloud.linked&&!v35Cloud.conflict){
      clearTimeout(v35Cloud.timer);
      v35Cloud.timer=setTimeout(()=>{v35FlushCloudSave().catch(()=>{})},v35Cloud.retryMs);
    }
  }
}

/* V35.1: native email/password authentication via Firebase Auth.
 * Display name is cosmetic; uid identifies the owner's Firestore document.
 * Password is never written to localStorage, Firestore, or telemetry.
 */
let v36AuthMode='login';
let v36AuthBusy=false;
let v36AuthFocusReturn=null;
function v36SetAuthStatus(message){const e=document.getElementById('v36AuthError');if(e)e.textContent=message||''}
function v36ShowAuth(mode='login'){
  if(v35Cloud.user){v35SetStatus('すでにログイン中だよ。別のアカウントなら先にログアウトしてね。');return}
  v36AuthMode=mode==='signup'?'signup':'login';
  v36AuthFocusReturn=document.activeElement;
  v36RenderAuthMode();v36SetAuthStatus('');
  document.getElementById('v36AuthDialog')?.classList.remove('hidden');
  document.getElementById('v36AuthEmail')?.focus();
}
function v36HideAuth(){
  if(v36AuthBusy)return;
  document.getElementById('v36AuthDialog')?.classList.add('hidden');
  const pass=document.getElementById('v36AuthPassword');if(pass)pass.value='';
  v36SetAuthStatus('');
  if(v36AuthFocusReturn?.isConnected)v36AuthFocusReturn.focus();
}
function v36RenderAuthMode(){
  const signup=v36AuthMode==='signup';
  document.getElementById('v36AuthTitle').textContent=signup?'新しいアカウントを作る':'アカウントでログイン';
  document.getElementById('v36AuthNameRow')?.classList.toggle('hidden',!signup);
  document.getElementById('v36AuthName').required=signup;
  document.getElementById('v36AuthPassword').autocomplete=signup?'new-password':'current-password';
  document.getElementById('v36AuthSubmit').textContent=signup?'新規登録してデータを保存':'ログインして引き継ぐ';
  document.getElementById('v36AuthReset')?.classList.toggle('hidden',signup);
  for(const [id,selected] of [['v36AuthSignupTab',signup],['v36AuthLoginTab',!signup]]){
    const button=document.getElementById(id);button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  }
  document.getElementById('v36AuthPassword').value='';
  v36SetAuthStatus('');
}
function v36AuthErrorMessage(err){
  const code=String(err?.code||'');
  if(code==='auth/email-already-in-use')return 'そのメールアドレスは登録済みだよ。「ログイン」を選んでね。';
  if(code==='auth/invalid-email')return 'メールアドレスの形式を確認してね。';
  if(code==='auth/weak-password')return 'パスワードが弱すぎるよ。もう少し長くしてね。';
  if(code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found')return 'メールアドレスかパスワードが違うよ。';
  if(code==='auth/too-many-requests')return 'ログインを何度も試したため一時的に制限中だよ。時間をおいてね。';
  if(code==='auth/network-request-failed')return '通信できなかったよ。インターネット接続を確認してね。';
  if(code==='auth/operation-not-allowed')return 'メールとパスワードの認証がFirebaseで有効になっていないよ。';
  return '認証に失敗したよ。Firebase設定や通信状態を確認してね。';
}
function v36AuthReady(){
  if(!v35Configured()){
    v36SetAuthStatus('まだFirebaseの接続先が設定されていないよ。ZIPの設定手順に沿ってFirebaseを登録してね。');return false;
  }
  if(!v35Cloud.ready){v36SetAuthStatus('アカウント機能を準備できていないよ。HTTPSでの公開とネット接続を確認してね。');return false;}
  return true;
}
async function v36SubmitAuth(e){
  e.preventDefault();if(v36AuthBusy||!v36AuthReady())return;
  const mail=document.getElementById('v36AuthEmail').value.trim();
  const passInput=document.getElementById('v36AuthPassword');
  const password=passInput.value;
  const name=document.getElementById('v36AuthName').value.trim();
  if(v36AuthMode==='signup'&&!name){v36SetAuthStatus('表示用のアカウント名を入力してね。');return}
  if(password.length<6){v36SetAuthStatus('パスワードは6文字以上で入力してね。');return}
  v36AuthBusy=true;document.getElementById('v36AuthSubmit').disabled=true;v36SetAuthStatus('認証しています…');
  try{
    const a=v35Cloud.sdk.auth;
    if(v36AuthMode==='signup'){
      const credential=await a.createUserWithEmailAndPassword(v35Cloud.auth,mail,password);
      // A chosen name is a display label only, never an authentication credential.
      try{await a.updateProfile(credential.user,{displayName:name.slice(0,20)})}catch(err){console.warn('display profile update failed',err)}
      if(!state.userName){const input=document.getElementById('nameInput');if(input)input.value=name.slice(0,20)}
    }else{
      await a.signInWithEmailAndPassword(v35Cloud.auth,mail,password);
    }
    passInput.value='';
    v36AuthBusy=false;
    v36HideAuth();
    // Auth state listener handles selecting local vs remote data and sync permission.
  }catch(err){console.warn('email auth error code:',err?.code);v36SetAuthStatus(v36AuthErrorMessage(err));passInput.value=''}
  finally{v36AuthBusy=false;document.getElementById('v36AuthSubmit').disabled=false}
}
async function v36ResetPassword(){
  if(v36AuthBusy||!v36AuthReady())return;
  const email=document.getElementById('v36AuthEmail').value.trim();
  if(!email||!document.getElementById('v36AuthEmail').checkValidity()){
    v36SetAuthStatus('先に登録したメールアドレスを入力してね。');return;
  }
  try{await v35Cloud.sdk.auth.sendPasswordResetEmail(v35Cloud.auth,email);v36SetAuthStatus('再設定メールを送信したよ。届かない場合は迷惑メールも確認してね。')}
  catch(err){v36SetAuthStatus(v36AuthErrorMessage(err))}
}
async function v352ResolveConflict(){
  if(!v35Cloud.user||!v35Cloud.conflict)return;
  if(!state.lastBackupAt||Date.now()-Date.parse(state.lastBackupAt)>600000){
    v35SetStatus('まず「💾 ファイル保存」で現在の記録を退避してから続けてね。');return;
  }
  if(!confirm('クラウドの記録をこの端末に取り込みます。\n今この端末にある未同期の変更は、クラウドへは送られません。\nファイルバックアップが手元にあることを確認しましたか？'))return;
  await v35OnSignedIn(v35Cloud.user,{forceRemote:true});
}
function v36InitAuthUI(){
  document.getElementById('v36AuthLoginTab')?.addEventListener('click',()=>{v36AuthMode='login';v36RenderAuthMode()});
  document.getElementById('v36AuthSignupTab')?.addEventListener('click',()=>{v36AuthMode='signup';v36RenderAuthMode()});
  document.getElementById('v36AuthClose')?.addEventListener('click',v36HideAuth);
  document.getElementById('v36AuthForm')?.addEventListener('submit',v36SubmitAuth);
  document.getElementById('v36AuthReset')?.addEventListener('click',v36ResetPassword);
  document.getElementById('v36TransferEmailBtn')?.addEventListener('click',()=>v36ShowAuth('login'));
  document.getElementById('v36EmailLoginBtn')?.addEventListener('click',()=>v36ShowAuth('login'));
  document.getElementById('v352ConflictResolveBtn')?.addEventListener('click',v352ResolveConflict);
  document.getElementById('v36CloudSaveNowBtn')?.addEventListener('click',async()=>{
    if(!v35Cloud.user||!v35Cloud.linked||v35Cloud.conflict)return v35SetStatus('ログインと同期を有効にしてから保存してね。');
    try{const ok=await v35FlushCloudSave();if(ok&&!v35Cloud.pending)toast('クラウドへ保存したよ');else toast('まだ同期待ちだよ。保存状態を確認してね')}catch{toast('同期待ちになったよ。端末には保存済み')}
  });
  document.getElementById('v36AuthDialog')?.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();v36HideAuth();return}
    if(e.key!=='Tab')return;
    const controls=[...e.currentTarget.querySelectorAll('button:not(:disabled):not(.hidden),input:not(:disabled)')]
      .filter(el=>el.getClientRects().length && !el.closest('.hidden'));
    if(!controls.length)return;
    if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls[controls.length-1].focus()}
    else if(!e.shiftKey&&document.activeElement===controls[controls.length-1]){e.preventDefault();controls[0].focus()}
  });
}

function v35InitAccountUI(){
  v35UpdateEntry();v35UpdateAccountButtons();v36InitAuthUI();
  document.getElementById('v35TransferStartBtn')?.addEventListener('click',()=>{
    v35TransferPending=true;v35ShowTransfer(true);
  });
  document.getElementById('v35TransferBackBtn')?.addEventListener('click',()=>{v35TransferPending=false;v35ShowTransfer(false)});
  document.getElementById('v35TransferFileBtn')?.addEventListener('click',()=>document.getElementById('importFile')?.click());
  document.getElementById('v35TransferGoogleBtn')?.addEventListener('click',v35GoogleSignIn);
  document.getElementById('v35GoogleLoginBtn')?.addEventListener('click',v35GoogleSignIn);
  document.getElementById('v35GoogleLogoutBtn')?.addEventListener('click',v35GoogleSignOut);
  document.getElementById('v35AccountBackupBtn')?.addEventListener('click',exportData);
  window.addEventListener('online',()=>{if(v35Cloud.linked&&(v35Cloud.pending||v352IsDirty(v35Cloud.user?.uid||''))){v35Cloud.retryMs=2200;v35FlushCloudSave().catch(()=>{})}else if(v35Cloud.user&&!v35Cloud.linked&&!v35Cloud.conflict)v35OnSignedIn(v35Cloud.user)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&v35Cloud.linked&&v35Cloud.pending)v35FlushCloudSave().catch(()=>{})});
  window.addEventListener('pagehide',()=>{if(v35Cloud.user&&v35Cloud.pending)v352SetDirty(v35Cloud.user.uid,true)});
  v352RenderSaveStatus();
  v35InitFirebase();
}

function bind(){bindTutorial();document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));document.getElementById('backBtn').onclick=()=>go(previousScreen||'home');document.getElementById('splashBgmToggle').onclick=()=>{
    if(state.bgmEnabled)stopBGM(true);
    else{state.bgmEnabled=true;saveState();renderBgmState()}
  };
  document.getElementById('startAppBtn').onclick=()=>v35FinishSplashStart();document.querySelectorAll('.partner-pick').forEach(b=>b.onclick=()=>{document.querySelectorAll('.partner-pick').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});document.getElementById('finishOnboardingBtn').onclick=()=>{const name=document.getElementById('nameInput').value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,20);if(!name)return toast('ニックネームを入力してね');state.userName=name;state.partner=document.querySelector('.partner-pick.selected').dataset.partner;state.tutorialDone=false;saveState();document.getElementById('onboarding').classList.add('hidden');renderAll();openTutorial()};document.getElementById('homeMascot').onclick=()=>{
      const art=document.querySelector('#homeMascot .mascot-art');
      if(art){art.classList.remove('mascot-tapped');void art.offsetWidth;art.classList.add('mascot-tapped')}
      setMascotMood('talk',0);openTalk();
    };document.getElementById('quickTalkBtn').onclick=openTalk;document.getElementById('changePartnerHome')?.addEventListener('click',showPartnerChoice);document.getElementById('changePartnerBtn').onclick=showPartnerChoice;document.getElementById('notifyBtn').onclick=showTodayNotice;document.getElementById('addItemBtn').onclick=()=>addItem('today');document.getElementById('addTomorrowBtn').onclick=()=>addItem('tomorrow');document.querySelectorAll('[data-manage-item-sets]').forEach(b=>b.onclick=()=>showItemSetManager(b.dataset.manageItemSets));document.querySelectorAll('[data-quick-item]').forEach(b=>b.onclick=()=>addQuickItem(b.dataset.quickItem,b.dataset.quickEmoji||'🎒'));document.getElementById('completeCheckBtn').onclick=reviewBeforeDeparture;document.getElementById('noOutingBtn').onclick=noOuting;document.getElementById('honestBtn').onclick=honestReport;document.getElementById('saveTomorrowBtn').onclick=reviewBeforeTomorrow;document.querySelectorAll('[data-market-tab]').forEach(b=>b.onclick=()=>setMarketTab(b.dataset.marketTab));document.getElementById('gachaOneBtn').onclick=()=>doGacha(1);document.getElementById('gachaTenBtn').onclick=()=>doGacha(10);document.getElementById('gachaSpeedBtn').onclick=toggleGachaSpeed;document.getElementById('gachaHistoryBtn').onclick=showGachaHistory;document.getElementById('gachaRatesBtn').onclick=showGachaRatesDetail;document.getElementById('gachaRevealAllBtn').onclick=revealAllGachaCards;document.getElementById('medalExchangeBtn').onclick=showMedalExchange;document.getElementById('gachaOpenBtn').onclick=openGachaPocket;document.getElementById('gachaSkipBtn').onclick=skipGachaCinematic;document.getElementById('gachaCloseBtn').onclick=closeGachaCinematic;document.getElementById('gachaAgainBtn').onclick=()=>{const t=activeGacha?.times||1;closeGachaCinematic();doGacha(t)};document.getElementById('gachaCinematic').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(e.currentTarget.classList.contains('phase-results'))closeGachaCinematic();else skipGachaCinematic()}});document.getElementById('gachaCineStage').onclick=e=>{if(e.target.closest('.gacha-open-btn')||e.target.closest('.gacha-reveal-panel')||e.target.closest('.gacha-skip-btn'))return;if(document.getElementById('gachaCinematic').classList.contains('phase-ready'))openGachaPocket()};document.getElementById('startWalkBtn').onclick=()=>startWalk(false);document.getElementById('finishWalkBtn').onclick=finishWalk;document.getElementById('openAiBtn').onclick=openAI;document.getElementById('aiClose').onclick=closeAI;bindDeviceCamera();document.getElementById('modalClose').onclick=closeModal;document.getElementById('modalBackdrop').onclick=e=>{if(e.target===e.currentTarget)closeModal()};document.getElementById('aiBackdrop').onclick=e=>{if(e.target===e.currentTarget)closeAI()};document.getElementById('themeBtn').onclick=showThemePicker;document.getElementById('soundBtn').onclick=()=>{state.sound=!state.sound;saveState();renderAll();toast(`効果音 ${state.sound?'ON':'OFF'}`)};document.getElementById('bgmBtn').onclick=showBgmPicker;document.getElementById('renameBtn').onclick=()=>{const input=prompt('新しいニックネーム（20文字まで）',state.userName);if(input===null)return;const name=input.replace(/[\u0000-\u001f\u007f]/g,'').trim();if(!name)return toast('ニックネームを入力してね');if(Array.from(name).length>20)return toast('ニックネームは20文字以内にしてね');state.userName=name;saveState();renderAll();toast('ニックネームを変更したよ')};document.getElementById('exportBtn').onclick=exportData;document.getElementById('importBtn').onclick=()=>document.getElementById('importFile').click();document.getElementById('importFile').onchange=e=>importData(e.target.files[0]);document.getElementById('resetBtn').onclick=showResetMenu;
document.getElementById('quickFontBtn').onclick=openFontSettings;
document.getElementById('fontSizeRange').oninput=e=>chooseFontStep(e.target.value);
document.getElementById('fontSizeMinus').onclick=()=>chooseFontStep(state.fontStep-1);
document.getElementById('fontSizePlus').onclick=()=>chooseFontStep(state.fontStep+1);
document.getElementById('contrastToggle').onchange=e=>{state.highContrast=!!e.target.checked;applyFontPreferences();saveState()};
document.getElementById('fontResetBtn').onclick=()=>{state.fontStep=1;state.highContrast=false;applyFontPreferences();saveState();toast('文字の設定を標準に戻したよ')};
document.getElementById('mascotMotionToggle').addEventListener('change',event=>{
  const previous=state.mascotMotionMode;
  state.mascotMotionMode=event.currentTarget.checked?'on':'off';
  if(!saveState()){
    state.mascotMotionMode=previous;
    syncMascotMotion();
    toast('保存できなかったため、相棒の動きの設定を変更しませんでした');
    return;
  }
  syncMascotMotion();
  toast(`相棒の動き ${event.currentTarget.checked?'ON':'OFF'}`);
});
document.getElementById('motionBtn').onclick=()=>{state.reducedMotion=!state.reducedMotion;saveState();renderAll();toast(`アニメーション軽減 ${state.reducedMotion?'ON':'OFF'}`)};
document.getElementById('powerBtn').onclick=()=>{state.powerSaving=!state.powerSaving;saveState();renderAll();toast(`省電力モード ${state.powerSaving?'ON':'OFF'}`)};
document.getElementById('morningReminderToggle').onchange=e=>{state.reminders.morningEnabled=e.target.checked;saveState();renderSettings();startReminderScheduler()};
document.getElementById('nightReminderToggle').onchange=e=>{state.reminders.nightEnabled=e.target.checked;saveState();renderSettings();startReminderScheduler()};
document.getElementById('morningReminderTime').onchange=e=>{state.reminders.morningTime=e.target.value||'07:30';state.reminders.lastMorningDate='';saveState();renderSettings()};
document.getElementById('nightReminderTime').onchange=e=>{state.reminders.nightTime=e.target.value||'21:00';state.reminders.lastNightDate='';saveState();renderSettings()};
document.getElementById('notificationPermissionBtn').onclick=requestNotificationPermission;document.getElementById('v321ReminderDismiss')?.addEventListener('click',closeInAppReminder);document.getElementById('v321ReminderAction')?.addEventListener('click',e=>{const target=e.currentTarget.dataset.target||'check';closeInAppReminder();go(target)});
document.getElementById('calendarPrev').onclick=()=>{historyMonthCursor=new Date(historyMonthCursor.getFullYear(),historyMonthCursor.getMonth()-1,1);renderHistory()};
document.getElementById('calendarNext').onclick=()=>{historyMonthCursor=new Date(historyMonthCursor.getFullYear(),historyMonthCursor.getMonth()+1,1);renderHistory()};
  document.querySelectorAll('#inventoryFilters button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#inventoryFilters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderInventory(b.dataset.filter)});
  renderTestModeState();
}


// V27.2: development-only time travel. All test rewards live in an isolated save.
function renderTestModeState(){
  const details=document.getElementById('devTools');if(!details)return;
  details.hidden=!(IS_DEV_MODE || new URLSearchParams(location.search).has('debug'));
  details.classList.toggle('is-dev-active',IS_DEV_MODE);
  const info=document.getElementById('devDateStatus');
  if(info)info.textContent=IS_DEV_MODE?`🧪 テスト日付：${TODAY()}（現実＋${testOffsetDays()}日）／保存先：テスト専用`:'通常プレイ中です。テストを始めても普段のデータは変更されません。';
  const main=document.getElementById('testModeBtn');if(main)main.textContent=IS_DEV_MODE?'✓ テスト終了・元のデータへ':'🧪 テストモード開始';
  ['testDayBtn','testWeekBtn','testTodayBtn','testRankBtn','testCoinsBtn'].forEach(id=>{const b=document.getElementById(id);if(b){b.hidden=!IS_DEV_MODE;b.disabled=!IS_DEV_MODE;}});
  const flag=document.getElementById('devModeFlag');if(flag){flag.hidden=!IS_DEV_MODE;flag.textContent=`🧪 テスト中 ${TODAY()}`;}
}
function toggleTestMode(){
  try{
    if(IS_DEV_MODE){
      if(!confirm('テストを終了して元のプレイデータに戻る？ テストで得たポイントや履歴は本番に反映されません。'))return;
      sessionStorage.removeItem(DEV_SESSION_KEY);
      sessionStorage.removeItem(DEV_OFFSET_KEY);
      localStorage.removeItem(DEV_STORAGE_KEY);
    }else{
      if(!confirm('テスト用に現在のデータをコピーします。本番のポイント・履歴は変わりません。開始しますか？'))return;
      localStorage.setItem(DEV_STORAGE_KEY,JSON.stringify(state));
      sessionStorage.setItem(DEV_OFFSET_KEY,'0');
      sessionStorage.setItem(DEV_SESSION_KEY,'1');
    }
    location.reload();
  }catch(err){console.warn('test mode',err);toast('ブラウザの保存機能が使えないためテストを開始できません');}
}
function advanceTestDate(days){
  if(!IS_DEV_MODE)return toast('テストモードを開始してね');
  if(walkSession||webcamStream)return toast('ウォーキングやカメラを終了してから進めてね');
  const value=testOffsetDays()+days;
  if(value>365)return toast('日付は365日先まで試せるよ');
  try{sessionStorage.setItem(DEV_OFFSET_KEY,String(value))}catch{return toast('テスト日付を保存できないよ')}
  refreshOnReturn();
  renderTestModeState();
  const greeting=document.getElementById('homeSpeech');if(greeting)greeting.textContent=contextualGreeting();
  toast(`テスト日付を${TODAY()}に進めたよ`);
}
function resetTestDate(){
  if(!IS_DEV_MODE)return;
  if(!confirm('テスト用の日付を現実の今日に戻す？ 進めた日のテスト履歴はそのまま残ります。'))return;
  try{sessionStorage.setItem(DEV_OFFSET_KEY,'0')}catch{return toast('日付を戻せなかったよ')}
  refreshOnReturn();renderTestModeState();toast('テストの日付を現実の今日へ戻したよ');
}

let lastUiDay=TODAY();
function refreshOnReturn(){
  if(document.hidden)return;
  const d=TODAY();
  if(d!==lastUiDay){lastUiDay=d;normalizeDaily();registerVisit();applyDailyLogin();selectedHistoryDate=d;historyMonthCursor=new Date(gameNow().getFullYear(),gameNow().getMonth(),1);renderAll();renderTestModeState();}
  checkReminderTick();weatherRefreshIfNeeded();
}
document.addEventListener('visibilitychange',refreshOnReturn);
window.addEventListener('focus',refreshOnReturn);
window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('careReviewBtn')?.addEventListener('click',showCareReview);
  document.getElementById('careForgetBtn')?.addEventListener('click',showForgetReport);
  document.getElementById('careForgetTopBtn')?.addEventListener('click',showForgetReport);
  bind();v35InitAccountUI();normalizeDaily();registerVisit();const loginBonus=applyDailyLogin();renderAll();renderMascots();renderBgmState();armBgmResume();startReminderScheduler();
  document.getElementById('v32ExportBtn')?.addEventListener('click',exportData);
  document.getElementById('v32ReloadBtn')?.addEventListener('click',()=>location.reload());
  renderDataSafetyNotice();
  if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('オフライン機能の登録失敗',err));
const homeSpeech=document.getElementById('homeSpeech');if(homeSpeech)homeSpeech.textContent=contextualGreeting();renderTestModeState();startMascotAmbient();/* Standalone preview: service worker intentionally not registered. */if(!state.userName)document.getElementById('nameInput').value='';if(loginBonus&&state.userName)setTimeout(()=>{const bonus=state._lastLoginBonus||ECONOMY.loginBase;rewardBurst(`ログイン +${bonus}コイン`,'🎁','login');toast(`ログインボーナス +${bonus}コイン！`);mascotReaction(`${state.loginStreak||1}日目！今日も会えてうれしいよ！`,'☀️','happy')},900);});

document.addEventListener('visibilitychange',()=>{
  if(bgmAudio){
    if(document.hidden)bgmAudio.pause();
    else if(state.bgmEnabled&&state.bgmTrack==='pocketpop'&&bgmPlaying){
      bgmAudio.play().catch(()=>{bgmPlaying=false;armBgmResume()});
    }
  }
  if(!bgmCtx)return;
  if(document.hidden){
    if(bgmCtx.state==='running')bgmCtx.suspend().catch(()=>{});
  }else if(state.bgmEnabled){
    bgmCtx.resume().catch(()=>{});
  }
});


/* ============================================================
   V26 POKKE CRAFT — Touchable button feedback (no new dependencies)
   Uses only visual affordances: it never triggers a second click.
   ============================================================ */
function initPokkeButtonFeedback(){
  const area=document.getElementById('appShell');if(!area)return;
  const focusSelector='button:not(:disabled),[role="button"]:not([aria-disabled="true"])';
  const tactileSelector='.departure-btn,.primary-btn,.secondary-btn,.mini-btn,.round-icon,.shortcut-grid button,.bottom-nav button,.market-tab,.gacha-btn,.buy-btn,.goal-mission button,.feature-row,.check-toggle,.setting-row,.font-stepper button,.font-reset-btn,.quick-add-row button,.gacha-open-btn,.gacha-skip-btn';
  function allowMotion(){return !state?.reducedMotion&&!state?.powerSaving&&!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}
  area.addEventListener('pointerdown',ev=>{
    const btn=ev.target.closest?.(focusSelector);
    if(!btn||!area.contains(btn)||!btn.matches(tactileSelector))return;
    btn.classList.add('pokke-pressed');
    if(!allowMotion())return;
    const rect=btn.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const dot=document.createElement('i');
    dot.className='pokke-touch-wave';dot.setAttribute('aria-hidden','true');
    dot.style.left=`${ev.clientX-rect.left}px`;dot.style.top=`${ev.clientY-rect.top}px`;
    btn.appendChild(dot);
    dot.addEventListener('animationend',()=>dot.remove(),{once:true});
    setTimeout(()=>dot.remove(),650);
  },{passive:true});
  function release(ev){
    const btn=ev.target.closest?.('button,.setting-row');
    if(btn)btn.classList.remove('pokke-pressed');
  }
  ['pointerup','pointercancel','pointerleave'].forEach(type=>area.addEventListener(type,release,true));
  area.addEventListener('keydown',ev=>{
    if(ev.key!=='Enter'&&ev.key!==' ')return;
    const btn=ev.target.closest?.(focusSelector);
    if(btn?.matches(tactileSelector))btn.classList.add('pokke-pressed');
  });
  area.addEventListener('keyup',ev=>{
    if(ev.key!=='Enter'&&ev.key!==' ')return;
    ev.target.closest?.('button')?.classList.remove('pokke-pressed');
  });
  window.addEventListener('blur',()=>area.querySelectorAll('.pokke-pressed').forEach(el=>el.classList.remove('pokke-pressed')));
}
window.addEventListener('DOMContentLoaded',initPokkeButtonFeedback);

/* ================================================================
   V28.1 PC NAVIGATION: desktop-only collapsible drawer.
   Mobile/tablet reuse the existing always-visible bottom navigation.
   No game state is changed by opening or closing this panel.
   ================================================================ */
function initDesktopNavigation(){
  const shell=document.getElementById('appShell');
  const toggle=document.getElementById('desktopMenuToggle');
  const backdrop=document.getElementById('desktopMenuBackdrop');
  const nav=document.getElementById('bottomNav');
  if(!shell||!toggle||!backdrop||!nav)return;
  const desktop=window.matchMedia('(min-width:1100px)');
  let opened=false;
  const label=toggle.querySelector('.desktop-menu-toggle-label');
  const sync=()=>{
    const isPC=desktop.matches;
    const isOpen=isPC&&opened;
    shell.classList.toggle('desktop-menu-open',isOpen);
    toggle.setAttribute('aria-expanded',String(isOpen));
    toggle.setAttribute('aria-label',isOpen?'機能メニューを閉じる':'機能メニューを開く');
    label.textContent=isOpen?'閉じる':'メニュー';
    nav.inert=isPC&&!isOpen;
    backdrop.setAttribute('aria-hidden',String(!isOpen));
  };
  const close=(restoreFocus=false)=>{
    if(!opened)return;
    opened=false;sync();
    if(restoreFocus&&desktop.matches)toggle.focus();
  };
  toggle.addEventListener('click',()=>{
    if(!desktop.matches)return;
    opened=!opened;
    sync();
    if(opened)nav.querySelector('button.active,button[data-go]')?.focus();
    else toggle.focus();
  });
  backdrop.addEventListener('click',()=>close(true));
  nav.addEventListener('click',ev=>{
    if(ev.target.closest('button[data-go]')&&opened)close(true);
  });
  document.addEventListener('keydown',ev=>{
    if(!desktop.matches||!opened)return;
    if(ev.key==='Escape'){
      ev.preventDefault();close(true);return;
    }
    if(ev.key==='Tab'){
      // Keep focus inside the open navigation and its toggle.
      const focusable=[toggle,...nav.querySelectorAll('button:not(:disabled)')];
      const i=focusable.indexOf(document.activeElement);
      if(ev.shiftKey&&(i<=0)){ev.preventDefault();focusable.at(-1)?.focus()}
      else if(!ev.shiftKey&&(i===focusable.length-1||i===-1)){
        ev.preventDefault();toggle.focus();
      }
    }
  });
  const onResize=()=>{if(!desktop.matches)opened=false;sync()};
  if(desktop.addEventListener)desktop.addEventListener('change',onResize);
  else desktop.addListener(onResize);
  sync();
}
window.addEventListener('DOMContentLoaded',initDesktopNavigation);



/* V30: 曜日ごとの教科と持ち物の連携。外部AIではなく登録データに基づく提案です。 */
(function(){
  'use strict';
  const KEY=SCHEDULE_STORAGE_KEY;
  const DAY=['日','月','火','水','木','金','土'];
  const RULES=[
    [['国語','現代文','古文','言語文化'],['国語の教科書','国語のノート']],
    [['数学'],['数学の教科書','数学のノート','定規']],
    [['英語','コミュニケーション英語'],['英語の教科書','英語のノート','英単語帳']],
    [['理科','化学','物理','生物','地学'],['理科の教科書','理科のノート']],
    [['社会','地理','歴史','公共','政治経済'],['社会の教科書','社会のノート']],
    [['体育','保健体育'],['体操服','体育館シューズ','タオル']],
    [['美術'],['スケッチブック','画材']],
    [['音楽'],['音楽の教科書']],
    [['情報','プログラミング'],['情報の教材','パソコン']],
    [['実習'],['実習の教材','実習用具']],
    [['家庭科'],['家庭科の教科書']],
  ];
  const common=['筆箱','ハンカチ','水筒'];
  let timetable={};
  try{const parsed=JSON.parse(localStorage.getItem(KEY)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))timetable=parsed;}catch(e){}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(timetable));if(typeof window.smapoCloudQueueSave==='function')window.smapoCloudQueueSave();return true}catch(e){console.warn('時間割の保存に失敗',e);return false}}
  function subjects(day){return String(timetable[day]||'').split(/[、,，\n／/]+/).map(x=>x.trim()).filter(Boolean).slice(0,12)}
  function suggested(day){
    const unique=new Set(common);
    for(const sub of subjects(day)){
      let matched=false;
      for(const [names,items] of RULES){if(names.some(n=>sub.includes(n))){items.forEach(x=>unique.add(x));matched=true;}}
      if(!matched)unique.add(sub+'の教材');
    }
    return [...unique];
  }
  function offsetDay(offset){const d=gameNow();d.setDate(d.getDate()+offset);return d.getDay()}
  function buttons(){
    for(const target of ['today','tomorrow']){
      const host=document.getElementById(target==='today'?'itemSetsToday':'itemSetsTomorrow');if(!host||host.previousElementSibling?.classList.contains('schedule-launch'))continue;
      const bar=document.createElement('div');bar.className='schedule-launch';
      const manage=document.createElement('button');manage.type='button';manage.textContent='📚 時間割を登録';manage.onclick=openEditor;
      const propose=document.createElement('button');propose.type='button';propose.className='suggest';propose.textContent='✨ 教科から持ち物を提案';propose.onclick=()=>openProposal(target);
      const hint=document.createElement('div');hint.className='schedule-hint';hint.textContent='時間割をもとに必要な持ち物を提案。選んだものだけ今のリストに追加します。';
      bar.append(manage,propose,hint);host.before(bar);
    }
  }
  function openEditor(){
    const days=[1,2,3,4,5,6,0];
    const html='<p class="schedule-info">曜日ごとの教科を「、」で区切って入力してね。例：国語、数学、情報、体育。入力はこの端末に保存されます。</p>'+
      days.map(d=>`<div class="schedule-grid"><label for="schedule-day-${d}">${DAY[d]}曜日</label><input id="schedule-day-${d}" maxlength="160" value="${escapeHTML(String(timetable[d]||''))}" placeholder="例：国語、数学、情報"></div>`).join('')+
      '<div class="schedule-actions"><button type="button" id="schedule-save">時間割を保存</button><button type="button" class="secondary" id="schedule-cancel">閉じる</button></div>';
    showModal('📚 週間時間割',html,{icon:'📚'});
    document.getElementById('schedule-save').onclick=()=>{
      const previous=timetable;
      const next={...timetable};
      for(const d of days)next[d]=document.getElementById('schedule-day-'+d).value.trim().slice(0,160);
      timetable=next;
      if(!save()){
        timetable=previous;
        return toast('時間割を保存できなかったよ。入力内容は画面に残しています。保存領域を確認してね');
      }
      renderPackingSummary();closeModal();toast('時間割を保存したよ！');
    };
    document.getElementById('schedule-cancel').onclick=closeModal;
  }
  function openProposal(target){
    const day=offsetDay(target==='today'?0:1),sub=subjects(day),names=suggested(day);
    const existing=new Set(itemSetTargetList(target).map(x=>String(x.name).trim()));
    const fresh=names.filter(x=>!existing.has(x));
    const heading=`<div class="schedule-summary"><b>${target==='today'?'今日':'明日'}（${DAY[day]}曜日）の教科</b><div>${sub.length?sub.map(x=>`<span class="schedule-chip">${escapeHTML(x)}</span>`).join(''):'時間割未登録。共通の持ち物のみを提案しています。'}</div><small>すでに登録されている持ち物は重複追加しません。実際の授業・学校の指定を確認してね。</small></div>`;
    const body=heading+(fresh.length?`<div class="schedule-preview">${fresh.map((x,i)=>`<label class="schedule-choice"><input type="checkbox" data-schedule-pick="${i}" checked><span>${escapeHTML(x)}</span></label>`).join('')}</div>`:'<p>新しく追加できる持ち物はありません。</p>')+
      '<div class="schedule-actions"><button type="button" id="schedule-apply">選択した持ち物を追加</button><button type="button" class="secondary" id="schedule-edit">時間割を編集</button></div>';
    showModal('🎒 教科に合う持ち物',body,{icon:'🎒'});
    const apply=document.getElementById('schedule-apply');apply.disabled=!fresh.length||!itemSetCanModify(target);
    if(!itemSetCanModify(target))apply.title='準備・チェックが終了したリストは変更できません';
    apply.onclick=()=>{
      if(!itemSetCanModify(target))return toast('終了済みのリストには追加できないよ');
      const selected=[...document.querySelectorAll('[data-schedule-pick]:checked')].map(el=>fresh[Number(el.dataset.schedulePick)]).filter(Boolean);
      const list=itemSetTargetList(target),current=new Set(list.map(x=>String(x.name).trim()));let count=0;
      selected.forEach(name=>{if(!current.has(name)){list.push({id:'schedule-'+Date.now()+'-'+count,name,checked:false});current.add(name);count++}});
      if(count){if(target==='today')state.activeSetToday='';else state.activeSetTomorrow='';saveState();}
      closeModal();renderAll();toast(count?`${count}個の持ち物を追加したよ！`:'追加する持ち物が選ばれていないよ');
    };
    document.getElementById('schedule-edit').onclick=openEditor;
  }
  window.smapoScheduleAssist={subjects, suggested, offsetDay, days:DAY,
    exportSchedule:()=>Object.fromEntries(Object.entries(timetable).filter(([k,v])=>/^[0-6]$/.test(k)).map(([k,v])=>[k,String(v||'').slice(0,160)])),
    importSchedule:raw=>{const previous=timetable;timetable=raw;if(!save()){timetable=previous;throw Error('時間割を保存できませんでした');}}
  };
  window.addEventListener('DOMContentLoaded',buttons);
})();




// V32.3 integrated packing planner: suggestions are advisory until the user accepts them.
function packingSuggestions(target){
  const list=itemSetTargetList(target),used=new Set(list.map(x=>forgetKey(x.name))),matches=new Map();
  const add=(name,reason,emoji='🎒')=>{
    const key=forgetKey(name);if(!key||used.has(key))return;
    if(!matches.has(key))matches.set(key,{name,emoji,reasons:[]});
    const entry=matches.get(key);if(!entry.reasons.includes(reason))entry.reasons.push(reason);
  };
  const schedule=window.smapoScheduleAssist;
  if(schedule){
    const day=schedule.offsetDay(target==='today'?0:1),subs=schedule.subjects(day);
    // When no timetable was entered, don't claim these are class-specific suggestions.
    if(subs.length)for(const name of schedule.suggested(day))add(name,'時間割からの提案',suggestedEmoji(name));
  }
  const weather=weatherDay(target);
  if(weather)for(const feat of weatherRecommend(weather)){
    if(!weatherItemExists(list,feat)&&!weatherDefault().suppressed[`${target}|${weatherTargetDate(target)}|${feat.id}`])add(feat.name,'天気予報からの提案',feat.emoji);
  }
  for(const name of availableSuggestions(target))add(name,isEssential(name)?'重要品の登録':'過去の忘れ物記録',suggestedEmoji(name));
  return [...matches.values()].slice(0,50);
}
function renderPackingSummary(){
  for(const target of ['today','tomorrow']){
    const el=document.getElementById(target==='today'?'v323SummaryToday':'v323SummaryTomorrow');
    if(!el)continue;
    const n=packingSuggestions(target).length;
    const weather=weatherDay(target),day=window.smapoScheduleAssist?.offsetDay(target==='today'?0:1);
    const subs=day==null?[]:window.smapoScheduleAssist.subjects(day);
    el.textContent=`📚 ${subs.length?subs.slice(0,3).join('・'):'時間割未登録'} ／ 🌦️ ${weather?weatherDescription(weather)[1]:'予報未取得'} ／ 追加候補 ${n}個`;
  }
}
function openPackingPlanner(target='today'){
  const label=target==='today'?'今日':'明日';
  const candidates=packingSuggestions(target),modifiable=itemSetCanModify(target);
  const schedule=window.smapoScheduleAssist,day=schedule?.offsetDay(target==='today'?0:1);
  const subjects=day==null?[]:schedule.subjects(day);
  const weather=weatherDay(target);
  const html=`<div class="v323-plan"><p><b>📚 教科：</b>${subjects.length?escapeHTML(subjects.join('・')):'時間割は未登録'}</p><p><b>🌤️ 天気：</b>${weather?escapeHTML(weatherDescription(weather)[1]):'取得できていません（提案には反映されません）'}</p><p>重要品・過去の忘れ物もまとめて確認します。学校からの指示や実際の予定を優先してね。</p>${candidates.length?`<div class="v323-plan-list">${candidates.map((x,i)=>`<label><input type="checkbox" data-v323-choice="${i}" checked ${modifiable?'':'disabled'}><span><b>${escapeHTML(x.emoji)} ${escapeHTML(x.name)}</b><small>${escapeHTML(x.reasons.join('・'))}</small></span></label>`).join('')}</div>`:'<p class="v323-no-candidates">今のリストに追加する候補はないよ。実際の予定も確認してね。</p>'}<p class="v323-disclaimer">※予報・時間割からの候補は推測です。実物の所持は保証しません。</p><button type="button" id="v323PlanApply" class="primary-btn" ${modifiable&&candidates.length?'':'disabled'}>選択したものを追加</button></div>`;
  showModal(`🎒 ${label}の準備をまとめて確認`,html,{icon:'🎒',actions:[{label:'閉じる'}]});
  const button=document.getElementById('v323PlanApply');
  button.onclick=()=>{
    if(!itemSetCanModify(target))return toast('終了済みのリストは変更できないよ');
    const list=itemSetTargetList(target),existing=new Set(list.map(x=>forgetKey(x.name)));let count=0;
    for(const el of document.querySelectorAll('[data-v323-choice]:checked')){
      const x=candidates[Number(el.dataset.v323Choice)];if(!x||list.length>=50||existing.has(forgetKey(x.name)))continue;
      list.push({id:`plan-${target}-${Date.now()}-${count}`,name:x.name,emoji:x.emoji,hint:'',checked:false});existing.add(forgetKey(x.name));count++;
    }
    if(count){if(target==='today')state.activeSetToday='';else state.activeSetTomorrow='';saveState();}
    closeModal();renderAll();toast(count?`${count}個の持ち物を追加したよ`:'追加した持ち物はないよ');
  };
}
window.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-v323-planner]').forEach(btn=>btn.addEventListener('click',()=>openPackingPlanner(btn.dataset.v323Planner)));
  // Removed the rarely-used unchecked-first control from the release UI.
  document.querySelectorAll('[data-v323-undo]').forEach(btn=>btn.addEventListener('click',()=>undoItemEdit(btn.dataset.v323Undo)));
});

/* V31.6 追加: 忘れ物ゼロ・安心ナビ。チェックはあくまで本人の実物確認。 */
function isEssential(name){return (state.essentialNames||[]).some(x=>forgetKey(x)===forgetKey(name))}
function essentialNames(){return Array.isArray(state.essentialNames)?state.essentialNames:[]}
function availableSuggestions(target){
  const items=itemSetTargetList(target),existing=new Set(items.map(x=>forgetKey(x.name)));
  const candidates=[...essentialNames(),...forgetStats().map(x=>x.name)];const used=new Set();
  return candidates.filter(name=>{const key=forgetKey(name);if(!key||existing.has(key)||used.has(key))return false;used.add(key);return true}).slice(0,25);
}
function suggestedEmoji(name){
  const x=String(name);
  if(/鍵|キー/.test(x))return '🔑';if(/財布|定期|交通/.test(x))return '👛';if(/スマホ|携帯|電話/.test(x))return '📱';
  if(/水筒|飲/.test(x))return '🧴';if(/傘/.test(x))return '☂️';if(/本|教科書|ノート|教材/.test(x))return '📚';
  if(/筆|ペン/.test(x))return '✏️';if(/パソコン|PC/.test(x))return '💻';if(/充電/.test(x))return '🔌';return '🎒';
}
function toggleEssential(name){
  name=String(name||'').trim().slice(0,35);if(!name)return;
  if(!Array.isArray(state.essentialNames))state.essentialNames=[];
  if(isEssential(name))state.essentialNames=state.essentialNames.filter(x=>forgetKey(x)!==forgetKey(name));
  else if(state.essentialNames.length<25)state.essentialNames.push(name);
  else return toast('重要品は25個まで登録できるよ');
  saveState();renderAll();toast(isEssential(name)?`「${name}」を重要品に登録したよ`:`「${name}」を重要品から外したよ`);
}
function renderForgetGuard(){
  const top=forgetStats().slice(0,3),important=essentialNames(),todayMissing=availableSuggestions('today'),tomMissing=availableSuggestions('tomorrow');
  const todayUnchecked=state.items.filter(x=>!x.checked),tomUnchecked=state.tomorrowItems.filter(x=>!x.checked);
  const completed=isCheckCompletedToday(),reserved=!!(state.nightBonus&&state.nightBonusDate===tomorrowDate());
  const steps=document.getElementById('fgHomeSteps');
  if(steps)steps.innerHTML=[
    {good:important.length>0,txt:important.length?`大事な物を${important.length}個登録済み`:'大事な持ち物を登録する'},
    {good:completed||todayUnchecked.length===0,txt:completed?'今日の出発前チェックは完了':`今日の未確認：${todayUnchecked.length}個`},
    {good:reserved,txt:reserved?'明日の準備が予約済み':`明日の準備：${state.tomorrowItems.length-tomUnchecked.length}/${state.tomorrowItems.length}個`}
  ].map(x=>`<div class="fg-step ${x.good?'done':'warn'}"><span>${x.good?'✅':'○'}</span>${escapeHTML(x.txt)}</div>`).join('');
  const tip=document.getElementById('fgHomeTip');
  if(tip)tip.textContent=todayMissing.length?`今日の持ち物に、重要品や忘れたことがある物が${todayMissing.length}個入っていないかも。必要か確認しよう。`:top.length?`最近忘れた「${top[0].name}」は要注意。いつもより丁寧に確認しよう。`:'チェックは実物を見ながら。重要品を登録すると確認漏れにも気づきやすくなるよ。';
  for(const [target,statusId,pillsId] of [['today','fgTodayStatus','fgTodayPills'],['tomorrow','fgTomorrowStatus','fgTomorrowPills']]){
    const list=itemSetTargetList(target),missing=target==='today'?todayMissing:tomMissing;
    const p=document.getElementById(statusId),host=document.getElementById(pillsId);
    if(p){p.classList.toggle('urgent',missing.length>0);p.textContent=missing.length?`リストに入っていない候補が${missing.length}個。必要な物だけ追加してね。`:important.length||top.length?'重要品・忘れやすい物はリストに入っているよ。':'重要品を設定するとリストの漏れを見つけやすくなるよ。'}
    if(host){
      const featured=[...important,...top.map(x=>x.name)].filter((x,i,a)=>a.findIndex(y=>forgetKey(y)===forgetKey(x))===i).slice(0,8);
      host.innerHTML=featured.length?featured.map(name=>{
        const found=list.find(x=>forgetKey(x.name)===forgetKey(name));
        const color=!found?'missing':found.checked?'ready':'pending';
        return `<span class="fg-pill ${color}">${!found?'＋':found.checked?'✓':'○'} ${escapeHTML(name)}</span>`;
      }).join(''):'<span class="fg-pill">⭐ 重要な持ち物を登録してみよう</span>';
    }
    const btn=document.getElementById(target==='today'?'fgSuggestToday':'fgSuggestTomorrow');
    if(btn)btn.disabled=!missing.length||!itemSetCanModify(target);
  }
}
function showEssentialManager(){
  const common=['家の鍵','財布','スマホ','水筒','筆箱','定期券','ハンカチ','充電器'];
  const proposals=[...essentialNames(),...state.items.map(x=>x.name),...state.tomorrowItems.map(x=>x.name),...forgetStats().map(x=>x.name),...common];
  const used=new Set();const choices=proposals.filter(name=>{const key=forgetKey(name);if(!key||used.has(key))return false;used.add(key);return true}).slice(0,50);
  const html=`<p class="fg-modal-lead">「絶対に忘れたくない物」を選んでね。今日・明日のリストにない場合は教えてくれるよ。<b>ここで選ぶだけでは、リストに勝手に追加されないよ。</b></p><div class="fg-select-list">${choices.map((name,i)=>`<label class="fg-select"><input type="checkbox" data-fg-essential="${i}" ${isEssential(name)?'checked':''}><span>${suggestedEmoji(name)} ${escapeHTML(name)}</span></label>`).join('')}</div><label class="fg-modal-lead" for="fgNewEssential">ほかの大切な物を追加</label><div class="fg-custom"><input id="fgNewEssential" maxlength="35" placeholder="例：実習の名札"><button id="fgNewEssentialBtn" type="button">追加</button></div><div class="fg-modal-actions"><button class="fg-main" id="fgSaveEssentials" type="button">重要品を保存</button><button type="button" id="fgEssClose">閉じる</button></div>`;
  showModal('⭐ 重要な持ち物の設定',html,{icon:'⭐'});
  document.getElementById('fgSaveEssentials').onclick=()=>{
    const newNames=[...document.querySelectorAll('[data-fg-essential]:checked')].map(x=>choices[Number(x.dataset.fgEssential)]).filter(Boolean);
    if(newNames.length>25)return toast('重要品は25個まで登録できるよ');
    state.essentialNames=newNames;saveState();renderAll();closeModal();toast('重要な持ち物を保存したよ');
  };
  document.getElementById('fgEssClose').onclick=closeModal;
  document.getElementById('fgNewEssentialBtn').onclick=()=>{
    const name=document.getElementById('fgNewEssential').value.trim().slice(0,35);
    if(!name)return toast('持ち物の名前を入力してね');
    const selected=[...document.querySelectorAll('[data-fg-essential]:checked')].map(x=>choices[Number(x.dataset.fgEssential)]);
    if(!selected.some(x=>forgetKey(x)===forgetKey(name)))selected.push(name);
    if(selected.length>25)return toast('重要品は25個まで登録できるよ');
    state.essentialNames=selected;saveState();renderAll();showEssentialManager();toast('重要品の候補に追加したよ');
  };
}
function showMissingSuggestions(target='today'){
  if(!itemSetCanModify(target))return toast('このリストは終了済みのため追加できないよ');
  const missing=availableSuggestions(target),label=target==='today'?'今日':'明日';
  if(!missing.length){showModal('🎒 リストの漏れを確認',`<p class="fg-empty">重要品と忘れた記録のある物は、${label}のリストに入っているよ。<br>授業や予定に必要な物は自分でも確認してね。</p>`,{icon:'🛡️',actions:[{label:'OK',primary:true}]});return}
  const html=`<p class="fg-modal-lead">${label}のリストにない候補だよ。必要な物にチェックを入れて追加してね。<b>自動追加はしないよ。</b></p><div class="fg-select-list">${missing.map((name,i)=>`<label class="fg-select"><input type="checkbox" data-fg-suggest="${i}" checked><span>${suggestedEmoji(name)} ${escapeHTML(name)}<small>${isEssential(name)?'⭐ 重要品':'🌼 最近忘れたことがある物'}</small></span></label>`).join('')}</div><div class="fg-modal-actions"><button class="fg-main" type="button" id="fgApplySuggestions">選んだ物を追加</button><button type="button" id="fgNoSuggestions">今回は追加しない</button></div>`;
  showModal('🎒 リストにない持ち物の候補',html,{icon:'👜'});
  document.getElementById('fgNoSuggestions').onclick=closeModal;
  document.getElementById('fgApplySuggestions').onclick=()=>{
    if(!itemSetCanModify(target))return toast('終了済みのリストは変更できないよ');
    const selected=[...document.querySelectorAll('[data-fg-suggest]:checked')].map(x=>missing[Number(x.dataset.fgSuggest)]).filter(Boolean);
    const list=itemSetTargetList(target),known=new Set(list.map(x=>forgetKey(x.name)));let added=0;
    for(const name of selected){if(list.length>=50||known.has(forgetKey(name)))continue;
      list.push({id:`guard-${Date.now()}-${added}`,name,emoji:suggestedEmoji(name),hint:'',checked:false});known.add(forgetKey(name));added++;
    }
    if(added){if(target==='today')state.activeSetToday='';else state.activeSetTomorrow='';saveState();renderAll()}
    closeModal();toast(added?`${added}個の持ち物を${label}のリストに追加したよ！`:'追加できる持ち物がなかったよ');
  };
}
function reviewBeforeDeparture(){
  if(isTodayCheckLocked()||isCheckCompletedToday())return completeCheck();
  const unchecked=state.items.filter(x=>!x.checked);
  if(unchecked.length)return toast(`未確認が${unchecked.length}個あるよ。実物を見てチェックしてね`);
  if(!state.items.length)return toast('持ち物を登録してね');
  const related=state.items.map(x=>({...x,important:isEssential(x.name),count:forgetCount(x)}));
  related.sort((a,b)=>Number(b.important)-Number(a.important)||b.count-a.count);
  const picks=related.filter(x=>x.important||x.count>0).slice(0,5);
  if(!picks.length)picks.push(...related.slice(0,Math.min(3,related.length)));
  const html=`<p class="fg-modal-lead">最後の30秒チェック！ チェックマークだけでなく、<b>カバンやポケットの中に実物があるか</b>を見てから完了してね。</p><div class="fg-select-list">${picks.map((x,i)=>`<label class="fg-select"><input type="checkbox" data-fg-final="${i}"><span>${escapeHTML(x.emoji||'🎒')} <strong>${escapeHTML(x.name)}</strong><small>${x.important?'⭐ 重要品':x.count?'🌼 忘れたことがある物':'出発前の最終確認'}</small></span></label>`).join('')}</div><p class="fg-verify">✅ すべての実物を確認すると、完了ボタンを押せるようになるよ。</p><div class="fg-modal-actions"><button id="fgFinalConfirm" type="button" class="fg-main" disabled>出発準備を完了する</button><button id="fgFinalBack" type="button">リストに戻る</button></div>`;
  showModal('🛡️ 出発前の最終確認',html,{icon:'👜'});
  const confirmBtn=document.getElementById('fgFinalConfirm');
  document.querySelectorAll('[data-fg-final]').forEach(b=>b.onchange=()=>{confirmBtn.disabled=![...document.querySelectorAll('[data-fg-final]')].every(x=>x.checked)});
  document.getElementById('fgFinalBack').onclick=closeModal;
  confirmBtn.onclick=()=>{if(confirmBtn.disabled||!state.items.every(x=>x.checked))return;completeCheck()};
}
function reviewBeforeTomorrow(){
  if(state.nightBonus&&state.nightBonusDate===tomorrowDate())return saveTomorrow();
  if(!state.tomorrowItems.every(x=>x.checked))return saveTomorrow();
  const missing=availableSuggestions('tomorrow');
  if(!missing.length)return saveTomorrow();
  const html=`<p class="fg-modal-lead">明日のリストに、大切な物・以前忘れた物の候補が${missing.length}個入っていないよ。<b>本当に必要かだけ確認しよう。</b></p><div class="fg-pills">${missing.slice(0,8).map(name=>`<span class="fg-pill missing">＋ ${escapeHTML(name)}</span>`).join('')}</div><div class="fg-modal-actions"><button class="fg-main" type="button" id="fgTomorrowSuggest">候補を確認する</button><button type="button" id="fgTomorrowSkip">今回は不要・準備を完了</button></div>`;
  showModal('🌙 明日の準備をもう一度',html,{icon:'🌙'});
  document.getElementById('fgTomorrowSuggest').onclick=()=>showMissingSuggestions('tomorrow');
  document.getElementById('fgTomorrowSkip').onclick=()=>saveTomorrow();
}
function recordOtherForgotten(){
  const raw=prompt('実際に忘れてしまった持ち物の名前を入力してね（35文字まで）');if(raw===null)return;
  const name=raw.trim().slice(0,35);if(!name)return toast('持ち物の名前を入力してね');
  if((state.forgetEvents||[]).some(x=>x.date===TODAY()&&forgetKey(x.name)===forgetKey(name)))return toast('今日はすでに記録済みだよ');
  if(!confirm(`「${name}」を今日実際に忘れた物として記録する？\nチェックリストにまだなくても記録できるよ。`))return;
  state.forgetEvents=Array.isArray(state.forgetEvents)?state.forgetEvents:[];
  state.forgetEvents.push({id:`forgot-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,date:TODAY(),name});
  state.forgetEvents=state.forgetEvents.slice(-365);saveState();renderAll();showForgetReport();toast(`「${name}」を記録したよ。次回の候補に出るよ`);
}
window.addEventListener('DOMContentLoaded',()=>{
  for(const target of ['Today','Tomorrow']){
    document.getElementById('fgManage'+target)?.addEventListener('click',showEssentialManager);
    document.getElementById('fgSuggest'+target)?.addEventListener('click',()=>showMissingSuggestions(target.toLowerCase()==='today'?'today':'tomorrow'));
  }
});

/* V31.2 — Read-only gallery. Does not alter state.rank or game progress. */
function openEvolutionPreview(level=5){
  const selected=Math.max(1,Math.min(5,Number(level)||5));
  const info={
    1:{label:'空っぽポッケ',desc:'はじめましての、いつもの相棒。ここから少しずつ成長していくよ。'},
    2:{label:'お守りポッケ',desc:'小さな若葉とお守り。すこしだけ成長した姿。'},
    3:{label:'幸運のポッケ',desc:'ポケットのまわりでクローバーがゆらゆら。幸運を応援する姿。'},
    4:{label:'黄金のポッケ',desc:'金色の王冠と太陽の光で、ひとつ上の輝きに。'},
    5:{label:'四次元ポッケ',desc:'伝説の星空ティアラと四次元の紋章。光るポケットが世界を照らす、最高ランクの相棒！'}
  }[selected];
  const cards=['kun','chan'].map(key=>`<article class="evo-preview-card" data-level="${selected}"><strong>${key==='kun'?'ぽけっとくん':'ぽけっとちゃん'}</strong><small>Lv.${selected} ${info.label}</small><span class="evo-preview-figure">${mascotArt(key,selected,'happy')}</span></article>`).join('');
  const captions=['🌱','🛡️','🍀','👑','🌌'];
  const body=`<p class="evo-preview-intro">${info.desc}<br>※見た目だけのプレビューです。育成レベル・ポイントは変わりません。</p><div class="evo-preview-tabs" role="group" aria-label="プレビューするレベル">${[1,2,3,4,5].map(n=>`<button id="evoPreview${n}" type="button" aria-pressed="${selected===n}">${captions[n-1]} Lv.${n}</button>`).join('')}</div><div class="evo-preview-gallery">${cards}</div>`;
  showModal('✨ 相棒の進化をプレビュー',body,{icon:'✨'});
  for(const n of [1,2,3,4,5])document.getElementById(`evoPreview${n}`)?.addEventListener('click',()=>openEvolutionPreview(n));
}

window.addEventListener('DOMContentLoaded',()=>document.getElementById('evolutionPreviewLaunch')?.addEventListener('click',()=>openEvolutionPreview(5)));


/* V31.8: weather assistance; never treats forecast as confirmation of actual belongings. */
const WEATHER_SETTINGS_DEFAULT={enabled:true,autoRain:true,autoHeat:false,autoCold:false,place:null,cache:null,suppressed:{}};
function weatherFinite(v){return v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null)}
function sanitizeWeatherAssist(raw){
  const x=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const p=x.place&&typeof x.place==='object'?x.place:null;
  const latitude=Number(p?.lat),longitude=Number(p?.lon);
  const place=p&&Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180?{
    lat:Math.round(latitude*10)/10,lon:Math.round(longitude*10)/10,name:String(p.name||'設定した地域').slice(0,75)
  }:null;
  let cache=null;
  const c=x.cache;
  if(c&&typeof c==='object'&&Array.isArray(c.days)&&c.days.length<=8&&Number.isFinite(Number(c.fetchedAt))&&
     c.days.every(d=>d&&/^\d{4}-\d{2}-\d{2}$/.test(d.date))){
    cache={fetchedAt:Number(c.fetchedAt),days:c.days.map(d=>({date:d.date,code:weatherFinite(d.code),pop:weatherFinite(d.pop),rain:weatherFinite(d.rain),max:weatherFinite(d.max),min:weatherFinite(d.min)}))};
  }
  const suppressed={};
  if(x.suppressed&&typeof x.suppressed==='object')for(const [k,v] of Object.entries(x.suppressed).slice(-35)){
    if(/^(today|tomorrow)\|\d{4}-\d{2}-\d{2}\|(umbrella|bottle|jacket)$/.test(k)&&v===true)suppressed[k]=true;
  }
  return {enabled:x.enabled!==false,autoRain:x.autoRain!==false,autoHeat:!!x.autoHeat,autoCold:!!x.autoCold,place,cache,suppressed};
}
const WEATHER_FEATURES=[
 {id:'umbrella',name:'傘',emoji:'☂️',prop:'autoRain',description:'雨・雪または降水確率40％以上 / 降水量0.5mm以上'},
 {id:'bottle',name:'水筒',emoji:'🧴',prop:'autoHeat',description:'最高気温30℃以上'},
 {id:'jacket',name:'上着',emoji:'🧥',prop:'autoCold',description:'最高気温12℃以下'}
];
function weatherDefault(){if(!state.weatherAssist)state.weatherAssist=sanitizeWeatherAssist(null);return state.weatherAssist}
function weatherTargetDate(target){return target==='tomorrow'?tomorrowDate():TODAY()}
function weatherDay(target){
 const w=weatherDefault(),cache=w.cache;
 if(!w.enabled||!w.place||!cache||!Number.isFinite(cache.fetchedAt)||Date.now()-cache.fetchedAt>86400000||cache.fetchedAt>Date.now()+3600000)return null;
 return cache.days.find(d=>d.date===weatherTargetDate(target))||null;
}
function weatherRecommend(day){
 if(!day)return [];
 const code=weatherFinite(day.code),pop=weatherFinite(day.pop),rain=weatherFinite(day.rain),max=weatherFinite(day.max);
 const rainy=(Number.isFinite(pop)&&pop>=40)||(Number.isFinite(rain)&&rain>=.5)||([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(code));
 const result=[];
 if(rainy)result.push(WEATHER_FEATURES[0]);
 if(Number.isFinite(max)&&max>=30)result.push(WEATHER_FEATURES[1]);
 if(Number.isFinite(max)&&max<=12)result.push(WEATHER_FEATURES[2]);
 return result;
}
function weatherItemExists(list,entry){
 return list.some(x=>{
  const k=forgetKey(x.name);return k===forgetKey(entry.name)||(entry.id==='umbrella'&&/^(折りたたみ傘|雨傘|かさ|カサ|傘)$/.test(k))||(entry.id==='bottle'&&/^(飲み物|ペットボトル|マイボトル)$/.test(k))||(entry.id==='jacket'&&/^(防寒着|ジャンパー|コート|羽織るもの)$/.test(k));
 });
}
function weatherAutoSyncLists(){
 const w=weatherDefault();if(!w.enabled||!w.place)return 0;
 let total=0,changed=false;
 for(const target of ['today','tomorrow']){
  if(!itemSetCanModify(target))continue;
  const day=weatherDay(target);if(!day)continue;
  const list=itemSetTargetList(target),date=weatherTargetDate(target);
  for(const feat of weatherRecommend(day)){
   if(!w[feat.prop]||list.length>=50||weatherItemExists(list,feat)||w.suppressed[`${target}|${date}|${feat.id}`])continue;
   list.push({id:`weather-${target}-${date}-${feat.id}`,name:feat.name,emoji:feat.emoji,hint:'',checked:false});
   total++;changed=true;
  }
 }
 if(changed)saveState();
 return total;
}
function weatherSuppressForDeletion(item,target){
 if(!item)return;
 const w=weatherDefault();const date=weatherTargetDate(target);
 for(const feat of WEATHER_FEATURES){
  if(weatherItemExists([{name:item.name}],feat))w.suppressed[`${target}|${date}|${feat.id}`]=true;
 }
 const active=[TODAY(),tomorrowDate()];
 for(const key of Object.keys(w.suppressed))if(!active.some(d=>key.includes(`|${d}|`)))delete w.suppressed[key];
}
function weatherDescription(day){
 const c=weatherFinite(day.code);
 if([95,96,99].includes(c))return ['⛈️','雷雨に注意'];
 if([71,73,75,77,85,86].includes(c))return ['🌨️','雪の予報'];
 if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(c))return ['🌧️','雨の予報'];
 if(c===0)return ['☀️','晴れ'];
 if([1,2].includes(c))return ['🌤️','晴れ時々くもり'];
 if([3,45,48].includes(c))return ['☁️','くもり'];
 return ['🌦️','天気を確認'];
}
function weatherPanel(target){
 const w=weatherDefault(),day=weatherDay(target),title=target==='today'?'今日':'明日',name=escapeHTML(w.place?.name||'未設定');
 const head=`<div class="weather-assist-header"><div><strong>🌦️ ${title}の天気 × 持ち物</strong><small>${name} · 天気に応じて自動追加</small></div><button class="weather-assist-button" type="button" data-wa-setup>地域・設定</button></div>`;
 if(!w.place)return head+`<p class="weather-assist-note">地域を設定すると、雨予報の日に「傘」をチェックリストへ自動追加するよ。現在地または地名から設定できるよ。</p>`;
 if(!w.enabled)return head+'<p class="weather-assist-note">天気連動はOFFだよ。設定からONにできるよ。</p>';
 if(!day){return head+`<p class="weather-assist-note ${weatherLastError?'weather-assist-error':''}">${escapeHTML(weatherLastError||'最新の天気予報を取得中、または有効な予報がありません。インターネット接続を確認して更新してね。')}</p><div class="weather-assist-footer"><small>天気予報が不明なときは自動追加しないよ</small><button class="weather-assist-refresh" data-wa-refresh>予報を更新</button></div>`}
 const [icon,desc]=weatherDescription(day),items=weatherRecommend(day),list=itemSetTargetList(target);
 const suggestions=items.map(f=>{
  const present=weatherItemExists(list,f),active=w[f.prop],suppressed=w.suppressed[`${target}|${weatherTargetDate(target)}|${f.id}`];
  return `<span>${f.emoji} ${escapeHTML(f.name)}：${present?'リストにあり':suppressed?'自動追加しない（手動で削除）':!active?'提案のみ':!itemSetCanModify(target)?'チェック終了後・追加不可':'自動追加対象'}</span>`;
 }).join('');
 const high=day.max!=null&&Number.isFinite(day.max)?`${Math.round(day.max)}℃`:'—',prob=day.pop!=null&&Number.isFinite(day.pop)?`${Math.round(day.pop)}%`:'不明',stamp=new Date(w.cache.fetchedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
 return head+`<div class="weather-assist-main"><span class="weather-assist-icon" aria-hidden="true">${icon}</span><div><b>${escapeHTML(desc)} ・ 最高 ${high}</b><small>降水確率（1日の最大）${prob} / 降水量 ${day.rain!=null&&Number.isFinite(day.rain)?day.rain.toFixed(1)+'mm':'不明'}</small></div></div><p class="weather-assist-note">${items.length?`おすすめの持ち物が${items.length}個あるよ。登録済みか確認してね。`:'天気から追加が必要な持ち物は見つからなかったよ。'}</p>${suggestions?`<div class="weather-assist-reasons">${suggestions}</div>`:''}<div class="weather-assist-footer"><small>予報更新 ${escapeHTML(stamp)} · 提供 Open-Meteo</small><button class="weather-assist-refresh" data-wa-refresh>↻ 最新の天気</button></div>`;
}
let weatherLastError='',weatherFetchPromise=null;
function renderWeatherPanels(){document.querySelectorAll('[data-weather-panel]').forEach(el=>{el.innerHTML=weatherPanel(el.dataset.weatherPanel)});renderPackingSummary()}
async function weatherJSON(url){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
 try{const res=await fetch(url,{signal:ctrl.signal,mode:'cors'});if(!res.ok)throw new Error(`通信エラー (${res.status})`);return await res.json();}
 finally{clearTimeout(timeout)}
}
async function weatherRefresh(force=false){
 const w=weatherDefault();if(!w.place||!w.enabled)return;
 // A location change must not inherit a pending response for a different location.
 if(weatherFetchPromise){return force?weatherFetchPromise.then(()=>weatherRefresh(true)):weatherFetchPromise;}
 if(!force&&w.cache&&Date.now()-w.cache.fetchedAt<3*3600*1000&&w.cache.days?.some(d=>d.date===TODAY()))return;
 const lat=w.place.lat,lon=w.place.lon;
 weatherLastError='';renderWeatherPanels();
 weatherFetchPromise=(async()=>{
  try{
   const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&daily=weather_code,precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
   const data=await weatherJSON(url),d=data.daily;
   if(!d||!Array.isArray(d.time)||d.time.length<2)throw new Error('予報データを取得できませんでした');
   // Ignore a superseded location selection.
   if(!state.weatherAssist?.place||state.weatherAssist.place.lat!==lat||state.weatherAssist.place.lon!==lon)return;
   const days=d.time.slice(0,3).map((date,i)=>({
    date:String(date),code:weatherFinite(d.weather_code?.[i]),pop:weatherFinite(d.precipitation_probability_max?.[i]),
    rain:weatherFinite(d.precipitation_sum?.[i]),max:weatherFinite(d.temperature_2m_max?.[i]),min:weatherFinite(d.temperature_2m_min?.[i])
   }));
   w.cache={fetchedAt:Date.now(),days};saveState();
   const count=weatherAutoSyncLists();renderAll();renderWeatherPanels();
   if(count)toast(`🌦️ 天気予報に合わせて持ち物を${count}個追加したよ`);
  }catch(e){weatherLastError=`天気を取得できなかったよ（${e.name==='AbortError'?'時間切れ':e.message||'通信エラー'}）。`;renderWeatherPanels()}
 })().finally(()=>weatherFetchPromise=null);
 return weatherFetchPromise;
}
function weatherRefreshIfNeeded(){if(!document.hidden&&state?.weatherAssist?.place)weatherRefresh(false)}
function weatherSetPlace(name,lat,lon){
 const w=weatherDefault();w.place={name:String(name).slice(0,75),lat:Math.round(Number(lat)*10)/10,lon:Math.round(Number(lon)*10)/10};
 w.enabled=true;w.cache=null;weatherLastError='';saveState();renderAll();closeModal();toast('地域を設定したよ。予報を確認するね');void weatherRefresh(true);
}
function openWeatherSettings(){
 const w=weatherDefault();
 const html=`<div class="weather-assist-modal"><p class="wa-description">設定した地域の天気予報を見て、今日と明日の持ち物に追加します。位置情報を使う場合は許可が必要です。正確な位置ではなく、おおよその地域（約0.1度単位）で保存します。</p><label for="waCity">市区町村を検索</label><input id="waCity" type="text" maxlength="55" placeholder="例：大阪市、札幌市、Tokyo"><div class="wa-row"><button class="wa-action" id="waSearchCity">🔎 地域を検索</button><button class="wa-action secondary" id="waUseGPS">📍 現在地を使う</button></div><div class="wa-results" id="waResults" aria-live="polite"></div><p class="wa-description">現在の地域：${escapeHTML(w.place?.name||'未設定')}</p><label class="wa-toggle"><input type="checkbox" id="waEnabled" ${w.enabled?'checked':''}>天気に合わせた持ち物の自動追加を使う</label><label class="wa-toggle"><input type="checkbox" id="waRain" ${w.autoRain?'checked':''}>☂️ 雨・雪の予報なら「傘」を自動追加</label><label class="wa-toggle"><input type="checkbox" id="waHeat" ${w.autoHeat?'checked':''}>🧴 30℃以上なら「水筒」を自動追加</label><label class="wa-toggle"><input type="checkbox" id="waCold" ${w.autoCold?'checked':''}>🧥 12℃以下なら「上着」を自動追加</label><p class="wa-description">雨判定：1日の最大降水確率40％以上、降水量0.5mm以上、または雨・雪の天気コード。予報には誤差があります。自動追加した持ち物は、手動で削除しても同じ日には勝手に再追加しません。すでに登録済みの物も重複しません。</p><div class="wa-row"><button class="wa-action" id="waSave">設定を保存して反映</button><button class="wa-action secondary" id="waClose">閉じる</button></div></div>`;
 showModal('🌦️ 天気と持ち物の連動',html,{icon:'🌦️'});
 const result=document.getElementById('waResults');
 document.getElementById('waClose').onclick=closeModal;
 document.getElementById('waSave').onclick=()=>{
  Object.assign(w,{enabled:document.getElementById('waEnabled').checked,autoRain:document.getElementById('waRain').checked,autoHeat:document.getElementById('waHeat').checked,autoCold:document.getElementById('waCold').checked});
  saveState();closeModal();renderAll();void weatherRefresh(false);toast('天気連動の設定を保存したよ');
 };
 const search=async()=>{
  const term=document.getElementById('waCity').value.trim();if(term.length<2){result.textContent='地名を2文字以上入力してね';return;}
  const button=document.getElementById('waSearchCity');button.disabled=true;result.textContent='地域を探しているよ…';
  try{
   const data=await weatherJSON('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(term)+'&count=8&language=ja&format=json');
   const candidates=(data.results||[]).filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));
   result.replaceChildren();
   if(!candidates.length){result.textContent='地域が見つからなかったよ。別の地名で検索してね';return;}
   candidates.forEach(place=>{
    const btn=document.createElement('button');btn.type='button';
    const name=[place.name,place.admin1,place.country].filter(Boolean).join('・');btn.textContent=`📍 ${name}`;
    btn.onclick=()=>weatherSetPlace(name,place.latitude,place.longitude);result.appendChild(btn);
   });
  }catch(e){result.textContent='検索できなかったよ。通信を確認してね'}finally{if(button.isConnected)button.disabled=false}
 };
 document.getElementById('waSearchCity').onclick=search;
 document.getElementById('waCity').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();void search()}};
 document.getElementById('waUseGPS').onclick=()=>{
  if(!navigator.geolocation){result.textContent='この端末は位置情報に対応していないよ';return;}
  result.textContent='位置情報の許可を確認中…';
  navigator.geolocation.getCurrentPosition(p=>weatherSetPlace('現在地付近',p.coords.latitude,p.coords.longitude),()=>{result.textContent='位置情報を取得できなかったよ。地名検索も使えるよ';},{timeout:12000,maximumAge:300000,enableHighAccuracy:false});
 };
}
window.addEventListener('DOMContentLoaded',()=>{
 document.addEventListener('click',e=>{
  const setup=e.target.closest('[data-wa-setup]'),refresh=e.target.closest('[data-wa-refresh]');
  if(setup){openWeatherSettings();return}
  if(refresh)void weatherRefresh(true);
 });
 renderWeatherPanels();
 setTimeout(()=>weatherRefreshIfNeeded(),650);
});


window.addEventListener('storage',e=>{if((e.key===STORAGE_KEY&&e.newValue!==lastSavedRaw)||e.key===SCHEDULE_STORAGE_KEY){externalDataChange=true;startupDataAlert='ほかのタブで保存内容や時間割が変わりました。最新の内容を読み込み直してください。';renderDataSafetyNotice()}});
// A notification tapped while the PWA is open returns to the packing checklist.
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.kind==='sumapokke-notification-click'){document.getElementById('splash')?.classList.add('hidden');go('check')}});