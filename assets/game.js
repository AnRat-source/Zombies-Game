
(()=>{'use strict';
// Everything is original and self-contained: terrain, characters, particles, game rules and UI.
const $=id=>document.getElementById(id), canvas=$('gameCanvas'), ctx=canvas.getContext('2d'), mini=$('minimap'), mc=mini.getContext('2d');
const TAU=Math.PI*2, BASE_X=[95,322,536,759,978,1205,1426,1658,1886,2119,2323],BASE_Y=[91,295,508,721,943,1165,1382,1526];
// Rendering adapts to the device, while the simulation remains deterministic at
// the same difficulty. Older phones spend fewer GPU/Canvas cycles on detail.
const deviceProfile=(()=>{const memory=Number(navigator.deviceMemory)||4,cores=Number(navigator.hardwareConcurrency)||4,
 touch=matchMedia?.('(pointer: coarse)').matches||navigator.maxTouchPoints>0,
 constrained=memory<=2||cores<=2;
 return{touch,constrained,visualScale:constrained ? .55 : touch ? .78 : 1,antialias:!constrained&&!touch,
  frameGap:constrained?33:touch?16:0,heatBase:constrained?640:touch?768:1280};})();
const MAPS={
 classic:{name:'Cityfall Classic',desc:'Original expanding city and river districts.',x:BASE_X,y:BASE_Y,seed:2109,dx:222,dy:220,park:.115},
 nyc:{name:'New York City · 1:1 Campaign',desc:'Approximately meter-scale NYC geography · Manhattan streets ~80m apart and avenues ~230m apart.',x:[],y:[],seed:71119,dx:132,dy:132,park:.075},
 nyc_megascale:{name:'New York / Previous Megascale',desc:'Original 22,080-unit world kept unchanged for older saved operations.',x:[],y:[],seed:71119,dx:132,dy:132,park:.075},
 nyc_expanded:{name:'New York / Expanded 1.6×',desc:'Previous enlarged five-borough map, retained for existing save files.',x:[],y:[],seed:71119,dx:132,dy:132,park:.075},
 nyc_standard:{name:'New York / Original Five Boroughs',desc:'Earlier five-borough scale, kept for existing saved cities.',x:[],y:[],seed:71119,dx:132,dy:132,park:.075},
 nyc_legacy:{name:'New York / Original',desc:'Previous compact Manhattan-inspired city. Preserved for older saved games.',x:[95,307,534,790,1037,1281,1525,1780,2034,2260,2502],y:[91,220,349,478,607,736,865,994,1123,1252,1381,1526],seed:71119,dx:246,dy:136,park:.07},
 inland:{name:'Inland Metro',desc:'Dense inland city, shorter blocks, plazas and taller buildings.',x:[95,267,459,658,846,1032,1220,1410,1610,1818,2038,2323],y:[91,265,437,617,791,971,1147,1325,1526],seed:62931,dx:205,dy:176,park:.17},
 harbour:{name:'Harbor District',desc:'Industrial waterfront, broad blocks and multiple island districts.',x:[95,340,620,900,1180,1460,1750,2040,2323],y:[91,305,560,805,1055,1295,1526],seed:85319,dx:280,dy:245,park:.075}
};
// New York DCP borough-boundary geographic extent (release 26C).
// The compact polygons below are intentionally simplified geographic approximations,
// not official parcel-level shorelines or street/building datasets.
const NYC_BOUNDS={west:-74.257159,east:-73.699215,north:40.915568,south:40.496010};
const NYC_DIM=6900, NYC_PAD=170, NYC_EXPANSION=3.2, NYC_REAL_SCALE=7.1, NYC_MIN_ZOOM=.00008;
const nycScale=()=>activeMap==='nyc'?NYC_REAL_SCALE:activeMap==='nyc_megascale'?NYC_EXPANSION:activeMap==='nyc_expanded'?1.6:1;
const isNYC=()=>['nyc','nyc_megascale','nyc_expanded','nyc_standard'].includes(activeMap);
// Geography is scaled uniformly, so the saved 1.6x city is never silently moved.
function nycBaseProject(lon,lat){return{x:NYC_PAD+(lon-NYC_BOUNDS.west)/(NYC_BOUNDS.east-NYC_BOUNDS.west)*(NYC_DIM-NYC_PAD*2),
 y:NYC_PAD+(NYC_BOUNDS.north-lat)/(NYC_BOUNDS.north-NYC_BOUNDS.south)*(NYC_DIM-NYC_PAD*2)}}
function nycProject(lon,lat){const p=nycBaseProject(lon,lat),scale=nycScale();return{x:p.x*scale,y:p.y*scale}}
// Clockwise coastlines, lightly simplified for the self-contained/offline simulation.
const NYC_SHORES={
 Manhattan:[[-74.019,40.700],[-74.018,40.707],[-74.009,40.713],[-74.006,40.724],[-74.000,40.744],[-73.992,40.767],[-73.981,40.786],[-73.968,40.812],[-73.952,40.837],[-73.934,40.870],[-73.921,40.879],[-73.920,40.870],[-73.933,40.851],[-73.945,40.834],[-73.955,40.813],[-73.964,40.796],[-73.969,40.774],[-73.970,40.753],[-73.975,40.735],[-73.982,40.718],[-73.990,40.707],[-74.001,40.701],[-74.019,40.700]],
 Brooklyn:[[-74.050,40.693],[-74.039,40.701],[-74.028,40.702],[-74.017,40.700],[-74.000,40.704],[-73.989,40.711],[-73.966,40.722],[-73.942,40.732],[-73.927,40.723],[-73.916,40.712],[-73.896,40.705],[-73.876,40.704],[-73.861,40.687],[-73.868,40.666],[-73.860,40.653],[-73.874,40.626],[-73.896,40.607],[-73.922,40.592],[-73.951,40.575],[-73.976,40.570],[-74.000,40.574],[-74.018,40.597],[-74.028,40.623],[-74.042,40.660],[-74.050,40.693]],
 Queens:[[-73.962,40.760],[-73.950,40.746],[-73.943,40.734],[-73.940,40.724],[-73.926,40.711],[-73.910,40.704],[-73.883,40.704],[-73.858,40.692],[-73.840,40.704],[-73.812,40.711],[-73.793,40.721],[-73.763,40.728],[-73.743,40.737],[-73.706,40.748],[-73.706,40.790],[-73.731,40.785],[-73.749,40.797],[-73.773,40.803],[-73.794,40.803],[-73.813,40.791],[-73.837,40.788],[-73.857,40.775],[-73.888,40.775],[-73.907,40.783],[-73.933,40.774],[-73.950,40.764],[-73.962,40.760]],
 Bronx:[[-73.936,40.874],[-73.936,40.862],[-73.923,40.838],[-73.917,40.822],[-73.891,40.804],[-73.865,40.803],[-73.849,40.818],[-73.835,40.828],[-73.804,40.823],[-73.788,40.845],[-73.774,40.863],[-73.769,40.885],[-73.788,40.902],[-73.799,40.913],[-73.833,40.915],[-73.858,40.908],[-73.881,40.909],[-73.902,40.886],[-73.922,40.882],[-73.936,40.874]],
 'Staten Island':[[-74.250,40.501],[-74.240,40.532],[-74.247,40.544],[-74.232,40.569],[-74.210,40.585],[-74.189,40.603],[-74.171,40.630],[-74.150,40.646],[-74.130,40.647],[-74.111,40.633],[-74.087,40.621],[-74.078,40.598],[-74.104,40.572],[-74.129,40.549],[-74.165,40.524],[-74.206,40.506],[-74.235,40.498],[-74.250,40.501]]
};
const NYC_BOROUGHS=Object.entries(NYC_SHORES).map(([name,coords])=>({name,poly:coords.map(q=>nycBaseProject(q[0],q[1]))}));
// Approximate East River centerline, from the Battery past Brooklyn and Queens.
// Subtracting this navigation/terrain corridor fixes overlapping simplified shore polygons.
const NYC_EAST_RIVER=[
 [-74.014,40.699],[-74.006,40.704],[-73.997,40.707],[-73.989,40.711],
 [-73.982,40.716],[-73.972,40.722],[-73.966,40.734],[-73.961,40.744],
 [-73.955,40.754],[-73.948,40.768],[-73.938,40.786],[-73.930,40.805]
].map(([lon,lat])=>nycBaseProject(lon,lat));
// Half-width varies along the river; values are at original NYC scale.
const NYC_EAST_RIVER_WIDTH=[39,43,48,51,58,57,54,52,52,58,65,65];
function riverDistanceSq(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,dd=dx*dx+dy*dy||1,t=clamp((x-a.x)*dx+(y-a.y)*dy,0,dd)/dd;const px=x-a.x-t*dx,py=y-a.y-t*dy;return px*px+py*py}
function nycEastRiverAt(x,y){
 if(activeMap!=='nyc'&&activeMap!=='nyc_megascale')return false;
 const scale=nycScale(),bx=x/scale,by=y/scale;
 if(bx<2650||bx>4850||by<1250||by>4500)return false;
 for(let i=1;i<NYC_EAST_RIVER.length;i++){
  const r=NYC_EAST_RIVER_WIDTH[i];if(riverDistanceSq(bx,by,NYC_EAST_RIVER[i-1],NYC_EAST_RIVER[i])<r*r)return true;
 }return false;
}
// Harlem River / Spuyten Duyvil waterway, distinct from the East River.
// Separates Manhattan and the Bronx, including the northern tip of Manhattan.
const NYC_HARLEM_RIVER=[
 [-73.941,40.878],[-73.933,40.875],[-73.930,40.868],[-73.923,40.864],[-73.922,40.858],
 [-73.924,40.849],[-73.929,40.839],[-73.929,40.827],[-73.930,40.817],
 [-73.936,40.806],[-73.937,40.799]
].map(([lon,lat])=>nycBaseProject(lon,lat));
const NYC_HARLEM_WIDTH=[54,52,48,45,47,49,53,49,47,53,60];
function nycHarlemRiverAt(x,y){if(!isNYC())return false;
 const sc=nycScale(),bx=x/sc,by=y/sc;
 if(bx<2850||bx>4300||by<300||by>3000)return false;
 for(let i=1;i<NYC_HARLEM_RIVER.length;i++){
  if(riverDistanceSq(bx,by,NYC_HARLEM_RIVER[i-1],NYC_HARLEM_RIVER[i])<NYC_HARLEM_WIDTH[i]**2)return true;
 }return false;
}
// Newtown Creek divides Greenpoint (Brooklyn) from Long Island City (Queens).
const NYC_NEWTOWN_CREEK=[
 [-73.960,40.736],[-73.954,40.735],[-73.949,40.732],[-73.944,40.731],
 [-73.936,40.729],[-73.928,40.730],[-73.921,40.728]
].map(([lon,lat])=>nycBaseProject(lon,lat));
const NYC_NEWTOWN_WIDTH=[24,27,26,25,21,23,22];
function nycNewtownCreekAt(x,y){if(activeMap!=='nyc')return false;
 const sc=nycScale(),bx=x/sc,by=y/sc;
 if(bx<3400||bx>4350||by<2450||by>3400)return false;
 for(let i=1;i<NYC_NEWTOWN_CREEK.length;i++)if(riverDistanceSq(bx,by,NYC_NEWTOWN_CREEK[i-1],NYC_NEWTOWN_CREEK[i])<NYC_NEWTOWN_WIDTH[i]**2)return true;
 return false}
function nycRiverOverlay(c,pts,widths){const sc=nycScale();c.save();c.lineCap='round';c.lineJoin='round';
 for(const [extra,col] of [[18,'#97aeb0'],[0,'#467f92']])for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i];c.strokeStyle=col;c.lineWidth=(2*widths[i]+extra)*sc;
  c.beginPath();c.moveTo(a.x*sc,a.y*sc);c.lineTo(b.x*sc,b.y*sc);c.stroke();
 }c.restore();}
function drawNYCEastRiver(c){if(activeMap!=='nyc')return;const scale=nycScale();c.save();c.lineJoin='round';c.lineCap='round';
 // Bank edge and open water are drawn over the old polygons and streets.
 for(const [offset,col] of [[15,'#92aaa8'],[0,'#467f92']]){
  for(let i=1;i<NYC_EAST_RIVER.length;i++){
   const a=NYC_EAST_RIVER[i-1],b=NYC_EAST_RIVER[i];c.strokeStyle=col;c.lineWidth=(NYC_EAST_RIVER_WIDTH[i]*2+offset)*scale;
   c.beginPath();c.moveTo(a.x*scale,a.y*scale);c.lineTo(b.x*scale,b.y*scale);c.stroke();
  }
 }
 c.restore()}
const NYC_UNLOCK=['Manhattan','Brooklyn','Queens','Bronx','Staten Island'];
function nycUnlocked(name){const i=NYC_UNLOCK.indexOf(name);return i>=0&&(activeMap==='nyc'?scenarioIndex>=i*4:scenarioIndex>=i)}
const NYC_AXIS={Manhattan:'south',Brooklyn:'west',Queens:'west',Bronx:'south','Staten Island':'east'};
const nycBoroughBox=name=>{const b=NYC_BOROUGHS.find(b=>b.name===name);if(!b)return null;const xs=b.poly.map(p=>p.x),ys=b.poly.map(p=>p.y);return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)}};
function nycUnlockFraction(name){const i=NYC_UNLOCK.indexOf(name);if(i<0)return 0;if(activeMap!=='nyc')return scenarioIndex>=i?1:0;return clamp((scenarioIndex-i*4+1)/4,0,1)}
function nycDistrictUnlocked(x,y,name){if(activeMap!=='nyc')return nycUnlocked(name);const fraction=nycUnlockFraction(name);if(fraction<=0)return false;if(fraction>=1)return true;const b=nycBoroughBox(name),sc=nycScale(),xx=x/sc,yy=y/sc;
 const axis=NYC_AXIS[name];if(axis==='south')return yy>=b.bottom-(b.bottom-b.top)*fraction;
 if(axis==='east')return xx>=b.right-(b.right-b.left)*fraction;
 return xx<=b.left+(b.right-b.left)*fraction;
}
function insidePoly(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>y)!==(b.y>y))&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
function nycBoroughAt(x,y,unlocked=true){if(nycEastRiverAt(x,y)||nycHarlemRiverAt(x,y)||nycNewtownCreekAt(x,y))return null;const scale=nycScale();for(const b of NYC_BOROUGHS)if((!unlocked||nycDistrictUnlocked(x,y,b.name))&&insidePoly(x/scale,y/scale,b.poly))return b.name;return null}
function nycLandAt(x,y){return !!nycBoroughAt(x,y)}
// The full NYC terrain stays on screen even while a borough is locked.
// Only unlocked land is considered walkable, buildable, or valid for spawning.
const nycPreviewBoroughAt=(x,y)=>nycBoroughAt(x,y,false);
const nycFullCityPreview=()=>isNYC();
const NYC_PLACES=[
 ['LOWER MANHATTAN',-74.008,40.711],['MIDTOWN MANHATTAN',-73.985,40.755],['UPTOWN',-73.947,40.827],
 ['DOWNTOWN BROOKLYN',-73.988,40.690],['CONEY ISLAND',-73.975,40.578],['LONG ISLAND CITY',-73.944,40.747],
 ['FLUSHING',-73.828,40.761],['THE BRONX',-73.873,40.849],['STATEN ISLAND',-74.151,40.595]
].map(([name,lon,lat])=>({name,lon,lat}));
// NYC is intentionally an authored game city: no map images, network tiles, or
// third-party ground data are loaded. Low-rise blocks remain procedural, while
// major towers are explicit, named building records placed at curated locations.
function nycSkylineLevels(x,y,random=.5){return 1+Math.floor(random*6)}
const NYC_SKYSCRAPERS=[
 ['ONE WORLD TRADE CENTER',-74.0134,40.7127,64,64,37,12],['4 WORLD TRADE CENTER',-74.0122,40.7116,59,57,23,3],
 ['3 WORLD TRADE CENTER',-74.0112,40.7103,55,55,25,18],['WOOLWORTH BUILDING',-74.0089,40.7124,53,48,27,8],
 ['70 PINE STREET',-74.0082,40.7078,49,46,27,14],['8 SPRUCE STREET',-74.0051,40.7106,56,47,24,-8],
 ['30 PARK PLACE',-74.0096,40.7133,56,50,23,6],['ONE VANDERBILT',-73.9787,40.7527,67,61,33,18],
 ['CHRYSLER BUILDING',-73.9753,40.7516,55,55,29,10],['EMPIRE STATE BUILDING',-73.9857,40.7484,77,57,31,0],
 ['BANK OF AMERICA TOWER',-73.9848,40.7545,64,55,30,7],['432 PARK AVENUE',-73.9719,40.7616,43,43,34,0],
 ['53W53',-73.9794,40.7614,47,44,27,-12],['CENTRAL PARK TOWER',-73.9819,40.7650,48,49,38,12],
 ['111 WEST 57TH',-73.9777,40.7648,28,55,36,-8],['30 HUDSON YARDS',-74.0016,40.7567,71,60,27,8],
 ['ONE MANHATTAN WEST',-74.0029,40.7558,67,58,25,0],['METLIFE BUILDING',-73.9774,40.7529,92,59,18,0],
 ['FLATIRON BUILDING',-73.9903,40.7411,55,36,16,-18],['THE BROOKLYN TOWER',-73.9877,40.6913,55,51,29,3],
 ['WILLIAMSBURGH SAVINGS TOWER',-73.9789,40.6941,49,46,22,-3],['ONE COURT SQUARE',-73.9432,40.7489,58,57,29,0],
 ['SKYLINE TOWER',-73.9430,40.7472,55,52,28,6],['QUEENS PLAZA PARK',-73.9388,40.7504,46,44,20,0],
 ['THE HUB',-73.9235,40.8170,48,47,19,0],['ST. GEORGE TOWER',-74.0738,40.6430,43,42,15,0]
];
function addNYCSkyscrapers(){
 if(activeMap!=='nyc')return;
 const scale=nycScale(),towers=[];
 for(const [name,lon,lat,width,depth,height,degrees] of NYC_SKYSCRAPERS){
  const p=nycProject(lon,lat);if(!nycPreviewBoroughAt(p.x,p.y))continue;
  const w=width*scale,h=depth*scale,angle=degrees*Math.PI/180;
  towers.push({key:'LANDMARK:'+name,name,x:p.x-w*.5,y:p.y-h*.5,w,h,cx:p.x,cy:p.y,footW:w,footH:h,angle,height,roof:Math.abs(Math.round(degrees/3))%7,shade:.58,vent:false,solar:false,landmark:true,locked:!nycDistrictUnlocked(p.x,p.y,nycPreviewBoroughAt(p.x,p.y))});
 }
 // Clear only the footprint around each authored tower, leaving the surrounding
 // hand-built street grid and lower city blocks intact.
 buildings=buildings.filter(b=>!towers.some(t=>Math.hypot((b.cx??b.x+b.w*.5)-t.cx,(b.cy??b.y+b.h*.5)-t.cy)<Math.max(t.footW,t.footH)*.72));
 buildings.push(...towers);
}
const NYC_PARKS=[[-73.967,40.784,195],[-73.972,40.776,140],[-73.969,40.661,130],[-73.852,40.747,125],[-73.875,40.860,125]];
const NYC_CROSSINGS=[
 ['Brooklyn Bridge',-73.997,40.709,-73.989,40.703,'Brooklyn'],
 ['Manhattan Bridge',-73.991,40.715,-73.983,40.703,'Brooklyn'],
 ['Williamsburg Bridge',-73.982,40.723,-73.961,40.710,'Brooklyn'],
 ['Queensboro Bridge',-73.960,40.758,-73.946,40.757,'Queens'],
 ['Pulaski Bridge',-73.953,40.737,-73.950,40.729,'Queens'],
 ['Triborough Crossing',-73.932,40.799,-73.920,40.789,'Queens'],
 ['Harlem River Bridge',-73.937,40.830,-73.930,40.839,'Bronx'],
 ['University Heights Bridge',-73.922,40.863,-73.914,40.864,'Bronx'],
 ['Broadway Bridge',-73.935,40.873,-73.932,40.875,'Bronx'],
 ['Madison Avenue Bridge',-73.930,40.814,-73.927,40.815,'Bronx'],
 ['Macombs Dam Bridge',-73.933,40.827,-73.925,40.828,'Bronx'],
 ['Verrazzano Bridge',-74.064,40.607,-74.037,40.606,'Staten Island']
];
const NYC_STAGE_FOCUS=[[-73.987,40.755],[-73.979,40.684],[-73.856,40.748],[-73.882,40.853],[-74.146,40.604],[-73.984,40.755]];

// Manhattan-scale grid: roughly 80m between numbered streets and 230m between avenues,
// consistent with the ordinary Midtown block dimensions. World coordinates are close
// to meters on this map. Geography is still simplified (not an OSM/parcel import).
const MANHATTAN_STREET=80,MANHATTAN_AVENUE=230;
// Central Park is visually centered inside the simplified Manhattan shoreline.
// The city polygon is deliberately simplified, so using unadjusted real-world
// longitude corners would put much of the park in the East River on this map.
function manhattanLongitudeBand(lat){const poly=NYC_SHORES.Manhattan,xs=[];
 for(let i=0;i<poly.length-1;i++){const a=poly[i],b=poly[i+1];if((a[1]<=lat&&b[1]>lat)||(b[1]<=lat&&a[1]>lat))xs.push(a[0]+(b[0]-a[0])*(lat-a[1])/(b[1]-a[1]))}
 xs.sort((a,b)=>a-b);return{west:xs[0]??-73.99,east:xs.at(-1)??-73.95}}
const parkCorner=(lat,fraction)=>{const band=manhattanLongitudeBand(lat);return nycBaseProject(band.west+(band.east-band.west)*fraction,lat)};
const CENTRAL_PARK_POLY=[parkCorner(40.7681,.30),parkCorner(40.8004,.30),parkCorner(40.7971,.70),parkCorner(40.7645,.70)];
let manhattanRoads=[];
function manhattanBasis(){
 const south=nycProject(-74.010,40.704),north=nycProject(-73.927,40.875),len=Math.hypot(north.x-south.x,north.y-south.y);
 const u={x:(north.x-south.x)/len,y:(north.y-south.y)/len};return{south,len,u,v:{x:-u.y,y:u.x}};
}
function mhPoint(b,s,t){return{x:b.south.x+b.u.x*s+b.v.x*t,y:b.south.y+b.u.y*s+b.v.y*t}}
function manhattanPark(x,y){return insidePoly(x/nycScale(),y/nycScale(),CENTRAL_PARK_POLY)}
function manhattanRoadDistance(x,y){
 if(activeMap!=='nyc'||!withinManhattan(x,y))return Infinity;
 const b=manhattanBasis(),dx=x-b.south.x,dy=y-b.south.y;
 const along=dx*b.u.x+dy*b.u.y,across=dx*b.v.x+dy*b.v.y;
 const street=Math.abs(along-(-500+Math.round((along+500)/MANHATTAN_STREET)*MANHATTAN_STREET));
 const avenue=Math.abs(across-(-3600+Math.round((across+3600)/MANHATTAN_AVENUE)*MANHATTAN_AVENUE));
 return Math.min(street,avenue);
}
function withinManhattan(x,y){return nycBoroughAt(x,y,false)==='Manhattan'}
function manhattanBuildingContains(b,x,y,pad=0){
 if(b.verts){if(polyContains(x,y,b.verts))return true;if(pad<=0)return false;return closestPolyEdge(x,y,{verts:b.verts}).d<=pad}
 if(!b.footW)return x>b.x-pad&&x<b.x+b.w+pad&&y>b.y-pad&&y<b.y+b.h+pad;
 const dx=x-b.cx,dy=y-b.cy,co=Math.cos(b.angle),si=Math.sin(b.angle);
 return Math.abs(dx*co+dy*si)<b.footW*.5+pad&&Math.abs(-dx*si+dy*co)<b.footH*.5+pad;
}
function* buildManhattanBlocksSteps(seed){
 if(activeMap!=='nyc')return;
 const b=manhattanBasis(),u=b.u,v=b.v,angle=Math.atan2(v.y,v.x),co=Math.cos(angle),si=Math.sin(angle);
 const startS=-500,endS=b.len+1000,limitT=3600;
 // Run-length compressed street surfaces prevent millions of extra 3D road objects.
 function appendRoad(axis,fixed,min,max,step,width){
  let begin=null,end=null;
  function flush(){if(begin===null||end-begin<step*.8)return;
   const c=axis==='street'?mhPoint(b,fixed,(begin+end)*.5):mhPoint(b,(begin+end)*.5,fixed);
   manhattanRoads.push({x:c.x,y:c.y,w:end-begin,h:width,angle:axis==='street'?angle:Math.atan2(u.y,u.x)});
   begin=null;end=null}
  for(let val=min;val<=max+step;val+=step){const p=axis==='street'?mhPoint(b,fixed,val):mhPoint(b,val,fixed);
   if(withinManhattan(p.x,p.y)&&!manhattanPark(p.x,p.y)&&!nycEastRiverAt(p.x,p.y)){if(begin===null)begin=val-step*.5;end=val+step*.5}else flush();}
  flush();
 }
 for(let ss=startS,nn=0;ss<=endS;ss+=MANHATTAN_STREET,nn++){appendRoad('street',ss,-limitT,limitT,30,18);if(nn%18===0)yield 1}
 for(let tt=-limitT;tt<=limitT;tt+=MANHATTAN_AVENUE){appendRoad('avenue',tt,startS,endS,35,27);yield 1}
 for(let si0=0,s=startS+MANHATTAN_STREET*.5;s<=endS;s+=MANHATTAN_STREET,si0++){if(si0%5===0)yield 1;
  for(let ti0=0,t=-limitT+MANHATTAN_AVENUE*.5;t<=limitT;t+=MANHATTAN_AVENUE,ti0++){
   const center=mhPoint(b,s,t);
   if(!withinManhattan(center.x,center.y))continue;
   const rand=rng((seed+Math.imul(si0+1,104729)+Math.imul(ti0+1,1299709))>>>0);
   if(manhattanPark(center.x,center.y)){if(rand()<.2){parks.push({x:center.x-24,y:center.y-18,w:48,h:36,trees:[{x:center.x,y:center.y,r:4}]})}continue}
   // Multiple individually placed buildings occupy each Manhattan block.
   const count=rand()<.30?2:3,available=MANHATTAN_AVENUE-34,blockHeight=MANHATTAN_STREET-21,split=available/count;
   for(let i=0;i<count;i++){
    if(rand()<.1)continue;
    const across=(i-(count-1)*.5)*split+(rand()-.5)*3,loc=mhPoint(b,s,t+across),w=split-7,h=blockHeight-5;
    const corners=[[-w*.5,-h*.5],[w*.5,-h*.5],[w*.5,h*.5],[-w*.5,h*.5]];
    if(!corners.every(([qx,qy])=>{const x=loc.x+qx*co-qy*si,y=loc.y+qx*si+qy*co;return withinManhattan(x,y)&&!manhattanPark(x,y)}))continue;
    const bw=Math.abs(w*co)+Math.abs(h*si),bh=Math.abs(w*si)+Math.abs(h*co);
    buildings.push({key:'MH:'+si0+':'+ti0+':'+i,x:loc.x-bw*.5,y:loc.y-bh*.5,w:bw,h:bh,cx:loc.x,cy:loc.y,footW:w,footH:h,angle,
      locked:!nycDistrictUnlocked(loc.x,loc.y,'Manhattan'),roof:Math.floor(rand()*7),shade:rand(),height:nycSkylineLevels(loc.x,loc.y,rand()),vent:rand()<.45,solar:rand()<.14});
   }
  }
 }
}

let nycSpawnPoints=[];
function nycSnapToShore(p,allowLocked=false){if((allowLocked?nycPreviewBoroughAt(p.x,p.y):nycLandAt(p.x,p.y)))return p;
 // Nearest accessible shore from the original approximate crossing endpoint.
 for(let r=10*nycScale();r<=460*nycScale();r+=10*nycScale())for(let theta=0;theta<32;theta++){
  const a=theta*Math.PI/16,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;
  if((allowLocked?nycPreviewBoroughAt(x,y):nycLandAt(x,y)))return{x,y};
 }return p}
function nycSnapToBorough(p,borough){if(!borough)return nycSnapToShore(p,true);
 if(nycPreviewBoroughAt(p.x,p.y)===borough)return p;
 const scale=nycScale();for(let r=6*scale;r<=320*scale;r+=6*scale)for(let i=0;i<64;i++){
  const angle=TAU*i/64,x=p.x+Math.cos(angle)*r,y=p.y+Math.sin(angle)*r;
  if(nycPreviewBoroughAt(x,y)===borough)return{x,y};
 }return nycSnapToShore(p,true)}
function nycBridgeDistance(x,y,b){let vx=b.bx-b.ax,vy=b.by-b.ay,m=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((x-b.ax)*vx+(y-b.ay)*vy)/m));return Math.hypot(x-(b.ax+vx*t),y-(b.ay+vy*t))}
function nycCoastPath(c,allBoroughs=false){const scale=nycScale();for(const b of NYC_BOROUGHS){if(!allBoroughs&&!nycUnlocked(b.name))continue;c.moveTo(b.poly[0].x*scale,b.poly[0].y*scale);for(let i=1;i<b.poly.length;i++)c.lineTo(b.poly[i].x*scale,b.poly[i].y*scale);c.closePath()}}

let activeMap='classic',chosenMap='nyc';
const validMap=id=>Object.hasOwn(MAPS,id)?id:'classic';
let W=2400,H=1560,VIS_W=2400,VIS_H=1560,XROADS=BASE_X.slice(),YROADS=BASE_Y.slice(),VIS_XROADS=BASE_X.slice(),VIS_YROADS=BASE_Y.slice();
function sizeForStage(sc){if(isNYC()){
  const scale=nycScale();W=H=NYC_DIM*scale;VIS_W=W;VIS_H=H;GRIDCOLS=Math.ceil(W/CELL)+4;NAV_STEP=activeMap==='nyc'?70:24*scale;XROADS=[];YROADS=[];
  // Stable proportional block coordinates: the entire borough layout grows uniformly.
  for(let p=190;p<NYC_DIM-140;p+=118)XROADS.push(p*scale);
  for(let p=190;p<NYC_DIM-140;p+=118)YROADS.push(p*scale);
  VIS_XROADS=XROADS.slice();VIS_YROADS=YROADS.slice();return}
 const m=MAPS[activeMap];NAV_STEP=14;XROADS=m.x.slice();YROADS=m.y.slice();for(let i=0;i<sc.extendX;i++)XROADS.push(m.x.at(-1)+(i+1)*m.dx);for(let i=0;i<sc.extendY;i++)YROADS.push(m.y.at(-1)+(i+1)*m.dy);W=XROADS.at(-1)+77;H=YROADS.at(-1)+34;GRIDCOLS=Math.ceil(W/CELL)+4;VIS_XROADS=XROADS.slice();VIS_YROADS=YROADS.slice();const last=scenarios.at(-1);for(let i=sc.extendX;i<last.extendX;i++)VIS_XROADS.push(m.x.at(-1)+(i+1)*m.dx);for(let i=sc.extendY;i<last.extendY;i++)VIS_YROADS.push(m.y.at(-1)+(i+1)*m.dy);VIS_W=VIS_XROADS.at(-1)+77;VIS_H=VIS_YROADS.at(-1)+34}
const tools=[
 {id:'garrison',name:'Garrison',key:'1',price:215,desc:'Barracks · recruits mobile soldiers over time',range:0,damage:0,rate:0,color:'#89daca',health:175,live:true},
 {id:'sniper',name:'Lookout',key:'2',price:125,desc:'Directional long-range watcher · drag to aim',range:690,damage:4.8,rate:1.3,arc:.72,color:'#8ebce8',health:70,live:true},
 {id:'turret',name:'Auto-turret',key:'3',price:168,desc:'Mount on rooftops or street level',range:192,damage:1.25,rate:.11,color:'#d9c78c',health:100},
 {id:'mortar',name:'Mortar station',key:'4',price:225,desc:'Heavy impacts can topple buildings',range:540,damage:10,rate:4.75,color:'#c8a2dd',health:85},
 {id:'zone',name:'Safe zone',key:'5',price:85,desc:'Affordable · snaps to adjacent shelter corners',color:'#7cddc3'},
 {id:'beacon',name:'Evacuation beacon',key:'6',price:65,desc:'Budget evacuation guidance · 420m range',range:420,color:'#7de6e2',health:95},
 {id:'wall',name:'Barricade',key:'7',price:38,desc:'Independent sections · pay by length',color:'#d3b67a'},
 {id:'gate',name:'Shelter gate',key:'8',price:110,desc:'180 people/s · stronger reinforced HP',color:'#b5efcb'},
 {id:'helicopter',name:'Patrol helicopter',key:'0',price:580,desc:'Light airborne horde patrol',range:215,damage:1.05,rate:.42,color:'#b5d9dc',health:180,live:true},
 {id:'tank',name:'Tank',key:'9',price:950,cooldown:16,desc:'Permanent armor · airdropped during outbreak',range:250,damage:7,rate:.9,color:'#c1be87',health:450,live:true},
 {id:'battleship',name:'Battleship',key:'b',price:6800,desc:'Permanent naval artillery · very wide bombardment range · water only',range:4400,damage:28,rate:11.5,color:'#a5c4d6',health:650},
 {id:'machinegun',name:'Machine-gun nest',key:'m',price:325,desc:'Fast, narrow directional fire · drag to aim',range:175,damage:.82,rate:.052,arc:.38,color:'#e1b66f',health:115,live:true},
 {id:'minefield',name:'Mine field',key:'n',price:155,desc:'Hidden area denial · blast and rearm',range:66,damage:18,rate:11,color:'#d88b72',health:60}];
const supports=[
 {id:'infantry',name:'Ground response squad',key:'F',price:175,cooldown:5,desc:'Pursues distant hordes',range:173,damage:1.9,rate:.27,color:'#80b1ff',health:150},
 {id:'airstrike',name:'Airstrike',key:'Q',price:340,cooldown:9,desc:'Animated area response',color:'#e4bc86'},
 {id:'strafe',name:'Line airstrike',key:'E',price:540,cooldown:8,desc:'DRAG to aim wider, extended corridor',color:'#f4bb84'},
 {id:'paratroopers',name:'Paratrooper drop',key:'R',price:390,cooldown:13,desc:'Four mobile squads arrive',color:'#9bc7ef'},
 {id:'attackheli',name:'Attack helicopter',key:'H',price:760,cooldown:16,desc:'Hunts targets, then departs',range:325,damage:5,rate:.21,color:'#9ed7e5',health:300}];
const unitSpec=id=>tools.find(a=>a.id===id)||supports.find(a=>a.id===id);
// Only buildings, permanent vehicles and defensive stations carry between stages.
// Ground responders and parachute infantry leave after the current stage.
const PERSISTENT_DEFENSES=new Set(['garrison','sniper','turret','mortar','beacon','helicopter','tank','battleship','machinegun','minefield']);
const isRoundOnlyUnit=id=>id==='infantry'||id==='attackheli';
const defenseCanBuild=id=>phase!=='live'||['garrison','sniper','helicopter','tank'].includes(id);
const scenarios=[
 {name:'LOWER ISLAND / MANHATTAN-INSPIRED GRID',population:25000,budget:12000,grant:12000,extendX:0,extendY:0,target:.22,seed:2109,seedCount:62,waves:[22,46,76,106],waveSize:[56,64,77,88]},
 {name:'EAST RIVER / BRIDGE APPROACHES',population:42000,budget:19000,grant:11000,extendX:2,extendY:1,target:.22,seed:91422,seedCount:78,waves:[21,43,70,99,132],waveSize:[65,78,91,106,120]},
 {name:'BROOKLYN / HARBOR WATERFRONT',population:70000,budget:26000,grant:16000,extendX:4,extendY:2,target:.23,seed:88172,seedCount:90,waves:[20,41,66,93,124],waveSize:[79,95,111,127,145]},
 {name:'QUEENS / EASTERN BOROUGHS',population:110000,budget:34000,grant:21000,extendX:6,extendY:3,target:.24,seed:71302,seedCount:105,waves:[19,39,62,87,116,148],waveSize:[93,109,124,138,155,174]},
 {name:'UPTOWN / RIVER CROSSINGS',population:160000,budget:44000,grant:27000,extendX:8,extendY:4,target:.25,seed:55132,seedCount:125,waves:[18,36,59,83,107,143],waveSize:[105,124,148,164,180,205]},
 {name:'GREATER METROPOLIS / FINAL CONTAINMENT',population:220000,budget:58000,grant:34000,extendX:10,extendY:5,target:.26,seed:34410,seedCount:155,waves:[17,35,55,78,100,123,154],waveSize:[128,148,168,190,210,235,260]}];
scenarios.forEach(sc=>{sc.seedCount=Math.round(sc.seedCount*2.2);sc.waveSize=sc.waveSize.map(n=>Math.round(n*2.4))});
// Extra population applies ONLY to the five-borough NYC maps. Each resident
// count is tracked by weighted moving cohorts so a million-person city does
// not create a million physics objects. Other maps retain their original counts.
const NYC_STAGE_POPULATIONS=[100000,180000,300000,480000,750000,1100000];
const nycScenarios=scenarios.map((stage,i)=>({...stage,population:NYC_STAGE_POPULATIONS[i]}));
const NYC_FOUR_STAGE_NAMES=[
 ['LOWER MANHATTAN','MIDTOWN APPROACH','UPPER MANHATTAN','HARLEM & NORTH END'],
 ['BROOKLYN BRIDGE APPROACH','WEST BROOKLYN','CENTRAL BROOKLYN','EAST BROOKLYN'],
 ['LONG ISLAND CITY','WEST QUEENS','CENTRAL QUEENS','EAST QUEENS'],
 ['SOUTH BRONX','BRONX RIVER DISTRICT','CENTRAL BRONX','NORTH BRONX'],
 ['EAST STATEN ISLAND','NORTH SHORE','CENTRAL STATEN ISLAND','WEST STATEN ISLAND']];
const NYC_CAMPAIGN_TARGETS=[100000,300000,500000,750000,1100000];
const nycCampaign=Array.from({length:20},(_,i)=>{
 const borough=Math.floor(i/4),quarter=i%4;const lower=borough===0?16000:NYC_CAMPAIGN_TARGETS[borough-1];
 const population=Math.round((lower+(NYC_CAMPAIGN_TARGETS[borough]-lower)*(quarter+1)/4)/1000)*1000;
 const src=scenarios[Math.min(5,Math.floor(i*6/20))];
 return {...src,name:NYC_FOUR_STAGE_NAMES[borough][quarter],population,budget:12000+i*3100,grant:3900+i*800,
  seed:71119+i*4219,seedCount:Math.round(src.seedCount*(.45+i*.045)),
  waveSize:src.waveSize.map(v=>Math.round(v*(.58+i*.039)))};
});
const campaignStages=()=>activeMap==='nyc'?nycCampaign.length:scenarios.length;
const NYC_CAMPAIGN_FOCUS=[
 [-74.011,40.711],[-73.997,40.744],[-73.970,40.784],[-73.938,40.846],
 [-74.0035,40.697],[-73.981,40.678],[-73.946,40.674],[-73.900,40.681],
 [-73.947,40.747],[-73.919,40.753],[-73.863,40.758],[-73.784,40.755],
 [-73.910,40.8175],[-73.890,40.827],[-73.859,40.851],[-73.808,40.881],
 [-74.097,40.6255],[-74.132,40.609],[-74.173,40.568],[-74.206,40.553]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),rnd=(a,b)=>a+Math.random()*(b-a),fmt=n=>Math.round(n).toLocaleString('en-US');
const ftime=v=>{v=Math.floor(v);return String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0')};
const scenarioAt=()=>activeMap==='nyc'?nycCampaign[scenarioIndex]:isNYC()?nycScenarios[scenarioIndex]:scenarios[scenarioIndex];
let scenarioIndex=0,phase='planning',prevPhase='planning',time=0,speed=1,budget=8000,initialPopulation=3000,rescued=0,lost=0,neutralized=0,spawnedWaves=0;
const livingPopulation=()=>Math.max(0,initialPopulation-lost);
const survivalRatio=()=>initialPopulation>0?livingPopulation()/initialPopulation:0;
// Keep small losses visible instead of rounding 99.6% up to "100%".
const survivalPercent=()=>{const raw=survivalRatio()*100;return raw>0&&raw<100?Math.min(99.99,Math.round(raw*100)/100):raw};
let people=[],zombies=[],buildings=[],parks=[],lots=[],rivers=[],bridges=[],futureBridges=[],shells=[],defenses=[],zones=[],gates=[],walls=[],effects=[],tracers=[],flares=[],aircraft=[],parachutes=[],feed=[],toolId=null,selected=null,hotTip='',mouse={x:0,y:0,wx:0,wy:0,down:false,pan:false,px:0,py:0},drag=null,cam={x:470,y:210,zoom:.58},cw=800,ch=650,dpr=1;
let simId=0,uiTick=0,miniTick=0,grainCanvas=null,staticMap=null,outbreak={x:1195,y:723},toastUntil=0,uiInspectedId=-1,uiSelectedAt=0,uiObjectivesMarkup='',soundEnabled=true,audio=null,arrivals=[],campaignCheckpoint=null;
let keys=new Set(),unitId=1,enemyId=1,zeroTime=0,heroWave=0,spawnCooldowns={},populationCull=0,ambientClock=0,stereoNoise=0,civilianSliceTick=0,hordeClock=0,hordeCenters=[],soundNextGun=0,soundNextGrowl=0,noiseBuffer=null;
// A moving civilian is a small cohort. The full population is tracked exactly
// through each cohort's weight, avoiding 220,000 physics updates per frame.
// The same varied civilian shirt palette is used for moving civilians and
// weighted gate-queue figures. A person's assigned shirt remains stable.
const CIVILIAN_SHIRT_COLORS=[
 '#e4d8b4','#aec5bb','#e4ad85','#c3d7b7','#8bbcc5','#d0c5d1',
 '#cda1aa','#dfc48e','#a9b0d9','#b9c69c','#d3aeb9','#9ac7bc'
];
const civilianShirtColor=p=>CIVILIAN_SHIRT_COLORS[
 Math.min(CIVILIAN_SHIRT_COLORS.length-1,Math.floor((p.shade??.5)*CIVILIAN_SHIRT_COLORS.length))
];
const queueShirtColor=(index,gateId)=>CIVILIAN_SHIRT_COLORS[
 (index*7+gateId*13)%CIVILIAN_SHIRT_COLORS.length
];
const MAX_CIV_COHORTS=6800, MAX_NYC_COHORTS=10000;
const SURGE_FIRST_BATCH=95, SURGE_BATCH_PER_SECOND=640, MAX_SPAWN_PER_TICK=105;
let quietClock=0,showRanges=true,pendingSurges=[],zombieSliceTick=0,zombieSpawnCarry=0,threatProfile={pressure:1,count:1,speed:1,siege:1},lastWaveInfo=null;
// Endless is opt-in after finishing all six districts. A lightweight checkpoint
// is recorded only between waves, never during a busy combat frame.
const ENDLESS_SAVE_KEY='cityfall_endless_checkpoint_v1',ENDLESS_BEST_KEY='cityfall_endless_best_v1';
const ENDLESS_PACING_TARGET=1700,ENDLESS_WAVE_LIMIT=9000,ENDLESS_INTERMISSION_SECONDS=12,MAX_GATE_LEVEL=9;
let endlessMode=false,endlessWave=0,endlessPressure=0,endlessAwardedWave=0,endlessNextAt=0,endlessBest=0,endlessIntermission=0;
try{endlessBest=Math.max(0,Number(localStorage.getItem(ENDLESS_BEST_KEY))||0)}catch{}
// Campaign-wide difficulty is independent of the per-wave adaptive director.
let campaignThreat={carry:1,completed:0,lastGain:0},humanSearchClock=0,humanClusters=[],shelterTargets=new Map(),fallingBuildings=[];
const WALL_SECTION_MAX=76;
// A token bucket limits shelter entrance throughput without freezing the large civilian cohorts.
const GATE_FLOW_RATE=180, GATE_FLOW_BURST=280;
const STRAFE_LENGTH=1100, STRAFE_RADIUS=74;
// Garrison recruits are mobile actors, not stationary weapon platforms.
// Keep local and global caps to protect performance with dozens of barracks.
const GARRISON_RECRUIT_GLOBAL_CAP=240;
const garrisonCapacity=u=>3+Math.min(4,u.level||1);
const garrisonInterval=u=>Math.max(5,13.5-2*(Math.max(1,u.level||1)-1));
const gateUpgradeCost=g=>Math.ceil((95+65*Math.pow(g.level||1,1.4))/5)*5;
const gateFlowRate=g=>Math.round(GATE_FLOW_RATE*Math.pow(1.72,Math.max(0,(g.level||1)-1)));
const gateFlowBurst=g=>Math.round(GATE_FLOW_BURST*Math.pow(1.42,Math.max(0,(g.level||1)-1)));

let wallGrid=new Map(),wallGridDirty=true;
function buildingCoreHeight(b){return 14+b.height*13+b.shade*.7}
// Manhattan towers get a stepped crown and (on the tallest towers) an antenna.
// Keep the physical height in one place so roof placement, falling meshes, and
// impact reach all agree with what the player sees.
function buildingHeight(b){const core=buildingCoreHeight(b);if(!isNYC()||core<165)return core;return core*(core>=390?1.43:core>=270?1.31:1.18)}
function roofBuildingAt(x,y){const bucket=buildingGrid.get(Math.floor(x/CELL)+Math.floor(y/CELL)*GRIDCOLS)||[];return bucket.find(b=>!b.collapsed&&!b.collapsing&&manhattanBuildingContains(b,x,y,5))||null}
function rebuildBuildingGrid(){buildingGrid.clear();for(const b of buildings){if(b.collapsed||b.locked)continue;for(let gy=Math.floor(b.y/CELL);gy<=Math.floor((b.y+b.h)/CELL);gy++)for(let gx=Math.floor(b.x/CELL);gx<=Math.floor((b.x+b.w)/CELL);gx++){const key=gx+gy*GRIDCOLS;let bucket=buildingGrid.get(key);if(!bucket){bucket=[];buildingGrid.set(key,bucket)}bucket.push(b)}}}
function rebuildWallGrid(){wallGrid.clear();for(const w of walls){if(w.hp<=0)continue;const x1=Math.floor((Math.min(w.ax,w.bx)-13)/CELL),x2=Math.floor((Math.max(w.ax,w.bx)+13)/CELL),y1=Math.floor((Math.min(w.ay,w.by)-13)/CELL),y2=Math.floor((Math.max(w.ay,w.by)+13)/CELL);for(let yy=y1;yy<=y2;yy++)for(let xx=x1;xx<=x2;xx++){const key=xx+yy*GRIDCOLS;let bucket=wallGrid.get(key);if(!bucket){bucket=[];wallGrid.set(key,bucket)}bucket.push(w)}}wallGridDirty=false}
function makeWallSections(w,repair=false){const d=Math.hypot(w.bx-w.ax,w.by-w.ay),count=Math.max(1,Math.ceil(d/WALL_SECTION_MAX)),price=w.price??wallCost({x:w.ax,y:w.ay},{x:w.bx,y:w.by});const group=w.group||('barrier-'+unitId+'-'+Math.floor(Math.random()*1e6)),parts=[];let left=price;
 for(let i=0;i<count;i++){const t=i/count,k=(i+1)/count,segmentPrice=i===count-1?left:Math.floor(price/count);left-=segmentPrice;const length=d/count,health=168+length*.34;
 parts.push({id:unitId++,type:'wall',group,section:i+1,sectionCount:count,ax:w.ax+(w.bx-w.ax)*t,ay:w.ay+(w.by-w.ay)*t,bx:w.ax+(w.bx-w.ax)*k,by:w.ay+(w.by-w.ay)*k,price:segmentPrice,hp:repair?health:health*(w.hp!=null&&w.maxHp?clamp(w.hp/w.maxHp,0,1):1),maxHp:health})}
 return parts}

const CELL=78,SAFE_GRID=24;let GRIDCOLS=256,NAV_STEP=14;
let civGrid=new Map(),zombieGrid=new Map(),unitGrid=new Map(),buildingGrid=new Map(),beaconGrid=new Map(),beaconGridDirty=true,navCols=0,navRows=0,navWalk=null,navCache=new Map(),navVersion=0,detourBudget=8;
const navOffsets=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];

const ICONS={
 garrison:'<rect x="7" y="13" width="18" height="16" rx="1"/><path d="M4 13L16 5l12 8M11 19h10M13 28v-6h6v6"/>',
 sniper:'<circle cx="16" cy="12" r="5"/><path d="M12 19h8l4 10H8zM5 5l4 4M23 6l4-4M16 2v4"/>',
 turret:'<rect x="7" y="14" width="18" height="14" rx="4"/><rect x="13" y="8" width="6" height="15" rx="2"/><path d="M5 25h22M4 30h24"/>',
 mortar:'<rect x="8" y="21" width="16" height="7" rx="2"/><path d="M11 22L18 7l6 3-7 15M5 29h22"/>',
 machinegun:'<path d="M5 25h22M9 25V14h8v11M17 16h11M17 20h8M12 14V8h5"/>',
 minefield:'<circle cx="16" cy="16" r="9"/><path d="M16 3v5M16 24v5M3 16h5M24 16h5M9 9l3 3M20 20l3 3M23 9l-3 3M12 20l-3 3"/>',
 zone:'<path d="M5 13L16 5l11 8v15H5zM11 13h10v15H11zM16 10v8M12 14h8"/>',
 beacon:'<path d="M16 6v21M10 27h12M12 13h8M7 10Q16 1 25 10M4 7Q16-5 28 7"/>',
 wall:'<rect x="3" y="13" width="26" height="14" rx="2"/><path d="M3 20h26M11 13v7M20 20v7M5 9h22"/>',
 gate:'<path d="M4 3v26M28 3v26M4 5h24M4 27h24M9 8v16M23 8v16M9 16h14"/>',
 infantry:'<circle cx="16" cy="7" r="5"/><path d="M9 17l5-5h4l5 5-2 8h-4l-1-8-2 8h-4zM12 25l-2 5M20 25l2 5M7 16l-3 6M25 16l3 6"/>',
 battleship:'<path d="M2 20h28l-5 8H7zM9 18V9h14v9M13 9V4h7v5M4 20V18h24M11 13h3M18 13h3"/>',
 tank:'<rect x="3" y="11" width="26" height="17" rx="5"/><rect x="7" y="9" width="18" height="21" rx="4"/><circle cx="16" cy="19" r="5"/><path d="M16 14V3M3 15h4M25 15h4M3 24h4M25 24h4"/>',
 attackheli:'<path d="M5 12h22M16 2v26M9 16l7-7 7 7v10H9zM3 29h26"/>',
 helicopter:'<path d="M9 14Q16 8 23 14v9Q16 30 9 23zM16 22v9M12 28h8M16 2v12M4 9h24M4 9l5-4M28 9l-5-4"/>',
 airstrike:'<path d="M16 2l4 13 10 5v5l-12-3-2 8-2-8-12 3v-5l10-5z"/>',
 strafe:'<path d="M5 19l8-7V4l6 9 8 4v4l-9-2-2 7-3-7zM3 29h26M8 25h16"/>',
 paratroopers:'<path d="M3 13Q6-1 16 3Q26-1 29 13M3 13L16 21l13-8M16 21v4M12 28l4-3 4 3M13 28v3M19 28v3"/>',
 gateSupport:'<path d="M4 4h24M4 28h24"/>'};
function iconSVG(id){return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'+(ICONS[id]||ICONS.garrison)+'</svg>'}
function closeDrawers(){$('sidebar').classList.remove('open');document.querySelector('.inspector').classList.remove('open');$('mobileBackdrop').classList.remove('show')}
function drawer(name){const el=name==='tools'?$('sidebar'):document.querySelector('.inspector');const already=el.classList.contains('open');closeDrawers();if(!already){el.classList.add('open');$('mobileBackdrop').classList.add('show')}}

function rng(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}};
function audioReady(){if(!soundEnabled)return null;try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();return audio}catch{return null}}
function playTone(hz=400,duration=.05,volume=.02,type='sine'){
 const ac=audioReady();if(!ac)return;try{let t=ac.currentTime,osc=ac.createOscillator(),gain=ac.createGain();osc.type=type;osc.frequency.setValueAtTime(hz,t);osc.frequency.exponentialRampToValueAtTime(Math.max(30,hz*.75),t+duration);gain.gain.setValueAtTime(Math.max(.0001,volume),t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(ac.destination);osc.start(t);osc.stop(t+duration+.005)}catch{}
}
function playNoise(duration=.23,volume=.025,low=80,high=1900){const ac=audioReady();if(!ac)return;try{
 if(!noiseBuffer){noiseBuffer=ac.createBuffer(1,Math.round(ac.sampleRate),ac.sampleRate);let d=noiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
 const src=ac.createBufferSource(),filter=ac.createBiquadFilter(),g=ac.createGain(),t=ac.currentTime;
 src.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.value=(low+high)/2;filter.Q.value=.55;
 g.gain.setValueAtTime(Math.max(.0001,volume),t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
 src.connect(filter);filter.connect(g);g.connect(ac.destination);src.start(t);src.stop(t+duration+.01)
 }catch{}}
function screenAudio(x,y){const mx=cam.x+cw/(2*cam.zoom),my=cam.y+ch/(2*cam.zoom),distance=Math.hypot(mx-x,my-y);return clamp(1/(1+distance/(195*Math.max(.48,cam.zoom))),.05,1)*clamp(Math.pow(cam.zoom/.65,1.4),.32,2.8)}
function gunSound(x,y,heavy=false){if(!soundEnabled)return;const v=screenAudio(x,y);if(v<.075)return;const ac=audioReady();if(!ac||ac.currentTime<soundNextGun)return;soundNextGun=ac.currentTime+(heavy?.085:.048);
 playNoise(heavy?.21:.095,clamp((heavy?.085:.064)*v,.003,.17),heavy?70:180,heavy?950:2500);playTone(heavy?78:151,heavy?.19:.085,clamp(.045*v,.002,.12),'sawtooth')}
function zombieSound(x,y,force=false){const ac=audioReady();if(!ac||ac.currentTime<soundNextGrowl)return;let v=screenAudio(x,y);if(v<.10&&!force)return;soundNextGrowl=ac.currentTime+rnd(.38,.9);playTone(rnd(57,105),rnd(.28,.65),clamp(.016*v,.004,.075),'sawtooth');playNoise(.18,clamp(.016*v,.002,.048),90,680)}
function effectSound(kind){switch(kind){case'ui':playTone(480,.052,.012,'triangle');break;case'deploy':playTone(330,.12,.033,'square');playTone(600,.055,.021);break;case'gun':gunSound(cam.x+cw/(2*cam.zoom),cam.y+ch/(2*cam.zoom));break;case'plane':playNoise(.7,.075,60,520);playTone(105,.85,.032,'sawtooth');break;case'blast':playNoise(.55,.15,45,820);playTone(79,.45,.105,'triangle');break;case'warning':playTone(300,.15,.028,'triangle');playTone(225,.18,.025,'triangle');break;case'radio':playNoise(.16,.019,300,2800);break;case'rescue':playTone(760,.09,.020,'sine');break;}}
function ambientSound(){if(!soundEnabled||phase!=='live'||!zombies.length)return;
 const mx=cam.x+cw/(2*cam.zoom),my=cam.y+ch/(2*cam.zoom);let closest=null,min=Infinity,closeCount=0;
 eachNearby(zombieGrid,mx,my,850,z=>{if(!z.alive)return;const d=(z.x-mx)**2+(z.y-my)**2;if(d<min){closest=z;min=d}if(d<(260/cam.zoom)**2)closeCount++});
 if(closest){zombieSound(closest.x,closest.y,true);if(closeCount>14)playTone(rnd(61,82),.55,clamp(.014*screenAudio(closest.x,closest.y)*Math.log2(closeCount+1)/3,.003,.06),'sawtooth')}
 let rotor=0;for(const u of defenses){if((u.type==='helicopter'||u.type==='attackheli')&&u.hp>0)rotor=Math.max(rotor,screenAudio(u.x,u.y))}
 if(rotor>.11){playTone(91,.44,clamp(.014*rotor,.002,.045),'sawtooth');playNoise(.2,clamp(.008*rotor,.002,.024),70,480)}
 if(Math.random()<.5){playTone(Math.random()<.5?390:480,.44,.003,'sine');if(Math.random()<.25)effectSound('radio')}
}
function notify(s,bad=false){const e=$('toast');e.textContent=s;e.style.borderColor=bad?'#c47875':'#5aa994';e.classList.add('show');toastUntil=performance.now()+2350;if(bad)playTone(195,.11,.026,'triangle');else playTone(610,.05,.015)}
function log(s){feed.unshift({time:ftime(time),text:s});feed=feed.slice(0,5);$('radioFeed').innerHTML=feed.map(x=>'<div class="feeditem"><span class="feedtime">'+x.time+'</span>'+x.text+'</div>').join('')}
function* makeCitySteps(){const config=MAPS[activeMap],rand=rng(config.seed);buildings=[];parks=[];lots=[];manhattanRoads=[];futureBridges=[];
 for(let iy=0;iy<YROADS.length-1;iy++)for(let ix=0;ix<XROADS.length-1;ix++){if(ix===0&&iy%3===0)yield 1;const localRand=rng((config.seed+Math.imul(ix+1,100003)+Math.imul(iy+1,17837))>>>0);
  const streetMargin=activeMap==='nyc'?18:isNYC()?27*nycScale():27;
  const xa=XROADS[ix]+streetMargin,xb=XROADS[ix+1]-streetMargin,ya=YROADS[iy]+streetMargin,yb=YROADS[iy+1]-streetMargin;
  const dw=xb-xa,dh=yb-ya,rv=localRand();
  const district=isNYC()?nycPreviewBoroughAt(xa+dw*.5,ya+dh*.5):null;
  if(isNYC()&&!district)continue;
  const locked=isNYC()&&!nycDistrictUnlocked(xa+dw*.5,ya+dh*.5,district);
  if(activeMap==='nyc'&&[[xa,ya],[xb,ya],[xa,yb],[xb,yb],[xa+dw*.5,ya+dh*.5]].some(([x,y])=>withinManhattan(x,y)))continue;
  const nearNYCPark=isNYC()&&NYC_PARKS.some(([lon,lat,rad])=>{const v=nycProject(lon,lat);return Math.hypot(v.x-(xa+dw/2),v.y-(ya+dh/2))<rad*nycScale()});
  if(rv<config.park||nearNYCPark||(activeMap==='nyc_legacy'&&ix>=4&&ix<=5&&iy>=3&&iy<=7)){parks.push({x:xa,y:ya,w:dw,h:dh,locked,trees:Array.from({length:Math.floor(dw*dh/(1100*(isNYC()?Math.max(1,(nycScale()/1.6)**2):1)))},()=>({x:xa+localRand()*dw,y:ya+localRand()*dh,r:3+localRand()*5}))});continue}
  if(rv<(activeMap==='harbour'?.32:config.park+.075)){lots.push({x:xa,y:ya,w:dw,h:dh,locked,angle:localRand()<.5?0:1});continue}
  const cols=isNYC()?(localRand()<.18?1:2):(localRand()<.45?2:3),rows=isNYC()?(localRand()<.18?1:2):(localRand()<.6?2:3),gap=9,partW=dw/cols,partH=dh/rows;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    if(localRand()<.11)continue;
    const pad=activeMap==='nyc'?8+localRand()*12:isNYC()?(2+localRand()*4)*nycScale():(5+localRand()*9);let x=xa+i*partW+pad,y=ya+j*partH+pad,w=partW-pad*2-2,h=partH-pad*2-2;
    if(w<12||h<12)continue;
    if(isNYC()&&![ [x+3,y+3],[x+w-3,y+3],[x+3,y+h-3],[x+w-3,y+h-3],[x+w/2,y+h/2] ].every(p=>activeMap==='nyc'?!!nycPreviewBoroughAt(p[0],p[1]):nycLandAt(p[0],p[1])))continue;
    if(localRand()<.25){w*=.76;h*=.87}
    const height=isNYC()?nycSkylineLevels(x+w*.5,y+h*.5,localRand()):1+Math.floor(localRand()*(activeMap==='inland'?7:activeMap==='harbour'?3:4));
    buildings.push({key:ix+':'+iy+':'+i+':'+j,x,y,w,h,locked,roof:Math.floor(localRand()*7),shade:localRand(),height,vent:localRand()<.52,solar:localRand()<.19});
  }
 }
 // Preview future districts in gray on every procedural map, while leaving
 // stage W/H, navigation, spawning, and all saved deployment positions untouched.
 if(!isNYC())for(let iy=0;iy<VIS_YROADS.length-1;iy++)for(let ix=0;ix<VIS_XROADS.length-1;ix++){if(ix===0&&iy%3===0)yield 1;
  if(ix<XROADS.length-1&&iy<YROADS.length-1)continue;
  const localRand=rng((config.seed+Math.imul(ix+1,100003)+Math.imul(iy+1,17837))>>>0);
  const xa=VIS_XROADS[ix]+27,xb=VIS_XROADS[ix+1]-27,ya=VIS_YROADS[iy]+27,yb=VIS_YROADS[iy+1]-27;
  const dw=xb-xa,dh=yb-ya,rv=localRand();if(rv<config.park){parks.push({x:xa,y:ya,w:dw,h:dh,locked:true,trees:[]});continue}
  if(rv<(activeMap==='harbour'?.32:config.park+.075)){lots.push({x:xa,y:ya,w:dw,h:dh,locked:true,angle:localRand()<.5?0:1});continue}
  const cols=localRand()<.45?2:3,rows=localRand()<.6?2:3,partW=dw/cols,partH=dh/rows;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){if(localRand()<.11)continue;
   const pad=5+localRand()*9;let x=xa+i*partW+pad,y=ya+j*partH+pad,w=partW-pad*2-2,h=partH-pad*2-2;
   if(w<12||h<12)continue;if(localRand()<.25){w*=.76;h*=.87}
   buildings.push({key:ix+':'+iy+':'+i+':'+j,x,y,w,h,locked:true,roof:Math.floor(localRand()*7),shade:localRand(),height:1+Math.floor(localRand()*(activeMap==='inland'?7:activeMap==='harbour'?3:4)),vent:false,solar:false});
  }
 }
 // Manhattan uses physical-size rectangular blocks on a rotated island-aligned grid.
 yield* buildManhattanBlocksSteps(config.seed);
 // Landmark towers are authored one by one, rather than inferred from a map image.
 addNYCSkyscrapers();
 // Detail the surrounding boroughs with smaller buildings and real passable alleys.
 // Manhattan uses the distinct fine rectangular street grid above.
 if(activeMap==='nyc'){
  const refined=[];
  for(let bi=0;bi<buildings.length;bi++){if(bi%100===0)yield 1;const b=buildings[bi];if(b.footW||b.w<95||b.h<90){refined.push(b);continue}
   const r=rng((config.seed+Math.floor(b.x)*73+Math.floor(b.y)*137)>>>0);
   if(r()<.38){refined.push(b);continue}
   const cols=b.w>270?3:2,rows=b.h>245?3:2,cellW=b.w/cols,cellH=b.h/rows;
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    if(r()<.11)continue;const gap=Math.max(11,Math.min(24,Math.min(cellW,cellH)*.14));
    const w=cellW-gap,h=cellH-gap,x=b.x+i*cellW+gap*.5,y=b.y+j*cellH+gap*.5;
    if(w<20||h<20||nycEastRiverAt(x+w*.5,y+h*.5)||nycHarlemRiverAt(x+w*.5,y+h*.5)||nycNewtownCreekAt(x+w*.5,y+h*.5))continue;
    if(![[x+3,y+3],[x+w-3,y+3],[x+3,y+h-3],[x+w-3,y+h-3]].every(([px,py])=>nycPreviewBoroughAt(px,py)))continue;
    refined.push({...b,key:b.key+':micro:'+i+':'+j,x,y,w,h,height:Math.max(1,b.height+(r()<.5?-1:1)),shade:r(),vent:r()<.38,solar:r()<.17});
   }
  }
  buildings=refined;
 }
 // Waterfronts appear when the city expands, preserving every earlier downtown block.
 rivers=[];bridges=[];
 if(activeMap==='classic'){if(W>2570)rivers.push({x:2408,w:110,name:'East River'});if(W>3680)rivers.push({x:3412,w:111,name:'Harlem Sound'});}
 else if(isNYC()){ /* NYC coastline is polygon-based, not two artificial river strips. */ }
 else if(activeMap==='nyc_legacy'){rivers.push({x:650,w:105,name:'West waterfront'},{x:1650,w:105,name:'East waterfront'});}
 else if(activeMap==='harbour'){rivers.push({x:1000,w:155,name:'Inner harbor'});if(W>2900)rivers.push({x:2560,w:155,name:'Outer channel'});}

 for(let ri=0;ri<rivers.length;ri++){
  const river=rivers[ri];for(const [roadIndex,y] of YROADS.entries()){if(y<165||y>H-75||(activeMap!=='classic'&&roadIndex%2!==1))continue;const id='B'+ri+'_'+Math.round(y);
    bridges.push({id,type:'bridge',x:river.x-12,y:y-26,w:river.w+24,h:52,hp:145,maxHp:145,river:ri,broken:false})}
 }
 // Bridge endpoints are snapped to the intended borough, not just any coastline.
 // This avoids connecting two sides of Queens or two sides of the Bronx.
 const bridgeBoroughPair={
  'Brooklyn Bridge':['Manhattan','Brooklyn'],'Manhattan Bridge':['Manhattan','Brooklyn'],
  'Williamsburg Bridge':['Manhattan','Brooklyn'],'Queensboro Bridge':['Manhattan','Queens'],
  'Pulaski Bridge':['Queens','Brooklyn'],'Triborough Crossing':['Manhattan','Queens'],
  'Harlem River Bridge':['Manhattan','Bronx'],'University Heights Bridge':['Manhattan','Bronx'],
  'Broadway Bridge':['Manhattan','Bronx'],'Madison Avenue Bridge':['Manhattan','Bronx'],
  'Macombs Dam Bridge':['Manhattan','Bronx'],'Verrazzano Bridge':['Staten Island','Brooklyn']};
 // Buildings cannot be in water or on bridge decks.
  if(isNYC())for(const [name,lon1,lat1,lon2,lat2,required] of NYC_CROSSINGS){
   if(!nycUnlocked(required))continue;
   const pair=bridgeBoroughPair[name]||[null,null],a=nycSnapToBorough(nycProject(lon1,lat1),pair[0]),b=nycSnapToBorough(nycProject(lon2,lat2),pair[1]),pad=activeMap==='nyc'?62:13*nycScale();
   bridges.push({id:'NYC:'+name,name,type:'bridge',ax:a.x,ay:a.y,bx:b.x,by:b.y,
    x:Math.min(a.x,b.x)-pad,y:Math.min(a.y,b.y)-pad,w:Math.abs(a.x-b.x)+2*pad,h:Math.abs(a.y-b.y)+2*pad,
    deckWidth:activeMap==='nyc'?110:42*nycScale(),hp:170,maxHp:170,river:-1,broken:false})}
  if(nycFullCityPreview())for(const [name,lon1,lat1,lon2,lat2,required] of NYC_CROSSINGS){
   if(nycUnlocked(required))continue;
   const pair=bridgeBoroughPair[name]||[null,null],a=nycSnapToBorough(nycProject(lon1,lat1),pair[0]),b=nycSnapToBorough(nycProject(lon2,lat2),pair[1]);
   futureBridges.push({name,ax:a.x,ay:a.y,bx:b.x,by:b.y,deckWidth:activeMap==='nyc'?110:42*nycScale()});
  }
  const reservedBridgeDecks=nycFullCityPreview()?NYC_CROSSINGS.map(([name,lon1,lat1,lon2,lat2])=>{const pair=bridgeBoroughPair[name]||[null,null],a=nycSnapToBorough(nycProject(lon1,lat1),pair[0]),b=nycSnapToBorough(nycProject(lon2,lat2),pair[1]);return{ax:a.x,ay:a.y,bx:b.x,by:b.y,deckWidth:activeMap==='nyc'?110:42*nycScale()}}):bridges;
  buildings=buildings.filter(b=>!rivers.some(r=>b.x<r.x+r.w+6&&b.x+b.w>r.x-6)&&
     !reservedBridgeDecks.some(br=>nycBridgeDistance(b.x+b.w/2,b.y+b.h/2,br)<br.deckWidth/2+(activeMap==='nyc'?30:13*nycScale())));
 if(activeMap!=='classic'){parks=parks.filter(b=>!rivers.some(r=>b.x<r.x+r.w+10&&b.x+b.w>r.x-10));lots=lots.filter(b=>!rivers.some(r=>b.x<r.x+r.w+10&&b.x+b.w>r.x-10));}
 staticMap=document.createElement('canvas');const mapScale=isNYC()?Math.min(.48,3300/W):1;
 staticMap.width=Math.ceil(VIS_W*mapScale);staticMap.height=Math.ceil(VIS_H*mapScale);const c=staticMap.getContext('2d');c.scale(mapScale,mapScale);
 // A flat blue tactical surface keeps the city wholly game-authored and offline.
 c.fillStyle=isNYC()?'#143f61':'#adb6af';c.fillRect(0,0,VIS_W,VIS_H);
 if(isNYC()){
  c.save();c.beginPath();nycCoastPath(c,nycFullCityPreview());c.clip();c.fillStyle='#275a75';c.fillRect(0,0,W,H);
 }
 // small district speckling
 for(let i=0;i<4300;i++){let x=rand()*W,y=rand()*H;c.fillStyle=rand()<.5?'#a8b4ac':'#bbc3b9';c.fillRect(x,y,rand()*6+1,rand()*6+1)}
 if(activeMap==='nyc'){c.save();const coast=NYC_BOROUGHS.find(b=>b.name==='Manhattan').poly,sc=nycScale();
  c.beginPath();c.moveTo(coast[0].x*sc,coast[0].y*sc);for(let i=1;i<coast.length;i++)c.lineTo(coast[i].x*sc,coast[i].y*sc);c.closePath();c.clip();
  c.beginPath();const cp=CENTRAL_PARK_POLY;c.moveTo(cp[0].x*sc,cp[0].y*sc);for(let i=1;i<cp.length;i++)c.lineTo(cp[i].x*sc,cp[i].y*sc);c.closePath();c.fillStyle='#7b9f83';c.fill();c.restore()}
 for(const p of parks){c.fillStyle='#91b19e';c.fillRect(p.x-8,p.y-8,p.w+16,p.h+16);c.strokeStyle='#c6c8b4';c.lineWidth=4;c.strokeRect(p.x-5,p.y-5,p.w+10,p.h+10);c.fillStyle='#b8c8ac';c.fillRect(p.x+p.w*.42,p.y,7,p.h);c.fillRect(p.x,p.y+p.h*.47,p.w,7);for(const t of p.trees){c.fillStyle='#6e9481';c.beginPath();c.arc(t.x+1,t.y+1,t.r+1,0,TAU);c.fill();c.fillStyle='#a3c2a2';c.beginPath();c.arc(t.x-1,t.y-2,t.r*.7,0,TAU);c.fill()}}
 for(const l of lots){c.fillStyle='#aaaead';c.fillRect(l.x-6,l.y-6,l.w+12,l.h+12);c.strokeStyle='#e4e0d0';c.lineWidth=1.5;if(!l.angle){for(let px=l.x+9;px<l.x+l.w;px+=18){c.beginPath();c.moveTo(px,l.y+6);c.lineTo(px,l.y+l.h-6);c.stroke()}}else{for(let py=l.y+9;py<l.y+l.h;py+=18){c.beginPath();c.moveTo(l.x+6,py);c.lineTo(l.x+l.w-6,py);c.stroke()}}}
 // Street surfaces: hide the older square network under the finer Manhattan grid.
 if(activeMap==='nyc'){c.save();c.beginPath();c.rect(0,0,W,H);const coast=NYC_BOROUGHS.find(b=>b.name==='Manhattan').poly;const sc=nycScale();
 c.moveTo(coast[0].x*sc,coast[0].y*sc);for(let i=1;i<coast.length;i++)c.lineTo(coast[i].x*sc,coast[i].y*sc);c.closePath();c.clip('evenodd');}
 // street shoulders and surface
 for(const x of VIS_XROADS){const roadWide=activeMap==='nyc'?18:25*nycScale(),roadCore=activeMap==='nyc'?14:19*nycScale();c.fillStyle='#8f9b9a';c.fillRect(x-roadWide,0,2*roadWide,VIS_H);c.fillStyle='#a3aeaa';c.fillRect(x-roadCore,0,2*roadCore,VIS_H)}
 for(const y of VIS_YROADS){const roadWide=activeMap==='nyc'?18:25*nycScale(),roadCore=activeMap==='nyc'?14:19*nycScale();c.fillStyle='#8f9b9a';c.fillRect(0,y-roadWide,VIS_W,2*roadWide);c.fillStyle='#a3aeaa';c.fillRect(0,y-roadCore,VIS_W,2*roadCore)}
 c.strokeStyle='#cad0c0';c.lineWidth=1;c.setLineDash([9,17]);for(const x of VIS_XROADS){c.beginPath();c.moveTo(x,0);c.lineTo(x,VIS_H);c.stroke()}for(const y of VIS_YROADS){c.beginPath();c.moveTo(0,y);c.lineTo(VIS_W,y);c.stroke()}c.setLineDash([]);
 for(const x of VIS_XROADS)for(const y of VIS_YROADS){c.fillStyle='#9eaaa5';c.fillRect(x-21,y-21,42,42);c.fillStyle='#e1e4d6';for(let k=-16;k<=15;k+=7){c.fillRect(x+k,y-24,3,7);c.fillRect(x+k,y+17,3,7);c.fillRect(x-24,y+k,7,3);c.fillRect(x+17,y+k,7,3)}}
 if(activeMap==='nyc'){c.restore();for(const r of manhattanRoads){c.save();c.translate(r.x,r.y);c.rotate(r.angle);c.fillStyle='#839291';c.fillRect(-r.w*.5,-r.h*.5,r.w,r.h);c.fillStyle='#a1adaa';c.fillRect(-r.w*.5,-r.h*.33,r.w,r.h*.66);c.restore()}}
 const roofs=['#bac2bd','#c7c7bb','#aeb8b5','#ddd8c8','#9caeac','#b3b6b2','#c5cec6'];
 for(const b of buildings){if(b.footW){c.save();c.translate(b.cx,b.cy);c.rotate(b.angle);c.fillStyle='#6c7976';c.fillRect(-b.footW/2+3,-b.footH/2+3,b.footW,b.footH);c.fillStyle=roofs[b.roof];c.fillRect(-b.footW/2,-b.footH/2,b.footW,b.footH);c.strokeStyle='#879c9b';c.lineWidth=1.4;c.strokeRect(-b.footW/2,-b.footH/2,b.footW,b.footH);c.restore();continue}c.fillStyle='#6c7976';c.fillRect(b.x+4,b.y+5,b.w,b.h);c.fillStyle=roofs[b.roof];c.fillRect(b.x,b.y,b.w,b.h);c.strokeStyle='#8a9c9a';c.lineWidth=1.6;c.strokeRect(b.x+.7,b.y+.7,b.w-1.4,b.h-1.4);c.fillStyle='#e4e5d6';c.fillRect(b.x+4,b.y+4,b.w-8,2);c.fillStyle='#829b98';if(b.vent){c.fillRect(b.x+b.w*.24,b.y+b.h*.25,10,7);c.strokeRect(b.x+b.w*.24,b.y+b.h*.25,10,7)}if(b.solar&&b.w>34){c.fillStyle='#667e85';c.fillRect(b.x+b.w*.52,b.y+b.h*.25,Math.max(10,b.w*.24),12);c.strokeStyle='#a5c2c1';c.strokeRect(b.x+b.w*.52,b.y+b.h*.25,Math.max(10,b.w*.24),12)}if(b.w>40&&b.h>27){c.fillStyle='#9daaa4';c.fillRect(b.x+7,b.y+b.h-10,Math.min(13,b.w/5),3)}}
 if(isNYC()){
   c.restore();c.strokeStyle='#d9ddd0';c.lineWidth=3.5;c.beginPath();nycCoastPath(c,nycFullCityPreview());c.stroke();
   drawNYCEastRiver(c);if(activeMap==='nyc'){nycRiverOverlay(c,NYC_HARLEM_RIVER,NYC_HARLEM_WIDTH);nycRiverOverlay(c,NYC_NEWTOWN_CREEK,NYC_NEWTOWN_WIDTH)}
 }
 // Stylized waterways and island bridges, procedurally drawn.
 for(const r of rivers){c.fillStyle='#86b3bd';c.fillRect(r.x-8,0,r.w+16,H);c.fillStyle='#6397a8';c.fillRect(r.x,0,r.w,H);
  c.fillStyle='#a7c8c6';for(let py=19;py<H;py+=61){c.fillRect(r.x+8+((py*11)%27),py,24,2);c.fillRect(r.x+r.w-37,py+22,19,2)}
  c.fillStyle='#ded9bd';c.fillRect(r.x-14,0,5,H);c.fillRect(r.x+r.w+9,0,5,H);
  for(let py=140;py<H;py+=260){c.fillStyle='#8eada9';c.fillRect(r.x-28,py,18,34);c.fillRect(r.x+r.w+10,py+30,18,34)}}
 if(activeMap==='nyc')for(const b of futureBridges){
   const len=Math.hypot(b.bx-b.ax,b.by-b.ay),angle=Math.atan2(b.by-b.ay,b.bx-b.ax);
   c.save();c.translate((b.ax+b.bx)*.5,(b.ay+b.by)*.5);c.rotate(angle);
   c.fillStyle='#717779';c.fillRect(-len*.5,-16,len,32);
   c.fillStyle='#b9bcbc';c.fillRect(-len*.5,-10,len,20);
   c.restore();
 }
 for(const b of bridges){if(isNYC()&&b.ax!==undefined){
   const dx=b.bx-b.ax,dy=b.by-b.ay,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
   c.save();c.translate((b.ax+b.bx)/2,(b.ay+b.by)/2);c.rotate(angle);
   c.fillStyle='#414e56';c.fillRect(-len/2-3,-18,len+6,36);
   c.fillStyle='#b1b6ae';c.fillRect(-len/2,-12,len,24);
   c.strokeStyle='#ece9d1';c.lineWidth=2;c.setLineDash([12,10]);c.beginPath();c.moveTo(-len/2,0);c.lineTo(len/2,0);c.stroke();c.setLineDash([]);
   c.restore();continue}
 c.fillStyle='#53666a';c.fillRect(b.x-7,b.y-7,b.w+14,b.h+14);c.fillStyle='#a4afac';c.fillRect(b.x,b.y,b.w,b.h);c.strokeStyle='#dae1d2';c.lineWidth=3;c.beginPath();c.moveTo(b.x,b.y+4);c.lineTo(b.x+b.w,b.y+4);c.moveTo(b.x,b.y+b.h-4);c.lineTo(b.x+b.w,b.y+b.h-4);c.stroke();c.strokeStyle='#e8d9a0';c.lineWidth=1.5;c.setLineDash([9,12]);c.beginPath();c.moveTo(b.x,b.y+b.h*.5);c.lineTo(b.x+b.w,b.y+b.h*.5);c.stroke();c.setLineDash([])}
 // Labels identify the fictionalized island districts and river crossings.
 c.save();c.textAlign='center';c.font='700 12px Segoe UI';for(const r of rivers){c.translate(r.x+r.w*.5,H*.52);c.rotate(-Math.PI/2);c.fillStyle='#d1eceb';c.fillText(r.name.toUpperCase()+' // WATERWAY',0,0);c.rotate(Math.PI/2);c.translate(-(r.x+r.w*.5),-H*.52)}c.restore();
 // district accents and landmarks
 if(isNYC()){
  c.textAlign='center';c.font='900 24px system-ui';c.fillStyle='#25484f';
  for(const b of NYC_BOROUGHS){if(!nycFullCityPreview()&&!nycUnlocked(b.name))continue;
   const label={Manhattan:[-73.966,40.782],Brooklyn:[-73.957,40.645],Queens:[-73.833,40.760],Bronx:[-73.862,40.863],'Staten Island':[-74.161,40.574]}[b.name];const p=nycProject(...label);c.fillText(b.name.toUpperCase(),p.x,p.y)}
  c.font='700 11px system-ui';c.fillStyle='#3a6668';
  for(const l of NYC_PLACES){const p=nycProject(l.lon,l.lat);if((activeMap==='nyc'?nycPreviewBoroughAt(p.x,p.y):nycLandAt(p.x,p.y)))c.fillText(l.name,p.x,p.y)}
 }else{c.strokeStyle='#e8e6da';c.lineWidth=2;c.setLineDash([5,5]);c.strokeRect(1045,565,320,305);c.setLineDash([])}
 for(let k=0;k<10;k++){const x=170+rand()*2050,y=115+rand()*1290;if(isNYC()&&!nycLandAt(x,y))continue;c.fillStyle='#5c9089';c.fillRect(x,y,2.5,2.5)}
 if(scenarioIndex>0&&!isNYC()){const oldX=config.x.at(-1)+77,oldY=config.y.at(-1)+34;c.strokeStyle='#7bcbbf';c.lineWidth=5;c.setLineDash([20,13]);c.beginPath();c.moveTo(oldX,0);c.lineTo(oldX,oldY);c.lineTo(0,oldY);c.stroke();c.setLineDash([])}
 if(!isNYC()&&(VIS_W>W||VIS_H>H)){
  c.save();c.fillStyle='#767e8490';c.fillRect(W,0,VIS_W-W,VIS_H);c.fillRect(0,H,W,VIS_H-H);
  c.strokeStyle='#9cb1b5';c.lineWidth=5;c.setLineDash([30,18]);c.strokeRect(0,0,W,H);c.setLineDash([]);c.restore();
 }
 // Desaturate future boroughs in the cached 2D map. Geometry still exists;
 // this is strictly a visual mask, never an unlocking/navigation change.
 if(nycFullCityPreview())for(const borough of NYC_BOROUGHS){
   if(nycUnlockFraction(borough.name)>=1)continue;
   c.save();c.beginPath();const poly=borough.poly,sc=nycScale();
   c.moveTo(poly[0].x*sc,poly[0].y*sc);
   for(let i=1;i<poly.length;i++)c.lineTo(poly[i].x*sc,poly[i].y*sc);
   c.closePath();c.clip();
   let grayX=0,grayY=0,grayW=W,grayH=H;const fraction=nycUnlockFraction(borough.name),bounds=nycBoroughBox(borough.name),axis=NYC_AXIS[borough.name];
   if(fraction>0&&activeMap==='nyc'){
    if(axis==='south'){grayH=(bounds.bottom-(bounds.bottom-bounds.top)*fraction)*sc;}
    else if(axis==='east'){grayW=(bounds.right-(bounds.right-bounds.left)*fraction)*sc;}
    else {grayX=(bounds.left+(bounds.right-bounds.left)*fraction)*sc;grayW=W-grayX;}
   }
   c.globalCompositeOperation='saturation';c.fillStyle='#888888';c.fillRect(grayX,grayY,grayW,grayH);
   c.globalCompositeOperation='source-over';c.fillStyle='#4b53604b';c.fillRect(grayX,grayY,grayW,grayH);
   c.restore();
 }
 rebuildBuildingGrid()
 if(world3D.ready)world3D.needsBuild=true;
}

function waterAt(x,y,pad=0){if(isNYC()){
  if(nycLandAt(x,y))return false;
  for(const b of bridges)if(b.hp>0&&nycBridgeDistance(x,y,b)<b.deckWidth/2-Math.min(pad,7))return false;
  return true;
 }for(const r of rivers){if(x>=r.x-pad&&x<=r.x+r.w+pad){
 let crossing=false;for(const b of bridges){if(b.river!==rivers.indexOf(r)||b.hp<=0)continue;if(y>=b.y+pad&&y<=b.y+b.h-pad&&x>=b.x&&x<=b.x+b.w){crossing=true;break}}
 if(!crossing)return true}}
 return false}
function walkable(x,y,pad=3){return x>8&&y>8&&x<W-8&&y<H-8&&!collidesBuilding(x,y,pad)&&!waterAt(x,y,pad)}
function refreshNavigation(){navCols=Math.ceil(W/NAV_STEP);navRows=Math.ceil(H/NAV_STEP);navWalk=new Uint8Array(navCols*navRows);for(let iy=0;iy<navRows;iy++)for(let ix=0;ix<navCols;ix++)navWalk[ix+iy*navCols]=walkable((ix+.5)*NAV_STEP,(iy+.5)*NAV_STEP,2)?1:0;navCache.clear();navVersion++}
function nearestNav(x,y){const gx=clamp(Math.floor(x/NAV_STEP),0,navCols-1),gy=clamp(Math.floor(y/NAV_STEP),0,navRows-1);let idx=gx+gy*navCols;if(navWalk[idx])return idx;
 for(let d=1;d<=12;d++)for(let ox=-d;ox<=d;ox++)for(let oy=-d;oy<=d;oy++){if(Math.max(Math.abs(ox),Math.abs(oy))!==d)continue;const nx=gx+ox,ny=gy+oy;if(nx<0||ny<0||nx>=navCols||ny>=navRows)continue;idx=nx+ny*navCols;if(navWalk[idx])return idx}return -1}
function navField(x,y,key){if(!navWalk)return null;const root=nearestNav(x,y);if(root<0)return null;key=key||('n'+root);const cacheKey=key+':'+root;let cached=navCache.get(cacheKey);if(cached)return cached
 const len=navWalk.length,steps=new Int8Array(len);steps.fill(-1);const queue=new Int32Array(len);let head=0,tail=1;steps[root]=8;queue[0]=root;
 while(head<tail&&(activeMap!=='nyc'||head<125000)){const idx=queue[head++],x0=idx%navCols,y0=(idx-x0)/navCols;
  for(let d=0;d<8;d++){const off=navOffsets[d],nx=x0+off[0],ny=y0+off[1];if(nx<0||ny<0||nx>=navCols||ny>=navRows)continue;const j=nx+ny*navCols;if(!navWalk[j]||steps[j]!==-1)continue;
   if(d>=4&&(!navWalk[(x0+off[0])+y0*navCols]||!navWalk[x0+(y0+off[1])*navCols]))continue;
   steps[j]=[1,0,3,2,7,6,5,4][d]; // reverse neighbor direction, including correct diagonals
   queue[tail++]=j}}
 cached={root,steps};navCache.set(cacheKey,cached);if(navCache.size>(activeMap==='nyc'?6:48))navCache.delete(navCache.keys().next().value);return cached}
function navigationHeading(agent,target,key){const dx=target.x-agent.x,dy=target.y-agent.y,d=Math.hypot(dx,dy)||1;
 if(isNYC()&&!key){const source=nycBoroughAt(agent.x,agent.y),destination=nycBoroughAt(target.x,target.y);
  if(source&&destination&&source!==destination){let choice=null,score=Infinity;
   for(const b of bridges){if(b.hp<=0||b.ax===undefined)continue;
    const sides=[[{x:b.ax,y:b.ay},{x:b.bx,y:b.by}],[{x:b.bx,y:b.by},{x:b.ax,y:b.ay}]];
    for(const [near,far] of sides){if(nycBoroughAt(near.x,near.y)!==source||nycBoroughAt(far.x,far.y)!==destination)continue;
     const s=Math.hypot(near.x-agent.x,near.y-agent.y)+Math.hypot(far.x-target.x,far.y-target.y)+Math.hypot(far.x-near.x,far.y-near.y);
     if(s<score){score=s;choice={near,far}}}}
   if(choice&&Math.hypot(choice.near.x-agent.x,choice.near.y-agent.y)>42){const ndx=choice.near.x-agent.x,ndy=choice.near.y-agent.y,n=Math.hypot(ndx,ndy)||1;return{x:ndx/n,y:ndy/n}}
   if(choice){const ndx=choice.far.x-agent.x,ndy=choice.far.y-agent.y,n=Math.hypot(ndx,ndy)||1;return{x:ndx/n,y:ndy/n}}
  }}
 if(d<NAV_STEP*2&&walkable((agent.x+target.x)/2,(agent.y+target.y)/2,2))return{x:dx/d,y:dy/d};
 if(!key&&d<180&&clearCorridor(agent.x,agent.y,target.x,target.y))return{x:dx/d,y:dy/d};
 // No direct water crossing: flow across an intact bridge, or remain on this bank.
 if(!key)for(let ri=0;ri<rivers.length;ri++){const r=rivers[ri],left=Math.min(agent.x,target.x),right=Math.max(agent.x,target.x);if(left<r.x-5&&right>r.x+r.w+5){
  let best=null,score=Infinity;for(const b of bridges){if(b.river!==ri||b.hp<=0)continue;const q=Math.abs(agent.y-(b.y+b.h/2))+Math.abs(target.y-(b.y+b.h/2))*.6;if(q<score){score=q;best=b}}
  if(best)return navigationHeading(agent,{x:best.x+best.w/2,y:best.y+best.h/2},'bridge-'+best.id)
 }}
 const useNav=!!key; // field sharing is reserved for shared goals; per-agent paths would thrash the cache
 if(useNav){const flow=navField(target.x,target.y,key);if(flow){const ix=Math.floor(agent.x/NAV_STEP),iy=Math.floor(agent.y/NAV_STEP),idx=ix+iy*navCols;
  if(ix>=0&&iy>=0&&ix<navCols&&iy<navRows){const dir=flow.steps[idx];if(dir>=0&&dir<8){const o=navOffsets[dir],hx=(ix+o[0]+.5)*NAV_STEP,hy=(iy+o[1]+.5)*NAV_STEP,rx=hx-agent.x,ry=hy-agent.y,n=Math.hypot(rx,ry)||1;return{x:rx/n,y:ry/n}}}}
 }
 return{x:dx/d,y:dy/d}}
function localFlock(p,grid,radius=20,cap=9){let sx=0,sy=0,ax=0,ay=0,n=0;const gx=Math.floor(p.x/CELL),gy=Math.floor(p.y/CELL),rr=radius*radius;
 outer:for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const bucket=grid.get(gx+ox+(gy+oy)*GRIDCOLS);if(!bucket)continue;const len=Math.min(bucket.length,13),offset=(p.id||0)%Math.max(1,bucket.length);
 for(let k=0;k<len;k++){const q=bucket[(k+offset)%bucket.length];if(q===p||q.alive===false)continue;const dx=p.x-q.x,dy=p.y-q.y,d2=dx*dx+dy*dy;if(d2>rr)continue;
  if(d2<.004){const a=((Math.min(p.id,q.id)*131+Math.max(p.id,q.id)*37)%360)*Math.PI/180,sign=p.id<q.id?1:-1;sx+=Math.cos(a)*sign*1.3;sy+=Math.sin(a)*sign*1.3;ax+=(q.vx||0);ay+=(q.vy||0);if(++n>=cap)break outer;continue}
  const d=Math.sqrt(d2);const push=Math.pow((radius-d)/radius,1.15);sx+=dx/d*push;sy+=dy/d*push;ax+=(q.vx||0);ay+=(q.vy||0);if(++n>=cap)break outer}}
 return n?{x:clamp(sx,-1.5,1.5),y:clamp(sy,-1.5,1.5),ax:ax/n,ay:ay/n,count:n}:{x:0,y:0,ax:0,ay:0,count:0}}
// Cheap, cached corner waypoints are activated only when an agent is trapped.
// Shared target flow fields remain intact, keeping 200k population statistics cheap.
function segmentClear(ax,ay,bx,by,pad=3){const d=Math.hypot(bx-ax,by-ay);const count=Math.max(1,Math.ceil(d/Math.max(8,Math.min(30,NAV_STEP*.35))));
 for(let i=1;i<=count;i++){const f=i/count;if(!walkable(ax+(bx-ax)*f,ay+(by-ay)*f,pad))return false}return true}
function collisionBuildingAt(x,y,pad=3){const gx=Math.floor(x/CELL),gy=Math.floor(y/CELL);
 for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
  const bucket=buildingGrid.get(gx+ox+(gy+oy)*GRIDCOLS)||[];
  for(const b of bucket)if(!b.collapsed&&manhattanBuildingContains(b,x,y,pad))return b;
 }return null;
}
function obstacleDetour(p,goal){
 const dx=goal.x-p.x,dy=goal.y-p.y,length=Math.hypot(dx,dy)||1;
 let b=null;for(const d of [14,32,60,110,185,310]){const v=Math.min(d,length-.001);
  if(v<=0)break;b=collisionBuildingAt(p.x+dx/length*v,p.y+dy/length*v,4);if(b)break}
 if(!b)return null;
 const margin=13,corners=b.footW?(()=>{const co=Math.cos(b.angle),si=Math.sin(b.angle),w=b.footW*.5+margin,h=b.footH*.5+margin;
  return [[-w,-h],[w,-h],[w,h],[-w,h]].map(([qx,qy])=>({x:b.cx+qx*co-qy*si,y:b.cy+qx*si+qy*co}))})():
  [{x:b.x-margin,y:b.y-margin},{x:b.x+b.w+margin,y:b.y-margin},{x:b.x+b.w+margin,y:b.y+b.h+margin},{x:b.x-margin,y:b.y+b.h+margin}];
 let best=null,bestCost=Infinity;
 for(let a=0;a<4;a++)for(let c=0;c<4;c++)for(const dir of [-1,1]){
  if(!segmentClear(p.x,p.y,corners[a].x,corners[a].y,2)||!segmentClear(corners[c].x,corners[c].y,goal.x,goal.y,2))continue;
  const path=[corners[a]];let k=a,valid=true;
  while(k!==c){let j=(k+dir+4)%4;
   if(!segmentClear(corners[k].x,corners[k].y,corners[j].x,corners[j].y,2)){valid=false;break}
   path.push(corners[j]);k=j;if(path.length>4){valid=false;break}}
  if(!valid)continue;let cost=Math.hypot(path[0].x-p.x,path[0].y-p.y)+Math.hypot(goal.x-path.at(-1).x,goal.y-path.at(-1).y);
  for(let i=1;i<path.length;i++)cost+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
  if(cost<bestCost){bestCost=cost;best=path}
 }
 return best;
}
function cornerEscape(p,goal){const dx=goal.x-p.x,dy=goal.y-p.y,d=Math.hypot(dx,dy)||1;
 const bx=p.x+dx/d*Math.min(d,Math.max(28,NAV_STEP*.95)),by=p.y+dy/d*Math.min(d,Math.max(28,NAV_STEP*.95));
 let b=collisionBuildingAt(bx,by,4);
 if(!b)for(const d2 of [12,26,48,85,125,180]){
  b=collisionBuildingAt(p.x+dx/d*d2,p.y+dy/d*d2,5);if(b)break;
 }
 let candidates=[];
 if(b){if(b.footW){const co=Math.cos(b.angle),si=Math.sin(b.angle),w=b.footW*.5+16,h=b.footH*.5+16;
  for(const xx of [-w,w])for(const yy of [-h,h])candidates.push({x:b.cx+xx*co-yy*si,y:b.cy+xx*si+yy*co,corner:true});
 }else{for(const xx of [b.x-16,b.x+b.w+16])for(const yy of [b.y-16,b.y+b.h+16])candidates.push({x:xx,y:yy,corner:true})}}
 if(!b){const n={x:dy/d,y:-dx/d};for(const sign of [-1,1])for(const radius of [28,55,105,185])candidates.push({x:p.x+n.x*radius*sign+dx/d*15,y:p.y+n.y*radius*sign+dy/d*15});}
 let best=null,score=Infinity;
 for(const c of candidates){if(!walkable(c.x,c.y,4)||!segmentClear(p.x,p.y,c.x,c.y,2))continue;
  const toward=Math.hypot(c.x-goal.x,c.y-goal.y),step=Math.hypot(c.x-p.x,c.y-p.y);
  if(step<16)continue;const s=toward*.42+step*.52+(p.previousDetour&&Math.hypot(c.x-p.previousDetour.x,c.y-p.previousDetour.y)<22?160:0);
  if(s<score){score=s;best=c}}
 return best;
}
function steerAgent(p,goal,speed,dt,grid,kind,key){if(!goal)return false;
 const intended=goal;
 if(kind!=='air'){
  if(p.detourPath?.length){while(p.detourPath.length&&Math.hypot(p.x-p.detourPath[0].x,p.y-p.detourPath[0].y)<15)p.detourPath.shift();
   if(!p.detourPath.length)p.detourPath=null}
  const tracking=p.detourPath?.[0]||goal;
  const curD=Math.hypot(tracking.x-p.x,tracking.y-p.y);
  if(!Number.isFinite(p.progressBest)||Math.hypot(tracking.x-(p.progressGoalX||0),tracking.y-(p.progressGoalY||0))>26){
   p.progressBest=curD;p.progressTime=0;p.progressGoalX=tracking.x;p.progressGoalY=tracking.y;
  }else if(curD<p.progressBest-4){p.progressBest=curD;p.progressTime=0}
  else p.progressTime=(p.progressTime||0)+dt;
  if(p.progressTime>(p.detourPath?2.8:.92)&&detourBudget>=1){
   detourBudget--;const route=obstacleDetour(p,intended);
   if(route?.length){p.detourPath=route;p.detour=null}
   else if(!p.detourPath){const detour=cornerEscape(p,intended);if(detour)p.detourPath=[detour]}
   else p.detourPath=null;
   p.progressTime=0;p.progressBest=Infinity;
  }
 }
 const tracking=p.detourPath?.[0]||goal,detouring=!!p.detourPath?.length;
 const head=navigationHeading(p,tracking,detouring?null:key),flock=localFlock(p,grid,kind==='zombie'?30:kind==='air'?90:kind==='tank'?34:17,kind==='civilian'?6:12);
 const weight=kind==='zombie'?.89:kind==='civilian'?.60:kind==='air'?.8:.7;
 let dx=head.x+flock.x*weight+flock.ax*.10,dy=head.y+flock.y*weight+flock.ay*.10;
 const norm=Math.hypot(dx,dy)||1;dx/=norm;dy/=norm;let smooth=clamp(dt*(kind==='zombie'?12:kind==='air'?3.5:7),.12,.9);
 p.vx=(p.vx||dx)*(1-smooth)+dx*smooth;p.vy=(p.vy||dy)*(1-smooth)+dy*smooth;
 let m=Math.hypot(p.vx,p.vy)||1,vx=p.vx/m,vy=p.vy/m;
 let step=Math.min(speed*dt,kind==='tank'?6:8),px=clamp(p.x+vx*step,9,W-9),py=clamp(p.y+vy*step,9,H-9);
 if(kind==='air'){p.x=px;p.y=py;return true}
 if(walkable(px,py,kind==='tank'?6:2)&&!zoneBoundaryBlocked(p,{x:px,y:py},kind==='civilian'?'civilian':kind==='zombie'?'zombie':'soldier')){p.x=px;p.y=py;p.stuckTime=0;return true}
 // Collision aware sliding lets flocks squeeze through alleys instead of merging through walls.
 const mx=clamp(p.x+vx*step,9,W-9),my=clamp(p.y+vy*step,9,H-9);
 if(walkable(mx,p.y,2)&&!zoneBoundaryBlocked(p,{x:mx,y:p.y},kind==='civilian'?'civilian':kind==='zombie'?'zombie':'soldier')){p.x=mx;p.vy*=.55;p.stuckTime=0;return true}
 if(walkable(p.x,my,2)&&!zoneBoundaryBlocked(p,{x:p.x,y:my},kind==='civilian'?'civilian':kind==='zombie'?'zombie':'soldier')){p.y=my;p.vx*=.55;p.stuckTime=0;return true}
 // Probe two lateral detours; occasional side choice prevents permanent block jams.
 const side=(p.id%2===0?1:-1),opts=[[head.y*side,-head.x*side],[-head.y*side,head.x*side]];
 for(const [ox,oy] of opts){let nx=p.x+ox*step*.8,ny=p.y+oy*step*.8;if(walkable(nx,ny,2)&&!zoneBoundaryBlocked(p,{x:nx,y:ny},kind==='civilian'?'civilian':kind==='zombie'?'zombie':'soldier')){p.x=nx;p.y=ny;p.stuckTime=0;return true}}
 p.stuckTime=(p.stuckTime||0)+dt;if(p.stuckTime>.24&&!detouring&&kind!=='air'&&detourBudget>=1){detourBudget--;const route=obstacleDetour(p,intended);if(route?.length)p.detourPath=route;else{const escape=cornerEscape(p,intended);if(escape)p.detourPath=[escape]}p.stuckTime=0}
 p.vx*=.5;p.vy*=.5;return false}
function damageBridges(x,y,range,damage){let hit=0;for(const b of bridges){if(b.hp<=0||rectDistance(x,y,b)>range)continue;b.hp=Math.max(0,b.hp-damage);hit++;if(b.hp===0){b.broken=true;refreshNavigation();log('Bridge crossing collapsed — water now blocks ground traffic.');notify('BRIDGE DOWN · ground route severed!',true);effects.push({type:'blast',x:b.x+b.w/2,y:b.y+b.h/2,r:8,max:75,life:1,maxLife:1})}}return hit}

function nearestIndex(arr,val){let best=0,d=Infinity;for(let i=0;i<arr.length;i++){const a=Math.abs(arr[i]-val);if(a<d){d=a;best=i}}return best}
function nodeIndex(x,y){return nearestIndex(YROADS,y)*XROADS.length+nearestIndex(XROADS,x)}
function nodePoint(index){const nx=index%XROADS.length,ny=Math.floor(index/XROADS.length);return{x:XROADS[nx],y:YROADS[ny]}}
function routeBetween(ax,ay,bx,by){
 // Constant-time road routing. No per-agent Dijkstra allocations at 8,000+ civilians.
 let ai=nearestIndex(XROADS,ax),aj=nearestIndex(YROADS,ay),bi=nearestIndex(XROADS,bx),bj=nearestIndex(YROADS,by);
 const route=[];const push=(x,y)=>{let q=route[route.length-1];if(!q||Math.hypot(x-q.x,y-q.y)>2)route.push({x,y})};
 if(Math.abs(ay-YROADS[aj])<Math.abs(ax-XROADS[ai]))push(XROADS[ai],ay);else push(ax,YROADS[aj]);
 push(XROADS[ai],YROADS[aj]);
 if((ai+aj+bi+bj)%2){push(XROADS[bi],YROADS[aj]);push(XROADS[bi],YROADS[bj])}
 else{push(XROADS[ai],YROADS[bj]);push(XROADS[bi],YROADS[bj])}
 if(Math.abs(by-YROADS[bj])<Math.abs(bx-XROADS[bi]))push(bx,YROADS[bj]);else push(XROADS[bi],by);
 push(bx,by);return route;
}
function eachNearby(grid,x,y,range,callback){const a=Math.floor((x-range)/CELL),b=Math.floor((x+range)/CELL),c=Math.floor((y-range)/CELL),d=Math.floor((y+range)/CELL);for(let gy=c;gy<=d;gy++)for(let gx=a;gx<=b;gx++){const bucket=grid.get(gx+gy*GRIDCOLS);if(bucket)for(const v of bucket)callback(v)}}
const aliveEntity=v=>v.alive;
function rebuildGrid(grid,items,keep=aliveEntity){
 // Reuse buckets from the prior frame instead of creating thousands of tiny
 // arrays on every simulation slice. This substantially reduces GC pauses.
 const keys=grid._activeKeys||(grid._activeKeys=[]);
 for(let i=0;i<keys.length;i++){const bucket=grid.get(keys[i]);if(bucket)bucket.length=0}
 let used=0;
 for(const v of items){if(!keep(v))continue;const key=Math.floor(v.x/CELL)+Math.floor(v.y/CELL)*GRIDCOLS;let bucket=grid.get(key);if(!bucket){bucket=[];grid.set(key,bucket)}if(bucket.length===0)keys[used++]=key;bucket.push(v)}
 keys.length=used;
}
const activeUnit=u=>u.alive!==false&&u.hp>0&&!u.departed;
const activeBeacon=u=>u.type==='beacon'&&activeUnit(u);
function compactInPlace(items,keep){let write=0;for(let read=0;read<items.length;read++){const item=items[read];if(keep(item))items[write++]=item}items.length=write}
function ageTransient(items,dt){let write=0;for(let read=0;read<items.length;read++){const item=items[read];item.life-=dt;if(item.life>0)items[write++]=item}items.length=write}
function collidesBuilding(x,y,pad=3){const bucket=buildingGrid.get(Math.floor(x/CELL)+Math.floor(y/CELL)*GRIDCOLS);if(!bucket)return false;for(const b of bucket)if(!b.collapsed&&manhattanBuildingContains(b,x,y,pad))return true;return false}
function roadSafe(x,y){x=clamp(x,26,W-26);y=clamp(y,26,H-26);if(walkable(x,y,3))return{x,y};const nav=nearestNav(x,y);if(nav>=0)return{x:((nav%navCols)+.5)*NAV_STEP,y:(Math.floor(nav/navCols)+.5)*NAV_STEP};return{x:XROADS[0],y:YROADS[0]}}
function zoneVertices(z){return Array.isArray(z.verts)&&z.verts.length>=3?z.verts:[{x:z.x,y:z.y},{x:z.x+z.w,y:z.y},{x:z.x+z.w,y:z.y+z.h},{x:z.x,y:z.y+z.h}]}
function zoneArea(z){const a=zoneVertices(z);let area=0;for(let i=0;i<a.length;i++){const p=a[i],q=a[(i+1)%a.length];area+=p.x*q.y-q.x*p.y}return Math.abs(area)*.5}
function polyContains(x,y,v){let yes=false;for(let i=0,j=v.length-1;i<v.length;j=i++){const a=v[i],b=v[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes}return yes}
function closestPolyEdge(x,y,z){const v=zoneVertices(z);let best=null,d=Infinity;for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length],dx=b.x-a.x,dy=b.y-a.y,ln=dx*dx+dy*dy||1,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/ln,0,1),px=a.x+dx*t,py=a.y+dy*t,dd=Math.hypot(x-px,y-py);if(dd<d){d=dd;best={a,b,x:px,y:py,d,idx:i,t,len:Math.sqrt(ln)}}}return best}
function zoneCenter(z){const v=zoneVertices(z);let x=0,y=0;for(const p of v){x+=p.x;y+=p.y}return{x:x/v.length,y:y/v.length}}
function zoneCapacity(z){return Math.max(9000,Math.floor(zoneArea(z)/2.1))}
function gateForZone(z){return gates.filter(g=>g.zoneId===z.id)}
function gateHasSpace(g,weight){return (g.flowTokens??GATE_FLOW_BURST)+.001>=weight}
// Stable, lightly staggered positions behind each gate avoid stacking all
// weighted civilian groups into a single visual point on the threshold.
function gateQueueStand(g,rank){
 const row=Math.floor(rank/7),lane=(rank%7)-3;
 const outward=gateOutside(g,26+Math.min(row,22)*5.5);
 const tangent=g.side==='poly'?{x:-(g.ny||0),y:g.nx||0}:g.side==='left'||g.side==='right'?{x:0,y:1}:{x:1,y:0};
 const wav=Math.sin(rank*2.399)*2.3;
 const candidate={x:clamp(outward.x+tangent.x*(lane*6.5+wav),8,W-8),
                  y:clamp(outward.y+tangent.y*(lane*6.5+wav),8,H-8)};
 if(walkable(candidate.x,candidate.y,2))return candidate;
 const near=gateOutside(g,25+Math.min(row%5,4)*4);
 const alternate={x:clamp(near.x+tangent.x*lane*3.2,8,W-8),y:clamp(near.y+tangent.y*lane*3.2,8,H-8)};
 return walkable(alternate.x,alternate.y,2)?alternate:gateOutside(g,23)
}
function gateFlowTick(dt){
 for(const g of gates){
  const burst=gateFlowBurst(g);
  g.flowTokens=Math.min(burst,(g.flowTokens??burst)+gateFlowRate(g)*dt);
  g.waiting=0;g.queueGroups=0;
 }
 // One O(civilians) pass, not one scan per gate. Weighted groups contribute
 // their entire passenger count; no new simulated entities are allocated.
 for(const p of people){
  if(!p.alive||p.sheltered||!p.targetGate||p.panic>0)continue;
  const g=p.targetGate;if(!g||g.zoneId==null)continue;
  const d=Math.hypot(p.x-g.x,p.y-g.y);
  if((p.entering&&d<170)||d<85){p.queueRank=g.queueGroups++;g.waiting+=p.weight}
 }
}
function minefieldAt(x,y,margin=0){return defenses.some(u=>u.type==='minefield'&&u.hp>0&&Math.hypot(u.x-x,u.y-y)<(u.range||66)+margin)}
function safeWavePoint(x,y,margin=12){
 return walkable(x,y,3)&&!zones.some(z=>z.hp>0&&isInZone(x,y,z,margin))&&!minefieldAt(x,y,36);
}
function safeWaveOrigin(avoid=[]){
 for(let n=0;n<110;n++){const p=roadSpawn(Math.random);if(safeWavePoint(p.x,p.y,28)&&avoid.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>Math.max(360,Math.min(W,H)*.13)))return p}
 // Rare near-saturation fallback; intentionally never return a coordinate in a shelter.
 for(let gy=25;gy<H-25;gy+=24)for(let gx=25;gx<W-25;gx+=24){if(safeWavePoint(gx,gy,20)&&avoid.every(q=>Math.hypot(gx-q.x,gy-q.y)>260))return{x:gx,y:gy}}
 return null;
}
function safeWaveCohortPoint(origin){
 for(let tries=0;tries<16;tries++){
  const p=roadSafe(origin.x+rnd(-48,48),origin.y+rnd(-48,48));
  if(safeWavePoint(p.x,p.y,7))return p;
 }
 return safeWaveOrigin();
}
function gateOutside(g,d=24){if(g.side==='poly')return{x:g.x+(g.nx||0)*d,y:g.y+(g.ny||0)*d};return{x:g.x+(g.side==='left'?-d:g.side==='right'?d:0),y:g.y+(g.side==='top'?-d:g.side==='bottom'?d:0)}}
function gateInside(g,d=24){if(g.side==='poly')return{x:g.x-(g.nx||0)*d,y:g.y-(g.ny||0)*d};return{x:g.x+(g.side==='left'?d:g.side==='right'?-d:0),y:g.y+(g.side==='top'?d:g.side==='bottom'?-d:0)}}
function nearestGate(z,x,y){let best=null,d=Infinity;for(const g of gates){if(g.zoneId!==z.id)continue;const ds=(g.x-x)**2+(g.y-y)**2;if(ds<d){d=ds;best=g}}return best}
function zoneApproach(z,x,y){const g=nearestGate(z,x,y);if(g)return roadSafe(gateOutside(g).x,gateOutside(g).y);const candidates=z.verts?zoneVertices(z).map((p,i)=>{const q=zoneVertices(z)[(i+1)%zoneVertices(z).length],mid={x:(p.x+q.x)/2,y:(p.y+q.y)/2},edge=closestPolyEdge(mid.x,mid.y,z),nx=(q.y-p.y)/Math.max(1,edge.len),ny=-(q.x-p.x)/Math.max(1,edge.len),out=isInZone(mid.x+nx*8,mid.y+ny*8,z)?-1:1;return{x:mid.x+nx*out*22,y:mid.y+ny*out*22}}):[{x:z.x-17,y:clamp(y,z.y,z.y+z.h)},{x:z.x+z.w+17,y:clamp(y,z.y,z.y+z.h)},{x:clamp(x,z.x,z.x+z.w),y:z.y-17},{x:clamp(x,z.x,z.x+z.w),y:z.y+z.h+17}];candidates.sort((a,b)=>(a.x-x)**2+(a.y-y)**2-(b.x-x)**2-(b.y-y)**2);return roadSafe(candidates[0].x,candidates[0].y)}
function addGate(x,y,free=false,zoneOverride=null){if(!free&&phase!=='planning'){notify('Gates must be installed before the outbreak.',true);return null}let best=zoneOverride,bd=Infinity;for(const z of zones){if(z.hp<=0)continue;let d=rectDistance(x,y,z);if(d<bd){best=z;bd=d}}
 if(!best||(!zoneOverride&&bd>75)){if(!free)notify('Place gates on a safe-zone perimeter.',true);return null}
 if(best.verts)return addPolyGate(best,x,y,free);
 const z=best,edges=[{side:'top',d:Math.abs(y-z.y)},{side:'bottom',d:Math.abs(y-(z.y+z.h))},{side:'left',d:Math.abs(x-z.x)},{side:'right',d:Math.abs(x-(z.x+z.w))}];edges.sort((a,b)=>a.d-b.d);let side=edges[0].side;
 const gx=side==='left'?z.x:side==='right'?z.x+z.w:clamp(x,z.x+21,z.x+z.w-21),gy=side==='top'?z.y:side==='bottom'?z.y+z.h:clamp(y,z.y+21,z.y+z.h-21);
 // Select a doorway with a genuinely clear passage, even if the tapped edge abuts a building.
 const gateCandidate=(edge,cx,cy,reach)=>{const p={x:cx,y:cy,side:edge};
 const outside=gateOutside(p,22),roadDist=Math.min(Math.abs(XROADS[nearestIndex(XROADS,outside.x)]-outside.x),Math.abs(YROADS[nearestIndex(YROADS,outside.y)]-outside.y),manhattanRoadDistance(outside.x,outside.y));
 if(roadDist>30||!walkable(outside.x,outside.y,4))return false;
 for(let d=-reach;d<=reach;d+=7){const n={x:cx+(edge==='left'?1:edge==='right'?-1:0)*d,y:cy+(edge==='top'?1:edge==='bottom'?-1:0)*d};if(!walkable(n.x,n.y,4))return false}return true};
 let openX=gx,openY=gy,chosenSide=side,bestScore=Infinity;
 const tryEdges=range=>{for(const edge of ['top','right','bottom','left']){
  const lo=edge==='left'||edge==='right'?z.y+22:z.x+22,hi=edge==='left'||edge==='right'?z.y+z.h-22:z.x+z.w-22;
  for(let val=lo;val<=hi;val+=12){const cx=edge==='left'?z.x:edge==='right'?z.x+z.w:val,cy=edge==='top'?z.y:edge==='bottom'?z.y+z.h:val;
   const score=Math.hypot(cx-x,cy-y);if(score>=bestScore||!gateCandidate(edge,cx,cy,range))continue;
   openX=cx;openY=cy;chosenSide=edge;bestScore=score
  }
 }};
 tryEdges(78);if(bestScore===Infinity)tryEdges(35);
 if(bestScore===Infinity&&!free){notify('Gates need a clear ROAD-ADJACENT perimeter. Move the shelter or choose a roadside edge.',true);return null}
 side=chosenSide;const gateX=openX,gateY=openY;
 if(gates.some(g=>g.zoneId===z.id&&Math.hypot(g.x-gateX,g.y-gateY)<42)){if(!free)notify('Move the new gate farther from another entrance.',true);return null}
 const cost=110;if(!free&&budget<cost){notify('Not enough funds for a shelter gate.',true);return null}if(!free)budget-=cost;
 const g={id:unitId++,type:'gate',zoneId:z.id,side,x:gateX,y:gateY,w:36,level:1,hp:265,maxHp:265,price:free?0:cost,pressure:0,flowTokens:GATE_FLOW_BURST,entered:0,waiting:0};gates.push(g);
 if(!free){selected=g;notify('Shelter gate placed. Civilians use entrances; zombies may attack them.');effectSound('deploy');saveCampaign();renderUI(true)}return g
}
function addPolyGate(z,x,y,free=false){
 const edge=closestPolyEdge(x,y,z);if(edge.d>85||edge.len<55){if(!free)notify('Choose a longer safe-zone edge.',true);return null}
 const dx=(edge.b.x-edge.a.x)/edge.len,dy=(edge.b.y-edge.a.y)/edge.len;
 const candidateT=[edge.t,.5,.32,.68,.2,.8].filter((t,i,v)=>v.indexOf(t)===i),cost=110;
 let spot=null;for(const t of candidateT){const clamped=clamp(t,22/edge.len,1-22/edge.len),xx=edge.a.x+(edge.b.x-edge.a.x)*clamped,yy=edge.a.y+(edge.b.y-edge.a.y)*clamped;
  let nx=dy,ny=-dx;if(isInZone(xx+nx*8,yy+ny*8,z)){nx=-nx;ny=-ny}
  const g={x:xx,y:yy,nx,ny,side:'poly',edgeIndex:edge.idx,angle:Math.atan2(dy,dx)};
  const outside=gateOutside(g,24),inside=gateInside(g,22);
  const roadDist=Math.min(Math.abs(XROADS[nearestIndex(XROADS,outside.x)]-outside.x),Math.abs(YROADS[nearestIndex(YROADS,outside.y)]-outside.y),manhattanRoadDistance(outside.x,outside.y));
  if(roadDist<=42&&walkable(outside.x,outside.y,4)&&walkable(inside.x,inside.y,4)&&!gates.some(q=>q.zoneId===z.id&&Math.hypot(q.x-xx,q.y-yy)<45)){spot=g;break}
 }
 if(!spot){if(!free)notify('Choose a road-adjacent edge with a clear passage.',true);return null}
 if(!free&&budget<cost){notify('Not enough funds for this gate.',true);return null}if(!free)budget-=cost;
 const g={id:unitId++,type:'gate',zoneId:z.id,...spot,w:36,level:1,hp:265,maxHp:265,price:free?0:cost,pressure:0,flowTokens:GATE_FLOW_BURST,entered:0,waiting:0};gates.push(g);selected=g;renderUI(true);if(!free){effectSound('deploy');saveCampaign();notify('Polygon perimeter gate constructed.')}return g
}
function zoneBoundaryBlocked(o,n,entity){for(const z of zones){if(z.hp<=0)continue;const insideBefore=isInZone(o.x,o.y,z,-2),insideAfter=isInZone(n.x,n.y,z,-2);if(insideBefore===insideAfter)continue;
  let crossing=null,dd=Infinity;for(const g of gates){if(g.zoneId!==z.id)continue;const d=(g.x-n.x)**2+(g.y-n.y)**2;if(d<dd){dd=d;crossing=g}}
  const open=crossing&&dd<(crossing.w*.5+7)**2&&(entity==='civilian'||entity==='soldier'||crossing.hp<=0);
  if(!open)return{zone:z,gate:crossing&&dd<900?crossing:null};
  // Only entering civilians consume admission slots. Exits and zombie breaches
  // continue to use the normal geometry without reducing gate throughput.
  if(entity==='civilian'&&!insideBefore){
   const weight=Math.max(1,o.weight||1);
   if(!gateHasSpace(crossing,weight))return{zone:z,gate:crossing,congested:true};
   crossing.flowTokens=Math.max(0,(crossing.flowTokens??GATE_FLOW_BURST)-weight);
   crossing.entered=(crossing.entered||0)+weight;
   o.entryGateId=crossing.id;o.entryZoneId=z.id;
  }
 }return null}
function rectDistance(x,y,r){return Math.hypot(x-clamp(x,r.x,r.x+r.w),y-clamp(y,r.y,r.y+r.h))}
function roadSpawn(rand){if(isNYC()&&nycSpawnPoints.length){
  for(let i=0;i<9;i++){const src=nycSpawnPoints[Math.floor(rand()*nycSpawnPoints.length)],p={x:src.x+(rand()-.5)*32,y:src.y+(rand()-.5)*32};if(walkable(p.x,p.y,2))return p}
  return nycSpawnPoints[Math.floor(rand()*nycSpawnPoints.length)];
 }for(let k=0;k<15;k++){let pos;if(rand()<.55){let y=YROADS[Math.floor(rand()*YROADS.length)],i=Math.floor(rand()*(XROADS.length-1));pos={x:XROADS[i]+rand()*(XROADS[i+1]-XROADS[i]),y:y+(rand()-.5)*17}}else{let x=XROADS[Math.floor(rand()*XROADS.length)],j=Math.floor(rand()*(YROADS.length-1));pos={x:x+(rand()-.5)*17,y:YROADS[j]+rand()*(YROADS[j+1]-YROADS[j])}}if(walkable(pos.x,pos.y,3))return pos}return roadSafe(150+rand()*(W-300),150+rand()*(H-300))}
function civilian(x,y,weight=1){return{id:unitId++,weight,x,y,vx:0,vy:0,alive:true,route:[],routeAt:0,target:null,reroute:rnd(0,1),run:rnd(27,37),panic:0,safety:0,shade:Math.random(),sheltered:false,safeZone:null,zoneTarget:null,alertWait:rnd(0,1),threat:null,wander:0,evacuating:false,escapeGate:null,fleeGoal:null,fleeReroute:0}}
function infected(x,y){return{id:enemyId++,x,y,hp:1,maxHp:1,alive:true,route:[],routeAt:0,reroute:0,target:null,speed:rnd(48,60),siegeStrength:1,flash:0,roam:rnd(0,TAU),attacking:0,incubate:0,vx:0,vy:0,flow:rnd(0,TAU)}}

const SAVE_KEY='cityfall_campaign_flow_v1';
function snapshot(){return{version:3,mapId:activeMap,mapVersion:activeMap==='nyc'?6:activeMap==='nyc_megascale'?4:activeMap==='nyc_expanded'?3:activeMap==='nyc_standard'?2:1,level:scenarioIndex,budget,campaignThreat:{...campaignThreat},defenses:defenses.filter(u=>!u.temporary&&!u.recruited&&u.hp>0&&PERSISTENT_DEFENSES.has(u.type)).map(u=>({type:u.type,x:u.x,y:u.y,level:u.level,hp:u.hp,maxHp:u.maxHp,range:u.range,damage:u.damage,rate:u.rate,price:u.price,kills:u.kills,shots:u.shots,rotation:u.rotation,roofKey:u.roofKey||null,recruitedTotal:u.recruitedTotal||0})),zones:zones.map(z=>({x:z.x,y:z.y,w:z.w,h:z.h,verts:z.verts?z.verts.map(p=>({...p})):undefined,hp:z.hp,maxHp:z.maxHp,price:z.price})),gates:gates.map(g=>({zoneIndex:zones.findIndex(z=>z.id===g.zoneId),side:g.side,x:g.x,y:g.y,nx:g.nx,ny:g.ny,angle:g.angle,edgeIndex:g.edgeIndex,level:g.level||1,hp:g.hp,maxHp:g.maxHp,price:g.price})),walls:walls.map(w=>({ax:w.ax,ay:w.ay,bx:w.bx,by:w.by,hp:w.hp,maxHp:w.maxHp,price:w.price,group:w.group,section:w.section,sectionCount:w.sectionCount})),bridgeState:bridges.map(b=>({id:b.id,hp:b.hp})),collapsedBuildings:buildings.filter(b=>b.collapsed).map(b=>b.key)}}
function readSave(){try{let o=JSON.parse(localStorage.getItem(SAVE_KEY)||localStorage.getItem('cityfall_campaign_v4')||localStorage.getItem('cityfall_campaign_v3'));return o&&Number.isInteger(o.level)&&o.level>=0&&o.level<(o.mapId==='nyc'?20:scenarios.length)&&Array.isArray(o.defenses)&&Array.isArray(o.zones)&&Array.isArray(o.walls)?o:null}catch{return null}}
function readEndlessCheckpoint(){try{const d=JSON.parse(localStorage.getItem(ENDLESS_SAVE_KEY)||'null');return d&&d.version===1&&d.layout&&d.layout.level===(d.layout.mapId==='nyc'?(d.layout.mapVersion===5?5:19):scenarios.length-1)&&Array.isArray(d.people)&&Number.isFinite(d.endlessWave)?d:null}catch{return null}}
function clearEndlessCheckpoint(){try{localStorage.removeItem(ENDLESS_SAVE_KEY)}catch{}}
function saveEndlessCheckpoint(){if(!endlessMode||phase!=='live'||zombies.length||pendingSurges.length)return;
 const state={version:1,layout:snapshot(),budget,initialPopulation,lost,neutralized,time,endlessWave,endlessPressure,endlessAwardedWave,
 people:people.filter(p=>p.alive).map(p=>[Math.round(p.x*10)/10,Math.round(p.y*10)/10,p.weight,p.sheltered?zones.indexOf(p.safeZone):-1])};
 try{localStorage.setItem(ENDLESS_SAVE_KEY,JSON.stringify(state))}catch{log('Endless checkpoint could not be stored (browser storage unavailable).')}
}
function saveCampaign(){if(phase!=='planning')return;const state=snapshot();campaignCheckpoint=state;try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}}
function restoreDeployments(data,repair=false){if(!data)return;
 const collapsed=new Set(data.collapsedBuildings||[]);for(const b of buildings)if(collapsed.has(b.key))b.collapsed=true;
 rebuildBuildingGrid();
 for(const d of data.defenses||[]){const t=unitSpec(d.type);if(!t||!PERSISTENT_DEFENSES.has(d.type)||!Number.isFinite(d.x)||!Number.isFinite(d.y)||!t.health)continue;let roof=d.roofKey?buildings.find(b=>b.key===d.roofKey):null;
 if(!roof&&['garrison','sniper','turret','mortar','beacon'].includes(d.type))roof=roofBuildingAt(d.x,d.y);
 if(roof?.collapsed)continue;
 defenses.push({id:unitId++,type:d.type,x:d.x,y:d.y,roofKey:roof?.key||null,roofHeight:roof?buildingHeight(roof)+2.5:0,level:clamp(d.level||1,1,4),kills:repair?0:(d.kills||0),shots:repair?0:(d.shots||0),rotation:d.rotation||0,cooldown:rnd(.1,.6),hp:repair?(d.maxHp||t.health):(d.hp??t.health),maxHp:d.maxHp||t.health,range:d.type==='garrison'?0:(d.type==='beacon'?Math.max(Number(d.range)||0,t.range):(d.range??t.range)),damage:d.type==='garrison'?0:(d.damage??t.damage),rate:d.type==='garrison'?0:(d.rate??t.rate),price:d.price??t.price,alive:true,flash:0,route:[],routeAt:0,reroute:0,recruitClock:2.5+rnd(0,3),recruitedTotal:d.recruitedTotal||0,fromDrop:false})}
 for(const z of data.zones||[]){if(!Number.isFinite(z.x)||!Number.isFinite(z.w))continue;zones.push({id:unitId++,type:'zone',x:z.x,y:z.y,w:z.w,h:z.h,verts:Array.isArray(z.verts)?z.verts.map(p=>({...p})):undefined,hp:repair?(z.maxHp||1250):(z.hp??1250),maxHp:z.maxHp||1250,price:z.price||100,saved:0})}
 for(const d of data.gates||[]){let z=zones[d.zoneIndex];if(!z||!Number.isFinite(d.x))continue;gates.push({id:unitId++,type:'gate',zoneId:z.id,side:d.side,x:d.x,y:d.y,nx:d.nx,ny:d.ny,angle:d.angle,edgeIndex:d.edgeIndex,w:36,level:clamp(d.level||1,1,5),hp:repair?(d.maxHp||265):(d.hp??265),maxHp:d.maxHp||265,price:d.price??110,pressure:0,flowTokens:GATE_FLOW_BURST,entered:0,waiting:0})}
 // Save migration for earlier campaigns: fit a starter entrance so legacy shelters work.
 if(!Array.isArray(data.gates))for(const z of zones)addGate(z.x+z.w/2,z.y,true,z);
 for(const w of data.walls||[]){if(!Number.isFinite(w.ax)||!Number.isFinite(w.bx))continue;
 if(w.section&&Math.hypot(w.bx-w.ax,w.by-w.ay)<=WALL_SECTION_MAX+1)walls.push({id:unitId++,type:'wall',ax:w.ax,ay:w.ay,bx:w.bx,by:w.by,group:w.group||'legacy-section',section:w.section,sectionCount:w.sectionCount||1,hp:repair?(w.maxHp||192):(w.hp??192),maxHp:w.maxHp||192,price:w.price||38});
 else walls.push(...makeWallSections(w,repair));}
 wallGridDirty=true;rebuildWallGrid();beaconGridDirty=true;
 if(collapsed.size){world3D.needsBuild=true;for(const b of buildings)if(b.collapsed&&staticMap){const c=staticMap.getContext('2d');c.save();c.scale(staticMap.width/W,staticMap.height/H);c.fillStyle='#676b685e';c.fillRect(b.x,b.y,b.w,b.h);c.restore()}}
 // A new level rebuilds every bridge at full integrity; only same-level resume
 // restores damaged crossings from the checkpoint.
 if(!repair)for(const d of data.bridgeState||[]){const b=bridges.find(b=>b.id===d.id);if(b){b.hp=Math.max(0,Math.min(b.maxHp,d.hp));b.broken=b.hp<=0}}
 refreshNavigation();
}
function nextLevel(){if(phase!=='won'||scenarioIndex>=campaignStages()-1)return;
 const success=survivalRatio(),killEfficiency=clamp(neutralized/Math.max(1,scenarioAt().seedCount+scenarioAt().waveSize.reduce((a,b)=>a+b,0)),0,1.8);
 const gain=clamp(.14+success*.73+killEfficiency*.21,.14,.99),carry=snapshot(),next=scenarioIndex+1,grant=(activeMap==='nyc'?nycCampaign:scenarios)[next].grant;
 carry.campaignThreat={carry:clamp(campaignThreat.carry+gain,1,6.5),completed:Math.max(campaignThreat.completed,next),lastGain:gain};
 reset(next,{carry,budgetOverride:Math.round(budget+grant)});log('Campaign threat persisted: '+campaignThreat.carry.toFixed(2)+'× · previous stage raised pressure +'+gain.toFixed(2)+'×.');
 log('Old defenses restored and repaired. All bridge crossings reopened. New districts unlocked.');notify('Stage '+(next+1)+' unlocked! Threat '+campaignThreat.carry.toFixed(2)+'× · +$'+fmt(grant));effectSound('rescue')}
function retryLevel(){reset(scenarioIndex,{load:campaignCheckpoint||readSave()})}

let loadingBusy=false;
const nextLoadFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
function loadingDisplay(label,progress){$('loadStatus').textContent=label;$('loadProgress').style.width=Math.round(progress*100)+'%'}
// Procedural polygon roofs retain the fictional city geometry while avoiding
// location-specific structures in the outbreak simulation.
function addProceduralPolygonBuildings(){
 const rand=rng((MAPS[activeMap]?.seed||2109)+75277);
 for(const b of buildings){
  if(b.landmark||b.collapsed||b.verts||rand()>.24)continue;
  if(b.footW){
   if(b.footW<32||b.footH<22)continue;
   const w=b.footW,h=b.footH;
   const local=[[-w/2,-h/2],[w/2,-h/2],[w/2,h*.20],[w*.22,h*.20],[w*.22,h/2],[-w/2,h/2]];
   const co=Math.cos(b.angle),si=Math.sin(b.angle);
   b.verts=local.map(([x,y])=>({x:b.cx+x*co-y*si,y:b.cy+x*si+y*co}));
  }else{
   if(b.w<35||b.h<32)continue;
   b.verts=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},
     {x:b.x+b.w,y:b.y+b.h*.55},{x:b.x+b.w*.70,y:b.y+b.h*.55},
     {x:b.x+b.w*.70,y:b.y+b.h},{x:b.x,y:b.y+b.h}];
  }
 }
}
async function spreadCityBuild(){const iterator=makeCitySteps();let result,n=0;do{const start=performance.now();do{result=iterator.next();n++}while(!result.done&&performance.now()-start<7);loadingDisplay('Building streets, parks and boroughs…',.08+.50*Math.min(1,n/280));if(!result.done)await nextLoadFrame()}while(!result.done)}
async function reset(scenario=scenarioIndex,opts={}){if(loadingBusy)return;loadingBusy=true;$('stageLoading').classList.remove('hidden');loadingDisplay('Preparing map…',.03);await nextLoadFrame();try{$('reviewControls').classList.add('hidden');const prior=opts.load||opts.carry;
 const priorNYC=prior?.mapId==='nyc'||prior?.mapId==='nyc_megascale';
 const previousMap=priorNYC?(prior.mapVersion>=5?'nyc':prior.mapVersion===4?'nyc_megascale':prior.mapVersion===3?'nyc_expanded':prior.mapVersion===2?'nyc_standard':'nyc_legacy'):(prior?.mapId||'classic');
 activeMap=validMap(opts.mapId??(prior?previousMap:activeMap));scenarioIndex=clamp(scenario,0,campaignStages()-1);simId++;const sc=scenarioAt();sizeForStage(sc);phase='planning';prevPhase='planning';time=0;speed=1;budget=opts.budgetOverride??opts.load?.budget??sc.budget;initialPopulation=sc.population;rescued=0;lost=0;neutralized=0;spawnedWaves=0;people=[];zombies=[];pendingSurges=[];zombieSpawnCarry=0;zombieSliceTick=0;defenses=[];zones=[];gates=[];walls=[];shells=[];effects=[];hordeCenters=[];hordeClock=0;tracers=[];flares=[];aircraft=[];parachutes=[];arrivals=[];spawnCooldowns={};beaconGridDirty=true;toolId=null;selected=null;drag=null;unitId=1;enemyId=1;zeroTime=0;quietClock=0;endlessMode=false;endlessWave=0;endlessPressure=0;endlessAwardedWave=0;endlessNextAt=0;campaignThreat={carry:1,completed:0,lastGain:0};humanClusters=[];shelterTargets.clear();humanSearchClock=0;fallingBuildings=[];wallGrid.clear();wallGridDirty=true;threatProfile={pressure:1,count:1,speed:1,siege:1};lastWaveInfo=null;populationCull=0;uiInspectedId=-1;
 // Outbreak remains secret and changes every start/restart, not fixed near the center.
 outbreak=null;await spreadCityBuild();loadingDisplay('Preparing polygon building roofs…',.59);await nextLoadFrame();addProceduralPolygonBuildings();rebuildBuildingGrid();loadingDisplay('Connecting roads and waterways…',.62);await nextLoadFrame();refreshNavigation();nycSpawnPoints=[];
 if(isNYC())for(let iy=0;iy<navRows;iy+=2)for(let ix=0;ix<navCols;ix+=2){
  const x=(ix+.5)*NAV_STEP,y=(iy+.5)*NAV_STEP;
  if(navWalk[ix+iy*navCols]&&nycLandAt(x,y))nycSpawnPoints.push({x,y});
 }
 const rand=rng(sc.seed*13+4);
 const cohorts=Math.min(sc.population,isNYC()?MAX_NYC_COHORTS:MAX_CIV_COHORTS),each=Math.floor(sc.population/cohorts),extra=sc.population%cohorts;
 for(let i=0;i<cohorts;i++){const p=roadSpawn(rand);people.push(civilian(p.x,p.y,each+(i<extra?1:0)));if(i%350===349){loadingDisplay('Populating streets…',.64+.16*i/cohorts);await nextLoadFrame()}}
 const sourceSave=opts.carry||opts.load;
 if(sourceSave?.campaignThreat){const v=sourceSave.campaignThreat;campaignThreat={carry:clamp(Number(v.carry)||1,1,6.5),completed:clamp(Number(v.completed)||0,0,campaignStages()-1),lastGain:Number(v.lastGain)||0}}
 else if(scenarioIndex>0)campaignThreat={carry:1+scenarioIndex*.20,completed:scenarioIndex,lastGain:0};
 loadingDisplay('Restoring shelters and defenses…',.82);await nextLoadFrame();restoreDeployments(sourceSave,!!opts.carry);threatProfile=threatDirector();rebuildGrid(civGrid,people);zombieGrid.clear();cam.zoom=isNYC()?clamp(Math.min(cw/1150,ch/980),.45,.95):clamp(Math.min(cw/W*.95,ch/H*.98)*1.7,.43,.82);
 if(isNYC()){const [lon,lat]=(activeMap==='nyc'?NYC_CAMPAIGN_FOCUS:NYC_STAGE_FOCUS)[scenarioIndex],focus=nycProject(lon,lat);centerCamera(focus.x,focus.y)}
 else centerCamera(scenarioIndex===0?W/2:Math.min(W-500,MAPS[activeMap].x.at(-1)+420+(scenarioIndex-1)*255),H*.55);$('cityName').textContent=isNYC()?'NEW YORK CITY / '+(activeMap==='nyc'?scenarioAt().name:scenarioIndex>=5?'ALL FIVE BOROUGHS':NYC_UNLOCK[Math.min(scenarioIndex,4)].toUpperCase()):activeMap==='classic'?sc.name:MAPS[activeMap].name.toUpperCase()+' / DISTRICT '+(scenarioIndex+1);$('overviewBtn').style.display='';$('sideOverviewBtn').style.display='';$('levelChip').textContent='STAGE '+(scenarioIndex+1)+' / '+campaignStages();$('phaseLabel').textContent='PLANNING PHASE — ORIGIN UNKNOWN';$('phaseDot').style.background='#e6b576';$('phaseDot').style.boxShadow='0 0 8px #e6b57655';$('startBtn').style.display='';$('pauseBtn').style.display='none';$('mapTip').innerHTML=isNYC()?'NYC · COMPLETE CITY · HARLEM & EAST RIVERS · GRAY LOCKED BOROUGHS · '+(activeMap==='nyc'?scenarioAt().name+' ACTIVE':scenarioIndex>=5?'ALL BOROUGHS OPEN':NYC_UNLOCK[Math.min(scenarioIndex,4)].toUpperCase()+' unlocked')+'. Tap the minimap to travel. Build shelters and roadside gates.':'FULL MAP VISIBLE · gray districts unlock in later stages. <b>Build shelters inside the active district</b>; future districts are scenery only.';$('mapTip').classList.remove('warn');$('sitrep').textContent='First infection origin unknown. Scanning all districts.';feed=[];log('Dispatch online. Origin UNKNOWN. Build entrances for every shelter.');log('Prepare defenses for a surprise outbreak.');buildToolUi();renderUI(true);updateButtons();closeDrawers();if(!opts.skipSave||opts.mapId||opts.load||opts.carry)$('introOverlay').classList.add('hidden');$('modalOverlay').classList.add('hidden');campaignCheckpoint=snapshot();if(!opts.skipSave)saveCampaign();loadingDisplay('Preparing 3D scene…',.93);await nextLoadFrame();if(world3D.ready&&world3D.needsBuild)await world3D.rebuildAsync(n=>loadingDisplay('Preparing 3D city geometry…',.90+.095*(1-Math.exp(-n/45))));loadingDisplay('City ready',1);
 }catch(err){console.error('City loading failed',err);loadingDisplay('Load failed: '+err.message,1);notify('Map loading failed: '+err.message,true)}finally{loadingBusy=false;$('stageLoading').classList.add('hidden')}}
function buildToolUi(){const entry=t=>'<button class="tool" data-tool="'+t.id+'" title="'+t.name+' ['+t.key+']"><span class="tool-icon">'+iconSVG(t.id)+'</span><span class="tool-text"><span class="tool-title">'+t.name+'</span><br><span class="tool-description">'+t.desc+'</span></span><span class="tool-price">$'+fmt(t.price)+'</span><span class="shortcut">'+t.key+'</span></button>';$('toolList').innerHTML=tools.map(entry).join('');$('supportList').innerHTML=supports.map(entry).join('');for(const b of document.querySelectorAll('[data-tool]'))b.addEventListener('click',()=>{effectSound('ui');chooseTool(b.dataset.tool)})}
function updateToolUi(){for(const b of document.querySelectorAll('[data-tool]')){const t=unitSpec(b.dataset.tool),cooldown=Math.max(0,(spawnCooldowns[t.id]||0)-time),restricted=tools.includes(t)&&!defenseCanBuild(t.id),respondOnly=supports.includes(t)&&phase!=='live';b.classList.toggle('selected',toolId===t.id);b.classList.toggle('no-money',budget<t.price||cooldown>0||restricted||respondOnly);b.disabled=cooldown>0||restricted||respondOnly;b.querySelector('.tool-price').textContent=restricted?'LOCKED':respondOnly?'LIVE ONLY':cooldown>0?Math.ceil(cooldown)+'s':'$'+fmt(t.price)}}
function chooseTool(id){if(phase==='won'||phase==='lost')return;const t=unitSpec(id);if(!t||tools.includes(t)&&!defenseCanBuild(id)||supports.includes(t)&&phase!=='live'){notify('This deployment is unavailable during the current phase.',true);return}
 toolId=toolId===id?null:id;pendingZone=[];updatePolyControls();selected=null;uiInspectedId=-1;updateToolUi();$('mobilePanBtn').classList.toggle('active',!toolId);
 if(toolId){$('mapTip').innerHTML=id==='zone'?'Tap to add shelter <b>vertices</b>. Tap the first corner again or choose FINISH. Corners snap to adjacent shelters. Gates attach to any road-facing edge.':id==='wall'?'Drag an <b>unlimited-length barricade</b>. Cost scales with its length.':id==='gate'?'Tap a safe-zone wall <b>adjacent to a road</b> to add a gate. Select it later to reinforce its HP.':id==='strafe'?'Drag to aim a <b>line airstrike</b> (up to 1,100 map units).':supports.includes(t)?'Tap a location to request <b>'+t.name+'</b>. Arrival takes time.':'Tap to deploy <b>'+t.name+'</b>. Garrisons recruit mobile soldiers after the outbreak; other units engage infected.';if(window.innerWidth<=900)closeDrawers()}
 else $('mapTip').innerHTML='Click a unit to <b>inspect and upgrade</b> it. Pan using WASD or right-drag.';renderUI(true)}
$('polyUndo').onclick=()=>{pendingZone.pop();updatePolyControls()};$('polyFinish').onclick=finishPolyZone;$('polyCancel').onclick=()=>{pendingZone=[];updatePolyControls()};
function zoneCost(r){return Math.max(85,Math.ceil((55+zoneArea(r)/680)/5)*5)}
function wallCost(a,b){return Math.max(38,Math.ceil(dist(a,b)/54)*38)}
function isInZone(x,y,z,margin=0){if(x<z.x-Math.max(0,margin)||x>z.x+z.w+Math.max(0,margin)||y<z.y-Math.max(0,margin)||y>z.y+z.h+Math.max(0,margin))return false;
 const inside=polyContains(x,y,zoneVertices(z));if(margin===0)return inside;const edge=closestPolyEdge(x,y,z);return margin>0?inside||edge.d<=margin:inside&&edge.d>=-margin}
function hitRectPoint(x,y,r){return x>=r.x&&y>=r.y&&x<=r.x+r.w&&y<=r.y+r.h}
function placementAllowed(x,y){return x>35&&x<W-35&&y>35&&y<H-35}
function shipPlacementWater(x,y){if(!placementAllowed(x,y))return false;
 if(isNYC()){if(nycPreviewBoroughAt(x,y))return false;
  for(const b of [...bridges,...futureBridges])if(b.ax!==undefined&&nycBridgeDistance(x,y,b)<Math.max(50,(b.deckWidth||110)*.5+30))return false;
  return [[0,0],[-40,-25],[40,-25],[-40,25],[40,25]].every(([ox,oy])=>!nycPreviewBoroughAt(x+ox,y+oy));
 }
 return [[0,0],[-35,0],[35,0]].every(([dx,dy])=>waterAt(x+dx,y+dy))
}
function addDefense(id,x,y,free=false,rotation=0){const t=unitSpec(id);if(!t||!t.health||!free&&(budget<t.price||tools.includes(t)&&!defenseCanBuild(id))){if(!free)notify('Deployment unavailable or not enough funding.',true);return null}
 if(id==='infantry'||id==='tank'){const r=roadSafe(x,y);x=r.x;y=r.y}
 if(id==='battleship'&&!shipPlacementWater(x,y)){if(!free)notify('Battleships must be deployed in navigable open water, away from bridges and shorelines.',true);return null}
 if(id==='minefield'&&(!walkable(x,y,4)||zones.some(z=>z.hp>0&&isInZone(x,y,z,12)))){if(!free)notify('Mine fields need open ground outside safe zones and water.',true);return null}
 if(!placementAllowed(x,y)){if(!free)notify('Cannot deploy outside the city boundary.',true);return null}
 if(defenses.some(u=>Math.hypot(u.x-x,u.y-y)<20)){if(!free)notify('Too close to another unit.',true);return null}
 if(!free&&phase==='live'&&id==='tank'){
  const remaining=Math.max(0,(spawnCooldowns.tank||0)-time);
  if(remaining>0){notify('Tank transport ready in '+Math.ceil(remaining)+'s.',true);return null}
  budget-=t.price;spawnCooldowns.tank=time+t.cooldown;
  const direction=Math.random()<.5?1:-1;
  aircraft.push({type:'tankdrop',x,y,sx:x-810*direction,sy:y-210,ex:x+980*direction,ey:y+225,dir:direction,age:0,duration:4.2,releaseAt:1.9,released:false,price:t.price});
  effects.push({type:'ring',x,y,r:16,max:70,life:1.8,maxLife:1.8,color:'#c1be87'});
  log('Permanent tank requested. Transport aircraft inbound for an airdrop.');
  notify('Tank airdrop inbound · '+t.cooldown+'s cooldown');effectSound('radio');renderUI(true);return{queued:true}
 }
 if(!free&&phase==='live'&&id==='helicopter'){budget-=t.price;spawnCooldowns[id]=time+9;arrivals.push({type:id,x,y,age:0,delay:2.7,price:t.price});log('Patrol helicopter requested; arrival inbound.');effectSound('radio');notify('Helicopter approaching · 9s cooldown');renderUI(true);return{queued:true}}
 if(!free)budget-=t.price;
 const roof=['garrison','sniper','turret','mortar','beacon','machinegun'].includes(id)?roofBuildingAt(x,y):null;
 const u={id:unitId++,type:id,x,y,roofKey:roof?.key||null,roofHeight:roof?buildingHeight(roof)+2.5:0,level:1,kills:0,shots:0,rotation,cooldown:rnd(.1,.6),hp:t.health,maxHp:t.health,range:t.range,damage:t.damage,rate:t.rate,arc:t.arc||TAU,price:free?0:t.price,alive:true,flash:0,route:[],routeAt:0,reroute:0,fromDrop:free,temporary:isRoundOnlyUnit(id),holdTimer:6,hadContact:false,recruitClock:2.5+rnd(0,3),recruitedTotal:0,mineArmed:id==='minefield',mineRadius:id==='minefield'?92:0};defenses.push(u);
 if(!free){selected=u;toolId=id;log(t.name+(roof?' secured to rooftop ('+Math.round(u.roofHeight)+'m high).':' positioned on the ground.'));effectSound('deploy');renderUI(true);saveCampaign()}beaconGridDirty=true;return u}
function strictCross(a,b,c,d){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),t=cross(c,d,b);return u*v<-.0001&&w*t<-.0001}
function polysOverlap(a,b){if(a.some(p=>polyContains(p.x+1e-3*(a.reduce((v,q)=>v+q.x,0)/a.length-p.x),p.y+1e-3*(a.reduce((v,q)=>v+q.y,0)/a.length-p.y),b))||b.some(p=>polyContains(p.x+1e-3*(b.reduce((v,q)=>v+q.x,0)/b.length-p.x),p.y+1e-3*(b.reduce((v,q)=>v+q.y,0)/b.length-p.y),a)))return true;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(strictCross(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;return false}
let pendingZone=[];
function snapPolyVertex(p){let x=Math.round(p.x/SAFE_GRID)*SAFE_GRID,y=Math.round(p.y/SAFE_GRID)*SAFE_GRID,d=36;for(const z of zones)for(const v of zoneVertices(z)){const dd=Math.hypot(v.x-x,v.y-y);if(dd<d){x=v.x;y=v.y;d=dd}}return{x:clamp(x,8,W-8),y:clamp(y,8,H-8)}}
function updatePolyControls(){const visible=toolId==='zone'&&phase==='planning';$('polygonControls').classList.toggle('hidden',!visible);$('polygonCount').textContent=pendingZone.length+' corners · tap map';$('polyFinish').disabled=pendingZone.length<3;$('polyUndo').disabled=pendingZone.length<1}
function addPolyVertex(x,y){if(phase!=='planning')return;const p=snapPolyVertex({x,y});if(pendingZone.length>=3&&Math.hypot(p.x-pendingZone[0].x,p.y-pendingZone[0].y)<SAFE_GRID*.9){finishPolyZone();return}if(pendingZone.length>=20){notify('Maximum 20 corners per shelter.',true);return}if(pendingZone.some(v=>Math.hypot(v.x-p.x,v.y-p.y)<SAFE_GRID*.45)){notify('This corner is too close to another.',true);return}pendingZone.push(p);updatePolyControls()}
function finishPolyZone(){if(pendingZone.length<3){notify('Add at least 3 corners.',true);return}const verts=pendingZone.slice();for(let i=0;i<verts.length;i++)for(let j=i+1;j<verts.length;j++)if(Math.abs(i-j)>1&&!(i===0&&j===verts.length-1)&&strictCross(verts[i],verts[(i+1)%verts.length],verts[j],verts[(j+1)%verts.length])){notify('Edges cannot cross. Undo the last corner.',true);return}
 const xs=verts.map(v=>v.x),ys=verts.map(v=>v.y),r={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),verts};const old=zones.length;addZone(r);if(zones.length>old){pendingZone=[];updatePolyControls()}}
function polygonPointInsideZone(z){for(let i=0;i<30;i++){const p={x:z.x+Math.random()*z.w,y:z.y+Math.random()*z.h};if(isInZone(p.x,p.y,z,-5)&&walkable(p.x,p.y,2))return p}return zoneCenter(z)}
function addZone(r){if(!r.verts)r=snapZone(r);if(phase!=='planning'){notify('Shelters must be planned before the outbreak.',true);return}let c=zoneCost(r);if(budget<c){notify('Not enough funds for this shelter: $'+c,true);return}if(zoneArea(r)<3800){notify('Shelter area too small. Add more separated corners.',true);return}if(rivers.some(v=>r.x<v.x+v.w+6&&r.x+r.w>v.x-6)){notify('Shelters cannot be built over waterways; use a nearby shoreline.',true);return}
 if(isNYC()){const points=[[r.x+5,r.y+5],[r.x+r.w-5,r.y+5],[r.x+5,r.y+r.h-5],[r.x+r.w-5,r.y+r.h-5],[r.x+r.w*.5,r.y+r.h*.5]];
  if((r.verts? [...r.verts, ...r.verts.map((p,i)=>({x:(p.x+r.verts[(i+1)%r.verts.length].x)/2,y:(p.y+r.verts[(i+1)%r.verts.length].y)/2}))].map(p=>[p.x,p.y]):points).some(([x,y])=>!nycLandAt(x,y))){notify('Every shelter vertex and edge must lie on unlocked land.',true);return}}

 if(zones.some(z=>polysOverlap(zoneVertices(z),zoneVertices(r)))){notify('Shelter interiors cannot overlap. Sharing a corner or edge is allowed.',true);return}budget-=c;const z={id:unitId++,type:'zone',...r,hp:1250,maxHp:1250,price:c,saved:0};zones.push(z);selected=z;log('Shelter walls erected — place at least one entrance gate.');effectSound('deploy');notify('Walled shelter placed. Select GATE (8) and tap its edge.');renderUI(true);saveCampaign()}
function addWall(a,b){if(phase!=='planning'){notify('Barricades can only be built during planning.',true);return}
 const length=dist(a,b);if(length<24){notify('Drag to make a longer barricade.',true);return}
 const price=wallCost(a,b);if(budget<price){notify('Insufficient funds for the barrier ($'+price+').',true);return}
 budget-=price;const newWalls=makeWallSections({ax:a.x,ay:a.y,bx:b.x,by:b.y,price});walls.push(...newWalls);wallGridDirty=true;rebuildWallGrid();
 selected=newWalls[0];log('Barricade constructed: '+newWalls.length+' independently destructible sections.');
 notify(newWalls.length+' barricade sections · $'+fmt(price));playTone(280,.08,.02);renderUI(true);saveCampaign()}
function sendSupport(type,x,y,line=null){const t=supports.find(t=>t.id===type);if(!t)return;if(phase!=='live'){notify('Emergency response unlocks when the outbreak begins.',true);return}
 let remain=(spawnCooldowns[type]||0)-time;if(remain>0){notify(t.name+' ready in '+Math.ceil(remain)+'s.',true);return}if(budget<t.price){notify('Not enough funds for '+t.name+'.',true);return}
 budget-=t.price;spawnCooldowns[type]=time+t.cooldown;x=clamp(x,60,W-60);y=clamp(y,60,H-60);
 if(type==='airstrike'||type==='strafe'||type==='paratroopers'){
  let a;
  if(type==='strafe'){
   if(!line){budget+=t.price;spawnCooldowns[type]=0;notify('Drag from the start to the end of a line airstrike.',true);return}
   const start=line.start,end=clampStrikeEnd(start,line.end),dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy)||1,vx=dx/len,vy=dy/len;
   x=(start.x+end.x)/2;y=(start.y+end.y)/2;
   a={type,x,y,sx:start.x-vx*490,sy:start.y-vy*490,ex:end.x+vx*550,ey:end.y+vy*550,dir:1,age:0,duration:4.2,releaseAt:1.9,released:false,price:t.price,line:{x1:start.x,y1:start.y,x2:end.x,y2:end.y}};
  }else{const dir=Math.random()<.5?1:-1;a={type,x,y,sx:x-810*dir,sy:y-210,ex:x+980*dir,ey:y+225,dir,age:0,duration:4.2,releaseAt:1.9,released:false,price:t.price}}
  aircraft.push(a);effects.push({type:'ring',x,y,r:16,max:62,life:1.8,maxLife:1.8,color:'#d8e7ea'})}
 else if(type==='infantry'||type==='attackheli')arrivals.push({type,x,y,age:0,delay:type==='attackheli'?3.1:2.1,price:t.price});
 log(t.name+' requested; support inbound.');effectSound('radio');notify(t.name+' inbound · '+t.cooldown+'s cooldown');
 // Successful emergency requests return to inspection/panning; rejected requests retain the tool.
 if(toolId===type)chooseTool(type);else renderUI(true)
}
function drawStrikeCoverage(start,end,opacity=1){
 const angle=Math.atan2(end.y-start.y,end.x-start.x),r=STRAFE_RADIUS;
 ctx.save();ctx.globalAlpha=opacity;ctx.beginPath();
 for(let i=0;i<=20;i++){const a=angle-Math.PI/2+i*Math.PI/20,p=project3D(end.x+Math.cos(a)*r,end.y+Math.sin(a)*r,3);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)}
 for(let i=0;i<=20;i++){const a=angle+Math.PI/2+i*Math.PI/20,p=project3D(start.x+Math.cos(a)*r,start.y+Math.sin(a)*r,3);ctx.lineTo(p.x,p.y)}
 ctx.closePath();ctx.fillStyle='#ffb56132';ctx.fill();ctx.strokeStyle='#ffd89f';ctx.lineWidth=1.5;ctx.setLineDash([7,5]);ctx.stroke();ctx.restore();
}
function clampStrikeEnd(start,end){const d=Math.hypot(end.x-start.x,end.y-start.y)||1,k=Math.min(1,STRAFE_LENGTH/d);return{x:clamp(start.x+(end.x-start.x)*k,30,W-30),y:clamp(start.y+(end.y-start.y)*k,30,H-30)}}
function commitStrafe(d){const end=clampStrikeEnd(d.start,d.cur),len=Math.hypot(end.x-d.start.x,end.y-d.start.y);if(len<55){notify('Drag at least 55m to choose an airstrike direction.',true);return}sendSupport('strafe',(d.start.x+end.x)/2,(d.start.y+end.y)/2,{start:d.start,end})}
// Heavy game explosions can collapse nearby towers. Destruction is intentionally
// local and capped, so a large city never rebuilds all structures every tick.
function beginBuildingCollapse(b,{dir=rnd(0,TAU),delay=0,chainDepth=0}={}){if(!b||b.collapsed||b.collapsing)return false;
 const height=buildingHeight(b);strategicRoofs=null;
 b.collapsing={t:0,delay,duration:clamp(1.04+height/680,1.05,2.25),dir,height,impact:false,chainDepth};fallingBuildings.push(b);
 // Mounted equipment falls with the building; never leave floating turrets.
 for(const u of defenses)if(u.roofKey===b.key){u.hp=0;u.flash=0;if(selected===u)selected=null}
 effects.push({type:'ring',x:b.x+b.w/2,y:b.y+b.h/2,r:5,max:Math.min(52,18+height*.055),life:.6,maxLife:.6,color:'#ffe0a0'});
 return true
}
function tryCollapseBuildings(x,y,radius,power=.3,maxCollapses=2){let hits=0;const seen=new Set(),candidates=[];
 eachNearby(buildingGrid,x,y,radius+95,b=>{if(seen.has(b)||b.collapsed||b.collapsing)return;seen.add(b);
 const distance=rectDistance(x,y,b),height=buildingHeight(b);
 if(distance<radius+Math.min(36,height*.25))candidates.push({b,distance,prob:clamp(power*(1-distance/(radius+48))*(.72+height/160),.035,.78)})});
 candidates.sort((a,b)=>a.distance-b.distance);
 for(const {b,prob} of candidates){if(hits>=maxCollapses)break;if(Math.random()>prob)continue;if(beginBuildingCollapse(b))hits++}
 if(hits){world3D.needsBuild=true;log(hits+' building'+(hits===1?' is':'s are')+' collapsing after a heavy impact!')}
 return hits}
function updateBuildingCollapses(dt){let completed=false;
 for(const b of fallingBuildings){const c=b.collapsing;if(!c)continue;if(c.delay>0){c.delay-=dt;continue}c.t=Math.min(c.duration,c.t+dt);const q=c.t/c.duration;
 if(!c.impact&&q>=.74){c.impact=true;const x=b.x+b.w/2,y=b.y+b.h/2,dx=Math.cos(c.dir)*c.height*.70,dy=Math.sin(c.dir)*c.height*.70;
 const mass=clamp(c.height/115,1,9),radius=Math.max(b.w,b.h)*.48+10+c.height*.065,reach=c.height*(.74+mass*.025);
 eachNearby(zombieGrid,x+dx*.45,y+dy*.45,reach+radius,z=>{if(z.alive&&distanceToLine(z.x,z.y,x,y,x+dx,y+dy)<radius){z.hp=0;killZombie(z)}});
 // A tall tower can knock over a few shorter neighbors in its falling path.
 // Depth and the strict height check cap a chain before it can spread citywide.
 if(c.chainDepth<2&&c.height>=145){const candidates=[],seen=new Set(),tipX=x+dx*.78,tipY=y+dy*.78,query=reach*.58+radius*3;
  eachNearby(buildingGrid,tipX,tipY,query,other=>{if(seen.has(other)||other===b||other.collapsed||other.collapsing)return;seen.add(other);
   const ox=other.x+other.w*.5,oy=other.y+other.h*.5,oh=buildingHeight(other),along=(ox-x)*Math.cos(c.dir)+(oy-y)*Math.sin(c.dir),side=Math.abs(distanceToLine(ox,oy,x,y,x+dx,y+dy)),otherRadius=Math.max(other.w,other.h)*.48;
   if(oh>=c.height*.88||along< -otherRadius||along>reach+otherRadius||side>radius+otherRadius) return;
   const force=(c.height/Math.max(oh,1))*(1-side/(radius+otherRadius))*(.55+along/Math.max(reach,1)*.45);
   if(force>.96)candidates.push({other,force,along})
  });
  candidates.sort((a,b)=>b.force-a.force||a.along-b.along);
  let toppled=0;for(let i=0;i<candidates.length&&toppled<3;i++){const hit=candidates[i];if(hit.force<1.25&&Math.random()>.45)continue;if(beginBuildingCollapse(hit.other,{dir:c.dir+rnd(-.2,.2),delay:.12+toppled*.12,chainDepth:c.chainDepth+1}))toppled++}
  if(toppled)world3D.needsBuild=true
 }
 effects.push({type:'blast',x:x+dx*.65,y:y+dy*.65,r:10,max:Math.min(220,reach*.64+radius*1.35),life:.8,maxLife:.8});
 for(let k=0;k<Math.min(13,4+Math.ceil(mass));k++)effects.push({type:'smoke',x:x+dx*.6+rnd(-radius,radius),y:y+dy*.6+rnd(-radius,radius),r:rnd(6,13+mass),max:42+mass*6,life:rnd(.45,1.15),maxLife:1.15});effectSound('blast')}
 if(q>=1){b.collapsed=true;b.collapsing=null;completed=true;const c2=staticMap?.getContext('2d');if(c2){c2.save();c2.scale(staticMap.width/W,staticMap.height/H);c2.fillStyle='#626e6abf';c2.fillRect(b.x+2,b.y+2,b.w-4,b.h-4);c2.restore()}}}
 fallingBuildings=fallingBuildings.filter(b=>!!b.collapsing);
 if(completed){rebuildBuildingGrid();refreshNavigation();world3D.needsBuild=true}
}
function doAirImpact(a){let hits=0;
 if(a.type==='airstrike'){damageBridges(a.x,a.y,145,210);tryCollapseBuildings(a.x,a.y,130,.35,3);eachNearby(zombieGrid,a.x,a.y,130,z=>{if(z.alive&&Math.hypot(z.x-a.x,z.y-a.y)<130){z.hp-=25;z.flash=.5;hits++;if(z.hp<=0)killZombie(z)}});effects.push({type:'blast',x:a.x,y:a.y,r:8,max:136,life:.85,maxLife:.85})}
 if(a.type==='strafe'){const {x1,y1,x2,y2}=a.line||{x1:a.x-215,y1:a.y-80,x2:a.x+215,y2:a.y+80},len=Math.hypot(x2-x1,y2-y1),mx=(x1+x2)/2,my=(y1+y2)/2;
 for(const b of bridges){if(b.hp>0&&distanceToLine(b.x+b.w/2,b.y+b.h/2,x1,y1,x2,y2)<55)damageBridges(b.x+b.w/2,b.y+b.h/2,34,160)}
 eachNearby(zombieGrid,mx,my,len*.5+STRAFE_RADIUS,z=>{if(z.alive&&distanceToLine(z.x,z.y,x1,y1,x2,y2)<STRAFE_RADIUS){z.hp-=16;z.flash=.3;hits++;if(z.hp<=0)killZombie(z)}});
 const blastLength=Math.hypot(x2-x1,y2-y1),samples=Math.min(8,Math.max(2,Math.ceil(blastLength/95)));for(let k=0;k<=samples;k++){const t=k/samples;tryCollapseBuildings(x1+(x2-x1)*t,y1+(y2-y1)*t,40,.055,1)}
 effects.push({type:'line',x1,y1,x2,y2,life:1.15,maxLife:1.15});const bursts=Math.max(5,Math.ceil(len/55));for(let i=0;i<bursts;i++){let q=i/Math.max(1,bursts-1);effects.push({type:'delayedblast',x:x1+(x2-x1)*q,y:y1+(y2-y1)*q,r:4,max:STRAFE_RADIUS,delay:i*.055,life:.53+i*.055,maxLife:.53})}}
 if(a.type==='paratroopers'){const offsets=[[-47,-35],[45,-30],[-38,40],[51,39]];for(const o of offsets){let pos=roadSafe(a.x+o[0],a.y+o[1]);parachutes.push({kind:'infantry',x:pos.x,y:pos.y,age:0,duration:1.5,landed:false})}effects.push({type:'ring',x:a.x,y:a.y,r:10,max:120,life:1.5,maxLife:1.5,color:'#c4e9fc'})}
 if(a.type==='tankdrop'){let pos=roadSafe(a.x,a.y);parachutes.push({kind:'tank',x:pos.x,y:pos.y,age:0,duration:1.9,landed:false,price:a.price});effects.push({type:'ring',x:pos.x,y:pos.y,r:12,max:70,life:1.4,maxLife:1.4,color:'#c1be87'});log('Heavy vehicle descending from transport plane.')}
 if(a.type==='airstrike'||a.type==='strafe')effectSound('blast');else playTone(500,.23,.025,'triangle');if(a.type!=='tankdrop')log(a.type==='paratroopers'?'Paratroopers descending.':'Aircraft hit '+hits+' infected.')
}
function updateAircraft(dt){for(const a of arrivals){a.age+=dt;if(a.age>=a.delay){a.done=true;const u=addDefense(a.type,a.x,a.y,true);if(u){u.price=a.price;u.fromDrop=false;if(isRoundOnlyUnit(a.type)){u.temporary=true}if(a.type==='attackheli'){u.holdTimer=5;u.hadContact=false}}effects.push({type:'ring',x:a.x,y:a.y,r:10,max:54,life:.7,maxLife:.7,color:'#b6f2d3'});log(a.type==='attackheli'?'Attack helicopter on station.':a.type==='helicopter'?'Patrol helicopter on station.':'Ground squad arrived.');effectSound('deploy')}}arrivals=arrivals.filter(a=>!a.done);
 for(const a of aircraft){a.age+=dt;if(!a.flyby&&a.age>=a.releaseAt-.5){a.flyby=true;effectSound('plane')}if(!a.released&&a.age>=a.releaseAt){a.released=true;doAirImpact(a)}}aircraft=aircraft.filter(a=>a.age<a.duration);
 for(const p of parachutes){p.age+=dt;if(!p.landed&&p.age>=p.duration){p.landed=true;let u=addDefense(p.kind,p.x,p.y,true);if(u){if(p.price)u.price=p.price;if(isRoundOnlyUnit(p.kind))u.temporary=true}effects.push({type:'ring',x:p.x,y:p.y,r:3,max:45,life:.5,maxLife:.5,color:'#bbecfe'});if(p.kind==='tank'){log('Tank landed and is seeking infected groups.');effectSound('deploy')}}}parachutes=parachutes.filter(p=>!p.landed)
}
// The adaptive director measures *living* civilians, not just the shelter occupancy.
// Survival contributes a moderate bonus, while combat success adds later pressure.
function threatDirector(){const save=survivalRatio(),loss=1-save;
 const defeated=neutralized/Math.max(150,scenarioAt().seedCount+spawnedWaves*230);
 const boost=clamp(Math.max(0,(save-.35)/.65)*.65+Math.min(.65,defeated*.42)-loss*.35,0,2.35);
 const baseline=campaignThreat.carry+(endlessMode?endlessPressure:0);
 return {pressure:baseline+boost*.82,count:1+(baseline-1)*.42+boost*.85,
 speed:Math.min(endlessMode?1.85:2.4,1+(baseline-1)*.055+boost*.155),siege:1+(baseline-1)*.27+boost*.52};}
// Spawn the first portion immediately, then spread the rest across simulation
// ticks. Large stages never allocate/move thousands of zombies in a single frame.
function spawnWaveBatch(job,amount){let created=0,attempts=0;
 while(created<amount&&job.remaining>0&&attempts<amount*5){attempts++;
  const o=job.origins[(job.originCursor++)%job.origins.length],px=clamp(o.x+rnd(-75,75),10,W-10),py=clamp(o.y+rnd(-75,75),10,H-10);
  let pos=safeWavePoint(px,py,4)?{x:px,y:py}:null;
  if(!pos&&attempts%4===0)pos=safeWaveCohortPoint(o);
  if(!pos){if(attempts%5!==0)continue;pos=safeWavePoint(o.x,o.y,2)?o:safeWaveOrigin(job.origins)}
  if(!pos)break;
  const z=infected(pos.x,pos.y);z.speed=(z.speed+Math.min(4,time/70))*job.profile.speed;
  z.siegeStrength=job.profile.siege;z.hp=z.maxHp=1;zombies.push(z);created++;job.remaining--;
 }
 return created}
function spawnCluster(count,edge=false,profile=null){
 const waveNo=endlessMode?Math.max(1,endlessWave):Math.max(1,spawnedWaves+1),originCount=edge?Math.min(5,2+Math.floor((waveNo-1)/3)):2;
 const origin=(!edge&&outbreak&&safeWavePoint(outbreak.x,outbreak.y,10)?outbreak:null)||safeWaveOrigin();
 if(!origin){log('No open city ground remains for a new surge.');return null}
 const origins=[origin];
 while(origins.length<originCount){const extra=safeWaveOrigin(origins);if(!extra)break;origins.push(extra)}
 const job={remaining:Math.max(0,Math.round(count)),total:Math.max(0,Math.round(count)),origin,origins,originCursor:0,profile:profile||{speed:1,siege:1}};
 const first=spawnWaveBatch(job,Math.min(job.remaining,SURGE_FIRST_BATCH));
 if(job.remaining>0)pendingSurges.push(job);
 for(const p of origins)effects.push({type:'pulse',x:p.x,y:p.y,r:12,max:85,life:1.5,maxLife:1.5,color:'#d97974'});
 return {...origin,origins,created:first,scheduled:job.total}
}
function advanceSurgeSpawns(dt){if(!pendingSurges.length)return;
 zombieSpawnCarry=Math.min(400,zombieSpawnCarry+dt*SURGE_BATCH_PER_SECOND);
 let allowance=Math.min(MAX_SPAWN_PER_TICK,Math.floor(zombieSpawnCarry));
 // Endless waves keep every scheduled infected, but ease their arrival when a
 // device is already handling a very large horde. This is pacing, not a cap.
 if(endlessMode&&zombies.length>ENDLESS_PACING_TARGET)allowance=Math.max(1,Math.floor(allowance/(1+(zombies.length-ENDLESS_PACING_TARGET)/ENDLESS_PACING_TARGET)));
 if(!allowance)return;
 for(const job of pendingSurges){if(allowance<=0)break;
  const actual=spawnWaveBatch(job,Math.min(allowance,job.remaining));
  allowance-=actual;zombieSpawnCarry=Math.max(0,zombieSpawnCarry-actual);
  if(job.remaining>0&&actual===0)break;
 }
 pendingSurges=pendingSurges.filter(job=>job.remaining>0);
 if(!pendingSurges.length)zombieSpawnCarry=0;
}
function queuedZombies(){let total=0;for(const q of pendingSurges)total+=q.remaining;return total}

function begin(){if(phase!=='planning')return;audioReady();if(zones.length===0){notify('Place at least one safe zone before launching.',true);return}if(zones.some(z=>!gateForZone(z).length)){notify('Each safe zone needs an entrance gate (tool 8).',true);return}
 // Concealed, freshly randomized on every playthrough; no displayed planning marker.
 const ix=Math.floor(rnd(1,XROADS.length-1)),iy=Math.floor(rnd(1,YROADS.length-1));outbreak={x:XROADS[ix]+rnd(-12,12),y:YROADS[iy]+rnd(-12,12)};if(!safeWavePoint(outbreak.x,outbreak.y,25))outbreak=safeWaveOrigin();if(!outbreak){notify('No safe outdoor outbreak location is available. Make room outside the shelters.',true);return;}
 campaignCheckpoint=snapshot();saveCampaign();phase='live';time=0;spawnCluster(scenarioAt().seedCount);rebuildGrid(zombieGrid,zombies);$('phaseLabel').textContent='OUTBREAK ACTIVE — CONTAINMENT IN PROGRESS';$('phaseDot').style.background='#e68d88';$('phaseDot').style.boxShadow='0 0 8px #e68d8855';$('startBtn').style.display='none';$('pauseBtn').style.display='';$('mapTip').innerHTML='<b>OUTBREAK ACTIVE.</b> Garrison, Lookout, Patrol Helicopter and Tank remain under Defense. Tanks arrive by plane mid-round; emergency soldiers leave after the level.';toolId=null;updateToolUi();$('mapTip').classList.add('warn');log('WARNING: Unpredictable infection origin confirmed.');notify('Outbreak detected! Defend your shelters.');effectSound('warning');updateButtons()}
function togglePause(){if(phase==='live'){prevPhase='live';phase='paused'}else if(phase==='paused')phase='live';updateButtons();renderUI(true)}
function updateButtons(){$('pauseBtn').textContent=phase==='paused'?'▶ RESUME':'Ⅱ PAUSE';document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',+b.dataset.speed===speed));$('clearBtn').disabled=phase!=='planning';$('startBtn').disabled=phase!=='planning';$('endlessLaunchBtn').style.display=phase==='won'&&scenarioIndex===campaignStages()-1&&!endlessMode?'':'none';$('mobilePanBtn').classList.toggle('active',!toolId)}
function closestZombie(x,y,range){let best=null,bd=range*range;eachNearby(zombieGrid,x,y,range,z=>{if(!z.alive)return;let d=(z.x-x)**2+(z.y-y)**2;if(d<bd){bd=d;best=z}});return best}
function closestCivilian(x,y,range,includeSheltered=false){let best=null,bd=range*range;eachNearby(civGrid,x,y,range,p=>{if(!p.alive||(!includeSheltered&&p.sheltered))return;let d=(p.x-x)**2+(p.y-y)**2;if(d<bd){bd=d;best=p}});return best}
function targetPoint(p,t,key=null){p.route=[{x:t.x,y:t.y}];p.routeAt=0;p.target=t;p.navKey=key}
function clearCorridor(x1,y1,x2,y2){let d=Math.hypot(x2-x1,y2-y1),steps=Math.ceil(d/24);for(let i=1;i<steps;i++){let f=i/steps;if(!walkable(x1+(x2-x1)*f,y1+(y2-y1)*f,2))return false}return true}
function moveOnRoute(p,vel,dt){if(!p.route||p.routeAt>=p.route.length)return;const target=p.route[p.routeAt],d=Math.hypot(target.x-p.x,target.y-p.y);
 if(d<9){p.routeAt++;return}const kind=p.sheltered!==undefined?'civilian':p.type==='tank'?'tank':'soldier';steerAgent(p,target,vel,dt,p.sheltered!==undefined?civGrid:unitGrid,kind,p.navKey)}
function insideSafe(x,y){for(const z of zones)if(z.hp>0&&isInZone(x,y,z,-7))return z;return null}
function distanceToLine(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,len=dx*dx+dy*dy||1;const t=clamp(((px-x1)*dx+(py-y1)*dy)/len,0,1);return Math.hypot(px-x1-dx*t,py-y1-dy*t)}
function killZombie(z){if(!z.alive)return;z.alive=false;neutralized++;budget+=1;if(effects.length<185&&Math.random()<(zombies.length>1100?.16:.66))effects.push({type:'fade',x:z.x,y:z.y,life:.4,maxLife:.4});if(Math.random()<.012)playTone(610+Math.random()*50,.023,.003)}
function bestCivilianZone(p){let best=null,bd=Infinity;for(const z of zones){if(z.hp<=0||z.saved+p.weight>zoneCapacity(z)||gates.some(g=>g.zoneId===z.id&&g.hp<=0))continue;const g=nearestGate(z,p.x,p.y);if(!g)continue;const d=(g.x-p.x)**2+(g.y-p.y)**2;if(d<bd){bd=d;best=z}}return best}
// Civilians react locally instead of blindly running toward shelter markers.
// Weighted groups stay individual for navigation, while their passenger counts
// still feed shelter capacity and gate admission.
function civilianFleePoint(p,threat){let vx=0,vy=0;
 eachNearby(zombieGrid,p.x,p.y,205,z=>{if(!z.alive)return;const dx=p.x-z.x,dy=p.y-z.y,d2=dx*dx+dy*dy;
  if(d2>205*205)return;const force=1/(Math.max(100,d2));vx+=dx*force;vy+=dy*force});
 if(Math.hypot(vx,vy)<.00001&&threat){vx=p.x-threat.x;vy=p.y-threat.y}
 if(Math.hypot(vx,vy)<.00001){vx=Math.cos(p.id*2.399);vy=Math.sin(p.id*2.399)}
 const len=Math.hypot(vx,vy)||1;vx/=len;vy/=len;
 // Pick ground reachable through alleys. Steering handles corners/building slides.
 for(const length of [185,115,70]){const px=clamp(p.x+vx*length,10,W-10),py=clamp(p.y+vy*length,10,H-10);
  if(walkable(px,py,3))return{x:px,y:py}}
 return roadSafe(p.x+vx*115,p.y+vy*115)
}
function releaseFromShelter(p,z){if(!p.sheltered)return;
 p.sheltered=false;p.safeZone=null;p.evacuating=false;p.escapeGate=null;p.exitingGate=false;
 rescued=Math.max(0,rescued-p.weight);if(z)z.saved=Math.max(0,z.saved-p.weight);
 p.zoneTarget=null;p.targetGate=null;p.entering=false;p.reroute=0;p.panic=2.2;
 p.fleeGoal=null;p.fleeReroute=0;p.alertWait=0;p.route=[];p.routeAt=0
}
function chooseEscapeGate(p,z,threat){let choice=null,score=Infinity;
 for(const g of gates){if(g.zoneId!==z.id)continue;const outside=gateOutside(g,32),distP=Math.hypot(p.x-g.x,p.y-g.y);
  const risk=closestZombie(outside.x,outside.y,155),hazard=risk?180-Math.min(155,Math.hypot(outside.x-risk.x,outside.y-risk.y)):0;
  const s=distP+hazard*3+(g.hp<=0?80:0)+(threat?Math.max(0,125-Math.hypot(outside.x-threat.x,outside.y-threat.y))*.9:0);
  if(s<score){score=s;choice=g}}
 return choice
}
function updateCivilians(dt){const stride=people.length>(deviceProfile.constrained?14500:19000)?6:people.length>(deviceProfile.constrained?10200:14000)?5:people.length>(deviceProfile.constrained?6800:9500)?4:people.length>(deviceProfile.constrained?4300:6200)?3:people.length>(deviceProfile.constrained?2800:4200)?2:1,
 offset=civilianSliceTick++%stride,breachedZones=new Set(gates.filter(g=>g.hp<=0).map(g=>g.zoneId));dt*=stride;
 for(let pi=offset;pi<people.length;pi+=stride){const p=people[pi];if(!p.alive)continue;
  if(p.sheltered){const z=p.safeZone;
   if(!z||z.hp<=0){releaseFromShelter(p,z)}
   else{
    p.alertWait-=dt;
    if(p.alertWait<=0){p.threat=closestZombie(p.x,p.y,185);p.alertWait=.32+Math.random()*.55}
    const nearby=p.threat&&p.threat.alive&&Math.hypot(p.threat.x-p.x,p.threat.y-p.y)<172;
    const insideThreat=nearby&&isInZone(p.threat.x,p.threat.y,z,-2);
    const compromised=breachedZones.has(z.id)||insideThreat;
    if(compromised||p.evacuating){if(!p.evacuating){p.escapeGate=chooseEscapeGate(p,z,p.threat);p.evacuating=!!p.escapeGate;p.fleeReroute=0}
     const gate=p.escapeGate;
     if(gate&&p.evacuating){const inner=gateInside(gate,11),outer=gateOutside(gate,42);
      const nearInner=Math.hypot(p.x-inner.x,p.y-inner.y)<19;
      const dest=nearInner||p.exitingGate?outer:inner;p.exitingGate=nearInner||p.exitingGate;
      steerAgent(p,dest,p.run*1.16,dt,civGrid,'civilian',nearInner?'gate-out-'+gate.id:'gate-in-'+gate.id);
      if(!isInZone(p.x,p.y,z,-2))releaseFromShelter(p,z);
      continue
     }
    }
    p.wander-=dt;
    if(p.wander<=0){p.wander=rnd(1.3,3.3);p.target=polygonPointInsideZone(z);
     if(!walkable(p.target.x,p.target.y,2))p.target=polygonPointInsideZone(z)}
    if(p.target){const dx=p.target.x-p.x,dy=p.target.y-p.y,d=Math.hypot(dx,dy);
     if(d>2){let step=Math.min(d,dt*12),nx=p.x+dx/d*step,ny=p.y+dy/d*step;
      if(walkable(nx,ny,2)&&!zoneBoundaryBlocked(p,{x:nx,y:ny},'civilian')){p.x=nx;p.y=ny}}}
    continue
   }
  }
  // Outdoors: running away from immediate danger overrides the plan to enter a gate.
  p.reroute-=dt;p.alertWait-=dt;p.fleeReroute-=dt;
  if(p.alertWait<=0){p.threat=closestZombie(p.x,p.y,205);p.alertWait=.33+Math.random()*.5}
  const threatened=p.threat&&p.threat.alive&&Math.hypot(p.threat.x-p.x,p.threat.y-p.y)<185;
  if(threatened){p.panic=2.3;
   if(p.fleeReroute<=0||!p.fleeGoal||Math.hypot(p.x-p.fleeGoal.x,p.y-p.fleeGoal.y)<25){p.fleeGoal=civilianFleePoint(p,p.threat);p.fleeReroute=.42+Math.random()*.38}
  }else p.panic=Math.max(0,p.panic-dt);
  if(p.panic>0&&p.fleeGoal){p.entering=false;p.reroute=0;
   steerAgent(p,p.fleeGoal,p.run*1.19,dt,civGrid,'civilian',null);
   continue
  }
  const entry=insideSafe(p.x,p.y);
  if(entry&&entry.saved+p.weight<=zoneCapacity(entry)&&!breachedZones.has(entry.id)){
   p.sheltered=true;p.safeZone=entry;p.zoneTarget=entry;p.targetGate=null;p.entering=false;p.exitingGate=false;
   const rescuedBefore=rescued;rescued+=p.weight;entry.saved+=p.weight;p.wander=0;p.target=null;p.route=[];
   if(Math.floor(rescued/500)>Math.floor(rescuedBefore/500)){budget+=45;effects.push({type:'ring',x:entry.x+entry.w/2,y:entry.y+entry.h/2,r:8,max:39,life:.65,maxLife:.65});effectSound('rescue')}
   continue
  }
  if(!p.zoneTarget||p.zoneTarget.hp<=0||breachedZones.has(p.zoneTarget.id)||p.zoneTarget.saved+p.weight>zoneCapacity(p.zoneTarget)||!gateForZone(p.zoneTarget).length){
   p.zoneTarget=bestCivilianZone(p);p.targetGate=null;p.entering=false;p.reroute=0}
  if(p.zoneTarget){let g=p.targetGate;
   if(!g||g.zoneId!==p.zoneTarget.id){g=nearestGate(p.zoneTarget,p.x,p.y);p.targetGate=g;p.entering=false;p.reroute=0}
   if(g){const inward=gateInside(g,16),outward=gateOutside(g,16);
    if(Math.hypot(p.x-outward.x,p.y-outward.y)<27)p.entering=true;
    if(p.entering){
     // Gate rate limits work on weighted population, not just visible avatars.
     // Waiting civilians disperse into queue slots instead of disappearing
     // into one overlapping model on the gate's 3D threshold.
     if(!gateHasSpace(g,p.weight)&&g.hp>0){
      const stand=gateQueueStand(g,Math.max(0,p.queueRank??(p.id%21)));
      if(Math.hypot(p.x-stand.x,p.y-stand.y)>4)steerAgent(p,stand,p.run*.57,dt,civGrid,'civilian',null);
      else{p.vx*=.4;p.vy*=.4}
      continue
     }
     const dx=inward.x-p.x,dy=inward.y-p.y,d=Math.hypot(dx,dy);
     if(d>1){const step=Math.min(d,dt*(p.run+5)),n={x:p.x+dx/d*step,y:p.y+dy/d*step};
      if(!collidesBuilding(n.x,n.y,2)&&!zoneBoundaryBlocked(p,n,'civilian')){p.x=n.x;p.y=n.y}}
     continue
    }
    if(p.reroute<=0||p.routeAt>=p.route.length){targetPoint(p,outward,'gate-'+g.id);p.reroute=2.6+Math.random()*2.3}
   }
  }else if(p.reroute<=0||p.routeAt>=p.route.length){targetPoint(p,roadSpawn(Math.random));p.reroute=3+Math.random()*3}
  let boost=1;eachNearby(beaconGrid,p.x,p.y,430,u=>{if((u.x-p.x)**2+(u.y-p.y)**2<u.range*u.range)boost=1.10});
  moveOnRoute(p,p.run*boost,dt)
 }
}

function hordeHotspots(){
 const wasm=window.CityfallWasm;
 // This runs on a low fixed cadence. WASM performs the bin aggregation only on
 // meaningful hordes; tiny scenes stay on the allocation-free JS fast path.
 if(wasm?.ready&&zombies.length>=180){
  const points=wasm.borrowPoints(zombies.length);let count=0;
  for(const z of zombies)if(z.alive&&z.incubate<=0){points[count*2]=z.x;points[count*2+1]=z.y;count++}
  const packed=wasm.hordeHotspots(points.subarray(0,count*2),220,2);
  if(packed){hordeCenters=[];for(let i=0;i<packed.length;i+=3)hordeCenters.push({x:packed[i],y:packed[i+1],count:packed[i+2]});hordeCenters.sort((a,b)=>b.count-a.count);return}
 }
 const cell=220,bins=new Map();for(const z of zombies){if(!z.alive||z.incubate>0)continue;let key=Math.floor(z.x/cell)+Math.floor(z.y/cell)*1000,v=bins.get(key);if(!v){v={x:0,y:0,count:0};bins.set(key,v)}v.x+=z.x;v.y+=z.y;v.count++}
 hordeCenters=[];for(const v of bins.values()){v.x/=v.count;v.y/=v.count;if(v.count>=2)hordeCenters.push(v)}hordeCenters.sort((a,b)=>b.count-a.count)}
function seekHorde(x,y,preferRange=1800){let best=null,score=-1;for(const h of hordeCenters){let d=Math.hypot(h.x-x,h.y-y),s=Math.pow(h.count,.75)/(90+d*.55);if(d<preferRange)s*=1.3;if(s>score){score=s;best=h}}return best}
// Low-frequency density map: empty shelters cease to attract infected, and
// roaming hordes search the city for remaining living people instead.
function refreshHumanClusters(){const cell=275,bins=new Map();shelterTargets.clear();for(const p of people){if(!p.alive||p.weight<=0)continue;
 if(p.sheltered&&p.safeZone){const id=p.safeZone.id;let cache=shelterTargets.get(id);if(!cache){cache={count:0,people:[]};shelterTargets.set(id,cache)}cache.count++;
 // Reservoir sampling keeps wide shelters searchable at constant cost.
 if(cache.people.length<96)cache.people.push(p);else {const j=Math.floor(Math.random()*cache.count);if(j<96)cache.people[j]=p}continue}
 const key=Math.floor(p.x/cell)+Math.floor(p.y/cell)*10000;let v=bins.get(key);if(!v){v={x:0,y:0,weight:0,count:0};bins.set(key,v)}v.x+=p.x;v.y+=p.y;v.weight+=p.weight;v.count++}
 humanClusters=[];for(const v of bins.values()){v.x/=v.count;v.y/=v.count;humanClusters.push(v)}
}
function nearestShelteredInZone(z,zone){let best=null,bd=210*210;
 eachNearby(civGrid,z.x,z.y,210,p=>{if(!p.alive||!p.sheltered||p.safeZone!==zone)return;const d=(p.x-z.x)**2+(p.y-z.y)**2;if(d<bd){bd=d;best=p}});
 if(best)return best;
 const cache=shelterTargets.get(zone.id);if(!cache)return null;bd=Infinity;
 for(const p of cache.people){if(!p.alive||!p.sheltered||p.safeZone!==zone)continue;const d=(p.x-z.x)**2+(p.y-z.y)**2;if(d<bd){bd=d;best=p}}return best;
}
function findHumanDestination(z,skipZone=null){let best=null,score=-Infinity;
 // Prefer real, unsheltered human concentrations. Small individual offsets keep
 // boids from converging on one exact center coordinate.
 for(const h of humanClusters){const d=Math.hypot(h.x-z.x,h.y-z.y);const s=(1+Math.log2(h.weight+1)*.43)/(45+d*.013);if(s>score){score=s;best={x:h.x,y:h.y,kind:'people'}}}
 for(const s of zones){if(s===skipZone||s.hp<=0||s.saved<=0)continue;
 const g=nearestGate(s,z.x,z.y);if(!g)continue;const d=Math.hypot(g.x-z.x,g.y-z.y),sco=(2.5+Math.log2(s.saved+1)*.28)/(48+d*.014);
 if(sco>score){score=sco;const dest=g.hp>0?gateOutside(g,9):gateInside(g,24);best={...dest,kind:'zone',zone:s,gate:g}}}
 if(!best)return null;
 const point={x:best.x+(z.id%5-2)*6,y:best.y+(Math.floor(z.id/5)%5-2)*6};return{...best,point};
}
function bestExitGate(zone,z,destination){let best=null,score=Infinity;
 for(const g of gateForZone(zone)){const d1=Math.hypot(g.x-z.x,g.y-z.y),d2=destination?Math.hypot(g.x-destination.x,g.y-destination.y)*.18:0;
 const sc=d1+d2+(g.hp>0?12:0);if(sc<score){score=sc;best=g}}
 return best}
function moveZombie(z,dt){let route=z.route||[],target=route[z.routeAt];if(!target)return;
 if(Math.hypot(target.x-z.x,target.y-z.y)<9){z.routeAt++;target=route[z.routeAt];if(!target)return}
 const previous={x:z.x,y:z.y};steerAgent(z,target,z.speed*1.06,dt,zombieGrid,'zombie',z.navKey);
 if(previous.x===z.x&&previous.y===z.y){z.stuck=(z.stuck||0)+dt;const blocked=zoneBoundaryBlocked(previous,{x:previous.x+(target.x-previous.x)*.025,y:previous.y+(target.y-previous.y)*.025},'zombie');if(blocked)z.wallSiege=blocked.zone}else z.stuck=Math.max(0,(z.stuck||0)-dt*2)}
function nudgeCrowds(dt){
 // Cohort-sized social spacing: a bounded nearby query keeps crowds readable
 // without attempting an expensive per-resident fluid simulation.
 const nudge=(items,own,other,radius,offset,includeFlow)=>{const stride=items.length>(deviceProfile.constrained?1800:3200)?3:items.length>900?2:1,start=(civilianSliceTick+zombieSliceTick+offset)%stride;
  for(let i=start;i<items.length;i+=stride){const p=items[i];if(!p.alive||p.sheltered)continue;let vx=0,vy=0,hits=0;
   eachNearby(own,p.x,p.y,radius,q=>{if(q===p||!q.alive||q.sheltered||hits>=12)return;const dx=p.x-q.x,dy=p.y-q.y,d2=dx*dx+dy*dy;if(d2<=.01||d2>=radius*radius)return;const pull=(radius-Math.sqrt(d2))/radius;vx+=dx/Math.sqrt(d2)*pull;vy+=dy/Math.sqrt(d2)*pull;hits++;if(includeFlow&&p.stuck>.14){vx+=(q.vx||0)*.028;vy+=(q.vy||0)*.028}});
   eachNearby(other,p.x,p.y,radius*.82,q=>{if(!q.alive||q.sheltered)return;const dx=p.x-q.x,dy=p.y-q.y,d2=dx*dx+dy*dy;if(d2<=.01||d2>=radius*radius*.68)return;const d=Math.sqrt(d2),push=(radius*.82-d)/(radius*.82);vx+=dx/d*push*.72;vy+=dy/d*push*.72});
   const len=Math.hypot(vx,vy);if(len<.04)continue;const step=Math.min(3.8,dt*(includeFlow&&p.stuck>.14?24:15));const nx=p.x+vx/len*step,ny=p.y+vy/len*step;if(walkable(nx,ny,2)&&!zoneBoundaryBlocked(p,{x:nx,y:ny},p.sheltered!==undefined?'civilian':'zombie')){p.x=nx;p.y=ny}
  }};
 nudge(zombies,zombieGrid,civGrid,13,0,true);nudge(people,civGrid,zombieGrid,15,1,false);
}
function updateZombies(dt){const gateSiege=new Map(),wallSiege=new Map(),activeCount=zombies.length;
 const stride=activeCount>(deviceProfile.constrained?1500:2600)?3:activeCount>(deviceProfile.constrained?560:900)?2:1,offset=zombieSliceTick++%stride;
 const originalDt=dt;dt*=stride;
 for(let zi=offset;zi<activeCount;zi+=stride){const z=zombies[zi];if(!z.alive)continue;z.flash=Math.max(0,z.flash-dt);if(z.incubate>0){z.incubate-=dt;continue}
 const current=insideSafe(z.x,z.y);
 const shelteredHere=!!(current&&current.saved>0);
 // After a safe zone is empty, do not use its center as a fallback destination.
 // Search for humans elsewhere and exit through a breached or breakable gate.
 const localVictim=shelteredHere?nearestShelteredInZone(z,current):null;
 let attackGate=null,forcedExit=null;
 if(current&&!localVictim){const next=findHumanDestination(z,current);const g=bestExitGate(current,z,next?.point);
   if(g){const inside=gateInside(g,12),outside=gateOutside(g,29),distance=Math.hypot(z.x-inside.x,z.y-inside.y);
    forcedExit=distance>15?{x:inside.x,y:inside.y,key:'exit-in-'+g.id,gate:g}:{x:outside.x,y:outside.y,key:'exit-out-'+g.id,gate:g};
    if(g.hp>0&&distance<28)attackGate=g;
   }
 }
 if(!current){for(const s of zones){if(s.hp<=0||s.saved<=0)continue;const g=nearestGate(s,z.x,z.y);if(g&&g.hp>0&&Math.hypot(z.x-g.x,z.y-g.y)<29){attackGate=g;break}}}
 if(attackGate){gateSiege.set(attackGate,(gateSiege.get(attackGate)||0)+1);z.attacking+=dt;z.reroute=0;continue}
 let blocked=false;eachNearby(wallGrid,z.x,z.y,12,w=>{if(blocked||w.hp<=0)return;if(distanceToLine(z.x,z.y,w.ax,w.ay,w.bx,w.by)<10){const before=w.hp;w.hp=Math.max(0,w.hp-dt*4.5*(z.siegeStrength||1));blocked=true;z.reroute=Math.min(z.reroute,.5);
 if(before>0&&w.hp===0){effects.push({type:'smoke',x:(w.ax+w.bx)/2,y:(w.ay+w.by)/2,r:5,max:28,life:.55,maxLife:.55});log('Barricade section '+(w.section||1)+'/'+(w.sectionCount||1)+' breached. Adjacent sections remain standing.')}}});if(blocked)continue;
 z.reroute-=dt;
 if(current&&!localVictim&&z.currentZoneId!==current.id){z.currentZoneId=current.id;z.reroute=0}
 if(current&&localVictim&&z.currentZoneId!==current.id){z.currentZoneId=current.id;z.reroute=0}
 if(z.reroute<=0||!z.target||z.routeAt>=z.route.length){let target=null,key=null;
  if(localVictim){target={x:localVictim.x,y:localVictim.y};z.goalZone=current.id}
  else if(forcedExit){target={x:forcedExit.x,y:forcedExit.y};key=forcedExit.key;z.goalZone=null}
  else{const person=closestCivilian(z.x,z.y,290,false);if(person&&Math.hypot(person.x-z.x,person.y-z.y)<235){target={x:person.x,y:person.y}}
   if(!target){const distant=findHumanDestination(z,current);if(distant){target=distant.point;key=distant.gate?'gate-'+distant.gate.id:null}}
   if(!target){const roaming=roadSpawn(Math.random);target={x:roaming.x+(z.id%3-1)*7,y:roaming.y+(z.id%7-3)*4}}}
  if(collidesBuilding(target.x,target.y,4))target=roadSafe(target.x,target.y);
  targetPoint(z,target,key);z.goalZone=current?.id||null;z.reroute=.58+Math.random()*.7
 }
 if(!current){let g=null,gd=75*75;for(const candidate of gates){if(candidate.hp>0)continue;let shelter=zones.find(q=>q.id===candidate.zoneId);if(!shelter||shelter.hp<=0||shelter.saved<=0)continue;let q=(z.x-candidate.x)**2+(z.y-candidate.y)**2;if(q<gd){gd=q;g=candidate}}
  if(g){z.route=[gateInside(g,36)];z.navKey='gate-'+g.id+'-inside';z.routeAt=0;z.reroute=.18}}
 z.wallSiege=null;moveZombie(z,dt);if(z.wallSiege)wallSiege.set(z.wallSiege,(wallSiege.get(z.wallSiege)||0)+1);
 const victim=closestCivilian(z.x,z.y,10,true);
 if(victim&&(!victim.sheltered||victim.safeZone?.hp<=0||isInZone(z.x,z.y,victim.safeZone,-2))){const casualties=Math.min(victim.weight,Math.max(1,Math.ceil(victim.weight*.26)));
 victim.weight-=casualties;lost+=casualties;
 if(victim.sheltered){rescued=Math.max(0,rescued-casualties);victim.safeZone.saved=Math.max(0,victim.safeZone.saved-casualties)}
 if(victim.weight<=0){victim.alive=false;victim.sheltered=false}if(zombies.length<1800&&Math.random()<.22){const newborn=infected(victim.x,victim.y);newborn.speed=z.speed+rnd(-6,8);newborn.siegeStrength=z.siegeStrength||1;newborn.incubate=rnd(.65,1.9);zombies.push(newborn)}effects.push({type:'spark',x:victim.x,y:victim.y,life:.32,maxLife:.32});if(Math.random()<.07)zombieSound(z.x,z.y)}
 }
 for(const [g,count] of gateSiege){let before=g.hp;g.hp=Math.max(0,g.hp-originalDt*(2+Math.sqrt(count*stride)*9)*threatProfile.siege);g.pressure=count;if(before>0&&g.hp<=0){log('WARNING: Safe-zone gate breached. Infected can enter or escape!');notify('GATE BREACHED — perimeter open!',true);effectSound('warning')}}
 for(const [zone,count] of wallSiege){let before=zone.hp;zone.hp=Math.max(0,zone.hp-originalDt*(1.8+Math.sqrt(count*stride)*4)*threatProfile.siege);if(before>0&&zone.hp<=0){log('Safe-zone wall perimeter collapsed!');effectSound('warning')}}
}
function fireUnit(u,target){u.rotation=Math.atan2(target.y-u.y,target.x-u.x);u.flash=.13;u.shots++;const t=unitSpec(u.type); if(u.type==='mortar'||u.type==='battleship'){
  const naval=u.type==='battleship',range=Math.hypot(target.x-u.x,target.y-u.y);
  const duration=naval?clamp(range/1100,1.15,4.4):clamp(range/330,.75,1.8);
  shells.push({x1:u.x,y1:u.y,z1:(u.roofHeight||0)+(naval?24:14),x2:target.x,y2:target.y,age:0,duration,radius:naval?210:66,damage:u.damage*(1+.34*(u.level-1)),unit:u,naval});
  effects.push({type:'ring',x:u.x,y:u.y,r:3,max:19,life:.3,maxLife:.3,color:'#ffe7a5'});gunSound(u.x,u.y,true);return}
let damage=u.damage*(1+.35*(u.level-1));target.hp-=damage;target.flash=.13;tracers.push({x1:u.x,y1:u.y,z1:(u.roofHeight||0)+12,x2:target.x,y2:target.y,life:u.type==='turret'?.14:u.type==='tank'?.38:.24,maxLife:u.type==='turret'?.14:u.type==='tank'?.38:.24,color:t.color,heavy:u.type==='tank'});if(target.hp<=0){u.kills++;if(u.recruited&&u.homeBase)u.homeBase.kills++;killZombie(target)}gunSound(u.x,u.y,u.type==='tank')
}

function targetInsideArc(u,target){if(!u.arc||u.arc>=TAU-.001)return true;const angle=Math.atan2(target.y-u.y,target.x-u.x),delta=Math.atan2(Math.sin(angle-u.rotation),Math.cos(angle-u.rotation));return Math.abs(delta)<=u.arc*.5}
function closestZombieForUnit(u,range){let best=null,bd=range*range;eachNearby(zombieGrid,u.x,u.y,range,z=>{if(!z.alive||!targetInsideArc(u,z))return;const d=(z.x-u.x)**2+(z.y-u.y)**2;if(d<bd){bd=d;best=z}});return best}

function updateShells(dt){for(const s of shells){s.age+=dt;if(s.age<s.duration)continue;s.done=true;
 let hits=0;eachNearby(zombieGrid,s.x2,s.y2,s.radius,z=>{if(z.alive&&Math.hypot(z.x-s.x2,z.y-s.y2)<s.radius){z.hp-=s.damage;z.flash=.35;hits++;if(z.hp<=0){s.unit.kills++;killZombie(z)}}});
 damageBridges(s.x2,s.y2,52,s.damage*12);tryCollapseBuildings(s.x2,s.y2,s.radius,s.naval?.48:.31,s.naval?5:2);
 effects.push({type:'blast',x:s.x2,y:s.y2,r:7,max:s.radius*1.35,life:.85,maxLife:.85});
 for(let i=0;i<(s.naval?16:10);i++)effects.push({type:'smoke',x:s.x2+rnd(-26,26),y:s.y2+rnd(-24,24),r:rnd(6,16),max:rnd(25,52),life:rnd(.55,1.2),maxLife:1.2,color:'#7e7970'});
 effects.push({type:'ring',x:s.x2,y:s.y2,r:6,max:s.radius*1.7,life:.65,maxLife:.65,color:'#fff0bb'});
 gunSound(s.x2,s.y2,true);effectSound('blast')}
 shells=shells.filter(s=>!s.done)}

function spawnGarrisonRecruit(base){
 if(base.hp<=0||phase!=='live')return null;
 // A rooftop barracks deploys onto the nearest open street or alley, not
 // onto its own roof or through a building footprint.
 let pos=null;
 const homeZone=insideSafe(base.x,base.y);
 const gateway=homeZone?nearestGate(homeZone,base.x,base.y):null;
 const release=gateway?gateOutside(gateway,31):base;
 for(let i=0;i<18;i++){
  const a=rnd(0,TAU),r=26+i*3;
  const p=roadSafe(release.x+Math.cos(a)*r,release.y+Math.sin(a)*r);
  if(!placementAllowed(p.x,p.y)||!walkable(p.x,p.y,3))continue;
  if(homeZone&&isInZone(p.x,p.y,homeZone,4))continue;
  if(defenses.some(v=>v.hp>0&&Math.hypot(v.x-p.x,v.y-p.y)<16))continue;
  pos=p;break
 }
 if(!pos)return null;
 const t=unitSpec('infantry');
 const u={id:unitId++,type:'infantry',x:pos.x,y:pos.y,roofKey:null,roofHeight:0,
  level:base.level>=3?2:1,kills:0,shots:0,rotation:rnd(0,TAU),cooldown:rnd(.1,.65),
  hp:50+(base.level-1)*12,maxHp:50+(base.level-1)*12,
  range:t.range,damage:1.4,rate:.38,price:0,alive:true,flash:0,
  route:[],routeAt:0,reroute:0,fromDrop:false,temporary:true,
  recruited:true,garrisonId:base.id,homeBase:base,holdTimer:0,hadContact:false};
 defenses.push(u);base.recruitedTotal=(base.recruitedTotal||0)+1;
 effects.push({type:'ring',x:u.x,y:u.y,r:4,max:26,life:.6,maxLife:.6,color:'#7ce9c9'});
 if(selected===base)renderSelected();
 return u
}
function updateGarrisons(dt){
 const activeCounts=new Map();let total=0;
 for(const u of defenses){if(u.recruited&&u.hp>0){activeCounts.set(u.garrisonId,(activeCounts.get(u.garrisonId)||0)+1);total++}}
 for(const u of defenses){if(u.type!=='garrison'||u.hp<=0)continue;
  const active=activeCounts.get(u.id)||0,capacity=garrisonCapacity(u);
  if(active>=capacity||total>=GARRISON_RECRUIT_GLOBAL_CAP){u.recruitClock=Math.min(u.recruitClock||0,1);continue}
  u.recruitClock=(u.recruitClock??3)-dt;
  if(u.recruitClock>0)continue;
  u.recruitClock=garrisonInterval(u);
  if(spawnGarrisonRecruit(u)){activeCounts.set(u.id,active+1);total++}
 }
}
function updateDefenses(dt){for(const u of defenses){if(u.hp<=0||u.departed)continue;u.cooldown-=dt;u.flash=Math.max(0,u.flash-dt);if(u.type==='beacon'||u.type==='garrison')continue;
 if(u.type==='minefield'){
  if(!u.mineArmed){if(u.cooldown<=0){u.mineArmed=true;u.flash=.16;effects.push({type:'ring',x:u.x,y:u.y,r:4,max:u.mineRadius,life:.35,maxLife:.35,color:'#d7bc78'})}continue}
  const trigger=closestZombie(u.x,u.y,u.mineRadius);
  if(trigger){let hits=0;eachNearby(zombieGrid,u.x,u.y,u.mineRadius,z=>{if(z.alive&&Math.hypot(z.x-u.x,z.y-u.y)<=u.mineRadius){z.hp-=u.damage;z.flash=.35;hits++;if(z.hp<=0){u.kills++;killZombie(z)}}});u.mineArmed=false;u.cooldown=u.rate;effects.push({type:'blast',x:u.x,y:u.y,r:7,max:u.mineRadius,life:.7,maxLife:.7});tryCollapseBuildings(u.x,u.y,Math.min(38,u.mineRadius*.42),.04,1);if(hits)effectSound('blast')}
  continue
 }
 if(u.type==='battleship'){
  if(u.cooldown<=0){const cluster=seekHorde(u.x,u.y,u.range),target=cluster&&Math.hypot(cluster.x-u.x,cluster.y-u.y)<=u.range?cluster:closestZombie(u.x,u.y,Math.min(900,u.range));
   if(target){fireUnit(u,target);u.cooldown=u.rate/Math.pow(1.12,u.level-1)}else u.cooldown=.55}
  continue
 }
 if(u.type==='helicopter'||u.type==='attackheli'){
  const sensor=u.type==='attackheli'?760:650,prey=closestZombie(u.x,u.y,sensor),hotspot=seekHorde(u.x,u.y,sensor*1.3),hunt=prey||(hotspot&&Math.hypot(hotspot.x-u.x,hotspot.y-u.y)<sensor*1.2?hotspot:null);
  if(prey){u.hadContact=true;u.holdTimer=u.type==='attackheli'?4:7}
  if(u.type==='attackheli'&&!prey){u.holdTimer-=dt;if(u.holdTimer<=0){u.departed=true;effects.push({type:'ring',x:u.x,y:u.y,r:20,max:75,life:1,maxLife:1,color:'#b6e7f5'});log('Attack helicopter disengaged: area clear.');continue}}
  let goal=hunt;if(!goal&&u.type==='helicopter'){
   if(!u.patrolGoal||Math.hypot(u.x-u.patrolGoal.x,u.y-u.patrolGoal.y)<45||u.patrolTimer<=0){u.patrolGoal=roadSafe(clamp(u.x+rnd(-570,570),30,W-30),clamp(u.y+rnd(-570,570),30,H-30));u.patrolTimer=rnd(4,9)}
   u.patrolTimer-=dt;goal=u.patrolGoal}
  if(goal){const d=Math.hypot(goal.x-u.x,goal.y-u.y);u.rotation=Math.atan2(goal.y-u.y,goal.x-u.x);
   if(!hunt||d>u.range*.55)steerAgent(u,goal,u.type==='attackheli'?172:138,dt,unitGrid,'air')}
 }
 if(u.type==='infantry'||u.type==='tank'){
  u.reroute-=dt;const cluster=seekHorde(u.x,u.y),prey=closestZombie(u.x,u.y,460),goal=cluster||prey;
  if(goal){const d=Math.hypot(u.x-goal.x,u.y-goal.y);if(d>u.range*.53){if(u.reroute<=0){targetPoint(u,goal,'horde-'+Math.round(goal.x/150)+'-'+Math.round(goal.y/150));u.reroute=1+rnd(0,.7)}moveOnRoute(u,u.type==='tank'?52:105,dt)}u.rotation=Math.atan2(goal.y-u.y,goal.x-u.x)}
  else{if(u.reroute<=0){targetPoint(u,roadSafe(u.x+rnd(-250,250),u.y+rnd(-250,250)));u.reroute=2.5+rnd(0,1.5)}moveOnRoute(u,u.type==='tank'?27:42,dt)}
 }

 if(u.recruited){
   let contacts=0;
   eachNearby(zombieGrid,u.x,u.y,12,z=>{if(z.alive&&Math.hypot(z.x-u.x,z.y-u.y)<12)contacts++});
   if(contacts>0){u.hp=Math.max(0,u.hp-dt*Math.min(42,3.2+contacts*3.1));if(u.hp<=0){u.alive=false;effects.push({type:'smoke',x:u.x,y:u.y,r:4,max:15,life:.4,maxLife:.4});continue}}
 }
 if(u.cooldown>0)continue;let target=closestZombieForUnit(u,u.range*(1+.13*(u.level-1)));if(target){fireUnit(u,target);u.cooldown=u.rate/Math.pow(1.16,u.level-1)}else u.cooldown=.15
 }compactInPlace(defenses,u=>!u.departed&&(!u.recruited||u.hp>0))
}
function retireRoundUnits(){
 const old=defenses.length;defenses=defenses.filter(u=>!u.recruited&&!u.temporary&&!isRoundOnlyUnit(u.type));
 const retired=old-defenses.length;if(selected&&!defenses.includes(selected)&&selected.type!=='zone'&&selected.type!=='gate'&&selected.type!=='wall')selected=null;
 arrivals=arrivals.filter(a=>!isRoundOnlyUnit(a.type));parachutes=parachutes.filter(p=>!isRoundOnlyUnit(p.kind));
 if(retired)log(retired+' temporary soldiers and response units demobilized at round end.');
 return retired
}
async function startEndless(checkpoint=null){
 const lastStage=campaignStages()-1;
 if(!checkpoint&&(phase!=='won'||scenarioIndex!==lastStage))return;
 if(checkpoint){
  await reset(lastStage,{load:checkpoint.layout,skipSave:true});
  budget=Math.max(0,Number(checkpoint.budget)||0);time=Math.max(0,Number(checkpoint.time)||0);
  neutralized=Math.max(0,Number(checkpoint.neutralized)||0);initialPopulation=scenarioAt().population;
  people=[];rescued=0;
  for(const row of checkpoint.people){if(!Array.isArray(row)||row.length<4||!Number.isFinite(row[0])||!Number.isFinite(row[1]))continue;
   const p=civilian(clamp(row[0],5,W-5),clamp(row[1],5,H-5),Math.max(1,Math.floor(Number(row[2])||1)));
   const z=zones[row[3]];if(z){p.sheltered=true;p.safeZone=z;p.zoneTarget=z;z.saved+=p.weight;rescued+=p.weight}
   people.push(p);
  }
  const accounted=people.reduce((a,p)=>a+p.weight,0);
  lost=clamp(initialPopulation-accounted,0,initialPopulation);
  rebuildGrid(civGrid,people);
 }
 endlessMode=true;endlessWave=checkpoint?Math.max(0,Math.floor(checkpoint.endlessWave||0)):0;
 endlessPressure=checkpoint?Math.max(0,Number(checkpoint.endlessPressure)||0):0;
 endlessAwardedWave=checkpoint?Math.max(0,Math.floor(checkpoint.endlessAwardedWave||0)):0;
 phase='live';prevPhase='live';spawnedWaves=scenarioAt().waves.length;
 zombies=[];pendingSurges=[];zombieSpawnCarry=0;quietClock=0;zeroTime=0;endlessIntermission=6;
 endlessNextAt=time+endlessIntermission;threatProfile=threatDirector();
 // A restored endless checkpoint has no initial-outbreak marker; the 3D
 // overlay and ambient sound still expect a valid location.
 if(!outbreak||!Number.isFinite(outbreak.x)||!Number.isFinite(outbreak.y))outbreak=safeWaveOrigin()||roadSpawn(Math.random);
 $('levelChip').textContent='STAGE '+campaignStages()+' / '+campaignStages()+' · ∞ ENDLESS';
 $('phaseLabel').textContent='ENDLESS SURVIVAL — INFINITE WAVES';
 $('phaseDot').style.background='#e68d88';$('phaseDot').style.boxShadow='0 0 8px #e68d8855';
 $('startBtn').style.display='none';$('pauseBtn').style.display='';
 $('mapTip').innerHTML='<b>ENDLESS SURVIVAL.</b> New infected waves continue forever, with escalating threat. Each clear earns a short intermission to re-arm before the next wave.';
 $('mapTip').classList.add('warn');$('modalOverlay').classList.add('hidden');$('introOverlay').classList.add('hidden');
 toolId=null;closeDrawers();updateButtons();updateToolUi();renderUI(true);
 if(!checkpoint)saveEndlessCheckpoint();
 log('ENDLESS MODE ENGAGED. All permanent defenses remain deployed.');
 notify('∞ ENDLESS SURVIVAL · PREPARE FOR 6s');effectSound('warning');
}
function launchEndlessWave(auto=false){if(!endlessMode||phase!=='live')return;
 endlessIntermission=0;
 endlessWave++;
 // Persistent, strictly increasing bonus on top of earned campaign pressure.
 endlessPressure=.20*endlessWave+.012*Math.pow(endlessWave,1.4);
 threatProfile=threatDirector();
 const base=scenarioAt().waveSize.at(-1);
 const count=Math.min(ENDLESS_WAVE_LIMIT,Math.round(base*(.9+endlessWave*.04)*threatProfile.count));
 const p=spawnCluster(count,true,threatProfile);
 if(!p){endlessWave--;endlessPressure=.20*endlessWave+.012*Math.pow(endlessWave,1.4);endlessNextAt=time+5;return}
 endlessNextAt=time+Math.max(24,62-endlessWave*.58);
 quietClock=0;zeroTime=0;
 lastWaveInfo={count,base,auto,pressure:threatProfile.pressure,endlessWave};
 $('levelChip').textContent='∞ ENDLESS · WAVE '+endlessWave;
 log('ENDLESS WAVE '+endlessWave+': '+fmt(count)+' infected · threat '+threatProfile.pressure.toFixed(2)+'×.');
 notify('∞ WAVE '+endlessWave+' · '+fmt(count)+' INFECTED · '+threatProfile.pressure.toFixed(2)+'×',true);
 effectSound('warning');
}
function endlessWaveCleared(){if(!endlessMode||endlessWave<=endlessAwardedWave)return;
 endlessAwardedWave=endlessWave;retireRoundUnits();
 const grant=Math.round(350+Math.min(8000,endlessWave*135)+survivalRatio()*400);
 budget+=grant;
 if(endlessWave>endlessBest){endlessBest=endlessWave;try{localStorage.setItem(ENDLESS_BEST_KEY,String(endlessBest))}catch{}}
 endlessIntermission=ENDLESS_INTERMISSION_SECONDS;
 endlessNextAt=time+endlessIntermission;
 log('Endless wave '+endlessWave+' cleared. +$'+fmt(grant)+' resupply; '+ENDLESS_INTERMISSION_SECONDS+'s intermission to re-arm.');
 notify('WAVE '+endlessWave+' CLEARED · +$'+fmt(grant)+' · '+ENDLESS_INTERMISSION_SECONDS+'s INTERMISSION');
 effectSound('rescue');saveEndlessCheckpoint();
}
function finish(win){if(phase==='won'||phase==='lost')return;
 $('reviewControls').classList.add('hidden');
 const wasEndless=endlessMode;
 phase=win?'won':'lost';retireRoundUnits();updateButtons();
 const pct=survivalPercent(),final=win&&scenarioIndex===campaignStages()-1;
 const heading=wasEndless?'ENDLESS DEFENSE<br><span style="color:#e99a8e">OVERWHELMED.</span>':final?'THE GREATER CITY<br><span>IS SECURE.</span>':win?'DISTRICT SECURED.<br><span>THE CITY EXPANDS.</span>':'THE CITY HAS<br><span style="color:#e99a8e">FALLEN.</span>';
 const description=wasEndless?'You survived '+fmt(endlessWave)+' endless waves. Threat grew continuously beyond the final campaign level. Resume from your last clear-wave checkpoint or start a new campaign.':win&&!final?'Your permanent defenses, upgrades, and budget carry to the expanded city. Temporary response units withdraw after each level.':final?'All campaign stages are secure. Choose Endless Mode to defend this same city against unlimited, increasingly dangerous surges.':'No civilians remain alive. Retry from your saved pre-outbreak setup or revise your defenses.';
 const btn=wasEndless?'RETRY ENDLESS':win&&!final?'NEXT LEVEL →':final?'NEW CAMPAIGN':'↻ RETRY LEVEL';
 const endlessButton=final?'<button id="enterEndlessBtn">∞ CONTINUE IN ENDLESS MODE →</button>':'';
 $('modalContent').innerHTML='<div class="eyebrow">AFTER-ACTION REPORT // '+(win?'MISSION SUCCESS':'CITY LOST')+' · STAGE '+(scenarioIndex+1)+'/'+campaignStages()+'</div><h1>'+heading+'</h1><p>'+description+'</p><div class="result-stats"><div><strong>'+pct+'%</strong><small>POPULATION SAVED</small></div><div><strong>'+fmt(neutralized)+'</strong><small>INFECTED STOPPED</small></div><div><strong>'+ftime(time)+'</strong><small>TIME ELAPSED</small></div></div><div class="result-line">'+fmt(livingPopulation())+' alive · '+fmt(rescued)+' sheltered · '+fmt(lost)+' lost · $'+fmt(budget)+' remaining'+(wasEndless?' · ∞ '+endlessWave+' waves · best '+endlessBest:'')+'</div><div class="buttons"><button class="secondary" id="reviewBtn">REVIEW MAP</button><button class="secondary" id="retryBtn">'+btn+'</button>'+endlessButton+'</div>';
 $('modalOverlay').classList.remove('hidden');
 $('reviewBtn').onclick=()=>{ $('modalOverlay').classList.add('hidden');$('reviewControls').classList.remove('hidden');
  $('reviewContinueBtn').textContent=wasEndless?'↻ RETRY ENDLESS':win&&!final?'NEXT LEVEL →':final?'∞ ENDLESS MODE →':'↻ RETRY LEVEL';
  $('pauseBtn').style.display='none';
 };
 $('retryBtn').onclick=()=>{if(wasEndless){const saved=readEndlessCheckpoint();if(saved)startEndless(saved);else retryLevel()}
  else if(win&&!final)nextLevel();else if(final){clearEndlessCheckpoint();reset(0)}else retryLevel()};
 if(final)$('enterEndlessBtn').onclick=()=>startEndless();
 log(wasEndless?'ENDLESS RUN ENDED · '+endlessWave+' waves.':win?'MISSION COMPLETE: district secured.':'MISSION FAILED: containment was lost.');
 playTone(win?700:190,.6,.045,'triangle');
}
function launchWave(auto=false){const sc=scenarioAt();if(spawnedWaves>=sc.waves.length)return;
 threatProfile=threatDirector();const base=sc.waveSize[spawnedWaves],count=Math.min(2600,Math.round(base*threatProfile.count));
 const p=spawnCluster(count,true,threatProfile);spawnedWaves++;quietClock=0;zeroTime=0;
 lastWaveInfo={count,base,auto,pressure:threatProfile.pressure};
 log((auto?'Quiet streets — early surge activated. ':'New infected surge. ')+fmt(count)+' infected · threat '+threatProfile.pressure.toFixed(2)+'×.');
 notify('SURGE '+spawnedWaves+'/'+sc.waves.length+' · '+fmt(count)+' infected · '+threatProfile.pressure.toFixed(2)+'× threat',true);
 if(p)effects.push({type:'ring',x:p.x,y:p.y,r:20,max:130,life:2.4,maxLife:2.4});effectSound('warning');
}
function tick(dt){time+=dt;const sc=scenarioAt();gateFlowTick(dt);if(wallGridDirty)rebuildWallGrid();humanSearchClock-=dt;if(humanSearchClock<=0){refreshHumanClusters();humanSearchClock=deviceProfile.constrained?1.12:.82;}
 // Idle means no active infected. After five quiet seconds, advance a pending
 // surge, even if its scheduled time is later. Active hordes use normal timing.
 const active=pendingSurges.length>0||zombies.length>0;quietClock=active?0:quietClock+dt;
 if(endlessMode){
  if(!pendingSurges.length&&zombies.length===0){
   endlessIntermission=Math.max(0,endlessIntermission-dt);
   if(endlessIntermission<=0&&time>=endlessNextAt)launchEndlessWave();
  }
 }else if(spawnedWaves<sc.waves.length&&(time>=sc.waves[spawnedWaves]||quietClock>=5))launchWave(quietClock>=5);
 advanceSurgeSpawns(dt);
 // Rebuild the short-range indices between stages to avoid O(people × zombies) scans.
 if(beaconGridDirty){rebuildGrid(beaconGrid,defenses,activeBeacon);beaconGridDirty=false}rebuildGrid(zombieGrid,zombies);hordeClock-=dt;if(hordeClock<=0){hordeHotspots();hordeClock=deviceProfile.constrained ? .82 : .64}updateCivilians(dt);rebuildGrid(civGrid,people);updateZombies(dt);rebuildGrid(zombieGrid,zombies);nudgeCrowds(dt);
 if(livingPopulation()===0){finish(false);return}
 rebuildGrid(zombieGrid,zombies);rebuildGrid(unitGrid,defenses,activeUnit);updateDefenses(dt);updateGarrisons(dt);updateAircraft(dt);updateShells(dt);updateBuildingCollapses(dt);
 ageTransient(effects,dt);ageTransient(tracers,dt);compactInPlace(zombies,aliveEntity);
 populationCull+=dt;if(populationCull>1.4){people=people.filter(p=>p.alive);populationCull=0}
 if(endlessMode){
  if(zombies.length===0&&pendingSurges.length===0&&endlessWave>endlessAwardedWave)endlessWaveCleared();
 }else if(spawnedWaves===sc.waves.length&&zombies.length===0&&pendingSurges.length===0){zeroTime+=dt;if(zeroTime>2){finish(true);return}}else zeroTime=0;
}
function resize(){const b=canvas.getBoundingClientRect();cw=Math.max(2,b.width);ch=Math.max(2,b.height);dpr=Math.min(window.devicePixelRatio||1,deviceProfile.constrained?1:window.innerWidth<900?1:1.5);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);canvas.style.width=cw+'px';canvas.style.height=ch+'px';const miniScale=deviceProfile.constrained?1:1.5;mini.width=Math.round(mini.clientWidth*miniScale)||315;mini.height=Math.round(mini.clientHeight*miniScale)||215;clampCamera()}
function clampCamera(){const f=cameraFocus(),nx=clamp(f.x,-85,VIS_W+85),ny=clamp(f.y,-85,VIS_H+85);cam.x+=nx-f.x;cam.y+=ny-f.y}
function centerCamera(x,y){cam.x=x-cw/(2*cam.zoom);cam.y=y-ch/(2*cam.zoom);clampCamera()}
function screenToWorld(x,y){if(!world3D.ready)return{x:cam.x+x/cam.zoom,y:cam.y+y/cam.zoom};const cs=Math.cos(camera3D.yaw),sn=Math.sin(camera3D.yaw),rx=(x-cw/2)/cam.zoom,ry=(y-ch/2)/(cam.zoom*Math.sin(camera3D.tilt)),focus=cameraFocus();return{x:focus.x+rx*cs+ry*sn,y:focus.y-rx*sn+ry*cs}}
function screenToWorldAtZ(sx,sy,z){const focus=cameraFocus(),cs=Math.cos(camera3D.yaw),sn=Math.sin(camera3D.yaw);
 const rx=(sx-cw/2)/cam.zoom,ry=((sy-ch/2)/cam.zoom+z*Math.cos(camera3D.tilt))/Math.sin(camera3D.tilt);
 return{x:focus.x+rx*cs+ry*sn,y:focus.y-rx*sn+ry*cs}}
function rooftopPick(sx,sy){let best=null,maxHeight=-1;
 for(const b of buildings){if(b.locked||b.collapsed||b.collapsing)continue;const h=buildingHeight(b)+1.8,point=screenToWorldAtZ(sx,sy,h);
 if(!manhattanBuildingContains(b,point.x,point.y,-0.1))continue;
 if(h>maxHeight){best={x:point.x,y:point.y,roof:b,height:h};maxHeight=h}}
 return best}
function projectedUnitPick(sx,sy){let best=null,nearest=26*26;
 for(const u of defenses){if(u.hp<=0)continue;const p=project3D(u.x,u.y,(u.roofHeight||0)+12),d=(p.x-sx)**2+(p.y-sy)**2;
 if(d<nearest){nearest=d;best=u}}return best}
function zoomAt(delta,sx,sy){markZoomMoving();let p=screenToWorld(sx,sy),n=clamp(cam.zoom*Math.exp(-delta*.0012),NYC_MIN_ZOOM,1.85);cam.zoom=n;let q=screenToWorld(sx,sy);cam.x+=p.x-q.x;cam.y+=p.y-q.y;clampCamera()}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function drawZone(z,c,opacity=1){if(z.hp<=0)return;c.save();c.globalAlpha=opacity;const f=z.hp/z.maxHp;c.fillStyle='rgba(94,206,178,.115)';const path=()=>{const pts=zoneVertices(z);c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))c.lineTo(p.x,p.y);c.closePath()};path();c.fill();
 c.strokeStyle=f<.3?'#d7926f':'#295a51';c.lineWidth=10;path();c.stroke();c.strokeStyle=f<.3?'#f2b685':'#8be5c4';c.lineWidth=4;path();c.stroke();
 // Clear real physical openings where user-placed gates sit.
 for(const g of gates){if(g.zoneId!==z.id)continue;c.save();c.lineWidth=13;c.strokeStyle='#a6bbb0';c.beginPath();if(g.side==='poly'){const co=Math.cos(g.angle),si=Math.sin(g.angle);c.moveTo(g.x-co*g.w/2,g.y-si*g.w/2);c.lineTo(g.x+co*g.w/2,g.y+si*g.w/2)}else if(g.side==='top'||g.side==='bottom'){c.moveTo(g.x-g.w*.5,g.y);c.lineTo(g.x+g.w*.5,g.y)}else{c.moveTo(g.x,g.y-g.w*.5);c.lineTo(g.x,g.y+g.w*.5)}c.stroke();c.restore()}
 c.fillStyle='#1e655b';c.fillRect(z.x,z.y-23,Math.min(z.w,165),19);c.fillStyle='#ddf8ed';c.font='700 10px Segoe UI';c.fillText('SAFE '+fmt(z.saved)+'/'+fmt(zoneCapacity(z)),z.x+7,z.y-9);
 c.fillStyle='#8cdbcc';c.fillRect(z.x,z.y-4,z.w*f,4);c.restore()}
function drawGate(g,c){const z=zones.find(z=>z.id===g.zoneId);if(!z||z.hp<=0)return;c.save();c.translate(g.x,g.y);if(g.side==='poly')c.rotate(g.angle||0);else if(g.side==='left'||g.side==='right')c.rotate(Math.PI/2);
 c.fillStyle='#173b3a';c.fillRect(-g.w/2-5,-10,9,20);c.fillRect(g.w/2-4,-10,9,20);
 if(g.hp>0){if((g.level||1)>1){c.fillStyle='#d9dfb3';for(let i=0;i<Math.min(4,g.level-1);i++)c.fillRect(-g.w*.5+6+i*7,0,4,9)}c.strokeStyle=g.hp/g.maxHp<.35?'#f0a486':'#b5eed0';c.lineWidth=5;c.beginPath();c.moveTo(-g.w*.5+5,-2);c.lineTo(g.w*.5-5,-2);c.stroke();c.strokeStyle='#3f695d';c.lineWidth=2;c.beginPath();c.moveTo(-g.w*.5+5,5);c.lineTo(g.w*.5-5,5);c.stroke()}
 else{c.fillStyle='#e8a17e';c.fillRect(-g.w/2,-3,7,6);c.fillRect(g.w/2-7,-3,7,6)}
 c.restore()}
function drawWall(w,c,opacity=1){if(w.hp<=0)return;c.save();c.globalAlpha=opacity;c.lineCap='round';c.strokeStyle='#26393f';c.lineWidth=14;c.beginPath();c.moveTo(w.ax,w.ay);c.lineTo(w.bx,w.by);c.stroke();c.strokeStyle='#f0c679';c.lineWidth=7;c.setLineDash([10,7]);c.beginPath();c.moveTo(w.ax,w.ay);c.lineTo(w.bx,w.by);c.stroke();c.setLineDash([]);c.restore()}
function drawUnit(u,c){if(u.hp<=0)return;const t=unitSpec(u.type);if(!t)return;c.save();c.translate(u.x,u.y);
 if(u===selected){c.strokeStyle='#fff';c.lineWidth=1.3;c.setLineDash([7,7]);c.beginPath();c.arc(0,0,u.range*(1+.13*(u.level-1)),0,TAU);c.stroke();c.setLineDash([])}
 c.fillStyle='#0a20236b';c.beginPath();c.ellipse(3,5,u.type==='tank'?25:u.type==='helicopter'?28:15,u.type==='tank'?16:10,0,0,TAU);c.fill();
 if(u.type==='battleship'){c.rotate(u.rotation);c.fillStyle='#2e4b58';c.beginPath();c.ellipse(0,0,48,13,0,0,TAU);c.fill();c.fillStyle='#afc1c8';c.fillRect(-31,-9,57,18);c.fillStyle='#496b76';c.fillRect(-10,-6,25,12);c.fillStyle='#d5e1d9';for(const x of [-24,14])c.fillRect(x,-3,16,5)}else if(u.type==='tank'){c.rotate(u.rotation+Math.PI/2);c.fillStyle='#344742';c.fillRect(-14,-21,28,8);c.fillRect(-14,13,28,8);c.fillStyle='#b3b69a';c.fillRect(-12,-15,24,30);c.fillStyle='#5a6d60';c.fillRect(-10,-12,20,24);c.fillStyle='#c2c9ac';c.fillRect(-7,-7,14,17);c.beginPath();c.arc(0,0,7,0,TAU);c.fill();c.fillStyle='#d8ddba';c.fillRect(-2,-23,4,25);c.fillStyle='#53695d';for(let y=-19;y<20;y+=6){c.fillRect(-14,y,3,3);c.fillRect(11,y,3,3)}}
 else if(u.type==='helicopter'||u.type==='attackheli'){c.rotate(u.rotation+Math.PI/2);c.fillStyle='#24434a';c.beginPath();c.ellipse(4,7,21,11,0,0,TAU);c.fill();c.fillStyle=u.type==='attackheli'?'#77a0b6':'#95bcb7';c.fillRect(-5,-25,10,40);c.beginPath();c.ellipse(0,-3,11,17,0,0,TAU);c.fill();c.fillStyle='#4e8790';c.beginPath();c.ellipse(0,-9,8,9,0,0,TAU);c.fill();c.strokeStyle='#172e34';c.lineWidth=2;c.beginPath();c.moveTo(-16,2);c.lineTo(-16,18);c.moveTo(16,2);c.lineTo(16,18);c.stroke();c.save();c.rotate(time*16);c.strokeStyle='#dceceb';c.lineWidth=3;c.beginPath();c.moveTo(-28,0);c.lineTo(28,0);c.moveTo(0,-28);c.lineTo(0,28);c.stroke();c.restore();c.fillStyle='#fff';c.beginPath();c.arc(0,0,2,0,TAU);c.fill()}
 else if(u.type==='infantry'){c.rotate(u.rotation+Math.PI/2);c.fillStyle='#304e62';c.fillRect(-8,-7,6,12);c.fillRect(2,-7,6,12);c.fillStyle='#81a7bc';c.fillRect(-6,-6,12,15);c.fillStyle='#c2d4cf';c.beginPath();c.arc(0,-9,6,0,TAU);c.fill();c.fillStyle='#293c4a';c.fillRect(-3,-12,6,3);c.fillStyle='#b2c7d3';c.fillRect(6,-4,3,19)}
 else if(u.type==='garrison'){c.fillStyle='#516d67';c.fillRect(-12,-10,24,22);c.fillStyle='#8fb7a7';c.fillRect(-10,-12,20,7);c.fillStyle='#274b52';c.fillRect(-4,-2,8,12);c.fillStyle='#b2cbbc';c.fillRect(-14,8,28,4);c.fillStyle='#315763';c.fillRect(-2,-16,4,8)}
 else if(u.type==='sniper'){c.fillStyle='#405a67';c.beginPath();c.moveTo(0,-12);c.lineTo(12,8);c.lineTo(-12,8);c.closePath();c.fill();c.fillStyle='#9dc7c9';c.fillRect(-4,-9,8,8);c.strokeStyle='#d1e0e2';c.lineWidth=2;c.beginPath();c.moveTo(-16,0);c.lineTo(16,0);c.stroke()}
 else if(u.type==='turret'){c.fillStyle='#4d635e';c.fillRect(-12,-12,24,24);c.fillStyle='#a7bdb2';c.beginPath();c.arc(0,0,10,0,TAU);c.fill();c.rotate(u.rotation);c.fillStyle='#2e4c53';c.fillRect(0,-4,21,8);c.fillStyle='#d3e0d7';c.fillRect(8,-1,14,2)}
 else if(u.type==='mortar'){c.fillStyle='#5b6468';c.beginPath();c.arc(0,0,13,0,TAU);c.fill();c.fillStyle='#a2aaa8';c.beginPath();c.arc(0,0,9,0,TAU);c.fill();c.fillStyle='#293942';c.fillRect(-4,-11,8,19);c.fillStyle='#d0d4bb';c.beginPath();c.arc(0,-9,5,0,TAU);c.fill()}
 else if(u.type==='beacon'){c.fillStyle='#325966';c.fillRect(-8,-8,16,16);c.fillStyle='#8de5e1';c.fillRect(-4,-4,8,8);c.strokeStyle='#8de5e1';c.lineWidth=2;c.beginPath();c.arc(0,0,17+(Math.sin(time*3)+1)*4,0,TAU);c.stroke()}
 if(u.type==='attackheli'){c.fillStyle='#e5bc82';c.fillRect(-16,-5,5,17);c.fillRect(11,-5,5,17)}if(u.level>1){c.fillStyle='#fff';c.font='800 11px Segoe UI';c.fillText(''+u.level,13,-14)}if(u.flash>0){c.globalAlpha=Math.min(.7,u.flash/.15*.7);c.fillStyle='#fff';c.beginPath();c.arc(0,0,7,0,TAU);c.fill()}c.restore()}
function drawLegacyCanvas(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#9da9a1';ctx.fillRect(0,0,cw,ch);ctx.save();ctx.translate(-cam.x*cam.zoom,-cam.y*cam.zoom);ctx.scale(cam.zoom,cam.zoom);if(staticMap){let sx=clamp(cam.x-12,0,VIS_W),sy=clamp(cam.y-12,0,VIS_H),sw=Math.min(VIS_W-sx,cw/cam.zoom+30),sh=Math.min(VIS_H-sy,ch/cam.zoom+30);if(sw>0&&sh>0)ctx.drawImage(staticMap,sx*staticMap.width/VIS_W,sy*staticMap.height/VIS_H,sw*staticMap.width/VIS_W,sh*staticMap.height/VIS_H,sx,sy,sw,sh)}
 // Dynamic bridge crossings: air support can destroy them to create river barriers.
 for(const b of bridges){if(b.hp<=0){ctx.fillStyle='#598f9e';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle='#6c7474';ctx.fillRect(b.x-6,b.y,18,b.h);ctx.fillRect(b.x+b.w-12,b.y,18,b.h);
  ctx.strokeStyle='#d6c2a5';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(b.x+13,b.y+5);ctx.lineTo(b.x+30,b.y+30);ctx.moveTo(b.x+b.w-15,b.y+8);ctx.lineTo(b.x+b.w-34,b.y+40);ctx.stroke()}
  else if(b.hp<b.maxHp){ctx.fillStyle='#2d3538a0';ctx.fillRect(b.x+b.w*.47,b.y+5,b.w*.11,b.h-10);ctx.strokeStyle='#f1c78a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x+10,b.y+5);ctx.lineTo(b.x+35,b.y+26);ctx.lineTo(b.x+21,b.y+43);ctx.stroke()}}
 // area-of-impact haze near source
 if(phase==='live'){ctx.save();ctx.strokeStyle='#d77d79b5';ctx.lineWidth=2.2;ctx.setLineDash([8,8]);ctx.beginPath();ctx.arc(outbreak.x,outbreak.y,55,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
 for(const z of zones)drawZone(z,ctx);for(const g of gates)drawGate(g,ctx);for(const w of walls)drawWall(w,ctx);
 // civilians and infected are stylized map markers, with no graphic imagery
 const small=cam.zoom<.56,view={x:cam.x-12,y:cam.y-12,x2:cam.x+cw/cam.zoom+12,y2:cam.y+ch/cam.zoom+12};
 ctx.fillStyle='#f1efdc';for(const p of people){if(!p.alive||p.x<view.x||p.x>view.x2||p.y<view.y||p.y>view.y2)continue;ctx.fillStyle=civilianShirtColor(p);const r=small?3.0:2.8;ctx.fillRect(p.x-r/2,p.y-r/2,r,r)}
 for(const z of zombies){if(!z.alive||z.x<view.x||z.x>view.x2||z.y<view.y||z.y>view.y2)continue;ctx.fillStyle=z.flash>0?'#fff0ca':'#a53e46';if(small)ctx.fillRect(z.x-2.3,z.y-2.3,4.6,4.6);else{ctx.beginPath();ctx.arc(z.x,z.y,4.2,0,TAU);ctx.fill();ctx.strokeStyle='#e98a7e';ctx.lineWidth=1;ctx.stroke()}}
 for(const shell of shells){const t=clamp(shell.age/shell.duration,0,1),x=shell.x1+(shell.x2-shell.x1)*t,y=shell.y1+(shell.y2-shell.y1)*t,h=Math.sin(Math.PI*t)*Math.max(32,Math.hypot(shell.x2-shell.x1,shell.y2-shell.y1)*.13);
  ctx.fillStyle='#1b27327a';ctx.beginPath();ctx.ellipse(x,y,5,3,0,0,TAU);ctx.fill();ctx.strokeStyle='#e9dbad8a';ctx.lineWidth=2;ctx.beginPath();for(let j=0;j<=11;j++){const k=t-j*.016;if(k<0)break;const xx=shell.x1+(shell.x2-shell.x1)*k,yy=shell.y1+(shell.y2-shell.y1)*k-Math.sin(Math.PI*k)*Math.max(32,Math.hypot(shell.x2-shell.x1,shell.y2-shell.y1)*.13);if(j===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)}ctx.stroke();ctx.fillStyle='#fff6d5';ctx.beginPath();ctx.arc(x,y-h,5.5,0,TAU);ctx.fill();ctx.fillStyle='#ffc472';ctx.beginPath();ctx.arc(x,y-h,3,0,TAU);ctx.fill()}
 for(const e of effects){ctx.save();let alpha=clamp(e.life/e.maxLife,0,1);ctx.globalAlpha=alpha;if(e.type==='line'){ctx.strokeStyle='#ffdab3';ctx.lineWidth=11*alpha;ctx.beginPath();ctx.moveTo(e.x1,e.y1);ctx.lineTo(e.x2,e.y2);ctx.stroke();ctx.setLineDash([8,15]);ctx.strokeStyle='#fff0c4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(e.x1,e.y1);ctx.lineTo(e.x2,e.y2);ctx.stroke();ctx.setLineDash([])}else if(e.type==='delayedblast'&&e.life>e.maxLife){/* animated stagger */}else if(e.type==='smoke'){ctx.fillStyle='#6a6f6a';ctx.globalAlpha=alpha*.38;ctx.beginPath();ctx.arc(e.x,e.y,e.r+(e.max-e.r)*(1-alpha),0,TAU);ctx.fill()}else if(e.type==='fade'){ctx.fillStyle='#9a4c50';ctx.beginPath();ctx.arc(e.x,e.y,3+8*(1-alpha),0,TAU);ctx.fill()}else if(e.type==='spark'){ctx.strokeStyle='#ffd9aa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,2+7*(1-alpha),0,TAU);ctx.stroke()}else{let r=e.r+(e.max-e.r)*(1-alpha);ctx.strokeStyle=e.color||(e.type==='blast'?'#f1e3b0':'#74e0c3');ctx.lineWidth=e.type==='blast'?4:3;ctx.beginPath();ctx.arc(e.x,e.y,r,0,TAU);ctx.stroke();if(e.type==='blast'){ctx.fillStyle='#e6caa751';ctx.beginPath();ctx.arc(e.x,e.y,r*.75,0,TAU);ctx.fill()}}ctx.restore()}
 for(const u of defenses){if(u.x>view.x-300&&u.x<view.x2+300&&u.y>view.y-300&&u.y<view.y2+300)drawUnit(u,ctx)}
 for(const a of arrivals){ctx.save();ctx.translate(a.x,a.y);let t=a.age/a.delay;ctx.strokeStyle=a.type==='attackheli'?'#d4ce87':'#87c8d3';ctx.lineWidth=3;ctx.setLineDash([6,7]);ctx.beginPath();ctx.arc(0,0,18+t*16,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#203d43c9';ctx.fillRect(-25,-28,50,17);ctx.fillStyle='#f1f3d3';ctx.font='800 9px system-ui';ctx.fillText(Math.ceil(a.delay-a.age)+'s',-7,-16);if(a.type==='helicopter'||a.type==='attackheli'){ctx.save();ctx.translate((1-t)*-90,(1-t)*-40);ctx.rotate(time*13);ctx.strokeStyle='#d2edeb';ctx.beginPath();ctx.moveTo(-22,0);ctx.lineTo(22,0);ctx.moveTo(0,-22);ctx.lineTo(0,22);ctx.stroke();ctx.restore()}ctx.restore()}
 for(const p of parachutes){let q=clamp(p.age/p.duration,0,1),h=(1-q)*(p.kind==='tank'?110:72);ctx.save();ctx.translate(p.x,p.y-h);ctx.fillStyle='#122f4270';ctx.beginPath();ctx.ellipse(0,h+3,8,3,0,0,TAU);ctx.fill();ctx.strokeStyle='#dff4ff';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.kind==='tank'?-21:-11,-5);ctx.quadraticCurveTo(0,p.kind==='tank'?-32:-22,p.kind==='tank'?21:11,-5);ctx.lineTo(0,4);ctx.lineTo(p.kind==='tank'?-21:-11,-5);ctx.stroke();ctx.fillStyle=p.kind==='tank'?'#b5b696':'#9ac7e9';if(p.kind==='tank')ctx.fillRect(-10,2,20,11);else{ctx.beginPath();ctx.arc(0,5,3.6,0,TAU);ctx.fill()}ctx.restore()}
 for(const a of aircraft){let q=clamp(a.age/a.duration,0,1),x=a.sx+(a.ex-a.sx)*q,y=a.sy+(a.ey-a.sy)*q,rot=Math.atan2(a.ey-a.sy,a.ex-a.sx);ctx.save();ctx.translate(x,y);ctx.rotate(rot);if(a.dir<0)ctx.rotate(Math.PI);ctx.strokeStyle='#7f9bb88b';ctx.lineWidth=3;ctx.setLineDash([14,12]);ctx.beginPath();ctx.moveTo(-125,0);ctx.lineTo(-30,0);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#334b54b0';ctx.beginPath();ctx.ellipse(6,18,32,10,0,0,TAU);ctx.fill();ctx.fillStyle=a.type==='paratroopers'?'#6b91a8':a.type==='tankdrop'?'#aebfc9':'#d8e6e4';ctx.beginPath();ctx.moveTo(36,0);ctx.lineTo(2,-6);ctx.lineTo(-13,-23);ctx.lineTo(-21,-22);ctx.lineTo(-12,-5);ctx.lineTo(-37,-4);ctx.lineTo(-42,0);ctx.lineTo(-37,4);ctx.lineTo(-12,5);ctx.lineTo(-21,22);ctx.lineTo(-13,23);ctx.lineTo(2,6);ctx.closePath();ctx.fill();ctx.strokeStyle='#263844';ctx.lineWidth=2;ctx.stroke();ctx.restore()}
 for(const e of tracers){const t=clamp(1-e.life/e.maxLife,0,1),t0=clamp(t-(e.heavy?.18:.28),0,1),x=e.x1+(e.x2-e.x1)*t,y=e.y1+(e.y2-e.y1)*t;ctx.save();ctx.globalAlpha=.95;ctx.lineCap='round';ctx.shadowColor=e.heavy?'#ffd397':'#e6f6bf';ctx.shadowBlur=e.heavy?15:9;ctx.strokeStyle=e.heavy?'#ffcd77':'#fff3a9';ctx.lineWidth=(e.heavy?4.5:2.8)/Math.sqrt(Math.max(.35,cam.zoom));ctx.beginPath();ctx.moveTo(e.x1+(e.x2-e.x1)*t0,e.y1+(e.y2-e.y1)*t0);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#fff8d3';ctx.beginPath();ctx.arc(x,y,(e.heavy?3.8:2.3)/Math.sqrt(Math.max(.4,cam.zoom)),0,TAU);ctx.fill();ctx.restore()}
 if(drag){if(drag.type==='zone'){let r=snapZone(rectFrom(drag.start,drag.cur));let cost=zoneCost(r);ctx.save();ctx.fillStyle=budget>=cost?'#7de7bf37':'#ef8d8545';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle=budget>=cost?'#a6ffdb':'#eaa4a2';ctx.lineWidth=3/Math.max(.4,cam.zoom);ctx.setLineDash([9,6]);ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.setLineDash([]);ctx.font='800 16px Segoe UI';ctx.fillStyle='#e8fdf5';ctx.fillText('$'+cost,r.x+7,r.y-9);ctx.restore()}else if(drag.type==='wall'){ctx.save();ctx.strokeStyle='#ffd18b';ctx.lineWidth=10;ctx.setLineDash([9,8]);ctx.beginPath();ctx.moveTo(drag.start.x,drag.start.y);ctx.lineTo(drag.cur.x,drag.cur.y);ctx.stroke();ctx.setLineDash([]);ctx.font='800 13px system-ui';ctx.fillStyle='#fff0d0';ctx.fillText('$'+wallCost(drag.start,drag.cur),drag.cur.x+10,drag.cur.y-13);ctx.restore()}}
 else if(toolId&&!['wall','strafe'].includes(toolId)){const tool=unitSpec(toolId),valid=budget>=tool.price;ctx.save();ctx.globalAlpha=.6;ctx.strokeStyle=valid?'#94f6d7':'#eb8d87';ctx.lineWidth=2/Math.max(.4,cam.zoom);ctx.setLineDash([7,7]);ctx.beginPath();ctx.arc(mouse.wx,mouse.wy,tool.range|| (tool.id==='airstrike'?130:tool.id==='strafe'?170:tool.id==='paratroopers'?85:tool.id==='tank'?115:tool.id==='attackheli'?325:14),0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=valid?'#b9f4dd':'#e88a85';ctx.beginPath();ctx.arc(mouse.wx,mouse.wy,7,0,TAU);ctx.fill();ctx.restore()}
 if(selected&&selected.type==='zone'){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(selected.x-5,selected.y-5,selected.w+10,selected.h+10);ctx.restore()}
 ctx.restore();drawVignette();if(phase==='paused'){ctx.fillStyle='#08121bb8';ctx.fillRect(0,0,cw,ch);ctx.textAlign='center';ctx.fillStyle='#e9f9ef';ctx.font='800 27px Segoe UI';ctx.fillText('SIMULATION PAUSED',cw/2,ch/2);ctx.font='12px Segoe UI';ctx.fillStyle='#adc5ca';ctx.fillText('Press Space or Resume to continue',cw/2,ch/2+26);ctx.textAlign='start'}}
// 3D world renderer: original offline WebGL2 instance-mesh engine, no third-party libraries.
// The simulation still runs in city-plane coordinates. The renderer extrudes that
// plane into actual depth-tested 3D geometry with an orbitable orthographic camera.
const camera3D={yaw:-0.22,tilt:1.51}; // ~86.5-degree bird's-eye camera, still depth-tested 3D.
// Only the full-city overview uses the inexpensive silhouette mesh.  Switching
// meshes during normal zooms made the city appear to flash gray.
const zoomPerf={movingUntil:0,lowDetail:false,lastLevel:-1};
function markZoomMoving(){zoomPerf.movingUntil=performance.now()+330}
function lowDetailView(){
 const z=cam.zoom;
 const enter=deviceProfile.constrained?.065:.038,exit=deviceProfile.constrained?.11:.07;
 if(z<enter)zoomPerf.lowDetail=true;
 else if(z>exit)zoomPerf.lowDetail=false;
 return zoomPerf.lowDetail;
}

function cameraFocus(){return{x:cam.x+cw/(2*cam.zoom),y:cam.y+ch/(2*cam.zoom)}}
function project3D(x,y,z=0){
 const c=cameraFocus(),dx=x-c.x,dy=y-c.y,cs=Math.cos(camera3D.yaw),sn=Math.sin(camera3D.yaw),st=Math.sin(camera3D.tilt),ct=Math.cos(camera3D.tilt);
 return{x:cw*.5+(dx*cs-dy*sn)*cam.zoom,y:ch*.5+((dx*sn+dy*cs)*st-z*ct)*cam.zoom};
}
function shiftCameraScreen(dx,dy){
 if(!world3D.ready){cam.x-=dx/cam.zoom;cam.y-=dy/cam.zoom;clampCamera();return}
 const cs=Math.cos(camera3D.yaw),sn=Math.sin(camera3D.yaw),rx=dx/cam.zoom,ry=dy/(cam.zoom*Math.sin(camera3D.tilt));
 cam.x-=rx*cs+ry*sn;cam.y-=-rx*sn+ry*cs;clampCamera();
}
function rotate3DCamera(by=.35){camera3D.yaw+=by;if(camera3D.yaw>Math.PI)camera3D.yaw-=TAU;if(camera3D.yaw< -Math.PI)camera3D.yaw+=TAU;notify('3D camera rotated · right-drag to orbit / middle or Shift-drag to pan')}
class CityRenderer{
 constructor(){
  this.canvas=document.createElement('canvas');this.canvas.id='world3d';canvas.parentElement.insertBefore(this.canvas,canvas);
  this.gl=this.canvas.getContext('webgl2',{alpha:false,antialias:deviceProfile.antialias,preserveDrawingBuffer:false,depth:true,powerPreference:'high-performance'});
  this.ready=false;this.staticData=null;this.staticCount=0;this.needsBuild=true;this.palette=new Map();this.dynamic=[];this.dynamicUpload=null;this.lodData=null;this.lodCount=0;this.softwareChunks=null;this.polyData=new Float32Array();this.polyCount=0;this.heatWorldW=0;this.heatWorldH=0;
  if(!this.gl){this.ctx2=this.canvas.getContext('2d');this.software=true;this.ready=true;return;}
  try{this.setup();this.ready=true}catch(e){console.error('WebGL3D setup failed; using projected 3D fallback',e);this.canvas.remove();this.canvas=document.createElement('canvas');this.canvas.id='world3d';canvas.parentElement.insertBefore(this.canvas,canvas);this.gl=null;this.ctx2=this.canvas.getContext('2d');this.software=true;this.ready=true;this.needsBuild=true}
 }
 setup(){const gl=this.gl;
  const vs=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormal;
  layout(location=2) in vec3 iPosition;
  layout(location=3) in vec3 iScale;
  layout(location=4) in vec3 iColor;
  layout(location=5) in float iAngle;
  uniform vec2 uFocus;uniform vec2 uResolution;uniform float uZoom;uniform float uYaw;uniform float uTilt;uniform float uDepthRange;
  out vec3 vColor;out float vShade;
  void main(){
    float cs=cos(iAngle),sn=sin(iAngle);
    vec3 q=aPosition*iScale;
    vec3 local=vec3(q.x*cs-q.y*sn,q.x*sn+q.y*cs,q.z);
    vec3 p=local+iPosition;
    vec2 d=p.xy-uFocus;
    float cy=cos(uYaw),sy=sin(uYaw);
    float rx=d.x*cy-d.y*sy;
    float ry=d.x*sy+d.y*cy;
    float st=sin(uTilt),ct=cos(uTilt);
    float depth=-(ry*ct+p.z*st)/uDepthRange;
    gl_Position=vec4(rx*uZoom*2.0/uResolution.x,-(ry*st-p.z*ct)*uZoom*2.0/uResolution.y,depth,1.0);
    vec3 norm=vec3(aNormal.x*cs-aNormal.y*sn,aNormal.x*sn+aNormal.y*cs,aNormal.z);
    vec3 sun=normalize(vec3(-0.40,-0.38,0.82));
    vShade=0.52+0.49*max(dot(norm,sun),0.0)+0.09*max(norm.z,0.0);
    vColor=iColor;
  }`;
  const fs=`#version 300 es
  precision highp float;in vec3 vColor;in float vShade;out vec4 fragColor;
  void main(){fragColor=vec4(vColor*vShade,1.0);}`;
  const program=gl.createProgram();
  for(const [src,type] of [[vs,gl.VERTEX_SHADER],[fs,gl.FRAGMENT_SHADER]]){const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);gl.deleteShader(shader)}
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  this.program=program;gl.useProgram(program);
  this.uniforms={focus:gl.getUniformLocation(program,'uFocus'),resolution:gl.getUniformLocation(program,'uResolution'),zoom:gl.getUniformLocation(program,'uZoom'),yaw:gl.getUniformLocation(program,'uYaw'),tilt:gl.getUniformLocation(program,'uTilt'),depthRange:gl.getUniformLocation(program,'uDepthRange')};
  const faces=[
   [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
   [[0,0,-1],[[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5],[-.5,-.5,-.5]]],
   [[1,0,0],[[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],
   [[-1,0,0],[[-.5,.5,-.5],[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5]]],
   [[0,1,0],[[.5,.5,-.5],[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5]]],
   [[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]
  ];
  const verts=[];for(const [norm,quad] of faces){for(const i of [0,1,2,0,2,3])verts.push(...quad[i],...norm)}
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  const cube=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cube);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
  for(let i=0;i<2;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,i*12)}
  this.staticBuffer=gl.createBuffer();this.dynamicBuffer=gl.createBuffer();this.lodBuffer=gl.createBuffer();
  // Non-rectangular footprints use genuine roof and wall triangles rather than box approximations.
  const polyVs=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aColor;
  uniform vec2 uFocus,uResolution;uniform float uZoom,uYaw,uTilt,uDepthRange;
  out vec3 vColor;
  void main(){vec2 d=aPos.xy-uFocus;float cy=cos(uYaw),sy=sin(uYaw),st=sin(uTilt),ct=cos(uTilt);
   float rx=d.x*cy-d.y*sy,ry=d.x*sy+d.y*cy;
   gl_Position=vec4(rx*uZoom*2.0/uResolution.x,-(ry*st-aPos.z*ct)*uZoom*2.0/uResolution.y,-(ry*ct+aPos.z*st)/uDepthRange,1.0);
   vColor=aColor;}`;
  const polyFs=`#version 300 es
  precision mediump float;in vec3 vColor;out vec4 fragColor;void main(){fragColor=vec4(vColor,1.0);}`;
  const polyProgram=gl.createProgram();
  for(const [src,type] of [[polyVs,gl.VERTEX_SHADER],[polyFs,gl.FRAGMENT_SHADER]]){
   const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
   if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));
   gl.attachShader(polyProgram,sh);gl.deleteShader(sh)
  }
  gl.linkProgram(polyProgram);if(!gl.getProgramParameter(polyProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(polyProgram));
  this.polyProgram=polyProgram;this.polyBuffer=gl.createBuffer();this.polyVao=gl.createVertexArray();gl.bindVertexArray(this.polyVao);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.polyBuffer);
  for(const [loc,offset] of [[0,0],[1,12]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset)}
  this.polyUniforms={focus:gl.getUniformLocation(polyProgram,'uFocus'),resolution:gl.getUniformLocation(polyProgram,'uResolution'),zoom:gl.getUniformLocation(polyProgram,'uZoom'),yaw:gl.getUniformLocation(polyProgram,'uYaw'),tilt:gl.getUniformLocation(polyProgram,'uTilt'),depthRange:gl.getUniformLocation(polyProgram,'uDepthRange')};
  gl.bindVertexArray(this.vao);
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  gl.disable(gl.BLEND);gl.clearColor(.085,.12,.15,1);
  // One texture-mapped plane spans the complete map. The horde image is updated
  // offscreen at a fixed cadence, avoiding one WebGL draw call per hot cell.
  const heatVs=`#version 300 es
  precision highp float;layout(location=0) in vec2 aWorld;layout(location=1) in vec2 aUv;
  uniform vec2 uFocus,uResolution;uniform float uZoom,uYaw,uTilt,uDepthRange;
  out vec2 vUv;
  void main(){vec2 d=aWorld-uFocus;float cy=cos(uYaw),sy=sin(uYaw),st=sin(uTilt),ct=cos(uTilt),z=-0.08;
   float rx=d.x*cy-d.y*sy,ry=d.x*sy+d.y*cy;
   gl_Position=vec4(rx*uZoom*2.0/uResolution.x,-(ry*st-z*ct)*uZoom*2.0/uResolution.y,-(ry*ct+z*st)/uDepthRange,1.0);vUv=aUv;}`;
  const heatFs=`#version 300 es
  precision mediump float;uniform sampler2D uHeat;in vec2 vUv;out vec4 fragColor;
  void main(){vec4 heat=texture(uHeat,vUv);float a=heat.a;if(a<.006)discard;float bright=max(heat.r,max(heat.g,heat.b));vec3 tint=heat.rgb/max(.003,bright);vec3 glow=min(vec3(1.0),tint*(.34+bright*1.25));fragColor=vec4(glow,min(.94,a*.92));}`;
  const hp=gl.createProgram();for(const [src,type] of [[heatVs,gl.VERTEX_SHADER],[heatFs,gl.FRAGMENT_SHADER]]){
   const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(hp,shader);gl.deleteShader(shader)
  }
  gl.linkProgram(hp);if(!gl.getProgramParameter(hp,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(hp));
  this.heatProgram=hp;this.heatUniforms={focus:gl.getUniformLocation(hp,'uFocus'),resolution:gl.getUniformLocation(hp,'uResolution'),zoom:gl.getUniformLocation(hp,'uZoom'),yaw:gl.getUniformLocation(hp,'uYaw'),tilt:gl.getUniformLocation(hp,'uTilt'),depthRange:gl.getUniformLocation(hp,'uDepthRange'),heat:gl.getUniformLocation(hp,'uHeat')};
  this.heatPlaneBuffer=gl.createBuffer();this.heatPlaneVao=gl.createVertexArray();gl.bindVertexArray(this.heatPlaneVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.heatPlaneBuffer);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);
  this.heatTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.heatTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
  gl.bindVertexArray(this.vao);
 }
 parseColor(color){if(Array.isArray(color))return color;let v=this.palette.get(color);if(v)return v;
  const hex=color.replace('#','');let vals=hex.length===3?hex.split('').map(c=>parseInt(c+c,16)/255):[0,2,4].map(i=>parseInt(hex.substring(i,i+2),16)/255);
  this.palette.set(color,vals);return vals;
 }
 box(list,x,y,z,sx,sy,sz,color,ang=0){if(sx<=0||sy<=0||sz<=0)return;const c=this.parseColor(color);list.push(x,y,z,sx,sy,sz,c[0],c[1],c[2],ang)}
 rebuild(){for(const _ of this.rebuildSteps()){} }
 async rebuildAsync(onProgress){const gen=this.rebuildSteps();let done=false,n=0;while(!done){const until=performance.now()+7;do{const result=gen.next();done=!!result.done;n++}while(!done&&performance.now()<until);onProgress?.(n);if(!done)await nextLoadFrame()}}
 *rebuildSteps(){if(!this.ready)return;this.needsBuild=false;const a=[],box=(...v)=>this.box(a,...v);
  box(VIS_W/2,VIS_H/2,-10,VIS_W,VIS_H,12,isNYC()?'#143f61':'#72817c');
  if(isNYC()){
    // Adaptive terrain: large tiles inland, progressively smaller ones at coastlines
    // and both riverbanks. This avoids floating land tiles without flooding mobile GPUs.
    const tile=96*nycScale(),colors={Manhattan:'#275a75',Brooklyn:'#2a6078',Queens:'#306781',Bronx:'#24566f','Staten Island':'#2c6178'};
    const putLand=(cx,cy,width,depth)=>{
      const half=width/2,quarter=width/4,borough=nycFullCityPreview()?nycPreviewBoroughAt(cx,cy):nycBoroughAt(cx,cy);
      let mixed=false;
      for(const [ox,oy] of [[-half,-half],[half,-half],[-half,half],[half,half],[-half,0],[half,0],[0,-half],[0,half]]){
       if((nycFullCityPreview()?nycPreviewBoroughAt(cx+ox*.985,cy+oy*.985):nycBoroughAt(cx+ox*.985,cy+oy*.985))!==borough){mixed=true;break}
      }
      if(mixed&&depth<3){for(const ox of [-quarter,quarter])for(const oy of [-quarter,quarter])putLand(cx+ox,cy+oy,width*.5,depth+1)}
      else if(borough)box(cx,cy,-4,width+.9,width+.9,2.2,nycFullCityPreview()&&!nycUnlocked(borough)?'#7c8487':colors[borough]);
    };
    for(let yy=tile/2;yy<H;yy+=tile){for(let xx=tile/2;xx<W;xx+=tile)putLand(xx,yy,tile,0);yield 1;}
  }
  if(activeMap==='nyc'){const cp=CENTRAL_PARK_POLY.map(p=>({x:p.x*nycScale(),y:p.y*nycScale()}));for(let y=Math.min(...cp.map(p=>p.y));y<Math.max(...cp.map(p=>p.y));y+=65)for(let x=Math.min(...cp.map(p=>p.x));x<Math.max(...cp.map(p=>p.x));x+=65)if(manhattanPark(x,y)&&withinManhattan(x,y))box(x,y,-2.3,66,66,1.6,'#558766')}
  for(const p of parks){box(p.x+p.w/2,p.y+p.h/2,-2,p.w+16,p.h+16,1.6,p.locked?'#858b89':'#5b9177');
   if(p.locked)continue;for(const tree of p.trees){box(tree.x,tree.y,3.6,2.5,2.5,8,'#705c42');box(tree.x,tree.y,9,10,10,8,'#4d8466');box(tree.x-1.2,tree.y-.5,13,6.5,6.5,3,'#66a581')}}
  for(const l of lots)box(l.x+l.w/2,l.y+l.h/2,-2,l.w,l.h,1.7,l.locked?'#657078':'#224d67');
  if(isNYC()){
   // Short visible street segments stop at the real-world-shaped coastline.
   const stride=activeMap==='nyc'?260:42*nycScale(),streetWidth=activeMap==='nyc'?1:nycScale();
   for(const x of XROADS)for(let y=20;y<H-20;y+=stride){if(!(nycFullCityPreview()?nycPreviewBoroughAt(x,y):nycLandAt(x,y))||(activeMap==='nyc'&&withinManhattan(x,y)))continue;
     box(x,y,-2.7,34*streetWidth,stride+1,2,nycFullCityPreview()&&!nycLandAt(x,y)?'#767c80':'#45565b');box(x,y,-1.6,26*streetWidth,stride+1,1,nycFullCityPreview()&&!nycLandAt(x,y)?'#666e72':'#394b52')}
   for(const y of YROADS)for(let x=20;x<W-20;x+=stride){if(!(nycFullCityPreview()?nycPreviewBoroughAt(x,y):nycLandAt(x,y))||(activeMap==='nyc'&&withinManhattan(x,y)))continue;
     box(x,y,-2.5,stride+1,34*streetWidth,2,nycFullCityPreview()&&!nycLandAt(x,y)?'#767c80':'#45565b');box(x,y,-1.5,stride+1,26*streetWidth,1,nycFullCityPreview()&&!nycLandAt(x,y)?'#666e72':'#394b52')}
   if(activeMap==='nyc')for(const r of manhattanRoads){box(r.x,r.y,-2.4,r.w,r.h+4,2,'#4a5f64',r.angle);box(r.x,r.y,-1.35,r.w,r.h*.72,1.2,'#405358',r.angle)}
  }else{
  for(const x of VIS_XROADS){const future=x>W;box(x,VIS_H/2,-3.3,54,VIS_H,2,future?'#787f80':'#4c5a61');box(x,VIS_H/2,-2.2,41,VIS_H,1,future?'#6d7476':'#34434c');
   for(let y=18;y<VIS_H-12;y+=75)box(x,y,-1.46,1.8,30,.8,y>H?'#9ba0a0':'#b5b6a0')}
  for(const y of VIS_YROADS){const future=y>H;box(VIS_W/2,y,-3.1,VIS_W,54,2,future?'#787f80':'#4c5a61');box(VIS_W/2,y,-2.1,VIS_W,41,1,future?'#6d7476':'#34434c');
   for(let x=18;x<VIS_W-12;x+=75)box(x,y,-1.35,30,1.8,.8,x>W?'#9ba0a0':'#b5b6a0')}}
  if(activeMap==='nyc'||activeMap==='nyc_megascale')for(let i=1;i<NYC_EAST_RIVER.length;i++){
   const a=NYC_EAST_RIVER[i-1],b=NYC_EAST_RIVER[i],scale=nycScale(),dx=b.x-a.x,dy=b.y-a.y;
   const len=Math.hypot(dx,dy)*scale,angle=Math.atan2(dy,dx),midX=(a.x+b.x)*.5*scale,midY=(a.y+b.y)*.5*scale;
   box(midX,midY,-.45,len+NYC_EAST_RIVER_WIDTH[i]*scale,NYC_EAST_RIVER_WIDTH[i]*2*scale,1.6,'#39768b',angle);
  }
  if(activeMap==='nyc')for(let i=1;i<NYC_HARLEM_RIVER.length;i++){
   const a=NYC_HARLEM_RIVER[i-1],b=NYC_HARLEM_RIVER[i],sc=nycScale(),dx=b.x-a.x,dy=b.y-a.y;
   const len=Math.hypot(dx,dy)*sc,ang=Math.atan2(dy,dx),midX=(a.x+b.x)*.5*sc,midY=(a.y+b.y)*.5*sc;
   box(midX,midY,-.45,len+NYC_HARLEM_WIDTH[i]*sc,NYC_HARLEM_WIDTH[i]*2*sc,1.6,'#39768b',ang);
  }
  if(activeMap==='nyc')for(let i=1;i<NYC_NEWTOWN_CREEK.length;i++){
   const a=NYC_NEWTOWN_CREEK[i-1],b=NYC_NEWTOWN_CREEK[i],sc=nycScale(),dx=b.x-a.x,dy=b.y-a.y;
   box((a.x+b.x)*.5*sc,(a.y+b.y)*.5*sc,-.45,Math.hypot(dx,dy)*sc+NYC_NEWTOWN_WIDTH[i]*sc,NYC_NEWTOWN_WIDTH[i]*2*sc,1.6,'#39768b',Math.atan2(dy,dx));
  }
  for(const r of rivers){box(r.x+r.w/2,H/2,-1.25,r.w+19,H,2.7,'#407c8d');
   box(r.x-9,H/2,-1.15,7,H,2.9,'#bdbea7');box(r.x+r.w+9,H/2,-1.15,7,H,2.9,'#bdbea7');
   for(let y=25;y<H;y+=95)box(r.x+16+(y%13),y,0,22,1.8,.5,'#79b3b5')}
  this.sceneGroundCount=a.length/10;
  const lod=[];const lodBox=(...v)=>this.box(lod,...v);
  const baseColors=['#b2b7b2','#9eafb4','#c3b5a5','#8fa2a8','#b4b8b5','#a7a99e','#a3b9bc'];
  const addSkyscraper=(b,cx,cy,w,h,col,angle=0)=>{const core=buildingCoreHeight(b),top=buildingHeight(b),spire=core>=390?Math.min(48,core*.095):0,roofTop=top-spire,baseTop=core*.70,shoulderBase=core*.51,shoulderTop=roofTop*.84,crownBase=roofTop*.70;
   box(cx,cy,baseTop*.5,w,h,baseTop,col,angle);
   box(cx,cy,(shoulderBase+shoulderTop)*.5,w*.78,h*.78,shoulderTop-shoulderBase,b.shade>.54?'#b7c7c8':'#9eb3ba',angle);
   box(cx,cy,(crownBase+roofTop)*.5,w*.55,h*.55,roofTop-crownBase,'#c5d2d0',angle);
   box(cx,cy,roofTop+.9,w*.58,h*.58,1.8,'#dbe3db',angle);
   if(spire)box(cx,cy,roofTop+spire*.5,2.6,2.6,spire,'#dce8e3',angle)
  };
  for(let bi=0;bi<buildings.length;bi++){if(bi%90===0)yield 1;const b=buildings[bi];if(b.collapsing||b.verts)continue;const core=buildingCoreHeight(b),h=buildingHeight(b),tower=isNYC()&&h>core+1,cx=b.cx??b.x+b.w*.5,cy=b.cy??b.y+b.h*.5,col=baseColors[b.roof%baseColors.length];
   lodBox(cx,cy,h*.5,b.footW||b.w,b.footH||b.h,h,b.locked?'#9da2a4':col,b.angle||0);
   if(b.locked){box(cx,cy,h*.5,b.footW||b.w,b.footH||b.h,h,['#9da2a4','#aeb2b3','#8b9295','#b9bdbd'][b.roof%4],b.angle||0);continue}
   if(b.footW){if(b.collapsed){box(cx,cy,2.3,b.footW,b.footH,4,'#77837b',b.angle);continue}if(tower){addSkyscraper(b,cx,cy,b.footW,b.footH,col,b.angle);continue}box(cx,cy,h*.5,b.footW,b.footH,h,col,b.angle);box(cx,cy,h+.8,b.footW+1.3,b.footH+1.3,1.7,'#c8d4cf',b.angle);if(b.vent)box(cx,cy,h+3.2,7,6,5,'#667e7d',b.angle);continue}
   if(b.collapsed){for(let k=0;k<3;k++){const off=(k-1)*b.w*.18;box(cx+off,cy+(k-1)*b.h*.11,2.5+k*.6,b.w*.65,b.h*.37,3.8,k%2?'#747b74':'#6e7775',(k-1)*.3)}continue}
   if(tower){addSkyscraper(b,cx,cy,b.w,b.h,col);continue}
   box(cx,cy,h*.5,b.w,b.h,h,col);
   box(cx,cy,h+.85,b.w+1.4,b.h+1.4,1.8,b.shade>.5?'#cfd5cd':'#b0c1c1');
   if(b.vent){box(b.x+b.w*.28,b.y+b.h*.25,h+4,8,7,6,'#5c7076');box(b.x+b.w*.28,b.y+b.h*.25,h+7.6,9,8,1.1,'#a6b9b7')}
   if(b.solar&&b.w>30)box(b.x+b.w*.67,b.y+b.h*.55,h+2.3,Math.min(17,b.w*.36),11,2.6,'#3b606e');
   // Repeating façade strips make building heights readable as actual 3D volumes.
   if(b.w>30&&b.height>1){for(let k=1;k<=Math.min(5,b.height*2);k++){const zz=k*h/(Math.min(5,b.height*2)+1);
      box(cx,b.y+b.h+.15,zz,b.w*.56,.7,1.4,'#516d7b');}}
  }
  let polygons=new Float32Array();if(window.CityfallPolygonMesh){const iterator=CityfallPolygonMesh.buildSteps(buildings);let state;do{state=iterator.next();if(!state.done)yield 1}while(!state.done);polygons=state.value||polygons}
  this.polyData=polygons;this.polyCount=this.polyData.length/6;yield 1;
  this.staticData=new Float32Array(a);this.staticCount=a.length/10;
  this.lodData=new Float32Array(lod);this.lodCount=lod.length/10;
  // Build a once-per-map spatial index: each frame only sees nearby building meshes.
  // Each bucket holds indices into prebuilt Float32Arrays, not duplicated geometry.
  if(this.software){
   const tile=isNYC()?1000:380,buildIndex=(arr,start)=>{
    const grid=new Map();for(let i=start;i<arr.length;i+=10){const key=Math.floor(arr[i]/tile)+','+Math.floor(arr[i+1]/tile);let bucket=grid.get(key);if(!bucket){bucket=[];grid.set(key,bucket)}bucket.push(i)}return grid;
   };
   this.softwareChunks={tile,full:buildIndex(this.staticData,this.sceneGroundCount*10),lod:buildIndex(this.lodData,0)};
   return;
  }
  const gl=this.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER,this.staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.staticData,gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.lodBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.lodData,gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.polyBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.polyData,gl.STATIC_DRAW)
 }
 addSegment(list,x1,y1,x2,y2,z,height,width,color){const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);if(len<.2)return;this.box(list,(x1+x2)/2,(y1+y2)/2,z,len,width,height,color,Math.atan2(dy,dx))}
 makeZoneWalls(list,z){const box=(...v)=>this.box(list,...v);
  if(z.verts){const v=zoneVertices(z),area=zoneArea(z),grid=Math.max(24,Math.sqrt(area/180));for(let yy=z.y+grid*.5;yy<z.y+z.h;yy+=grid)for(let xx=z.x+grid*.5;xx<z.x+z.w;xx+=grid)if(isInZone(xx,yy,z,-grid*.35))box(xx,yy,.1,grid*.97,grid*.97,.7,'#3b9279');
   for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<2)continue;const cuts=gates.filter(g=>g.zoneId===z.id&&g.side==='poly'&&g.edgeIndex===i&&g.hp>0).map(g=>clamp(((g.x-a.x)*dx+(g.y-a.y)*dy)/len,0,len)).sort((x,y)=>x-y);let last=0;const part=(lo,hi)=>{if(hi-lo<=1)return;this.addSegment(list,a.x+dx*lo/len,a.y+dy*lo/len,a.x+dx*hi/len,a.y+dy*hi/len,5.5,11,3,'#79d9ba')};for(const q of cuts){part(last,Math.max(last,q-18));last=Math.max(last,q+18)}part(last,len)}
   for(const g of gates.filter(g=>g.zoneId===z.id)){box(g.x,g.y,3,36,6,5,g.hp>0?'#f2c67d':'#8d5150',g.angle||0);const co=Math.cos(g.angle||0),si=Math.sin(g.angle||0);for(const off of [-18,18])box(g.x+co*off,g.y+si*off,8,5,5,16,'#c6e6ce')}
   return}
box(z.x+z.w*.5,z.y+z.h*.5,.25,z.w,z.h,.7,'#3b9279');
  const lines=[['top',z.x,z.y,z.x+z.w,z.y],['bottom',z.x,z.y+z.h,z.x+z.w,z.y+z.h],['left',z.x,z.y,z.x,z.y+z.h],['right',z.x+z.w,z.y,z.x+z.w,z.y+z.h]];
  for(const [side,x1,y1,x2,y2] of lines){const vertical=side==='left'||side==='right',lo=vertical?y1:x1,hi=vertical?y2:x2;
   const cuts=gates.filter(g=>g.zoneId===z.id).map(g=>({g,a:vertical?g.y:g.x})).filter(o=>o.g.side===side&&o.g.hp>0).map(o=>[o.a-18,o.a+18]).sort((a,b)=>a[0]-b[0]);
   let last=lo;
   for(const [a,b] of cuts){const begin=clamp(a,lo,hi),end=clamp(b,lo,hi);if(begin>last+1)this.addSegment(list,vertical?x1:last,vertical?last:y1,vertical?x1:begin,vertical?begin:y1,5.5,11,3,'#79d9ba');last=Math.max(last,end)}
   if(hi>last+1)this.addSegment(list,vertical?x1:last,vertical?last:y1,vertical?x1:hi,vertical?hi:y1,5.5,11,3,'#79d9ba');
  }
  for(const g of gates.filter(g=>g.zoneId===z.id)){const reinforced=Math.max(0,(g.level||1)-1),vertical=g.side==='left'||g.side==='right';
   box(g.x,g.y,2+reinforced*.22,vertical?6+reinforced*1.6:36,vertical?36:6+reinforced*1.6,3+reinforced*.65,g.hp>0?(reinforced?'#86ddd1':'#f2c67d'):'#8d5150');
   if(g.hp>0&&reinforced){for(let band=1;band<=Math.min(4,reinforced);band++){
     const offset=(band-(reinforced+1)/2)*6;
     box(g.x+(vertical?offset:0),g.y+(vertical?0:offset),6+band*.4,vertical?2.4:31,vertical?31:2.4,2,'#e2eac8')}}
    if(g.hp>0){for(const off of [-18,18])box(g.x+(vertical?0:off),g.y+(vertical?off:0),8,5,5,16,'#c6e6ce')}}
 }
 addDefenseMeshes(a,u){const floorZ=(u.type==='helicopter'||u.type==='attackheli'||u.type==='tank'||u.type==='infantry')?0:(u.roofHeight||0),box=(x,y,z,...v)=>this.box(a,x,y,z+floorZ,...v),rot=u.rotation||0,xx=u.x,yy=u.y,offset=(dx,dy)=>({x:xx+Math.cos(rot)*dx-Math.sin(rot)*dy,y:yy+Math.sin(rot)*dx+Math.cos(rot)*dy});
  if(u.type==='helicopter'||u.type==='attackheli'){
   const z=u.type==='attackheli'?68:55,attack=u.type==='attackheli',t=attack?'#659daf':'#9fb9b8';
   box(xx,yy,1,23,11,1,'#294b55',rot);
   box(xx,yy,z,32,14,10,t,rot);let tail=offset(-28,0);box(tail.x,tail.y,z+1,39,3,3,'#849fa4',rot);
   let fin=offset(-43,0);box(fin.x,fin.y,z+6,5,3,13,'#718d98',rot);
   box(xx,yy,z+7,6,6,5,'#526b75',rot);
   const spin=time*12+(u.id%30),span=attack?50:42;
   box(xx,yy,z+11,span,1.6,1.2,'#e1eeeb',spin);box(xx,yy,z+11,span,1.6,1.2,'#c0d5d5',spin+Math.PI*.5);
   for(const q of [-1,1]){const pp=offset(0,q*9);box(pp.x,pp.y,z-7,26,2.1,2.5,'#5e7176',rot)}
  }else if(u.type==='battleship'){
   box(xx,yy,3,110,25,5,'#3f616c',rot);box(xx,yy,7,91,20,5,'#afc3c7',rot);box(xx,yy,12,36,17,11,'#678997',rot);
   for(const side of [-1,1]){const pp=offset(side*34,0);box(pp.x,pp.y,12,16,13,8,'#849daa',rot);const muzzle=offset(side*34+12,0);box(muzzle.x,muzzle.y,14,28,4,4,'#cad7d3',rot)}
  }else if(u.type==='tank'){
   box(xx,yy,5.2,25,17,10,'#687363',rot);
   for(const q of [-1,1]){const pp=offset(0,q*10);box(pp.x,pp.y,4,28,6,7,'#293b39',rot)}
   box(xx,yy,12,14,13,7,'#8a9878',rot);let gun=offset(17,0);box(gun.x,gun.y,13.1,25,3,3,'#b4ae87',rot)
  }else if(u.type==='infantry'){
   box(xx,yy,4,5,5,8,'#608bab',rot);box(xx,yy,9.2,4,4,3,'#c0c3a9');let gun=offset(5,1);box(gun.x,gun.y,6.7,9,1.2,1.3,'#d4d3aa',rot)
  }else if(u.type==='sniper'){
   box(xx,yy,12,7,7,23,'#51616b');box(xx,yy,25,17,17,4,'#80acc7');box(xx,yy,29,18,18,2,'#dce7dc');const barrel=offset(17,0);box(barrel.x,barrel.y,28,25,2.2,2.2,'#c9dce2',rot)
  }else if(u.type==='garrison'){
   box(xx,yy,5,22,18,9,'#478c81');box(xx,yy,11,24,20,3,'#a1ddca');
   box(xx,yy-10,4,7,4,7,'#213d42');
   box(xx,yy,13,12,3,1.2,'#e8f4dd');
   box(xx,yy,14.2,3,11,1.2,'#e8f4dd');
   for(let k=0;k<Math.min(4,u.level||1);k++)box(xx-8+k*5,yy+7,13.5,3,2,1.2,'#f1d691')
  }else if(u.type==='mortar'){
   box(xx,yy,3.5,15,14,7,'#737783');box(xx,yy,10.5,6,7,11,'#c7bedc',rot);box(xx,yy,15,10,3,3,'#554d62',rot)
  }else if(u.type==='turret'){
   box(xx,yy,4.5,16,16,8,'#9b9a78');box(xx,yy,10.4,10,9,5,'#d3c385',rot);let muzzle=offset(12,0);box(muzzle.x,muzzle.y,11,18,2,3,'#d8d9ad',rot)
  }else if(u.type==='machinegun'){
   box(xx,yy,4.5,18,16,8,'#655b46');box(xx,yy,10,11,9,5,'#ba9658',rot);let gun=offset(13,0);box(gun.x,gun.y,11,24,2.8,2.8,'#e1c27c',rot);let tripod=offset(-3,0);box(tripod.x,tripod.y,4,22,2.1,2,'#303e3d',rot)
  }else if(u.type==='minefield'){
   box(xx,yy,.8,18,18,1.6,u.mineArmed?'#c58c55':'#6a6257',rot);for(const a of [0,TAU/3,TAU*2/3]){const p={x:xx+Math.cos(a)*8,y:yy+Math.sin(a)*8};box(p.x,p.y,1.8,3.1,3.1,2.5,u.mineArmed?'#e0c47e':'#827966')}
  }else if(u.type==='beacon'){
   box(xx,yy,10.5,3.2,3.2,21,'#73e0cd');box(xx,yy,24,12,12,5,'#9ff8e2')
  }
 }
 drawDynamic(){const a=this.dynamic;a.length=0;const box=(...v)=>this.box(a,...v),focus=cameraFocus(),cs=Math.cos(camera3D.yaw),sn=Math.sin(camera3D.yaw),sx=cw/(2*Math.max(NYC_MIN_ZOOM,cam.zoom))+170,sy=ch/(2*Math.max(NYC_MIN_ZOOM,cam.zoom)*Math.sin(camera3D.tilt))+190;
  const inView=(x,y)=>{const dx=x-focus.x,dy=y-focus.y;return Math.abs(dx*cs-dy*sn)<sx&&Math.abs(dx*sn+dy*cs)<sy};
  if(nycFullCityPreview())for(const b of futureBridges){
   const dx=b.bx-b.ax,dy=b.by-b.ay,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
   box((b.ax+b.bx)/2,(b.ay+b.by)/2,1.5,len+7,b.deckWidth,5,'#989e9e',angle);
   box((b.ax+b.bx)/2,(b.ay+b.by)/2,5,len+7,3,1.7,'#d1d1cf',angle);
  }
  for(const b of bridges){if(b.hp>0){if(b.ax!==undefined){
   const dx=b.bx-b.ax,dy=b.by-b.ay,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
   box((b.ax+b.bx)/2,(b.ay+b.by)/2,1.5,len+7,b.deckWidth,5,'#879a98',angle);
   box((b.ax+b.bx)/2,(b.ay+b.by)/2,5.1,len+7,3,2,'#e5e0c9',angle);
   continue}
   box(b.x+b.w/2,b.y+b.h/2,1,b.w,b.h,5,'#879a98');
    box(b.x+b.w/2,b.y+5,5,b.w,3,5,'#cfdbcd');box(b.x+b.w/2,b.y+b.h-5,5,b.w,3,5,'#cfdbcd');
    for(const xx of [b.x+12,b.x+b.w-12])box(xx,b.y+b.h/2,-1,7,b.h,13,'#778f90');
   }else{box(b.x+9,b.y+b.h/2,-1,17,b.h,3,'#666e6e');box(b.x+b.w-9,b.y+b.h/2,-1,17,b.h,3,'#666e6e')}}
  for(const b of fallingBuildings){if(!b.collapsing||!inView(b.x+b.w/2,b.y+b.h/2))continue;
   const s=b.collapsing,q=clamp(s.t/s.duration,0,1),h=s.height,cx=b.x+b.w*.5,cy=b.y+b.h*.5,floors=5;
   for(let i=0;i<floors;i++){const layer=(i+.5)/floors,z=h*layer*(1-q*.89),shift=Math.sin(q*Math.PI*.5)*h*layer*.88;
    box(cx+Math.cos(s.dir)*shift,cy+Math.sin(s.dir)*shift,Math.max(2,z),b.w*.94,b.h*.94,Math.max(1.8,h/floors*(1-q*.68)),['#a7b4af','#bcc7be','#9baaa7'][i%3],s.dir*q*.16)}
  }
  // Include a wide shelter whenever any part of its footprint overlaps the
  // camera, even when its center is far outside the current view.
  for(const z of zones){if(z.hp<=0)continue;
   const cx=z.x+z.w/2,cy=z.y+z.h/2,dx=cx-focus.x,dy=cy-focus.y,rad=Math.hypot(z.w,z.h)*.5;
   if(Math.abs(dx*cs-dy*sn)<sx+rad&&Math.abs(dx*sn+dy*cs)<sy+rad)this.makeZoneWalls(a,z)
  }
  for(const w of walls)if(w.hp>0&&inView((w.ax+w.bx)/2,(w.ay+w.by)/2)){this.addSegment(a,w.ax,w.ay,w.bx,w.by,5,10,6,w.hp/w.maxHp<.35?'#a36d5e':'#c5b07f');box(w.ax,w.ay,7,5.5,5.5,14,'#4b5c59');box(w.bx,w.by,7,5.5,5.5,14,'#4b5c59')}
  const detail=cam.zoom>(deviceProfile.constrained ? .64 : .46),visualScale=deviceProfile.visualScale;
  // At neighborhood zoom draw EVERY nearby moving cohort, not every Nth
  // cohort city-wide. Reuse the existing spatial index and a bounded cell
  // query so this is both denser and cheaper than scanning the full city.
  const maxVisibleCivs=Math.max(100,Math.round((cam.zoom<.035?180:cam.zoom<.14?560:cam.zoom<.32?2000:(this.software?3000:7200))*visualScale));
  let visibleCivs=0,extraCivs=0;
  const extraCap=cam.zoom<.32?0:Math.round((this.software?450:1100)*visualScale);
  const showCivilian=(p)=>{
   if(visibleCivs>=maxVisibleCivs||!p.alive||!inView(p.x,p.y))return;
   const color=civilianShirtColor(p);visibleCivs++;
   box(p.x,p.y,3.1,3.7,3.3,6.1,color);
   if(detail)box(p.x,p.y,7.7,3.2,3.2,3.2,'#ead6b6');
   // A cohort represents a small group. At walking-distance zoom, add up
   // to two purely visual companions beside it (no added AI/pathfinding).
   if(isNYC()&&cam.zoom>.29&&p.weight>1&&extraCivs<extraCap){
    const copies=Math.min(2,p.weight-1);
    for(let k=0;k<copies&&extraCivs<extraCap;k++){
     const angle=((p.id*2.399963+k*2.17)%TAU),r=5.1+k*2.9;
     const x=p.x+Math.cos(angle)*r,y=p.y+Math.sin(angle)*r;
     if(!walkable(x,y,1.2)||!inView(x,y))continue;
     const shade=CIVILIAN_SHIRT_COLORS[(p.id+k*7)%CIVILIAN_SHIRT_COLORS.length];
     box(x,y,3.0,3.1,3.1,5.9,shade);
     if(detail)box(x,y,7.1,2.7,2.7,2.8,'#ead6b6');
     extraCivs++;
    }
   }
  };
  const entityRadius=Math.hypot(sx,sy)+110,entityX0=Math.max(0,Math.floor((focus.x-entityRadius)/CELL)),entityX1=Math.min(GRIDCOLS-1,Math.ceil((focus.x+entityRadius)/CELL)),entityY0=Math.max(0,Math.floor((focus.y-entityRadius)/CELL)),entityY1=Math.min(Math.ceil(H/CELL)-1,Math.ceil((focus.y+entityRadius)/CELL)),localEntityCells=(entityX1-entityX0+1)*(entityY1-entityY0+1)<16000;
  const visitVisibleEntities=(grid,items,draw,limit,budget)=>{
   if(localEntityCells){outerEntities:for(let yy=entityY0;yy<=entityY1;yy++)for(let xx=entityX0;xx<=entityX1;xx++){
    for(const item of grid.get(xx+yy*GRIDCOLS)||[])draw(item);
    if(limit())break outerEntities;
   }}else{const step=Math.max(1,Math.ceil(items.length/Math.max(1,budget)));for(let i=0;i<items.length;i+=step)draw(items[i])}
  };
  visitVisibleEntities(civGrid,people,showCivilian,()=>visibleCivs>=maxVisibleCivs,maxVisibleCivs);
  // Weighted civilians at a gated entrance are visualized as a crowd.
  // The instanced draw cap preserves FPS even during mass evacuations.
  if(cam.zoom>.22)for(const g of gates){
   if(!g.waiting||!inView(g.x,g.y))continue;
   const visibleCount=Math.min(this.software?80:145,Math.ceil(Math.sqrt(g.waiting)*4.5));
   const normal=g.side==='poly'?[g.nx||0,g.ny||0]:g.side==='left'?[-1,0]:g.side==='right'?[1,0]:g.side==='top'?[0,-1]:[0,1];
   const tangent=[-normal[1],normal[0]];
   for(let i=0;i<visibleCount;i++){
    const angle=i*2.39996323+(g.id%17)*.23,r=Math.sqrt(i+1)*6.1;
    const depth=17+Math.abs(Math.cos(angle))*r*1.05;
    const sideways=Math.sin(angle)*r*.86;
    const px=g.x+normal[0]*depth+tangent[0]*sideways;
    const py=g.y+normal[1]*depth+tangent[1]*sideways;
    if(!walkable(px,py,1.2))continue;
    const drift=Math.sin(time*1.45+i*1.73)*.85;
    const x=px+normal[0]*drift,y=py+normal[1]*drift;
    box(x,y,2.9,3,3,5.8,queueShirtColor(i,g.id));
    if(detail&&i%2===0)box(x,y,7.5,2.6,2.6,3,'#e5cdb2')
   }
  }
  const zombieCap=Math.max(70,Math.round((cam.zoom<.035?130:cam.zoom<.14?360:cam.zoom<.32?850:(this.software?1150:2600))*visualScale));
  let visibleZombies=0;const showZombie=(z)=>{if(visibleZombies>=zombieCap||!z.alive||!inView(z.x,z.y))return;visibleZombies++;const c=z.flash>0?'#fff0c9':'#c84d54';
   box(z.x,z.y,3.7,4.3,4.3,7.3,c);if(detail)box(z.x,z.y,9.0,4.5,4.3,3.3,'#de786a')};
  visitVisibleEntities(zombieGrid,zombies,showZombie,()=>visibleZombies>=zombieCap,zombieCap);
  for(const u of defenses)if(u.hp>0&&!u.departed&&inView(u.x,u.y))this.addDefenseMeshes(a,u);
  for(const p of parachutes){const q=clamp(p.age/p.duration,0,1),height=(1-q)*(p.kind==='tank'?125:90);box(p.x,p.y,height+10,p.kind==='tank'?20:7,p.kind==='tank'?20:7,7,p.kind==='tank'?'#98a997':'#b0d5e4');box(p.x,p.y,height+28,p.kind==='tank'?31:18,p.kind==='tank'?31:18,3,'#e7e0c8')}
  for(const a2 of aircraft){const t=clamp(a2.age/a2.duration,0,1),x=a2.sx+(a2.ex-a2.sx)*t,y=a2.sy+(a2.ey-a2.sy)*t,rot=Math.atan2(a2.ey-a2.sy,a2.ex-a2.sx),h=125;
    box(x,y,h,66,10,8,'#b1c5c7',rot);box(x,y,h+3,19,75,3,'#8ca8b4',rot);
    const tlx=x-Math.cos(rot)*25,tly=y-Math.sin(rot)*25;box(tlx,tly,h+5,18,23,3,'#cedcda',rot)}
  for(const a2 of arrivals){const t=clamp(a2.age/a2.delay,0,1),pos={x:a2.x-100*(1-t),y:a2.y-75*(1-t)},dummy={id:0,type:a2.type,x:pos.x,y:pos.y,rotation:1};if(inView(pos.x,pos.y))this.addDefenseMeshes(a,dummy)}
  for(const s of shells){const t=clamp(s.age/s.duration,0,1),h=(s.z1||14)*(1-t)+Math.sin(Math.PI*t)*115,x=s.x1+(s.x2-s.x1)*t,y=s.y1+(s.y2-s.y1)*t;
   box(x,y,h,5,5,5,'#fff2bf')}
  for(const e of effects){if(!inView(e.x||e.x1||0,e.y||e.y1||0))continue;
   if(e.type==='blast'||e.type==='delayedblast'){const k=clamp(1-e.life/e.maxLife,0,1),size=Math.max(2,(e.max||45)*(.12+k*.64));box(e.x,e.y,3+size*.07,size,size,4,'#f3b85d')}
   if(e.type==='smoke'){const k=clamp(1-e.life/e.maxLife,0,1);box(e.x,e.y,9+k*14,Math.max(5,e.r*(1+k)),Math.max(5,e.r*(1+k)),8,'#626e70')}
  }
  return a;
 }
 // CPU isometric fallback for browsers that disable WebGL; the WebGL2 renderer above
 // is used whenever supported. The same projective camera and 3D coordinates apply.
 softBox(c,v){
  const x=v[0],y=v[1],z=v[2],w=v[3],h=v[4],d=v[5],angle=v[9];
  const cc= Math.cos(angle),ss=Math.sin(angle),col=[v[6]*255,v[7]*255,v[8]*255];
  const rgb=(f)=>`rgb(${Math.min(255,col[0]*f)|0},${Math.min(255,col[1]*f)|0},${Math.min(255,col[2]*f)|0})`;
  if(Math.max(w,h,d)<8){const p=project3D(x,y,z);c.fillStyle=rgb(1.13);c.fillRect(p.x-1.5,p.y-4,3,6);return}
  const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]],top=[],bottom=[];
  for(const [xx,yy] of corners){const gx=x+xx*cc-yy*ss,gy=y+xx*ss+yy*cc;top.push(project3D(gx,gy,z+d/2));bottom.push(project3D(gx,gy,z-d/2))}
  const polygon=(pts,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(let k=1;k<pts.length;k++)c.lineTo(pts[k].x,pts[k].y);c.closePath();c.fill()};
  const vy=Math.sin(camera3D.yaw),vx=Math.cos(camera3D.yaw),normal=[[ss,-cc],[cc,ss],[-ss,cc],[-cc,-ss]];
  for(let i=0;i<4;i++){const [nx,ny]=normal[i],viewx=Math.sin(camera3D.yaw),viewy=Math.cos(camera3D.yaw);if(nx*viewx+ny*viewy<0.02)continue;
   const j=(i+1)%4;polygon([bottom[i],bottom[j],top[j],top[i]],rgb(.48+(i%2)*.12))}
  polygon(top,rgb(1.02));
  if(w*cam.zoom>22&&h*cam.zoom>18){c.strokeStyle=`rgba(18,36,40,0.20)`;c.lineWidth=.65;c.beginPath();c.moveTo(top[0].x,top[0].y);for(let i=1;i<4;i++)c.lineTo(top[i].x,top[i].y);c.closePath();c.stroke()}
 }
 softPolygon(c,b){const pts=b.verts,h=b.collapsed?4:14+b.height*13;const top=pts.map(p=>project3D(p.x,p.y,h)),base=pts.map(p=>project3D(p.x,p.y,0));
  const fill=(poly,col)=>{c.fillStyle=col;c.beginPath();c.moveTo(poly[0].x,poly[0].y);for(const p of poly.slice(1))c.lineTo(p.x,p.y);c.closePath();c.fill()};
  for(let i=0;i<top.length;i++){const j=(i+1)%top.length;fill([base[i],base[j],top[j],top[i]],b.locked?'#647074':'#6b8a94')}
  fill(top,b.locked?'#a5abad':'#c6d5d1');
 }
 renderSoftware(){
  const c=this.ctx2;
  if(this.canvas.width!==canvas.width||this.canvas.height!==canvas.height){this.canvas.width=canvas.width;this.canvas.height=canvas.height}
  if(this.needsBuild||!this.staticData)this.rebuild();
  c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#1b2a31';c.fillRect(0,0,cw,ch);
  const f=cameraFocus(),cs=Math.cos(camera3D.yaw),sn=Math.sin(camera3D.yaw),st=Math.sin(camera3D.tilt);
  const sx=cw/(2*Math.max(NYC_MIN_ZOOM,cam.zoom))+190;
  const sy=ch/(2*Math.max(NYC_MIN_ZOOM,cam.zoom)*st)+210;
  const visible=(x,y)=>{const dx=x-f.x,dy=y-f.y;return Math.abs(dx*cs-dy*sn)<sx&&Math.abs(dx*sn+dy*cs)<sy};
  const useLod=lowDetailView(),moving=performance.now()<zoomPerf.movingUntil;
  const groundLimit=this.sceneGroundCount*10,staticData=this.staticData;
  // The static map is a cached ground texture, not a replacement for buildings:
  // all buildings / defenses below are still rendered as depth-sorted 3D boxes.
  if(useLod&&staticMap){
   const A=cs*cam.zoom,B=sn*st*cam.zoom,C=-sn*cam.zoom,D=cs*st*cam.zoom;
   c.save();c.setTransform(dpr*A,dpr*B,dpr*C,dpr*D,dpr*(cw/2-A*f.x-C*f.y),dpr*(ch/2-B*f.x-D*f.y));
   c.drawImage(staticMap,0,0,VIS_W,VIS_H);c.restore();
  }else{
   const groundStride=moving?2:1;
   for(let i=0;i<groundLimit;i+=10*groundStride){
    const x=staticData[i],y=staticData[i+1],w=staticData[i+3],h=staticData[i+4],radius=(w+h)*.55;
    const dx=x-f.x,dy=y-f.y,px=dx*cs-dy*sn,py=dx*sn+dy*cs;
    if(Math.abs(px)<sx+radius&&Math.abs(py)<sy+radius)this.softBox(c,staticData.subarray(i,i+10));
   }
  }
  drawSoftwareGroundHeat(c,visible);
  const data=this.drawDynamic(),items=[];
  const depth=(x,y)=>(x-f.x)*Math.sin(camera3D.yaw)+(y-f.y)*Math.cos(camera3D.yaw);
  const structures=useLod?this.lodData:staticData;
  const maxModels=moving?(cam.zoom<.08?500:950):(cam.zoom<.025?850:cam.zoom<.10?1450:cam.zoom<.22?2100:3600);
  // Spatial buckets prevent a far-zoom gesture from scanning and sorting all
  // NYC towers just because it crosses a 3D detail threshold.
  const chunks=this.softwareChunks;
  if(chunks){
   const rad=Math.hypot(sx,sy)+200,tile=chunks.tile,grid=useLod?chunks.lod:chunks.full;
   const loX=Math.floor((f.x-rad)/tile),hiX=Math.ceil((f.x+rad)/tile),loY=Math.floor((f.y-rad)/tile),hiY=Math.ceil((f.y+rad)/tile);
   const range=(hiX-loX+1)*(hiY-loY+1);
   if(range<25000){
    for(let iy=loY;iy<=hiY;iy++)for(let ix=loX;ix<=hiX;ix++){
     for(const i of grid.get(ix+','+iy)||[]){if(!visible(structures[i],structures[i+1]))continue;items.push({a:structures,i,depth:depth(structures[i],structures[i+1])})}
    }
   }
  }
  if(!chunks){for(let i=useLod?0:groundLimit;i<structures.length;i+=10)if(visible(structures[i],structures[i+1]))items.push({a:structures,i,depth:depth(structures[i],structures[i+1])})}
  // Spread decimation evenly across the map, so no one section goes blank.
  if(items.length>maxModels){const step=items.length/maxModels,chosen=[];for(let i=0;i<maxModels;i++)chosen.push(items[Math.floor(i*step)]);items.length=0;items.push(...chosen)}
  let polySeen=0;for(const b of buildings){if(!b.verts||b.collapsing||!visible(b.cx,b.cy))continue;
   if((++polySeen)%(cam.zoom<.025?9:cam.zoom<.12?3:1))continue;
   items.push({poly:b,depth:depth(b.cx,b.cy)});if(polySeen>2500)break;
  }
  for(let i=0;i<data.length;i+=10)if(visible(data[i],data[i+1]))items.push({a:data,i,depth:depth(data[i],data[i+1])});
  items.sort((a,b)=>a.depth-b.depth);
  for(const v of items){if(v.poly)this.softPolygon(c,v.poly);else this.softBox(c,v.a.subarray?v.a.subarray(v.i,v.i+10):v.a.slice(v.i,v.i+10))}
 }

 bindInstances(buffer,instanceOffset=0){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  for(const [loc,n,off] of [[2,3,0],[3,3,12],[4,3,24],[5,1,36]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,40,off+instanceOffset*40);gl.vertexAttribDivisor(loc,1)}}
 uploadDynamic(data){const gl=this.gl,needed=data.length;
  if(!this.dynamicUpload||this.dynamicUpload.length<needed){const capacity=Math.max(1024,2**Math.ceil(Math.log2(needed)));this.dynamicUpload=new Float32Array(capacity);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,capacity*4,gl.DYNAMIC_DRAW)}
  this.dynamicUpload.set(data,0);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamicBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.dynamicUpload,0,needed);return needed/10;
 }
 syncHeatPlane(){if(this.heatWorldW===W&&this.heatWorldH===H)return;const gl=this.gl;this.heatWorldW=W;this.heatWorldH=H;
  gl.bindBuffer(gl.ARRAY_BUFFER,this.heatPlaneBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,0,0,W,0,1,0,W,H,1,1,0,0,0,0,W,H,1,1,0,H,0,1]),gl.STATIC_DRAW)}
 renderHeatPlane(uniforms){const heat=updateZombieHeatmap();if((!heat.length&&!heatState.civilianCells.length)||!heatState.canvas)return;const gl=this.gl;this.syncHeatPlane();
  gl.useProgram(this.heatProgram);gl.bindVertexArray(this.heatPlaneVao);uniforms(this.heatUniforms);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.heatTexture);gl.uniform1i(this.heatUniforms.heat,0);
  // Canvas and world coordinates both increase downward.  Do not flip the
  // texture on upload or the shared civilian/zombie density image mirrors.
  if(heatState.dirty){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,heatState.canvas);heatState.dirty=false}
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,6);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(this.program);gl.bindVertexArray(this.vao);uniforms(this.uniforms)}
 render(){if(!this.ready)return;if(this.software)return this.renderSoftware();if(this.needsBuild||!this.staticData)this.rebuild();const gl=this.gl;
  if(this.canvas.width!==canvas.width||this.canvas.height!==canvas.height){this.canvas.width=canvas.width;this.canvas.height=canvas.height}
  gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.bindVertexArray(this.vao);
  const c=cameraFocus(),depthRange=Math.max(6000,Math.hypot(W,H)*1.15);
  const uniforms=(u)=>{gl.uniform2f(u.focus,c.x,c.y);gl.uniform2f(u.resolution,cw,ch);gl.uniform1f(u.zoom,cam.zoom);gl.uniform1f(u.yaw,camera3D.yaw);gl.uniform1f(u.tilt,camera3D.tilt);gl.uniform1f(u.depthRange,depthRange)};
  uniforms(this.uniforms);
  this.bindInstances(this.staticBuffer);gl.drawArraysInstanced(gl.TRIANGLES,0,36,this.sceneGroundCount);
  this.renderHeatPlane(uniforms);
  if(lowDetailView()){this.bindInstances(this.lodBuffer);gl.drawArraysInstanced(gl.TRIANGLES,0,36,this.lodCount)}
  else {this.bindInstances(this.staticBuffer,this.sceneGroundCount);gl.drawArraysInstanced(gl.TRIANGLES,0,36,this.staticCount-this.sceneGroundCount)}
  if(this.polyCount){gl.useProgram(this.polyProgram);gl.bindVertexArray(this.polyVao);uniforms(this.polyUniforms);
   gl.drawArrays(gl.TRIANGLES,0,this.polyCount);gl.useProgram(this.program);gl.bindVertexArray(this.vao);uniforms(this.uniforms)}
  const data=this.drawDynamic();if(data.length){const count=this.uploadDynamic(data);this.bindInstances(this.dynamicBuffer);gl.drawArraysInstanced(gl.TRIANGLES,0,36,count)}
 }}
const world3D=new CityRenderer();
// World-space weapon ranges, projected onto the actual 3D ground plane rather
// than drawn as screen-space circles (which looked incorrect when orbiting).
function drawProjectedRange(x,y,r,color,highlight=false,label='',arc=TAU,rotation=0){
 if(!r||!Number.isFinite(r)||r<=0)return;
 const full=arc>=TAU-.001,segments=cam.zoom>.5?64:48,verts=[],size=cam.zoom*r;
 for(let i=0;i<=segments;i++){const a=full?i/segments*TAU:rotation-arc*.5+arc*i/segments;verts.push(project3D(x+Math.cos(a)*r,y+Math.sin(a)*r,3.1))}
 ctx.save();ctx.beginPath();if(full){ctx.moveTo(verts[0].x,verts[0].y);for(let i=1;i<verts.length;i++)ctx.lineTo(verts[i].x,verts[i].y)}else{const base=project3D(x,y,3.1);ctx.moveTo(base.x,base.y);for(const p of verts)ctx.lineTo(p.x,p.y)}ctx.closePath();
 ctx.fillStyle=highlight?'#7ce9d01e':'#7ce9d009';ctx.fill();ctx.strokeStyle=color;
 ctx.globalAlpha=highlight?.96:.42;ctx.lineWidth=highlight?2.5:1.3;ctx.setLineDash(highlight?[]:[7,8]);ctx.stroke();ctx.setLineDash([]);
 if(highlight){const base=project3D(x,y,5);ctx.globalAlpha=.56;ctx.lineWidth=1;for(let a=0;a<TAU-.1;a+=Math.PI/2){const e=project3D(x+Math.cos(a)*r,y+Math.sin(a)*r,3.1);ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(e.x,e.y);ctx.stroke()}
 const top=project3D(x,y-r,6),lbl=(label||'RANGE')+' · '+Math.round(r)+'m';ctx.globalAlpha=1;ctx.font='800 11px system-ui';const tw=ctx.measureText(lbl).width;const lx=clamp(top.x,tw/2+5,cw-tw/2-5),ly=clamp(top.y-13,18,ch-18);ctx.fillStyle='#10242bf0';ctx.fillRect(lx-tw/2-9,ly-10,tw+18,20);ctx.strokeStyle=color;ctx.strokeRect(lx-tw/2-9,ly-10,tw+18,20);ctx.fillStyle='#ebfff6';ctx.textAlign='center';ctx.fillText(lbl,lx,ly+1)}
 ctx.restore();}
function render3DRanges(){let count=0;
 if(showRanges)for(const u of defenses){if(u.hp<=0||!u.range||u.departed||u===selected)continue;const q=project3D(u.x,u.y,2);if(q.x< -320||q.x>cw+320||q.y< -320||q.y>ch+320)continue;
 if(count++>=22)break;drawProjectedRange(u.x,u.y,u.range*(1+.13*(u.level-1)),'#6dc2b8',false,'',u.arc||TAU,u.rotation||0)}
 if(selected?.range&&selected.hp>0)drawProjectedRange(selected.x,selected.y,selected.range*(1+.13*(selected.level-1)),'#c5ffe3',true,unitSpec(selected.type)?.name||'Unit',selected.arc||TAU,selected.rotation||0);
 if(toolId&&!['zone','wall','gate','strafe'].includes(toolId)&&Number.isFinite(mouse.wx)){const t=unitSpec(toolId),r=t?.range||(toolId==='airstrike'?130:toolId==='paratroopers'?85:0);
 if(r)drawProjectedRange(mouse.wx,mouse.wy,r,'#f8d18c',true,t?.name||'Support')}
}

let strategicRoofs=null; // compatibility with collapse event invalidation
// Compact density texture shared by GPU and software renderers. The canvas is
// one image for the entire world; it never replaces the 3D scene or models.
const heatState={until:0,cells:[],civilianCells:[],cell:64,zombieCell:44,civilianCell:56,canvas:null,ctx:null,stamps:{},dirty:true,width:0,height:0,glowScale:1,hordeOpacity:1};
function ensureHeatCanvas(){
 const wide=W>=H,base=isNYC()?deviceProfile.heatBase:Math.min(512,deviceProfile.heatBase),w=wide?base:Math.max(2,Math.round(base*W/H)),h=wide?Math.max(2,Math.round(base*H/W)):base;
 if(heatState.canvas&&heatState.width===w&&heatState.height===h)return heatState.canvas;
 heatState.canvas=document.createElement('canvas');heatState.canvas.width=w;heatState.canvas.height=h;heatState.ctx=heatState.canvas.getContext('2d');heatState.width=w;heatState.height=h;heatState.dirty=true;return heatState.canvas;
}
function heatmapStamp(kind='zombie'){if(heatState.stamps[kind])return heatState.stamps[kind];const stamp=document.createElement('canvas');stamp.width=128;stamp.height=128;
 const c=stamp.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);
 if(kind==='civilian'){g.addColorStop(0,'rgba(55,183,177,.44)');g.addColorStop(.20,'rgba(38,151,164,.30)');g.addColorStop(.50,'rgba(31,111,151,.14)');g.addColorStop(.78,'rgba(22,78,134,.04)');g.addColorStop(1,'rgba(10,70,130,0)')}
 else{g.addColorStop(0,'rgba(218,43,49,.68)');g.addColorStop(.18,'rgba(202,34,44,.52)');g.addColorStop(.48,'rgba(174,25,39,.27)');g.addColorStop(.76,'rgba(134,13,29,.08)');g.addColorStop(1,'rgba(110,0,20,0)')}
 c.fillStyle=g;c.fillRect(0,0,128,128);heatState.stamps[kind]=stamp;return stamp;
}
function hordeGlowScale(){return clamp(.72/Math.sqrt(Math.max(.05,cam.zoom)),.42,1.5)}
// Horde density is strategic information at city scale, then gracefully gets
// out of the way as individual infected become readable at street scale.
function hordeGlowOpacity(){const fade=clamp((.56-cam.zoom)/.20,0,1);return fade*fade}
function zombieHeatCellSize(){return cam.zoom>.52?18:cam.zoom>.24?27:36}
function civilianHeatCellSize(){return cam.zoom>.52?36:cam.zoom>.24?45:54}
function paintHordeTexture(){
 const surface=ensureHeatCanvas(),c=heatState.ctx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,surface.width,surface.height);
 const scale=Math.sqrt(surface.width*surface.height/(W*H)),paint=(cells,kind,base,spread,alpha)=>{if(!cells.length||alpha<=.002)return;const stamp=heatmapStamp(kind);c.save();c.globalCompositeOperation=kind==='zombie'?'source-over':'lighter';
  for(const b of cells){const radius=Math.max(3.5,clamp(base+Math.sqrt(b.count)*spread,base,kind==='civilian'?220:260)*scale*heatState.glowScale),x=b.x/W*surface.width,y=b.y/H*surface.height;c.globalAlpha=alpha*Math.min(1,.62+Math.log2(b.count+1)*.10);c.drawImage(stamp,x-radius,y-radius,radius*2,radius*2)}c.restore()};
 // Red horde stamps are source-over and drawn last, so infection always wins
 // visual priority over a civilian crowd occupying the same area.
 paint(heatState.civilianCells,'civilian',54,10,.16);paint(heatState.cells,'zombie',50,10,.52*heatState.hordeOpacity);
 heatState.dirty=true;
}
function updateZombieHeatmap(now=performance.now()){
 if(!zombies.length&&!people.length){if(heatState.cells.length||heatState.civilianCells.length){heatState.cells=[];heatState.civilianCells=[];paintHordeTexture()}return heatState.cells}
 // Refresh quickly enough to follow moving pockets, while sample limits keep
 // older phones free from a large per-frame allocation.
 const glowScale=hordeGlowScale(),hordeOpacity=hordeGlowOpacity(),zombieCell=zombieHeatCellSize(),civilianCell=civilianHeatCellSize();
 if(now<heatState.until&&Math.abs(glowScale-heatState.glowScale)<.035&&Math.abs(hordeOpacity-heatState.hordeOpacity)<.04&&zombieCell===heatState.zombieCell&&civilianCell===heatState.civilianCell)return heatState.cells;
 heatState.until=now+(deviceProfile.constrained?210:deviceProfile.touch?145:92);
 heatState.glowScale=glowScale;
 heatState.hordeOpacity=hordeOpacity;
 const bins=new Map(),civilianBins=new Map();
 const stride=Math.max(1,Math.ceil(zombies.length/(deviceProfile.constrained?3600:deviceProfile.touch?6500:9800)));
 for(let i=0;i<zombies.length;i+=stride){
  const z=zombies[i];if(!z.alive||z.incubate>0)continue;
  const gx=Math.floor(z.x/zombieCell),gy=Math.floor(z.y/zombieCell),key=gx+','+gy;
  let b=bins.get(key);if(!b){b={x:0,y:0,n:0};bins.set(key,b)}
  b.x+=z.x;b.y+=z.y;b.n++;
 }
 const civilianStride=Math.max(1,Math.ceil(people.length/(deviceProfile.constrained?3200:deviceProfile.touch?5200:7600)));
 for(let i=0;i<people.length;i+=civilianStride){const p=people[i];if(!p.alive)continue;
  const gx=Math.floor(p.x/civilianCell),gy=Math.floor(p.y/civilianCell),key=gx+','+gy;
  let b=civilianBins.get(key);if(!b){b={x:0,y:0,n:0,weight:0};civilianBins.set(key,b)}
  b.x+=p.x;b.y+=p.y;b.n++;b.weight+=(p.weight||1)*civilianStride;
 }
 heatState.cells=Array.from(bins.values(),b=>({x:b.x/b.n,y:b.y/b.n,count:b.n*stride}));
 heatState.civilianCells=Array.from(civilianBins.values(),b=>({x:b.x/b.n,y:b.y/b.n,count:b.weight}));
 heatState.cell=zombieCell;heatState.zombieCell=zombieCell;heatState.civilianCell=civilianCell;
 paintHordeTexture();
 return heatState.cells;
}
function drawSoftwareGroundHeat(c){
 const cells=updateZombieHeatmap();if((!cells.length&&!heatState.civilianCells.length)||!heatState.canvas)return;
 const f=cameraFocus(),cs=Math.cos(camera3D.yaw),sn=Math.sin(camera3D.yaw),st=Math.sin(camera3D.tilt),A=cs*cam.zoom,B=sn*st*cam.zoom,C=-sn*cam.zoom,D=cs*st*cam.zoom;
 c.save();c.globalAlpha=.82;c.setTransform(dpr*A,dpr*B,dpr*C,dpr*D,dpr*(cw/2-A*f.x-C*f.y),dpr*(ch/2-B*f.x-D*f.y));c.drawImage(heatState.canvas,0,0,W,H);c.restore();
}
function drawWorldOverlay(){

 if(!world3D.ready)return drawLegacyCanvas();
 world3D.render();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
 ctx.save();ctx.textBaseline='middle';render3DRanges();
 if(isNYC()&&cam.zoom<.58){
   for(const b of NYC_BOROUGHS){if(!nycUnlocked(b.name))continue;
    const lonlat={Manhattan:[-73.966,40.782],Brooklyn:[-73.957,40.646],Queens:[-73.833,40.758],Bronx:[-73.864,40.864],'Staten Island':[-74.166,40.574]}[b.name];
    const w=nycProject(...lonlat),p=project3D(w.x,w.y,11);
    if(p.x<-120||p.x>cw+120||p.y<-80||p.y>ch+80)continue;
    const name=b.name.toUpperCase();ctx.font='900 12px system-ui';ctx.textAlign='center';
    const tw=ctx.measureText(name).width;ctx.fillStyle='#101f2cc7';ctx.fillRect(p.x-tw/2-8,p.y-13,tw+16,22);
    ctx.fillStyle='#eaf7e7';ctx.fillText(name,p.x,p.y-1);
   }
 }
 const dot=(x,y,r,col,z=2)=>{const p=project3D(x,y,z);ctx.fillStyle=col;ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill()};
 const line=(a,b,col,width=2)=>{const p=project3D(a.x,a.y,a.z||2),q=project3D(b.x,b.y,b.z||2);ctx.strokeStyle=col;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke()};
 for(const z of zones){if(z.hp<=0)continue;const p=project3D(z.x+z.w/2,z.y+z.h/2,5);if(p.x>-60&&p.x<cw+60&&p.y>-60&&p.y<ch+60&&cam.zoom>.27){
   ctx.font='800 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#0c2624d9';const label=`SAFE ${fmt(z.saved||0)} / ${fmt(zoneCapacity(z))}`;let len=ctx.measureText(label).width;
   ctx.fillRect(p.x-len/2-8,p.y-15,len+16,19);ctx.fillStyle='#aefad9';ctx.fillText(label,p.x,p.y-5)}}
 for(const t of tracers){const k=clamp(1-t.life/t.maxLife,0,1),p={x:t.x1+(t.x2-t.x1)*k,y:t.y1+(t.y2-t.y1)*k,z:(t.z1||0)+(t.heavy?13:9)*(1-k)},s={x:t.x1+(t.x2-t.x1)*Math.max(0,k-.19),y:t.y1+(t.y2-t.y1)*Math.max(0,k-.19),z:(t.z1||0)+(t.heavy?13:9)*(1-Math.max(0,k-.19))};
   ctx.shadowColor='#ffb65b';ctx.shadowBlur=t.heavy?17:10;line(s,p,t.heavy?'#fff2bd':'#ffefa0',t.heavy?3.5:1.9);ctx.shadowBlur=0}
 for(const s of shells){const k=clamp(s.age/s.duration,0,1),h=(s.z1||14)*(1-k)+Math.sin(Math.PI*k)*115,p=project3D(s.x1+(s.x2-s.x1)*k,s.y1+(s.y2-s.y1)*k,h),shadow=project3D(s.x1+(s.x2-s.x1)*k,s.y1+(s.y2-s.y1)*k,1);
   ctx.fillStyle='#091d2b70';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,7,3,0,0,TAU);ctx.fill();ctx.shadowColor='#ffb755';ctx.shadowBlur=14;ctx.fillStyle='#ffedac';ctx.beginPath();ctx.arc(p.x,p.y,4.5,0,TAU);ctx.fill();ctx.shadowBlur=0}
 for(const e of effects){const k=clamp(e.life/e.maxLife,0,1),q=1-k;
   if(e.type==='line'){drawStrikeCoverage({x:e.x1,y:e.y1},{x:e.x2,y:e.y2},k);const s=project3D(e.x1,e.y1,5),t=project3D(e.x2,e.y2,5);ctx.globalAlpha=k;ctx.strokeStyle='#ffcf8a';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(t.x,t.y);ctx.stroke();ctx.globalAlpha=1}
   if(e.type==='ring'||e.type==='pulse'||e.type==='blast'||e.type==='spark'||e.type==='fade'){const p=project3D(e.x,e.y,4),r=(e.r||3)+((e.max||18)-(e.r||3))*q;
     ctx.strokeStyle=e.color||(e.type==='blast'?'#ffd582':e.type==='fade'?'#b9545e':'#8ff0cb');ctx.globalAlpha=k;ctx.lineWidth=e.type==='blast'?4:2;ctx.beginPath();ctx.ellipse(p.x,p.y,r*cam.zoom,r*cam.zoom*Math.sin(camera3D.tilt),camera3D.yaw,0,TAU);ctx.stroke();ctx.globalAlpha=1}
 }
 for(const a of arrivals){const p=project3D(a.x,a.y,5);ctx.fillStyle='#10242ada';ctx.fillRect(p.x-30,p.y-31,60,18);ctx.textAlign='center';ctx.font='800 11px system-ui';ctx.fillStyle='#fff2d6';ctx.fillText(Math.ceil(a.delay-a.age)+'s ETA',p.x,p.y-23)}
 if(phase==='live'&&outbreak){const p=project3D(outbreak.x,outbreak.y,5);if(p.x>-40&&p.x<cw+40&&p.y>-40&&p.y<ch+40){ctx.strokeStyle='#ee7c719a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,12,0,TAU);ctx.stroke()}}
 if(toolId==='zone'&&pendingZone.length){const pts=[...pendingZone,Number.isFinite(mouse.wx)?{x:mouse.wx,y:mouse.wy}:pendingZone.at(-1)],v=pts.map(p=>project3D(p.x,p.y,7));ctx.save();ctx.strokeStyle='#a3ffdc';ctx.fillStyle='#7de7bd35';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(v[0].x,v[0].y);for(const p of v.slice(1))ctx.lineTo(p.x,p.y);if(pendingZone.length>2){ctx.closePath();ctx.fill()}ctx.stroke();ctx.setLineDash([]);for(const p of v.slice(0,-1)){ctx.beginPath();ctx.arc(p.x,p.y,5,0,TAU);ctx.fillStyle='#bcffea';ctx.fill()}ctx.restore()}
 if(drag){
  if(drag.type==='zone'){const r=snapZone(rectFrom(drag.start,drag.cur)),co=zoneCost(r),verts=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]].map(q=>project3D(q[0],q[1],2));
    ctx.beginPath();ctx.moveTo(verts[0].x,verts[0].y);for(let i=1;i<4;i++)ctx.lineTo(verts[i].x,verts[i].y);ctx.closePath();ctx.fillStyle=budget>=co?'#73ebba45':'#ea8d8a55';ctx.fill();ctx.strokeStyle=budget>=co?'#a5ffe2':'#f4a19b';ctx.lineWidth=2;ctx.stroke();const p=verts[0];ctx.fillStyle='#f5ffea';ctx.font='800 12px system-ui';ctx.fillText('$'+fmt(co),p.x,p.y-12)
  }else if(drag.type==='wall'||drag.type==='strafe'){
    const isAir=drag.type==='strafe';const start=drag.start,end=isAir?clampStrikeEnd(start,drag.cur):drag.cur;
    if(isAir)drawStrikeCoverage(start,end);
    ctx.setLineDash(isAir?[14,8]:[8,7]);line({x:start.x,y:start.y,z:7},{x:end.x,y:end.y,z:7},isAir?'#ffcf77':'#f5d4a0',isAir?5:8);ctx.setLineDash([]);
    const mid=project3D((start.x+end.x)/2,(start.y+end.y)/2,12);ctx.textAlign='center';ctx.font='800 12px system-ui';ctx.fillStyle='#ffffff';ctx.fillText(isAir?'LINE AIRSTRIKE · $'+fmt(unitSpec('strafe').price):'$'+fmt(wallCost(start,end)),mid.x,mid.y-16);
    if(isAir){const v=Math.atan2(end.y-start.y,end.x-start.x),fin=project3D(end.x,end.y,12);ctx.save();ctx.translate(fin.x,fin.y);ctx.rotate(v+camera3D.yaw);ctx.fillStyle='#ffe09b';ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-6,-6);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.restore()}
  }else if(drag.type==='aim'){
    const spec=unitSpec(drag.id),start=drag.start,angle=Math.atan2(drag.cur.y-start.y,drag.cur.x-start.x),range=spec.range,pts=[project3D(start.x,start.y,5)];
    for(let i=0;i<=18;i++){const a=angle-spec.arc*.5+spec.arc*i/18;pts.push(project3D(start.x+Math.cos(a)*range,start.y+Math.sin(a)*range,4))}
    ctx.save();ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle='#f0cf7a2c';ctx.strokeStyle='#ffe4a2';ctx.lineWidth=1.5;ctx.fill();ctx.stroke();line({x:start.x,y:start.y,z:8},{x:drag.cur.x,y:drag.cur.y,z:8},'#ffe4a2',3);ctx.fillStyle='#fff1c8';ctx.font='800 11px system-ui';ctx.fillText(spec.name.toUpperCase()+' · DRAG TO AIM',pts[0].x+12,pts[0].y-15);ctx.restore()
  }
 }else if(toolId){const s=unitSpec(toolId),roof=['garrison','sniper','turret','mortar','beacon'].includes(toolId)?rooftopPick(mouse.x,mouse.y):null,p=project3D(roof?.x??mouse.wx,roof?.y??mouse.wy,roof?roof.height+12:8);ctx.strokeStyle='#9df6dd';ctx.lineWidth=2;ctx.setLineDash([5,6]);ctx.beginPath();ctx.arc(p.x,p.y,10,0,TAU);ctx.stroke();ctx.setLineDash([]);if(roof){const ground=project3D(roof.x,roof.y,1);ctx.strokeStyle='#9df6d866';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(ground.x,ground.y);ctx.lineTo(p.x,p.y);ctx.stroke()}if(toolId==='strafe'){ctx.fillStyle='#f9db9a';ctx.font='800 11px system-ui';ctx.fillText('DRAG TO AIM',p.x+15,p.y-18)}}
 if(selected&&selected.x!==undefined){const p=project3D(selected.x+((selected.w&&selected.type==='zone')?selected.w/2:0),selected.y+((selected.h&&selected.type==='zone')?selected.h/2:0),(selected.roofHeight||0)+10);ctx.strokeStyle='#d9fff2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,14,0,TAU);ctx.stroke()}
 ctx.restore();drawVignette();if(phase==='paused'){ctx.fillStyle='#08121b9e';ctx.fillRect(0,0,cw,ch);ctx.textAlign='center';ctx.fillStyle='#e9f9ef';ctx.font='800 27px system-ui';ctx.fillText('SIMULATION PAUSED',cw/2,ch/2);ctx.textAlign='start'}
}

function drawCanvas(){drawWorldOverlay()}
function drawVignette(){ctx.save();ctx.strokeStyle='#20302d57';ctx.lineWidth=16;ctx.strokeRect(0,0,cw,ch);ctx.restore()}
function rectFrom(a,b){const ax=clamp(a.x,0,W),ay=clamp(a.y,0,H),bx=clamp(b.x,0,W),by=clamp(b.y,0,H);
 return {x:Math.min(ax,bx),y:Math.min(ay,by),w:Math.abs(bx-ax),h:Math.abs(by-ay)}}
function snapZone(r){
 let x1=clamp(Math.round(r.x/SAFE_GRID)*SAFE_GRID,SAFE_GRID,W-SAFE_GRID*4),y1=clamp(Math.round(r.y/SAFE_GRID)*SAFE_GRID,SAFE_GRID,H-SAFE_GRID*4);
 let x2=clamp(x1+Math.max(SAFE_GRID*3,Math.round(r.w/SAFE_GRID)*SAFE_GRID),x1+SAFE_GRID*3,W-SAFE_GRID);
 let y2=clamp(y1+Math.max(SAFE_GRID*3,Math.round(r.h/SAFE_GRID)*SAFE_GRID),y1+SAFE_GRID*3,H-SAFE_GRID);
 const snapCoordinate=(v,axis)=>{let best=v,gap=34;for(const z of zones){if(z.hp<=0)continue;for(const target of axis==='x'?[z.x,z.x+z.w]:[z.y,z.y+z.h]){let d=Math.abs(v-target);if(d<gap){gap=d;best=target}}}return best};
 x1=snapCoordinate(x1,'x');y1=snapCoordinate(y1,'y');x2=snapCoordinate(x2,'x');y2=snapCoordinate(y2,'y');
 if(x2-x1<SAFE_GRID*3)x2=clamp(x1+SAFE_GRID*3,x1+SAFE_GRID*3,W-SAFE_GRID);
 if(y2-y1<SAFE_GRID*3)y2=clamp(y1+SAFE_GRID*3,y1+SAFE_GRID*3,H-SAFE_GRID);
 return{x:x1,y:y1,w:x2-x1,h:y2-y1}
}
function minimap(){if(!mc||mini.width<4)return;const w=mini.width,h=mini.height;mc.clearRect(0,0,w,h);mc.drawImage(staticMap,0,0,staticMap.width,staticMap.height,0,0,w,h);mc.fillStyle='#80e1d455';for(const z of zones){if(z.hp>0){mc.beginPath();const v=zoneVertices(z);mc.moveTo(v[0].x/VIS_W*w,v[0].y/VIS_H*h);for(const p of v.slice(1))mc.lineTo(p.x/VIS_W*w,p.y/VIS_H*h);mc.closePath();mc.fill()}}
 const peopleStride=people.length>4000?(deviceProfile.constrained?14:8):3,zombieStride=Math.max(1,Math.ceil(zombies.length/(deviceProfile.constrained?280:650)));
 mc.fillStyle='#e3e8d1';for(let i=0;i<people.length;i+=peopleStride){const p=people[i];if(!p.alive)continue;mc.fillRect(p.x/VIS_W*w,p.y/VIS_H*h,1.3,1.3)}mc.fillStyle='#e27372';for(let i=0;i<zombies.length;i+=zombieStride){const z=zombies[i];if(z.alive)mc.fillRect(z.x/VIS_W*w-1,z.y/VIS_H*h-1,2.3,2.3)}mc.strokeStyle='#f4fef8';mc.lineWidth=1.8;mc.strokeRect(cam.x/VIS_W*w,cam.y/VIS_H*h,cw/cam.zoom/VIS_W*w,ch/cam.zoom/VIS_H*h)}
function renderUI(force=false){const aliveCount=livingPopulation(),total=initialPopulation;let pct=survivalPercent(),safeIntegrity=zones.length?Math.round(zones.reduce((a,z)=>a+Math.max(0,z.hp),0)/zones.reduce((a,z)=>a+z.maxHp,0)*100):100;
 $('threatBaselineLabel').textContent=endlessMode?'Endless baseline':'Campaign baseline';$('campaignThreatValue').textContent=(campaignThreat.carry+(endlessMode?endlessPressure:0)).toFixed(2)+'×';$('threatValue').textContent=threatProfile.pressure.toFixed(2)+'×';$('threatBar').style.width=Math.min(100,(threatProfile.pressure-1)*58)+'%';
 const waveNext=scenarioAt().waves[spawnedWaves];
 $('nextWave').textContent=phase==='lost'?'MISSION FAILED':phase==='planning'?'Awaiting outbreak':endlessMode?(queuedZombies()?'∞ '+fmt(queuedZombies())+' incoming':endlessIntermission>0?'RE-ARM · '+Math.ceil(endlessIntermission)+'s':zombies.length===0?'∞ WAVE '+(endlessWave+1)+' READY':'∞ WAVE '+endlessWave+' · '+Math.max(0,Math.ceil(endlessNextAt-time))+'s'):queuedZombies()?'Incoming '+fmt(queuedZombies()):spawnedWaves===scenarioAt().waves.length?'All surges launched':zombies.length===0?'Quiet '+Math.max(0,5-quietClock).toFixed(1)+'s':Math.max(0,Math.ceil(waveNext-time))+'s / scheduled';
 const forecast=threatDirector();$('waveDetail').textContent=phase==='lost'?'No civilians survived. Restore from the most recent checkpoint.':endlessMode?(endlessIntermission>0?'∞ WAVE '+endlessWave+' CLEARED · '+Math.ceil(endlessIntermission)+'s re-arm window.':'∞ WAVE '+endlessWave+' · RECORD '+endlessBest+' · rising pressure '+forecast.pressure.toFixed(2)+'×. Incoming infected pace themselves as local horde load grows.'):(spawnedWaves===scenarioAt().waves.length?'Final surge underway. Clear every infected to win.':'CAMPAIGN '+campaignThreat.carry.toFixed(2)+'× · NEXT: '+Math.round(forecast.count*100)+'% horde size · '+Math.round(forecast.speed*100)+'% speed · '+Math.round(forecast.siege*100)+'% gate pressure. 5 quiet seconds skips the wait.');
 $('money').textContent='$'+fmt(budget);$('alive').textContent=fmt(aliveCount);$('infected').textContent=fmt(zombies.length);$('saved').textContent=fmt(aliveCount)+' / '+fmt(initialPopulation);$('timer').textContent=ftime(time);$('savedPct').textContent=pct+'%';$('saveBar').style.width=pct+'%';$('integrityPct').textContent=safeIntegrity+'%';$('integrityBar').style.width=safeIntegrity+'%';$('sitrep').textContent=phase==='planning'?'Origin hidden. Snap shelters to the grid; gates only work alongside roads.':phase==='live'?(endlessMode?'Endless Wave '+endlessWave+'. Protect the '+fmt(aliveCount)+' survivors.':'Emergency response active. '+fmt(lost)+' civilians have been infected.'):phase==='paused'?'Operations temporarily paused.':phase==='lost'?'NO SURVIVORS — district lost.':'Scenario completed.';
 const enough=aliveCount>0,endwaves=spawnedWaves===scenarioAt().waves.length;
 const queued=queuedZombies(),objectiveMarkup='<div class="objective '+(zones.length?'done':'')+'"><span class="check">'+(zones.length?'✓':'·')+'</span>Establish a walled safe zone<strong>'+zones.length+'</strong></div><div class="objective '+(enough?'done':'')+'"><span class="check">'+(enough?'✓':'·')+'</span>Survivors remaining<strong>'+fmt(aliveCount)+'/'+fmt(initialPopulation)+'</strong></div><div class="objective '+(rescued>0?'done':'')+'"><span class="check">'+(rescued>0?'✓':'·')+'</span>Currently sheltered<strong>'+fmt(rescued)+'</strong></div><div class="objective '+(endwaves&&zombies.length===0&&!queued?'done':'')+'"><span class="check">'+(endlessMode?'∞':endwaves&&zombies.length===0&&!queued?'✓':'·')+'</span>'+(endlessMode?'Survive endless waves':'Neutralize EVERY infected after ALL waves')+'<strong>'+fmt(zombies.length)+(queued?' + '+fmt(queued)+' incoming':'')+' · '+(endlessMode?'∞ '+endlessWave+' waves':spawnedWaves+'/'+scenarioAt().waves.length+' waves')+'</strong></div>';
 if(force||objectiveMarkup!==uiObjectivesMarkup){$('objectives').innerHTML=objectiveMarkup;uiObjectivesMarkup=objectiveMarkup}
 updateToolUi();$('coords').textContent='CAM '+Math.round(cam.x)+' / '+Math.round(cam.y)+' · ZOOM '+Math.round(cam.zoom*100)+'% · '+fmt(people.length)+' moving civilian groups';
 const now=performance.now();if(force||selected?.id!==uiInspectedId||(phase==='live'&&selected&&now-uiSelectedAt>750)){uiInspectedId=selected?.id||-1;uiSelectedAt=now;renderSelected()}
}
function renderSelected(){const target=$('unitInspector');if(!selected){target.innerHTML='<div class="micro">Select a unit, shelter or gate to inspect performance. Select gates to reinforce their health, or garrisons to upgrade soldier recruitment.</div>';return}
 let u=selected,valid=u.type==='zone'?zones.includes(u):u.type==='gate'?gates.includes(u):u.type==='wall'?walls.includes(u):u.type==='bridge'?bridges.includes(u):defenses.includes(u);if(!valid){selected=null;renderSelected();return}
 let name=u.type==='zone'?'Walled safe zone':u.type==='wall'?'Barricade':u.type==='gate'?'Shelter entrance gate':u.type==='bridge'?'Bridge crossing':unitSpec(u.type)?.name||u.type,icon=iconSVG(u.type);
 let html='<div class="unit-icon">'+icon+'</div><div class="unit-name">'+name+'</div><div class="unit-desc">'+(u.type==='zone'?'Shelter walls encircle residents. Gates process 180 people per second. Waiting crowds gather visibly outside each entrance; add gates to clear queues.':u.type==='gate'?'Civilian crowds gather outside this roadside gate when admission slows. Reinforce gate health; build another entrance to increase throughput beyond 180 people/s.':u.type==='wall'?'Barricade section '+(u.section||1)+' / '+(u.sectionCount||1)+'. Each section has its own HP; breaking one does not destroy the others.':u.type==='bridge'?'Airstrikes and mortar shells can disable this bridge, cutting off the ground crossing.':u.type==='garrison'?'Recruiting barracks. Produces independent mobile soldiers that hunt zombies; upgrades speed recruitment and raise the squad limit.':u.recruited?'Mobile garrison recruit. Automatically searches for zombie concentrations.':'Automated response unit deployed on the district map.')+'</div>';
 html+='<div class="line"><span>Integrity</span><span class="value">'+Math.ceil(u.hp)+' / '+Math.ceil(u.maxHp)+'</span></div>';
 if(u.type==='zone')html+='<div class="line"><span>Occupancy / capacity</span><span class="value">'+fmt(u.saved)+' / '+fmt(zoneCapacity(u))+'</span></div><div class="line"><span>Entrances</span><span class="value">'+gateForZone(u).length+'</span></div>';
 else if(u.type==='gate')html+='<div class="line"><span>Status</span><span class="value">'+(u.hp<=0?'BREACHED':'OPEN TO CIVILIANS')+'</span></div><div class="line"><span>Armor level</span><span class="value">'+(u.level||1)+' / '+MAX_GATE_LEVEL+'</span></div><div class="line"><span>Entry rate</span><span class="value">'+fmt(gateFlowRate(u))+' people/s</span></div><div class="line"><span>Waiting nearby</span><span class="value">'+fmt(u.waiting||0)+'</span></div><div class="line"><span>Admitted</span><span class="value">'+fmt(u.entered||0)+'</span></div>'+((u.level||1)<MAX_GATE_LEVEL?'<button class="panel-btn" id="upgradeBtn">↑ REINFORCE + FLOW — $'+gateUpgradeCost(u)+'</button>':'');
 else if(u.type==='bridge')html+='<div class="line"><span>Crossing</span><span class="value">'+(u.hp>0?'OPEN':'DESTROYED')+'</span></div>';
 else if(u.type==='wall')html+='<div class="line"><span>Barrier length</span><span class="value">'+Math.round(Math.hypot(u.bx-u.ax,u.by-u.ay))+'m</span></div>';
 else{
 if(u.roofKey)html+='<div class="line"><span>Mount</span><span class="value">ROOFTOP · '+Math.round(u.roofHeight)+'m</span></div>';
 if(u.type==='garrison'){
  const active=defenses.filter(d=>d.recruited&&d.hp>0&&d.garrisonId===u.id).length;
  html+='<div class="line"><span>Barracks level</span><span class="value">'+u.level+' / 4</span></div>';
  html+='<div class="line"><span>Active soldiers</span><span class="value">'+active+' / '+garrisonCapacity(u)+'</span></div>';
  html+='<div class="line"><span>Recruit interval</span><span class="value">'+garrisonInterval(u).toFixed(1)+'s</span></div>';
  html+='<div class="line"><span>Next recruit</span><span class="value">'+(phase==='live'?Math.ceil(Math.max(0,u.recruitClock||0))+'s':'When outbreak starts')+'</span></div>';
  html+='<div class="line"><span>Total recruited</span><span class="value">'+fmt(u.recruitedTotal||0)+'</span></div>';
  html+='<div class="line"><span>Soldier eliminations</span><span class="value">'+fmt(u.kills||0)+'</span></div>';
 }else if(u.recruited){html+='<div class="line"><span>Assigned garrison</span><span class="value">'+u.garrisonId+'</span></div><div class="line"><span>Infected stopped</span><span class="value">'+fmt(u.kills)+'</span></div>'}
 else html+='<div class="line"><span>Level</span><span class="value">'+u.level+' / 4</span></div><div class="line"><span>Range</span><span class="value">'+Math.round((u.range||0)*(1+.13*(u.level-1)))+'m</span></div><div class="line"><span>Infected stopped</span><span class="value">'+fmt(u.kills)+'</span></div>';
 if(!u.recruited&&u.type!=='beacon'&&u.level<4)html+='<button class="panel-btn" id="upgradeBtn">↑ '+(u.type==='garrison'?'UPGRADE BARRACKS':'UPGRADE')+' — $'+upgradeCost(u)+'</button>'
}
 if(!u.recruited&&(u.price||0)>0)html+='<button class="panel-btn danger" id="refundBtn">× DISMANTLE (REFUND $'+Math.floor(u.price*.7)+')</button>';target.innerHTML=html;if($('upgradeBtn'))$('upgradeBtn').onclick=upgradeSelected;if($('refundBtn'))$('refundBtn').onclick=refundSelected}
function upgradeCost(u){return Math.ceil((u.price*.64*u.level)/5)*5}
function upgradeSelected(){
 if(!selected)return;
 if(selected.type==='gate'){
  const g=selected;if((g.level||1)>=MAX_GATE_LEVEL)return;const cost=gateUpgradeCost(g);
  if(budget<cost){notify('Not enough funds to reinforce gate.',true);return}
  budget-=cost;g.level=(g.level||1)+1;
  const added=180+g.level*40;g.maxHp+=added;g.hp=Math.min(g.maxHp,g.hp+added);
  log('Shelter gate reinforced to level '+g.level+' · '+fmt(gateFlowRate(g))+' people/s intake.');
  notify('GATE REINFORCED · '+fmt(gateFlowRate(g))+' PEOPLE/S');renderUI(true);saveCampaign();effectSound('deploy');return
 }
 if(!selected.level||selected.level>=4||selected.recruited)return;
 const cost=upgradeCost(selected);if(budget<cost){notify('Not enough funds to upgrade.',true);return}
 budget-=cost;selected.level++;selected.maxHp+=28;selected.hp+=28;
 log(selected.type==='garrison'?'Barracks upgraded. More recruits, faster training.':'Defense unit upgraded to level '+selected.level+'.');
 renderUI(true);saveCampaign();playTone(690,.12,.018)
}
function refundSelected(){if(!selected)return;const u=selected;budget+=Math.floor(u.price*.7);if(u.type==='zone'){zones=zones.filter(x=>x!==u);gates=gates.filter(g=>g.zoneId!==u.id)}else if(u.type==='gate')gates=gates.filter(x=>x!==u);else if(u.type==='wall'){walls=walls.filter(x=>x!==u);wallGridDirty=true;}else defenses=defenses.filter(x=>x!==u&&(u.type!=='garrison'||x.garrisonId!==u.id));selected=null;log('Deployment dismantled; partial funds recovered.');beaconGridDirty=true;renderUI(true);saveCampaign();playTone(330,.06,.018)}
function findSelected(p){const find=defenses.find(d=>Math.hypot(d.x-p.x,d.y-p.y)<23),gate=gates.find(g=>Math.hypot(g.x-p.x,g.y-p.y)<20),wall=walls.find(w=>w.hp>0&&distanceToLine(p.x,p.y,w.ax,w.ay,w.bx,w.by)<12),bridge=bridges.find(b=>hitRectPoint(p.x,p.y,b)),zone=zones.find(z=>isInZone(p.x,p.y,z));return find||gate||wall||bridge||zone||null}
function mapPointer(e){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;return{x,y}}
const touchPoints=new Map();let touchGesture=null,pinch=null;
const aimsWithDrag=id=>!!unitSpec(id)?.arc&&unitSpec(id).arc<TAU-.001;
function handlePlacement(x,y,screenPoint=null){if(!toolId&&screenPoint){const roofUnit=projectedUnitPick(screenPoint.x,screenPoint.y);if(roofUnit){selected=roofUnit;renderUI(true);return}}
 if(screenPoint&&['garrison','sniper','turret','mortar','beacon','machinegun'].includes(toolId)){const roof=rooftopPick(screenPoint.x,screenPoint.y);if(roof){x=roof.x;y=roof.y}}
 if(toolId==='zone')addPolyVertex(x,y);else if(toolId==='strafe')notify('Drag from the start to the end of the line airstrike.',true);else if(supports.some(s=>s.id===toolId))sendSupport(toolId,x,y);else if(toolId==='gate')addGate(x,y);else if(toolId)addDefense(toolId,x,y);else{selected=findSelected({x,y});renderUI(true)}}
function commitAimedDefense(d){let x=d.start.x,y=d.start.y;if(['garrison','sniper','turret','mortar','beacon','machinegun'].includes(d.id)&&d.screenStart){const roof=rooftopPick(d.screenStart.x,d.screenStart.y);if(roof){x=roof.x;y=roof.y}}
 const rotation=Math.hypot(d.cur.x-d.start.x,d.cur.y-d.start.y)>7?Math.atan2(d.cur.y-y,d.cur.x-x):0;addDefense(d.id,x,y,false,rotation)}
function panStart(e,m){mouse.pan=true;mouse.px=m.x;mouse.py=m.y;canvas.classList.add('panning');canvas.setPointerCapture?.(e.pointerId)}
function orbitStart(e,m){mouse.orbit=true;mouse.px=m.x;mouse.py=m.y;canvas.classList.add('panning');canvas.setPointerCapture?.(e.pointerId)}
canvas.addEventListener('pointerdown',e=>{if(!$('introOverlay').classList.contains('hidden')||!$('modalOverlay').classList.contains('hidden'))return;const m=mapPointer(e),w=screenToWorld(m.x,m.y);mouse={...mouse,...m,wx:w.x,wy:w.y,down:true};canvas.setPointerCapture?.(e.pointerId);
 if(e.pointerType==='touch'||e.pointerType==='pen'){
   touchPoints.set(e.pointerId,m);
   if(touchPoints.size===2){const [a,b]=Array.from(touchPoints.values());const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};pinch={startDist:Math.max(15,Math.hypot(a.x-b.x,a.y-b.y)),zoom:cam.zoom,world:screenToWorld(mid.x,mid.y)};touchGesture=null;drag=null;mouse.pan=false;return}
   if(touchPoints.size>2)return;
   touchGesture={id:e.pointerId,x:m.x,y:m.y,lastX:m.x,lastY:m.y,world:w,moved:false,tool:toolId};
   if(['wall','strafe'].includes(toolId))drag={type:toolId,start:w,cur:w};else if(aimsWithDrag(toolId))drag={type:'aim',id:toolId,start:w,cur:w,screenStart:m};return;
 }
 if(e.button===2){orbitStart(e,m);return}if(e.button===1||e.shiftKey){panStart(e,m);return}if(e.button!==0)return;
 if(['wall','strafe'].includes(toolId)){drag={type:toolId,start:w,cur:w};return}if(aimsWithDrag(toolId)){drag={type:'aim',id:toolId,start:w,cur:w,screenStart:m};return}handlePlacement(w.x,w.y,m)
});
canvas.addEventListener('pointermove',e=>{const m=mapPointer(e);mouse.x=m.x;mouse.y=m.y;const w=screenToWorld(m.x,m.y);mouse.wx=w.x;mouse.wy=w.y;
 if(touchPoints.has(e.pointerId)){
   touchPoints.set(e.pointerId,m);
   if(pinch&&touchPoints.size>=2){const [a,b]=Array.from(touchPoints.values());const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,d=Math.max(15,Math.hypot(a.x-b.x,a.y-b.y));markZoomMoving();cam.zoom=clamp(pinch.zoom*d/pinch.startDist,NYC_MIN_ZOOM,2.3);const q=screenToWorld(mx,my);cam.x+=pinch.world.x-q.x;cam.y+=pinch.world.y-q.y;clampCamera();return}
   if(touchGesture&&touchGesture.id===e.pointerId){let g=touchGesture,dx=m.x-g.lastX,dy=m.y-g.lastY;g.moved=g.moved||Math.hypot(m.x-g.x,m.y-g.y)>9;
    if(!toolId||!['zone','wall','strafe'].includes(toolId)&&!aimsWithDrag(toolId)){if(g.moved){shiftCameraScreen(dx,dy)}}
    else if(drag)drag.cur=w;
    g.lastX=m.x;g.lastY=m.y;return}
 }
 if(mouse.orbit){camera3D.yaw+=clamp(m.x-mouse.px,-42,42)*.012;camera3D.tilt=clamp(camera3D.tilt+clamp(m.y-mouse.py,-42,42)*.008,.58,1.54);mouse.px=m.x;mouse.py=m.y;markZoomMoving();return}
 if(mouse.pan){shiftCameraScreen(m.x-mouse.px,m.y-mouse.py);mouse.px=m.x;mouse.py=m.y}
 if(drag)drag.cur=w
});
canvas.addEventListener('pointerup',e=>{
 if(touchPoints.has(e.pointerId)){
  touchPoints.delete(e.pointerId);
  if(pinch){if(touchPoints.size<2){pinch=null;touchGesture=null;drag=null}return}
  if(touchGesture&&touchGesture.id===e.pointerId){const g=touchGesture;touchGesture=null;
  if(drag){const d=drag;drag=null;if(d.type==='aim')commitAimedDefense(d);else if(g.moved&&Math.hypot(d.cur.x-d.start.x,d.cur.y-d.start.y)>23){if(d.type==='zone')addZone(rectFrom(d.start,d.cur));else if(d.type==='wall')addWall(d.start,d.cur);else commitStrafe(d)}else notify(d.type==='strafe'?'Drag to aim the line airstrike.':'Drag on the map to size '+(d.type==='zone'?'a shelter.':'a barricade.'));}
   else if(!g.moved)handlePlacement(g.world.x,g.world.y,{x:g.x,y:g.y})
  }mouse.down=false;return
 }
 if(mouse.orbit){mouse.orbit=false;mouse.down=false;canvas.classList.remove('panning');return}
 if(mouse.pan){mouse.pan=false;mouse.down=false;canvas.classList.remove('panning');return}
 if(drag){const d=drag;drag=null;if(d.type==='aim')commitAimedDefense(d);else if(d.type==='zone')addZone(rectFrom(d.start,d.cur));else if(d.type==='wall')addWall(d.start,d.cur);else commitStrafe(d)}mouse.down=false
});
canvas.addEventListener('pointercancel',e=>{touchPoints.delete(e.pointerId);touchGesture=null;pinch=null;mouse.pan=false;mouse.orbit=false;mouse.down=false;drag=null;canvas.classList.remove('panning')});
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{e.preventDefault();const m=mapPointer(e);zoomAt(e.deltaY,m.x,m.y)},{passive:false});
mini.addEventListener('pointerdown',e=>{let r=mini.getBoundingClientRect();centerCamera((e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H)});
function showHelp(){let content='<div class="eyebrow">OPERATIONS MANUAL / QUICK REFERENCE</div><h1>HOW TO <span>PLAY</span></h1><p>Select a map from the campaign menu. The New York City choice uses a near-1:1-scale, 20-stage five-borough map with shoreline-based terrain and bridge crossings; each borough unlocks over four stages; locked boroughs remain visible in grayscale. Tap the minimap to jump across NYC. The city uses stylized polygon buildings. Borough coastlines and streets are simplified rather than exact real-world building locations. Use SAVE or LOAD in the deployment panel to store and restore your exact current operation in three browser-local slots. Active outbreaks resume paused. Campaign levels retain permanent shelters, gates, defenses, tanks, upgrades and unspent funding, while soldiers and emergency responders withdraw at the end of each level. Completing the last stage unlocks an optional Endless Mode on the final city: survive unlimited waves, growing threat, and earn funds for each clear. A between-wave checkpoint saves your defenses and surviving population. New zombie surges never spawn inside an active safe zone. Shelter gates cost $110 and admit up to 180 people per second and can be upgraded for more health; overflow civilians wait outside or use other gates. Shelters are cheaper, snap to a 24m grid, and attach to neighboring shelter corners, and have generous capacity; gates cost $110 and must face an adjacent road. Barricades can extend any distance at a length-based price, and split into individual breakable sections. Turrets, lookouts, barracks, beacons and mortars can attach to rooftops by tapping buildings. Garrisons slowly recruit limited mobile ground soldiers during outbreaks, and upgrades improve capacity and recruitment rate. Recruits and emergency soldiers demobilize at the end of each level; tanks and other permanent defenses carry forward. Evacuation beacons are now $65 with a 420m range. Heavy explosions may collapse buildings onto infected. The expanding 3D metropolis has bridges that air support can disable. Rotate the 3D camera for a different angle. Fragile zombies still fall to one shot, but the saved campaign threat escalates between levels and the adaptive director grows waves, movement speed and siege damage in response to civilians staying alive and successful eliminations. Five quiet seconds automatically launch the next surge, including in Endless Mode. Every civilian alive counts toward the saved population, whether inside or outside a safe zone. You lose if all civilians die. Weighted moving civilian groups track populations up to 220,000 on standard maps and 1.1 million on NYC, without simulating every person individually. They move faster than civilians but no longer sprint impossibly fast. Sound starts on after your first interaction.</p><div class="cards"><div class="info-card"><b>DEFENSE / PLANNING</b><p>Safe zones: tap multiple vertices, FINISH or tap first corner to close, UNDO to edit. Gates work along road-facing polygon edges. 1 Garrison (recruits temporary soldiers) · 2 Lookout · 3 Turret · 4 Mortar · 5 Safe zone (drag) · 6 Evacuation beacon ($65; 420m) · 7 Barricade (drag) · 8 Gate (tap wall) · 9 Tank · 0 Patrol helicopter. Tanks deploy instantly in planning, and are airdropped mid-outbreak. Battleships deploy only on waterways and automatically bombard distant hordes.</p></div><div class="info-card"><b>DEFENSE / OUTBREAK</b><p>During outbreaks, Garrison, Lookout, Patrol Helicopter, and Tank are available under Defense. Tanks are delivered by transport plane with an arrival delay and cooldown; tanks and defensive helicopters carry between stages.</p></div><div class="info-card"><b>EMERGENCY RESPONSE</b><p>F Ground squad · Q Airstrike · E Aimable line airstrike (drag to aim) · R Paratroopers · H Attack helicopter. Emergency ground squads, paratroopers and attack helicopters are temporary and do not carry into the next stage. The attack helicopter also withdraws when the area is cleared. Emergency tools automatically deselect after a successful request. The extended line airstrike costs $540 and shows its coverage while aiming.</p></div><div class="info-card"><b>MOBILE & DESKTOP</b><p>Mobile: TOOLS and INTEL panels; drag to aim line airstrikes, one-finger pan, pinch zoom, tap to place, drag to build zones and barriers, ⟳ 3D to orbit. Desktop: G start, V toggle projected weapon ranges, Space pause, WASD pan, wheel zoom, right-drag pan, [ / ] rotate camera. Mobile: RNG toggles ranges.</p></div></div><div class="buttons"><button id="closeHelp">BACK TO MAP →</button></div>';$('modalContent').innerHTML=content;$('modalOverlay').classList.remove('hidden');closeDrawers();$('closeHelp').onclick=()=>$('modalOverlay').classList.add('hidden')}
function keydown(e){if(!$('slotsOverlay').classList.contains('hidden')){if(e.key==='Escape')closeSlots();return}if(e.target.matches('input,textarea,select'))return;audioReady();keys.add(e.key.toLowerCase());if(e.repeat)return;const key=e.key.toLowerCase();if(key===' '){e.preventDefault();if(phase==='live'||phase==='paused')togglePause()}if(key==='g')begin();if(key==='v')toggleRanges();if(key==='enter'&&toolId==='zone')finishPolyZone();if(key==='backspace'&&toolId==='zone'){e.preventDefault();pendingZone.pop();updatePolyControls()}if(key==='escape'){pendingZone=[];updatePolyControls();toolId=null;selected=null;drag=null;pendingZone=[];updatePolyControls();updateToolUi();renderUI(true);if(!$('modalOverlay').classList.contains('hidden'))$('modalOverlay').classList.add('hidden')}
 for(const t of [...tools,...supports])if(key===t.key.toLowerCase())chooseTool(t.id);if(key==='?')showHelp();if(key==='[')rotate3DCamera(-.3);if(key===']')rotate3DCamera(.3);if(key==='x'&&selected)refundSelected()}
window.addEventListener('keydown',keydown);window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
// Manual slots preserve the live simulation graph, not only the campaign layout.
const SLOT_DB='cityfall_manual_slots_v1',SLOT_COUNT=3;
let slotDbPromise=null,slotMode='load',slotReturnPhase=null,slotBusy=false,slotGeneration=0;
function slotDB(){if(!slotDbPromise)slotDbPromise=new Promise((resolve,reject)=>{if(!window.indexedDB){reject(Error('Browser storage unavailable'));return}const req=indexedDB.open(SLOT_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('slots'))req.result.createObjectStore('slots',{keyPath:'slot'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Cannot open storage'));req.onblocked=()=>reject(Error('Storage is blocked'))}).catch(e=>{slotDbPromise=null;throw e});return slotDbPromise}
async function slotReadAll(){const db=await slotDB();return new Promise((ok,fail)=>{const t=db.transaction('slots','readonly'),r=t.objectStore('slots').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)})}
async function slotWrite(record){const db=await slotDB();return new Promise((ok,fail)=>{const t=db.transaction('slots','readwrite');t.objectStore('slots').put(record);t.oncomplete=()=>ok();t.onerror=()=>fail(t.error);t.onabort=()=>fail(t.error||Error('Save cancelled'))})}
async function slotRead(slot){const db=await slotDB();return new Promise((ok,fail)=>{const r=db.transaction('slots','readonly').objectStore('slots').get(slot);r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)})}
// Portable JSON backup for origin-restricted local-file browsers. Preserve object identity (gate references, shelter links, etc.).
function packState(root){const nodes=[],seen=new Map();function enc(v){if(v===undefined)return{u:1};if(typeof v==='number'&&!Number.isFinite(v))return{n:String(v)};if(v===null||typeof v!=='object')return v;if(seen.has(v))return{r:seen.get(v)};const i=nodes.length;seen.set(v,i);nodes.push(null);nodes[i]=Array.isArray(v)?{a:v.map(enc)}:{o:Object.entries(v).map(([k,w])=>[k,enc(w)])};return{r:i}}return{format:'cityfall-save-1',root:enc(root),nodes}}
function unpackState(data){if(data?.format!=='cityfall-save-1'||!Array.isArray(data.nodes)||data.nodes.length>2000000)throw Error('Invalid save file');const nodes=data.nodes,objs=nodes.map(n=>Array.isArray(n?.a)?[]:{});const dec=v=>{if(v===null||typeof v!=='object')return v;if(v.u===1)return undefined;if(v.n!==undefined)return Number(v.n);if(!Number.isInteger(v.r)||v.r<0||v.r>=objs.length)throw Error('Invalid reference');return objs[v.r]};for(let i=0;i<nodes.length;i++){const n=nodes[i];if(Array.isArray(n.a)){for(const v of n.a)objs[i].push(dec(v))}else if(Array.isArray(n.o)){for(const [k,v] of n.o){if(k==='__proto__'||k==='constructor'||k==='prototype')continue;Object.defineProperty(objs[i],k,{value:dec(v),writable:true,enumerable:true,configurable:true})}}else throw Error('Invalid save node')}return dec(data.root)}
function exportSave(){if(slotBusy)return;try{const b=new Blob([JSON.stringify(packState(fullState()))],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='cityfall-'+activeMap+'-stage-'+(scenarioIndex+1)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);$('slotMessage').textContent='Backup prepared.'}catch(e){$('slotMessage').textContent='Export failed: '+e.message}}
async function importSave(file){if(!file||slotBusy)return;slotBusy=true;try{const d=unpackState(JSON.parse(await file.text()));await restoreFull(d);slotBusy=false;closeSlots(false);notify('Backup restored.')}catch(e){$('slotMessage').textContent='Import failed: '+e.message}finally{slotBusy=false;$('slotFile').value=''}}
function fullState(){return{version:1,mapId:activeMap,stage:scenarioIndex,layout:snapshot(),checkpoint:campaignCheckpoint,
 phase:slotReturnPhase||phase,prevPhase,time,speed,budget,initialPopulation,rescued,lost,neutralized,spawnedWaves,
 people,zombies,buildings,bridges,defenses,zones,gates,walls,shells,effects,tracers,flares,aircraft,parachutes,arrivals,feed,outbreak,pendingSurges,fallingBuildings,
 unitId,enemyId,zeroTime,quietClock,spawnCooldowns,zombieSpawnCarry,zombieSliceTick,civilianSliceTick,populationCull,hordeClock,humanSearchClock,campaignThreat,threatProfile,lastWaveInfo,
 endlessMode,endlessWave,endlessPressure,endlessAwardedWave,endlessNextAt,endlessIntermission,cam:{...cam},camera3D:{...camera3D},showRanges,soundEnabled}}
async function restoreFull(d){$('reviewControls').classList.add('hidden');if(!d||d.version!==1||!Number.isInteger(d.stage)||d.stage<0||d.stage>=(d.mapId==='nyc'?20:scenarios.length)||!Array.isArray(d.people)||!Array.isArray(d.zombies)||!Array.isArray(d.zones)||!Array.isArray(d.buildings))throw Error('Incompatible save');
 await reset(d.mapId==='nyc'&&d.layout?.mapVersion===5?Math.min(19,d.stage*4+3):d.stage,{load:d.layout,skipSave:true});
 // Keep the full, grayscaled NYC scenery when opening older manual saves;
 // old files only serialized the currently unlocked boroughs.
 const futureCityBuildings=buildings.filter(b=>b.locked);
 ({time,speed,budget,initialPopulation,rescued,lost,neutralized,spawnedWaves,people,zombies,buildings,bridges,defenses,zones,gates,walls,shells,effects,tracers,flares,aircraft,parachutes,arrivals,feed,outbreak,pendingSurges,fallingBuildings,unitId,enemyId,zeroTime,quietClock,spawnCooldowns,zombieSpawnCarry,zombieSliceTick,civilianSliceTick,populationCull,hordeClock,humanSearchClock,campaignThreat,threatProfile,lastWaveInfo,endlessMode,endlessWave,endlessPressure,endlessAwardedWave,endlessNextAt,endlessIntermission=0}=d);
 // An older megascale manual save can contain agents/buildings within the
 // newly corrected East River corridor. Preserve the save but move those agents
 // back to land and remove invalid riverbed building footprints.
 if(activeMap==='nyc'||activeMap==='nyc_megascale'){
  buildings=buildings.filter(b=>!nycEastRiverAt(b.x+b.w*.5,b.y+b.h*.5)&&!nycHarlemRiverAt(b.x+b.w*.5,b.y+b.h*.5)&&!nycNewtownCreekAt(b.x+b.w*.5,b.y+b.h*.5));
  for(const group of [people,zombies])for(const a of group){if(nycEastRiverAt(a.x,a.y)){
   const shore=nycSnapToShore({x:a.x,y:a.y});a.x=shore.x;a.y=shore.y;
  }}
 }
 {
   const known=new Set(buildings.map(b=>b.key));
   for(const b of buildings)if(isNYC())b.locked=!nycLandAt(b.cx??b.x+b.w*.5,b.cy??b.y+b.h*.5);else b.locked=b.x>=W||b.y>=H;
   for(const b of futureCityBuildings)if(!known.has(b.key))buildings.push(b);
 }
 campaignCheckpoint=d.checkpoint||d.layout;prevPhase=d.prevPhase||'live';showRanges=d.showRanges!==false;soundEnabled=d.soundEnabled!==false;Object.assign(cam,d.cam||{});Object.assign(camera3D,d.camera3D||{});if(Math.abs(camera3D.tilt-0.85)<0.012)camera3D.tilt=1.32;
 rebuildBuildingGrid();rebuildWallGrid();refreshNavigation();rebuildGrid(civGrid,people);rebuildGrid(zombieGrid,zombies);rebuildGrid(unitGrid,defenses,activeUnit);beaconGridDirty=true;hordeHotspots();refreshHumanClusters();world3D.needsBuild=true;selected=null;toolId=null;drag=null;
 const savedPhase=d.phase;phase=savedPhase==='planning'?'planning':'paused';
 if(savedPhase!=='planning'){$('startBtn').style.display='none';$('pauseBtn').style.display='';$('phaseLabel').textContent=endlessMode?'ENDLESS SURVIVAL — PAUSED':'OUTBREAK ACTIVE — PAUSED';$('phaseDot').style.background='#e68d88';$('mapTip').textContent='Saved operation restored. Resume whenever ready.';$('mapTip').classList.add('warn')}
 if(endlessMode)$('levelChip').textContent='∞ ENDLESS · WAVE '+endlessWave;
 $('soundBtn').textContent=soundEnabled?'◖ SOUND ON':'◖ SOUND OFF';$('mobileSoundBtn').textContent=soundEnabled?'♫ ON':'♪ SND';$('rangeBtn').textContent=showRanges?'◎ RANGES ON':'◎ RANGES OFF';$('rangeBtn').classList.toggle('active',showRanges);$('mobileRangeBtn').classList.toggle('active',showRanges);$('mobileRangeBtn').textContent=showRanges?'◎ RNG':'○ RNG';
 if(savedPhase==='won'||savedPhase==='lost'){phase='live';finish(savedPhase==='won');$('pauseBtn').style.display='none'}
 updateButtons();updateToolUi();renderUI(true);minimap();if(feed.length)$('radioFeed').innerHTML=feed.map(x=>'<div class="feeditem"><span class="feedtime">'+x.time+'</span> '+x.text+'</div>').join('');
}
function renderMapOptions(){const wrap=$('mapOptions');wrap.replaceChildren();for(const [id,m] of Object.entries(MAPS)){if(id.startsWith('nyc_'))continue;const b=document.createElement('button');b.type='button';b.className='map-choice'+(id===chosenMap?' active':'');const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=m.name;small.textContent=m.desc;b.append(strong,small);b.onclick=()=>{chosenMap=id;renderMapOptions()};wrap.append(b)}$('mapDescription').textContent=chosenMap==='nyc'?'Real-scale New York: approximately 49 × 49 km. Manhattan blocks follow a rotated ~80 m street / ~230 m avenue grid. Shapes are geographic approximations, not exact parcel data.':(chosenMap==='nyc_megascale'?'Previous 22,080-unit NYC megascale, unchanged for older saves.':chosenMap==='nyc_expanded'?'Previous 1.6× five-borough layout, unchanged for older saves.':chosenMap==='nyc_standard'?'Previous five-borough world scale, preserved for existing saved operations.':chosenMap==='nyc_legacy'?'Previous compact New York district layout, retained for older saved campaigns.':'Original procedural map. Each district expands without moving existing structures.')}
function openMapMenu(){if(!$('introOverlay').classList.contains('hidden'))return;if(!confirm('Return to map selection? Save your current state first if you want to return to it.'))return;if(phase==='live')togglePause();chosenMap=activeMap;renderMapOptions();$('modalOverlay').classList.add('hidden');$('introOverlay').classList.remove('hidden');$('continueBtn').style.display=readSave()?'':'none';$('continueEndlessBtn').style.display=readEndlessCheckpoint()?'':'none';closeDrawers()}
function openSlots(mode){slotMode=mode;slotReturnPhase=phase;slotBusy=false;if(phase==='live'){phase='paused';updateButtons();renderUI(true)}closeDrawers();$('slotTitle').textContent=mode==='save'?'SAVE GAME':'LOAD GAME';$('slotHint').textContent=mode==='save'?'Choose a slot to store the current city, civilians, waves, units and budget. You can also export a portable backup.':'Choose a saved operation or import a backup file. Active outbreaks load paused.';$('slotExport').style.display=mode==='save'?'':'none';$('slotImport').style.display=mode==='load'?'':'none';$('slotMessage').textContent='';$('slotsOverlay').classList.remove('hidden');renderSlots()}
function closeSlots(resume=true){if(slotBusy)return;slotGeneration++;$('slotsOverlay').classList.add('hidden');if(resume&&slotReturnPhase==='live'&&phase==='paused')phase='live';slotReturnPhase=null;updateButtons();renderUI(true)}
async function renderSlots(){const generation=++slotGeneration,wrap=$('slotList');wrap.textContent='Reading save slots…';try{const rows=await slotReadAll();if(generation!==slotGeneration)return;wrap.replaceChildren();for(let i=1;i<=SLOT_COUNT;i++){const row=rows.find(r=>r.slot===i),el=document.createElement('div');el.className='slot-row';const info=document.createElement('div');info.className='slot-info';const h=document.createElement('strong'),p=document.createElement('small');h.textContent='SLOT '+i+(row?' · '+MAPS[validMap(row.mapId==='nyc'?(row.state?.layout?.mapVersion>=5?'nyc':row.state?.layout?.mapVersion===4?'nyc_megascale':row.state?.layout?.mapVersion===3?'nyc_expanded':row.state?.layout?.mapVersion===2?'nyc_standard':'nyc_legacy'):row.mapId)].name:' · EMPTY');p.textContent=row?'Stage '+(row.stage+1)+' / '+(row.mapId==='nyc'&&row.state?.layout?.mapVersion===5?6:row.mapId==='nyc'?20:6)+' · '+(row.endless?'Endless '+row.wave:row.phase)+' · '+new Date(row.savedAt).toLocaleString():'No saved operation';info.append(h,p);el.append(info);const button=document.createElement('button');button.textContent=slotMode==='save'?'SAVE':'LOAD';button.disabled=slotMode==='load'&&!row;button.onclick=()=>handleSlot(i,!!row);el.append(button);wrap.append(el)}}catch(e){if(generation===slotGeneration){wrap.textContent='Save storage is not available in this browser. Use EXPORT SAVE or IMPORT SAVE for portable backups.';$('slotMessage').textContent=e.message||'Storage unavailable'}}}
async function handleSlot(i,occupied){if(slotBusy)return;if(slotMode==='save'&&occupied&&!confirm('Overwrite slot '+i+'?'))return;if(slotMode==='load'&&!occupied)return;slotBusy=true;$('slotClose').disabled=true;$('slotMessage').textContent=slotMode==='save'?'Saving current operation…':'Restoring operation…';try{if(slotMode==='save'){const state=fullState();await slotWrite({slot:i,savedAt:Date.now(),mapId:activeMap,stage:scenarioIndex,phase:state.phase,endless:endlessMode,wave:endlessWave,state});$('slotMessage').textContent='Saved successfully to slot '+i+'.';await renderSlots()}else{const row=await slotRead(i);if(!row)throw Error('Slot is empty');restoreFull(row.state);slotBusy=false;closeSlots(false);notify('Slot '+i+' restored.');audioReady()}}catch(e){$('slotMessage').textContent='Unable to '+slotMode+': '+(e.message||'browser storage error')}finally{slotBusy=false;$('slotClose').disabled=false}}
$('saveGameBtn').onclick=$('sideSaveBtn').onclick=()=>openSlots('save');$('loadGameBtn').onclick=$('sideLoadBtn').onclick=$('introLoadBtn').onclick=()=>openSlots('load');$('mapsBtn').onclick=$('sideMapsBtn').onclick=openMapMenu;$('slotClose').onclick=()=>closeSlots();$('slotExport').onclick=exportSave;$('slotImport').onclick=()=>$('slotFile').click();$('slotFile').onchange=()=>importSave($('slotFile').files[0]);
renderMapOptions();

$('playBtn').onclick=()=>{audioReady();effectSound('ui');clearEndlessCheckpoint();reset(0,{mapId:chosenMap}).then(()=>notify('Stage 1 ready. Build your first shelter.'))};
$('continueBtn').onclick=()=>{audioReady();const d=readSave();if(d){reset(d.mapId==='nyc'&&d.mapVersion===5?Math.min(19,d.level*4+3):d.level,{load:d});notify('Your saved city and deployments have been restored.')}else{notify('No campaign save available.',true)}};
$('continueEndlessBtn').onclick=()=>{audioReady();const d=readEndlessCheckpoint();if(d)startEndless(d);else notify('No endless checkpoint available.',true)};
$('endlessLaunchBtn').onclick=()=>{audioReady();startEndless()};
$('helpBtn').onclick=()=>{effectSound('ui');showHelp()};$('mobileHelpBtn').onclick=()=>showHelp();$('resetBtn').onclick=()=>{effectSound('ui');retryLevel();notify('Stage restored from its checkpoint.')};$('mobileResetBtn').onclick=()=>{$('resetBtn').click();closeDrawers()};
$('startBtn').onclick=()=>{effectSound('ui');begin()};$('pauseBtn').onclick=()=>{effectSound('ui');togglePause()};
$('reviewResultsBtn').onclick=()=>{$('reviewControls').classList.add('hidden');$('modalOverlay').classList.remove('hidden')};
$('reviewContinueBtn').onclick=()=>{const success=phase==='won',final=scenarioIndex===campaignStages()-1;
 $('reviewControls').classList.add('hidden');if(endlessMode)retryLevel();else if(success&&!final)nextLevel();else if(success&&final)startEndless();else retryLevel()};
$('centerBtn').onclick=()=>{if(outbreak)centerCamera(outbreak.x,outbreak.y);else centerCamera(W/2,H/2);effectSound('ui')};
 $('overviewBtn').onclick=()=>{markZoomMoving();if(!isNYC()){cam.zoom=clamp(Math.min(cw/(VIS_W*1.22),ch/(VIS_H*1.22)),.12,.75);centerCamera(VIS_W/2,VIS_H/2);notify('FULL CITY · gray districts unlock in later stages');return}
  // NYC preview always frames all boroughs: inaccessible land is visible in
  // grayscale instead of disappearing until it becomes playable.
  let left=W,right=0,top=H,bottom=0;
  for(const borough of NYC_BOROUGHS){if(activeMap!=='nyc'&&!nycUnlocked(borough.name))continue;for(const pt of borough.poly){const x=pt.x*nycScale(),y=pt.y*nycScale();left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}}
  if(right<=left){left=0;right=W;top=0;bottom=H}
  const wx=(right-left)*1.14,hy=(bottom-top)*1.14,co=Math.abs(Math.cos(camera3D.yaw)),si=Math.abs(Math.sin(camera3D.yaw));
  const fitX=cw/(wx*co+hy*si),fitY=ch*Math.sin(camera3D.tilt)/(wx*si+hy*co);
  cam.zoom=clamp(Math.min(fitX,fitY),NYC_MIN_ZOOM,.8);centerCamera((left+right)/2,(top+bottom)/2);notify(activeMap==='nyc'?'FULL NYC · gray boroughs unlock later':'NYC DISTRICT VIEW · pinch to zoom')};
$('sideOverviewBtn').onclick=()=>{$('overviewBtn').click();closeDrawers()};
$('mobileToggle').onclick=()=>drawer('tools');$('mobileToolsBtn').onclick=()=>drawer('tools');$('mobileIntelBtn').onclick=()=>drawer('intel');$('mobileBackdrop').onclick=closeDrawers;
$('mobilePanBtn').onclick=()=>{toolId=null;selected=null;drag=null;pendingZone=[];updatePolyControls();closeDrawers();updateToolUi();renderUI(true);notify('Pan mode: drag to move, pinch to zoom.')};
$('mobileZoomIn').onclick=()=>zoomAt(-280,cw/2,ch/2);$('mobileZoomOut').onclick=()=>zoomAt(280,cw/2,ch/2);
$('mobileSoundBtn').onclick=()=>{$('soundBtn').click()};$('orbitBtn').onclick=()=>rotate3DCamera(.34);$('mobileOrbitBtn').onclick=()=>rotate3DCamera(.34);
function toggleRanges(){showRanges=!showRanges;$('rangeBtn').textContent=showRanges?'◎ RANGES ON':'◎ RANGES OFF';$('rangeBtn').classList.toggle('active',showRanges);$('mobileRangeBtn').classList.toggle('active',showRanges);$('mobileRangeBtn').textContent=showRanges?'◎ RNG':'○ RNG';effectSound('ui')}
$('rangeBtn').onclick=toggleRanges;$('mobileRangeBtn').onclick=toggleRanges;$('mobileRangeBtn').classList.add('active');
$('clearBtn').onclick=()=>{effectSound('ui');if(phase!=='planning')return;for(const x of [...defenses,...zones,...walls,...gates])budget+=x.price;defenses=[];zones=[];gates=[];walls=[];wallGridDirty=true;beaconGridDirty=true;selected=null;renderUI(true);saveCampaign();notify('All planned deployments cleared.')};
$('soundBtn').onclick=()=>{soundEnabled=!soundEnabled;$('soundBtn').textContent=soundEnabled?'◖ SOUND ON':'◖ SOUND OFF';$('mobileSoundBtn').textContent=soundEnabled?'♫ ON':'♪ SND';if(soundEnabled){audioReady();playTone(650,.08,.025);effectSound('radio')}};
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=+b.dataset.speed;effectSound('ui');updateButtons()}));
let previous=performance.now(),elapsedUI=0,elapsedMini=0,lastWorldRender=0;
function frame(now){let dt=clamp((now-previous)/1000,0,.075);previous=now;detourBudget=Math.min(24,detourBudget+dt*42);const pan=(activeMap==='nyc'?640:510)*dt/cam.zoom;if(keys.has('a')||keys.has('arrowleft'))cam.x-=pan;if(keys.has('d')||keys.has('arrowright'))cam.x+=pan;if(keys.has('w')||keys.has('arrowup'))cam.y-=pan;if(keys.has('s')||keys.has('arrowdown'))cam.y+=pan;clampCamera();if(phase==='live'&&$('introOverlay').classList.contains('hidden')&&$('slotsOverlay').classList.contains('hidden')){const scaled=dt*speed,steps=Math.max(1,Math.ceil(scaled/.065));for(let i=0;i<steps;i++){if(phase!=='live')break;tick(scaled/steps)}}
 ambientClock+=dt;if(ambientClock>1.05){ambientClock=0;ambientSound()}const movingZoom=performance.now()<zoomPerf.movingUntil;
 const sceneGap=movingZoom?(cam.zoom<.32?90:60):cam.zoom<.035?95:cam.zoom<.15?60:cam.zoom<.32?34:0,minFrameGap=Math.max(sceneGap,deviceProfile.frameGap);if(!loadingBusy&&$('introOverlay').classList.contains('hidden')&&now-lastWorldRender>=minFrameGap){drawCanvas();lastWorldRender=now}elapsedUI+=dt;elapsedMini+=dt;if(!loadingBusy&&elapsedUI>.22){renderUI(false);elapsedUI=0}if(!loadingBusy&&elapsedMini>(deviceProfile.constrained ? .58 : .38)&&staticMap){minimap();elapsedMini=0}if(toastUntil&&now>toastUntil){$('toast').classList.remove('show');toastUntil=0}requestAnimationFrame(frame)}
window.addEventListener('resize',resize);resize();$('introOverlay').classList.remove('hidden');$('continueBtn').style.display=readSave()?'':'none';$('continueEndlessBtn').style.display=readEndlessCheckpoint()?'':'none';requestAnimationFrame(frame);
})();
