# אוכל לשבת — משפחת טיקו

אתר משפחתי לתפריט שבת, מאגר מנות ורשימת קניות. האחסון החדש משתמש **רק ב־GitHub Pages ובגוגל**.

**האתר החדש:** https://noatiko-sketch.github.io/tiko-shabbat-menu/

## איך זה עובד

- GitHub Pages מציג את הממשק הסטטי.
- Google Apps Script מבצע את פעולות התפריט והקניות מול קובץ Drive המשפחתי המקורי.
- Google HTML Service מספק חיבור למסד ללא פרסום מפתח השרת. הכניסה משתמשת בקוד המשפחתי הקיים, אם הוגדר, או בחשבון בעלת הפרויקט.
- שינויים בממשק מתפרסמים ממיזוג ל־main. שינויים בבקנד מתפרסמים לאותה פריסת גוגל באמצעות הרשאת הפרסום החד־פעמית המתוארת בהוראות.

האתר הישן נשאר פעיל בזמן אימות המעבר. [מצב המעבר והגדרות](docs/github-hosting.md).

## עבודה משותפת

1. כל שותף פותח ענף לשינוי ו־Pull Request ל־main.
2. מוודאים שבדיקת Check עברה.
3. ממזגים; פעולת Publish Tiko to Google and GitHub Pages מפרסמת את העדכון. אין צורך לפרסם דרך ChatGPT.

אין להכניס סיסמאות, קוד משפחתי, מפתחות או state.json לריפו. אין להגדיר VITE_TIKO_BRIDGE_TOKEN או להעתיק TIKO_BRIDGE_TOKEN לממשק. VITE_TIKO_GOOGLE_URL היא כתובת פריסה ציבורית בלבד.

## פיתוח ובדיקות

Node.js 24 ו־pnpm לפי package.json:

```sh
pnpm install --frozen-lockfile
npm run check
npm run build
npm run dev
```

הממשק נבנה לתיקיית dist-pages עבור /tiko-shabbat-menu/. פקודות dev:sites ו־build:sites נשמרו להשוואה עם האתר הישן בלבד. בדיקות משתמשות בנתונים מבודדים, ללא גישה לנתוני המשפחה.

שינוי ב־lib/drive-engine.ts או במקור המשותף לגוגל מחייב node scripts/build-drive-bridge.mjs לפני שמירה.
