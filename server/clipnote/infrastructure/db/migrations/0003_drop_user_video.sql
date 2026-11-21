-- Favourites were removed from the product, so the per-user favourites table is no
-- longer read or written. This drops it and the favourite flags it holds; they cannot
-- be recovered afterwards, so back the table up first if you might want them.

DROP TABLE IF EXISTS user_video;
