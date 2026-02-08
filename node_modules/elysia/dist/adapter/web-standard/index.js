"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: !0 });
}, __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);
var web_standard_exports = {};
__export(web_standard_exports, {
  WebStandardAdapter: () => WebStandardAdapter
});
module.exports = __toCommonJS(web_standard_exports);
var import_handler = require('./handler.js');
const WebStandardAdapter = {
  name: "web-standard",
  isWebStandard: !0,
  handler: {
    mapResponse: import_handler.mapResponse,
    mapEarlyResponse: import_handler.mapEarlyResponse,
    mapCompactResponse: import_handler.mapCompactResponse,
    createStaticHandler: import_handler.createStaticHandler
  },
  composeHandler: {
    mapResponseContext: "c.request",
    preferWebstandardHeaders: !0,
    // @ts-ignore Bun specific
    headers: `c.headers={}
for(const [k,v] of c.request.headers.entries())c.headers[k]=v
`,
    parser: {
      json(isOptional) {
        return isOptional ? `try{c.body=await c.request.json()}catch{}
` : `c.body=await c.request.json()
`;
      },
      text() {
        return `c.body=await c.request.text()
`;
      },
      urlencoded() {
        return `c.body=parseQuery(await c.request.text())
`;
      },
      arrayBuffer() {
        return `c.body=await c.request.arrayBuffer()
`;
      },
      formData(isOptional) {
        let fnLiteral = `
c.body={}
`;
        return isOptional ? fnLiteral += "let form;try{form=await c.request.formData()}catch{}" : fnLiteral += `const form=await c.request.formData()
`, fnLiteral + `for(const key of form.keys()){if(c.body[key]) continue
const value=form.getAll(key)
if(value.length===1)c.body[key]=value[0]
else c.body[key]=value}`;
      }
    }
  },
  async stop(app, closeActiveConnections) {
    if (!app.server)
      throw new Error(
        "Elysia isn't running. Call `app.listen` to start the server."
      );
    if (app.server && (await app.server.stop(closeActiveConnections), app.server = null, app.event.stop?.length))
      for (let i = 0; i < app.event.stop.length; i++)
        app.event.stop[i].fn(app);
  },
  composeGeneralHandler: {
    parameters: "r",
    createContext(app) {
      let decoratorsLiteral = "", fnLiteral = "";
      const defaultHeaders = app.setHeaders;
      for (const key of Object.keys(app.decorator))
        decoratorsLiteral += `,'${key}':decorator['${key}']`;
      const standardHostname = app.config.handler?.standardHostname ?? !0, hasTrace = !!app.event.trace?.length;
      return fnLiteral += `const u=r.url,s=u.indexOf('/',${standardHostname ? 11 : 7}),qi=u.indexOf('?',s+1),p=u.substring(s,qi===-1?undefined:qi)
`, hasTrace && (fnLiteral += `const id=randomId()
`), fnLiteral += "const c={request:r,store,qi,path:p,url:u,redirect,status,set:{headers:", fnLiteral += Object.keys(defaultHeaders ?? {}).length ? "Object.assign({},app.setHeaders)" : "Object.create(null)", fnLiteral += ",status:200}", app.inference.server && (fnLiteral += ",get server(){return app.getServer()}"), hasTrace && (fnLiteral += ",[ELYSIA_REQUEST_ID]:id"), fnLiteral += decoratorsLiteral, fnLiteral += `}
`, fnLiteral;
    },
    error404(hasEventHook, hasErrorHook, afterHandle = "") {
      let findDynamicRoute = "if(route===null){" + afterHandle + (hasErrorHook ? "" : "c.set.status=404") + `
return `;
      return hasErrorHook ? findDynamicRoute += `app.handleError(c,notFound,false,${this.parameters})` : findDynamicRoute += hasEventHook ? "c.response=c.responseValue=new Response(error404Message,{status:c.set.status===200?404:c.set.status,headers:c.set.headers})" : "c.response=c.responseValue=error404.clone()", findDynamicRoute += "}", {
        declare: hasErrorHook ? "" : `const error404Message=notFound.message.toString()
const error404=new Response(error404Message,{status:404})
`,
        code: findDynamicRoute
      };
    }
  },
  composeError: {
    mapResponseContext: "",
    validationError: "set.headers['content-type']='application/json';return mapResponse(error.message,set)",
    unknownError: "set.status=error.status??set.status??500;return mapResponse(error.message,set)"
  },
  listen() {
    return () => {
      throw new Error(
        "WebStandard does not support listen, you might want to export default Elysia.fetch instead"
      );
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WebStandardAdapter
});
