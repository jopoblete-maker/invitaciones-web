const assert = require('node:assert/strict');
const {createAdminEditorialClient} = require('../js/core/admin-editorial-client');
const secret = 'synthetic-create-credential';
const content = {schema_version:2,id:'synthetic-new'};
const response = (status, payload) => ({status,ok:status>=200&&status<300,json:async()=>payload,headers:{get:()=> '7'}});
(async()=> {
    let request;
    const client = createAdminEditorialClient({fetchImpl:async(url,options)=> {
        request={url,options}; return response(201,{eventId:content.id,versionId:'uuid',versionNumber:1,workflowStatus:'draft'});
    }});
    await client.createEvent({eventId:content.id,content,password:secret});
    assert.equal(request.url,'/api/admin/eventos'); assert.equal(request.options.method,'POST');
    assert.equal(request.options.headers['X-Admin-Password'],secret);
    assert.equal(request.options.headers['Content-Type'],'application/json');
    assert.equal(request.options.headers.Origin,undefined);
    assert.deepEqual(JSON.parse(request.options.body),{eventId:content.id,content});
    assert(!request.options.body.includes(secret));
    for (const status of [401,403,409,422,429,503,500]) {
        const failed=createAdminEditorialClient({fetchImpl:async()=>response(status,{error:{code:status===409?'EVENT_ALREADY_EXISTS':'TEST',message:secret}})});
        await assert.rejects(failed.createEvent({eventId:content.id,content,password:secret}),e=>e.status===status&&!e.message.includes(secret));
    }
    for (const payload of [null,{}, {eventId:'wrong',versionId:'uuid',versionNumber:1,workflowStatus:'draft'}]) {
        const invalid=createAdminEditorialClient({fetchImpl:async()=>response(201,payload)});
        await assert.rejects(invalid.createEvent({eventId:content.id,content,password:secret}),e=>e.code==='INVALID_RESPONSE');
    }
    const network=createAdminEditorialClient({fetchImpl:async()=>{throw new Error(secret);}});
    await assert.rejects(network.createEvent({eventId:content.id,content,password:secret}),e=>e.code==='NETWORK_ERROR'&&!e.message.includes(secret));
    const timeout=createAdminEditorialClient({fetchImpl:()=>new Promise(()=>{})});
    await assert.rejects(timeout.createEvent({eventId:content.id,content,password:secret,timeoutMs:5}),e=>e.code==='TIMEOUT');
    console.log('event creation client tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
