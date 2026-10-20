"use strict";
const assert = require("node:assert/strict"), path = require("node:path");
const express = require("express");
const { createStaticPolicy } = require("../backend/http/static-policy");
(async () => {
    const app = express(), policy = createStaticPolicy({root:path.resolve(__dirname,".."),express});
    app.use(policy.guard); app.use(policy.serveRoot); app.use((_req,res)=>res.status(404).end());
    const server = await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
    const base = "http://127.0.0.1:" + server.address().port;
    try {
        for (const resource of ["/","/catalogo.html","/invitacion-legacy.html","/js/core/commercial-contact.js","/js/comercial.js","/css/comercial.css","/admin.html","/js/core/catalog-samples.js",...require("../js/core/catalog-samples").list().flatMap(sample=>[sample.thumbnail.src,sample.image.src])]) {
            assert.equal((await fetch(base+resource)).status,200,resource);
        }
        for (const resource of ["/.env","/.dev/premium/anything.json","/backend/http/admin-access.js","/package.json","/assets/catalogo/muestras/unknown.webp","/assets/catalogo/muestras/../../../../.env"]) {
            assert.equal((await fetch(base+resource)).status,404,resource);
        }
    } finally { await new Promise(resolve=>server.close(resolve)); }
    console.log("commercial static paths and private path denials PASS");
})().catch(error=>{console.error(error);process.exitCode=1;});
