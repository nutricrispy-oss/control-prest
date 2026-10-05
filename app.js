'use strict';
// ===== Utilidades =====
const $=s=>document.querySelector(s),g=id=>$('#'+id).value;
const fmt=n=>'Gs. '+Math.round(n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const P=s=>new Date(s+'T12:00:00'),hoy=()=>iso(new Date());
const dmy=s=>s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'-';
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const addM=(b,k)=>{const t=b.getMonth()+k,y=b.getFullYear()+Math.floor(t/12),m=((t%12)+12)%12;
 return new Date(y,m,Math.min(b.getDate(),new Date(y,m+1,0).getDate()),12)};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// ===== Base de datos (IndexedDB) =====
const S=['clientes','prestamos','cuotas','caja','feriados','audit','config'];let C={},V='inicio';
const DB={db:null,open(){return new Promise((r,j)=>{const q=indexedDB.open('crzprest',1);
 q.onupgradeneeded=()=>S.forEach(n=>q.result.createObjectStore(n,{keyPath:'id',autoIncrement:n!=='config'}));
 q.onsuccess=()=>{this.db=q.result;r()};q.onerror=()=>j(q.error)})},
 run(s,m,f){return new Promise((r,j)=>{const t=this.db.transaction(s,m);const q=f(t.objectStore(s));t.oncomplete=()=>r(q&&q.result);t.onerror=()=>j(t.error)})},
 all:s=>DB.run(s,'readonly',o=>o.getAll()),put:(s,v)=>DB.run(s,'readwrite',o=>o.put(v)),clear:s=>DB.run(s,'readwrite',o=>o.clear())};
const load=async()=>{for(const s of S)C[s]=await DB.all(s)};
const aud=(a,e,id,d)=>DB.put('audit',{accion:a,entidad:e,entidadId:id,fecha:new Date().toISOString(),datos:d||''});
const cfg=k=>(C.config.find(x=>x.id===k)||{}).v;
// ===== Reglas de negocio =====
function fechas(mod,n,primer,noDom,noFer){const fer=new Set(C.feriados.map(f=>f.fecha)),out=[],base=P(primer);
 const ok=d=>!(noDom&&d.getDay()===0)&&!(noFer&&fer.has(iso(d)));
 if(mod==='diario'){let d=base;for(let i=0;i<n;i++){while(!ok(d))d=addD(d,1);out.push(iso(d));d=addD(d,1)}}
 else for(let i=0;i<n;i++)out.push(iso(mod==='semanal'?addD(base,7*i):mod==='quincenal'?addD(base,15*i):addM(base,i)));
 return out}
function calc(monto,int,n){const mi=Math.round(monto*int/100),total=monto+mi,b=Math.floor(total/n);return{mi,total,cuota:b,ultima:total-b*(n-1)}}
const cuP=p=>C.cuotas.filter(c=>c.prestamoId===p.id).sort((a,b)=>a.numero-b.numero);
const venc=c=>c.estado==='pendiente'&&c.fechaVencimiento<hoy();
const resumen=p=>{const q=cuP(p).filter(c=>c.estado!=='anulada');const pg=q.filter(c=>c.estado==='pagada'),pe=q.filter(c=>c.estado==='pendiente');
 return{q,pagadas:pg.length,rest:pe.length,venc:pe.filter(venc).length,pagado:pg.reduce((s,c)=>s+c.importe,0),pend:pe.reduce((s,c)=>s+c.importe,0)}};
const cli=id=>C.clientes.find(c=>c.id===id)||{nombre:'?'};
const saldoCaja=()=>C.caja.filter(m=>!m.anulado).reduce((s,m)=>s+(m.tipo==='ingreso'?m.importe:-m.importe),0);
// ===== UI base =====
const modal=h=>{$('#m').innerHTML='<div>'+h+'</div>';$('#m').style.display='flex'};
const close=()=>{$('#m').style.display='none'};
$('#m').onclick=e=>{if(e.target.id==='m')close()};
const NAV=[['inicio','🏠','Inicio'],['clientes','👥','Clientes'],['nuevo','➕','Préstamo'],['prestamos','📄','Préstamos'],['caja','💰','Caja']];
function go(v,x){V=v;window.X=x;render()}
async function refresh(){await load();render()}
function render(){
 $('#nav').innerHTML=NAV.map(n=>`<a class="${V===n[0]?'on':''}" onclick="go('${n[0]}')"><b>${n[1]}</b>${n[2]}</a>`).join('');
 $('#h').innerHTML=`<span onclick="go('mas')" style="float:right;cursor:pointer">☰</span>Control Prest by CR`;
 $('#main').innerHTML=({calendario:vCal,reportes:vRep,inicio:vInicio,clientes:vClientes,nuevo:vNuevo,prestamos:vPrestamos,caja:vCaja,mas:vMas}[V])();
 if(V==='nuevo')prev()}
// ===== Inicio =====
function vInicio(){const h=hoy(),mes=h.slice(0,7),act=C.prestamos.filter(p=>p.estado==='activo');
 const all=C.cuotas.filter(c=>c.estado==='pendiente'),dueHoy=all.filter(c=>c.fechaVencimiento===h),vc=all.filter(venc);
 const pag=C.cuotas.filter(c=>c.estado==='pagada'),cm=pag.filter(c=>(c.fechaPago||'').slice(0,7)===mes),ch=pag.filter(c=>(c.fechaPago||'').slice(0,10)===h);
 const sum=a=>a.reduce((s,c)=>s+c.importe,0),K=(k,v,cl='')=>(cfg('hid')||[]).includes(k)?'':`<div class="card"><div class="k">${k}</div><div class="v ${cl}">${v}</div></div>`;
 const fila=c=>{const p=C.prestamos.find(x=>x.id===c.prestamoId);return`<div class="row"><div><b>${esc(cli(p.clienteId).nombre)}</b><br><span class="k">Cuota ${c.numero}/${p.cuotas} · ${dmy(c.fechaVencimiento)}</span></div><div style="text-align:right"><b>${fmt(c.importe)}</b><br><button class="sm" onclick="cobrar(${c.id})">COBRAR</button></div></div>`};
 return bk()+`<div class="grid">${K('Clientes activos',C.clientes.filter(c=>c.estado==='activo').length)}${K('Préstamos activos',act.length)}
 ${K('Capital prestado',fmt(act.reduce((s,p)=>s+p.monto,0)))}${K('Pendiente por cobrar',fmt(sum(all)))}
 ${K('Cobros de hoy',fmt(sum(ch)))}${K('Cobros del mes',fmt(sum(cm)))}
 ${K('Cuotas vencidas',vc.length+' · '+fmt(sum(vc)),vc.length?'neg':'')}${K('Saldo en caja',fmt(saldoCaja()),saldoCaja()<0?'neg':'pos')}</div>
 <div class="card"><h3>COBRAR HOY</h3>${dueHoy.length?`<p class="k">🟠 ${dueHoy.length} cuotas hoy por ${fmt(sum(dueHoy))}</p>`+dueHoy.map(fila).join('')+`<button class="w" style="margin-top:10px" onclick="cobrarTodo()">COBRAR TODO EL DÍA</button>`:'<p class="k">Sin cuotas para hoy.</p>'}</div>
 ${vc.length?`<div class="card"><h3>🔴 Vencidas</h3>${vc.slice(0,15).map(fila).join('')}</div>`:''}`}
// ===== Cobros =====
function cobrar(id){const c=C.cuotas.find(x=>x.id===id),p=C.prestamos.find(x=>x.id===c.prestamoId);
 modal(`<h3>Cobrar cuota ${c.numero}/${p.cuotas}</h3><p>${esc(cli(p.clienteId).nombre)} — <b>${fmt(c.importe)}</b></p>
 <label>Método de pago</label><select id="mp"><option>Efectivo</option><option>Transferencia</option><option>Otro</option></select>
 <button class="w" onclick="doCobro(${id},g('mp'))">Confirmar cobro</button><button class="w s" style="margin-top:8px" onclick="close()">Cancelar</button>`)}
async function doCobro(id,mp,silent){const c=C.cuotas.find(x=>x.id===id),p=C.prestamos.find(x=>x.id===c.prestamoId);
 if(c.estado!=='pendiente')return;const now=new Date().toISOString();
 const mid=await DB.put('caja',{tipo:'ingreso',categoria:'cuota',importe:c.importe,fecha:hoy(),referencia:'cuota:'+id,observacion:cli(p.clienteId).nombre});
 await DB.put('cuotas',{...c,estado:'pagada',fechaPago:now,metodoPago:mp,movimientoId:mid});
 await aud('Pago registrado','cuota',id,{importe:c.importe,mp});
 await load();const q=cuP(p).filter(x=>x.estado==='pendiente');
 if(!q.length&&p.estado==='activo'){await DB.put('prestamos',{...p,estado:'finalizado'});await load()}
 if(!silent){render();recibo(id)}}
async function cobrarTodo(){const l=C.cuotas.filter(c=>c.estado==='pendiente'&&c.fechaVencimiento===hoy());
 if(!l.length||!confirm(`¿Cobrar ${l.length} cuotas de hoy?`))return;for(const c of l)await doCobro(c.id,'Efectivo',true);await refresh()}
async function revertir(id){const c=C.cuotas.find(x=>x.id===id),p=C.prestamos.find(x=>x.id===c.prestamoId);
 if(!confirm(`¿Deseas revertir el pago de ${fmt(c.importe)} realizado por ${cli(p.clienteId).nombre}?`))return;
 const m=C.caja.find(x=>x.id===c.movimientoId);if(m)await DB.put('caja',{...m,anulado:true});
 await DB.put('cuotas',{...c,estado:'pendiente',fechaPago:null,metodoPago:null,movimientoId:null,reversiones:(c.reversiones||0)+1});
 if(p.estado==='finalizado')await DB.put('prestamos',{...p,estado:'activo'});
 await aud('Pago revertido','cuota',id,{importe:c.importe});await load();det(p.id)}
// ===== Clientes =====
function vClientes(){const q=(window.Q||'').toLowerCase();
 const l=C.clientes.filter(c=>!q||[c.nombre,c.cedula,c.telefono].join(' ').toLowerCase().includes(q));
 return`<input placeholder="🔍 Buscar nombre, cédula, teléfono" value="${esc(window.Q||'')}" oninput="window.Q=this.value;render();const i=$('input');i.focus();i.setSelectionRange(99,99)">
 <button class="w" onclick="fCli()">+ Nuevo cliente</button><div style="height:12px"></div>
 <div class="card">${l.map(c=>`<div class="row" onclick="ficha(${c.id})"><div>${sem(c)}<b>${esc(c.nombre)}</b><br><span class="k">${esc(c.cedula)} · ${esc(c.telefono)}</span></div><span class="k">${c.estado}</span></div>`).join('')||'<p class="k">Sin clientes.</p>'}</div>`}
function sem(c){const ps=C.prestamos.filter(p=>p.clienteId===c.id&&p.estado==='activo');if(!ps.length)return'<span class="d" style="background:#000"></span>';
 const v=ps.reduce((s,p)=>s+resumen(p).venc,0);return`<span class="d" style="background:${v>2?'var(--r)':v?'var(--y)':'var(--g2)'}"></span>`}
function fCli(id){const c=C.clientes.find(x=>x.id===id)||{estado:'activo'};
 const f=(i,l,t='text')=>`<label>${l}</label><input id="${i}" type="${t}" value="${esc(c[i])}">`;
 modal(`<h3>${id?'Editar':'Nuevo'} cliente</h3>${f('nombre','Nombre y apellido')}${f('cedula','Cédula')}${f('telefono','Teléfono','tel')}${f('whatsapp','WhatsApp','tel')}${f('direccion','Dirección')}${f('referencia','Referencia personal')}${f('telefonoReferencia','Teléfono de referencia','tel')}${f('observaciones','Observaciones')}
 <label>Estado</label><select id="estado">${['activo','inactivo','bloqueado'].map(e=>`<option ${c.estado===e?'selected':''}>${e}</option>`)}</select>
 <button class="w" onclick="sCli(${id||0})">Guardar</button>`)}
async function sCli(id){if(!g('nombre').trim())return alert('Ingresa el nombre');
 const o=C.clientes.find(x=>x.id===id)||{createdAt:new Date().toISOString()},n={...o};
 ['nombre','cedula','telefono','whatsapp','direccion','referencia','telefonoReferencia','observaciones','estado'].forEach(k=>n[k]=g(k).trim());
 n.updatedAt=new Date().toISOString();const nid=await DB.put('clientes',n);
 await aud(id?'Cliente modificado':'Cliente creado','cliente',id||nid);close();refresh()}
function ficha(id){const c=C.clientes.find(x=>x.id===id),ps=C.prestamos.filter(p=>p.clienteId===id);
 const R=ps.map(resumen),tot=ps.reduce((s,p)=>s+p.monto,0);
 modal(`<h3>${esc(c.nombre)}</h3><p class="k">CI ${esc(c.cedula)} · ${esc(c.telefono)}<br>${esc(c.direccion)}<br>Ref: ${esc(c.referencia)} ${esc(c.telefonoReferencia)}</p>
 <div class="grid"><div class="card"><div class="k">Total prestado</div><b>${fmt(tot)}</b></div><div class="card"><div class="k">Pagado</div><b>${fmt(R.reduce((s,r)=>s+r.pagado,0))}</b></div>
 <div class="card"><div class="k">Pendiente</div><b>${fmt(R.reduce((s,r)=>s+r.pend,0))}</b></div><div class="card"><div class="k">Cuotas vencidas</div><b>${R.reduce((s,r)=>s+r.venc,0)}</b></div></div>
 <div class="card">${ps.map(p=>`<div class="row" onclick="det(${p.id})"><span>#${p.id} · ${fmt(p.monto)} · ${p.modalidad}</span><span class="k">${p.estado}</span></div>`).join('')||'<p class="k">Sin préstamos.</p>'}</div>
 <button class="w" onclick="close();go('nuevo',{cid:${id}})">Nuevo préstamo</button>
 <button class="w s" style="margin-top:8px" onclick="wa('${esc(c.whatsapp||c.telefono)}','Hola ${esc(c.nombre.split(' ')[0])}, ')">WhatsApp</button>
 <button class="w s" style="margin-top:8px" onclick="fCli(${id})">Editar cliente</button>`)}
// ===== Nuevo préstamo / calculadora =====
function vNuevo(){const x=window.X||{};
 if(!C.clientes.length)return`<div class="card">Primero crea un cliente.<br><br><button onclick="go('clientes')">Ir a Clientes</button></div>`;
 return`<div class="card"><h3>${x.ant?'Renovación':'Nuevo préstamo'}</h3><label>Cliente</label><select id="cl">${C.clientes.filter(c=>c.estado==='activo').map(c=>`<option value="${c.id}" ${c.id===x.cid?'selected':''}>${esc(c.nombre)}</option>`)}</select>
 <label>Monto solicitado (Gs.)</label><input id="mo" type="number" inputmode="numeric" oninput="prev()"><label>Interés (%)</label><input id="in" type="number" inputmode="decimal" value="26" oninput="prev()">
 <label>Cantidad de cuotas</label><input id="nc" type="number" inputmode="numeric" value="30" oninput="prev()">
 <label>Modalidad</label><select id="md" onchange="prev()"><option value="diario">Diario</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option></select>
 <label class="ck"><input type="checkbox" id="nd" checked onchange="prev()">No cobrar domingos</label><label class="ck"><input type="checkbox" id="nf" checked onchange="prev()">No cobrar feriados</label><br>
 <label>Fecha de otorgamiento</label><input id="fo" type="date" value="${hoy()}"><label>Primer vencimiento</label><input id="pv" type="date" value="${iso(addD(new Date(),1))}" onchange="prev()">
 <div id="pr" class="card" style="background:var(--bg)"></div><button class="w" onclick="resumenPrestamo()">Revisar y confirmar</button></div>`}
function dat(){const m=+g('mo'),n=Math.max(1,Math.floor(+g('nc'))),i=+g('in');return{m,n,i,mod:g('md'),...calc(m,i,n),f:fechas(g('md'),n,g('pv'),$('#nd').checked,$('#nf').checked)}}
function prev(){if(!$('#pr'))return;const d=dat();$('#pr').innerHTML=d.m>0?`Interés: <b>${fmt(d.mi)}</b><br>Total a devolver: <b>${fmt(d.total)}</b><br>Cuota: <b>${fmt(d.cuota)}</b>${d.ultima!==d.cuota?` (última ${fmt(d.ultima)})`:''}<br>Último vencimiento: <b>${dmy(d.f[d.f.length-1])}</b>`:'<span class="k">Ingresa un monto</span>'}
function resumenPrestamo(){const d=dat();if(!(d.m>0)||!g('pv'))return alert('Completa monto y primer vencimiento');
 modal(`<h3>Resumen antes de prestar</h3><div class="card">${cli(+g('cl')).nombre}<br>Capital: <b>${fmt(d.m)}</b><br>Interés ${d.i}%: <b>${fmt(d.mi)}</b> (ganancia)<br>Total: <b>${fmt(d.total)}</b><br>${d.n} cuotas ${d.mod}s de <b>${fmt(d.cuota)}</b><br>Primer venc.: ${dmy(d.f[0])}<br>Último venc.: ${dmy(d.f[d.n-1])}</div>
 <button class="w" onclick="guardarPrestamo()">Confirmar préstamo</button>`)}
async function guardarPrestamo(){const d=dat(),x=window.X||{};
 const p={clienteId:+g('cl'),prestamoAnteriorId:x.ant||null,monto:d.m,interes:d.i,montoInteres:d.mi,total:d.total,cuotas:d.n,importeCuota:d.cuota,modalidad:d.mod,
 fechaOtorgamiento:g('fo'),primerVencimiento:d.f[0],ultimoVencimiento:d.f[d.n-1],noCobraDomingos:$('#nd').checked,noCobraFeriados:$('#nf').checked,estado:'activo',createdAt:new Date().toISOString()};
 const pid=await DB.put('prestamos',p);
 for(let i=0;i<d.n;i++)await DB.put('cuotas',{prestamoId:pid,numero:i+1,fechaVencimiento:d.f[i],importe:i===d.n-1?d.ultima:d.cuota,estado:'pendiente',fechaPago:null,metodoPago:null});
 await DB.put('caja',{tipo:'egreso',categoria:'préstamo otorgado',importe:d.m,fecha:g('fo'),referencia:'prestamo:'+pid,observacion:cli(p.clienteId).nombre});
 await aud(x.ant?'Préstamo renovado':'Préstamo creado','prestamo',pid,{monto:d.m});close();window.X=null;await load();go('prestamos')}
// ===== Préstamos =====
function vPrestamos(){const f=window.F||'todos',l=C.prestamos.filter(p=>f==='todos'||p.modalidad===f||p.estado===f).sort((a,b)=>b.id-a.id);
 return`<select onchange="window.F=this.value;render()">${['todos','activo','finalizado','renovado','diario','semanal','quincenal','mensual'].map(o=>`<option ${o===f?'selected':''}>${o}</option>`)}</select>
 <div class="card">${l.map(p=>{const r=resumen(p);return`<div class="row" onclick="det(${p.id})"><div><b>${esc(cli(p.clienteId).nombre)}</b><br><span class="k">#${p.id} · ${p.modalidad} · ${r.pagadas}/${p.cuotas} pagadas</span></div><div style="text-align:right"><b>${fmt(r.pend)}</b><br><span class="k ${r.venc?'neg':''}">${r.venc?r.venc+' vencidas':p.estado}</span></div></div>`}).join('')||'<p class="k">Sin préstamos.</p>'}</div>`}
function det(id){const p=C.prestamos.find(x=>x.id===id),r=resumen(p),q=cuP(p);
 modal(`<h3>Préstamo #${id} · ${esc(cli(p.clienteId).nombre)}</h3><div class="card">Capital ${fmt(p.monto)} · Interés ${p.interes}% (${fmt(p.montoInteres)})<br>Total ${fmt(p.total)} · ${p.cuotas} cuotas de ${fmt(p.importeCuota)}<br>${dmy(p.primerVencimiento)} → ${dmy(p.ultimoVencimiento)} · <b>${p.estado}</b><br>Pagado <b class="pos">${fmt(r.pagado)}</b> · Pendiente <b>${fmt(r.pend)}</b><br>Restantes ${r.rest} · Vencidas ${r.venc}</div>
 <div class="card">${q.map(c=>{const e=c.estado==='pagada'?'🟢':c.estado==='anulada'?'⚪':venc(c)?'🔴':'🟠';return`<div class="row"><span>${e} ${c.numero}. ${dmy(c.fechaVencimiento)}<br><span class="k">${c.estado==='pagada'?dmy(c.fechaPago.slice(0,10))+' · '+c.metodoPago:''}</span></span><span>${fmt(c.importe)} ${c.estado==='pendiente'&&p.estado==='activo'?`<button class="sm" onclick="cobrar(${c.id})">Cobrar</button>`:c.estado==='pagada'?`<button class="sm s" onclick="revertir(${c.id})">Revertir</button>`:''}</span></div>`}).join('')}</div>
 <button class="w" onclick="waPrest(${id})">Enviar WhatsApp</button><button class="w s" style="margin-top:8px" onclick="pdfPrest(${id})">PDF del préstamo</button>${p.estado==='activo'?`<button class="w s" style="margin-top:8px" onclick="renovar(${id})">Renovar préstamo</button>`:''}`)}
async function renovar(id){const p=C.prestamos.find(x=>x.id===id),r=resumen(p);
 const v=prompt(`Pendiente actual: ${fmt(r.pend)}\nCapital pendiente aprox.: ${fmt(Math.round(r.pend*p.monto/p.total))}\n\n¿Qué importe cancela el cliente? (Gs.)`,r.pend);
 if(v===null||isNaN(+v))return;const imp=Math.max(0,Math.round(+v));
 for(const c of q(p).filter(c=>c.estado==='pendiente'))await DB.put('cuotas',{...c,estado:'anulada'});
 await DB.put('prestamos',{...p,estado:'renovado'});
 if(imp)await DB.put('caja',{tipo:'ingreso',categoria:'renovación',importe:imp,fecha:hoy(),referencia:'prestamo:'+id,observacion:cli(p.clienteId).nombre});
 await aud('Préstamo renovado','prestamo',id,{cancelado:imp});await load();close();go('nuevo',{cid:p.clienteId,ant:id})}
const q=cuP;
// ===== WhatsApp =====
function waPrest(id){const p=C.prestamos.find(x=>x.id===id),c=cli(p.clienteId),r=resumen(p);
 const t=waTxt(p,c,r);
 modal(`<h3>WhatsApp</h3><label>Número</label><select id="wn"><option value="${esc(c.whatsapp||c.telefono)}">Cliente: ${esc(c.whatsapp||c.telefono)}</option>${c.telefonoReferencia?`<option value="${esc(c.telefonoReferencia)}">Referencia: ${esc(c.telefonoReferencia)}</option>`:''}</select>
 <label>Mensaje (editable)</label><textarea id="wt" rows="12">${esc(t)}</textarea><button class="w" onclick="wa(g('wn'),g('wt'))">Abrir WhatsApp</button>`)}
function wa(num,txt){let n=String(num).replace(/\D/g,'');if(n.startsWith('0'))n='595'+n.slice(1);window.open('https://wa.me/'+n+'?text='+encodeURIComponent(txt),'_blank')}
// ===== Caja =====
function vCaja(){const m=[...C.caja].sort((a,b)=>b.id-a.id).slice(0,40),act=C.prestamos.filter(p=>p.estado==='activo');
 const pend=C.cuotas.filter(c=>c.estado==='pendiente').reduce((s,c)=>s+c.importe,0);
 return`<div class="card"><div class="k">Dinero en caja</div><div class="v ${saldoCaja()<0?'neg':'pos'}">${fmt(saldoCaja())}</div><div class="k" style="margin-top:8px">Capital prestado: ${fmt(act.reduce((s,p)=>s+p.monto,0))}<br>Pendiente de cobro: ${fmt(pend)}</div></div>
 <div class="grid"><button onclick="fCaja('ingreso')">+ Ingreso</button><button class="s" onclick="fCaja('egreso')">+ Egreso</button></div><button class="w s" style="margin:10px 0" onclick="fCaja('extraccion')">Registrar extracción</button>
 <div class="card">${m.map(x=>`<div class="row" style="${x.anulado?'opacity:.4;text-decoration:line-through':''}"><span>${esc(x.categoria)}<br><span class="k">${dmy(x.fecha)} · ${esc(x.observacion)}</span></span><b class="${x.tipo==='ingreso'?'pos':'neg'}">${x.tipo==='ingreso'?'+':'-'}${fmt(x.importe)}</b></div>`).join('')||'<p class="k">Sin movimientos.</p>'}</div>`}
function fCaja(t){window.T=t;modal(`<h3>${t==='ingreso'?'Ingreso':t==='egreso'?'Egreso':'Extracción'}</h3><label>Concepto / motivo</label><input id="cc"><label>Importe (Gs.)</label><input id="ci" type="number" inputmode="numeric"><label>Fecha</label><input id="cf" type="date" value="${hoy()}"><button class="w" onclick="sCaja()">Guardar</button>`)}
async function sCaja(){const i=Math.round(+g('ci'));if(!(i>0))return alert('Importe inválido');const t=window.T;
 const id=await DB.put('caja',{tipo:t==='ingreso'?'ingreso':'egreso',categoria:t==='extraccion'?'extracción':t==='ingreso'?'otros ingresos':'gasto',importe:i,fecha:g('cf'),referencia:'',observacion:g('cc')});
 await aud(t==='ingreso'?'Ingreso registrado':t==='egreso'?'Egreso registrado':'Extracción registrada','caja',id,{importe:i});close();refresh()}
// ===== Más: feriados, backup, PIN, tema =====
function vMas(){const fe=[...C.feriados].sort((a,b)=>a.fecha.localeCompare(b.fecha));
 return`<div class="grid"><button onclick="go('calendario')">📅 Calendario</button><button onclick="go('reportes')">📊 Reportes</button></div><button class="w s" style="margin:10px 0" onclick="setNom()">Nombre del prestamista: ${esc(cfg('nombre')||'(sin definir)')}</button><div class="card"><h3>Copia de seguridad</h3><p class="k">Última: ${cfg('ultimoBackup')?new Date(cfg('ultimoBackup')).toLocaleString():'nunca'}</p><button class="w" onclick="exportar()">Exportar copia (JSON)</button>
 <label style="display:block;margin-top:10px">Restaurar copia</label><input type="file" accept=".json" onchange="importar(this.files[0])"></div>
 <div class="card"><h3>Seguridad</h3><button class="w" onclick="setPin()">${cfg('pin')?'Cambiar':'Crear'} PIN (6-8 dígitos)</button></div>
 <div class="card"><h3>Biometría</h3><p class="k">Desbloqueo con la huella o el rostro del teléfono. El PIN sigue disponible.</p>${cfg('bio')?'<button class="w s" onclick="bioOff()">Desactivar huella</button>':'<button class="w" onclick="bioOn()">Activar huella</button>'}</div>
 <div class="card"><h3>Respaldo en la nube</h3><p class="k">Google Drive · última copia: ${cfg('ultimoNube')?new Date(cfg('ultimoNube')).toLocaleString():'nunca'}</p><label>Client ID de Google</label><input id="gcid" value="${esc(cfg('gcid')||'')}" placeholder="xxxx.apps.googleusercontent.com"><button class="w" onclick="saveG()">Guardar y respaldar ahora en Drive</button>
 <label class="ck" style="margin:10px 0"><input type="checkbox" ${cfg('auto')?'checked':''} onchange="tglAuto()">Respaldo automático diario al abrir la app</label><button class="w s" onclick="compartirBackup()">Enviar copia a otra nube (Terabox, Dropbox…)</button></div>
 <div class="card"><h3>Apariencia</h3><div class="grid"><button class="s" onclick="tema('l')">Claro</button><button class="s" onclick="tema('d')">Oscuro</button></div></div>
 <div class="card"><h3>Tarjetas del inicio</h3>${HL.map(l=>`<label class="ck"><input type="checkbox" ${(cfg('hid')||[]).includes(l)?'':'checked'} onchange="tog('${l}')">${l}</label>`).join('')}</div>
 <div class="card"><h3>Mensaje de WhatsApp</h3><p class="k">Variables: {nombre} {monto} {interes} {total} {primer} {ultimo} {cuotas} {valor} {pagadas} {restantes} {saldo}</p><textarea id="wat" rows="10">${esc(cfg('wat')||DEFWA)}</textarea><div class="grid"><button onclick="saveWat()">Guardar</button><button class="s" onclick="resetWat()">Restablecer</button></div></div>
 <div class="card"><h3>Recibos</h3><label class="ck"><input type="checkbox" ${cfg('term')?'checked':''} onchange="tglTerm()">Formato térmico 58 mm</label></div>
 <div class="card"><h3>Auditoría (últimos 25)</h3>${[...C.audit].reverse().slice(0,25).map(x=>`<div class="row"><span>${esc(x.accion)}<br><span class="k">${esc(x.entidad)} #${x.entidadId}</span></span><span class="k">${new Date(x.fecha).toLocaleString()}</span></div>`).join('')||'<p class="k">Sin registros.</p>'}</div>
 <div class="card"><h3>Feriados / no cobrables</h3><input id="ff" type="date"><input id="fd" placeholder="Descripción"><button class="w" onclick="addFer()">Agregar</button>
 ${fe.map(f=>`<div class="row"><span>${dmy(f.fecha)} ${esc(f.descripcion)}</span><button class="sm r" onclick="delFer(${f.id})">✕</button></div>`).join('')}</div>`}
async function addFer(){if(!g('ff'))return;await DB.put('feriados',{fecha:g('ff'),descripcion:g('fd')});refresh()}
async function delFer(id){await DB.run('feriados','readwrite',o=>o.delete(id));refresh()}
function tema(t){localStorage.setItem('t',t);document.documentElement.dataset.t=t}
async function exportar(){await DB.put('config',{id:'ultimoBackup',v:new Date().toISOString()});await aud('Backup realizado','sistema',0);await load();
 const d={version:1,fecha:new Date().toISOString()};S.forEach(s=>d[s]=C[s].filter(x=>!(s==='config'&&['pin','bio','gcid'].includes(x.id))));
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d)],{type:'application/json'}));a.download='crzprest-backup-'+hoy()+'.json';a.click();render()}
async function importar(f){if(!f||!confirm('Esta operación reemplazará los datos actuales. ¿Continuar?'))return;
 try{const d=JSON.parse(await f.text());const keep=C.config.filter(x=>['pin','bio','gcid'].includes(x.id));
 for(const s of S){await DB.clear(s);for(const r of d[s]||[])await DB.put(s,r)}
 for(const k of keep)await DB.put('config',k);await aud('Restauración realizada','sistema',0);await refresh();alert('Copia restaurada')}catch(e){alert('Archivo inválido')}}
// ===== PIN (hash SHA-256 con sal) y bloqueo =====
const hash=async(p,s)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s+p)))].map(b=>b.toString(16).padStart(2,'0')).join('');
function setPin(){modal(`<h3>PIN</h3><input id="p1" type="password" inputmode="numeric" placeholder="6 a 8 dígitos"><input id="p2" type="password" inputmode="numeric" placeholder="Repetir PIN"><button class="w" onclick="savePin()">Guardar</button>`)}
async function savePin(){const a=g('p1');if(!/^\d{6,8}$/.test(a))return alert('El PIN debe tener 6 a 8 dígitos');if(a!==g('p2'))return alert('No coinciden');
 const s=crypto.randomUUID();await DB.put('config',{id:'pin',v:{s,h:await hash(a,s)}});close();refresh()}
function lock(){const p=cfg('pin');if(!p)return;$('#m').style.display='flex';$('#m').innerHTML=`<div style="text-align:center"><h3>🔒 Control Prest by CR</h3><input id="lp" type="password" inputmode="numeric" placeholder="PIN"><button class="w" onclick="unlock()">Entrar</button>${cfg('bio')?'<button class="w s" style="margin-top:8px" onclick="bioUnlock()">👆 Usar huella</button>':''}</div>`;$('#m').onclick=null;if(cfg('bio'))setTimeout(bioUnlock,300)}
async function unlock(){const p=cfg('pin');if(await hash(g('lp'),p.s)===p.h){close();$('#m').onclick=e=>{if(e.target.id==='m')close()}}else{$('#lp').value='';$('#lp').placeholder='PIN incorrecto'}}

// ===== Botón + rápido =====
function quick(){modal(`<h3>Acción rápida</h3><button class="w" onclick="close();fCli()">👤 Nuevo cliente</button><button class="w" style="margin-top:8px" onclick="close();go('nuevo')">📄 Nuevo préstamo</button><button class="w" style="margin-top:8px" onclick="close();go('inicio')">💵 Registrar cobro</button><button class="w s" style="margin-top:8px" onclick="fCaja('egreso')">Registrar egreso</button><button class="w s" style="margin-top:8px" onclick="fCaja('extraccion')">Registrar extracción</button>`)}
// ===== Calendario =====
const pad=n=>String(n).padStart(2,'0');
function cmes(k){const[y,m]=(window.CM||hoy().slice(0,7)).split('-').map(Number),d=new Date(y,m-1+k,1);window.CM=d.getFullYear()+'-'+pad(d.getMonth()+1);render()}
function vCal(){const mes=window.CM||hoy().slice(0,7),[y,m]=mes.split('-').map(Number),n=new Date(y,m,0).getDate(),f=new Date(y,m-1,1).getDay();
 const fer=new Set(C.feriados.map(x=>x.fecha)),by={};C.cuotas.filter(c=>c.estado==='pendiente'&&c.fechaVencimiento.startsWith(mes)).forEach(c=>(by[c.fechaVencimiento]=by[c.fechaVencimiento]||[]).push(c));
 let h='<div></div>'.repeat(f);for(let d=1;d<=n;d++){const k=mes+'-'+pad(d),a=by[k]||[],dom=new Date(y,m-1,d).getDay()===0;
 h+=`<div onclick="dia('${k}')" style="border:1px solid var(--b);border-radius:8px;padding:4px;min-height:52px;font-size:12px;background:${fer.has(k)?'#dc262622':dom?'#ea580c18':'var(--c)'}${k===hoy()?';outline:2px solid var(--g2)':''}"><b>${d}</b>${a.length?`<br>${a.length}<br><span class="pos">${Math.round(a.reduce((s,c)=>s+c.importe,0)/1000)}k</span>`:''}</div>`}
 return`<div class="row"><button class="sm s" onclick="cmes(-1)">◀</button><b>${pad(m)}/${y}</b><button class="sm s" onclick="cmes(1)">▶</button></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;margin-top:8px">${['D','L','M','M','J','V','S'].map(x=>`<b class="k">${x}</b>`).join('')}${h}</div><p class="k">Rojo: feriado · Naranja: domingo</p>`}
function dia(k){const l=C.cuotas.filter(c=>c.estado==='pendiente'&&c.fechaVencimiento===k);
 modal(`<h3>${dmy(k)}</h3><p class="k">${l.length} cuotas · ${fmt(l.reduce((s,c)=>s+c.importe,0))}</p><div class="card">${l.map(c=>{const p=C.prestamos.find(x=>x.id===c.prestamoId);return`<div class="row"><span>${esc(cli(p.clienteId).nombre)}<br><span class="k">Cuota ${c.numero}/${p.cuotas}</span></span><span>${fmt(c.importe)} <button class="sm" onclick="cobrar(${c.id})">Cobrar</button></span></div>`}).join('')||'<p class="k">Sin cobros.</p>'}</div>`)}
// ===== Recibos =====
function setNom(){const n=prompt('Nombre del prestamista (aparece en recibos):',cfg('nombre')||'');if(n!==null)DB.put('config',{id:'nombre',v:n}).then(refresh)}
function recibo(id){const c=C.cuotas.find(x=>x.id===id),p=C.prestamos.find(x=>x.id===c.prestamoId),cl=cli(p.clienteId),r=resumen(p),no='R-'+String(id).padStart(6,'0');
 window.RT=`*Control Prest by CR - Recibo ${no}*\nCliente: ${cl.nombre}\nCI: ${cl.cedula}\nPréstamo #${p.id} - Cuota ${c.numero}/${p.cuotas}\nFecha de pago: ${dmy((c.fechaPago||'').slice(0,10))}\nImporte: ${fmt(c.importe)}\nSaldo pendiente: ${fmt(r.pend)}\nCuotas restantes: ${r.rest}`;
 modal(`<div id="rc" style="text-align:center${cfg('term')?';width:58mm;font-size:11px;margin:auto':''}"><h3>Control Prest by CR</h3><p class="k">${esc(cfg('nombre')||'')}</p><div class="card" style="text-align:left">Comprobante: <b>${no}</b><br>Cliente: ${esc(cl.nombre)}<br>Cédula: ${esc(cl.cedula)}<br>Préstamo #${p.id} · Cuota ${c.numero}/${p.cuotas}<br>Fecha de pago: ${dmy((c.fechaPago||'').slice(0,10))}<br>Método: ${esc(c.metodoPago)}<br><b>Importe: ${fmt(c.importe)}</b><br>Saldo pendiente: ${fmt(r.pend)}<br>Cuotas restantes: ${r.rest}</div></div>
 <button class="w" onclick="window.print()">Imprimir / Guardar PDF</button><button class="w s" style="margin-top:8px" onclick="wa('${esc(cl.whatsapp||cl.telefono)}',window.RT)">Compartir por WhatsApp</button><button class="w s" style="margin-top:8px" onclick="close()">Cerrar</button>`)}
// ===== Reportes =====
function vRep(){const d=window.RD||hoy().slice(0,8)+'01',h=window.RH||hoy(),en=x=>x>=d&&x<=h;
 const pg=C.cuotas.filter(c=>c.estado==='pagada'&&en((c.fechaPago||'').slice(0,10))&&okc(c)),cob=pg.reduce((s,c)=>s+c.importe,0);
 const int=pg.reduce((s,c)=>{const p=C.prestamos.find(x=>x.id===c.prestamoId);return s+Math.round(c.importe*p.montoInteres/p.total)},0);
 const ot=C.prestamos.filter(p=>en(p.fechaOtorgamiento)&&okp(p)),cj=C.caja.filter(m=>!m.anulado&&en(m.fecha)),sm=cat=>cj.filter(m=>m.categoria===cat).reduce((s,m)=>s+m.importe,0);
 const dias=[...Array(7)].map((_,i)=>iso(addD(new Date(),i-6))),vals=dias.map(x=>C.cuotas.filter(c=>c.estado==='pagada'&&(c.fechaPago||'').slice(0,10)===x).reduce((s,c)=>s+c.importe,0)),mx=Math.max(...vals,1);
 const R=(k,v)=>`<div class="row"><span>${k}</span><b>${v}</b></div>`;
 return`<div class="card"><label>Desde</label><input type="date" id="rd" value="${d}" onchange="window.RD=this.value;render()"><label>Hasta</label><input type="date" id="rh" value="${h}" onchange="window.RH=this.value;render()"><label>Cliente</label><select onchange="window.RC=this.value;render()"><option value="">Todos</option>${C.clientes.map(c=>`<option value="${c.id}" ${+window.RC===c.id?'selected':''}>${esc(c.nombre)}</option>`)}</select><label>Modalidad</label><select onchange="window.RM=this.value;render()">${['','diario','semanal','quincenal','mensual'].map(m=>`<option value="${m}" ${window.RM===m?'selected':''}>${m||'Todas'}</option>`)}</select>
 ${R('Cobros ('+pg.length+' cuotas)',fmt(cob))}${R('Intereses cobrados',fmt(int))}${R('Préstamos otorgados ('+ot.length+')',fmt(ot.reduce((s,p)=>s+p.monto,0)))}${R('Renovaciones (cancelaciones)',fmt(sm('renovación')))}${R('Egresos (gastos)',fmt(sm('gasto')))}${R('Extracciones',fmt(sm('extracción')))}
 <button class="w" style="margin-top:10px" onclick="csv()">Exportar cobros CSV</button></div>
 <div class="card"><h3>Cobros últimos 7 días</h3><div style="display:flex;gap:6px;align-items:flex-end;height:110px">${vals.map((v,i)=>`<div style="flex:1;text-align:center"><div style="background:var(--g2);height:${Math.round(v/mx*80)}px;border-radius:4px"></div><span class="k">${dias[i].slice(8)}</span></div>`).join('')}</div></div>`}
function csv(){const d=window.RD||hoy().slice(0,8)+'01',h=window.RH||hoy(),rows=[['fecha','cliente','prestamo','cuota','importe','metodo']];
 C.cuotas.filter(c=>c.estado==='pagada'&&c.fechaPago.slice(0,10)>=d&&c.fechaPago.slice(0,10)<=h&&okc(c)).forEach(c=>{const p=C.prestamos.find(x=>x.id===c.prestamoId);rows.push([c.fechaPago.slice(0,10),'"'+cli(p.clienteId).nombre+'"',p.id,c.numero,c.importe,c.metodoPago])});
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}));a.download='cobros-'+d+'_'+h+'.csv';a.click()}

