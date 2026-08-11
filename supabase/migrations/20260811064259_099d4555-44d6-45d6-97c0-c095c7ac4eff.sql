CREATE OR REPLACE FUNCTION public.import_pin_verify(p_business_id uuid, p_pin text)
 RETURNS TABLE(success boolean, token uuid, expires_at timestamp with time zone, locked_until timestamp with time zone, attempts_left integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_row public.import_pin_settings%ROWTYPE;
  v_token uuid;
  v_expires timestamptz;
BEGIN
  IF NOT public.can_manage_business_imports(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.import_pin_settings WHERE business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No PIN configured for this business';
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, v_row.locked_until, 0;
    RETURN;
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' OR extensions.crypt(p_pin, v_row.pin_hash) <> v_row.pin_hash THEN
    UPDATE public.import_pin_settings
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
          updated_at = now()
    WHERE business_id = p_business_id
    RETURNING * INTO v_row;
    RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, v_row.locked_until,
                        GREATEST(0, 5 - v_row.failed_attempts);
    RETURN;
  END IF;

  UPDATE public.import_pin_settings
    SET failed_attempts = 0, locked_until = NULL, last_success_at = now(), updated_at = now()
  WHERE business_id = p_business_id;

  DELETE FROM public.import_pin_sessions s
   WHERE (s.business_id = p_business_id AND s.user_id = auth.uid()) OR s.expires_at < now();

  INSERT INTO public.import_pin_sessions (business_id, user_id)
  VALUES (p_business_id, auth.uid())
  RETURNING import_pin_sessions.token, import_pin_sessions.expires_at INTO v_token, v_expires;

  RETURN QUERY SELECT true, v_token, v_expires, NULL::timestamptz, 5;
END;
$function$;