-- Storage bucket for receipts
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

-- Only authenticated users can upload to their own folder
create policy "receipts_upload" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_select" on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_delete" on storage.objects for delete
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
