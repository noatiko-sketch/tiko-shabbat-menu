export type RowBounds={top:number;bottom:number};
export function reorderPreview(rows:RowBounds[],from:number,requestedDelta:number){
 const source=rows[from];
 if(!source||!Number.isFinite(requestedDelta))throw new Error('Invalid drag position');
 const height=source.bottom-source.top;
 const delta=Math.max(rows[0].top-source.top,Math.min(rows[rows.length-1].bottom-source.bottom,requestedDelta));
 const center=(source.top+source.bottom)/2+requestedDelta;
 let to=from;
 if(delta>0){for(let i=from+1;i<rows.length;i++)if(center>(rows[i].top+rows[i].bottom)/2)to=i;}
 else{for(let i=from-1;i>=0;i--)if(center<(rows[i].top+rows[i].bottom)/2)to=i;}
 const gap=to>from?rows[from+1].top-source.bottom:to<from?source.top-rows[from-1].bottom:0;
 const offsets=rows.map((_,index)=>index===from?delta:from<index&&index<=to?-(height+gap):to<=index&&index<from?height+gap:0);
 const settledDelta=to>from?rows[to].bottom-source.bottom:rows[to].top-source.top;
 return {from,to,delta,offsets,settledDelta};
}
