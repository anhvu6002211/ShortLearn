export type Session={user:{id:number;email:string;display_name?:string};tokens:{access_token:string;refresh_token:string}};
export type BackgroundRequest=
 |{type:'AUTH_STATUS'}|{type:'AUTH_LOGIN';email:string;password:string;apiUrl:string}|{type:'AUTH_LOGOUT'}
 |{type:'CAPTURE_START';tabId:number}|{type:'CAPTURE_STOP'}|{type:'DUE_CARDS'}|{type:'REVIEW_WORD';word:string;rating:1|2|3|4}
 |{type:'SAVE_WORD';word:string;meaning:string;context:string;platform:'youtube'|'tiktok'|'instagram';videoId:string|null;timestamp:number|null};
export type BackgroundResponse={ok:true;data?:unknown}|{ok:false;error:string};