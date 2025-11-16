-- Add deletion_scheduled_at column to profiles table for soft delete with grace period
ALTER TABLE public.profiles 
ADD COLUMN deletion_scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create a function to permanently delete accounts after grace period (7 days)
CREATE OR REPLACE FUNCTION public.delete_expired_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete users whose deletion was scheduled more than 7 days ago
  DELETE FROM auth.users
  WHERE id IN (
    SELECT id FROM public.profiles
    WHERE deletion_scheduled_at IS NOT NULL
    AND deletion_scheduled_at < NOW() - INTERVAL '7 days'
  );
END;
$$;

COMMENT ON COLUMN public.profiles.deletion_scheduled_at IS 'Timestamp when account deletion was scheduled. Account will be permanently deleted after 7 days grace period.';