# I2 — סדר הרצה, תאימות וחזרה לאחור

הקבצים האלה לא הורצו. אין להעתיק אותם אל `supabase/migrations` לפני אישור נפרד וגיבוי. אין בהם מילוי היסטורי, אין שינוי של `products.quantity` או `products.cost`, ואין הפעלת קליטה.

## סדר הרצה

1. `01-preflight.readonly.sql` — קורא רק את קטלוג המערכת. אם הוא נכשל, עוצרים.
2. `02-tenant-keys.UNAPPLIED.sql` — מפתחות `(business_id, id)` ופונקציית חברות לקריאה.
3. `03-catalog.UNAPPLIED.sql` — מפרט צמיג, מחירון, מק״ט ספק, הפניית תמונה.
4. `04-import-orders.UNAPPLIED.sql` — סטטוס מסחרי, גרסה, צילום תנאים, יומן מסחרי.
5. `05-shipments.UNAPPLIED.sql` — משלוח, מכולה, כמויות ואבני דרך.
6. `06-payments.UNAPPLIED.sql` — מסמך אופציונלי ויתרת ספק במטבע ההזמנה.
7. `07-landed-cost.UNAPPLIED.sql` — הוצאה משותפת, הקצאה ועיגול.
8. `08-goods-receipts.UNAPPLIED.sql` — קליטה משותפת חסומה לטיוטה.
9. `09-verification.readonly.sql` — בדיקת מבנה אחרי הרצה.

`10-rollback.manual.sql` אינו חלק מהסדר. הוא רץ רק על סכמה ריקה אחרי `SET i2.recovery = 'empty-schema'`. פירוט שלושת מצבי השחזור נמצא בסעיף החזרה לאחור.

כל קובץ החלה הוא טרנזקציה נפרדת. אם קובץ נכשל, מה שכבר הוחל לפניו נשאר. עוצרים ומשתמשים בחזרה לאחור. אין להמשיך מאמצע בלי בדיקה.

`lock_timeout` הוא 5 שניות. הוספת עמודה עם ברירת מחדל קבועה אינה כותבת מחדש את כל השורות בגרסאות Postgres נתמכות, אבל היא עדיין נועלת לזמן קצר. אם המנעול נכשל, לא מריצים שוב עד שהחלון פנוי.

## מה לא משתנה

נשארים בשמותיהם ובחתימותיהם: `import_orders`, `import_order_items`, `import_costs`, `import_payments`, `import_documents`, `import_events`, `import_receipts`, `import_receipt_items`, `import_receipt_corrections`, `import_cost_adjustments`, `products`, `suppliers`, `purchase_orders`, `purchase_order_lines`.

לא מוחלפים: `import_receipt_confirm`, `import_receipt_save_draft`, `import_order_landed_cost`, `import_order_close`, `import_assign_number`, `execute_inventory_transaction`, `save_purchase_order`, `post_purchase_receipt`, `can_manage_business_imports`.

`import_number` נשאר חובה. הטריגר הקיים שממספר `IMP-YYYY-####` לא נגע. אין מספור מחדש.

`status` הלוגיסטי לא נכתב מחדש. `estimated_arrival_date` לא מועתק אל תאריכי משלוח. `products.id` לא מתמזג ולא מתפרק משם חופשי.

## עמודות היסטוריות שנשארות ריקות

על הזמנות קיימות, אחרי הוספת העמודות:

| עמודה | ערך |
|---|---|
| `commercial_status` | `confirmed`, כי הזמנה קיימת נולדה כ־`ordered`. זו ברירת מחדל של עמודה, לא פקודת עדכון |
| `confirmed_at`, `confirmed_by` | ריק. אין תאריך אישור ידוע |
| `version` | `1`. מונה התחלתי, בלי יומן משוחזר |
| `actual_arrival_on` | ריק |
| `payment_state`, `shipment_state`, `receiving_state` | ריק. אין גזירה מהסטטוס הישן |
| `import_payments.import_document_id` | ריק |

