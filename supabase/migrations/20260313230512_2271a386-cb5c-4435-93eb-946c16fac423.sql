-- Create private bucket for AI campaign assets
insert into storage.buckets (id, name, public)
values ('ai-campaign-assets', 'ai-campaign-assets', false)
on conflict (id) do nothing;

-- Allow authenticated users to upload only to their own folder in this bucket
create policy "Users can upload own AI assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ai-campaign-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read only their own files in this bucket
create policy "Users can read own AI assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ai-campaign-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update only their own files in this bucket
create policy "Users can update own AI assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ai-campaign-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'ai-campaign-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete only their own files in this bucket
create policy "Users can delete own AI assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ai-campaign-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);