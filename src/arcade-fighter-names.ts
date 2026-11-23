// Legacy name keys stay stable: fighter IDs seed outcomes and attach saved Heroes.
export const fighterNameKeysGiven=(['Alden','Anwen','Arlen','Bea','Briallen','Cadan','Carys','Celyn','Dara','Deryn','Eira','Emlin','Fenn','Gwen','Hale','Hollis','Ione','Ivor','Jory','Kell','Linnet','Mara','Mael','Merrin','Nerys','Niall','Oriel','Osric','Perrin','Quill','Renn','Rhian','Rook','Rowan','Sable','Sorrel','Tamsin','Taren','Vesper','Wren']);
export const fighterNameKeysFamily=(['Ashbell','Blackfen','Bramble','Briarvale','Cinderholt','Claymere','Coldwater','Crowford','Duskmere','Evenwood','Flintward','Frostbank','Graywick','Harthill','Highmere','Lowbridge','Mirewood','Moonford','Netherby','Oakward','Reedfall','Rimefield','Siltbrook','Stonecut','Thornwick','Valehart','Whitebrook','Windsill','Winterby','Yewcroft']);

// Fictional combinations of sound and spelling cues. These are not intended as
// authentic names in any one language or claims about a character's nationality.
const previousGiven=['Aeraqiu','Seonmori','Naraoqi','Meiyaru','Tseokai','Qiaorun','Jinhagu','Rinbatu',
  'Xiaotsune','Khaerun','Yuehori','Soryeon','Hsiomaru','Taemuren','Chiorun','Yunshikai',
  'Naerishi','Eonjirai','Kharayue','Huazori','Jaeqorin','Ryuhaeng','Noyaseo','Xuesaru',
  'Tairenyu','Tsairan','Haemong','Senqiu','Arutsai','Dahyeorin','Tsenari','Qiyomun',
  'Seorakai','Yuchiren','Temyori','Lhanqiao','Jinsaruu','Hoshireon','Xiaenaru','Yuehsori'];
const previousFamily=['Tserokhan','Hsiomori','Khaetsune','Yeonqun','Saranqiu','Tsaiyuren',
  'Qoriseon','Tengyori','Hoshinur','Xiaokhuren','Seokhatu','Uulzhen','Khairin',
  'Chensaruu','Hyeotani','Noyoqin','Rinkhaya','Yuebayan','Yureosek','Zhentori',
  'Chihmuren','Tsaiseon','Yanjihara','Munkhaeri','Hwasetsu','Qiaokhori','Narantse',
  'Khaoryeon','Soyenchih','Uulnari'];

