/* 仅供 UI 评审：无压缩引擎、无上传、无业务数据写入。 */
(() => {
'use strict';
const variant = document.body.dataset.variant;
const $ = s => document.querySelector(s);
const assets = '../../../../src/assets/';
const icons = {
image:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
folder:'<path d="M3 7V5h6l2 2h10v13H3Z"/>',
grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
home:'<path d="m3 10 9-7 9 7M5 9v12h14V9m-10 12v-7h6v7"/>',
check:'<path d="m5 12 4 4L19 6"/>',
close:'<path d="m6 6 12 12M18 6 6 18"/>',
moon:'<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
leaf:'<path d="M20 3C6 2 1 10 6 17s15 3 14-14ZM5 21 16 8"/>'
};
const icon = name => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mb = bytes => (bytes / 1048576).toFixed(2) + ' MB';
let serial = 0, items = [], busy = false, mode = 'standard', step = 1, startedAt = 0, frame = 0, toastTimer, importing = false;
const seed = [
['薄荷盆栽.png',4.82,'pc/plant/cycle/07-full.png'],
['云朵文件夹.png',2.31,'pc/home-folder.png'],
['巡逻飞行器.png',3.76,'pc/games/plane/player.png'],
['春日幼苗.png',5.12,'pc/plant/cycle/04-juvenile.png'],
['绽放时刻.png',6.47,'pc/plant/cycle/10-bloom-full.png'],
['应用图标.png',1.28,'pc/app-icon.png']
];
function samples(){items.forEach(x=>{if(x.objectUrl)URL.revokeObjectURL(x.url)});items=seed.map((x,i)=>({id:++serial,name:x[0],path:'示例素材 / '+x[0],size:x[1]*1048576,url:assets+x[2],selected:true,status:'waiting',demo:true,index:i}));}
function toast(message){$('#toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',4500);}
function nav(){return '<aside class="sidebar"><div class="brand row"><span class="brand-mark">'+icon('leaf')+'</span>提示词管家</div><nav><div class="nav-caption">我的工作空间</div>'+[['home','首页'],['grid','提示词库'],['image','图片压缩'],['check','目标计划'],['folder','分类与标签']].map(([i,t])=>'<div class="nav-item '+(t==='图片压缩'?'current':'')+'">'+icon(i)+t+'</div>').join('')+'</nav><div class="sidebar-foot">'+icon('shield')+' 本地优先，安心创作<br><small>导航仅展示 · 不跳转业务页面</small></div></aside>';}
function drop(){return '<div class="drop" id="drop"><div class="drop-emblem">'+icon('upload')+'</div><div><h2>把图片放进来，轻装出发</h2><p>拖放多个 PNG，或一次选择整个文件夹</p><div class="row wrap"><button class="primary" data-action="files">'+icon('image')+' 选择图片</button><button data-action="folder">'+icon('folder')+' 导入文件夹</button></div><p style="margin-bottom:0">预览限 100 张 / 单张 20 MB · 仅本地读取，不上传</p></div></div>';}
function settings(){return '<aside class="panel settings"><h2>压缩偏好</h2><span class="field-label">优化力度</span><div class="segmented"><button data-mode="standard" aria-pressed="'+(mode==='standard')+'" class="'+(mode==='standard'?'selected':'')+'">标准压缩</button><button data-mode="deep" aria-pressed="'+(mode==='deep')+'" class="'+(mode==='deep'?'selected':'')+'">深度压缩</button></div><p class="hint" id="modeHint">'+(mode==='standard'?'平衡处理速度与体积，适合日常批量操作。':'尝试更多优化策略，耗时更长；不改变画质。')+'</p><div class="setting-section"><span class="field-label">无损保护 · 设计约定</span><div class="safe-row"><span>尺寸与像素</span><span>保持原样</span></div><div class="safe-row"><span>透明与色彩信息</span><span>保留</span></div><div class="safe-row"><span>提示词元数据</span><span>保留</span></div><div class="safe-row"><span>原始文件</span><span>不覆盖</span></div></div><div class="setting-section"><span class="field-label">本次批量任务</span><div class="summary-number" id="selectedCount">6 <small>张图片</small></div><div class="row between hint"><span>所选原始体积</span><span id="selectedBytes"></span></div><div class="progress-track" role="progressbar" aria-label="模拟任务进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="progress"></span></div><div class="hint" id="progressText">等待开始 · 结果均为演示</div><button class="primary full" data-action="run">开始模拟压缩</button><button class="plain full small" data-action="cancel" hidden>取消模拟</button></div><p class="note">'+icon('shield')+' 本页未接入 Oxipng。文件不会被压缩、修改或发送至服务器。</p></aside>';}
function queueHeader(){return '<div class="queue-head row between"><div class="row"><h2>待处理图片</h2><span class="counter" id="totalCount"></span></div><div class="row"><button class="plain small" data-action="samples">恢复示例</button><button class="plain small" data-action="clear">清空队列</button></div></div>';}
function table(){return '<div class="table-scroll"><table class="queue"><thead><tr><th><input id="selectAll" type="checkbox" aria-label="全选图片"></th><th>图片名称</th><th>原始大小</th><th>模拟结果</th><th>状态</th><th><span class="muted">操作</span></th></tr></thead><tbody id="rows"></tbody></table><div id="empty" class="empty" hidden><strong>这里还没有图片</strong>选择图片或文件夹，开始构建你的批量任务。</div></div>';}
function mainPanel(){return '<section class="panel main-panel">'+drop()+queueHeader()+(variant==='b'?'<div class="row between queue-foot" style="margin:0 0 15px"><label><input id="selectAll" type="checkbox"> 全选图片</label><span>点击勾选，组成你的批量任务</span></div><div id="rows" class="gallery"></div><div id="empty" class="empty" hidden><strong>还没有图片</strong>从上方导入本地 PNG。</div>':table())+'<div class="queue-foot">保留目录路径用于区分同名文件 · 不扫描磁盘，仅处理主动选择的文件</div></section>';}
function footer(){return '<div class="bottom-bar"><div><strong id="resultSummary">准备好，为图片减减负。</strong><div class="hint" style="margin:3px 0 0">真实压缩尚未接入 · 下方只可导出模拟任务清单</div></div><button data-action="export" disabled>'+icon('upload')+' 导出演示报告</button></div><div class="footer-copy"><span>PNG 无损压缩 · 界面概念预览</span><span>本地读取 / 不上传 / 不覆盖原图</span></div>';}
function wizard(){return '<div class="columns"><nav class="steps" aria-label="处理步骤">'+[['添加图片','批量导入素材'],['压缩设置','确认保护选项'],['处理结果','查看模拟结果']].map(([a,b],i)=>'<button class="step '+(step===i+1?'selected':'')+'" data-step="'+(i+1)+'" '+(step===i+1?'aria-current="step"':'')+'><span class="step-num">0'+(i+1)+'</span><span>'+a+'<small>'+b+'</small></span></button>').join('')+'</nav><section class="panel wizard-panel">'+(step===1?'<span class="eyebrow">第一步 / 收集素材</span><h2 style="margin-top:6px">一次导入，一起处理。</h2>'+drop()+queueHeader()+table():step===2?'<span class="eyebrow">第二步 / 安心设置</span>'+settings():'<div class="result-heading"><div class="result-orb">'+icon('check')+'</div><h2>给每一张图片，一个清晰的结果。</h2><p>以下为模拟结果，未生成压缩图片。</p></div>'+queueHeader()+table())+'<div class="wizard-bottom row between"><button class="plain" data-action="back" '+(step===1?'disabled':'')+'>上一步</button><button class="primary" data-action="'+(step===2?'run':step===3?'export':'next')+'" '+(step===3&&!items.some(x=>x.status==='done'||x.status==='skip')?'disabled':'')+'>'+(step===1?'下一步 · 压缩设置':step===2?'开始模拟压缩':'导出演示报告')+'</button></div></section></div>';}
function render(){
const names={a:'批量工作台',b:'视觉画廊',c:'步骤向导'};
$('#app').innerHTML='<div class="demo-bar"><span>设计预览 · '+names[variant]+' · 未接入真实压缩</span><nav><a href="index.html">方案总览</a><a class="'+(variant==='a'?'active':'')+'" href="方案一-批量工作台.html">A 工作台</a><a class="'+(variant==='b'?'active':'')+'" href="方案二-视觉画廊.html">B 画廊</a><a class="'+(variant==='c'?'active':'')+'" href="方案三-步骤向导.html">C 向导</a></nav></div><div class="shell">'+nav()+'<main class="workspace"><div class="topbar row between"><span class="breadcrumb">工作空间 / 图片压缩</span><div class="tools row"><select id="theme" aria-label="工作台主题">'+[['sky','晴空巡逻'],['rose','蔷薇漫游'],['caramel','焦糖午后'],['forest','松林远足'],['night','星夜侦察'],['mint','海盐薄荷']].map(([v,l])=>'<option value="'+v+'" '+(document.documentElement.dataset.workbenchTheme===v?'selected':'')+'>'+l+'</option>').join('')+'</select><button class="small" data-action="appearance" aria-label="切换浅深色">'+icon('moon')+' 切换外观</button></div></div><header class="intro"><div><div class="eyebrow">给创作留一点轻盈</div><h1>'+(variant==='b'?'让好图片，轻一点。':'图片无损压缩')+'</h1><p>批量整理你的 PNG，让体积更小，让细节留下。</p></div><div class="hero-tag">'+icon('shield')+'<span>保留每一处细节<br><b>原尺寸 · 原像素 · 原透明</b></span></div></header>'+(variant==='c'?wizard():'<div class="columns">'+mainPanel()+settings()+'</div>')+footer()+'</main></div><input type="file" id="files" accept="image/png,.png" multiple hidden><input type="file" id="folder" accept="image/png,.png" webkitdirectory multiple hidden><div class="toast" id="toast" role="status" aria-live="polite"></div>';
$('#files').addEventListener('change',e=>addFiles(e.target.files));$('#folder').addEventListener('change',e=>addFiles(e.target.files));
$('#theme').addEventListener('change',e=>document.documentElement.dataset.workbenchTheme=e.target.value);
const target=$('#drop');if(target){target.addEventListener('dragover',e=>{e.preventDefault();target.classList.add('over')});target.addEventListener('dragleave',()=>target.classList.remove('over'));target.addEventListener('drop',e=>{e.preventDefault();target.classList.remove('over');addFiles(e.dataTransfer.files)});}
updateRows();updateSummary();
}
function updateRows(){
if(!$('#rows'))return;
const statusText={waiting:'等待处理',running:'模拟处理中',done:'模拟完成',skip:'模拟无需优化'};
$('#rows').innerHTML=items.map(x=>{
const size=x.status==='done'?mb(x.size*(x.ratio||1)):x.status==='skip'?'保持原样':'—';
const select='<input type="checkbox" data-select="'+x.id+'" aria-label="选择 '+esc(x.name)+'" '+(x.selected?'checked':'')+' '+(busy?'disabled':'')+'>';
const remove='<button class="remove" data-remove="'+x.id+'" aria-label="移除 '+esc(x.name)+'" '+(busy?'disabled':'')+'>'+icon('close')+'</button>';
const image='<img class="thumb" src="'+esc(x.url)+'" alt="" loading="lazy">';
const title='<div class="file-name" title="'+esc(x.name)+'">'+esc(x.name)+'</div>';
const status='<span class="status '+x.status+'">'+statusText[x.status]+'</span>';
return variant==='b'?'<article class="image-card"><span class="select-card">'+select+'</span>'+remove+'<div class="image-stage">'+image+'</div><div class="card-copy">'+title+'<div class="file-path">'+(x.demo?'示例素材':esc(x.path))+'</div><div class="row between"><span>'+mb(x.size)+'</span>'+status+'</div><div class="hint">模拟结果：'+size+'</div></div></article>':'<tr><td>'+select+'</td><td><div class="file-cell">'+image+'<div>'+title+'<div class="file-path" title="'+esc(x.path)+'">'+esc(x.path)+'</div></div></div></td><td style="white-space:nowrap">'+mb(x.size)+'</td><td style="white-space:nowrap">'+size+'</td><td>'+status+'</td><td>'+remove+'</td></tr>';
}).join('');
$('#empty').hidden=items.length>0;
if($('#totalCount'))$('#totalCount').textContent=items.length+' 张';
const all=$('#selectAll');if(all){all.checked=items.length>0&&items.every(x=>x.selected);all.indeterminate=items.some(x=>x.selected)&&!all.checked;all.disabled=busy||!items.length;all.onchange=()=>{items.forEach(x=>x.selected=all.checked);updateRows();updateSummary()};}
}
function updateSummary(){
const selected=items.filter(x=>x.selected),done=items.filter(x=>['done','skip'].includes(x.status)),saved=done.reduce((sum,x)=>sum+(x.status==='done'?x.size*(1-x.ratio):0),0);
if($('#selectedCount'))$('#selectedCount').innerHTML=selected.length+' <small>张图片</small>';
if($('#selectedBytes'))$('#selectedBytes').textContent=mb(selected.reduce((sum,x)=>sum+x.size,0));
const count=selected.filter(x=>['done','skip'].includes(x.status)).length,percent=selected.length?Math.round(count/selected.length*100):0;
if($('#progress')){$('#progress').style.width=percent+'%';$('.progress-track').setAttribute('aria-valuenow',percent);}
if($('#progressText'))$('#progressText').textContent=busy?'模拟处理 '+count+' / '+selected.length+' 张':done.length?'模拟任务完成 / 可重新演示':'等待开始 · 结果均为演示';
$('#resultSummary').textContent=done.length?'模拟完成 '+done.length+' 张 · 模拟节省 '+mb(saved):'已选 '+selected.length+' 张，准备好一起处理。';
document.querySelectorAll('[data-action="run"]').forEach(b=>{b.disabled=busy||importing||!selected.length;b.textContent=busy?'模拟处理中…':'开始模拟压缩';});
document.querySelectorAll('[data-action="export"]').forEach(b=>b.disabled=busy||!done.length);
document.querySelectorAll('[data-action="cancel"]').forEach(b=>b.hidden=!busy);
document.querySelectorAll('[data-action="files"],[data-action="folder"],[data-action="clear"],[data-action="samples"],[data-mode],[data-step]').forEach(b=>b.disabled=busy||importing);
document.querySelectorAll('[data-action="next"]').forEach(b=>b.disabled=!selected.length||importing);
document.querySelectorAll('[data-action="back"]').forEach(b=>b.disabled=busy||importing||step===1);
}
async function addFiles(list){
if(busy||importing)return;
importing=true;updateSummary();let added=0,skipped=0;
try{
for(const f of Array.from(list)){
const key=(f.webkitRelativePath||f.name)+'|'+f.size+'|'+f.lastModified;
if(items.length>=100||f.size>20*1048576||!f.name.toLowerCase().endsWith('.png')||items.some(x=>x.key===key)){skipped++;continue;}
const bytes=new Uint8Array(await f.slice(0,8).arrayBuffer());
if(![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){skipped++;continue;}
items.push({id:++serial,name:f.name,path:f.webkitRelativePath||f.name,size:f.size,url:URL.createObjectURL(f),objectUrl:true,key,selected:true,status:'waiting',demo:false});added++;
}
toast('已加入 '+added+' 张 PNG'+(skipped?'；跳过 '+skipped+' 项（重复、非 PNG 或超出预览限制）':'')+'。仅预览，不执行压缩。');
}catch{toast('部分文件读取失败，请重新选择。');}
finally{importing=false;$('#files').value='';$('#folder').value='';updateRows();updateSummary();}
}
function run(){
if(busy||importing)return;const selected=items.filter(x=>x.selected);if(!selected.length){toast('请先选择图片。');return;}
selected.forEach(x=>{x.status='waiting';x.ratio=1;});busy=true;startedAt=Date.now();const per=mode==='deep'?700:450;
function tick(){
const elapsed=Date.now()-startedAt;
selected.forEach((x,i)=>{x.status=elapsed>=(i+1)*per?(i===selected.length-1&&selected.length>2?'skip':'done'):elapsed>=i*per?'running':'waiting';x.ratio=x.status==='done'?(mode==='deep'?.69:.78)+(i%3)*.035:1;});
updateRows();updateSummary();
if(elapsed<selected.length*per){frame=requestAnimationFrame(tick);}else{busy=false;if(variant==='c'){step=3;render();}else{updateRows();updateSummary();}toast('模拟处理结束。节省体积为虚构演示值，没有生成压缩图片。');}
}tick();
}
function cancel(){cancelAnimationFrame(frame);busy=false;items.forEach(x=>{if(x.status==='running')x.status='waiting'});updateRows();updateSummary();toast('已取消模拟，原文件未被修改。');}
function report(){
const done=items.filter(x=>['done','skip'].includes(x.status));if(!done.length)return;
const data={说明:'界面演示报告：未执行真实压缩，结果大小均为模拟值，不可用于验收压缩效果。',模式:mode==='deep'?'深度压缩':'标准压缩',图片:done.map(x=>({名称:x.name,原始字节:x.size,模拟结果字节:Math.round(x.size*x.ratio),状态:x.status==='skip'?'模拟无需优化':'模拟完成'}))};
const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='图片压缩-演示报告.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出演示报告，不包含压缩图片。');
}
document.addEventListener('click',e=>{
const b=e.target.closest('button');if(!b||b.disabled)return;
if(b.dataset.remove){const x=items.find(x=>x.id===Number(b.dataset.remove));if(x.objectUrl)URL.revokeObjectURL(x.url);items=items.filter(i=>i!==x);updateRows();updateSummary();return;}
if(b.dataset.mode){mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(n=>{n.classList.toggle('selected',n.dataset.mode===mode);n.setAttribute('aria-pressed',n.dataset.mode===mode)});$('#modeHint').textContent=mode==='deep'?'尝试更多优化策略，耗时更长；不改变画质。':'平衡处理速度与体积，适合日常批量操作。';return;}
if(b.dataset.step){if(Number(b.dataset.step)>1&&!items.some(x=>x.selected)){toast('请先加入并选择图片。');return;}step=Number(b.dataset.step);render();return;}
switch(b.dataset.action){
case 'files':$('#files').click();break;case 'folder':$('#folder').click();break;
case 'clear':items.forEach(x=>{if(x.objectUrl)URL.revokeObjectURL(x.url)});items=[];updateRows();updateSummary();break;
case 'samples':samples();updateRows();updateSummary();toast('已恢复 6 张演示素材。');break;
case 'run':run();break;case 'cancel':cancel();break;case 'export':report();break;
case 'appearance':document.documentElement.dataset.appearance=document.documentElement.dataset.appearance==='dark'?'light':'dark';break;
case 'next':step=2;render();break;case 'back':step=Math.max(1,step-1);render();break;
}
});
document.addEventListener('change',e=>{if(e.target.dataset.select){const x=items.find(x=>x.id===Number(e.target.dataset.select));x.selected=e.target.checked;updateRows();updateSummary();}});
window.addEventListener('beforeunload',()=>{cancelAnimationFrame(frame);items.forEach(x=>{if(x.objectUrl)URL.revokeObjectURL(x.url)});});
samples();render();
})();
