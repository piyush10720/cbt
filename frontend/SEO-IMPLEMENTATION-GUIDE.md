# SEO Implementation Guide

## Overview
This guide outlines the SEO strategy for the CBT Platform. The goal is to ensure that the platform is discoverable and looks professional when shared on social media.

## Core Components

### 1. Meta Tags
Every page should have:
- **Title**: Unique title for the page (e.g., "Dashboard | CBT Platform").
- **Description**: A concise summary of the page content (150-160 characters).
- **Keywords**: Relevant keywords (optional, but good for some crawlers).

### 2. Open Graph (OG) Tags
For better social media sharing (Facebook, LinkedIn, Discord, etc.):
- `og:title`: Same as page title.
- `og:description`: Same as page description.
- `og:image`: A high-quality image representing the page or platform.
- `og:url`: Canonical URL of the page.
- `og:type`: Usually `website`.

### 3. Twitter Cards
For Twitter sharing:
- `twitter:card`: `summary_large_image`.
- `twitter:title`, `twitter:description`, `twitter:image`.

## Implementation Details

### Reusable Component
We use a `SEO` component (located in `src/components/SEO.tsx`) to manage these tags.

```tsx
<SEO 
  title="Dashboard" 
  description="Manage your exams and view results." 
  image="/og-dashboard.png" // Optional override
/>
```

### Default Configuration
- **Default Title**: "CBT Platform - Computer Based Testing"
- **Default Description**: "Modern Computer Based Testing platform for creating and taking online exams."
- **Default Image**: `/og-image.png` (Located in `public/`)

## Assets
- **Robots.txt**: Located in `public/robots.txt`.
- **Sitemap**: Located in `public/sitemap.xml`.
