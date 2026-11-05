export const dynamic='force-dynamic';
// Photo scanning was removed; never enable a paid service during the hosting move.
export async function POST(){return Response.json({detail:'פענוח תמונות אינו פעיל.'},{status:410,headers:{'cache-control':'no-store'}});}
