-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false);

-- Add file columns to messages table
ALTER TABLE public.messages
ADD COLUMN file_url TEXT,
ADD COLUMN file_name TEXT,
ADD COLUMN file_type TEXT,
ADD COLUMN file_size INTEGER;

-- Create RLS policies for chat-files bucket
CREATE POLICY "Users can view files in their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-files' AND
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.file_url = storage.objects.name
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload files to their conversations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-files' AND
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.file_url = storage.objects.name
    AND c.user_id = auth.uid()
  )
);