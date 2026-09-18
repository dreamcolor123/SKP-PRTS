# Offline Android host protocol, version 1

Native posts `{type:"skp:init",version:1,sessionId}` as JSON to the fixed local
document origin, transferring one WebMessagePort. Web checks event.origin equals
location.origin and replies on that port `{type:"ready",version:1,sessionId}`.
All later messages use that port and JSON strings.

```ts
state = {type:"state",version:1,revision:number,state:UiSnapshot}
presentation = {type:"presentation",version:1,active:boolean,audioActive?:boolean,reducedMotion:boolean,bootAllowed:boolean,initialBootTime?:number,initialBootCompleted?:boolean}
request = {version:1,sessionId:string,requestId:string,action:string,payload:object}
ack = {type:"ack",requestId:string,status:"accepted"|"rejected",reason?:string}
notice = {type:"notice",text:string}
back = {type:"back"}
motion = {type:"motion",version:1,x:number,y:number}
```

UiSnapshot = `{records: ArchiveRecord[], configured?:boolean,statusText?:string,busy?:boolean}`.
See `src/data.ts` for record type. Native maps StateFlows to records; no Root key,
script, command, arbitrary URL or file path is sent to Web. Required categories,
in lane order: 系统概览, 授权, 已安装模块, 模块市场, 设置与诊断.
The home record should have ID `home.summary`. ID is stable identity; code is
an optional presentation number. Missing lanes show truthful empty placeholders.
Actions contain exact native whitelist action and ID-only payloads.

Web emits `{type:"presentation",version:1,sessionId,bootTime,bootStarted,bootCompleted,navigation}`.
Time is app timeline seconds (1.76..35), not source-video time (+5).
Native sets mediaPlaybackRequiresUserGesture=false. Boot waits for bootAllowed.
initialBootCompleted skips boot on view rebuild; initialBootTime resumes it.
Native remains authoritative for request deduplication, IDs and busy guards.

`active` gates rendering and sensors. `audioActive` independently follows the
foreground lifecycle, so native panels may freeze the scene without interrupting
music. Older hosts that omit it retain `active` as the audio gate. WebView pauses
only when neither rendering nor audio is active; hidden documents still mute.

`motion` is calibrated, low-pass orientation input in [-1,1], at most 30 Hz.
Native unregisters the sensor when not active/resumed, or when reduced motion or
the Web presentation's `sensorEnabled:false` is active. Web also gates the visual
response locally, so it never waits for the native control round trip to stop.
No raw device sensor samples or new privileged actions are exposed.

Records may include `fields[].healthy` for device status markers. SELinux follows
the original manager: only value 0 means permissive; all other values display
strict mode. These are display fields and do not rewrite the underlying data.

Android build: `npm ci --ignore-scripts`, `npm run build:android`.
Output is dist/ served at origin root. dist/asset-manifest.json has
`{version:1,files:[{path:"index.html",sha256:"...",mime:"text/html"},...]}`.
Paths have NO leading slash; native APK prefix is assets/rhine/.
No PWA/service worker or remote asset fetch is initialized in Android mode.
