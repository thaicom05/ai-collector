
CREATE POLICY "Users upload own scan images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scans' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users view own scan images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'scans' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own scan images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'scans' AND (storage.foldername(name))[1] = auth.uid()::text);
