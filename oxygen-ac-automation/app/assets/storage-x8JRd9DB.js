import{be as t}from"./index-IYWO72fS.js";const s={async upload(a,r){const o=new FormData;return o.append("file",a,r||a.name||"file"),{url:(await t("/upload",o)).url}}};export{s};