// ===== Ajustes finales =====
const HL=['Clientes activos','Préstamos activos','Capital prestado','Pendiente por cobrar','Cobros de hoy','Cobros del mes','Cuotas vencidas','Saldo en caja'];
const okp=p=>(!window.RC||p.clienteId==window.RC)&&(!window.RM||p.modalidad===window.RM),okc=c=>okp(C.prestamos.find(x=>x.id===c.prestamoId));
const DEFWA='Hola {nombre}, te enviamos el detalle de tu préstamo.\n\n💰 Monto otorgado: {monto}\n📈 Interés: {interes} %\n💵 Total a devolver: {total}\n📅 Primer vencimiento: {primer}\n📅 Último vencimiento: {ultimo}\n💳 Cuotas: {cuotas}\n💰 Valor de cuota: {valor}\n\n✅ Cuotas pagadas: {pagadas}\n⏳ Cuotas restantes: {restantes}\n💵 Saldo pendiente: {saldo}\n\nGracias.';
function waTxt(p,c,r){const m={nombre:c.nombre.split(' ')[0],monto:fmt(p.monto),interes:p.interes,total:fmt(p.total),primer:dmy(p.primerVencimiento),ultimo:dmy(p.ultimoVencimiento),cuotas:p.cuotas,valor:fmt(p.importeCuota),pagadas:r.pagadas,restantes:r.rest,saldo:fmt(r.pend)};return(cfg('wat')||DEFWA).replace(/\{(\w+)\}/g,(x,k)=>k in m?m[k]:x)}
const saveWat=async()=>{await DB.put('config',{id:'wat',v:g('wat')});alert('Mensaje guardado')};
const resetWat=async()=>{await DB.run('config','readwrite',o=>o.delete('wat'));refresh()};
async function tog(l){const h=[...(cfg('hid')||[])],i=h.indexOf(l);i<0?h.push(l):h.splice(i,1);await DB.put('config',{id:'hid',v:h});refresh()}
const tglTerm=async()=>{await DB.put('config',{id:'term',v:!cfg('term')});refresh()};
function pdfPrest(id){const p=C.prestamos.find(x=>x.id===id),c=cli(p.clienteId),r=resumen(p);
 modal(`<div id="rc"><h3 style="text-align:center">Control Prest by CR — Préstamo #${id}</h3><p class="k">${esc(cfg('nombre')||'')}</p><p>Cliente: <b>${esc(c.nombre)}</b> · CI ${esc(c.cedula)} · ${esc(c.telefono)}<br>Capital ${fmt(p.monto)} · Interés ${p.interes}% (${fmt(p.montoInteres)}) · Total ${fmt(p.total)}<br>${p.cuotas} cuotas ${p.modalidad}s de ${fmt(p.importeCuota)} · ${dmy(p.primerVencimiento)} → ${dmy(p.ultimoVencimiento)}<br>Estado: <b>${p.estado}</b> · Pagado ${fmt(r.pagado)} · Saldo ${fmt(r.pend)}</p>
 <table style="width:100%;font-size:13px;border-collapse:collapse"><tr><th align="left">Nº</th><th align="left">Vence</th><th align="right">Importe</th><th align="left">Estado</th><th align="left">Pago</th></tr>${cuP(p).map(x=>`<tr style="border-top:1px solid var(--b)"><td>${x.numero}</td><td>${dmy(x.fechaVencimiento)}</td><td align="right">${fmt(x.importe)}</td><td>${venc(x)?'vencida':x.estado}</td><td>${x.fechaPago?dmy(x.fechaPago.slice(0,10))+' '+esc(x.metodoPago):''}</td></tr>`).join('')}</table></div>
 <button class="w" style="margin-top:10px" onclick="window.print()">Imprimir / Guardar PDF</button><button class="w s" style="margin-top:8px" onclick="det(${id})">Volver</button>`)}

