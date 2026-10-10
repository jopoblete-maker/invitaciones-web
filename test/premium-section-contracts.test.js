const assert = require('node:assert/strict');
const { createPolicy } = require('../js/core/external-link-policy');
const { validateSection } = require('../js/core/premium-section-validator');
const Contracts = require('../js/core/section-contracts');
const Templates = require('../js/core/template-registry');
const Renderer = require('../js/core/section-renderer');
const Validator = require('../js/core/event-validator');
const approved = 'https://album.example.test/folder/demo';
const policy = createPolicy({allowedUrls:[approved]});
const section = (type,data,config) => ({id:'synthetic',type,enabled:true,order:10,data,...(config===undefined?{}:{config})});
const options = {albumPolicy:policy,authorizedMediaIds:['photo'],mediaItems:{photo:{type:'image',src:'/assets/demo/photo.webp'}}};
const samples = {
    gallery: section('gallery',{items:[{media_id:'photo',alt:'Una fotografía autorizada'}]}),
    'dress-code':section('dress-code',{description:'Formal',reserved_colors:[{color:'Blanco',reserved_for:'La novia'}]}),
    gifts:section('gifts',{message:'Tu presencia es nuestro regalo',alias:'alias.demo'},{allow_copy:true}),
    'collaborative-album':section('collaborative-album',{url:approved})
};
for(const [type,value] of Object.entries(samples)) {
    assert(Contracts.has(type));assert(validateSection(value,options).valid);
    assert(validateSection({...value,enabled:false},options).valid);
    assert(!validateSection({...value,data:{...value.data,unknown:'private-marker'}},options).valid);
    assert(!validateSection({...value,config:{unknown:true}},options).valid);
    assert(!validateSection({...value,data:null},options).valid);
    assert(!validateSection({...value,order:'10'},options).valid);
    assert(!validateSection({...value,enabled:false,data:{}},options).valid);
    assert(!validateSection({...value,data:{...value.data,title:123}},options).valid);
    assert(!validateSection({...value,data:{...value.data,title:'x'.repeat(121)}},options).valid);
    assert(!validateSection({...value,data:{...value.data,title:'<script>bad</script>'}},options).valid);
    assert(!validateSection({...value,data:{...value.data,title:'x\n'}},options).valid);
    assert(validateSection({...value,data:{...value.data,title:'😀'.repeat(120)}},options).valid);
    assert.equal(Renderer.renderSection(value,{warn(){}}),'');
    for(const template of Templates.listTemplates()) assert(!template.supportedSections.includes(type));
}
for(const url of ['javascript:alert(1)','data:text/html,bad','blob:https://example.test/a','http://album.example.test/a',
    '/folder/demo','https://u:p@album.example.test/folder/demo','https://localhost/a','https://127.0.0.1/a',
    'https://[::1]/a','https://2130706433/a','https://server.local/a','https://internal/a',
    'https://album.example.test:444/folder/demo','https://evil.example.test/a',approved+'?redirect=https://evil.test',
    'https://album.example.test/redirect',approved+'\n',approved+'%0A','https:\\album.example.test/folder/demo']) {
    assert(!policy.isAllowed(url));
    assert(!validateSection(section('collaborative-album',{url}),options).valid);
}
assert(policy.isAllowed(approved));assert(!createPolicy().isAllowed(approved));
assert(!validateSection(samples['collaborative-album']).valid);
assert.throws(()=>createPolicy({allowedUrls:['http://bad.test/private-marker']}),e=>!e.message.includes('private-marker'));
for(const items of [[],Array(21).fill({media_id:'photo',alt:'a'}),[{media_id:'absent',alt:'a'}],
    [{media_id:'photo',alt:'a'},{media_id:'photo',alt:'b'}], [{media_id:'photo',alt:''}],
    [{media_id:'photo',alt:'a'.repeat(241)}],[{media_id:'photo',alt:'a',caption:'x'.repeat(301)}]]) {
    assert(!validateSection(section('gallery',{items}),options).valid);
}
assert(!validateSection(samples.gallery,{...options,authorizedMediaIds:[]}).valid);
for(const src of ['data:image/png;base64,secret','javascript:bad','/assets/demo/a.svg','/assets/../a.jpg']) {
    assert(!validateSection(samples.gallery,{...options,mediaItems:{photo:{type:'image',src}}}).valid);
}
assert(!validateSection(samples.gallery,{...options,mediaItems:{photo:{type:'audio',src:'/assets/a.jpg'}}}).valid);
const manyPhotos = Object.fromEntries(Array.from({length:20},(_,index)=>[`photo-${index}`,{type:'image',src:`/assets/demo/${index}.jpg`}]));
assert(validateSection(section('gallery',{items:Object.keys(manyPhotos).map(media_id=>({media_id,alt:'a',caption:'x'.repeat(300)}))}),
    {...options,mediaItems:manyPhotos,authorizedMediaIds:Object.keys(manyPhotos)}).valid);