// Open syllables, compact closed syllables, and longer compounds coexist.
// Boundaries are authored, not inferred from spelling or from Japanese morae.
const givenOne='Aer Seon Nar Mei Tseo Qia Jin Rin Xiao Khae Yueh Sorn Hsi Taem Chio Yun Nae Eon Khar Hua Jae Ryu Noy Xue Tai Tsai Haem Sen Ar Dah Tsen Qiy Seor Yuch Tem Lhan Jins Hosh Xiaen Yuehl'.split(' ');
const familyOne='Khan Hsiu Tsun Qun Qiu Yuen Seok Teng Nur Khur Hat Zhen Khai Chyeng Hyeok Qin Ryeon Ban Raek Zhent Chih Tsaen Yen Munkh Hwa Qiao Nas Yeon Shen Uul'.split(' ');
const givenTwo='Ae-ra Seon-mo Na-ra Mei-ya Tseo-kai Qiao-run Jin-ha Rin-ba Xiao-tsu Khae-run Yueh-ho So-ryeon Hsio-ma Tae-mu Chi-o Yun-shi Nae-ri Eon-ji Kha-ra Hua-zo Jae-qo Ryu-haeng No-ya Xue-sa Tai-ren Tsai-ran Hae-mong Sen-qiu A-ru Da-hyeo Tse-na Qi-yo Seo-ra Yu-chi Te-myo Lhan-qiao Jin-sa Ho-shi Xiao-ne Yueh-so'.split(' ');
const familyTwo='Tse-ro Hsio-mo Khae-tsu Yeon-qun Sa-ran Tsai-yu Qo-ri Teng-yo Ho-shin Xiao-khur Seo-kha Uul-zhen Khai-rin Chen-sa Hyeo-ta No-yo Rin-kha Yue-ba Yu-reo Zhen-to Chih-mu Tsai-seon Yan-ji Mun-khae Hwa-se Qiao-kho Na-ran Khao-ryeon So-yen Uul-na'.split(' ');
const tails=['na','ri','kho','mi','shi','yo','ru','yen'];
const endings=['jin','tsu','kai','ren','tse','min','nar','run'];
const layouts=[
  [9,1,1],[30,2,1],[45,1,2],[62,2,2],[71,3,1],
  [83,2,3],[91,3,2],[97,3,3],[100,3,4]
];
function chunk(i:number,n:number,one:string[],two:string[]){
  if(n===1)return [one[i]];
  const units=two[i].split('-');
  if(n>=3)units.push(tails[i%tails.length]);
  if(n===4){
    // Keep the fourth unit a single spoken beat.
    units.push(endings[i%endings.length]);
  }
  return units;
}
export function fighterNameParts(i:number,j:number){
  if(!Number.isInteger(i)||!Number.isInteger(j)||i<0||j<0||i>=givenOne.length||j>=familyOne.length)return [];
  const code=((i*familyOne.length+j)*397)%1200;
  const roll=100*code/1200;
  const [,a,b]=layouts.find(([end])=>roll<end)!;
  return [chunk(i,a,givenOne,givenTwo),chunk(j,b,familyOne,familyTwo)];
}
const namedId=(g:string,f:string)=>'f-'+g.toLowerCase()+'-'+f.toLowerCase();
const displayed=(i:number,j:number)=>fighterNameParts(i,j).map(parts=>parts.join('')).join(' ');
export function fighterDisplayName(id:unknown,name:string):string;
export function fighterDisplayName<T>(id:unknown,name:T):T|string;
export function fighterDisplayName(id:unknown,name:unknown){
  if(typeof id!=='string'||typeof name!=='string')return name;
  const [g,f,serial,extra]=name.split(' ');
  if(extra!==undefined)return name;
  const [,keyGiven,keyFamily,...rest]=id.split('-');
  if(serial===undefined&&rest.length===0){
    const i=fighterNameKeysGiven.findIndex(key=>key.toLowerCase()===keyGiven);
    const j=fighterNameKeysFamily.findIndex(key=>key.toLowerCase()===keyFamily);
    if(i>=0&&j>=0&&id===namedId(fighterNameKeysGiven[i],fighterNameKeysFamily[j])&&
       (g===fighterNameKeysGiven[i]&&f===fighterNameKeysFamily[j]||g===previousGiven[i]&&f===previousFamily[j]))return displayed(i,j);
  }
  // A serial is an identity disambiguator, separate from the spoken name.
  if(serial&&/^[0-9A-Z]+-[0-9A-Z]+$/.test(serial)&&id==='f-'+serial.toLowerCase()){
    const i=fighterNameKeysGiven.includes(g)?fighterNameKeysGiven.indexOf(g):previousGiven.indexOf(g);
    const j=fighterNameKeysFamily.includes(f)?fighterNameKeysFamily.indexOf(f):previousFamily.indexOf(f);
    if(i>=0&&j>=0)return displayed(i,j)+' '+serial;
  }
  return name;
}

