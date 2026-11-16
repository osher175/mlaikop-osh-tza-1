# I1 — מודל נתונים מוצע

המסמך מתאר תוספות. הוא אינו מיגרציה. אין להריץ אותו, ואין ליצור ממנו קובץ ב־`supabase/migrations` לפני אישור I2.

כל הטבלאות הקיימות נשמרות. אין שינוי הרסני לשורות היסטוריות.

## מה נשאר כפי שהוא

`import_orders`, `import_order_items`, `import_costs`, `import_payments`, `import_documents`, `import_events`, `import_receipts`, `import_receipt_items`, `import_receipt_corrections`, `import_cost_adjustments`, `products`, `inventory_actions`, `suppliers`.

עמודות קיימות שממשיכות לשמש:

- `import_number`, `purchase_type`, `supplier_country`, `currency_code`
- `supplier_unit_cost`, `supplier_sku`, `size_label`, `model_name`, `manufacturer_name`
- `working_exchange_rate_to_ils` כשער עבודה היסטורי, לא כשער היחיד של כל תשלום
- `amount`, `final_amount`, `effective_amount_ils` בשורת הוצאה
- `exchange_rate_to_ils`, `amount_ils`, `payment_status` בתשלום
- `products.id` כזהות הקטלוג

## זהות צמיג — תוספת, לא החלפת מוצר

טבלה חדשה `product_tire_specs`, אחת למוצר:

- `product_id`, `business_id`
- `width_mm`, `aspect_ratio`, `rim_inch`
- `load_index`, `speed_rating`
- `extra_marks` כרשימה סגורה: `xl`, `run_flat`, `foam`, `oem` ואחרות שיאושרו
- `internal_sku`
- `manufacturer_sku`

המידה החופשית הקיימת ב־`size_label` ובשם המוצר אינה נמחקת. אם אי אפשר לפרק אותה בוודאות, השדות המפורקים נשארים ריקים.

מק״ט פנימי חדש אינו משתנה כשהעלות משתנה. התאמה למוצר קיים נעשית לפי מזהה מוצר, ואם אין מזהה — לפי מותג, דגם, מידה מפורקת, עומס ומהירות יחד. מותג ומידה לבדם אינם בוחרים מוצר. זהו הכלל שכבר קיים בהתאמת הזמנות הרכש.

## מחיר סיטונאי בלי הפעלת מכירה סיטונאית

טבלה חדשה `product_price_lists`:

- `business_id`, `product_id`
- `channel`: `retail` או `wholesale`
- `amount_ils`
- `effective_from`

`retail` יכול להצביע בתחילה על `products.price` בלי להעתיק היסטוריה שלא קיימת. `wholesale` נשמר ומוסתר מהקופה עד אישור תהליך מכירה סיטונאית. אין ליצור מסמכי מכירה מהשדה הזה.

`planned_sale_price_ils` נשאר תכנון על שורת היבוא. הוא אינו הופך למחיר הקטלוג.

## טיוטה ואישור מסחרי

להוסיף ל־`import_orders`, בלי לשכתב שורות קיימות:

- `commercial_status`: `draft` או `confirmed`
- `confirmed_at`, `confirmed_by`
- שורות קיימות מקבלות `confirmed`, כי הן נולדו כ־`ordered`

טיוטה חדשה אינה מקבלת מספר סופי אם יוחלט שמספר מוקצה רק באישור. הזמנות קיימות שומרות את `import_number` שלהן. אין למספר מחדש.

תנאי שאושרו נשמרים בצילום על השורות בזמן האישור: כמות, מחיר ספק, מטבע. תיקון אחרי אישור הוא אירוע תיקון, לא מחיקה שקטה של הצילום.

## תשלומים

`import_payments` כבר מתאים ליותר משני תשלומים, עם שער לכל שורה. להשאיר את השער על השורה.

להבחין ב־`payment_status` בין `planned` ל־`paid`. סטטוסים אחרים קיימים בקוד הלקוח. I2 ימפה את הערכים שכבר נשמרו ולא ימציא תשלומים חסרים.

יתרת הספק מחושבת במטבע ההזמנה:

