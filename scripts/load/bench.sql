\set r random(0, 574)
SELECT id FROM public.profiles ORDER BY id OFFSET :r LIMIT 1;
SELECT * FROM public.dose_logs WHERE patient_id = (SELECT id FROM public.profiles ORDER BY id OFFSET :r LIMIT 1) ORDER BY scheduled_for DESC LIMIT 20;
SELECT * FROM public.share_links WHERE token = 'load-' || (1 + :r);
SELECT count(*), coalesce(sum(input_tokens),0) FROM public.ai_runs WHERE user_id = (SELECT id FROM public.profiles ORDER BY id OFFSET :r LIMIT 1) AND created_at >= current_date;