// Separate namespace for newly recruited fighters. Each row has an authored
// short stem and endings that keep its compounds at two to four beats.
// The legacy lookup above deliberately does not depend on this catalog.
const recruitFamilyRows=[
  ['Aoqi','na ru se min'],
  ['Bataen','qiu yeon ri ho'],
  ['Chihara','kho yen mi tse'],
  ['Daeryu','sen chi na ran'],
  ['Eunkha','tsu rin hao yo'],
  ['Ganshi','qiao nar yu rei'],
  ['Haeqor','a jin yuan se'],
  ['Hoshun','ta qiu ra khen'],
  ['Jinsei','kho yun nai chen'],
  ['Khaolun','mi qin chi ren'],
  ['Kiyun','nar ra tse ho'],
  ['Lhaozhen','ri sai ba mei'],
  ['Meikhor','yo rin tse seon'],
  ['Moryeon','kha si tsu lu'],
  ['Naekun','ho mei ri ta'],
  ['Noyqia','ro run ye shin'],
  ['Oryun','shi ta qi khen'],
  ['Qiaomun','ri ra sen nyo'],
  ['Rensai','khu ha yo qin'],
  ['Saehun','na zo misu qiu'],
  ['Shinkho','ra yin ho mei'],
  ['Taekhur','ya yen jeon kai'],
  ['Tenghyeo','ri shin bai no'],
  ['Tseonai','ra yun kha sui'],
  ['Uuryeon','shi yen mi qin'],
  ['Xunhara','yi se kha ru'],
  ['Yeonbai','ha rin tsu nuo'],
  ['Yuehsa','mi kha sai shun'],
  ['Zhaomori','rin yo qiu tsu'],
  ['Zhenryu','kha mei tsai nyo'],
  ['Qunrai','na khe yun sho'],
  ['Khaezan','ru chi mei nar'],
  ['Arasui','ri no khan mi'],
  ['Chaeqen','ta sui yeo ko'],
  ['Daeqiao','ta ryo sai no'],
  ['Eonkhai','ri zhu ta min'],
  ['Gabatu','shi mei jin kai'],
  ['Hanyao','no ri khei so'],
  ['Hwayun','ran yu shin ka'],
  ['Iryunkh','qi hao se yun'],
  ['Jaeshun','te ho ryo zin'],
  ['Kairyeo','shi ru tsu qin'],
  ['Khornai','run ho rai se'],
  ['Linyueh','ma kho sho tsai'],
  ['Munkyo','han rin sai yo'],
  ['Narsuen','na ren huo qin'],
  ['Neiqhor','ri tu sha mi'],
  ['Orjinu','kho sei ta ru'],
  ['Qiryon','mei kha shin su'],
  ['Ruiteng','qiu nari jyu rin'],
  ['Seorqin','kho yun ryo yu'],
  ['Shuuran','to zhen rei cho'],
  ['Tsumyen','no shi ho ren'],
  ['Ulsai','ma khur ryo na'],
  ['Yenharu','sa zhu ho kai'],
  ['Zhiqor','tsu ri chi se'],
].map(([stem,suffixes])=>[stem,...(suffixes+' kan myo zan').split(' ').map(suffix=>stem+suffix)]);
export const recruitFighterFamilies=Object.freeze(recruitFamilyRows.flat());

export function fighterFamilyName(name:unknown){
  return typeof name==='string'?(name.trim().split(/\s+/)[1]??''):'';
}

export function recruitFighterName({givenIndex=0,familySeed=0,avoidFamilies=[]}: {givenIndex?:number;familySeed?:number;avoidFamilies?:Iterable<unknown>|ArrayLike<unknown>}={}){
  const wrap=(value:number,length:number)=>Number.isSafeInteger(value)?(value%length+length)%length:0;
  const i=wrap(givenIndex,givenOne.length);
  const family=chooseRecruitFamily(familySeed,avoidFamilies);
  const start=wrap(familySeed,recruitFighterFamilies.length);
  const roll=100*((i*397+start*293)%1200)/1200;
  const [,givenLength]=layouts.find(([end])=>roll<end)!;
  const given=chunk(i,givenLength,givenOne,givenTwo).join('');
  return {name:given+' '+family,family};
}

export function chooseRecruitFamily(familySeed=0,avoidFamilies:Iterable<unknown>|ArrayLike<unknown>=[]){
  const length=recruitFighterFamilies.length;
  const wrap=(value:number,size:number)=>Number.isSafeInteger(value)?(value%size+size)%size:0;
  const start=wrap(familySeed,length);
  const avoid=new Set(Array.from(avoidFamilies??[],value=>String(value).trim().toLowerCase()));
  let family=recruitFighterFamilies[start];
  for(let offset=0;offset<length;offset++){
    const candidate=recruitFighterFamilies[(start+offset)%length];
    if(!avoid.has(candidate.toLowerCase())){family=candidate;break;}
  }
  return family;
}
