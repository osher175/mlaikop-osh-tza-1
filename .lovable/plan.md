
# תוכנית: סוכן רכש חכם -- מותגים, ספקים ושיחות

## סקירה כללית

הפיצ'ר מוסיף שכבת "סוכן רכש" שיודע לבחור אוטומטית ספק ראשי + ספק השוואה לכל בקשת רכש, ולנהל שיחות מובנות (בוט/ידני) מול הספקים. הזמנה בפועל -- תמיד ידנית.

## חלק A -- מסד נתונים (6 מיגרציות)

### מיגרציה 1: טבלת `brands`

```text
brands
  id          uuid PK default gen_random_uuid()
  name        text UNIQUE NOT NULL
  tier        text NOT NULL CHECK (tier IN ('A','B','C'))
  created_at  timestamptz default now()
```

RLS: enable, policy SELECT/INSERT/UPDATE/DELETE for authenticated users.

### מיגרציה 2: טבלת `supplier_brands`

```text
supplier_brands
  id           uuid PK default gen_random_uuid()
  business_id  uuid NOT NULL REFERENCES businesses(id)
  supplier_id  uuid NOT NULL REFERENCES suppliers(id)
  brand_id     uuid NOT NULL REFERENCES brands(id)
  priority     int default 1
  is_active    boolean default true
  created_at   timestamptz default now()
  UNIQUE(business_id, supplier_id, brand_id)
```

RLS: enable, policies scoped to business_id via `user_has_business_access`.

### מיגרציה 3: טבלת `category_supplier_preferences`

```text
category_supplier_preferences
  id           uuid PK default gen_random_uuid()
  business_id  uuid NOT NULL REFERENCES businesses(id)
  category_id  uuid NOT NULL REFERENCES product_categories(id)
  supplier_id  uuid NOT NULL REFERENCES suppliers(id)
  priority     int default 1
  created_at   timestamptz default now()
  UNIQUE(business_id, category_id, supplier_id)
```

RLS: enable, policies scoped to business_id.

### מיגרציה 4: הוספת עמודות ל-`products`

```sql
ALTER TABLE products
  ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  ADD COLUMN preferred_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
```

Nullable -- לא שובר קוד קיים.

### מיגרציה 5: טבלת `procurement_conversations`

```text
procurement_conversations
  id                      uuid PK default gen_random_uuid()
  business_id             uuid NOT NULL REFERENCES businesses(id)
  procurement_request_id  uuid NOT NULL REFERENCES procurement_requests(id)
  product_id              uuid NOT NULL REFERENCES products(id)
  supplier_id             uuid NOT NULL REFERENCES suppliers(id)
  status                  text NOT NULL default 'active' CHECK (status IN ('active','closed'))
  mode                    text NOT NULL default 'bot' CHECK (mode IN ('bot','manual'))
  last_outgoing_at        timestamptz NULL
  last_incoming_at        timestamptz NULL
  created_at              timestamptz default now()
  UNIQUE(business_id, product_id, supplier_id, status)
```

ה-UNIQUE constraint מונע שיחה כפולה פעילה לאותו מוצר+ספק.
RLS: enable, policies scoped to business_id.

### מיגרציה 6: טבלת `procurement_messages`

```text
procurement_messages
  id                   uuid PK default gen_random_uuid()
  conversation_id      uuid NOT NULL REFERENCES procurement_conversations(id) ON DELETE CASCADE
  direction            text NOT NULL CHECK (direction IN ('outgoing','incoming'))
  message_text         text NOT NULL
  provider_message_id  text NULL
  status               text NOT NULL default 'queued' CHECK (status IN ('queued','sent','delivered','failed'))
  created_at           timestamptz default now()
```

RLS: enable, policies via join to conversations -> business_id.

---

## חלק B -- Edge Functions (2 פונקציות חדשות)

### Edge Function 1: `procurement-select-suppliers`

- **Input**: `{ business_id, product_id }`
- **Output**: `{ primary_supplier_id, compare_supplier_id, rationale }`

לוגיקה לבחירת ספק ראשי:
1. אם למוצר יש `preferred_supplier_id` -- זה הראשי
2. אחרת: חפש ב-`category_supplier_preferences` לפי `product_category_id` של המוצר (priority הכי נמוך = עדיפות הכי גבוהה)
3. אחרת: חפש ב-`supplier_brands` ספק שמוכר את ה-`brand_id` של המוצר (priority הכי נמוך)
4. אם אין -- primary = null

