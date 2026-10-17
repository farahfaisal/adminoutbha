/*
# Create missing storage buckets

1. New Storage Buckets
- `general` - for general files (category images, etc.) - public
- `products` - for product images - public
- `vendors` - for vendor images/logos - public
- `profiles` - for user profile pictures - public
- `advertisements` - for advertisement banners - public
- `addons` - for product addon images - public

2. Security
- All buckets are public (anyone can read files)
- Write access controlled by RLS policies on storage.objects
*/

INSERT INTO storage.buckets (id, name, public) VALUES ('general', 'general', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('vendors', 'vendors', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profiles', 'profiles', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('advertisements', 'advertisements', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('addons', 'addons', true) ON CONFLICT (id) DO NOTHING;
