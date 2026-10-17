-- Grant EXECUTE on get_financial_summary to anon role
-- Regular admins sign in anonymously and need this permission to view the financial dashboard
GRANT EXECUTE ON FUNCTION public.get_financial_summary() TO anon;