# I1 — מצב קיים של מודול היבוא

תאריך הביקורת: 2026-11-11.  
זו ביקורת קריאה בלבד. לא בוצעה כתיבה לייצור, לא הורצה מיגרציה, ולא רוענן קטלוג הטיפוסים מול מסד הייצור.

## גבול הראיות

מאומת מול הריפו:

- `src/integrations/supabase/types.ts`
- מיגרציות היבוא ב־`supabase/migrations`, החל מ־`20260810121807_7642abe1-4357-4db3-b12f-847b73671200.sql` ו־`20260810130007_e160bb9b-a1a2-4197-b824-e961f99e4d1a.sql`
- דפי היבוא, ההוקים ורכיבי `src/components/import`
- מסמכי `docs/IMPORT_MODULE_PHASE_*.md`
- מודול הזמנות הרכש המקומי ו־`docs/v2/purchase-order-receipts.UNAPPLIED.sql`
- `docs/v2/fifo-inventory-lots.UNAPPLIED.sql`

לא מאומת מחדש מול מסד הייצור בסיבוב הזה. מסמכי Phase 2.1 ו־Phase 3 מתארים בדיקה חיה קודמת. אם הייצור סטה מהמיגרציות שבריפו, הסטייה לא נבדקה כאן.

המוקאפים לא היו בנתיב `docs/v2/import-upgrade/mockups/` לפני הביקורת. שלושת הקבצים שצורפו לשיחה נשמרו שם כחומר עזר:

- `mockups/01-import-center.jpg`
- `mockups/02-import-order-detail.jpg`
- `mockups/03-goods-receiving.jpg`

## מסכים וקוד קיימים

היבוא חי בנתיב הישן, לא מאחורי דגל V2:

- `/import` — `src/pages/ImportCenter.tsx`
- `/import/:id` — `src/pages/ImportOrderDetail.tsx`, עמוד פרטים קבוע
- ניווט V2 כבר מצביע ל־`/import` מ־`src/components/v2/navConfig.ts`

רכיבים מרכזיים:

- יצירה: `CreateImportOrderDialog.tsx`
- אשף שורות, עלויות ומסמכים: `src/components/import/wizard/`
- ציר סטטוס: `journey/importJourney.ts`, `JourneyTimeline.tsx`
- קליטה: `ReceivingPanel.tsx`, `ReceivingDialog.tsx`, `useImportReceiving.tsx`
- סגירה: `ClosurePanel.tsx`, `useImportClosure.tsx`
- שער PIN: `ImportPinGate.tsx`, `useImportPin.tsx`
- מתמטיקת תשלומים בצד לקוח: `src/lib/v2/importPaymentMath.ts`

יצירת הזמנה ועדכון כותרת נכתבים ישירות ל־`import_orders` דרך PostgREST. קליטה מאושרת עוברת רק ב־`import_receipt_confirm`.

## טבלאות מאומתות

| טבלה | תפקיד |
|---|---|
| `import_orders` | כותרת. מספר, ספק, `direct_import` או `parallel_import`, מדינה, מטבע, שער עבודה אחד, תאריך הזמנה, ETA אחד, סטטוס אחד |
| `import_order_items` | שורות. מוצר אופציונלי, מותג, תיאור, מידה חופשית, דגם, מק״ט ספק, כמות, עלות ספק, כמות שהתקבלה, כמות שלא תגיע |
| `import_costs` | שורת הוצאה אחת עם אומדן וסכום סופי. `effective_amount_ils` הוא הסכום שנכנס לעלות |
| `import_payments` | תשלום עם מטבע, שער, סכום בשקלים, סטטוס וסוג. יכול להצביע להוצאה או להזמנה |
| `import_documents` | קובץ בבאקט `import-documents` |
| `import_events` | יומן אירועים |
| `import_receipts` / `import_receipt_items` | טיוטת קליטה ואישור. טיוטה אינה מזיזה מלאי |
| `import_receipt_corrections` | תיקון אחרי אישור, בלי דריסת שורת הקליטה |
| `import_cost_adjustments` | פנקס התאמת עלות בסגירה. חסום לעדכון ומחיקה |
| `import_pin_settings` / `import_pin_sessions` | PIN נוסף מעל ההרשאה |

אין בריפו טבלת מכולות, משלוחים נפרדים, או קישור של מכולה אחת לכמה הזמנות.

## סטטוסים

ברירת המחדל של הזמנה חדשה היא `ordered`, לא טיוטה. הערכים המותרים:

`ordered`, `preparing`, `shipped`, `in_transit`, `arrived_israel`, `customs_clearance`, `receiving`, `received_pending_costs`, `completed`, `cancelled`.

`journeyProgress` מחשב אחוז לפי מיקום התווית ברשימה. זה בדיוק החישוב שהכלל העסקי אוסר להציג כהתקדמות אמיתית.

תשלומים, לוגיסטיקה וקליטה אינם בלתי תלויים עד הסוף: אישור קליטה עצמו משנה את `import_orders.status` ל־`receiving` או ל־`received_pending_costs`. במקביל, עדכון ישיר של הכותרת מאפשר לשנות סטטוס בלי קליטה.

## עלות נחיתה קיימת

Phase 1.2: לכל שורת הוצאה יש אומדן וסכום סופי. החישוב סוכם את `effective_amount_ils` בלבד, בלי לחבר אומדן וסופי של אותה שורה.

