// The active Pages app uses the authenticated Google bridge and Gemini only.
// Do not reactivate the old paid OpenAI route from the retired Sites build.
export async function POST(){return Response.json({detail:'צילום רשימה זמין באתר טיקו החדש. יש לפתוח https://noatiko-sketch.github.io/tiko-shabbat-menu/'},{status:410,headers:{'cache-control':'no-store'}});}
