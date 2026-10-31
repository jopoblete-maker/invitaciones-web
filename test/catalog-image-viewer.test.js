"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const Samples=require("../js/core/catalog-samples"),Catalog=require("../js/core/template-catalog"),Registry=require("../js/core/template-registry"),Themes=require("../js/core/theme-registry");
const requests=[];
class Node{
 constructor(tag,doc){this.tagName=tag;this.doc=doc;this.children=[];this.attrs={};this.events={};this.dataset={};this.hidden=false;this.textContent="";const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:x=>{if(classes.has(x)){classes.delete(x);return false;}classes.add(x);return true;}};}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
 addEventListener(k,fn){(this.events[k]??=[]).push(fn);}async dispatch(k,event={}){for(const fn of this.events[k]||[])await fn({button:0,preventDefault(){},...event});}
 click(){return this.dispatch("click");}focus(){this.doc.activeElement=this;}select(){this.selected=true;}
 querySelectorAll(tag){return this.children.flatMap(n=>[...(tag==="button"&&n.tagName==="button"?[n]:[]),...n.querySelectorAll(tag)]);}
 querySelector(){return this.closeButton;}showModal(){this.open=true;this.closeButton.focus();}close(){this.open=false;return this.dispatch("close");}
 set src(v){this._src=v;requests.push(v);}get src(){return this._src;}removeAttribute(k){if(k==="src")this._src=undefined;delete this.attrs[k];}
}
function descendants(root){return root.children.flatMap(c=>[c,...descendants(c)]);}
function nodes(root,predicate){return descendants(root).filter(predicate);}
(async()=>{
 let ready;const ids={};const doc={createElement:tag=>new Node(tag,doc),getElementById:id=>ids[id],addEventListener:(k,fn)=>{if(k==="DOMContentLoaded")ready=fn;},defaultView:{navigator:{clipboard:null}}};
 doc.body=new Node("body",doc);
 for(const id of ["sampleViewer","sampleViewerImage","sampleViewerTitle","sampleViewerStatus","sampleViewerActions","sampleViewerScroll","sampleViewerZoom","sampleGroups","sampleFilters","sampleStatus","catalogGrid","catalogStatus","catalogSelection"])ids[id]=new Node(id==="sampleViewer"?"dialog":"div",doc);
 ids.sampleViewer.closeButton=new Node("button",doc);
 let previews=0,probes=0;
 const catalog={...Catalog,probeImage:async()=>{probes++;return true;},verifyCatalogPreview:async e=>{previews++;return e.slug==="boda-vertical";}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../js/catalogo.js"),"utf8"),{document:doc,CatalogSamples:Samples,TemplateCatalog:catalog,TemplateRegistry:Registry,ThemeRegistry:Themes,CommercialContact:require("../js/core/commercial-contact"),CommercialUI:require("../js/comercial"),console});
 await ready();
 assert.equal(nodes(ids.sampleGroups,n=>!!n.dataset.sampleId).length,22);
 const labels=nodes(ids.sampleGroups,n=>n.className==="catalog-design-label").map(n=>n.textContent);
 assert.deepEqual(labels,Samples.categories().flatMap(category=>Samples.list().filter(s=>s.category===category.id).map(s=>"Diseño "+s.number)));
 assert.equal(new Set(labels).size,22);
 for(const missing of ["11","15","16"])assert(!labels.includes("Diseño "+missing));
 const html=fs.readFileSync(path.join(__dirname,"../catalogo.html"),"utf8");
 assert(html.includes("<h1>Elegí el diseño de tu próxima celebración</h1>"));
 assert(html.includes("Explorá nuestras propuestas y elegí tu favorita. En YCOR personalizamos y creamos tu invitación digital con las funciones que necesites"));
 assert.equal(ids.sampleFilters.children.length,8);
 assert.equal(ids.catalogGrid.children.length,3);assert.equal(probes,3);assert.equal(previews,3);
 assert.equal(requests.filter(p=>p.includes("/muestras/")&&!p.endsWith("-mini.webp")).length,0);
 assert(nodes(ids.sampleGroups,n=>n.tagName==="img").every(n=>n.loading==="lazy"&&n.decoding==="async"));
 const filter=id=>ids.sampleFilters.children.find(b=>b.dataset.category===id);
 for(const category of Samples.categories()){await filter(category.id).click();const cards=nodes(ids.sampleGroups,n=>!!n.dataset.sampleId);assert.equal(cards.length,Samples.list().filter(s=>s.category===category.id).length);assert.equal(filter(category.id).attrs["aria-pressed"],"true");}
 await filter("bodas").click();
 const opener=nodes(ids.sampleGroups,n=>n.tagName==="button"&&n.textContent==="Ampliar muestra")[0];opener.focus();await opener.click();
 assert.equal(ids.sampleViewer.open,true);assert.equal(ids.sampleViewerImage.src,Samples.list()[0].image.src);assert(ids.sampleViewerTitle.textContent.startsWith("Diseño 01 — "));assert.equal(doc.activeElement,ids.sampleViewer.closeButton);
 // Closed details can report layout rectangles: their fields must not enter the Tab loop.
 const close=ids.sampleViewer.closeButton,summary=new Node("summary",doc),hiddenCopy=new Node("button",doc);
 const closedDetails={querySelector:()=>summary};
 for(const n of [close,summary,hiddenCopy])n.getClientRects=()=>[{}];
 close.closest=()=>null;summary.closest=hiddenCopy.closest=()=>closedDetails;
 ids.sampleViewer.querySelectorAll=()=>[close,summary,hiddenCopy];
 let prevented=false;close.focus();
 await ids.sampleViewer.dispatch("keydown",{key:"Tab",shiftKey:true,preventDefault:()=>{prevented=true;}});
 assert(prevented);assert.equal(doc.activeElement,summary);
 await ids.sampleViewer.dispatch("keydown",{key:"Tab",shiftKey:false});
 assert.equal(doc.activeElement,close);
 await ids.sampleViewerZoom.click();assert.equal(ids.sampleViewerZoom.attrs["aria-pressed"],"true");assert(ids.sampleViewerScroll.classList.contains("is-zoomed"));
 ids.sampleViewerImage.onerror();assert(ids.sampleViewerStatus.textContent.includes("No se pudo"));await ids.sampleViewer.closeButton.click();
 assert.equal(ids.sampleViewer.open,false);assert.equal(ids.sampleViewerImage.src,undefined);assert.equal(doc.activeElement,opener);assert.equal(ids.sampleViewerActions.children.length,0);assert(!doc.body.classList.contains("catalog-viewer-open"));
 await filter("all").click();assert.equal(nodes(ids.sampleGroups,n=>!!n.dataset.sampleId).length,22);
 const failed=nodes(ids.sampleGroups,n=>n.tagName==="img")[0];await failed.dispatch("error");assert(nodes(ids.sampleGroups,n=>n.className==="catalog-image-error").some(n=>n.hidden===false));
 const cta=nodes(ids.sampleGroups,n=>n.tagName==="a"&&n.textContent==="Solicitar esta invitación")[0];await cta.click();assert(ids.catalogSelection.textContent.includes("01"));assert.equal(new URL(cta.href).pathname,"/5491157339281");
 const firstCard=nodes(ids.sampleGroups,n=>!!n.dataset.sampleId)[0];await nodes(firstCard,n=>n.tagName==="button"&&n.textContent==="Copiar número")[0].click();assert(nodes(firstCard,n=>n.tagName==="input")[0].selected);
 console.log("Category filters, deferred full images, modal identity/close/focus, errors, copy fallback and three original demos PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