לוגיקה לבחירת ספק השוואה:
- חפש ספק שונה מה-primary שמוכר מותג באותה קטגוריה, לפי tier (A קודם, אז B, אז C)
- אם אין -- compare = null

אבטחה: Authorization header, JWT verification, שימוש ב-env vars בלבד.

### Edge Function 2: `procurement-start-outreach`

- **Input**: `{ business_id, procurement_request_id }`
- **Output**: `{ conversations_created, messages_queued, already_active }`

לוגיקה:
1. טען את ה-procurement_request (כולל product_id)
2. קרא ל-`procurement-select-suppliers` (internal call או לוגיקה inline) לקבלת primary + compare
3. לכל supplier (primary, compare אם קיים):
   - נסה INSERT ל-`procurement_conversations` עם status='active'
   - אם unique constraint נכשל -- שיחה כבר קיימת, דלג (ספירת `already_active`)
   - בדוק mode: אם manual -- לא יוצרים הודעה
   - אם bot -- צור הודעה בעברית ב-`procurement_messages` עם status='queued'
4. עדכן `procurement_request.status` ל-`waiting_for_quotes`
5. **לא שולחים בפועל לוואטסאפ** -- רק יוצרים הודעות queued

Template הודעה (עברית):
```
שלום, אני מעוניין לברר לגבי המוצר [שם מוצר].
האם ניתן לקבל הצעת מחיר עבור [כמות] יחידות?
תודה.
```

אבטחה: Authorization header, JWT verification, env vars בלבד.

Config ב-`supabase/config.toml`:
```toml
[functions.procurement-select-suppliers]
verify_jwt = true

[functions.procurement-start-outreach]
verify_jwt = true
```

---

## חלק C -- Frontend UI

### שינוי 1: Hook חדש `useProcurementConversations`

קובץ: `src/hooks/useProcurementConversations.tsx`

- Query: שליפת conversations לפי `procurement_request_id` כולל `suppliers(name, phone)`
- Mutation: `toggleMode` -- עדכון mode (bot/manual) ב-conversation
- Query: שליפת messages לפי `conversation_id`

### שינוי 2: רכיב חדש `ConversationsList`

קובץ: `src/components/procurement/ConversationsList.tsx`

- מקבל `requestId` ו-`productId`
- מציג רשימת שיחות ספקים: שם ספק, mode (bot/manual toggle), last_outgoing_at
- אם שיחה פעילה קיימת -- מציג "כבר נשלח" ולא מאפשר שליחה נוספת
- לכל שיחה: אפשרות לצפות בהיסטוריית הודעות (accordion/collapsible)
- כפתור: "התחל סקר שוק (סוכן רכש)" -- קורא ל-`procurement-start-outreach`

### שינוי 3: עדכון `ProcurementDetailDrawer`

- הוספת סקשן "שיחות ספקים" אחרי הצעות מחיר, לפני פעולות
- שימוש ב-`ConversationsList` component
- הכפתור "התחל סקר שוק" מופיע רק כשאין conversations פעילות (או כפתור "רענן סקר")

### שינוי 4: עדכון Supabase types

הטייפים יתעדכנו אוטומטית אחרי יצירת המיגרציות -- צריך לוודא ש-`procurement_conversations` ו-`procurement_messages` קיימים בטייפים.

---

## פרטים טכניים

### סדר ביצוע
1. מיגרציות DB (1-6) -- יוצרות את הטבלאות והעמודות
2. Edge Functions (select-suppliers, start-outreach) -- לוגיקה עסקית
3. עדכון config.toml -- JWT verification
4. Hook חדש + Component חדש
5. עדכון ProcurementDetailDrawer

### מה לא משתנה
- עיצוב קיים -- ללא שינוי צבעים, פונטים, layout
- דפים קיימים -- לא נמחקים
- כפתורים קיימים -- לא מוסרים
- מבנה DB קיים -- רק הוספת עמודות nullable
- תהליך הזמנה -- תמיד ידני, אין הזמנה אוטומטית
- שליחת WhatsApp בפועל -- לא בשלב זה (רק queued messages)
