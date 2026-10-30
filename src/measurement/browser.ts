import type {Recorder,Signal} from './aggregate.ts';

let active:Recorder|undefined;
export function recordMeasurement(signal:Signal):void {
  if(!active)return;
  try{active(signal,{origin:location.origin,pathname:location.pathname,consent:'granted',dnt:navigator.doNotTrack,gpc:(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl});}catch{/* Measurement must never break reading, search or a confirmed save. */}
}

// Only a separately approved, compiled integration may install a recorder.
// Settings, URL parameters, local storage and window globals cannot activate it.
// Consent is rechecked by the wrapper before every event, including revocation.
// This function is used only by controlled tests in this checkpoint.
export function installMeasurement(recorder:Recorder,consent:()=>boolean):()=>void {
  const wrapped:Recorder=(signal,context)=>consent()?recorder(signal,context):false;
  active=wrapped;
  recordMeasurement({event:'page_view'});
  const error=()=>recordMeasurement({event:'reader_error',component:location.pathname==='/search/'?'search':location.pathname==='/contribute/'?'contribution':'reader'});
  window.addEventListener('error',error);window.addEventListener('unhandledrejection',error);
  return ()=>{if(active===wrapped)active=undefined;window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',error);};
}