Phase 3, בסגירת ההזמנה:

```
overhead_per_unit = SUM(effective_amount_ils) / SUM(received_quantity)
final_unit_cost   = provisional_unit_cost + overhead_per_unit
```

הבסיס הוא כמות שהתקבלה באותה הזמנה. אין פיצול בין צמיג שהתקבל למכירה, צמיג פגום וצמיג חסר. אין הקצאה למכולה המשותפת לכמה הזמנות.

באישור הקליטה נרשמת למלאי רק עלות הסחורה הזמנית: `expected_unit_cost_ils`, או `supplier_unit_cost * working_exchange_rate_to_ils`. אם אין שער עבודה, הפונקציה משתמשת ב־1. הוצאות היבוא נכנסות ל־`products.cost` רק בסגירה, כהתאמה לממוצע הנע, ורק לכמות שעדיין במלאי. יחידות שכבר נמכרו נשארות עם `cost_snapshot_ils` המקורי, וההפרש נרשם כ־`unabsorbed_amount_ils`.

## קליטה קיימת — חיה

`import_receipt_confirm` רץ בייצור לפי המיגרציה והאימות של Phase 2.1:

- נועל את הקבלה ודוחה סטטוס שאינו `draft`
- קורא ל־`execute_inventory_transaction` עם `add`
- מעדכן `products.quantity` ואת הממוצע הנע
- כותב `inventory_actions` עם `source = import_receiving`
- מעלה `import_order_items.received_quantity`
- עודף קליטה אינו נחסם. הוא נרשם כאירוע `receipt_overage_recorded`

טיוטה נשמרת ב־`import_receipt_save_draft` ואינה נוגעת במלאי.

## הזמנות רכש מקומיות

חמש טבלאות הרכש ו־`save_purchase_order` הוחלו בייצור לפי אישור Phase 15E. זה לא אומת מחדש בשאילתה בסיבוב הזה.

`post_purchase_receipt` קיים בלי `EXECUTE` ל־`anon`, `authenticated` ו־`service_role`. הדגלים `PURCHASE_ORDERS_READY` ו־`PURCHASE_RECEIPT_ATOMIC_READY` הם `false`. שמירת הזמנת רכש מהממשק כבויה. גוף השמירה אינו מעדכן מלאי.

`inventory_lots` אינו קיים במיגרציות שהוחלו. הקובץ `docs/v2/fifo-inventory-lots.UNAPPLIED.sql` מחוץ ל־`supabase/migrations` ומגדיר שכבות עלות בלי סניף ובלי תאריך מלאכותי למלאי פתיחה.

## קטלוג, מחיר ותמונה

`products` מכיל: `name`, `brand_id`, `barcode`, `cost`, `price`, `quantity`, `image`, `supplier_id`, `preferred_supplier_id`, `location`, `expiration_date`.

אין במוצר: רוחב, יחס, חישוק, עומס, מהירות, XL, Run Flat, מק״ט פנימי, מק״ט יצרן, או מחיר סיטונאי. מידה נגזרת לעיתים בשם באמצעות ביטוי `205/55R16`. `brands` הוא שם ודרגה גלובליים, לא שדה של העסק. `supplier_brands` קושר ספק למותג בתוך עסק.

`products.price` הוא מחיר המכירה הקיים. `planned_sale_price_ils` יושב על שורת היבוא, לא על המוצר. אין מחירון סיטונאי.

תמונת מוצר היא מחרוזת `products.image`. מסמכי יבוא נשמרים בבאקט `import-documents` עם כתובת חתומה ל־120 שניות. קיימת פונקציית קצה `compress-storage-images`. לא אומת כאן אם תמונות המוצר יושבות באותו באקט.

## ספקים והרשאות

`suppliers` הוא שם, טלפון, דוא״ל וסוכן, תחת `business_id`. אין סוג יצרן מול סוחר, ואין מדינה על הספק. המדינה וסוג הרכש יושבים על הזמנת היבוא.

אין ישות סניף בריפו. `docs/v2/reports-v2-overview.UNAPPLIED.sql` מציין שאין עמודת סניף.

`can_manage_business_imports` מאפשר ניהול לבעלים, למנהל מאושר, או למשתמש ש־`user_roles.role = admin` בלי בדיקת חברות באותו עסק. זה מנהל פלטפורמה, לא עובד סניף. ה־PIN הוא שכבה נוספת ואינו מחליף את הבדיקה.

קליטות היבוא חשופות ל־`SELECT` בלבד. כותרות ושורות הזמנה עדיין מקבלות `INSERT`, `UPDATE`, `DELETE` ל־`authenticated` תחת ה־RLS. מפתח `service_role` אינו בקוד הדפדפן. הדפדפן משתמש במפתח `anon`.

## מה אפשר לשמר

- עמוד הפרטים הקיים כנקודת המוצא למסך ב׳, לא מודאל.
- `import_costs` עם אומדן, סכום סופי וערך אפקטיבי.
- `import_payments` עם שער היסטורי לכל תשלום.
- `import_documents` והבאקט.
- `import_events` כיומן.
- הפרדת טיוטת קליטה מאישור אטומי.
- `execute_inventory_transaction` כנתיב המלאי החי עד שתוחלף במנוע משותף מאושר.
- זהות מוצר קיימת לפי `products.id`. אסור למזג או להחליף מזהים.
