export const family = ['אמא','אבא','נעה','אביגיל','יפעת'] as const;
export const defaultCategories:Record<string,string> = {salad:'סלט',baked:'ירקות אפויים',soup:'מרק',pasta:'פסטה / רביולי / ניוקי / לזניה',pastry:'פשטידה / מאפה / קיש',main:'מנה עיקרית',side:'תוספת',dip:'מטבלים ורטבים',extra:'מנות נוספות',dessert:'מנה אחרונה'};
export function inferCategory(name:string) {
 if(/עוג|גליד|טפיוק|פבלוב|סלט פירות|^פירות$|מוס |קרם ברולה|מלבי|קינוח|בראונ|עוגי|שוקולד/.test(name))return 'dessert';
 if (/סלט|קולסלואו/.test(name)) return 'salad';
 if (/מרק|גספאצ/.test(name)) return 'soup';
 if (/פסטה|רביולי|ניוקי|לזני|לזניה|ספגטי|מקרוני|פטוציני|נודלס/.test(name)) return 'pasta';
 if (/פשטיד|מאפה|קיש(?: |$)|בורקס|גחנון|צ.וקור|טוסט|פוקצ|לחם|חלה|פיצה|סמבוסק|לחמני/.test(name)) return 'pastry';
 if (/טחינה|חומוס|ציזיקי|רוטב|ממרח/.test(name) && !/דג|סלמון|בשר|קציצ/.test(name)) return 'dip';
 if (/כרובית|כרוב|דלעת|קישוא|חציל|גזר|בטטה|פלפל|אנטיפסטי|ירקות אפויים/.test(name)&&/אפוי|בתנור|צלוי|אנטיפסטי/.test(name)) return 'baked';
 if (/אורז|בורגול|קוסקוס|פירה|צ.יפס|תפו|תפוחי אדמה|שעועית ירוקה|ברוקולי|במיה|פתיתים|קינואה|עדשים|אפונה|כוסמת/.test(name)&&!/עוף|בשר|דג/.test(name)) return 'side';
 if (/דג|סלמון|לברק|סול|חריימה|סביצ|לביב|קציצ|עוף|פרגית|פרגיות|שניצל|בשר|קבב|חמין|ממולא|פוקי|ספרינג|פאד תאי|קאר|נקניק/.test(name)) return 'main';
 // Unknown dishes use the existing main-dish category; manual categories remain available.
 return 'main';
}
export function inferDiet(name:string):'meat'|'dairy'|'pareve'|'mixed' {
 const text=name.replace(/ללא (?:בשר|עוף|חלב|גבינה|גבינות|שמנת)|בלי (?:בשר|עוף|חלב|גבינה|גבינות|שמנת)|חלב (?:קוקוס|שקדים|סויה|שיבולת שועל)|שמנת צמחית/g,'');
 const vegetarian=/צמחוני|טבעוני/.test(text)&&!/לא צמחוני/.test(text);
 const meat=/בשר|עוף|פרגי|שניצלים|חמין|בולונז|קבב|בקר|הודו|טלה|נקניק|פסטרמה/.test(text)&&!vegetarian&&!/שניצלוני תירס|נקניקיות ופתיתים/.test(text);
 const dairy=(/^(עוגה|גלידה|פבלובה|עוגת יומולדת)$/.test(text)||/גבינ|שמנת|חלומי|בוראטה|לאבנה|חמא[הת]|בולגרית|רוזה|ציזיקי|חלבי|חלב|פרמזן|מוצרלה|פטה|יוגורט|ריקוטה/.test(text))&&!/טבעוני|פרווה/.test(text);
 return meat&&dairy?'mixed':meat?'meat':dairy?'dairy':'pareve';
}
export function mealAllows(diet:string,meal:'friday'|'lunch',week:number){if(diet==='mixed')return false;return meal==='friday'?diet!=='meat':week===3?diet!=='dairy':diet!=='meat';}
export const avatarPaths:Record<string,string>={'אמא':'zucchini','אביגיל':'avocado','יפעת':'pomegranate','נעה':'broccoli','אבא':'potato'};
export function genderText(text:string,name:string){if(name!=='אבא')return text;const pairs:Record<string,string>={'שומרת':'שומר','שמרי':'שמור','הוסיפי':'הוסף','החליפי':'החלף','כתבי':'כתוב','בחרי':'בחר','אשרי':'אשר','בדקי':'בדוק','רענני':'רענן','נסי':'נסה','תרצי':'תרצה','אישרת את התפריט':'אישרת את התפריט'};return text.replace(/שומרת|שמרי|הוסיפי|החליפי|כתבי|בחרי|אשרי|בדקי|רענני|נסי|תרצי/g,w=>pairs[w]||w);}
