CREATE POLICY "Owners can update their listing images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'listings' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
WITH CHECK (bucket_id = 'listings' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Owners can update their scan images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'scans' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
WITH CHECK (bucket_id = 'scans' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);