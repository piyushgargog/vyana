-- 0003_storage.sql
-- Storage buckets and policies for Vyana
-- Owner: Vaibhav Parmar

-- Private buckets. Path format: {user_id}/{uuid}.{jpg,png,pdf}. The server reads them with the
-- service role; clients view files through createSignedUrl (60 min).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('prescriptions', 'prescriptions', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf']),
  ('lab-reports', 'lab-reports', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies for 'prescriptions' bucket
create policy "prescriptions_insert_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'prescriptions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "prescriptions_select_own_folder"
  on storage.objects for select
  using (
    bucket_id = 'prescriptions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "prescriptions_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id = 'prescriptions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for 'lab-reports' bucket
create policy "lab_reports_insert_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'lab-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lab_reports_select_own_folder"
  on storage.objects for select
  using (
    bucket_id = 'lab-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lab_reports_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id = 'lab-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