```
supplier_balance = SUM(confirmed line supplier_unit_cost * qty) - SUM(paid supplier payments in order currency)
```

תשלום הוצאה, כמו עמיל או הובלה, אינו מקטין את יתרת הספק. היום `orderPayableRemaining` מחבר עלות סחורה והוצאות בשקלים. זה נשאר חישוב ישן עד שהמסך החדש יציג את שני היתרות בנפרד.

שקלים של תשלום ספק:

```
ils = round(amount_foreign * exchange_rate_to_ils, 2)
```

השער שנקלט נשמר. אין דריסת שער ישן כששער חדש נרשם לתשלום הבא.

## משלוחים ומכולות

`import_shipments`

- `business_id`, `shipment_number`
- `container_number` אופציונלי
- `expected_departure_on`, `actual_departure_on`
- `expected_port_arrival_on`, `actual_port_arrival_on`
- `expected_warehouse_on`, `actual_warehouse_on`
- `logistics_status` מהרשימה בסעיף התהליך

`import_shipment_orders`

- `shipment_id`, `import_order_id`, `business_id`
- מכולה אחת, כמה הזמנות

`import_shipment_lines`

- `shipment_id`, `import_order_item_id`, `quantity`

כמות בשורה אינה גדולה מהכמות שנותרה על שורת ההזמנה אחרי משלוחים אחרים. אין מיזוג של שתי הזמנות לשורה אחת.

אבני דרך נרשמות ב־`import_shipment_events` כהוספה בלבד: סטטוס קודם, סטטוס חדש, תאריך מתוכנן, תאריך בפועל, מי שינה. תיקון הוא אירוע חדש.

`estimated_arrival_date` הקיים נשאר על ההזמנה כתאריך היסטורי. הוא אינו נמחק כדי למלא את תאריכי המשלוח.

## הוצאות משותפות

`import_cost_allocations`

- `import_cost_id`
- `shipment_id` אופציונלי
- `import_order_id` אופציונלי
- `basis`: `per_accepted_tire` להוצאה משותפת, `direct_line` להוצאה של מוצר מסוים
- `import_order_item_id` כשההוצאה ישירה
- `recoverable_vat_ils` בנפרד מהסכום שנכנס לעלות

הוצאה משותפת של מכולה אינה משויכת למותג, למשקל או לערך. הבסיס הוא מספר הצמיגים שהתקבלו כתקינים באותה מכולה.

הוצאה ישירה נשארת על השורה או על המוצר שאליו היא שייכת.

## קליטה משותפת — מודל יעד, לא הפעלה

`goods_receipts` ו־`goods_receipt_lines` יחליפו בעתיד את פיצול הקליטה בין יבוא לרכש. עד I6 הטבלאות הקיימות נשארות מקור האמת.

שורה עתידית:

- `ordered_quantity` כהעתק קריאה
- `previously_accepted`, `previously_damaged`, `previously_missing`
- `accepted_quantity`, `damaged_quantity`, `missing_quantity`
- `notes`
- `idempotency_key` על הכותרת
- `status`: `draft` או `posted`
- `inventory_action_id` אחרי פרסום
- `lot_id` רק אחרי ששכבות העלות קיימות ואושרו

זהות הכמויות:

```
accepted + damaged + missing <= open quantity
open = ordered - previously accepted - previously damaged - previously missing
```

`accepted` נכנס למלאי הנמכר. `damaged` נכנס להסגר או נרשם כלא־נמכר, לפי ההחלטה בסעיף הסיכונים. `missing` אינו נכנס למלאי.

## בידוד

כל טבלה חדשה נושאת `business_id`. מדיניות הקריאה היא חברות בעסק. כתיבה של קליטה, אישור מסחרי והקצאת עלות עוברת ב־RPC עם בדיקת חברות וחיוב, בלי זהות משתמש שהלקוח שולח. אין `branch_id` בשלב הזה.

מסמכים חדשים נשארים בבאקט פר עסק, עם נתיב שמתחיל ב־`business_id`, וכתובת חתומה. אין קישור ציבורי קבוע.
