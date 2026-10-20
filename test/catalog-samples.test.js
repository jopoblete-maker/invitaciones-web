"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const Samples=require("../js/core/catalog-samples"),Catalog=require("../js/core/template-catalog"),Contact=require("../js/core/commercial-contact"),Registry=require("../js/core/template-registry");
const approved=[["01","22_51_53","Boda clásica marfil","bodas"],["02","22_52_30","Boda romántica rosa","bodas"],["03","22_57_20","Boda gala negra y oro","bodas"],["04","22_53_06","Boda campestre oliva","bodas"],["05","22_54_28","XV princesa rosa","xv"],["06","22_54_58","XV lila y mariposas","xv"],["07","22_55_34","Cumpleaños infantil multicolor","cumpleanos"],["08","22_56_09","Cumpleaños elegante azul y oro","cumpleanos"],["09","22_56_38","Baby shower osito","infantiles"],["10","22_56_57","Bautismo celeste","infantiles"],["12","23_03_51","Egresados","celebraciones"],["13","23_04_15","Evento empresarial","celebraciones"],["14","23_04_48","Cumpleaños tropical","cumpleanos"],["17","23_09_02","Encuentro de cacería","tematicas"],["18","23_09_25","Fiesta deportiva","tematicas"],["19","23_09_51","Celebramos entre paisajes","tematicas"],["20","23_10_17","Nos vamos de viaje","tematicas"],["21","23_10_36","Nos reunimos","reuniones"],["22","23_10_52","Fiesta de jubilación","celebraciones"],["23","23_11_29","Asado con amigos","reuniones"],["24","23_11_44","Cena con amigos","reuniones"],["25","23_11_57","Cena en familia","reuniones"]];
const entries=Catalog.buildSampleEntries(Samples);
assert.equal(entries.length,22);assert.equal(Samples.categories().length,7);
assert.deepEqual(entries.map(s=>[s.number,s.sourceFile,s.name,s.category]),approved.map(([number,time,name,category])=>[number,"Imagen de ChatGPT 19 oct 2026, "+time+".png",name,category]));
assert.equal(new Set(entries.map(s=>s.id)).size,22);
assert(Object.isFrozen(Samples.list())&&Object.isFrozen(Samples.list()[0].image));
function dimensions(b){assert.equal(b.toString("ascii",0,4),"RIFF");assert.equal(b.toString("ascii",8,12),"WEBP");for(let p=12;p+8<=b.length;){const tag=b.toString("ascii",p,p+4),length=b.readUInt32LE(p+4),d=p+8;if(tag==="VP8X")return [1+b.readUIntLE(d+4,3),1+b.readUIntLE(d+7,3)];if(tag==="VP8 ")return [b.readUInt16LE(d+6)&16383,b.readUInt16LE(d+8)&16383];if(tag==="VP8L"){const bits=b.readUInt32LE(d+1);return [1+(bits&16383),1+((bits>>>14)&16383)];}p=d+length+(length%2);}throw new Error("Missing WebP dimensions");}
for(const s of entries){
 assert.equal(s.kind,"visual-sample");assert.equal(Registry.getTemplate(s.id),undefined);
 assert.match(s.sourceSha256,/^[0-9a-f]{64}$/);
 for(const key of ["thumbnail","image"]){const r=s[key],b=fs.readFileSync(path.join(__dirname,"..",r.src));assert.equal(b.length,r.bytes);assert.equal(crypto.createHash("sha256").update(b).digest("hex"),r.sha256);assert.deepEqual(dimensions(b),[r.width,r.height]);}
 assert.deepEqual([s.image.width,s.image.height],[941,1672]);assert(s.thumbnail.width===480&&s.thumbnail.height===853);
 const r=Contact.sampleRequest(s.id,Samples),u=new URL(r.href);
 assert.equal(u.origin,"https://wa.me");assert.equal(u.pathname,"/5491157339281");assert.equal(u.searchParams.get("text"),r.message);
 assert(r.message.includes(s.number)&&r.message.includes(s.name)&&r.message.includes(s.id));assert.equal(r.actionLabel,"Solicitar esta invitación");
}
for(const id of ["muestra-11","muestra-15","muestra-16","muestra-26","../admin",null,"boda-fiesta-premium"])assert.throws(()=>Contact.sampleRequest(id,Samples));
const special={...entries[0],name:"Celebración & oro + ¿sí?",phone:"000",href:"https://invalid.example"};
assert.equal(new URL(Contact.sampleRequest(special.id,{getSample:()=>special}).href).searchParams.get("text"),Contact.sampleRequest(special.id,{getSample:()=>special}).message);
function manifest(rows){return {list:()=>rows,categories:()=>Samples.categories()};}
for(const modify of [s=>({...s,id:"muestra-99"}),s=>({...s,number:"11"}),s=>({...s,name:""}),s=>({...s,category:"unknown"}),s=>({...s,image:{...s.image,src:"https://invalid.example/image.webp"}}),s=>({...s,thumbnail:{...s.thumbnail,width:0}})])assert.throws(()=>Catalog.buildSampleEntries(manifest([modify(entries[0])])));
assert.throws(()=>Catalog.buildSampleEntries(manifest([entries[0],entries[0]])));
console.log("22 samples: approved identity, 44 WebP hashes/dimensions, safe contact and malformed entries PASS");
