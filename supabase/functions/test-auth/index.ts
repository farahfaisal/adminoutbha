const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const info = {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlValue: supabaseUrl || 'NOT_SET',
      serviceKeyPrefix: supabaseServiceKey ? supabaseServiceKey.substring(0, 20) + '...' : 'NOT_SET',
      serviceKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0,
      allEnvKeys: Object.keys(Deno.env.toObject())
    };

    return new Response(
      JSON.stringify(info, null, 2),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});