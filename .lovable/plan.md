## Set uploaded image as favicon

1. Delete existing `public/favicon.ico` (browsers request it by default and would override).
2. Copy `user-uploads://ChatGPT_Image_Jun_10_2025_11_16_54_AM.png` to `public/favicon.png`.
3. Update `index.html` favicon link to `<link rel="icon" href="/favicon.png" type="image/png">`.

No other changes.