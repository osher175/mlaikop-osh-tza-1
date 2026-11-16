interface ErrorShape {
  message?: string;
  code?: string;
}

const readError = (error: unknown): ErrorShape => {
  if (error instanceof Error) return { message: error.message };
  if (!error || typeof error !== 'object') return {};
  const value = error as ErrorShape;
  return {
    message: typeof value.message === 'string' ? value.message : undefined,
    code: typeof value.code === 'string' ? value.code : undefined,
  };
};

/** Hebrew text for a failed employee-directory write. The draft of a sale is not involved. */
export function hebrewEmployeeError(error: unknown): string {
  const { message = '', code } = readError(error);
  const text = message.toLowerCase();
  if (code === '23505' || text.includes('duplicate') || text.includes('unique')) {
    return 'כבר קיים עובד בשם הזה בעסק.';
  }
  if (code === '42501' || text.includes('row-level security') || text.includes('permission') || text.includes('access denied')) {
    return 'רק בעל העסק יכול להוסיף או לערוך עובדים.';
  }
  if (text.includes('failed to fetch') || text.includes('network') || text.includes('fetch')) {
    return 'החיבור נקטע. העובד לא נשמר.';
  }
  if (text.includes('between 1 and 120') || text.includes('display_name')) {
    return 'שם העובד צריך להכיל בין תו אחד ל-120 תווים.';
  }
  return 'שמירת העובד נכשלה.';
}

/**
 * Hebrew text for a failed quick-sale confirmation or reversal.
 * A failed confirmation does not mean the draft should be cleared.
 */
export function hebrewSaleError(error: unknown): string {
  const { message = '', code } = readError(error);
  const text = message.toLowerCase();
  if (text.includes('salesperson is required') || text.includes('יש לבחור איש מכירות') || (text.includes('null value') && text.includes('salesperson'))) {
    return 'יש לבחור איש מכירות לפני אישור העסקה';
  }
  if (text.includes('salesperson')) {
    return 'המוכר שנבחר אינו פעיל בעסק. יש לבחור איש מכירות פעיל.';
  }
  if (text.includes('partial return')) {
    return 'אי אפשר לבטל את כל המכירה אחרי החזרה חלקית. המלאי לא שונה.';
  }
  if (text.includes('list price does not match')) {
    return 'מחיר המחירון השתנה מאז שהמוצר נוסף. העסקה לא נשמרה. יש להוסיף את המוצר מחדש.';
  }
  if (text.includes('insufficient stock') || code === '23514') {
    return 'אין מספיק מלאי לאחד המוצרים. העסקה לא נשמרה והמלאי לא השתנה.';
  }
  if (text.includes('invalid sale line') || text.includes('invalid quantity') || text.includes('invalid quick sale') || text.includes('price')) {
    return 'מחיר או כמות אינם תקינים. העסקה לא נשמרה.';
  }
  if (code === '42501' || text.includes('access denied') || text.includes('permission') || text.includes('row-level security')) {
    return 'אין הרשאה לבצע את הפעולה בעסק הזה.';
  }
  if (text.includes('not found')) {
    return 'העסקה לא נמצאה בעסק הזה.';
  }
  if (text.includes('failed to fetch') || text.includes('network') || text.includes('fetch')) {
    return 'החיבור נקטע. הטיוטה נשמרה ואפשר לנסות שוב בלי ליצור עסקה כפולה.';
  }
  return 'הפעולה נכשלה. לא התקבל אישור מהשרת.';
}