// ===== Respaldo en la nube =====
const bjson=()=>{const d={version:1,fecha:new Date().toISOString()};S.forEach(s=>d[s]=C[s].filter(x=>!(s==='config'&&['pin','bio','gcid'].includes(x.id))));return JSON.stringify(d)};
const bk=()=>{if(!C.clientes.length)return'';const l=[cfg('ultimoBackup'),cfg('ultimoNube')].filter(Boolean).sort().pop();return !l||l.slice(0,10)<hoy()?'<div class="card" style="border-color:var(--o)">⚠️ Aún no hiciste la copia de hoy. <button class="sm" onclick="go(\'mas\')">Respaldar</button></div>':''};
function gtoken(inter){return new Promise((res,rej)=>{const go=()=>google.accounts.oauth2.initTokenClient({client_id:cfg('gcid'),scope:'https://www.googleapis.com/auth/drive.file',prompt:inter?'consent':'none',callback:r=>r.access_token?res(r.access_token):rej(r),error_callback:rej}).requestAccessToken();
 if(window.google&&google.accounts)return go();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=go;s.onerror=()=>rej('sin conexión');document.head.appendChild(s)})}
async function driveBackup(inter){if(!cfg('gcid'))return;
 try{const t=await gtoken(inter),n='crzprest-backup-'+hoy()+'.json',H={Authorization:'Bearer '+t},body=bjson();
 const l=await(await fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(`name='${n}' and trashed=false`),{headers:H})).json();let r;
 if(l.files&&l.files[0])r=await fetch('https://www.googleapis.com/upload/drive/v3/files/'+l.files[0].id+'?uploadType=media',{method:'PATCH',headers:{...H,'Content-Type':'application/json'},body});
 else{const f=new FormData();f.append('metadata',new Blob([JSON.stringify({name:n,mimeType:'application/json'})],{type:'application/json'}));f.append('file',new Blob([body],{type:'application/json'}));r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:H,body:f})}
 if(!r.ok)throw 0;await DB.put('config',{id:'ultimoNube',v:new Date().toISOString()});await aud('Backup realizado','nube',0,{destino:'drive'});await load();render();if(inter)alert('Copia guardada en Google Drive')}
 catch(e){if(inter)alert('No se pudo respaldar en Drive. Revisá el Client ID, la conexión y que tu cuenta esté como usuario de prueba.')}}
