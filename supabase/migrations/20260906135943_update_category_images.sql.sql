/*
# Update category images

1. Changes
- Sets image_url for all existing categories using locally generated images
- Each category gets a matching image based on its name
*/

UPDATE categories SET image_url = '/category-burger.webp' WHERE name = 'برجر';
UPDATE categories SET image_url = '/category-pizza.webp' WHERE name = 'بيتزا';
UPDATE categories SET image_url = '/category-chicken.webp' WHERE name = 'دجاج';
UPDATE categories SET image_url = '/category-grilled.webp' WHERE name = 'مشاوي';
UPDATE categories SET image_url = '/category-sandwiches.webp' WHERE name = 'سندويشات';
UPDATE categories SET image_url = '/category-desserts.webp' WHERE name = 'حلويات';
UPDATE categories SET image_url = '/category-drinks.webp' WHERE name = 'مشروبات';
UPDATE categories SET image_url = '/category-bakery.webp' WHERE name = 'مخبوزات';
UPDATE categories SET image_url = '/category-dairy.webp' WHERE name = 'ألبان';
UPDATE categories SET image_url = '/category-produce.webp' WHERE name = 'خضار وفواكه';
UPDATE categories SET image_url = '/category-snacks.webp' WHERE name = 'وجبات خفيفة';
UPDATE categories SET image_url = '/category-market.webp' WHERE name = 'ماركت';
UPDATE categories SET image_url = '/category-restaurants.webp' WHERE name = 'مطاعم';