כל הטבלאות החדשות נוצרות ריקות. אין העתקה מ־`size_label`, משם המוצר, מ־`products.price`, מ־`products.image`, ממק״ט על שורת יבוא, או מ־`import_cost_adjustments`.

הזמנה חדשה שהמסך החי יוצר בלי לשלוח `commercial_status` נשארת `confirmed`. זה ממשיך את ההתנהגות הנוכחית, שבה הזמנה נולדת כ־`ordered`. טיוטה נוצרת רק כשלקוח עתידי כותב `draft` במפורש.

## מיפוי לקריאה בלבד

המיפוי אינו נכתב למסד.

| `import_orders.status` | תצוגה |
|---|---|
| `ordered` | הוזמנה, ובהזמנות ישנות גם האישור המסחרי |
| `preparing` | בהכנה |
| `shipped` | יצאה |
| `in_transit` | בדרך |
| `arrived_israel` | בנמל |
| `customs_clearance` | במכס |
| `receiving` | כפי שנשמר, בלי להחליט אם זו הובלה או קליטה |
| `received_pending_costs` | הגיעה וממתינה לסגירת עלות |
| `completed` | נסגרה |
| `cancelled` | בוטלה |

| `import_payments.payment_status` | יתרת ספק |
|---|---|
| `paid` | מפחית רק תשלום ספק במטבע ההזמנה |
| `planned` | אינו מפחית |
| `pending` | אינו מפחית |
| `cancelled` | אינו מפחית |

תשלום שהסוג שלו הוא הובלה, מכס, עמיל או אחר, או שיש לו `import_cost_id`, אינו מפחית את יתרת הספק. תשלום במטבע שונה ממטבע ההזמנה אינו מומר. הוא פשוט לא נכנס ליתרה.

## חזרה לאחור

שלושה מצבים, והם לא אותו סקריפט:

1. סכמה ריקה. הטבלאות החדשות בלי שורות. באותה שיחה מגדירים `SET i2.recovery = 'empty-schema'` ורק אז מריצים את `10-rollback.manual.sql`. בלי ההגדרה הקובץ נעצר לפני כל מחיקה.
2. סכמה עם רשומות עסקיות. אם יש שורה באחת מטבלאות I2, הקובץ נעצר ולא מוחק כלום. הרשומות נשארות.
3. שחזור ייצור. דורש גיבוי ואישור מפורש. זה שחזור מהגיבוי, לא הרצת קובץ המחיקה.

הקובץ אינו מוחק הזמנות, מוצרים, קליטות ישנות או התאמות עלות ישנות.

## מה עדיין תלוי באישור

- סיווג הפרש שער והאם עמלת בנק נכנסת לעלות. בסכמה אי אפשר לסמן `bank_fx_fees` כהוצאה מהוונת.
- עלות הספק של צמיג פגום: הסגר, אפס או תביעה. אין עמודת החלטה.
- אילו חשבוניות הן מע״מ בר־קיזוז.
- הוצאה אחרי מכירה נשארת במדיניות `unabsorbed_amount_ils` הקיימת. I2 אינו מריץ אותה מחדש.
- עודף קליטה נשאר מותר ב־`import_receipt_confirm`.
- אין סניף.
- כתיבה ישירה למסכי היבוא החיים נשארת. עמודת `version` אינה נועלת אותה, כדי לא לשבור את המסך. הנעילה שייכת ל־RPC של I3, והוא כרגע בלי הרשאת הרצה.
- מנהל פלטפורמה נשאר ב־`can_manage_business_imports` על הטבלאות הישנות. הטבלאות החדשות אינן משתמשות בפונקציה הזאת.
- מספר טיוטה בלי `IMP-YYYY-####` דורש שינוי של `import_assign_number`. זה לא נעשה.
- שער עבודה חסר בקליטה החיה עדיין עלול להיחשב כ־1. I2 אינו משנה את הפונקציה.
- `import_order_landed_cost` ממשיך לסכום `effective_amount_ils`. אין לחבר את הסכום הזה עם שורות ההקצאה החדשות כששתיהן יוצגו. כרגע טבלאות ההקצאה ריקות והמסך החי לא קורא להן.
