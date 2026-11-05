export const dynamic='force-dynamic';
// The old D1-to-Drive migration is complete. No database export on the new host.
export async function POST(){return Response.json({detail:'Migration export is closed'},{status:410,headers:{'cache-control':'no-store'}});}
