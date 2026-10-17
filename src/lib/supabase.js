import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key);
        } catch (error) {
          console.error('Error reading from localStorage:', error);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.error('Error writing to localStorage:', error);
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Error removing from localStorage:', error);
        }
      }
    }
  }
})

// Enhanced error handling and retry logic
export const withRetry = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Check for Supabase errors
      if (result.error) {
        throw new Error(result.error.message || 'Supabase operation failed');
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry on authentication errors or client errors (4xx)
      if (error.message?.includes('auth') || 
          error.message?.includes('unauthorized') ||
          error.message?.includes('forbidden')) {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError.message}`);
};

// Enhanced query wrapper with better error handling
export const supabaseQuery = async (queryFn, options = {}) => {
  const { 
    maxRetries = 3, 
    delay = 1000, 
    fallbackData = null,
    showUserError = true 
  } = options;
  
  try {
    return await withRetry(queryFn, maxRetries, delay);
  } catch (error) {
    console.error('Supabase query failed:', error);
    
    if (showUserError) {
      // You can customize this to show toast notifications or other UI feedback
      console.warn('Database connection issue. Please check your internet connection and try again.');
    }
    
    // Return fallback data if provided
    if (fallbackData !== null) {
      return { data: fallbackData, error: null };
    }
    
    throw error;
  }
};

// Connection health check
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id')
      .limit(1);
    
    return { connected: !error, error };
  } catch (error) {
    return { connected: false, error: error.message };
  }
};