const remoteImage='https://media.example.test/photo.jpg';
const remoteOptions={...options,mediaItems:{photo:{type:'image',src:remoteImage}}};
assert(!validateSection(samples.gallery,remoteOptions).valid);
assert(validateSection(samples.gallery,{...remoteOptions,imagePolicy:createPolicy({allowedUrls:[remoteImage]})}).valid);
assert(validateSection(section('dress-code',{description:'x'.repeat(1000),reserved_colors:Array(8).fill({color:'x'.repeat(40),reserved_for:'x'.repeat(120)})}),options).valid);
assert(validateSection(section('collaborative-album',{url:approved,description:'x'.repeat(600),button_label:'x'.repeat(60)}),options).valid);
assert(!validateSection(section('collaborative-album',{url:approved,description:'x'.repeat(601)}),options).valid);
assert(!validateSection(section('collaborative-album',{url:approved,button_label:'x'.repeat(61)}),options).valid);
for(const data of [{description:''},{description:'x'.repeat(1001)}, {description:'a',reserved_colors:Array(9).fill({color:'a',reserved_for:'b'})},
    {description:'a',reserved_colors:[{color:'x'.repeat(41),reserved_for:'b'}]}, {description:'a',reserved_colors:[{color:'a',reserved_for:'x'.repeat(121)}]}]) {
    assert(!validateSection(section('dress-code',data),options).valid);
}
const privateValue='financial-private-marker';
const logs=[];const saved=console.error;console.error=(...args)=>logs.push(args);
try {
    for(const data of [{},{alias:privateValue},{alias:123},{cbu:privateValue},{cbu:123},{cbu:'0'.repeat(21)}, {message:'x'.repeat(1001)}]) {
        const result=validateSection(section('gifts',data),options);
        assert(!result.valid);assert(!JSON.stringify(result).includes(privateValue));
    }
    assert(validateSection(section('gifts',{cbu:'0'.repeat(22)}),options).valid);
    assert(!validateSection(section('gifts',{message:'a'},{allow_copy:'true'}),options).valid);
    assert.equal(logs.length,0);
}finally{console.error=saved;}
const fixture=require('./fixtures/event-v2-complete.json');
const fixtureBefore=JSON.stringify(fixture);
assert(Validator.validateEventForPersistence(fixture).valid);
for(const value of Object.values(samples)) {
    const result=Validator.validateV2Event({...fixture,sections:[...fixture.sections,value]},options);
    assert(!result.valid);assert(result.errors.some(error=>error.includes('no soportado por template')));
    assert(!JSON.stringify(result).includes(privateValue));
}
assert(Validator.validateEventForPersistence({}).valid);
assert.equal(JSON.stringify(fixture),fixtureBefore);
assert(Validator.validateEventForPersistence({schema_version:1,event:{},template:{slug:'boda-vertical'},sections:[{id:'hero',type:'hero',enabled:true,order:1,data:{}}]}).valid);
console.log('premium contracts and external link policy tests passed');