async function saveG(){await DB.put('config',{id:'gcid',v:g('gcid').trim()});await load();driveBackup(true)}
const tglAuto=async()=>{await DB.put('config',{id:'auto',v:!cfg('auto')});refresh()};
async function autoBackup(){if(!cfg('auto')||!cfg('gcid')||!navigator.onLine)return;const l=cfg('ultimoNube');if(l&&l.slice(0,10)===hoy())return;driveBackup(false)}
async function compartirBackup(){const n='crzprest-backup-'+hoy()+'.json',f=new File([bjson()],n,{type:'application/json'});
 if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:n});await DB.put('config',{id:'ultimoBackup',v:new Date().toISOString()});await load();render()}catch(e){}}else exportar()}
// ===== Biometría (WebAuthn) =====
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))),ub=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const openApp=()=>{close();$('#m').onclick=e=>{if(e.target.id==='m')close()}};
async function bioOn(){if(!cfg('pin'))return alert('Primero creá un PIN');if(!window.PublicKeyCredential)return alert('Este navegador no soporta biometría');
 try{const c=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'Control Prest by CR'},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'usuario',displayName:'Usuario'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},timeout:60000}});
 await DB.put('config',{id:'bio',v:b64(c.rawId)});alert('Huella activada');refresh()}catch(e){alert('No se pudo activar la biometría')}}
async function bioUnlock(){try{await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:'public-key',id:ub(cfg('bio'))}],userVerification:'required',timeout:60000}});openApp()}catch(e){}}
const bioOff=async()=>{await DB.run('config','readwrite',o=>o.delete('bio'));refresh()};
let idle;const rst=()=>{clearTimeout(idle);idle=setTimeout(lock,120000)};['click','touchstart','keydown'].forEach(e=>addEventListener(e,rst));
// ===== Inicio =====
(async()=>{const t=localStorage.getItem('t');if(t)document.documentElement.dataset.t=t;
 await DB.open();await load();render();lock();rst();autoBackup();
 if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js')})();
