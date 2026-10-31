CREATE OR REPLACE FUNCTION public.create_negotiation_contract(_id uuid, _expected integer, _actor uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n public.request_negotiations; d uuid; body_text text;
BEGIN
 SELECT * INTO n FROM public.request_negotiations WHERE id=_id FOR UPDATE;
 IF n.id IS NULL OR _actor NOT IN(n.buyer_id,n.seller_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF n.version<>_expected THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(n.snapshot->'conditions') c WHERE c->'term'<>'null'::jsonb) OR EXISTS(SELECT 1 FROM jsonb_array_elements(n.snapshot->'conditions') c WHERE c->'term'<>'null'::jsonb AND (COALESCE((c->>'buyerAccepted')::boolean,false)=false OR COALESCE((c->>'sellerAccepted')::boolean,false)=false)) THEN RAISE EXCEPTION 'NOT_AGREED'; END IF;
 IF n.snapshot->'finalProposals'->'buyer' IS DISTINCT FROM 'true'::jsonb OR n.snapshot->'finalProposals'->'seller' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'NOT_FINAL'; END IF;
 SELECT 'ЧЕРНОВИК ДОГОВОРА — НЕ ПОДПИСАН' || E'\nПереговоры: ' || n.id || E'\nВерсия: ' || n.version || E'\nПокупатель: ' || n.buyer_id || E'\nПродавец: ' || n.seller_id || E'\n\nСогласованные условия:\n' || string_agg((c->>'key') || ': ' || (c->'term'->>'value'), E'\n') INTO body_text FROM jsonb_array_elements(n.snapshot->'conditions') c WHERE c->'term'<>'null'::jsonb;
 INSERT INTO public.documents(owner_id,title,counterparty,status,body,negotiation_id,negotiation_version) SELECT u,'Договор · версия '||n.version,CASE WHEN u=n.buyer_id THEN n.seller_id::text ELSE n.buyer_id::text END,'Черновик',body_text,n.id,n.version FROM unnest(ARRAY[n.buyer_id,n.seller_id]) u ON CONFLICT(negotiation_id,owner_id,negotiation_version) DO NOTHING;
 SELECT id INTO d FROM public.documents WHERE negotiation_id=n.id AND owner_id=_actor AND negotiation_version=n.version;
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.create_negotiation_contract(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_negotiation_contract(uuid,integer,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.commit_request_negotiation(_id uuid,_expected integer,_actor uuid,_action text,_key text,_snapshot jsonb) RETURNS public.request_negotiations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n public.request_negotiations; next_snapshot jsonb;
BEGIN
 SELECT * INTO n FROM public.request_negotiations WHERE id=_id FOR UPDATE;
 IF n.id IS NULL OR _actor NOT IN(n.buyer_id,n.seller_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF n.version<>_expected THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
 IF _action NOT IN ('accept','propose') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 next_snapshot := jsonb_set(_snapshot,'{finalProposals}',CASE WHEN _action='propose' THEN '{"buyer":false,"seller":false}'::jsonb ELSE COALESCE(n.snapshot->'finalProposals','{"buyer":false,"seller":false}'::jsonb) END);
 UPDATE public.request_negotiations SET snapshot=next_snapshot,version=version+1,updated_at=now() WHERE id=_id RETURNING * INTO n;
 INSERT INTO public.negotiation_versions(negotiation_id,version,actor_id,action,param_key,snapshot) VALUES(n.id,n.version,_actor,_action,_key,next_snapshot);
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.commit_request_negotiation(uuid,integer,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_request_negotiation(uuid,integer,uuid,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_request_negotiation(_id uuid,_expected integer,_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n public.request_negotiations; actor_side text; next_snapshot jsonb; d uuid;
BEGIN
 SELECT * INTO n FROM public.request_negotiations WHERE id=_id FOR UPDATE;
 IF n.id IS NULL OR _actor NOT IN(n.buyer_id,n.seller_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF n.version<>_expected THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
 actor_side := CASE WHEN _actor=n.buyer_id THEN 'buyer' ELSE 'seller' END;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(n.snapshot->'conditions') c WHERE c->'term'<>'null'::jsonb) OR EXISTS(SELECT 1 FROM jsonb_array_elements(n.snapshot->'conditions') c WHERE c->'term'<>'null'::jsonb AND c->(actor_side||'Accepted') IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'NOT_READY'; END IF;
 IF n.snapshot->'finalProposals'->actor_side IS DISTINCT FROM 'true'::jsonb THEN
  next_snapshot := jsonb_set(n.snapshot,'{finalProposals}',COALESCE(n.snapshot->'finalProposals','{"buyer":false,"seller":false}'::jsonb));
  next_snapshot := jsonb_set(next_snapshot,ARRAY['finalProposals',actor_side],'true'::jsonb);
  UPDATE public.request_negotiations SET snapshot=next_snapshot,version=version+1,updated_at=now() WHERE id=_id RETURNING * INTO n;
  INSERT INTO public.negotiation_versions(negotiation_id,version,actor_id,action,snapshot) VALUES(n.id,n.version,_actor,'finalize',n.snapshot);
 END IF;
 IF n.snapshot->'finalProposals'->'buyer'='true'::jsonb AND n.snapshot->'finalProposals'->'seller'='true'::jsonb THEN
  d := public.create_negotiation_contract(n.id,n.version,_actor);
 END IF;
 RETURN jsonb_build_object('negotiation',to_jsonb(n),'contractId',d);
END $$;
REVOKE ALL ON FUNCTION public.finalize_request_negotiation(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_request_negotiation(uuid,integer,uuid) TO service_role;