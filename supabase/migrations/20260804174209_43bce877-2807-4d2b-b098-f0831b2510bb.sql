DROP POLICY IF EXISTS media_read ON storage.objects;

CREATE POLICY media_read_owner ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR (storage.foldername(name))[2] = 'avatars'
  )
);