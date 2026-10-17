/*
# Fix vendor categories to match database vendor types
# Only two categories: مطاعم and سوبر ماركت
*/

-- Clear existing categories
DELETE FROM vendor_categories_table;

-- Insert only the two categories matching vendor types
INSERT INTO vendor_categories_table (name, slug, description, image_url) VALUES
('مطاعم', 'restaurants', 'قسم المطاعم والمأكولات', 'https://cguqangamenwttxreprq.supabase.co/storage/v1/object/public/general/categories/1o6m8jdwc7x_1788779240994.jpeg'),
('سوبر ماركت', 'super-market', 'قسم السوبر ماركت والبقالة', 'https://cguqangamenwttxreprq.supabase.co/storage/v1/object/public/general/categories/8lxsuouquhj_1788779078114.jpeg');
