# Web Scraping Directive - Example

## Purpose
Scrape product data from e-commerce websites and store it in a structured format.

## Inputs
- Website URL
- Product categories to scrape
- Number of pages to scrape (optional, default: 10)

## Tools
- `execution/scrape_single_site.py` - Main scraping script
- `execution/clean_product_data.py` - Data cleaning and validation

## Process

1. **Initialize**
   - Validate URL format
   - Check if website is accessible
   - Load scraping configuration

2. **Scrape Data**
   - Run `scrape_single_site.py` with URL and categories
   - Save raw data to `.tmp/raw_products.json`
   - Handle rate limiting (wait 2 seconds between requests)

3. **Clean Data**
   - Run `clean_product_data.py` on raw data
   - Validate product fields (name, price, image, URL)
   - Remove duplicates
   - Save to `.tmp/cleaned_products.json`

4. **Upload Results**
   - Create or update Google Sheet with product data
   - Include timestamp and source URL
   - Share sheet link with user

## Outputs
- Google Sheet with cleaned product data
- Temporary files in `.tmp/` (can be deleted after upload)

## Edge Cases

### Rate Limiting
- If receiving 429 errors, increase wait time to 5 seconds
- Some sites require headers to mimic browser behavior

### Missing Data
- Products without prices are flagged but not removed
- Missing images default to placeholder URL

### Pagination Issues
- If pagination fails, try scraping individual category pages
- Some sites use infinite scroll (requires Selenium instead of requests)

## Learnings

**2024-01-20**: Discovered that emag.ro requires User-Agent header and cookies to prevent blocking. Updated `scrape_single_site.py` to include these.

**2024-01-22**: Rate limit is 1 request per 3 seconds for flanco.ro. Updated configuration.
