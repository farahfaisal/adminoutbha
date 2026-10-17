/*
# Seed vendor categories table with default categories

1. Data
- Insert default vendor categories matching the general categories
- Use image_url from existing general categories where available
*/

INSERT INTO vendor_categories_table (name, slug, description, image_url)
SELECT
  c.name,
  lower(replace(c.name, ' ', '-')),
  c.description,
  c.image_url
FROM categories c
WHERE c.parent_id IS NULL
ON CONFLICT DO NOTHING;
