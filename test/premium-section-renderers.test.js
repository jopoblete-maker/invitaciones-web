const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Renderers = require('../js/core/premium-section-renderers');
const { createPolicy } = require('../js/core/external-link-policy');
const { normalizeEvent } = require('../js/core/event-normalizer');
const Dispatcher = require('../js/core/section-renderer');
const Templates = require('../js/core/template-registry');
// Use the existing escape implementations, not a second HTML escaping implementation.
const source = fs.readFileSync(path.join(__dirname, '../js/invitacion.js'), 'utf8');
const escapeSource = source.slice(source.indexOf('function escapeHtml'));
const escapes = vm.runInNewContext(escapeSource + '\n({escapeHtml, escapeAttr})');
const section = (type, data, config = {}) => ({id:type,type,enabled:true,order:10,data,config});
const url = 'https://photos.example.test/second.jpg';
const albumUrl = 'https://album.example.test/folder?a=1&b=2';
const mediaItems = { first:{type:'image',src:'/assets/demo/first.webp'}, second:{type:'image',src:url}, audio:{type:'audio',src:'/assets/demo/audio.mp3'} };
const context = {...escapes, mediaItems, authorizedMediaIds:['first','second','audio'],
    approvedLocalSources:['/assets/demo/first.webp'], imagePolicy:createPolicy({allowedUrls:[url]}),
    albumPolicy:createPolicy({allowedUrls:[albumUrl]})};
const attack = '<script>alert("x")</script> & `';
const canonical = {schema_version:2,sections:[section('gallery',{title:attack,items:[
    {media_id:'second',alt:'Second " photo',caption:attack}, {media_id:'first',alt:'First photo'},
    {media_id:'missing',alt:'Missing'},{media_id:'audio',alt:'Audio'}]})],media:{items:mediaItems}};
const runtime = normalizeEvent(canonical).sections[0];
const html = Renderers.renderGallery(runtime,context);
assert(html.includes('<figure>'));assert(html.includes('<figcaption>'));
assert(html.includes('loading="lazy" decoding="async"'));
assert(html.indexOf(url)<html.indexOf('/assets/demo/first.webp'));
assert(html.includes('alt="Second &quot; photo"'));assert(html.includes('&lt;script&gt;'));
assert(!html.includes('<script>'));assert(!html.includes('audio.mp3'));
assert.equal(Renderers.renderGallery(runtime,{...context,authorizedMediaIds:[]}), '');
assert.equal(Renderers.renderGallery(runtime,{...context,approvedLocalSources:[],imagePolicy:createPolicy()}), '');
assert.equal(Renderers.renderGallery(section('gallery',{items:[{media_id:'first',alt:'a',src:url}]}),context),'');
assert.equal(Renderers.renderGallery(section('gallery',{items:[]}),context),'');
assert.equal(Renderers.renderGallery(section('gallery',{items:[null,42]}),context),'');
assert.equal(Renderers.renderGallery({...runtime,enabled:false},context),'');
assert.equal(Renderers.renderGallery({...runtime,enabled:'true'},context),'');
const dress = section('dress-code',{title:attack,description:attack,reserved_colors:[{color:'Blanco',reserved_for:'La novia'}, {color:attack,reserved_for:attack},null]});
const dressHtml = Renderers.renderDressCode(dress,context);
assert(dressHtml.includes('<ul>'));assert(dressHtml.includes('Blanco — reservado para La novia'));
assert(!dressHtml.includes('style='));assert(!dressHtml.includes('<script>'));
assert.equal(Renderers.renderDressCode(section('dress-code',{}),context),'');
const giftsData = {message:attack,alias:'alias.demo',cbu:'0'.repeat(22)};
const giftContext = {...context,authorizedGiftData:{...giftsData}};
for(const allow_copy of [true,false,undefined]) {
    const gifts = section('gifts',giftsData,allow_copy===undefined?{}:{allow_copy});
    const giftsHtml = Renderers.renderGifts(gifts,giftContext);
    assert(giftsHtml.includes('<dl>'));assert(giftsHtml.includes('<dt>Alias</dt>'));
    assert.equal(giftsHtml.includes('<button'),allow_copy===true);
    assert.equal(giftsHtml.includes('aria-live="polite"'),allow_copy===true);
    assert(!giftsHtml.includes('data-alias'));assert(!giftsHtml.includes('data-cbu'));
    const tags=giftsHtml.match(/<[^>]+>/g).join('');
    assert(!tags.includes(giftsData.alias));assert(!tags.includes(giftsData.cbu));
    assert(!giftsHtml.includes('<script>'));
}
assert.equal(Renderers.renderGifts(section('gifts',giftsData),context),'');
assert.equal(Renderers.renderGifts(section('gifts',{alias:'invalid alias',cbu:'bad'}),{...context,authorizedGiftData:{alias:'invalid alias',cbu:'bad'}}),'');
assert.equal(Renderers.renderGifts(section('gifts',giftsData),{...context,authorizedGiftData:{alias:'different'}}),'');
const titledGifts = section('gifts', { ...giftsData, title: 'Título autorizado' });
assert(!Renderers.renderGifts(titledGifts, giftContext).includes('<h2>'));
assert(Renderers.renderGifts(titledGifts, { ...giftContext, authorizedGiftData: { ...giftsData, title: 'Título autorizado' } })
    .includes('<h2>Título autorizado</h2>'));
