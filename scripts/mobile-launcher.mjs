// A top-level Pages document gives iOS access to icons that Google's outer
// HTML Service frame cannot expose. Installed launches keep using native RPC.
export function mobileLauncher({base,deployment}){
 const direct=new URL(deployment);direct.searchParams.set('mobile','1');
 const path=base+'mobile/';
 const escape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const redirect=`if(window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches){window.location.replace(${JSON.stringify(direct.href).replace(/</g,'\\u003c')});}`;
 return {
 manifest:{id:path,name:'טיקו — אוכל לשבת',short_name:'טיקו',lang:'he',dir:'rtl',start_url:path,scope:path,display:'standalone',background_color:'#faf9f5',theme_color:'#0b4776',icons:[192,512].map(size=>({src:base+`icons/icon-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))},
 html:`<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#0b4776"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="טיקו"><link rel="apple-touch-icon" sizes="180x180" href="${escape(base)}icons/icon-180.png"><link rel="icon" href="${escape(base)}icons/icon-192.png"><link rel="manifest" href="manifest.webmanifest"><title>טיקו — אוכל לשבת</title>
<style>*{box-sizing:border-box}body{margin:0;background:#faf9f5;color:#204b72;font-family:Arial,sans-serif}main{min-height:100dvh;max-width:440px;margin:auto;padding:40px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:20px}img{width:144px;height:144px;border-radius:28px}h1{margin:0;font-size:30px}p{margin:0;line-height:1.8;color:#234237}a{display:block;background:#204b72;color:white;text-decoration:none;border-radius:14px;padding:16px 28px;font-size:20px;min-height:52px}small{line-height:1.8;color:#526a49}</style>
<script>${redirect}</script></head><body><main><img src="${escape(base)}icons/icon-180.png" alt="טיקו"><h1>טיקו — אוכל לשבת</h1><a href="${escape(direct.href)}">פתיחת טיקו</a></main></body></html>`
 };
}
