
## מה נבנה

שני שיפורים ממוקדים במסך המלאי, ללא נגיעה בעיצוב, במסלול הביליינג/מנוי או במבנה הכללי.

---

### 1. כפתור "ביטול פעולה" למשך 10 דקות אחרי הורדה/מכירה

**הבעיה:** אחרי הורדת מלאי / רישום מכירה אין דרך לתקן טעות. הרשומה נשארת ומזייפת את דוחות ההכנסות והרווח לטווח ארוך.

**הפתרון:** חלון ביטול של 10 דקות מרגע ביצוע הפעולה. הביטול מתבצע כ-**Reversal** (רשומת פעולה נגדית + סימון המקורית כמבוטלת) — לא מחיקה — כדי לשמור על שרשרת אמת מלאה ואודיט.

**איפה מופיע הכפתור:**
- טוסט הצלחה מיד אחרי מכירה/הורדה → כפתור "בטל" בטוסט עצמו
- ב"פעילות אחרונה" בדשבורד — ליד כל רשומת `remove`/`sale` שגילה < 10 דק' יופיע ↩️ "בטל פעולה"
- אחרי 10 דקות הכפתור פשוט נעלם. אם רוצים לתקן אחרי זה — צריך "החזרה" ידנית (return), לא ביטול.

**מה קורה כשלוחצים "בטל":**
1. יוצרים `inventory_action` חדש מסוג `reversal` עם `quantity_changed` הפוך.
2. מסמנים את הפעולה המקורית כ-`reversed_at = now()` + `reversed_by = user`.
3. מחזירים את הכמות למוצר (`products.quantity`).
4. שאילתות הדוחות (`reports_aggregate`, BI, YoY, insights) מסננות החוצה פעולות שיש להן `reversed_at IS NOT NULL` ואת רשומות ה-`reversal` עצמן — כך שההכנסות/רווח מתקנים את עצמם מיידית.
5. מוקפא: `SubscriptionGuard`, RLS של billing, `execute_inventory_transaction` נשאר כפי שהוא — הביטול הוא RPC נפרד חדש (`reverse_inventory_action`).

**כללי אבטחה:**
- ניתן לבטל רק פעולה שביצע אותו משתמש (או OWNER/ADMIN של העסק).
- לא ניתן לבטל פעולה שכבר בוטלה.
- לא ניתן לבטל אם עברו > 10 דקות מ-`created_at`.
- הכל נאכף גם ב-RPC (server-side), לא רק ב-UI.

---

### 2. כפתור עין 👁️ להסתרת/הצגת מחיר עלות

**הבעיה:** מחיר עלות מוצג תמיד בטבלת המלאי / כרטיסי מוצר, כולל כשלקוח עומד ליד המסך.

**הפתרון:**
- כפתור עין 👁️ / 👁️‍🗨️ בכותרת מסך המלאי (`InventoryHeader`).
- לחיצה מחליפה את מצב "הצגת עלות" גלובלית עבור המסך: `InventoryTable`, `ProductCard`, `VirtualizedInventoryTable`.
- כשההסתרה פעילה: `₪●●●` במקום הסכום. שאר הנתונים (כמות, מחיר מכירה, ספק) נשארים גלויים.
- המצב **נשמר ב-`localStorage`** לפי משתמש, כך שאחרי רענון הוא נשאר כפי שהיה. ברירת מחדל: מוסתר (בטוח כברירת מחדל, במיוחד ליד לקוחות).
- אין שינויי DB, אין שינויי הרשאות — זו החלטה ויזואלית בלבד.
- מודלים פנימיים (SaleModal, PurchaseModal) שממילא ניגשים לעלות לצורך חישוב רווח — לא מושפעים, המידע שם נחוץ לפעולה.

---

## פרטים טכניים

**שינויי DB (מיגרציה אחת):**
- `ALTER TABLE inventory_actions ADD COLUMN reversed_at TIMESTAMPTZ, reversed_by UUID, is_reversal BOOLEAN DEFAULT false, reverses_action_id UUID`.
- CHECK-constraint: extend allowed `action_type` values with `'reversal'` (או להשתמש ב-`is_reversal` בלבד — נבחר בהתאם למגבלת ה-CHECK הקיימת).
- RPC חדש: `public.reverse_inventory_action(p_action_id uuid)` — SECURITY DEFINER, בודק בעלות, חלון זמן, ומבצע את ההיפוך אטומית.
- עדכון פונקציות הדוחות שמסתמכות על `action_type IN ('remove','sale')` להוסיף `AND reversed_at IS NULL AND is_reversal = false` (רשימת הקבצים: `reports_aggregate`, ופונקציות ב-`20260203185646`, `20260128171340`, `20260123122427`, `20250704141102`, `20250701210312`).

**שינויי קוד (Frontend):**
- `src/hooks/useInventoryLogger.tsx` — פונקציית `reverseAction(id)` חדשה שקוראת ל-RPC.
- `src/hooks/useRecentActivity.tsx` — להחזיר גם `created_at`, `reversed_at`, `user_id` לצורך הצגת הכפתור.
- קומפוננטה חדשה `UndoActionButton` שמציגה טיימר ספירה לאחור (למשל "בטל (9:42)") ונעלמת בסוף.
- טוסט אחרי מכירה/הורדה → action `Undo` שקורא לאותו hook.
- `src/hooks/useCostVisibility.ts` — hook קטן שמנהל את מצב הסתרת העלות ב-localStorage.
- עדכון `InventoryHeader`, `InventoryTable`, `ProductCard`, `VirtualizedInventoryTable` להציג `₪●●●` כשמוסתר.

**מה לא משתנה:**
- SubscriptionGuard, billing, RLS של מנויים — קפואים.
- מבנה `execute_inventory_transaction` — לא נוגעים; הוספת RPC חדש נפרד.
- העיצוב, הצבעים, הפריסה, הכפתורים הקיימים.

---

## תוצאה מבחינת המשתמש

- הורדת מלאי/מכירה בטעות → יש 10 דקות ללחוץ "בטל" והנתונים מתקנים את עצמם בכל הדוחות.
- מחיר העלות מוסתר כברירת מחדל. לחיצה על 👁️ מציגה כשצריך; לחיצה נוספת מסתירה מיד.
