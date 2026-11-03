/* PrintPress ERP (online) - connection settings.

   Fill in these two values from your Supabase project:
     Supabase dashboard > Project Settings > API
       supabaseUrl      = "Project URL"            (looks like https://abcdefgh.supabase.co)
       supabaseAnonKey  = "anon public" key        (long text with two dots)

   The anon key is safe to put here: it is meant to be public, and the database rules
   (Row Level Security) decide what each signed-in person may see or change.
   NEVER put the "service_role" key here.

   If you leave this empty, the app will ask for the two values on first start (saved on that device only). */
window.PP_CONFIG = {
  supabaseUrl: 'https://ofyokrmklppboccxysrv.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9meW9rcm1rbHBwYm9jY3h5c3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTYyNjAsImV4cCI6MjEwOTI3MjI2MH0.DGoDdGw167d4acovycVNtqR2ZrLP5Ct2pjsnoXTQdZY'
};
