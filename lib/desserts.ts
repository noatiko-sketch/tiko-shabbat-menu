import {inferDiet} from './family.ts';
export const dessertNames=['עוגה','גלידה','טפיוקה','סלט פירות','פירות','פבלובה','עוגת יומולדת'];
export async function seedDesserts(db:D1Database){
 if(await db.prepare("SELECT id FROM food_categories WHERE id='__dessert_ready_v1'").first())return;
 const now=new Date().toISOString(),commands=[db.prepare("INSERT OR IGNORE INTO food_categories (id,label) VALUES ('dessert','מנה אחרונה')")];
 for(const name of dessertNames){commands.push(db.prepare("INSERT INTO catalog (name,category,diet,updated_by,updated_at) VALUES (?,'dessert',?,'אוטומטית',?) ON CONFLICT(name) DO UPDATE SET category='dessert'").bind(name,inferDiet(name),now),db.prepare('DELETE FROM excluded_dishes WHERE name=?').bind(name));}
 commands.push(db.prepare("INSERT OR IGNORE INTO food_categories (id,label) VALUES ('__dessert_ready_v1','')"));await db.batch(commands);
}
