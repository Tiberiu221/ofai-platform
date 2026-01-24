#!/usr/bin/env python3
"""
Example scraping script - demonstrates deterministic execution pattern
"""

import os
import json
import time
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def scrape_site(url, categories=None, max_pages=10):
    """
    Scrape product data from a single e-commerce site

    Args:
        url (str): Base URL of the website
        categories (list): List of category paths to scrape
        max_pages (int): Maximum number of pages per category

    Returns:
        dict: Scraped product data with metadata
    """

    # Configuration
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }

    results = {
        'url': url,
        'timestamp': time.time(),
        'products': [],
        'errors': []
    }

    try:
        # Test connectivity
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        # TODO: Implement actual scraping logic based on site structure
        # This is a placeholder showing the deterministic pattern

        print(f"Successfully connected to {url}")
        print(f"Status code: {response.status_code}")

        # Example: Parse homepage
        soup = BeautifulSoup(response.content, 'html.parser')
        title = soup.find('title')
        if title:
            results['site_title'] = title.get_text().strip()

        # Add rate limiting
        time.sleep(2)

    except requests.RequestException as e:
        error_msg = f"Failed to connect to {url}: {str(e)}"
        print(error_msg)
        results['errors'].append(error_msg)

    return results

def save_results(results, output_path):
    """Save results to JSON file"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Results saved to {output_path}")

if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print("Usage: python scrape_single_site.py <url> [categories] [max_pages]")
        sys.exit(1)

    url = sys.argv[1]
    categories = sys.argv[2].split(',') if len(sys.argv) > 2 else None
    max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    # Run scraping
    results = scrape_site(url, categories, max_pages)

    # Save to temporary directory
    output_path = '.tmp/raw_products.json'
    save_results(results, output_path)

    # Print summary
    print(f"\nScraping complete:")
    print(f"- Products found: {len(results['products'])}")
    print(f"- Errors: {len(results['errors'])}")