assert(!Renderers.renderGifts(titledGifts, { ...giftContext, authorizedGiftData: { ...giftsData, title: 'Título diferente' } })
    .includes('<h2>'));
assert.equal(Renderers.renderGifts(titledGifts, context), '');
assert.equal(Renderers.renderGifts(titledGifts, { ...context, authorizedGiftData: {} }), '');
const messageOnly = Renderers.renderGifts(titledGifts, { ...context, authorizedGiftData: { message: giftsData.message } });
assert(messageOnly.includes(`<p>${escapes.escapeHtml(giftsData.message)}</p>`));
assert(!messageOnly.includes('<h2>')); assert(!messageOnly.includes('<dl>'));
const aliasOnly = Renderers.renderGifts(titledGifts, { ...context, authorizedGiftData: { alias: giftsData.alias } });
assert(aliasOnly.includes('<dt>Alias</dt>')); assert(!aliasOnly.includes('<dt>CBU</dt>'));
assert(!aliasOnly.includes('<p>')); assert(!aliasOnly.includes('<h2>'));
const cbuOnly = Renderers.renderGifts(titledGifts, { ...context, authorizedGiftData: { cbu: giftsData.cbu } });
assert(cbuOnly.includes('<dt>CBU</dt>')); assert(!cbuOnly.includes('<dt>Alias</dt>'));
assert(!cbuOnly.includes('<p>')); assert(!cbuOnly.includes('<h2>'));
const maliciousTitle = Renderers.renderGifts(section('gifts', { ...giftsData, title: attack }),
    { ...giftContext, authorizedGiftData: { ...giftsData, title: attack } });
assert(maliciousTitle.includes(`<h2>${escapes.escapeHtml(attack)}</h2>`));
assert(!maliciousTitle.includes('<script>'));
const inheritedTitle = Object.assign(Object.create({ title: titledGifts.data.title }), { message: giftsData.message });
assert(!Renderers.renderGifts(titledGifts, { ...context, authorizedGiftData: inheritedTitle }).includes('<h2>'));
const album = section('collaborative-album',{title:attack,description:attack,button_label:attack,url:albumUrl});
const albumHtml = Renderers.renderCollaborativeAlbum(album,context);
assert(albumHtml.includes('target="_blank" rel="noopener noreferrer"'));
assert(albumHtml.includes('a=1&amp;b=2'));assert(!albumHtml.includes('<script>'));
assert.equal(Renderers.renderCollaborativeAlbum(album,{...context,albumPolicy:undefined}),'');
assert.equal(Renderers.renderCollaborativeAlbum(section('collaborative-album',{url:'javascript:alert(1)'}),{...context,albumPolicy:{isAllowed:()=>true}}),'');
for(const bad of ['javascript:alert(1)','data:text/html,bad','blob:https://example.test/x','http://album.example.test','/local','https://evil.example.test','https://user:pass@album.example.test']) {
    assert.equal(Renderers.renderCollaborativeAlbum(section('collaborative-album',{url:bad}),context),'');
    const item={media_id:'first',alt:'a',src:bad};
    assert.equal(Renderers.renderGallery(section('gallery',{items:[item]}),{...context,mediaItems:{first:{type:'image',src:bad}}}),'');
}
const before=JSON.stringify({runtime,dress,album,giftsData,mediaItems});
const effects=[];
const sandbox={module:{exports:{}}, console:{log(){effects.push('log');},warn(){effects.push('warn');},error(){effects.push('error');}},
    fetch(){effects.push('fetch');}, navigator:{clipboard:{writeText(){effects.push('clipboard');}}},
    document:{addEventListener(){effects.push('listener');}},localStorage:{setItem(){effects.push('storage');}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/core/premium-section-renderers.js'),'utf8'),sandbox);
for(const [fn,value,ctx] of [['renderGallery',runtime,context],['renderDressCode',dress,context],['renderGifts',section('gifts',giftsData,{allow_copy:true}),giftContext],['renderCollaborativeAlbum',album,context]]) {
    const render=sandbox.module.exports[fn];
    assert.equal(render(value,ctx),render(value,ctx));
    assert.equal(render(value,{}),'');
}
assert.deepEqual(effects,[]);assert.equal(JSON.stringify({runtime,dress,album,giftsData,mediaItems}),before);
for(const type of ['gallery','dress-code','gifts','collaborative-album']) {
    assert(Object.hasOwn(Dispatcher.SECTION_RENDERER_REGISTRY,type));
    assert.equal(Dispatcher.renderSection(section(type,{}), {renderers:{gallery:()=> 'blocked',dressCode:()=> 'blocked',gifts:()=> 'blocked',collaborativeAlbum:()=> 'blocked'}}),'');
    for(const template of Templates.listTemplates().filter(value=>value.status==='active')) assert(!template.supportedSections.includes(type));
}
console.log('pure premium renderer tests passed');
